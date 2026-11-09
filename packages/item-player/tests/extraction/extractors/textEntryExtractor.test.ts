/**
 * Tests for standardTextEntryExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardTextEntryExtractor } from '../../../src/interactions/text-entry/extractor.js';
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

	test('extracts format attribute', () => {
		const xml = `<textEntryInteraction responseIdentifier="RESPONSE" format="plain" />`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardTextEntryExtractor.extract(element, context);

		expect(result.format).toBe('plain');
	});

	test('omits format when absent', () => {
		const xml = `<textEntryInteraction responseIdentifier="RESPONSE" />`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardTextEntryExtractor.extract(element, context);

		expect(result.format).toBeUndefined();
	});

	test('extracts a non-decimal number base (QTI stringInteraction base)', () => {
		const extractBase = (attributes: string) => {
			const element = parseQTI(`<textEntryInteraction responseIdentifier="RESPONSE" ${attributes}/>`);
			return standardTextEntryExtractor.extract(element, createTestContext(element, 'RESPONSE')).base;
		};

		expect(extractBase('base="2"')).toBe(2);
		expect(extractBase('base="16"')).toBe(16);
		// The default base, and a value QTI does not allow, are not carried.
		expect(extractBase('')).toBeUndefined();
		expect(extractBase('base="10"')).toBeUndefined();
		expect(extractBase('base="1"')).toBeUndefined();
		expect(extractBase('base="hex"')).toBeUndefined();
	});

	test('extracts stringIdentifier (QTI stringInteraction companion response)', () => {
		const extractStringIdentifier = (attributes: string) => {
			const element = parseQTI(`<textEntryInteraction responseIdentifier="NUM" ${attributes}/>`);
			return standardTextEntryExtractor.extract(element, createTestContext(element, 'NUM')).stringIdentifier;
		};

		expect(extractStringIdentifier('stringIdentifier="STR"')).toBe('STR');
		// Absent or blank, nothing is carried.
		expect(extractStringIdentifier('')).toBeUndefined();
		expect(extractStringIdentifier('stringIdentifier=""')).toBeUndefined();
		expect(extractStringIdentifier('stringIdentifier="  "')).toBeUndefined();
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
