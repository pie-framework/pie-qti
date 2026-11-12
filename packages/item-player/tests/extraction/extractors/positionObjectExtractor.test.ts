import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3, Qti3AttributeNameMapper } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../../src/core/AssessmentItemDefinition.js';
import { standardPositionObjectExtractor } from '../../../src/interactions/position-object/extractor.js';
import type { PositionObjectInteractionData, QTIElement } from '../../../src/interactions/shared/types.js';
import { createTestContext, parseQTI } from '../test-utils.js';

const CENTER_POINT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="airport" title="Airport" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="point"/>
  <itemBody>
    <positionObjectStage>
      <object type="image/png" data="map.png" width="600" height="400">Map</object>
      <positionObjectInteraction responseIdentifier="RESPONSE" maxChoices="1" centerPoint="10 5">
        <object type="image/png" data="plane.png" width="40" height="40">Plane</object>
      </positionObjectInteraction>
    </positionObjectStage>
  </itemBody>
</assessmentItem>`;

function extract(xml: string, responseId = 'RESPONSE', config?: Record<string, unknown>) {
	const stage = parseQTI(xml);
	const interaction = stage.childNodes.find((node) =>
		(node as QTIElement).rawTagName?.toLowerCase().replace(/-/g, '').includes('positionobjectinteraction'),
	) as QTIElement;
	return standardPositionObjectExtractor.extract(
		interaction,
		createTestContext(interaction, responseId, stage, new Map(), config as never),
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
			alt: 'Map',
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
					alt: 'City marker',
				},
			},
		]);
		expect(result.minChoices).toBe(1);
		expect(result.maxChoices).toBe(3);
	});

	test('reads the QTI 3.0 <img> form of both stage background and draggable', () => {
		// QTI 3.0 PositionObjectInteractionDType/PositionObjectStageDType allow
		// object|img|picture; an <img>-authored stage used to fail extraction.
		const result = extract(`
			<positionObjectStage>
				<img src="map.png" alt="Map" width="600" height="400"/>
				<positionObjectInteraction responseIdentifier="CITY">
					<img src="city.png" alt="City marker" width="30" height="30"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`, 'CITY');

		expect(result.imageData).toMatchObject({ type: 'image', src: 'map.png', alt: 'Map', width: '600', height: '400' });
		expect(result.positionObjectStages[0].objectData).toMatchObject({
			type: 'image',
			src: 'city.png',
			alt: 'City marker',
			width: '30',
			height: '30',
		});
		expect(result.positionObjectStages[0].label).toBe('City marker');
	});

	test('reads a <picture> stage background and draggable through their <img> fallbacks', () => {
		const result = extract(`
			<positionObjectStage>
				<picture><source srcset="map-2x.png 2x"/><img src="map.png" alt="Map" width="600" height="400"/></picture>
				<positionObjectInteraction responseIdentifier="CITY">
					<picture><img src="city.png" alt="City marker" width="30" height="30"/></picture>
				</positionObjectInteraction>
			</positionObjectStage>
		`, 'CITY');

		expect(result.imageData).toMatchObject({ type: 'image', src: 'map.png', alt: 'Map' });
		expect(result.positionObjectStages[0].objectData).toMatchObject({ type: 'image', src: 'city.png', alt: 'City marker' });
	});

	test('never names the draggable object by its response identifier', () => {
		// Identifiers can reveal the answer key to assistive technology; the
		// renderer substitutes a localized generic name for an unnamed object.
		const result = extract(`
			<positionObjectStage>
				<object data="map.png" type="image/png"/>
				<positionObjectInteraction responseIdentifier="AIRPORT_CORRECT_SITE">
					<object data="marker.png" type="image/png"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`, 'AIRPORT_CORRECT_SITE');

		expect(result.positionObjectStages[0].label).toBe('');
		expect(JSON.stringify(result.positionObjectStages[0].label)).not.toContain('AIRPORT');
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

	test('without the attribute, centerPoint is null (the QTI default: the object centre)', () => {
		const result = extract(`
			<positionObjectStage>
				<object data="map.png" type="image/png"/>
				<positionObjectInteraction responseIdentifier="RESPONSE">
					<object data="marker.png" type="image/png"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`);

		expect(result.centerPoint).toBeNull();
	});

	test('reads centerPoint="x y" as the object image offset from its top-left', () => {
		const result = extract(`
			<positionObjectStage>
				<object data="map.png" type="image/png"/>
				<positionObjectInteraction responseIdentifier="RESPONSE" centerPoint="10 5">
					<object data="marker.png" type="image/png" width="40" height="40"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`);

		expect(result.centerPoint).toEqual({ x: 10, y: 5 });
	});

	test('reads the QTI 2.1 spelling centrePoint', () => {
		const result = extract(`
			<positionObjectStage>
				<object data="map.png" type="image/png"/>
				<positionObjectInteraction responseIdentifier="RESPONSE" centrePoint="24 0">
					<object data="marker.png" type="image/png" width="40" height="40"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`);

		expect(result.centerPoint).toEqual({ x: 24, y: 0 });
	});

	test('reads the QTI 3.0 spelling center-point through the attribute mapper', () => {
		const result = extract(
			`
			<qti-position-object-stage>
				<object data="map.png" type="image/png"/>
				<qti-position-object-interaction response-identifier="RESPONSE" center-point="3 30">
					<object data="marker.png" type="image/png" width="40" height="40"/>
				</qti-position-object-interaction>
			</qti-position-object-stage>
		`,
			'RESPONSE',
			{ attributeNameMapper: new Qti3AttributeNameMapper() },
		);

		expect(result.centerPoint).toEqual({ x: 3, y: 30 });
	});

	test.each(['10', '10 5 3', 'ten five', '10px 5px', ''])('a malformed centerPoint (%p) counts as unauthored', (value) => {
		const result = extract(`
			<positionObjectStage>
				<object data="map.png" type="image/png"/>
				<positionObjectInteraction responseIdentifier="RESPONSE" centerPoint="${value}">
					<object data="marker.png" type="image/png"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`);
		expect(result.centerPoint).toBeNull();
	});

	test('warns when the centerPoint lies outside the object image', () => {
		const data = extract(`
			<positionObjectStage>
				<object data="map.png" type="image/png"/>
				<positionObjectInteraction responseIdentifier="RESPONSE" centerPoint="100 5">
					<object data="marker.png" type="image/png" width="40" height="40"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`);
		const validation = standardPositionObjectExtractor.validate!(data);

		expect(validation.valid).toBe(true);
		expect(validation.warnings?.some((warning) => warning.includes('lies outside the 40×40 object image'))).toBe(true);
	});

	test('replaces authored CSS payloads in background and draggable dimensions', () => {
		const result = extract(`
			<positionObjectStage>
				<object data="map.png" width="1; background: url(//tracker.test/map)" height="url(//tracker.test/map)"/>
				<positionObjectInteraction responseIdentifier="RESPONSE">
					<object data="marker.png" width="2; color: red" height="url(//tracker.test/marker)"/>
				</positionObjectInteraction>
			</positionObjectStage>
		`);

		// The stage's pixel space stays the image's own: a default would place points
		// in a guessed space. The draggable object keeps its 50×50 fallback box.
		expect(result.imageData?.width).toBeUndefined();
		expect(result.imageData?.height).toBeUndefined();
		expect(result.positionObjectStages[0].objectData?.width).toBe('50');
		expect(result.positionObjectStages[0].objectData?.height).toBe('50');
		expect(JSON.stringify(result)).not.toContain('tracker.test');
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
			'positionObjectInteraction must have a parent positionObjectStage with a background image',
		);
		expect(validation.errors).toContain('positionObjectInteraction must contain one draggable image');
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
			'positionObjectInteraction must have a parent positionObjectStage with a background image',
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

describe.each([
	['QTI 2.2 centerPoint', CENTER_POINT_ITEM],
	['QTI 3.0 center-point', convertQti2ToQti3(CENTER_POINT_ITEM)],
	['QTI 2.1 centrePoint', CENTER_POINT_ITEM.replace('centerPoint=', 'centrePoint=')],
	['QTI 2.1 converted to QTI 3.0', convertQti2ToQti3(CENTER_POINT_ITEM.replace('centerPoint=', 'centrePoint='))],
])('positionObject centerPoint through the item pipeline (%s)', (_version, itemXml) => {
	test('the authored reference point reaches the interaction data as x/y', () => {
		const definition = createAssessmentItemDefinition({ itemXml });
		const session = definition.openSession();
		try {
			const presentation = session.present();
			const mount = presentation.flow.flatMap((node) => (node.kind === 'interaction' ? [node.mount] : []))
				.find((entry) => entry.interaction.responseId === 'RESPONSE');
			const data = mount?.interaction as PositionObjectInteractionData | undefined;
			expect(data?.centerPoint).toEqual({ x: 10, y: 5 });
		} finally {
			session.dispose();
		}
	});
});
