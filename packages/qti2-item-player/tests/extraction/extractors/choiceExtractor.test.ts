/**
 * Tests for standardChoiceExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardChoiceExtractor } from '../../../src/extraction/extractors/choiceExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardChoiceExtractor', () => {
	test('extracts basic multiple choice interaction', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<prompt>What is the capital of France?</prompt>
				<simpleChoice identifier="A">London</simpleChoice>
				<simpleChoice identifier="B">Paris</simpleChoice>
				<simpleChoice identifier="C">Berlin</simpleChoice>
				<simpleChoice identifier="D">Madrid</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		expect(result.maxChoices).toBe(1);
		expect(result.prompt).toBe('What is the capital of France?');
		expect(result.choices).toHaveLength(4);
		expect(result.choices[0]).toEqual({ identifier: 'A', text: 'London' });
		expect(result.choices[1]).toEqual({ identifier: 'B', text: 'Paris' });
	});

	test('extracts multi-select interaction', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="3">
				<prompt>Select all prime numbers</prompt>
				<simpleChoice identifier="A">2</simpleChoice>
				<simpleChoice identifier="B">3</simpleChoice>
				<simpleChoice identifier="C">4</simpleChoice>
				<simpleChoice identifier="D">5</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(true);
		expect(result.maxChoices).toBe(3);
		expect(result.choices).toHaveLength(4);
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<simpleChoice identifier="A">Choice A</simpleChoice>
				<simpleChoice identifier="B">Choice B</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
		expect(result.choices).toHaveLength(2);
	});

	test('uses default values for missing attributes', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE">
				<simpleChoice identifier="A">Choice A</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		expect(result.maxChoices).toBe(1);
	});

	test('handles choices with HTML content', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<simpleChoice identifier="A">Choice with <strong>bold</strong> text</simpleChoice>
				<simpleChoice identifier="B">Choice with <em>italic</em> text</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.choices[0].text).toContain('bold');
		expect(result.choices[1].text).toContain('italic');
	});

	test('handles empty choice list', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<prompt>Question with no choices</prompt>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.choices).toHaveLength(0);
	});

	test('extracts choice CSS classes', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<simpleChoice identifier="A" class="special highlight">Choice A</simpleChoice>
				<simpleChoice identifier="B">Choice B</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.choices[0].classes).toEqual(['special', 'highlight']);
		expect(result.choices[1].classes).toBeUndefined();
	});

	describe('canHandle predicate', () => {
		test('handles choice interaction with simpleChoice children', () => {
			const xml = `
				<choiceInteraction responseIdentifier="RESPONSE">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardChoiceExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects choice interaction without simpleChoice children', () => {
			const xml = `
				<choiceInteraction responseIdentifier="RESPONSE">
					<prompt>No choices</prompt>
				</choiceInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardChoiceExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct choice data', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Choice A' },
					{ identifier: 'B', text: 'Choice B' },
				],
				shuffle: false,
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty choices', () => {
			const data = {
				choices: [],
				shuffle: false,
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('choiceInteraction must have at least one choice');
		});

		test('reports error for missing choice identifiers', () => {
			const data = {
				choices: [
					{ identifier: '', text: 'Choice A' },
					{ identifier: 'B', text: 'Choice B' },
				],
				shuffle: false,
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('All choices must have an identifier');
		});

		test('reports error for duplicate identifiers', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Choice A' },
					{ identifier: 'A', text: 'Choice B' },
				],
				shuffle: false,
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate choice identifier: A');
		});

		test('reports warning when maxChoices exceeds choice count', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Choice A' },
					{ identifier: 'B', text: 'Choice B' },
				],
				shuffle: false,
				maxChoices: 5,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('maxChoices (5) is greater than the number of choices (2)');
		});
	});
});
