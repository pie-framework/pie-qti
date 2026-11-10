import { afterEach, describe, expect, test, vi } from 'vitest';

// The item player element is the item player package's; a stand-in keeps these tests on
// the section's own behaviour.
vi.mock('@pie-qti/item-player/element', () => {
	if (!customElements.get('pie-qti-item-player')) {
		customElements.define('pie-qti-item-player', class extends HTMLElement {});
	}
	return {};
});

import SectionPlayerSplitPane from '../../src/components/SectionPlayerSplitPane.svelte';
import SectionPlayerVertical from '../../src/components/SectionPlayerVertical.svelte';
import TestFeedback from '../../src/components/TestFeedback.svelte';
import type { ResolvedQtiSectionComposition } from '../../src/contracts/index.js';
import { resolveQtiSectionComposition } from '../../src/composition/resolveQtiSectionComposition.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];

const ITEM_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="q1" title="Q1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const AFTER_BLOCK = { identifier: 'tf-all', kind: 'test-feedback' as const, scope: 'section' as const, rawHtml: '<p>The test has ended.</p>' };
const PROCTOR_BLOCK = {
	identifier: 'tf-proctor',
	kind: 'test-feedback' as const,
	scope: 'section' as const,
	view: ['proctor'],
	rawHtml: '<p>Proctor console feedback.</p>',
};

function composition(testFeedback: typeof AFTER_BLOCK[] = []): ResolvedQtiSectionComposition {
	return resolveQtiSectionComposition({
		section: {
			identifier: 'section-1',
			itemRefs: [{ identifier: 'q1', title: 'Question one', itemXml: ITEM_XML }],
			sharedContext: {
				passages: [
					{ identifier: 'p1', kind: 'passage', scope: 'section', title: 'The Water Cycle', rawHtml: '<p>The water cycle.</p>' },
				],
				stimuli: [],
				rubricBlocks: [{ identifier: 'r1', kind: 'rubric', scope: 'section', rawHtml: '<p>Read carefully.</p>' }],
				testFeedback,
				stylesheets: [],
				catalogSources: [],
				assetDiagnostics: [],
			},
		},
	});
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

describe('TestFeedback live region', () => {
	test('the region exists before its content, so a later block still announces', async () => {
		const m = mountInto(TestFeedback, { feedback: [] });
		mounted.push(m);
		await settle();

		const region = m.host.querySelector<HTMLElement>('section[aria-live="polite"]');
		expect(region).not.toBeNull();
		expect(region?.getAttribute('aria-label')).toBe('Test feedback');
		expect(region?.textContent?.trim()).toBe('');

		const later = mountInto(TestFeedback, { feedback: [AFTER_BLOCK] });
		mounted.push(later);
		await settle();
		expect(later.host.querySelector('section[aria-live="polite"]')?.textContent).toContain('The test has ended.');
	});

	test('blocks are filtered by the role', async () => {
		const candidate = mountInto(TestFeedback, { feedback: [AFTER_BLOCK, PROCTOR_BLOCK], role: 'candidate' });
		mounted.push(candidate);
		await settle();
		expect(candidate.host.textContent).toContain('The test has ended.');
		expect(candidate.host.textContent).not.toContain('Proctor console feedback.');

		const proctor = mountInto(TestFeedback, { feedback: [AFTER_BLOCK, PROCTOR_BLOCK], role: 'proctor' });
		mounted.push(proctor);
		await settle();
		expect(proctor.host.textContent).toContain('Proctor console feedback.');
	});
});

describe('section layouts render the shared test feedback', () => {
	test('vertical: feedback renders in the question pane ahead of the rubric and item', async () => {
		const m = mountInto(SectionPlayerVertical, { composition: composition([AFTER_BLOCK]) });
		mounted.push(m);
		await settle();

		const pane = m.host.querySelector<HTMLElement>('.section-player-item-pane')!;
		const region = pane.querySelector<HTMLElement>('section[aria-live="polite"]');
		expect(region?.textContent).toContain('The test has ended.');
		const rubric = pane.querySelector<HTMLElement>('.rubric-block')!;
		expect(region!.compareDocumentPosition(rubric) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

		// Role filtering still applies at the layout.
		const proctorOnly = mountInto(SectionPlayerVertical, { composition: composition([PROCTOR_BLOCK]) });
		mounted.push(proctorOnly);
		await settle();
		expect(proctorOnly.host.textContent).not.toContain('Proctor console feedback.');
	});

	test('split pane: feedback renders in the question pane, not the passage pane', async () => {
		const m = mountInto(SectionPlayerSplitPane, { composition: composition([AFTER_BLOCK]) });
		mounted.push(m);
		await settle();

		const left = m.host.querySelector<HTMLElement>('.pane-left')!;
		const right = m.host.querySelector<HTMLElement>('.pane-right')!;
		expect(left.querySelector('section[aria-live="polite"]')).toBeNull();
		expect(right.querySelector('section[aria-live="polite"]')?.textContent).toContain('The test has ended.');
	});
});
