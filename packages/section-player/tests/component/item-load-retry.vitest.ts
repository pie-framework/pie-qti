import { afterEach, describe, expect, test, vi } from 'vitest';

// The first import of the item player element fails like a broken chunk; a retry
// (for the next item) succeeds and registers the stand-in.
let elementImports = 0;
vi.mock('@pie-qti/item-player/element', () => {
	elementImports += 1;
	if (elementImports === 1) throw new Error('chunk load failed');
	if (!customElements.get('pie-qti-item-player')) {
		customElements.define('pie-qti-item-player', class extends HTMLElement {});
	}
	return {};
});

import SectionPlayerVertical from '../../src/components/SectionPlayerVertical.svelte';
import type { ResolvedQtiSectionComposition } from '../../src/contracts/index.js';
import { resolveQtiSectionComposition } from '../../src/composition/resolveQtiSectionComposition.js';
import { mountInto, settle, type Mounted } from './helpers';
import { reactiveProps } from './reactive-props.svelte';

const mounted: Mounted[] = [];

const ITEM_XML = (identifier: string) => `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="Q" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

function composition(identifier: string): ResolvedQtiSectionComposition {
	return resolveQtiSectionComposition({
		section: {
			identifier: 'section-1',
			itemRefs: [{ identifier, title: `Question ${identifier}`, itemXml: ITEM_XML(identifier) }],
			sharedContext: {
				passages: [],
				stimuli: [],
				rubricBlocks: [],
				testFeedback: [],
				stylesheets: [],
				catalogSources: [],
				assetDiagnostics: [],
			},
		},
	});
}

async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
	const start = Date.now();
	for (;;) {
		await settle();
		if (check()) return;
		if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for the section to settle');
	}
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

describe('a failed item player element load', () => {
	test('alerts for that item, reports to the host, and is retried for the next item', async () => {
		const onFrameworkError = vi.fn();
		const state = reactiveProps({ composition: composition('q1'), onFrameworkError });
		const m = mountInto(SectionPlayerVertical, state);
		mounted.push(m);

		await waitFor(() => onFrameworkError.mock.calls.length > 0);
		expect(onFrameworkError).toHaveBeenCalledWith(
			expect.objectContaining({ code: 'item-player-load-failed', itemIdentifier: 'q1' }),
		);
		expect(m.host.querySelector('[role="alert"]')).not.toBeNull();
		expect(m.host.querySelector('pie-qti-item-player')).toBeNull();

		// The next item presents: the load is retried instead of staying failed.
		state.composition = composition('q2');
		await waitFor(() => m.host.querySelector('pie-qti-item-player') !== null);
		expect(m.host.querySelector('[role="alert"]')).toBeNull();
		expect(elementImports).toBe(2);
	});
});
