/**
 * Tests for standardOrderExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardOrderExtractor } from '../../../src/extraction/extractors/orderExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardOrderExtractor', () => {
	test('extracts basic order interaction', () => {
		const xml = `
			<orderInteraction responseIdentifier="RESPONSE" shuffle="true">
				<prompt>Arrange the following in chronological order</prompt>
				<simpleChoice identifier="A">American Revolution</simpleChoice>
				<simpleChoice identifier="B">French Revolution</simpleChoice>
				<simpleChoice identifier="C">Industrial Revolution</simpleChoice>
			</orderInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardOrderExtractor.extract(element, context);

		expect(result.shuffle).toBe(true);
		expect(result.prompt).toBe('Arrange the following in chronological order');
		expect(result.choices).toHaveLength(3);
	});

	test('extracts choices correctly', () => {
		const xml = `
			<orderInteraction responseIdentifier="RESPONSE" shuffle="false">
				<simpleChoice identifier="FIRST">First item</simpleChoice>
				<simpleChoice identifier="SECOND">Second item</simpleChoice>
				<simpleChoice identifier="THIRD">Third item</simpleChoice>
			</orderInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardOrderExtractor.extract(element, context);

		expect(result.choices[0]).toEqual({ identifier: 'FIRST', text: 'First item' });
		expect(result.choices[1]).toEqual({ identifier: 'SECOND', text: 'Second item' });
		expect(result.choices[2]).toEqual({ identifier: 'THIRD', text: 'Third item' });
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<orderInteraction responseIdentifier="RESPONSE" shuffle="true">
				<simpleChoice identifier="A">Item A</simpleChoice>
				<simpleChoice identifier="B">Item B</simpleChoice>
			</orderInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardOrderExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
	});

	test('uses default shuffle value when not specified', () => {
		const xml = `
			<orderInteraction responseIdentifier="RESPONSE">
				<simpleChoice identifier="A">Item A</simpleChoice>
			</orderInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardOrderExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
	});

	test('handles choices with HTML content', () => {
		const xml = `
			<orderInteraction responseIdentifier="RESPONSE" shuffle="false">
				<simpleChoice identifier="A">Step <strong>1</strong>: Preparation</simpleChoice>
				<simpleChoice identifier="B">Step <strong>2</strong>: Execution</simpleChoice>
			</orderInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardOrderExtractor.extract(element, context);

		expect(result.choices[0].text).toContain('Preparation');
		expect(result.choices[1].text).toContain('Execution');
	});

	test('handles large number of items', () => {
		let xml = '<orderInteraction responseIdentifier="RESPONSE" shuffle="true">';
		for (let i = 1; i <= 10; i++) {
			xml += `<simpleChoice identifier="ITEM_${i}">Item ${i}</simpleChoice>`;
		}
		xml += '</orderInteraction>';

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardOrderExtractor.extract(element, context);

		expect(result.choices).toHaveLength(10);
		expect(result.choices[0].identifier).toBe('ITEM_1');
		expect(result.choices[9].identifier).toBe('ITEM_10');
	});

	describe('canHandle predicate', () => {
		test('handles orderInteraction element', () => {
			const xml = `
				<orderInteraction responseIdentifier="RESPONSE">
					<simpleChoice identifier="A">Item A</simpleChoice>
				</orderInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardOrderExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-orderInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardOrderExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct order data', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A' },
					{ identifier: 'B', text: 'Item B' },
				],
				shuffle: false,
				prompt: null,
			};

			const validation = standardOrderExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for insufficient choices', () => {
			const data = {
				choices: [{ identifier: 'A', text: 'Item A' }],
				shuffle: false,
				prompt: null,
			};

			const validation = standardOrderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('orderInteraction must have at least 2 choices');
		});

		test('reports error for missing identifiers', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A' },
					{ identifier: '', text: 'Item B' },
				],
				shuffle: false,
				prompt: null,
			};

			const validation = standardOrderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('All choices must have an identifier');
		});

		test('reports error for duplicate identifiers', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A' },
					{ identifier: 'A', text: 'Item B' },
				],
				shuffle: false,
				prompt: null,
			};

			const validation = standardOrderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate choice identifier: A');
		});

		test('reports warning for too many choices', () => {
			const choices = [];
			for (let i = 1; i <= 15; i++) {
				choices.push({ identifier: `ITEM_${i}`, text: `Item ${i}` });
			}
			const data = {
				choices,
				shuffle: false,
				prompt: null,
			};

			const validation = standardOrderExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain(
				'orderInteraction has 15 choices - this may be difficult for users to order'
			);
		});
	});
});
