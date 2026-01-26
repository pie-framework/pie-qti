/**
 * Tests for standardExtendedTextExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardExtendedTextExtractor } from '../../../src/extraction/extractors/extendedTextExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardExtendedTextExtractor', () => {
	test('extracts basic extended text interaction', () => {
		const xml = `
			<extendedTextInteraction
				responseIdentifier="RESPONSE"
				expectedLines="5"
				expectedLength="500"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardExtendedTextExtractor.extract(element, context);

		expect(result.expectedLines).toBe(5);
		expect(result.expectedLength).toBe(500);
	});

	test('uses default values when attributes not specified', () => {
		const xml = `<extendedTextInteraction responseIdentifier="RESPONSE" />`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardExtendedTextExtractor.extract(element, context);

		expect(result.expectedLines).toBe(3);
		expect(result.expectedLength).toBe(200);
		expect(result.format).toBe('plain');
	});

	test('handles placeholderText attribute', () => {
		const xml = `
			<extendedTextInteraction
				responseIdentifier="RESPONSE"
				placeholderText="Type your essay here..."
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardExtendedTextExtractor.extract(element, context);

		expect(result.placeholderText).toBe('Type your essay here...');
	});

	test('handles format attribute', () => {
		const xml = `
			<extendedTextInteraction
				responseIdentifier="RESPONSE"
				format="preFormatted"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardExtendedTextExtractor.extract(element, context);

		expect(result.format).toBe('preFormatted');
	});

	test('handles xhtml format', () => {
		const xml = `
			<extendedTextInteraction
				responseIdentifier="RESPONSE"
				format="xhtml"
				expectedLines="10"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardExtendedTextExtractor.extract(element, context);

		expect(result.format).toBe('xhtml');
		expect(result.expectedLines).toBe(10);
	});

	test('handles large expectedLength values', () => {
		const xml = `
			<extendedTextInteraction
				responseIdentifier="RESPONSE"
				expectedLength="5000"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardExtendedTextExtractor.extract(element, context);

		expect(result.expectedLength).toBe(5000);
	});

	describe('canHandle predicate', () => {
		test('handles extendedTextInteraction element', () => {
			const xml = `<extendedTextInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardExtendedTextExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-extendedTextInteraction elements', () => {
			const xml = `<textEntryInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardExtendedTextExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct extended text data', () => {
			const data = {
				expectedLines: 5,
				expectedLength: 500,
				format: 'plain',
				placeholderText: '',
			};

			const validation = standardExtendedTextExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for invalid expectedLines', () => {
			const data = {
				expectedLines: 0,
				expectedLength: 200,
				format: 'plain',
				placeholderText: '',
			};

			const validation = standardExtendedTextExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('expectedLines must be at least 1');
		});

		test('reports error for invalid expectedLength', () => {
			const data = {
				expectedLines: 3,
				expectedLength: -100,
				format: 'plain',
				placeholderText: '',
			};

			const validation = standardExtendedTextExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('expectedLength must be positive');
		});

		test('reports warning for invalid format value', () => {
			const data = {
				expectedLines: 3,
				expectedLength: 200,
				format: 'markdown',
				placeholderText: '',
			};

			const validation = standardExtendedTextExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain(
				'Unrecognized format "markdown" - expected plain, preFormatted, or xhtml'
			);
		});
	});
});
