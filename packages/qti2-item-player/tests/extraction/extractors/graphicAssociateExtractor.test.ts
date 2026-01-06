/**
 * Tests for standardGraphicAssociateExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardGraphicAssociateExtractor } from '../../../src/extraction/extractors/graphicAssociateExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardGraphicAssociateExtractor', () => {
	test('extracts graphicAssociateInteraction with image', () => {
		const xml = `
			<graphicAssociateInteraction responseIdentifier="RESPONSE" maxAssociations="3">
				<prompt>Connect related items</prompt>
				<object data="diagram.png" type="image/png" width="500" height="400"/>
				<associableHotspot identifier="A" shape="rect" coords="50,50,150,100" matchMax="2">Area A</associableHotspot>
				<associableHotspot identifier="B" shape="rect" coords="200,50,300,100" matchMax="2">Area B</associableHotspot>
				<associableHotspot identifier="C" shape="circle" coords="250,250,40" matchMax="1">Area C</associableHotspot>
			</graphicAssociateInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicAssociateExtractor.extract(element, context);

		expect(result.prompt).toBe('Connect related items');
		expect(result.maxAssociations).toBe(3);
		expect(result.minAssociations).toBe(0);
		expect(result.imageData?.type).toBe('image');
		expect(result.imageData?.src).toBe('diagram.png');
		expect(result.imageData?.width).toBe('500');
		expect(result.imageData?.height).toBe('400');
		expect(result.associableHotspots).toHaveLength(3);
		expect(result.associableHotspots[0].identifier).toBe('A');
		expect(result.associableHotspots[0].label).toBe('Area A');
		expect(result.associableHotspots[0].shape).toBe('rect');
		expect(result.associableHotspots[0].coords).toBe('50,50,150,100');
		expect(result.associableHotspots[0].matchMax).toBe(2);
		expect(result.associableHotspots[2].shape).toBe('circle');
	});

	test('extracts graphicAssociateInteraction with SVG', () => {
		const xml = `
			<graphicAssociateInteraction responseIdentifier="RESPONSE">
				<prompt>Match the connections</prompt>
				<object type="image/svg+xml" width="600" height="400">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
						<rect width="600" height="400" fill="#f0f0f0"/>
						<circle cx="100" cy="100" r="40" fill="blue"/>
						<circle cx="500" cy="100" r="40" fill="red"/>
					</svg>
				</object>
				<associableHotspot identifier="BLUE" shape="circle" coords="100,100,40">Blue Circle</associableHotspot>
				<associableHotspot identifier="RED" shape="circle" coords="500,100,40">Red Circle</associableHotspot>
			</graphicAssociateInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicAssociateExtractor.extract(element, context);

		expect(result.imageData?.type).toBe('svg');
		expect(result.imageData?.content).toContain('<svg');
		expect(result.imageData?.content).toContain('blue');
		expect(result.imageData?.width).toBe('600');
		expect(result.imageData?.height).toBe('400');
		expect(result.associableHotspots).toHaveLength(2);
	});

	test('handles minAssociations attribute', () => {
		const xml = `
			<graphicAssociateInteraction responseIdentifier="RESPONSE" minAssociations="2" maxAssociations="5">
				<object data="test.png" type="image/png"/>
				<associableHotspot identifier="A" shape="rect" coords="0,0,50,50">A</associableHotspot>
				<associableHotspot identifier="B" shape="rect" coords="100,0,150,50">B</associableHotspot>
			</graphicAssociateInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicAssociateExtractor.extract(element, context);

		expect(result.minAssociations).toBe(2);
		expect(result.maxAssociations).toBe(5);
	});

	test('uses default values when attributes are missing', () => {
		const xml = `
			<graphicAssociateInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<associableHotspot identifier="A">Area A</associableHotspot>
			</graphicAssociateInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicAssociateExtractor.extract(element, context);

		expect(result.maxAssociations).toBe(1);
		expect(result.minAssociations).toBe(0);
		expect(result.imageData?.width).toBe('500');
		expect(result.imageData?.height).toBe('300');
		expect(result.associableHotspots[0].shape).toBe('rect');
		expect(result.associableHotspots[0].coords).toBe('0,0,50,50');
		expect(result.associableHotspots[0].matchMax).toBe(1);
	});

	test('uses identifier as label if text content is empty', () => {
		const xml = `
			<graphicAssociateInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<associableHotspot identifier="HOTSPOT_ONE" shape="rect" coords="0,0,50,50"/>
			</graphicAssociateInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicAssociateExtractor.extract(element, context);

		expect(result.associableHotspots[0].label).toBe('HOTSPOT_ONE');
	});

	test('handles multiple associableHotspots with different matchMax values', () => {
		const xml = `
			<graphicAssociateInteraction responseIdentifier="RESPONSE" maxAssociations="10">
				<object data="network.png" type="image/png"/>
				<associableHotspot identifier="HUB" shape="rect" coords="200,100,300,150" matchMax="4">Hub</associableHotspot>
				<associableHotspot identifier="PC1" shape="rect" coords="50,50,100,100" matchMax="1">PC 1</associableHotspot>
				<associableHotspot identifier="PC2" shape="rect" coords="350,50,400,100" matchMax="1">PC 2</associableHotspot>
				<associableHotspot identifier="PC3" shape="rect" coords="50,200,100,250" matchMax="1">PC 3</associableHotspot>
			</graphicAssociateInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicAssociateExtractor.extract(element, context);

		expect(result.associableHotspots).toHaveLength(4);
		expect(result.associableHotspots[0].matchMax).toBe(4); // Hub can connect to 4 devices
		expect(result.associableHotspots[1].matchMax).toBe(1); // PC can connect to 1
		expect(result.associableHotspots[2].matchMax).toBe(1);
		expect(result.associableHotspots[3].matchMax).toBe(1);
	});

	test('handles missing prompt', () => {
		const xml = `
			<graphicAssociateInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<associableHotspot identifier="A">Area A</associableHotspot>
			</graphicAssociateInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicAssociateExtractor.extract(element, context);

		expect(result.prompt).toBeNull();
	});

	describe('canHandle predicate', () => {
		test('handles graphicAssociateInteraction element', () => {
			const xml = `
				<graphicAssociateInteraction responseIdentifier="RESPONSE">
					<associableHotspot identifier="A">A</associableHotspot>
				</graphicAssociateInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardGraphicAssociateExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-graphicAssociateInteraction elements', () => {
			const xml = `<associateInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardGraphicAssociateExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct graphicAssociate data', () => {
			const data = {
				associableHotspots: [
					{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
					{ identifier: 'B', label: 'B', shape: 'rect', coords: '100,0,200,100', matchMax: 1 },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxAssociations: 1,
				minAssociations: 0,
				prompt: null,
			};

			const validation = standardGraphicAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for insufficient hotspots', () => {
			const data = {
				associableHotspots: [
					{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxAssociations: 1,
				minAssociations: 0,
				prompt: null,
			};

			const validation = standardGraphicAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('graphicAssociateInteraction must have at least 2 hotspots');
		});

		test('reports error for duplicate identifiers', () => {
			const data = {
				associableHotspots: [
					{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
					{ identifier: 'A', label: 'B', shape: 'rect', coords: '100,0,200,100', matchMax: 1 },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxAssociations: 1,
				minAssociations: 0,
				prompt: null,
			};

			const validation = standardGraphicAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate hotspot identifier: A');
		});

		test('reports warning for missing image data', () => {
			const data = {
				associableHotspots: [
					{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
					{ identifier: 'B', label: 'B', shape: 'rect', coords: '100,0,200,100', matchMax: 1 },
				],
				imageData: null,
				maxAssociations: 1,
				minAssociations: 0,
				prompt: null,
			};

			const validation = standardGraphicAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('graphicAssociateInteraction has no image data');
		});
	});
});
