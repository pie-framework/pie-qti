/**
 * Tests for standardInlineChoiceExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardInlineChoiceExtractor } from '../../../src/extraction/extractors/inlineChoiceExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardInlineChoiceExtractor', () => {
	test('extracts basic inline choice interaction', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
				<inlineChoice identifier="A">choice A</inlineChoice>
				<inlineChoice identifier="B">choice B</inlineChoice>
				<inlineChoice identifier="C">choice C</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		expect(result.choices).toHaveLength(3);
	});

	test('extracts choice identifiers and text correctly', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
				<inlineChoice identifier="CORRECT">Paris</inlineChoice>
				<inlineChoice identifier="WRONG1">London</inlineChoice>
				<inlineChoice identifier="WRONG2">Berlin</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.choices[0]).toEqual({ identifier: 'CORRECT', text: 'Paris' });
		expect(result.choices[1]).toEqual({ identifier: 'WRONG1', text: 'London' });
		expect(result.choices[2]).toEqual({ identifier: 'WRONG2', text: 'Berlin' });
	});

	test('handles interaction with shuffle enabled', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="true">
				<inlineChoice identifier="A">choice A</inlineChoice>
				<inlineChoice identifier="B">choice B</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(true);
	});

	test('handles interaction without shuffle attribute', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE">
				<inlineChoice identifier="A">choice A</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
	});

	test('handles interaction with no choices', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.choices).toHaveLength(0);
	});

	test('handles choices with HTML content', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
				<inlineChoice identifier="A">Choice with <strong>bold</strong> text</inlineChoice>
				<inlineChoice identifier="B">Choice with <em>italic</em> text</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.choices[0].text).toContain('bold');
		expect(result.choices[1].text).toContain('italic');
	});

	test('handles choices with whitespace', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
				<inlineChoice identifier="A">  text with spaces  </inlineChoice>
				<inlineChoice identifier="B">
					text with newlines
				</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.choices[0].text).toBeTruthy();
		expect(result.choices[1].text).toBeTruthy();
	});

	test('handles single choice', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
				<inlineChoice identifier="ONLY">only option</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.choices).toHaveLength(1);
		expect(result.choices[0]).toEqual({ identifier: 'ONLY', text: 'only option' });
	});

	test('handles many choices', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="true">
				<inlineChoice identifier="A">A</inlineChoice>
				<inlineChoice identifier="B">B</inlineChoice>
				<inlineChoice identifier="C">C</inlineChoice>
				<inlineChoice identifier="D">D</inlineChoice>
				<inlineChoice identifier="E">E</inlineChoice>
				<inlineChoice identifier="F">F</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.choices).toHaveLength(6);
		expect(result.choices[0].identifier).toBe('A');
		expect(result.choices[5].identifier).toBe('F');
	});

	test('handles choices with numeric text', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
				<inlineChoice identifier="N1">100</inlineChoice>
				<inlineChoice identifier="N2">200</inlineChoice>
				<inlineChoice identifier="N3">300</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.choices[0].text).toBe('100');
		expect(result.choices[1].text).toBe('200');
		expect(result.choices[2].text).toBe('300');
	});

	test('handles choices with special characters', () => {
		const xml = `
			<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false">
				<inlineChoice identifier="A">&lt;tag&gt;</inlineChoice>
				<inlineChoice identifier="B">x &amp; y</inlineChoice>
				<inlineChoice identifier="C">"quoted"</inlineChoice>
			</inlineChoiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardInlineChoiceExtractor.extract(element, context);

		expect(result.choices).toHaveLength(3);
		expect(result.choices[0].text).toBeTruthy();
		expect(result.choices[1].text).toBeTruthy();
		expect(result.choices[2].text).toBeTruthy();
	});

	describe('canHandle predicate', () => {
		test('handles inlineChoiceInteraction element', () => {
			const xml = `
				<inlineChoiceInteraction responseIdentifier="RESPONSE">
					<inlineChoice identifier="A">Choice A</inlineChoice>
				</inlineChoiceInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardInlineChoiceExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-inlineChoiceInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardInlineChoiceExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct inlineChoice data', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Choice A' },
					{ identifier: 'B', text: 'Choice B' },
				],
				shuffle: false,
			};

			const validation = standardInlineChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty choices', () => {
			const data = {
				choices: [],
				shuffle: false,
			};

			const validation = standardInlineChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('inlineChoiceInteraction must have at least one choice');
		});

		test('reports error for missing identifiers', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Choice A' },
					{ identifier: '', text: 'Choice B' },
				],
				shuffle: false,
			};

			const validation = standardInlineChoiceExtractor.validate!(data);

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
			};

			const validation = standardInlineChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate choice identifier: A');
		});

		test('reports warning for too many choices', () => {
			const choices = [];
			for (let i = 1; i <= 20; i++) {
				choices.push({ identifier: `C${i}`, text: `Choice ${i}` });
			}
			const data = {
				choices,
				shuffle: false,
			};

			const validation = standardInlineChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain(
				'inlineChoiceInteraction has 20 choices - consider limiting for better usability'
			);
		});
	});
});
