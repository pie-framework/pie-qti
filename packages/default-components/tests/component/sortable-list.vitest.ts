import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import SortableList from '../../src/shared/components/SortableList.svelte';
import {
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
} from './helpers';

/** Ids that occur more than once in the document. */
function duplicateIds(): string[] {
	const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
	return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

/** Every id an attribute references must resolve inside the given host. */
function expectReferencesInside(host: HTMLElement, element: Element, attribute: string): void {
	const ids = (element.getAttribute(attribute) ?? '').split(' ').filter(Boolean);
	expect(ids.length, `${attribute} must reference something`).toBeGreaterThan(0);
	for (const id of ids) {
		const referenced = document.getElementById(id);
		expect(referenced, `#${id} must exist`).not.toBeNull();
		expect(host.contains(referenced), `#${id} must belong to its own instance`).toBe(true);
	}
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('SortableList accessible naming', () => {
	test('the item button names via the rendered rich content (image alt and MathML)', async () => {
		const mounted = mountInteraction(SortableList, {
			items: [
				{ id: 'I1', text: '<img src="volcano.png" alt="Volcano erupts">' },
				{ id: 'I2', text: '<math alttext="x squared"><msup><mi>x</mi><mn>2</mn></msup></math>' },
			],
			orderedIds: ['I1', 'I2'],
			onReorder: () => {},
		});
		await settle();

		const items = qa(mounted, 'button[part="item"]');
		expect(items).toHaveLength(2);
		for (const item of items) {
			expect(item.hasAttribute('aria-label')).toBe(false);
		}

		// The name source is the rendered element, so image alt participates.
		const firstNamed = document.getElementById(items[0]!.getAttribute('aria-labelledby') ?? '');
		expect(firstNamed?.querySelector('img')?.getAttribute('alt')).toBe('Volcano erupts');

		// MathML keeps its alttext in the name element instead of flattening to "x2".
		const secondNamed = document.getElementById(items[1]!.getAttribute('aria-labelledby') ?? '');
		expect(secondNamed?.querySelector('math')?.getAttribute('alttext')).toBe('x squared');
		cleanupInteraction(mounted);
	});

	test('position and grabbed state live in the describedby target', async () => {
		const mounted = mountInteraction(SortableList, {
			items: [
				{ id: 'I1', text: 'One' },
				{ id: 'I2', text: 'Two' },
			],
			orderedIds: ['I1', 'I2'],
			onReorder: () => {},
		});
		await settle();

		const item = q(mounted, 'button[part="item"]')!;
		const state = document.getElementById(item.getAttribute('aria-describedby') ?? '');
		expect(state?.textContent?.trim()).toBe('Position 1 of 2');
		cleanupInteraction(mounted);
	});

	test('move buttons are named for their item, and an image-only item still reads its alt', async () => {
		const mounted = mountInteraction(SortableList, {
			items: [
				{ id: 'I1', text: '<img src="sun.png" alt="Sun">' },
				{ id: 'I2', text: 'Moon' },
			],
			orderedIds: ['I1', 'I2'],
			onReorder: () => {},
		});
		await settle();

		const buttons = qa<HTMLButtonElement>(mounted, '.qti-sortable-moves button');
		expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
			'Move Sun earlier',
			'Move Sun later',
			'Move Moon earlier',
			'Move Moon later',
		]);
		cleanupInteraction(mounted);
	});
});

describe('SortableList list name', () => {
	test('names itself by default, or by the caller\'s visible label when one is given', async () => {
		const items = [
			{ id: 'I1', text: 'One' },
			{ id: 'I2', text: 'Two' },
		];
		const plain = mountInteraction(SortableList, { items, orderedIds: ['I1', 'I2'], onReorder: () => {} });
		const label = document.createElement('p');
		label.id = 'external-order-label';
		label.textContent = 'Your order';
		document.body.appendChild(label);
		const labelled = mountInteraction(SortableList, {
			items,
			orderedIds: ['I1', 'I2'],
			labelledBy: 'external-order-label',
			onReorder: () => {},
		});
		await settle();

		const plainList = q(plain, '[role="list"]')!;
		expect(plainList.getAttribute('aria-label')).toBe('Reorderable list of choices');
		expect(plainList.hasAttribute('aria-labelledby')).toBe(false);

		const labelledList = q(labelled, '[role="list"]')!;
		expect(labelledList.getAttribute('aria-labelledby')).toBe('external-order-label');
		expect(labelledList.hasAttribute('aria-label')).toBe(false);
		cleanupInteraction(plain, labelled);
	});
});

describe('SortableList instance-unique ids', () => {
	test('two lists with the same item ids keep their own instruction, name and state ids', async () => {
		const props = {
			items: [
				{ id: 'I1', text: 'One' },
				{ id: 'I2', text: 'Two' },
			],
			orderedIds: ['I1', 'I2'],
			onReorder: () => {},
		};
		const first = mountInteraction(SortableList, props);
		const second = mountInteraction(SortableList, props);
		await settle();

		expect(duplicateIds()).toEqual([]);
		for (const mounted of [first, second]) {
			expectReferencesInside(mounted.host, q(mounted, '[part="list"]')!, 'aria-describedby');
			for (const item of qa(mounted, 'button[part="item"]')) {
				expectReferencesInside(mounted.host, item, 'aria-labelledby');
				expectReferencesInside(mounted.host, item, 'aria-describedby');
			}
		}
		cleanupInteraction(first, second);
	});
});

describe('SortableList grabbed state', () => {
	test('grabbing is exposed through the description, data-grabbed and a live announcement, not aria-grabbed', async () => {
		const mounted = mountInteraction(SortableList, {
			items: [
				{ id: 'I1', text: 'One' },
				{ id: 'I2', text: 'Two' },
			],
			orderedIds: ['I1', 'I2'],
			onReorder: () => {},
		});
		await settle();

		const item = q<HTMLButtonElement>(mounted, 'button[part="item"]')!;
		pressKey(item, 'Enter');
		await settle();

		expect(item.dataset.grabbed).toBe('true');
		const state = document.getElementById(item.getAttribute('aria-describedby') ?? '');
		expect(state?.textContent).toContain('Grabbed. Use arrow keys to move.');
		expect(q(mounted, '[aria-live="polite"]')?.textContent).toContain('One grabbed.');
		// aria-grabbed is deprecated since WAI-ARIA 1.1 and unreliable in current screen readers.
		expect(qa(mounted, '[aria-grabbed]')).toHaveLength(0);

		pressKey(item, 'Enter');
		await settle();
		expect(item.dataset.grabbed).toBe('false');
		expect(qa(mounted, '[aria-grabbed]')).toHaveLength(0);
		cleanupInteraction(mounted);
	});

	test('no drag component in this package emits the deprecated aria-grabbed', () => {
		const dragSources = [
			'src/shared/components/SortableList.svelte',
			'src/shared/components/MatchDragDrop.svelte',
			'src/shared/components/DragHandle.svelte',
			'src/plugins/gap-match/GapMatchInteraction.svelte',
		];
		for (const file of dragSources) {
			const source = readFileSync(resolve(process.cwd(), file), 'utf8');
			expect(source, file).not.toContain('aria-grabbed');
		}
	});
});
