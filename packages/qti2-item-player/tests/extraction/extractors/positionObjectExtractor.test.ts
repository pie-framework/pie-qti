/**
 * Tests for standardPositionObjectExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardPositionObjectExtractor } from '../../../src/extraction/extractors/positionObjectExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardPositionObjectExtractor', () => {
	test('extracts positionObjectInteraction with image background', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE" maxChoices="3">
				<prompt>Position the objects on the map</prompt>
				<object data="map.png" type="image/png" width="600" height="400"/>
				<positionObjectStage identifier="CITY1" matchMax="1">
					<object data="city-icon.png" type="image/png" width="30" height="30"/>
					City 1
				</positionObjectStage>
				<positionObjectStage identifier="CITY2" matchMax="1">
					<object data="city-icon.png" type="image/png" width="30" height="30"/>
					City 2
				</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.prompt).toBe('Position the objects on the map');
		expect(result.maxChoices).toBe(3);
		expect(result.minChoices).toBe(0);
		expect(result.centerPoint).toBe(true);
		expect(result.imageData?.type).toBe('image');
		expect(result.imageData?.src).toBe('map.png');
		expect(result.imageData?.width).toBe('600');
		expect(result.imageData?.height).toBe('400');
		expect(result.positionObjectStages).toHaveLength(2);
		expect(result.positionObjectStages[0].identifier).toBe('CITY1');
		expect(result.positionObjectStages[0].label).toContain('City 1');
		expect(result.positionObjectStages[0].matchMax).toBe(1);
		expect(result.positionObjectStages[0].objectData?.type).toBe('image');
		expect(result.positionObjectStages[0].objectData?.src).toBe('city-icon.png');
	});

	test('extracts positionObjectInteraction with SVG background', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE">
				<prompt>Place the elements</prompt>
				<object type="image/svg+xml" width="500" height="300">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
						<rect width="500" height="300" fill="#eee"/>
					</svg>
				</object>
				<positionObjectStage identifier="ELEM1">
					<object data="elem.png" type="image/png"/>
					Element
				</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.imageData?.type).toBe('svg');
		expect(result.imageData?.content).toContain('<svg');
		expect(result.imageData?.width).toBe('500');
		expect(result.imageData?.height).toBe('300');
		expect(result.positionObjectStages).toHaveLength(1);
	});

	test('extracts positionObjectInteraction with SVG objects', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE">
				<object data="background.png" type="image/png"/>
				<positionObjectStage identifier="SHAPE1" matchMax="3">
					<object type="image/svg+xml" width="40" height="40">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
							<circle cx="20" cy="20" r="18" fill="blue"/>
						</svg>
					</object>
					Blue Circle
				</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.positionObjectStages[0].objectData?.type).toBe('svg');
		expect(result.positionObjectStages[0].objectData?.content).toContain('<circle');
		expect(result.positionObjectStages[0].objectData?.width).toBe('40');
		expect(result.positionObjectStages[0].objectData?.height).toBe('40');
		expect(result.positionObjectStages[0].matchMax).toBe(3);
	});

	test('handles minChoices and maxChoices attributes', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE" minChoices="2" maxChoices="5">
				<object data="test.png" type="image/png"/>
				<positionObjectStage identifier="OBJ1">Object 1</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.minChoices).toBe(2);
		expect(result.maxChoices).toBe(5);
	});

	test('handles centerPoint attribute', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE" centerPoint="false">
				<object data="test.png" type="image/png"/>
				<positionObjectStage identifier="OBJ1">Object 1</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.centerPoint).toBe(false);
	});

	test('uses default values when attributes are missing', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<positionObjectStage identifier="OBJ1">
					<object data="obj.png" type="image/png"/>
					Object
				</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.maxChoices).toBe(0);
		expect(result.minChoices).toBe(0);
		expect(result.centerPoint).toBe(true);
		expect(result.imageData?.width).toBe('500');
		expect(result.imageData?.height).toBe('300');
		expect(result.positionObjectStages[0].matchMax).toBe(1);
		expect(result.positionObjectStages[0].objectData?.width).toBe('50');
		expect(result.positionObjectStages[0].objectData?.height).toBe('50');
	});

	test('uses identifier as label if text content is empty', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<positionObjectStage identifier="OBJECT_ONE">
					<object data="obj.png" type="image/png"/>
				</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.positionObjectStages[0].label).toBe('OBJECT_ONE');
	});

	test('handles missing prompt', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE">
				<object data="test.png" type="image/png"/>
				<positionObjectStage identifier="OBJ1">Object</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.prompt).toBeNull();
	});

	test('handles multiple objects with different matchMax values', () => {
		const xml = `
			<positionObjectInteraction responseIdentifier="RESPONSE" maxChoices="10">
				<object data="canvas.png" type="image/png"/>
				<positionObjectStage identifier="SINGLE_USE" matchMax="1">
					<object data="obj1.png" type="image/png"/>
					Single Use
				</positionObjectStage>
				<positionObjectStage identifier="MULTI_USE" matchMax="5">
					<object data="obj2.png" type="image/png"/>
					Multi Use
				</positionObjectStage>
			</positionObjectInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardPositionObjectExtractor.extract(element, context);

		expect(result.positionObjectStages).toHaveLength(2);
		expect(result.positionObjectStages[0].matchMax).toBe(1);
		expect(result.positionObjectStages[1].matchMax).toBe(5);
	});

	describe('canHandle predicate', () => {
		test('handles positionObjectInteraction element', () => {
			const xml = `
				<positionObjectInteraction responseIdentifier="RESPONSE">
					<positionObjectStage identifier="OBJ1">Object</positionObjectStage>
				</positionObjectInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardPositionObjectExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-positionObjectInteraction elements', () => {
			const xml = `<selectPointInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardPositionObjectExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct positionObject data', () => {
			const data = {
				positionObjectStages: [
					{
						identifier: 'OBJ1',
						label: 'Object 1',
						matchMax: 1,
						objectData: { type: 'image', src: 'obj.png', width: '50', height: '50' },
					},
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxChoices: 0,
				minChoices: 0,
				centerPoint: true,
				prompt: null,
			};

			const validation = standardPositionObjectExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty positionObjectStages', () => {
			const data = {
				positionObjectStages: [],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxChoices: 0,
				minChoices: 0,
				centerPoint: true,
				prompt: null,
			};

			const validation = standardPositionObjectExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain(
				'positionObjectInteraction must have at least one positionObjectStage'
			);
		});

		test('reports error for duplicate identifiers', () => {
			const data = {
				positionObjectStages: [
					{
						identifier: 'OBJ1',
						label: 'Object 1',
						matchMax: 1,
						objectData: { type: 'image', src: 'obj.png', width: '50', height: '50' },
					},
					{
						identifier: 'OBJ1',
						label: 'Object 2',
						matchMax: 1,
						objectData: { type: 'image', src: 'obj.png', width: '50', height: '50' },
					},
				],
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				maxChoices: 0,
				minChoices: 0,
				centerPoint: true,
				prompt: null,
			};

			const validation = standardPositionObjectExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate positionObjectStage identifier: OBJ1');
		});

		test('reports warning for missing background image', () => {
			const data = {
				positionObjectStages: [
					{
						identifier: 'OBJ1',
						label: 'Object 1',
						matchMax: 1,
						objectData: { type: 'image', src: 'obj.png', width: '50', height: '50' },
					},
				],
				imageData: null,
				maxChoices: 0,
				minChoices: 0,
				centerPoint: true,
				prompt: null,
			};

			const validation = standardPositionObjectExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('positionObjectInteraction has no background image');
		});
	});
});
