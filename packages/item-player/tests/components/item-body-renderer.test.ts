/**
 * The item body renderer mounts every interaction into the slot at its authored position and
 * keeps it there: a response change updates props, a changed body moves the live interaction
 * into its new slot, and nothing remounts unless its interaction went away.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { parseHTML } from 'linkedom';
import {
	createItemBodyRenderer,
	type MountedInteraction,
	type SlottedMount,
} from '../../src/components/utils/itemBodyRenderer.js';
import { sentenceContextId } from '../../src/components/utils/sentenceContext.js';

interface TestMount extends SlottedMount {
	readonly label: string;
}

const slot = (id: string, placement: 'block' | 'inline' = 'block') =>
	`<span class="qti-interaction-slot qti-interaction-slot--${placement}" data-qti-interaction-slot="${id}"></span>`;

const BODY = `<p>Part A</p>${slot('0')}<p>Part B: fill ${slot('1', 'inline')} here.</p><div class="qti-layout-row"><div class="qti-layout-col6">${slot('2')}</div></div><p>The end</p>`;

let document: Document;
let container: HTMLElement;
let log: string[];
let placedIn: Map<string, Element | null>;

function harness() {
	const renderer = createItemBodyRenderer<TestMount>(container, {
		create(mount): MountedInteraction<TestMount> {
			log.push(`create ${mount.key}`);
			const element = document.createElement('x-interaction');
			element.setAttribute('data-key', mount.key);
			element.textContent = mount.label;
			return {
				element,
				update(next) {
					log.push(`update ${next.key}`);
					element.textContent = next.label;
				},
				placed(target) {
					placedIn.set(mount.key, target);
				},
				destroy() {
					log.push(`destroy ${mount.key}`);
				},
			};
		},
		onError(mount, error) {
			log.push(`error ${mount.key}: ${(error as Error).message}`);
		},
	});
	return renderer;
}

const mountEl = (key: string) => container.querySelector(`[data-key="${key}"]`);
const slotEl = (id: string) => container.querySelector(`[data-qti-interaction-slot="${id}"]`);

beforeEach(() => {
	({ document } = parseHTML('<!doctype html><html><body><div id="body"></div></body></html>') as unknown as {
		document: Document;
	});
	container = document.getElementById('body') as HTMLElement;
	log = [];
	placedIn = new Map();
});

describe('createItemBodyRenderer', () => {
	test('mounts every interaction into the slot at its authored position', () => {
		const renderer = harness();
		renderer.render(BODY, [
			{ key: 'choice', slot: '0', label: 'choice' },
			{ key: 'blank', slot: '1', label: 'blank' },
			{ key: 'essay', slot: '2', label: 'essay' },
		]);

		expect(mountEl('choice')?.parentNode).toBe(slotEl('0'));
		expect(mountEl('blank')?.parentNode).toBe(slotEl('1'));
		expect(mountEl('essay')?.parentNode).toBe(slotEl('2'));
		// The inline slot is still inside its paragraph, between the words around it.
		expect(slotEl('1')?.parentNode?.textContent).toBe('Part B: fill blank here.');
		expect(container.querySelectorAll('p')).toHaveLength(3);
		expect(slotEl('2')?.parentNode).toBe(container.querySelector('.qti-layout-col6'));
		expect(placedIn.get('choice')).toBe(slotEl('0'));
		expect(container.querySelector('.qti-item-body-unslotted')).toBeNull();
	});

	test('a response change updates the interaction in place without remounting it', () => {
		const renderer = harness();
		const mounts = [{ key: 'choice', slot: '0', label: 'before' }];
		renderer.render(BODY, mounts);
		const element = mountEl('choice');
		const paragraph = container.querySelector('p');
		log = [];

		renderer.render(BODY, [{ key: 'choice', slot: '0', label: 'after' }]);

		expect(log).toEqual(['update choice']);
		expect(mountEl('choice')).toBe(element);
		expect(element?.textContent).toBe('after');
		// Unchanged markup is not rendered again.
		expect(container.querySelector('p')).toBe(paragraph);
	});

	test('a changed body moves live interactions into their new slots instead of remounting them', () => {
		const renderer = harness();
		const mounts = [
			{ key: 'choice', slot: '0', label: 'choice' },
			{ key: 'blank', slot: '1', label: 'blank' },
		];
		renderer.render(BODY, mounts);
		const choice = mountEl('choice');
		const blank = mountEl('blank');
		const oldParagraph = container.querySelector('p');
		log = [];

		const withFeedback = BODY.replace('<p>The end</p>', '<div class="feedback"><p>Well done</p></div><p>The end</p>');
		renderer.render(withFeedback, mounts);

		expect(log).toEqual(['update choice', 'update blank']);
		expect(container.querySelector('.feedback')?.textContent).toBe('Well done');
		expect(oldParagraph?.isConnected).toBe(false);
		expect(mountEl('choice')).toBe(choice);
		expect(mountEl('blank')).toBe(blank);
		expect(choice?.parentNode).toBe(slotEl('0'));
		expect(blank?.parentNode).toBe(slotEl('1'));
		expect(container.querySelectorAll('[data-qti-interaction-slot="0"]')).toHaveLength(1);
	});

	test('an interaction without a slot in the body renders after it, in order', () => {
		const renderer = harness();
		renderer.render(BODY, [
			{ key: 'first', slot: null, label: 'first' },
			{ key: 'choice', slot: '0', label: 'choice' },
			{ key: 'missing', slot: '9', label: 'missing' },
		]);

		const unslotted = container.querySelector('.qti-item-body-unslotted');
		expect(unslotted?.parentNode).toBe(container);
		expect(container.lastElementChild).toBe(unslotted);
		expect(Array.from(unslotted?.children ?? []).map((child) => child.getAttribute('data-key'))).toEqual([
			'first',
			'missing',
		]);
		expect(placedIn.get('missing')).toBeNull();

		// Once every interaction has its slot the area goes away.
		renderer.render(BODY, [{ key: 'choice', slot: '0', label: 'choice' }]);
		expect(container.querySelector('.qti-item-body-unslotted')).toBeNull();
	});

	test('a slot that disappears from a new body moves its interaction after the body', () => {
		const renderer = harness();
		renderer.render(BODY, [{ key: 'essay', slot: '2', label: 'essay' }]);
		const essay = mountEl('essay');

		renderer.render('<p>Only text now</p>', [{ key: 'essay', slot: '2', label: 'essay' }]);

		expect(mountEl('essay')).toBe(essay);
		expect(essay?.parentNode).toBe(container.querySelector('.qti-item-body-unslotted'));
	});

	test('interactions that went away are destroyed and new ones created', () => {
		const renderer = harness();
		renderer.render(BODY, [{ key: 'old', slot: '0', label: 'old' }]);
		log = [];

		renderer.render(BODY, [{ key: 'new', slot: '0', label: 'new' }]);

		expect(log).toEqual(['destroy old', 'create new']);
		expect(mountEl('old')).toBeNull();
		expect(mountEl('new')?.parentNode).toBe(slotEl('0'));
	});

	test('one interaction failing to mount does not stop the others', () => {
		const renderer = createItemBodyRenderer<TestMount>(container, {
			create(mount) {
				if (mount.key === 'broken') throw new Error('no renderer');
				const element = document.createElement('x-interaction');
				element.setAttribute('data-key', mount.key);
				return { element, update() {}, destroy() {} };
			},
			onError(mount, error) {
				log.push(`error ${mount.key}: ${(error as Error).message}`);
			},
		});
		renderer.render(BODY, [
			{ key: 'broken', slot: '0', label: '' },
			{ key: 'fine', slot: '2', label: '' },
		]);

		expect(log).toEqual(['error broken: no renderer']);
		expect(mountEl('fine')?.parentNode).toBe(slotEl('2'));
	});

	test('destroy tears every interaction down', () => {
		const renderer = harness();
		renderer.render(BODY, [
			{ key: 'choice', slot: '0', label: '' },
			{ key: 'blank', slot: '1', label: '' },
		]);
		log = [];

		renderer.destroy();

		expect(log).toEqual(['destroy choice', 'destroy blank']);
		expect(container.querySelector('x-interaction')).toBeNull();
	});
});

describe('sentenceContextId', () => {
	test('describes a blank by the paragraph it sits in, giving the paragraph an id', () => {
		container.innerHTML = `<p>Fill ${slot('0', 'inline')} here.</p><div>${slot('1', 'inline')}</div>`;
		let next = 0;
		const nextId = () => `ctx-${++next}`;

		const first = sentenceContextId(slotEl('0') as Element, container, nextId);
		expect(first).toBe('ctx-1');
		expect(container.querySelector('p')?.id).toBe('ctx-1');
		// The id is reused, not reassigned.
		expect(sentenceContextId(slotEl('0') as Element, container, nextId)).toBe('ctx-1');
		// A slot that is in no sentence block gets no description.
		expect(sentenceContextId(slotEl('1') as Element, container, nextId)).toBeUndefined();
	});

	test('keeps an authored id', () => {
		container.innerHTML = `<p id="authored">Fill ${slot('0', 'inline')}</p>`;
		expect(sentenceContextId(slotEl('0') as Element, container, () => 'unused')).toBe('authored');
	});
});
