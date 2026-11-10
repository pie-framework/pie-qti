import { afterEach, describe, expect, test, vi } from 'vitest';

// The item player element is the item player package's; a stand-in keeps these tests on
// the section's own behaviour.
vi.mock('@pie-qti/item-player/element', () => {
	if (!customElements.get('pie-qti-item-player')) {
		customElements.define('pie-qti-item-player', class extends HTMLElement {});
	}
	return {};
});

// Only `tryPrepareReadableBlock` is replaced, and only for a marked block, which is
// prepared with a throwing preparer — the same wrapper under test, driven through
// its real catch. Everything else passes through to the real preparation.
vi.mock(import('../../src/tts/spoken-catalogs.js'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		tryPrepareReadableBlock: (rawHtml: string, language?: string) =>
			actual.tryPrepareReadableBlock(rawHtml, language, () => {
				if (!rawHtml.includes('data-explode="true"')) return actual.prepareReadableBlock(rawHtml, language);
				throw new Error('block exploded');
			}),
	};
});

import RubricDisplay from '../../src/components/RubricDisplay.svelte';
import SectionPlayerVertical from '../../src/components/SectionPlayerVertical.svelte';
import type { QtiSectionFrameworkError, ResolvedQtiSectionComposition } from '../../src/contracts/index.js';
import { resolveQtiSectionComposition } from '../../src/composition/resolveQtiSectionComposition.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];

const ITEM_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="q1" title="Q1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

function composition(itemXml: string, host: { onFrameworkError?: (error: QtiSectionFrameworkError) => void } = {}): ResolvedQtiSectionComposition {
	return resolveQtiSectionComposition({
		host,
		section: {
			identifier: 'section-1',
			itemRefs: [{ identifier: 'q1', title: 'Question one', itemXml }],
			sharedContext: {
				passages: [
					{ identifier: 'p1', kind: 'passage', scope: 'section', title: 'The Water Cycle', rawHtml: '<p>The water cycle.</p>' },
				],
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

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

describe('an item whose speech extraction is rejected', () => {
	test('the section keeps rendering and the failure reaches the host', async () => {
		const onFrameworkError = vi.fn();
		const rejected = `<!DOCTYPE assessmentItem PUBLIC "-//IMS//DTD QTI 2.2//EN" "imsqti_v2p2.dtd">${ITEM_XML}`;
		const m = mountInto(SectionPlayerVertical, { composition: composition(rejected, { onFrameworkError }) });
		mounted.push(m);
		await settle();

		// The section is not inert: passage and item player are all there.
		expect(m.host.querySelector('article.passage')).not.toBeNull();
		expect(m.host.querySelector('pie-qti-item-player')).not.toBeNull();
		expect(onFrameworkError).toHaveBeenCalledWith(
			expect.objectContaining({
				sectionIdentifier: 'section-1',
				itemIdentifier: 'q1',
				code: 'item-speech-extraction-failed',
				message: expect.stringContaining('DOCTYPE'),
			}),
		);
	});
});

describe('a shared block whose readable preparation throws', () => {
	test('the passage renders as authored and the failure reaches the host', async () => {
		const onFrameworkError = vi.fn();
		const m = mountInto(RubricDisplay, {
			passages: [
				{ identifier: 'p1', kind: 'passage', scope: 'section', title: 'Boom', rawHtml: '<p data-explode="true">Boom text</p>' },
			],
			onFrameworkError,
		});
		mounted.push(m);
		await settle();

		expect(m.host.textContent).toContain('Boom text');
		expect(onFrameworkError).toHaveBeenCalledWith(
			expect.objectContaining({ code: 'readable-block-failed', message: expect.stringContaining('block exploded') }),
		);
	});
});
