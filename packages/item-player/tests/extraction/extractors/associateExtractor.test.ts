/**
 * Tests for standardAssociateExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardAssociateExtractor } from '../../../src/extraction/extractors/associateExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardAssociateExtractor', () => {
	test('extracts basic associate interaction', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" shuffle="true" maxAssociations="3">
				<prompt>Associate related items</prompt>
				<simpleAssociableChoice identifier="A" matchMax="2">Item A</simpleAssociableChoice>
				<simpleAssociableChoice identifier="B" matchMax="2">Item B</simpleAssociableChoice>
				<simpleAssociableChoice identifier="C" matchMax="2">Item C</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.shuffle).toBe(true);
		expect(result.maxAssociations).toBe(3);
		expect(result.prompt).toBe('Associate related items');
		expect(result.choices).toHaveLength(3);
	});

	test('extracts choices with matchMax values', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleAssociableChoice identifier="A" matchMax="1">Single match</simpleAssociableChoice>
				<simpleAssociableChoice identifier="B" matchMax="3">Multiple matches</simpleAssociableChoice>
				<simpleAssociableChoice identifier="C" matchMax="0">Unlimited</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.choices[0].matchMax).toBe(1);
		expect(result.choices[1].matchMax).toBe(3);
		expect(result.choices[2].matchMax).toBe(0);
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleAssociableChoice identifier="A" matchMax="1">Item A</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
	});

	test('uses default values when attributes not specified', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE">
				<simpleAssociableChoice identifier="A">Item A</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		expect(result.maxAssociations).toBe(0);
		expect(result.choices[0].matchMax).toBe(1);
	});

	test('handles choices with HTML content', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleAssociableChoice identifier="A" matchMax="1">Item with <strong>bold</strong></simpleAssociableChoice>
				<simpleAssociableChoice identifier="B" matchMax="1">Item with <em>italic</em></simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.choices[0].text).toContain('bold');
		expect(result.choices[1].text).toContain('italic');
	});

	describe('canHandle predicate', () => {
		test('handles associateInteraction element', () => {
			const xml = `
				<associateInteraction responseIdentifier="RESPONSE">
					<simpleAssociableChoice identifier="A">Item A</simpleAssociableChoice>
				</associateInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardAssociateExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-associateInteraction elements', () => {
			const xml = `<matchInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardAssociateExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct associate data', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A', matchMax: 1 },
					{ identifier: 'B', text: 'Item B', matchMax: 1 },
				],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for insufficient choices', () => {
			const data = {
				choices: [{ identifier: 'A', text: 'Item A', matchMax: 1 }],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('associateInteraction must have at least 2 choices');
		});

		test('reports error for missing identifiers', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A', matchMax: 1 },
					{ identifier: '', text: 'Item B', matchMax: 1 },
				],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('All choices must have an identifier');
		});

		test('reports error for duplicate identifiers', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A', matchMax: 1 },
					{ identifier: 'A', text: 'Item B', matchMax: 1 },
				],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate choice identifier: A');
		});
	});
});
