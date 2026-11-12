import { afterEach, describe, expect, test, vi } from 'vitest';

// A stand-in element stands in for the real item player: the tests dispatch its
// documented `error` event at the rendered node and watch the bridge forward it.
vi.mock('@pie-qti/item-player/element', () => {
	if (!customElements.get('pie-qti-item-player')) {
		customElements.define('pie-qti-item-player', class extends HTMLElement {});
	}
	return {};
});

import ItemRenderer from '../../src/components/ItemRenderer.svelte';
import { mountInto, settle, type Mounted } from './helpers';
import { reactiveProps } from './reactive-props.svelte';

const mounted: Mounted[] = [];

const ITEM_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="q1" title="Q" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

async function mountRenderer(onFrameworkError: (error: unknown) => void) {
	const state = reactiveProps({
		itemRef: { identifier: 'q1', title: 'Question q1', itemXml: ITEM_XML, responses: {} },
		onFrameworkError,
	});
	const m = mountInto(ItemRenderer, state);
	mounted.push(m);
	await settle();
	return m;
}

/** The player element the renderer mounted once the (stand-in) element loaded. */
function playerElement(): HTMLElement {
	const node = document.querySelector<HTMLElement>('pie-qti-item-player');
	if (!node) throw new Error('the item player element did not render');
	return node;
}

describe('the item player error bridge', () => {
	test('forwards the element error event as a framework error, keeping code, message and item', async () => {
		const onFrameworkError = vi.fn();
		const m = await mountRenderer(onFrameworkError);

		const message = 'parser exploded on <responseProcessing>';
		playerElement().dispatchEvent(
			new CustomEvent('error', {
				bubbles: true,
				composed: true,
				detail: { code: 'item-load-failed', message, itemIdentifier: 'q1' },
			}),
		);

		expect(onFrameworkError).toHaveBeenCalledTimes(1);
		expect(onFrameworkError).toHaveBeenCalledWith({
			itemIdentifier: 'q1',
			code: 'item-load-failed',
			message,
		});
		// The message is raw engine text for host logs; it is never rendered to the
		// candidate, here or anywhere else in the section.
		expect(m.host.textContent).not.toContain(message);
	});

	test('an error without its own item identifier names the presented item', async () => {
		const onFrameworkError = vi.fn();
		await mountRenderer(onFrameworkError);

		playerElement().dispatchEvent(
			new CustomEvent('error', {
				bubbles: true,
				composed: true,
				detail: { code: 'response-processing-failed', message: 'response processing threw' },
			}),
		);

		expect(onFrameworkError).toHaveBeenCalledWith({
			itemIdentifier: 'q1',
			code: 'response-processing-failed',
			message: 'response processing threw',
		});
	});
});
