/**
 * Tests for standardGraphicOrderExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardGraphicOrderExtractor } from '../../../src/extraction/extractors/graphicOrderExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardGraphicOrderExtractor', () => {
	test('extracts graphicOrderInteraction with image', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<prompt>Order the layers from bottom to top</prompt>
				<object data="layers.png" type="image/png" width="400" height="300"/>
				<hotspotChoice identifier="A" shape="rect" coords="50,50,150,100">Layer A</hotspotChoice>
				<hotspotChoice identifier="B" shape="rect" coords="50,150,150,200">Layer B</hotspotChoice>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicOrderExtractor.extract(element, context);

		expect(result.prompt).toBe('Order the layers from bottom to top');
		expect(result.imageData?.type).toBe('image');
		expect(result.imageData?.src).toBe('layers.png');
		expect(result.imageData?.width).toBe('400');
		expect(result.imageData?.height).toBe('300');
		expect(result.hotspotChoices).toHaveLength(2);
		expect(result.hotspotChoices[0].identifier).toBe('A');
		expect(result.hotspotChoices[0].label).toBe('Layer A');
		expect(result.hotspotChoices[0].shape).toBe('rect');
		expect(result.hotspotChoices[0].coords).toBe('50,50,150,100');
	});

	test('extracts graphicOrderInteraction with SVG', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<prompt>Order the elements</prompt>
				<object type="image/svg+xml" width="500" height="400">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400">
						<rect width="500" height="400" fill="#eee"/>
					</svg>
				</object>
				<hotspotChoice identifier="X" shape="circle" coords="100,100,30">Item X</hotspotChoice>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicOrderExtractor.extract(element, context);

		expect(result.imageData?.type).toBe('svg');
		expect(result.imageData?.content).toContain('<svg');
		expect(result.imageData?.width).toBe('500');
		expect(result.imageData?.height).toBe('400');
		expect(result.hotspotChoices).toHaveLength(1);
		expect(result.hotspotChoices[0].identifier).toBe('X');
	});

	test('handles multiple hotspot choices', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="diagram.png" type="image/png" width="600" height="400"/>
				<hotspotChoice identifier="FIRST" shape="rect" coords="0,0,100,100">First</hotspotChoice>
				<hotspotChoice identifier="SECOND" shape="rect" coords="100,0,200,100">Second</hotspotChoice>
				<hotspotChoice identifier="THIRD" shape="rect" coords="200,0,300,100">Third</hotspotChoice>
				<hotspotChoice identifier="FOURTH" shape="rect" coords="300,0,400,100">Fourth</hotspotChoice>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicOrderExtractor.extract(element, context);

		expect(result.hotspotChoices).toHaveLength(4);
		expect(result.hotspotChoices.map((c) => c.identifier)).toEqual([
			'FIRST',
			'SECOND',
			'THIRD',
			'FOURTH',
		]);
	});

	test('uses default values when attributes are missing', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<hotspotChoice identifier="A">Choice A</hotspotChoice>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicOrderExtractor.extract(element, context);

		expect(result.imageData?.width).toBe('500');
		expect(result.imageData?.height).toBe('300');
		expect(result.hotspotChoices[0].shape).toBe('rect');
		expect(result.hotspotChoices[0].coords).toBe('0,0,50,50');
	});

	test('uses identifier as label if text content is empty', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<hotspotChoice identifier="ITEM_A" shape="rect" coords="0,0,50,50"/>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicOrderExtractor.extract(element, context);

		expect(result.hotspotChoices[0].label).toBe('ITEM_A');
	});

	test('handles missing prompt', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<hotspotChoice identifier="A">Choice A</hotspotChoice>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicOrderExtractor.extract(element, context);

		expect(result.prompt).toBeNull();
	});

	describe('canHandle predicate', () => {
		test('handles graphicOrderInteraction element', () => {
			const xml = `
				<graphicOrderInteraction responseIdentifier="RESPONSE">
					<hotspotChoice identifier="A">A</hotspotChoice>
				</graphicOrderInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardGraphicOrderExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-graphicOrderInteraction elements', () => {
			const xml = `<orderInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardGraphicOrderExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct graphicOrder data', () => {
			const data = {
				hotspotChoices: [
					{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100' },
					{ identifier: 'B', label: 'B', shape: 'rect', coords: '100,0,200,100' },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicOrderExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for insufficient hotspots', () => {
			const data = {
				hotspotChoices: [{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100' }],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicOrderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('graphicOrderInteraction must have at least 2 hotspots');
		});

		test('reports error for duplicate identifiers', () => {
			const data = {
				hotspotChoices: [
					{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100' },
					{ identifier: 'A', label: 'B', shape: 'rect', coords: '100,0,200,100' },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicOrderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate hotspot identifier: A');
		});

		test('reports warning for missing image data', () => {
			const data = {
				hotspotChoices: [
					{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100' },
					{ identifier: 'B', label: 'B', shape: 'rect', coords: '100,0,200,100' },
				],
				imageData: null,
				prompt: null,
			};

			const validation = standardGraphicOrderExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('graphicOrderInteraction has no image data');
		});
	});
});
