/**
 * Tests for standardDrawingExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardDrawingExtractor } from '../../../src/extraction/extractors/drawingExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardDrawingExtractor', () => {
	test('extracts drawing interaction with SVG background', () => {
		const xml = `
			<drawingInteraction responseIdentifier="DRAW">
				<prompt>Annotate the image</prompt>
				<object type="image/svg+xml" width="300" height="200">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
						<rect x="10" y="10" width="280" height="180" fill="white" stroke="black"/>
					</svg>
				</object>
			</drawingInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'DRAW');

		const result = standardDrawingExtractor.extract(element, context);

		expect(result.prompt).toBe('Annotate the image');
		expect(result.imageData?.type).toBe('svg');
		expect(result.imageData?.width).toBe('300');
		expect(result.imageData?.height).toBe('200');
		expect(result.rawAttributes.responseIdentifier).toBe('DRAW');
	});

	test('handles drawing interaction without object', () => {
		const xml = `
			<drawingInteraction responseIdentifier="DRAW">
				<prompt>Draw something</prompt>
			</drawingInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'DRAW');

		const result = standardDrawingExtractor.extract(element, context);

		expect(result.imageData).toBeNull();
	});

	describe('canHandle predicate', () => {
		test('handles drawingInteraction element', () => {
			const xml = `<drawingInteraction responseIdentifier="DRAW" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardDrawingExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-drawingInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardDrawingExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct drawing data', () => {
			const data = {
				imageData: { type: 'svg', content: '<svg></svg>', width: '300', height: '200' },
				rawAttributes: { responseIdentifier: 'DRAW' },
				prompt: null,
			};

			const validation = standardDrawingExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports warning for missing image data', () => {
			const data = {
				imageData: null,
				rawAttributes: { responseIdentifier: 'DRAW' },
				prompt: null,
			};

			const validation = standardDrawingExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain(
				'drawingInteraction has no background image - students will draw on a blank canvas'
			);
		});
	});
});
