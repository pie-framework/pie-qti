/**
 * Tests for standardTextEntryExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardTextEntryExtractor } from '../../../src/extraction/extractors/textEntryExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardTextEntryExtractor', () => {
	test('extracts basic text entry interaction', () => {
		const xml = `
			<textEntryInteraction responseIdentifier="RESPONSE" expectedLength="15" />
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardTextEntryExtractor.extract(element, context);

		expect(result.expectedLength).toBe(15);
	});

	test('uses default expectedLength when not specified', () => {
		const xml = `<textEntryInteraction responseIdentifier="RESPONSE" />`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardTextEntryExtractor.extract(element, context);

		expect(result.expectedLength).toBe(20);
	});

	test('handles patternMask attribute', () => {
		const xml = `
			<textEntryInteraction
				responseIdentifier="RESPONSE"
				patternMask="[0-9]{3}-[0-9]{3}-[0-9]{4}"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardTextEntryExtractor.extract(element, context);

		expect(result.patternMask).toBe('[0-9]{3}-[0-9]{3}-[0-9]{4}');
	});

	test('handles placeholderText attribute', () => {
		const xml = `
			<textEntryInteraction
				responseIdentifier="RESPONSE"
				placeholderText="Enter your answer here"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardTextEntryExtractor.extract(element, context);

		expect(result.placeholderText).toBe('Enter your answer here');
	});

	test('handles missing optional attributes', () => {
		const xml = `<textEntryInteraction responseIdentifier="RESPONSE" />`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardTextEntryExtractor.extract(element, context);

		expect(result.patternMask).toBeFalsy();
		expect(result.placeholderText).toBe('');
	});

	describe('canHandle predicate', () => {
		test('handles textEntryInteraction element', () => {
			const xml = `<textEntryInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardTextEntryExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-textEntryInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardTextEntryExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct text entry data', () => {
			const data = {
				expectedLength: 20,
				patternMask: '',
				placeholderText: '',
			};

			const validation = standardTextEntryExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for invalid expectedLength', () => {
			const data = {
				expectedLength: -5,
				patternMask: '',
				placeholderText: '',
			};

			const validation = standardTextEntryExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('expectedLength must be positive');
		});

		test('reports warning for very large expectedLength', () => {
			const data = {
				expectedLength: 10000,
				patternMask: '',
				placeholderText: '',
			};

			const validation = standardTextEntryExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain(
				'expectedLength (10000) is very large - consider using extendedTextInteraction'
			);
		});
	});
});
