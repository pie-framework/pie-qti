import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import {
	applyToolSupports,
	companionMaterialsOf,
	resolveQtiSectionComposition,
	type QtiSectionModel,
	type QtiSectionToolConfig,
} from '../../src/index.js';

const QTI22_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1" title="Angles" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <companionMaterialsInfo>
    <calculator>
      <calculatorType>graphing</calculatorType>
      <description>A graphing calculator</description>
    </calculator>
    <protractor>
      <description>A protractor</description>
    </protractor>
  </companionMaterialsInfo>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">45</simpleChoice>
      <simpleChoice identifier="B">90</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

const PLAIN_ITEM = `<assessmentItem identifier="item-2" title="Plain" adaptive="false" timeDependent="false">
  <itemBody><p>No materials</p></itemBody>
</assessmentItem>`;

const offeredTools: QtiSectionToolConfig[] = [
	{ toolId: 'calculator', enabled: false },
	{ toolId: 'protractor', enabled: false },
	{ toolId: 'ruler', enabled: false },
	{ toolId: 'textToSpeech' },
];

const enabledIds = (tools: QtiSectionToolConfig[] | undefined) => (tools ?? []).map((tool) => String(tool.toolId));

describe.each([
	['QTI 2.2', QTI22_ITEM, PLAIN_ITEM],
	['QTI 3.0', convertQti2ToQti3(QTI22_ITEM), convertQti2ToQti3(PLAIN_ITEM)],
])('PNP tool supports and companion materials (%s)', (_version, itemXml, plainXml) => {
	const section = (tools: QtiSectionToolConfig[]): QtiSectionModel => ({
		identifier: 'section-1',
		tools,
		itemRefs: [
			{ identifier: 'item-1', itemXml, tools },
			{ identifier: 'item-2', itemXml: plainXml, tools },
		],
	});

	test('reads the companion materials', () => {
		expect(companionMaterialsOf(itemXml)).toEqual({ calculator: { type: 'graphing' }, protractor: true });
		expect(companionMaterialsOf(plainXml)).toBeUndefined();
	});

	test('companion materials turn on the offered tools of their item', () => {
		const composition = resolveQtiSectionComposition({ section: section(offeredTools) });
		const [first, second] = composition.section.itemRefs;
		expect(enabledIds(first?.tools)).toEqual(['calculator', 'protractor', 'textToSpeech']);
		expect(first?.tools?.[0]?.renderParams).toEqual({ calculatorType: 'graphing' });
		expect(enabledIds(second?.tools)).toEqual(['textToSpeech']);
		expect(enabledIds(composition.section.tools)).toEqual(['calculator', 'protractor', 'textToSpeech']);
	});

	test('section tools follow the active item', () => {
		const composition = resolveQtiSectionComposition({ section: section(offeredTools), activeItemIndex: 1 });
		expect(enabledIds(composition.section.tools)).toEqual(['textToSpeech']);
	});

	test('PNP supports turn on offered tools and prohibitions remove tools', () => {
		const composition = resolveQtiSectionComposition({
			section: section(offeredTools),
			activeItemIndex: 1,
			pnp: {
				tools: {
					supports: ['ruler', 'calculator'],
					prohibitedSupports: ['textToSpeech'],
					toolParameters: { calculator: { type: 'scientific' } },
				},
			},
		});
		expect(enabledIds(composition.section.tools)).toEqual(['calculator', 'ruler']);
		expect(composition.section.tools?.[0]?.renderParams).toEqual({ calculatorType: 'scientific' });
		// The item's own calculator type wins over the PNP's.
		expect(composition.section.itemRefs[0]?.tools?.[0]?.renderParams).toEqual({ calculatorType: 'graphing' });
	});
});

describe('applyToolSupports', () => {
	test('a screen reader support withholds read-aloud', () => {
		const tools = applyToolSupports(offeredTools, { tools: { supports: ['screenReader'] } });
		expect(enabledIds(tools?.filter((tool) => tool.enabled !== false))).toEqual([]);
		expect(enabledIds(tools)).not.toContain('textToSpeech');
	});

	test('read-aloud takes the PNP rate and pitch unless the host sets them', () => {
		const pnp = { tools: { supports: ['textToSpeech'], toolParameters: { textToSpeech: { rate: 1.5, pitch: 1 } } } };
		expect(applyToolSupports([{ toolId: 'textToSpeech' }], pnp)?.[0]?.provider).toEqual({ rate: 1.5, pitch: 1 });
		expect(applyToolSupports([{ toolId: 'textToSpeech', provider: { rate: 1 } }], pnp)?.[0]?.provider).toEqual({
			rate: 1,
			pitch: 1,
		});
	});

	test('a host calculator type wins', () => {
		const tools = applyToolSupports(
			[{ toolId: 'calculator', renderParams: { calculatorType: 'basic' } }],
			{ tools: { supports: ['calculator'], toolParameters: { calculator: { type: 'graphing' } } } },
		);
		expect(tools?.[0]?.renderParams).toEqual({ calculatorType: 'basic' });
	});

	test('leaves tools alone without a PNP or companion materials', () => {
		expect(applyToolSupports(offeredTools, undefined)).toBe(offeredTools);
	});
});
