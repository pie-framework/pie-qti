/**
 * xs:boolean attribute reading across interactions (QTI 2.1 §, XML Schema Part 2).
 *
 * Every QTI interaction boolean is `xs:boolean`, whose lexical space is
 * {true, false, 1, 0} — so `shuffle="1"` and `fixed="1"` are valid authored
 * on-forms, and `"0"`/`"false"` are off. Extraction used to accept only the
 * literal `"true"`, silently reading valid `"1"` content as false.
 */

import { describe, expect, test } from 'bun:test';
import { createExtractionUtils } from '../../src/extraction/utils.js';
import { standardChoiceExtractor } from '../../src/interactions/choice/extractor.js';
import { standardEndAttemptExtractor } from '../../src/interactions/end-attempt/extractor.js';
import { standardInlineChoiceExtractor } from '../../src/interactions/inline-choice/extractor.js';
import { standardSliderExtractor } from '../../src/interactions/slider/extractor.js';
import { createTestContext, parseQTI } from './test-utils.js';

describe('getBooleanAttribute reads the full xs:boolean lexical space', () => {
	const utils = createExtractionUtils();

	test('"true" and "1" are on', () => {
		for (const value of ['true', '1']) {
			const element = parseQTI(`<item shuffle="${value}"/>`);
			expect(utils.getBooleanAttribute(element, 'shuffle')).toBe(true);
		}
	});

	test('"false" and "0" are off', () => {
		for (const value of ['false', '0']) {
			const element = parseQTI(`<item shuffle="${value}"/>`);
			expect(utils.getBooleanAttribute(element, 'shuffle')).toBe(false);
		}
	});

	test('an absent attribute takes the default', () => {
		const element = parseQTI('<item/>');
		expect(utils.getBooleanAttribute(element, 'shuffle')).toBe(false);
		expect(utils.getBooleanAttribute(element, 'shuffle', true)).toBe(true);
	});
});

describe('interaction booleans authored with the "1" form extract as on', () => {
	// The xs:boolean attributes extractors read: choice shuffle/fixed (and match,
	// associate, gap-match, graphic-order, hottext fixed), inlineChoiceInteraction
	// required/shuffle, endAttemptInteraction countAttempt, slider reverse/stepLabel,
	// mediaInteraction autostart/loop. One representative per interaction here; the
	// per-extractor suites cover their own attributes with the "true" form.
	test('choiceInteraction shuffle="1" and simpleChoice fixed="1"', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="1">
				<prompt>Pick one</prompt>
				<simpleChoice identifier="A" fixed="1">Alpha</simpleChoice>
				<simpleChoice identifier="B">Beta</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const result = standardChoiceExtractor.extract(element, createTestContext(element, 'RESPONSE'));
		expect(result.shuffle).toBe(true);
		expect(result.choices.find((c) => c.identifier === 'A')?.fixed).toBe(true);
		expect(result.choices.find((c) => c.identifier === 'B')?.fixed).toBeUndefined();
	});

	test('inlineChoiceInteraction required="1" delivers minChoices 1', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" required="1">
				<inlineChoice identifier="C1">One</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const result = standardInlineChoiceExtractor.extract(element, createTestContext(element, 'RESPONSE'));
		expect(result.minChoices).toBe(1);
	});

	test('endAttemptInteraction countAttempt="1" delivers countAttempt', () => {
		const xml = '<endAttemptInteraction responseIdentifier="RESPONSE" title="Done" countAttempt="1"/>';
		const element = parseQTI(xml);
		const result = standardEndAttemptExtractor.extract(element, createTestContext(element, 'RESPONSE'));
		expect(result.countAttempt).toBe(true);
	});

	test('sliderInteraction reverse="1" and stepLabel="1"', () => {
		const xml = `
			<sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="10" reverse="1" stepLabel="1"/>
		`;
		const element = parseQTI(xml);
		const result = standardSliderExtractor.extract(element, createTestContext(element, 'RESPONSE'));
		expect(result.reverse).toBe(true);
		expect(result.stepLabel).toBe(true);
	});
});
