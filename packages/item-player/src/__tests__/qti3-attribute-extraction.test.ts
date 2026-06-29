/**
 * QTI 3.0 Attribute Extraction Tests
 *
 * Verifies that the attribute mapper integration works correctly for QTI 3.0
 * kebab-case attributes at the extraction utilities layer.
 */

import { describe, it, expect } from 'bun:test';
import { parse } from 'node-html-parser';
import { createQtiParser } from '@pie-qti/qti-common';
import { createExtractionUtils } from '../extraction/utils.js';
import type { QTIElement } from '../interactions/index.js';

describe('QTI 3.0 Attribute Extraction', () => {
	it('should extract max-choices attribute (kebab-case) from QTI 3.0 element', () => {
		const xml = `
<qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
	<qti-prompt>Select one</qti-prompt>
	<qti-simple-choice identifier="A">Choice A</qti-simple-choice>
</qti-choice-interaction>`;

		const { attributeMapper } = createQtiParser(xml);
		const dom = parse(xml);
		const element = dom.querySelector('qti-choice-interaction') as unknown as QTIElement;

		const utils = createExtractionUtils(undefined, undefined, attributeMapper);

		// Extract QTI 3.0 kebab-case attributes using camelCase names
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 0);
		const shuffle = utils.getBooleanAttribute(element, 'shuffle', true);
		const responseId = utils.getAttribute(element, 'responseIdentifier', '');

		expect(maxChoices).toBe(1);
		expect(shuffle).toBe(false);
		expect(responseId).toBe('RESPONSE');
	});

	it('should extract expected-length attribute from QTI 3.0 text entry', () => {
		const xml = `
<qti-text-entry-interaction response-identifier="RESPONSE" expected-length="15" />`;

		const { attributeMapper } = createQtiParser(xml);
		const dom = parse(xml);
		const element = dom.querySelector('qti-text-entry-interaction') as unknown as QTIElement;

		const utils = createExtractionUtils(undefined, undefined, attributeMapper);

		const expectedLength = utils.getNumberAttribute(element, 'expectedLength', 0);
		const responseId = utils.getAttribute(element, 'responseIdentifier', '');

		expect(expectedLength).toBe(15);
		expect(responseId).toBe('RESPONSE');
	});

	it('should extract expected-lines and placeholder-text from QTI 3.0 extended text', () => {
		const xml = `
<qti-extended-text-interaction
	response-identifier="RESPONSE"
	expected-lines="5"
	expected-length="500"
	placeholder-text="Type here..." />`;

		const { attributeMapper } = createQtiParser(xml);
		const dom = parse(xml);
		const element = dom.querySelector('qti-extended-text-interaction') as unknown as QTIElement;

		const utils = createExtractionUtils(undefined, undefined, attributeMapper);

		const expectedLines = utils.getNumberAttribute(element, 'expectedLines', 0);
		const expectedLength = utils.getNumberAttribute(element, 'expectedLength', 0);
		const placeholderText = utils.getAttribute(element, 'placeholderText', '');

		expect(expectedLines).toBe(5);
		expect(expectedLength).toBe(500);
		expect(placeholderText).toBe('Type here...');
	});

	it('should extract max-associations from QTI 3.0 match interaction', () => {
		const xml = `
<qti-match-interaction response-identifier="RESPONSE" shuffle="false" max-associations="3">
	<qti-simple-match-set>
		<qti-simple-associable-choice identifier="A" match-max="1">Item A</qti-simple-associable-choice>
	</qti-simple-match-set>
</qti-match-interaction>`;

		const { attributeMapper } = createQtiParser(xml);
		const dom = parse(xml);
		const interaction = dom.querySelector('qti-match-interaction') as unknown as QTIElement;
		const choice = dom.querySelector('qti-simple-associable-choice') as unknown as QTIElement;

		const utils = createExtractionUtils(undefined, undefined, attributeMapper);

		const maxAssociations = utils.getNumberAttribute(interaction, 'maxAssociations', 0);
		const matchMax = utils.getNumberAttribute(choice, 'matchMax', 0);

		expect(maxAssociations).toBe(3);
		expect(matchMax).toBe(1);
	});

	it('should handle QTI 2.x camelCase attributes with default mapper', () => {
		const xml = `
<choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="2">
	<simpleChoice identifier="A">Choice A</simpleChoice>
</choiceInteraction>`;

		// No mapper specified - defaults to QTI 2.x
		const dom = parse(xml);
		const element = dom.querySelector('choiceinteraction') as unknown as QTIElement;

		const utils = createExtractionUtils(); // Defaults to Qti2xAttributeNameMapper

		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 0);
		const shuffle = utils.getBooleanAttribute(element, 'shuffle', false);
		const responseId = utils.getAttribute(element, 'responseIdentifier', '');

		expect(maxChoices).toBe(2);
		expect(shuffle).toBe(true);
		expect(responseId).toBe('RESPONSE');
	});

	it('should handle boolean attributes correctly for both versions', () => {
		// QTI 3.0
		const qti3xml = `<qti-choice-interaction shuffle="true" />`;
		const { attributeMapper: qti3Mapper } = createQtiParser(qti3xml);
		const qti3Dom = parse(qti3xml);
		const qti3Element = qti3Dom.querySelector('qti-choice-interaction') as unknown as QTIElement;
		const qti3Utils = createExtractionUtils(undefined, undefined, qti3Mapper);

		expect(qti3Utils.getBooleanAttribute(qti3Element, 'shuffle', false)).toBe(true);

		// QTI 2.x
		const qti2xml = `<choiceInteraction shuffle="true" />`;
		const qti2Dom = parse(qti2xml);
		const qti2Element = qti2Dom.querySelector('choiceinteraction') as unknown as QTIElement;
		const qti2Utils = createExtractionUtils(); // defaults

		expect(qti2Utils.getBooleanAttribute(qti2Element, 'shuffle', false)).toBe(true);
	});

	it('should return default values when attributes are missing', () => {
		const xml = `<qti-choice-interaction response-identifier="RESPONSE" />`;
		const { attributeMapper } = createQtiParser(xml);
		const dom = parse(xml);
		const element = dom.querySelector('qti-choice-interaction') as unknown as QTIElement;

		const utils = createExtractionUtils(undefined, undefined, attributeMapper);

		// These attributes don't exist, should return defaults
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 99);
		const shuffle = utils.getBooleanAttribute(element, 'shuffle', true);

		expect(maxChoices).toBe(99);
		expect(shuffle).toBe(true);
	});

	it('should handle lower-bound and upper-bound for slider', () => {
		const xml = `
<qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="100" step="5" />`;

		const { attributeMapper } = createQtiParser(xml);
		const dom = parse(xml);
		const element = dom.querySelector('qti-slider-interaction') as unknown as QTIElement;

		const utils = createExtractionUtils(undefined, undefined, attributeMapper);

		const lowerBound = utils.getNumberAttribute(element, 'lowerBound', 0);
		const upperBound = utils.getNumberAttribute(element, 'upperBound', 0);
		const step = utils.getNumberAttribute(element, 'step', 0);

		expect(lowerBound).toBe(0);
		expect(upperBound).toBe(100);
		expect(step).toBe(5);
	});
});
