/**
 * Tests for standardCustomExtractor (fallback-only)
 */

import { describe, expect, test } from 'bun:test';
import { standardCustomExtractor } from '../../../src/extraction/extractors/customExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardCustomExtractor', () => {
	test('captures prompt, attributes, and xml', () => {
		const xml = `
			<customInteraction responseIdentifier="CUST" class="vendor" data-x="1">
				<prompt>Do the custom thing</prompt>
				<div>Some vendor payload</div>
			</customInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'CUST');

		const result = standardCustomExtractor.extract(element, context);

		expect(result.prompt).toBe('Do the custom thing');
		expect(result.rawAttributes.class).toBe('vendor');
		expect(result.rawAttributes['data-x']).toBe('1');
		expect(result.xml).toContain('<customInteraction');
	});

	test('handles missing prompt', () => {
		const xml = `<customInteraction responseIdentifier="CUST"></customInteraction>`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'CUST');

		const result = standardCustomExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
	});

	describe('canHandle predicate', () => {
		test('handles customInteraction element', () => {
			const xml = `<customInteraction responseIdentifier="CUST" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardCustomExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-customInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardCustomExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct custom data', () => {
			const data = {
				xml: '<customInteraction></customInteraction>',
				rawAttributes: { responseIdentifier: 'CUST', class: 'vendor' },
				prompt: null,
			};

			const validation = standardCustomExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports warning for missing xml', () => {
			const data = {
				xml: '',
				rawAttributes: { responseIdentifier: 'CUST' },
				prompt: null,
			};

			const validation = standardCustomExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('customInteraction has no XML content');
		});
	});
});
