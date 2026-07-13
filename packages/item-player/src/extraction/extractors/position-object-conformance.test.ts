import { describe, expect, test } from 'bun:test';
import { Player } from '../../core/Player.js';

describe('schema-valid positionObjectStage extraction', () => {
	test('QTI 2.2 discovers every child interaction with its shared parent background', () => {
		const itemXml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="position-2">
			<responseDeclaration identifier="AIRPORTS" cardinality="multiple" baseType="point"/>
			<responseDeclaration identifier="HOSPITAL" cardinality="single" baseType="point"/>
			<itemBody>
				<positionObjectStage id="map-stage">
					<object data="map.png" type="image/png" width="640" height="480">Map</object>
					<positionObjectInteraction responseIdentifier="AIRPORTS" maxChoices="3">
						<object data="airport.png" type="image/png" width="24" height="24">Airport</object>
					</positionObjectInteraction>
					<positionObjectInteraction responseIdentifier="HOSPITAL">
						<object data="hospital.png" type="image/png" width="24" height="24">Hospital</object>
					</positionObjectInteraction>
				</positionObjectStage>
			</itemBody>
		</assessmentItem>`;

		const interactions = new Player({ itemXml }).getInteractionData() as any[];

		expect(interactions).toHaveLength(2);
		expect(interactions.map(({ responseId }) => responseId)).toEqual(['AIRPORTS', 'HOSPITAL']);
		expect(interactions[0].imageData.src).toBe('map.png');
		expect(interactions[0].positionObjectStages[0]).toMatchObject({
			identifier: 'AIRPORTS',
			matchMax: 3,
			objectData: { src: 'airport.png' },
		});
		expect(interactions[1].positionObjectStages[0]).toMatchObject({
			identifier: 'HOSPITAL',
			matchMax: 1,
			objectData: { src: 'hospital.png' },
		});
	});

	test('QTI 3.0 keeps HTML object elements native inside the stage and interactions', () => {
		const itemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="position-3">
			<qti-response-declaration identifier="MARKER_A" cardinality="single" base-type="point"/>
			<qti-response-declaration identifier="MARKER_B" cardinality="multiple" base-type="point"/>
			<qti-item-body>
				<qti-position-object-stage id="diagram-stage">
					<object data="diagram.svg" type="image/svg+xml" width="800" height="600">Diagram</object>
					<qti-position-object-interaction response-identifier="MARKER_A">
						<object data="a.svg" type="image/svg+xml" width="20" height="20">A</object>
					</qti-position-object-interaction>
					<qti-position-object-interaction response-identifier="MARKER_B" max-choices="2">
						<object data="b.svg" type="image/svg+xml" width="20" height="20">B</object>
					</qti-position-object-interaction>
				</qti-position-object-stage>
			</qti-item-body>
		</qti-assessment-item>`;

		const interactions = new Player({ itemXml }).getInteractionData() as any[];

		expect(interactions).toHaveLength(2);
		expect(interactions.map(({ responseId }) => responseId)).toEqual(['MARKER_A', 'MARKER_B']);
		expect(interactions.every(({ imageData }) => imageData.src === 'diagram.svg')).toBe(true);
		expect(interactions.map(({ positionObjectStages }) => positionObjectStages[0].objectData.src)).toEqual([
			'a.svg',
			'b.svg',
		]);
	});
});
