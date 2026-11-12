/**
 * Tests for standardGraphicOrderExtractor
 */

import { describe, expect, test } from 'bun:test';
import { type GraphicOrderData, standardGraphicOrderExtractor } from '../../../src/interactions/graphic-order/extractor.js';
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

	test('keeps hotspot defaults but invents no image dimensions when attributes are missing', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<hotspotChoice identifier="A">Choice A</hotspotChoice>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicOrderExtractor.extract(element, context);

		// The stage's pixel space stays the image's own: a default would place the
		// areas in a guessed space. The renderer stages the raster at its natural size.
		expect(result.imageData?.width).toBeUndefined();
		expect(result.imageData?.height).toBeUndefined();
		expect(result.hotspotChoices[0].shape).toBe('rect');
		expect(result.hotspotChoices[0].coords).toBe('0,0,50,50');
	});

	test('never uses the identifier as label when the hotspot has no text', () => {
		// Identifiers can reveal the answer key to assistive technology; the
		// renderer names an unlabelled hotspot by position instead.
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<hotspotChoice identifier="ITEM_A" shape="rect" coords="0,0,50,50"/>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicOrderExtractor.extract(element, context);

		expect(result.hotspotChoices[0].label).toBe('');
	});

	test('uses the authored hotspotLabel as label', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<hotspotChoice identifier="ITEM_A" shape="rect" coords="0,0,50,50" hotspotLabel="Mercury"/>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const result = standardGraphicOrderExtractor.extract(element, createTestContext(element, 'RESPONSE'));

		expect(result.hotspotChoices[0].label).toBe('Mercury');
	});

	test('keeps the image text alternative from the object fallback text', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="planets.png" type="image/png" width="400" height="200">The four inner planets</object>
				<hotspotChoice identifier="A" shape="rect" coords="0,0,50,50"/>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const result = standardGraphicOrderExtractor.extract(element, createTestContext(element, 'RESPONSE'));

		expect(result.imageData?.alt).toBe('The four inner planets');
		expect(result.imageData?.decorative).toBeUndefined();
	});

	test('reads an external SVG object as an image and keeps its fallback text as alt', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE">
				<object data="planets.svg" type="image/svg+xml" width="400" height="200">Planet diagram</object>
				<hotspotChoice identifier="A" shape="rect" coords="0,0,50,50"/>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const result = standardGraphicOrderExtractor.extract(element, createTestContext(element, 'RESPONSE'));

		expect(result.imageData?.type).toBe('image');
		expect(result.imageData?.src).toBe('planets.svg');
		expect(result.imageData?.alt).toBe('Planet diagram');
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

	test('reads maxChoices alongside minChoices, which request ordering a subset', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE" minChoices="1" maxChoices="2">
				<object data="test.png" type="image/png"/>
				<hotspotChoice identifier="A" shape="circle" coords="10,10,5" hotspotLabel="Harbour"/>
				<hotspotChoice identifier="B" shape="circle" coords="30,10,5" hotspotLabel="Station"/>
				<hotspotChoice identifier="C" shape="circle" coords="50,10,5" hotspotLabel="Museum"/>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const result = standardGraphicOrderExtractor.extract(element, createTestContext(element, 'RESPONSE'));

		expect(result.minChoices).toBe(1);
		expect(result.maxChoices).toBe(2);
	});

	test('omits maxChoices when unspecified or 0, as it does minChoices', () => {
		const xml = `
			<graphicOrderInteraction responseIdentifier="RESPONSE" maxChoices="0">
				<object data="test.png" type="image/png"/>
				<hotspotChoice identifier="A" shape="circle" coords="10,10,5"/>
				<hotspotChoice identifier="B" shape="circle" coords="30,10,5"/>
			</graphicOrderInteraction>
		`;

		const element = parseQTI(xml);
		const result = standardGraphicOrderExtractor.extract(element, createTestContext(element, 'RESPONSE'));

		expect(result).not.toHaveProperty('minChoices');
		expect(result).not.toHaveProperty('maxChoices');
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
			const data: GraphicOrderData = {
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
			const data: GraphicOrderData = {
				hotspotChoices: [{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100' }],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicOrderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('graphicOrderInteraction must have at least 2 hotspots');
		});

		test('reports error for duplicate identifiers', () => {
			const data: GraphicOrderData = {
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
			const data: GraphicOrderData = {
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
