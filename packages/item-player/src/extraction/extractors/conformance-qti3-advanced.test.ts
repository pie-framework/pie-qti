import { describe, expect, it } from 'bun:test';
import { Player } from '../../core/Player.js';

const qti3Item = (identifier: string, body: string, declarations = '') => `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="${identifier}" title="${identifier}" adaptive="false" time-dependent="false">
  ${declarations}
  <qti-item-body>${body}</qti-item-body>
</qti-assessment-item>`;

describe('QTI 3.0 Advanced clean-room item extraction', () => {
	it('Q6: extracts gap match selection messages and gap choices', () => {
		const xml = qti3Item(
			'qti3-gap-match',
			`<qti-gap-match-interaction response-identifier="RESPONSE"
        class="qti-choices-top"
        data-max-selections-message="You have used all labels."
        data-min-selections-message="Use at least one label.">
        <qti-prompt>Complete the sentence.</qti-prompt>
        <qti-gap-text identifier="producer" match-max="1">producer</qti-gap-text>
        <qti-gap-text identifier="consumer" match-max="1">consumer</qti-gap-text>
        <p>A plant is a <qti-gap identifier="gap_1"/>.</p>
      </qti-gap-match-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('gapMatchInteraction');
		expect(interaction.interactionClasses).toContain('qti-choices-top');
		expect(interaction.maxSelectionsMessage).toBe('You have used all labels.');
		expect(interaction.minSelectionsMessage).toBe('Use at least one label.');
		expect(interaction.gaps).toHaveLength(1);
	});

	it('Q8: extracts graphic gap match choices and hotspots', () => {
		const xml = qti3Item(
			'qti3-graphic-gap',
			`<qti-graphic-gap-match-interaction response-identifier="RESPONSE">
        <qti-object data="images/food-web.svg" type="image/svg+xml" width="500" height="300">Food web</qti-object>
        <qti-gap-text identifier="grass" match-max="1">Grass</qti-gap-text>
        <qti-gap-img identifier="hawk" match-max="1" src="images/hawk.svg"/>
        <qti-associable-hotspot identifier="A" match-max="1" shape="rect" coords="20,20,120,80"/>
        <qti-associable-hotspot identifier="B" match-max="1" shape="circle" coords="350,140,32"/>
      </qti-graphic-gap-match-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('graphicGapMatchInteraction');
		expect(interaction.imageData.src).toBe('images/food-web.svg');
		expect(interaction.gapTexts).toHaveLength(1);
		expect(interaction.gapImages).toHaveLength(1);
		expect(interaction.hotspots).toHaveLength(2);
	});

	it('Q10: extracts hotspot shapes from QTI 3.0 element names', () => {
		const xml = qti3Item(
			'qti3-hotspot',
			`<qti-hotspot-interaction response-identifier="RESPONSE" max-choices="1">
        <qti-object data="images/water-cycle.svg" type="image/svg+xml" width="400" height="300">Water cycle</qti-object>
        <qti-hotspot-choice identifier="evaporation" shape="circle" coords="100,200,35"/>
        <qti-hotspot-choice identifier="condensation" shape="poly" coords="210,60,260,70,250,120,205,115"/>
      </qti-hotspot-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('hotspotInteraction');
		expect(interaction.maxChoices).toBe(1);
		expect(interaction.hotspotChoices.map((h: any) => h.shape)).toEqual(['circle', 'poly']);
	});

	it('Q11: extracts hottext choices from QTI 3.0 markup', () => {
		const xml = qti3Item(
			'qti3-hottext',
			`<qti-hottext-interaction response-identifier="RESPONSE" max-choices="1">
        <qti-prompt>Select the adjective.</qti-prompt>
        <p>The <qti-hottext identifier="word_1">bright</qti-hottext> star <qti-hottext identifier="word_2">shines</qti-hottext>.</p>
      </qti-hottext-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('hottextInteraction');
		expect(interaction.hottextChoices.map((h: any) => h.identifier)).toEqual(['word_1', 'word_2']);
	});

	it('Q12: extracts inline choices with MathML content', () => {
		const xml = qti3Item(
			'qti3-inline-choice',
			`<p>The value of
        <math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn><mo>+</mo><mn>3</mn></math>
        is <qti-inline-choice-interaction response-identifier="RESPONSE">
          <qti-inline-choice identifier="five">5</qti-inline-choice>
          <qti-inline-choice identifier="six">6</qti-inline-choice>
        </qti-inline-choice-interaction>.
      </p>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>'
		);
		const player = new Player({ itemXml: xml });
		const interaction = player.getInteractionData()[0] as any;

		expect(interaction.type).toBe('inlineChoiceInteraction');
		expect(interaction.choices).toHaveLength(2);
		expect(player.getItemBodyHtml()).toContain('<math');
	});

	it('Q13: extracts tabular match shared vocabulary classes', () => {
		const xml = qti3Item(
			'qti3-match',
			`<qti-match-interaction response-identifier="RESPONSE" max-associations="2"
        class="qti-match-tabular qti-header-hidden">
        <qti-simple-match-set>
          <qti-simple-associable-choice identifier="herbivore" match-max="1">Herbivore</qti-simple-associable-choice>
          <qti-simple-associable-choice identifier="carnivore" match-max="1">Carnivore</qti-simple-associable-choice>
        </qti-simple-match-set>
        <qti-simple-match-set>
          <qti-simple-associable-choice identifier="eats_plants" match-max="1">Eats plants</qti-simple-associable-choice>
          <qti-simple-associable-choice identifier="eats_animals" match-max="1">Eats animals</qti-simple-associable-choice>
        </qti-simple-match-set>
      </qti-match-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('matchInteraction');
		expect(interaction.interactionClasses).toContain('qti-match-tabular');
		expect(interaction.interactionClasses).toContain('qti-header-hidden');
	});

	it('I17: extracts composite QTI 3.0 items with multiple interactions', () => {
		const xml = qti3Item(
			'qti3-composite',
			`<qti-choice-interaction response-identifier="CHOICE" max-choices="1">
        <qti-simple-choice identifier="A">A</qti-simple-choice>
        <qti-simple-choice identifier="B">B</qti-simple-choice>
      </qti-choice-interaction>
      <p>Short answer: <qti-text-entry-interaction response-identifier="TEXT" expected-length="12"/></p>
      <qti-extended-text-interaction response-identifier="ESSAY" expected-lines="4"/>`,
			`<qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier"/>
      <qti-response-declaration identifier="TEXT" cardinality="single" base-type="string"/>
      <qti-response-declaration identifier="ESSAY" cardinality="single" base-type="string"/>`
		);
		const types = new Player({ itemXml: xml }).getInteractionData().map((i) => i.type).sort();

		expect(types).toEqual(['choiceInteraction', 'extendedTextInteraction', 'textEntryInteraction']);
	});
});

describe('QTI 3.0 Advanced clean-room content preservation', () => {
	it('I4: preserves shared stimulus references for package-level stimulus loading', () => {
		const xml = qti3Item(
			'qti3-shared-stimulus',
			`<qti-assessment-stimulus-ref identifier="stimulus_1" href="../stimuli/river-study.xml" data-stimulus-idref="stimulus_1"/>
      <p data-stimulus-idref="stimulus_1"></p>
      <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
        <qti-simple-choice identifier="A">Erosion</qti-simple-choice>
        <qti-simple-choice identifier="B">Condensation</qti-simple-choice>
      </qti-choice-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>'
		);
		const html = new Player({ itemXml: xml }).getItemBodyHtml();

		expect(html).toContain('qti-assessment-stimulus-ref');
		expect(html).toContain('data-stimulus-idref="stimulus_1"');
		expect(html).toContain('../stimuli/river-study.xml');
	});

	it('I19b/I20: preserves full Shared Vocabulary classes in item body HTML', () => {
		const xml = qti3Item(
			'qti3-shared-vocabulary',
			`<div class="qti-align-center qti-fullwidth">
        <p class="qti-underline qti-italic">Observe the emphasized vocabulary.</p>
      </div>
      <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
        <qti-simple-choice identifier="A">Kept</qti-simple-choice>
      </qti-choice-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>'
		);
		const html = new Player({ itemXml: xml }).getItemBodyHtml();

		expect(html).toContain('qti-underline');
		expect(html).toContain('qti-italic');
		expect(html).toContain('qti-align-center');
		expect(html).toContain('qti-fullwidth');
	});

	it('P7: tolerates QTI metadata while delivering item content', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  xmlns:lom="http://ltsc.ieee.org/xsd/LOM"
  identifier="qti3-metadata" title="Metadata Item" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <lom:lom><lom:general><lom:title><lom:string>Clean-room metadata</lom:string></lom:title></lom:general></lom:lom>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Metadata is not candidate-visible.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;
		const player = new Player({ itemXml: xml });

		expect(player.getInteractionData()).toHaveLength(1);
		expect(player.getItemBodyHtml()).toContain('Metadata is not candidate-visible');
	});

	it('A13/A15: preserves caption tracks and glossary catalog references', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-captions-glossary" title="Captions and Glossary" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-catalog-info>
    <qti-card identifier="word-delta">
      <qti-card-entry usage="glossary-on-screen">
        <qti-html-content>A landform where a river divides before entering a larger body of water.</qti-html-content>
      </qti-card-entry>
    </qti-card>
  </qti-catalog-info>
  <qti-item-body>
    <video controls="controls" width="320">
      <source src="media/river-delta.mp4" type="video/mp4"/>
      <track kind="captions" srclang="en" src="media/river-delta-captions.vtt" label="English captions"/>
    </video>
    <p>The <span data-catalog-idref="word-delta">delta</span> changes over time.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">True</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;
		const player = new Player({ itemXml: xml });
		const html = player.getItemBodyHtml();

		expect(html).toContain('<video');
		expect(html).toContain('<track');
		expect(html).toContain('kind="captions"');
		expect(html).toContain('data-catalog-idref="word-delta"');
		expect(player.getCatalogEntry('word-delta', 'glossary-on-screen')).toContain('river divides');
	});
});
