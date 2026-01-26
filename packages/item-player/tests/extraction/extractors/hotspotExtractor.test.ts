/**
 * Tests for standardHotspotExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardHotspotExtractor } from '../../../src/extraction/extractors/hotspotExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardHotspotExtractor', () => {
	test('extracts basic hotspot interaction with image', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<prompt>Click on the correct area</prompt>
				<object type="image/png" data="image.png" width="400" height="300" />
				<hotspotChoice identifier="H1" shape="rect" coords="10,10,100,100" />
				<hotspotChoice identifier="H2" shape="circle" coords="200,150,50" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.maxChoices).toBe(1);
		expect(result.prompt).toBe('Click on the correct area');
		expect(result.hotspotChoices).toHaveLength(2);
	});

	test('extracts image data correctly', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<object type="image/png" data="test.png" width="500" height="400" />
				<hotspotChoice identifier="H1" shape="rect" coords="0,0,100,100" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.imageData).not.toBe(null);
		expect(result.imageData?.type).toBe('image');
		expect(result.imageData?.src).toBe('test.png');
		expect(result.imageData?.width).toBe('500');
		expect(result.imageData?.height).toBe('400');
	});

	test('extracts SVG data correctly', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<object type="image/svg+xml" width="300" height="200">
					<svg xmlns="http://www.w3.org/2000/svg">
						<circle cx="50" cy="50" r="40" />
					</svg>
				</object>
				<hotspotChoice identifier="H1" shape="circle" coords="50,50,40" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.imageData).not.toBe(null);
		expect(result.imageData?.type).toBe('svg');
		expect(result.imageData?.content).toContain('circle');
		expect(result.imageData?.width).toBe('300');
		expect(result.imageData?.height).toBe('200');
	});

	test('extracts hotspot choices with different shapes', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="3">
				<object type="image/png" data="map.png" />
				<hotspotChoice identifier="RECT" shape="rect" coords="10,10,100,100" />
				<hotspotChoice identifier="CIRCLE" shape="circle" coords="200,200,50" />
				<hotspotChoice identifier="POLY" shape="poly" coords="300,100,350,150,300,200" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.hotspotChoices).toHaveLength(3);
		expect(result.hotspotChoices[0]).toEqual({
			identifier: 'RECT',
			shape: 'rect',
			coords: '10,10,100,100',
		});
		expect(result.hotspotChoices[1]).toEqual({
			identifier: 'CIRCLE',
			shape: 'circle',
			coords: '200,200,50',
		});
		expect(result.hotspotChoices[2]).toEqual({
			identifier: 'POLY',
			shape: 'poly',
			coords: '300,100,350,150,300,200',
		});
	});

	test('uses default shape when not specified', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<object type="image/png" data="image.png" />
				<hotspotChoice identifier="H1" coords="10,10,100,100" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.hotspotChoices[0].shape).toBe('rect');
	});

	test('handles multiple choice selection (maxChoices > 1)', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="3">
				<object type="image/png" data="image.png" />
				<hotspotChoice identifier="H1" shape="rect" coords="0,0,50,50" />
				<hotspotChoice identifier="H2" shape="rect" coords="60,0,110,50" />
				<hotspotChoice identifier="H3" shape="rect" coords="120,0,170,50" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.maxChoices).toBe(3);
		expect(result.hotspotChoices).toHaveLength(3);
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<object type="image/png" data="image.png" />
				<hotspotChoice identifier="H1" shape="rect" coords="0,0,100,100" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
	});

	test('handles interaction without object element', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<hotspotChoice identifier="H1" shape="rect" coords="0,0,100,100" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.imageData).toBe(null);
	});

	test('uses default maxChoices when not specified', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE">
				<object type="image/png" data="image.png" />
				<hotspotChoice identifier="H1" shape="rect" coords="0,0,100,100" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.maxChoices).toBe(1);
	});

	test('handles image with default dimensions', () => {
		const xml = `
			<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<object type="image/png" data="image.png" />
				<hotspotChoice identifier="H1" shape="rect" coords="0,0,100,100" />
			</hotspotInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardHotspotExtractor.extract(element, context);

		expect(result.imageData?.width).toBe('auto');
		expect(result.imageData?.height).toBe('auto');
	});

	describe('canHandle predicate', () => {
		test('handles hotspotInteraction element', () => {
			const xml = `
				<hotspotInteraction responseIdentifier="RESPONSE">
					<hotspotChoice identifier="H1" />
				</hotspotInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardHotspotExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-hotspotInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardHotspotExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct hotspot data', () => {
			const data = {
				hotspotChoices: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100' },
					{ identifier: 'H2', shape: 'circle', coords: '200,200,50' },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardHotspotExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty hotspotChoices', () => {
			const data = {
				hotspotChoices: [],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardHotspotExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('hotspotInteraction must have at least one hotspot');
		});

		test('reports warning for missing image data', () => {
			const data = {
				hotspotChoices: [{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100' }],
				imageData: null,
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardHotspotExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('hotspotInteraction has no image data');
		});

		test('reports error for duplicate hotspot identifiers', () => {
			const data = {
				hotspotChoices: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100' },
					{ identifier: 'H1', shape: 'circle', coords: '200,200,50' },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardHotspotExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate hotspot identifier: H1');
		});

		test('reports warning when maxChoices exceeds hotspot count', () => {
			const data = {
				hotspotChoices: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100' },
					{ identifier: 'H2', shape: 'circle', coords: '200,200,50' },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxChoices: 5,
				prompt: null,
			};

			const validation = standardHotspotExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('maxChoices (5) exceeds the number of hotspots (2)');
		});
	});
});
