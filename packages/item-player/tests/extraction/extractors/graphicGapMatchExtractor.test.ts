/**
 * Tests for standardGraphicGapMatchExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardGraphicGapMatchExtractor } from '../../../src/extraction/extractors/graphicGapMatchExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardGraphicGapMatchExtractor', () => {
	test('extracts basic graphic gap match interaction', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<prompt>Drag labels to the correct positions</prompt>
				<object type="image/png" data="diagram.png" width="600" height="400" />
				<gapText identifier="G1" matchMax="1">Label A</gapText>
				<gapText identifier="G2" matchMax="1">Label B</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="100,100,200,150" matchMax="1" />
				<associableHotspot identifier="H2" shape="circle" coords="400,200,50" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.prompt).toBe('Drag labels to the correct positions');
		expect(result.gapTexts).toHaveLength(2);
		expect(result.hotspots).toHaveLength(2);
	});

	test('extracts gapText elements correctly', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<object type="image/png" data="diagram.png" />
				<gapText identifier="T1" matchMax="1">First</gapText>
				<gapText identifier="T2" matchMax="2">Second</gapText>
				<gapText identifier="T3" matchMax="0">Third</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.gapTexts).toHaveLength(3);
		expect(result.gapTexts[0]).toEqual({ identifier: 'T1', text: 'First', matchMax: 1 });
		expect(result.gapTexts[1]).toEqual({ identifier: 'T2', text: 'Second', matchMax: 2 });
		expect(result.gapTexts[2]).toEqual({ identifier: 'T3', text: 'Third', matchMax: 0 });
	});

	test('extracts associableHotspot elements correctly', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<object type="image/png" data="diagram.png" />
				<gapText identifier="T1" matchMax="1">Label</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="10,10,110,60" matchMax="1" />
				<associableHotspot identifier="H2" shape="circle" coords="200,200,40" matchMax="2" />
				<associableHotspot identifier="H3" shape="poly" coords="300,100,350,150,300,200" matchMax="0" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.hotspots).toHaveLength(3);
		expect(result.hotspots[0]).toEqual({
			identifier: 'H1',
			shape: 'rect',
			coords: '10,10,110,60',
			matchMax: 1,
		});
		expect(result.hotspots[1]).toEqual({
			identifier: 'H2',
			shape: 'circle',
			coords: '200,200,40',
			matchMax: 2,
		});
		expect(result.hotspots[2]).toEqual({
			identifier: 'H3',
			shape: 'poly',
			coords: '300,100,350,150,300,200',
			matchMax: 0,
		});
	});

	test('uses default shape for hotspots when not specified', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<object type="image/png" data="diagram.png" />
				<gapText identifier="T1" matchMax="1">Label</gapText>
				<associableHotspot identifier="H1" coords="0,0,100,100" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.hotspots[0].shape).toBe('rect');
	});

	test('uses default matchMax for hotspots when not specified', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<object type="image/png" data="diagram.png" />
				<gapText identifier="T1" matchMax="1">Label</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.hotspots[0].matchMax).toBe(1);
	});

	test('handles SVG image data', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<object type="image/svg+xml" width="500" height="300">
					<svg xmlns="http://www.w3.org/2000/svg">
						<rect x="10" y="10" width="100" height="50" />
					</svg>
				</object>
				<gapText identifier="T1" matchMax="1">Label</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="10,10,110,60" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.imageData).not.toBe(null);
		expect(result.imageData?.type).toBe('svg');
		expect(result.imageData?.content).toContain('rect');
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<object type="image/png" data="diagram.png" />
				<gapText identifier="T1" matchMax="1">Label</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
	});

	test('handles interaction without object element', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<gapText identifier="T1" matchMax="1">Label</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.imageData).toBe(null);
	});

	test('handles gapText with HTML content', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<object type="image/png" data="diagram.png" />
				<gapText identifier="T1" matchMax="1">Label with <strong>bold</strong></gapText>
				<gapText identifier="T2" matchMax="1">Label with <em>italic</em></gapText>
				<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.gapTexts[0].text).toContain('bold');
		expect(result.gapTexts[1].text).toContain('italic');
	});

	test('handles many gapTexts and hotspots', () => {
		const xml = `
			<graphicGapMatchInteraction responseIdentifier="RESPONSE">
				<object type="image/png" data="diagram.png" />
				<gapText identifier="T1" matchMax="1">A</gapText>
				<gapText identifier="T2" matchMax="1">B</gapText>
				<gapText identifier="T3" matchMax="1">C</gapText>
				<gapText identifier="T4" matchMax="1">D</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="0,0,50,50" matchMax="1" />
				<associableHotspot identifier="H2" shape="rect" coords="60,0,110,50" matchMax="1" />
				<associableHotspot identifier="H3" shape="rect" coords="120,0,170,50" matchMax="1" />
				<associableHotspot identifier="H4" shape="rect" coords="180,0,230,50" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGraphicGapMatchExtractor.extract(element, context);

		expect(result.gapTexts).toHaveLength(4);
		expect(result.hotspots).toHaveLength(4);
	});

	describe('canHandle predicate', () => {
		test('handles graphicGapMatchInteraction element', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE">
					<gapText identifier="T1">Text</gapText>
					<associableHotspot identifier="H1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardGraphicGapMatchExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-graphicGapMatchInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardGraphicGapMatchExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct graphicGapMatch data', () => {
			const data = {
				gapTexts: [
					{ identifier: 'T1', text: 'Label 1', matchMax: 1 },
					{ identifier: 'T2', text: 'Label 2', matchMax: 1 },
				],
				hotspots: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
					{ identifier: 'H2', shape: 'circle', coords: '200,200,50', matchMax: 1 },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty gapTexts', () => {
			const data = {
				gapTexts: [],
				hotspots: [{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 }],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('graphicGapMatchInteraction must have at least one gapText');
		});

		test('reports error for empty hotspots', () => {
			const data = {
				gapTexts: [{ identifier: 'T1', text: 'Label', matchMax: 1 }],
				hotspots: [],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('graphicGapMatchInteraction must have at least one hotspot');
		});

		test('reports error for duplicate gapText identifiers', () => {
			const data = {
				gapTexts: [
					{ identifier: 'T1', text: 'Label 1', matchMax: 1 },
					{ identifier: 'T1', text: 'Label 2', matchMax: 1 },
				],
				hotspots: [{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 }],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate gapText identifier: T1');
		});

		test('reports error for duplicate hotspot identifiers', () => {
			const data = {
				gapTexts: [{ identifier: 'T1', text: 'Label', matchMax: 1 }],
				hotspots: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
					{ identifier: 'H1', shape: 'circle', coords: '200,200,50', matchMax: 1 },
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate hotspot identifier: H1');
		});
	});
});
