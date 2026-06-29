import { describe, it, expect } from 'bun:test';
import { Player } from '../../core/Player.js';

const qti3Item = (identifier: string, body: string, declarations = '') => `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="${identifier}" title="${identifier}" adaptive="false" time-dependent="false">
  ${declarations}
  <qti-item-body>${body}</qti-item-body>
</qti-assessment-item>`;

describe('QTI 3.0 Basic/Advanced Shared Vocabulary clean-room extraction', () => {
	it('Q2: extracts qti-labels-none and qti-orientation-horizontal from choice interaction', () => {
		const xml = qti3Item(
			'qti3-choice-sv',
			`<qti-choice-interaction response-identifier="RESPONSE" max-choices="1"
        class="qti-labels-none qti-orientation-horizontal qti-choices-stacking-2">
        <qti-prompt>Select the renewable energy source.</qti-prompt>
        <qti-simple-choice identifier="solar">Solar</qti-simple-choice>
        <qti-simple-choice identifier="coal">Coal</qti-simple-choice>
      </qti-choice-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('choiceInteraction');
		expect(interaction.maxChoices).toBe(1);
		expect(interaction.interactionClasses).toContain('qti-labels-none');
		expect(interaction.interactionClasses).toContain('qti-orientation-horizontal');
		expect(interaction.interactionClasses).toContain('qti-choices-stacking-2');
	});

	it('Q2: treats max-choices="0" as unlimited for multiple cardinality', () => {
		const xml = qti3Item(
			'qti3-choice-multiple',
			`<qti-choice-interaction response-identifier="RESPONSE" max-choices="0">
        <qti-simple-choice identifier="oxygen">Oxygen</qti-simple-choice>
        <qti-simple-choice identifier="nitrogen">Nitrogen</qti-simple-choice>
        <qti-simple-choice identifier="water">Water vapor</qti-simple-choice>
      </qti-choice-interaction>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('choiceInteraction');
		expect(interaction.maxChoices).toBe(0);
		expect(interaction.choices).toHaveLength(3);
	});

	it('Q5: extracts qti-height-lines and qti-counter classes from extended text', () => {
		const xml = qti3Item(
			'qti3-extended-text-sv',
			`<qti-extended-text-interaction response-identifier="RESPONSE"
        class="qti-height-lines-6 qti-counter-down"
        expected-lines="6" expected-length="600"/>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('extendedTextInteraction');
		expect(interaction.expectedLines).toBe(6);
		expect(interaction.interactionClasses).toContain('qti-height-lines-6');
		expect(interaction.interactionClasses).toContain('qti-counter-down');
	});

	it('Q20: extracts qti-input-width and data-patternmask-message from text entry', () => {
		const xml = qti3Item(
			'qti3-text-entry-sv',
			`<p>Enter the three-letter code:
        <qti-text-entry-interaction response-identifier="RESPONSE"
          class="qti-input-width-6"
          pattern-mask="[A-Z]{3}"
          data-patternmask-message="Use exactly three uppercase letters."/>
      </p>`,
			'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>'
		);
		const interaction = new Player({ itemXml: xml }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('textEntryInteraction');
		expect(interaction.interactionClasses).toContain('qti-input-width-6');
		expect(interaction.patternMaskMessage).toBe('Use exactly three uppercase letters.');
	});
});
