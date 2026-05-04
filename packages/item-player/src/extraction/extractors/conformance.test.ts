import { describe, it, expect } from 'bun:test';
import { Player } from '../../core/Player.js';

const wrapItem = (identifier: string, body: string, declarations = '') => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  ${declarations}
  <itemBody>${body}</itemBody>
</assessmentItem>`;

describe('QTI 2.2 Advanced clean-room extraction coverage', () => {
	it('Q2 Advanced: extracts a choiceInteraction with bounded single selection', () => {
		const xml = wrapItem(
			'q2-advanced-choice',
			`<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
        <prompt>Select the measurement tool for temperature.</prompt>
        <simpleChoice identifier="thermometer">Thermometer</simpleChoice>
        <simpleChoice identifier="ruler">Ruler</simpleChoice>
      </choiceInteraction>`,
			'<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('choiceInteraction');
		expect(interaction.responseId).toBe('RESPONSE');
		expect(interaction.maxChoices).toBe(1);
		expect(interaction.choices.map((c: any) => c.identifier)).toEqual(['thermometer', 'ruler']);
	});

	it('Q6: extracts gap choices, gaps, and unlimited matchMax values', () => {
		const xml = wrapItem(
			'q6-gap-match',
			`<p>Complete the energy chain:
        <gapMatchInteraction responseIdentifier="RESPONSE">
          <prompt>Drag each source into the correct gap.</prompt>
          <gapText identifier="sunlight" matchMax="0">sunlight</gapText>
          <gapText identifier="plants" matchMax="1">plants</gapText>
          <blockquote>
            <gap identifier="gap_1"/> is captured by <gap identifier="gap_2"/>.
          </blockquote>
        </gapMatchInteraction>
      </p>`,
			'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('gapMatchInteraction');
		expect(interaction.gapTexts).toHaveLength(2);
		expect(interaction.gapTexts.find((g: any) => g.identifier === 'sunlight')?.matchMax).toBe(0);
		expect(interaction.gaps).toEqual(['gap_1', 'gap_2']);
	});

	it('Q8: extracts graphic gap match background, text/image choices, and hotspots', () => {
		const xml = wrapItem(
			'q8-graphic-gap-match',
			`<graphicGapMatchInteraction responseIdentifier="RESPONSE">
        <prompt>Label the parts of the diagram.</prompt>
        <object data="images/cell-diagram.svg" type="image/svg+xml" width="400" height="300">Cell diagram</object>
        <gapText identifier="nucleus" matchMax="1">Nucleus</gapText>
        <gapImg identifier="membrane" matchMax="1" src="images/membrane-label.svg"/>
        <associableHotspot identifier="A" matchMax="1" shape="rect" coords="20,30,120,90"/>
        <associableHotspot identifier="B" matchMax="1" shape="circle" coords="250,150,35"/>
      </graphicGapMatchInteraction>`,
			'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('graphicGapMatchInteraction');
		expect(interaction.imageData.src).toBe('images/cell-diagram.svg');
		expect(interaction.imageData.width).toBe(400);
		expect(interaction.gapTexts).toHaveLength(1);
		expect(interaction.gapImages).toHaveLength(1);
		expect(interaction.hotspots.map((h: any) => h.shape)).toEqual(['rect', 'circle']);
	});

	it('Q10: extracts hotspot choices with single and multiple cardinality metadata', () => {
		const xml = wrapItem(
			'q10-hotspot',
			`<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="0" minChoices="1">
        <prompt>Select all shaded regions.</prompt>
        <object data="images/region-map.svg" type="image/svg+xml" width="320" height="240">Region map</object>
        <hotspotChoice identifier="north" shape="rect" coords="10,10,110,80"/>
        <hotspotChoice identifier="south" shape="poly" coords="20,160,90,150,110,210,30,220"/>
      </hotspotInteraction>`,
			'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('hotspotInteraction');
		expect(interaction.maxChoices).toBe(0);
		expect(interaction.minChoices).toBe(1);
		expect(interaction.hotspotChoices.map((h: any) => h.shape)).toEqual(['rect', 'poly']);
	});

	it('Q11: extracts single and multiple hottext choices', () => {
		const xml = wrapItem(
			'q11-hottext',
			`<hottextInteraction responseIdentifier="RESPONSE" maxChoices="2">
        <prompt>Select the two facts.</prompt>
        <p><hottext identifier="fact_1">Water freezes at 0 degrees Celsius.</hottext></p>
        <p><hottext identifier="opinion_1">Winter is the best season.</hottext></p>
        <p><hottext identifier="fact_2">The Moon orbits Earth.</hottext></p>
      </hottextInteraction>`,
			'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('hottextInteraction');
		expect(interaction.maxChoices).toBe(2);
		expect(interaction.hottextChoices.map((h: any) => h.identifier)).toEqual([
			'fact_1',
			'opinion_1',
			'fact_2',
		]);
	});

	it('Q12: extracts inline choices and leaves placeholders in item body HTML', () => {
		const xml = wrapItem(
			'q12-inline-choice',
			`<p>A triangle with three equal sides is
        <inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
          <inlineChoice identifier="equilateral">equilateral</inlineChoice>
          <inlineChoice identifier="scalene">scalene</inlineChoice>
        </inlineChoiceInteraction>.
      </p>`,
			'<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>'
		);
		const player = new Player({ itemXml: xml });
		const interaction = player.getInteractionData()[0] as any;

		expect(interaction.type).toBe('inlineChoiceInteraction');
		expect(interaction.choices.map((c: any) => c.identifier)).toEqual(['equilateral', 'scalene']);
		expect(player.getItemBodyHtml()).toContain('inlineChoiceInteraction');
	});

	it('Q13: extracts match sets and maxAssociations', () => {
		const xml = wrapItem(
			'q13-match',
			`<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="3">
        <prompt>Match each process to its description.</prompt>
        <simpleMatchSet>
          <simpleAssociableChoice identifier="evaporation" matchMax="1">Evaporation</simpleAssociableChoice>
          <simpleAssociableChoice identifier="condensation" matchMax="1">Condensation</simpleAssociableChoice>
        </simpleMatchSet>
        <simpleMatchSet>
          <simpleAssociableChoice identifier="liquid_to_gas" matchMax="1">Liquid changes to gas</simpleAssociableChoice>
          <simpleAssociableChoice identifier="gas_to_liquid" matchMax="1">Gas changes to liquid</simpleAssociableChoice>
        </simpleMatchSet>
      </matchInteraction>`,
			'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('matchInteraction');
		expect(interaction.maxAssociations).toBe(3);
		expect(interaction.sourceSet).toHaveLength(2);
		expect(interaction.targetSet).toHaveLength(2);
	});

	it('I17: extracts multiple interactions from one composite item', () => {
		const xml = wrapItem(
			'i17-composite',
			`<p>The state of matter with a fixed volume but no fixed shape is
        <inlineChoiceInteraction responseIdentifier="STATE" shuffle="false">
          <inlineChoice identifier="liquid">liquid</inlineChoice>
          <inlineChoice identifier="solid">solid</inlineChoice>
        </inlineChoiceInteraction>.
      </p>
      <p>Write the freezing point of water in Celsius:
        <textEntryInteraction responseIdentifier="TEMP" expectedLength="3"/>
      </p>
      <choiceInteraction responseIdentifier="UNIT" maxChoices="1">
        <simpleChoice identifier="celsius">Celsius</simpleChoice>
        <simpleChoice identifier="fahrenheit">Fahrenheit</simpleChoice>
      </choiceInteraction>`,
			`<responseDeclaration identifier="STATE" cardinality="single" baseType="identifier"/>
      <responseDeclaration identifier="TEMP" cardinality="single" baseType="string"/>
      <responseDeclaration identifier="UNIT" cardinality="single" baseType="identifier"/>`
		);
		const interactions = new Player({ itemXml: xml }).getInteractionData();
		const types = interactions.map((i) => i.type).sort();

		expect(interactions).toHaveLength(3);
		expect(types).toEqual(['choiceInteraction', 'inlineChoiceInteraction', 'textEntryInteraction']);
	});

	it('P7: ignores metadata while preserving deliverable item content', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
  identifier="p7-metadata" title="Metadata Item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <imsmd:lom>
    <imsmd:general><imsmd:title><imsmd:string>Clean-room metadata fixture</imsmd:string></imsmd:title></imsmd:general>
  </imsmd:lom>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A public fixture can include metadata.</simpleChoice>
      <simpleChoice identifier="B">Metadata prevents delivery.</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
		const player = new Player({ itemXml: xml });

		expect(player.getInteractionData()).toHaveLength(1);
		expect(player.getItemBodyHtml()).toContain('public fixture');
	});
});
