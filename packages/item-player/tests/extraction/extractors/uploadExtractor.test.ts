/**
 * Tests for standardUploadExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardUploadExtractor } from '../../../src/extraction/extractors/uploadExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardUploadExtractor', () => {
	test('extracts upload interaction with file types', () => {
		const xml = `
			<uploadInteraction responseIdentifier="RESPONSE">
				<prompt>Upload your work</prompt>
				<fileType>image/png</fileType>
				<fileType>.pdf</fileType>
			</uploadInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardUploadExtractor.extract(element, context);

		expect(result.prompt).toBe('Upload your work');
		expect(result.fileTypes).toEqual(['image/png', '.pdf']);
		expect(result.rawAttributes).toEqual({ responseIdentifier: 'RESPONSE' });
	});

	test('handles upload interaction without file types', () => {
		const xml = `
			<uploadInteraction responseIdentifier="RESPONSE">
				<prompt>Upload any file</prompt>
			</uploadInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardUploadExtractor.extract(element, context);

		expect(result.fileTypes).toEqual([]);
	});

	test('preserves raw attributes', () => {
		const xml = `
			<uploadInteraction responseIdentifier="RESPONSE" class="vendor-upload" data-max-size="1024">
				<prompt>Upload</prompt>
				<fileType>text/plain</fileType>
			</uploadInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardUploadExtractor.extract(element, context);

		expect(result.rawAttributes.class).toBe('vendor-upload');
		expect(result.rawAttributes['data-max-size']).toBe('1024');
	});

	describe('canHandle predicate', () => {
		test('handles uploadInteraction element', () => {
			const xml = `<uploadInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardUploadExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-uploadInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardUploadExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct upload data', () => {
			const data = {
				fileTypes: ['image/png', '.pdf'],
				rawAttributes: { responseIdentifier: 'RESPONSE' },
				prompt: null,
			};

			const validation = standardUploadExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports warning for no fileTypes specified', () => {
			const data = {
				fileTypes: [],
				rawAttributes: { responseIdentifier: 'RESPONSE' },
				prompt: null,
			};

			const validation = standardUploadExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain(
				'uploadInteraction has no fileTypes - any file type will be accepted'
			);
		});

		test('validates successfully with fileTypes', () => {
			const data = {
				fileTypes: ['application/pdf', 'image/jpeg', 'image/png'],
				rawAttributes: { responseIdentifier: 'RESPONSE' },
				prompt: 'Upload images or PDFs',
			};

			const validation = standardUploadExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
			expect(validation.warnings).toBeUndefined();
		});
	});
});
