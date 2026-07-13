import { describe, expect, test } from 'bun:test';
import { standardPositionObjectExtractor } from '../../../src/interactions/position-object/extractor.js';
import type { QTIElement } from '../../../src/interactions/index.js';
import { createTestContext, parseQTI } from '../test-utils.js';

function extract(xml: string, responseId = 'RESPONSE') {
	const stage = parseQTI(xml);
	const interaction = stage.childNodes.find((node) =>
		(node as QTIElement).rawTagName?.toLowerCase().includes('positionobjectinteraction'),
	) as QTIElement;
	return standardPositionObjectExtractor.extract(
		interaction,
		createTestContext(interaction, responseId, stage),
	);
}

describe('standardPositionObjectExtractor', () => {
	test('extracts the background from the parent stage and draggable from the interaction', () => {
		const result = extract(`
			<positionObjectStage id="MAP">
				<object data="map.png" type="image/png" width="600" height="400">Map</object>
				<positionObjectInteraction responseIdentifier="CITY" minChoices="1" maxChoices="3">
					<object data="city.png" type="image/png" width="30" height="30">City marker</object>
				</positionObjectInteraction>
			</positionObjectStage>
		`, 'CITY');

		expect(result.imageData).toEqual({
			type: 'image',
			src: 'map.png',
			width: '600',
			height: '400',
		});
		expect(result.positionObjectStages).toEqual([
			{
				identifier: 'CITY',
				label: 'City marker',
				matchMax: 3,
				objectData: {
					type: 'image',
					src: 'city.png',
					width: '30',
					height: '30',
				},
			},
		]);
		expect(result.minChoices).toBe(1);
		expect(result.maxChoices).toBe(3);
	});

	test('uses the QTI maxChoices default of one', () => {
		const result = extract(`
			<positionObjectStage>
				<object data="map.png" type="image/png"/>
				<positionObjectInteraction responseIdentifier="RESPONSE">
					<object data="marker.png" type="image/png"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`);

		expect(result.maxChoices).toBe(1);
		expect(result.positionObjectStages[0].matchMax).toBe(1);
	});

	test('preserves inline SVG for both stage and draggable object', () => {
		const result = extract(`
			<positionObjectStage>
				<object type="image/svg+xml" width="500" height="300"><svg><rect width="500" height="300"/></svg></object>
				<positionObjectInteraction responseIdentifier="RESPONSE">
					<object type="image/svg+xml" width="20" height="20"><svg><circle cx="10" cy="10" r="9"/></svg></object>
				</positionObjectInteraction>
			</positionObjectStage>
		`);

		expect(result.imageData?.type).toBe('svg');
		expect(result.imageData?.content).toContain('<rect');
		expect(result.positionObjectStages[0].objectData?.type).toBe('svg');
		expect(result.positionObjectStages[0].objectData?.content).toContain('<circle');
	});

	test('recognizes QTI 2.x and QTI 3 interaction names', () => {
		const qti2 = parseQTI('<positionObjectInteraction responseIdentifier="R"><object data="a.png"/></positionObjectInteraction>');
		const qti3 = parseQTI('<qti-position-object-interaction response-identifier="R"><object data="a.png"/></qti-position-object-interaction>');

		expect(standardPositionObjectExtractor.canHandle(qti2, createTestContext(qti2))).toBe(true);
		expect(standardPositionObjectExtractor.canHandle(qti3, createTestContext(qti3))).toBe(true);
	});

	test('rejects an interaction without its required stage and draggable object', () => {
		const data = extract(`
			<div>
				<positionObjectInteraction responseIdentifier="RESPONSE"/>
			</div>
		`);
		const validation = standardPositionObjectExtractor.validate!(data);

		expect(validation.valid).toBe(false);
		expect(validation.errors).toContain(
			'positionObjectInteraction must have a parent positionObjectStage with a background object',
		);
		expect(validation.errors).toContain('positionObjectInteraction must contain one draggable object');
	});

	test('does not treat an arbitrary parent with an object as a positionObjectStage', () => {
		const data = extract(`
			<div>
				<object data="not-a-stage.png"/>
				<positionObjectInteraction responseIdentifier="RESPONSE">
					<object data="marker.png"/>
				</positionObjectInteraction>
			</div>
		`);
		const validation = standardPositionObjectExtractor.validate!(data);

		expect(validation.valid).toBe(false);
		expect(validation.errors).toContain(
			'positionObjectInteraction must have a parent positionObjectStage with a background object',
		);
	});

	test('rejects minChoices greater than maxChoices', () => {
		const data = extract(`
			<positionObjectStage>
				<object data="map.png"/>
				<positionObjectInteraction responseIdentifier="RESPONSE" minChoices="2" maxChoices="1">
					<object data="marker.png"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`);
		const validation = standardPositionObjectExtractor.validate!(data);

		expect(validation.valid).toBe(false);
		expect(validation.errors).toContain('minChoices cannot exceed maxChoices');
	});
});
