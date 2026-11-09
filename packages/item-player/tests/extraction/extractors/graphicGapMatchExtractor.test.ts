/**
 * Tests for standardGraphicGapMatchExtractor
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../../src/core/Player.js';
import type { GraphicGapMatchInteractionData } from '../../../src/interactions/shared/types.js';
import {
	type GraphicGapMatchData,
	standardGraphicGapMatchExtractor,
} from '../../../src/interactions/graphic-gap-match/extractor.js';
import type { ItemSessionEngineConfig } from '../../../src/types/index.js';
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

	test('rejects declaration and URL payloads in the authored palette width', () => {
		const xml = `
			<graphicGapMatchInteraction
				responseIdentifier="RESPONSE"
				data-choices-container-width="2px; background-image: url(https://tracker.test/pixel)"
			>
				<object type="image/png" data="diagram.png" width="600" height="400" />
				<gapText identifier="G1" matchMax="1">Label</gapText>
				<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
			</graphicGapMatchInteraction>
		`;
		const element = parseQTI(xml);

		const result = standardGraphicGapMatchExtractor.extract(
			element,
			createTestContext(element, 'RESPONSE'),
		);

		expect((result as { choicesContainerWidth?: string }).choicesContainerWidth).toBeUndefined();
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

	describe('matchGroup extraction', () => {
		test('extracts single matchGroup value on gapTexts', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1" matchGroup="animal">Cat</gapText>
					<gapText identifier="T2" matchMax="1">Other</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.gapTexts[0].matchGroup).toEqual(['animal']);
			expect(result.gapTexts[1].matchGroup).toBeUndefined();
		});

		test('extracts multiple matchGroup values on gapTexts', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1" matchGroup="set-a set-b">Item</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.gapTexts[0].matchGroup).toEqual(['set-a', 'set-b']);
		});

		test('omits matchGroup when absent', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1">Item</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.gapTexts[0].matchGroup).toBeUndefined();
		});

		test('extracts each associableHotspot matchGroup (the labels it accepts), omitted when absent', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1">Item</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" matchGroup="T1 T2" />
					<associableHotspot identifier="H2" shape="rect" coords="0,0,50,50" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.hotspots[0]?.matchGroup).toEqual(['T1', 'T2']);
			expect(result.hotspots[1]).not.toHaveProperty('matchGroup');
		});

		test('delivers QTI 3.0 match-group on qti-associable-hotspot', () => {
			const itemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="ggm3">
				<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
				<qti-item-body>
					<qti-graphic-gap-match-interaction response-identifier="RESPONSE">
						<object type="image/png" data="map.png" width="100" height="100"></object>
						<qti-gap-text identifier="FLAG" match-max="1" match-group="CITY">Flag</qti-gap-text>
						<qti-associable-hotspot identifier="CITY" shape="circle" coords="10,10,5" match-max="1"/>
						<qti-associable-hotspot identifier="SEA" shape="circle" coords="50,50,5" match-max="1" match-group="BOAT"/>
					</qti-graphic-gap-match-interaction>
				</qti-item-body>
			</qti-assessment-item>`;

			const [interaction] = new Player({ itemXml }).getInteractionData() as GraphicGapMatchInteractionData[];

			expect(interaction?.hotspots.map((hotspot) => hotspot.matchGroup)).toEqual([undefined, ['BOAT']]);
			expect(interaction?.gapTexts[0]?.matchGroup).toEqual(['CITY']);
		});
	});

	describe('maxAssociations extraction', () => {
		test('absent maxAssociations means 1 for QTI 2.2 content (spec default, Table 5.41.2)', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1">Label</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE', element, new Map(), {
				qtiVersion: '2.2',
			} as ItemSessionEngineConfig);

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.maxAssociations).toBe(1);
		});

		test('absent maxAssociations means 1 for QTI 3.0 content (spec default, Table 5.60.2)', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1">Label</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE', element, new Map(), {
				qtiVersion: '3.0',
			} as ItemSessionEngineConfig);

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.maxAssociations).toBe(1);
		});

		test('absent maxAssociations means 0 (unlimited) for QTI 2.1 content: the attribute does not exist in the 2.1 XSD', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1">Label</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE', element, new Map(), {
				qtiVersion: '2.1',
			} as ItemSessionEngineConfig);

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.maxAssociations).toBe(0);
		});

		test('absent maxAssociations with no detected version follows the 2.2 assumption (1)', () => {
			// detectQtiVersion assumes QTI 2.2 for an unversioned camelCase item, so a
			// context without a version behaves like 2.2 content.
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

			expect(result.maxAssociations).toBe(1);
		});

		test('authored maxAssociations is extracted as-is in QTI 2.1 content (leniency)', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE" maxAssociations="3">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1">Label</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE', element, new Map(), {
				qtiVersion: '2.1',
			} as ItemSessionEngineConfig);

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.maxAssociations).toBe(3);
		});

		test('authored maxAssociations="0" still means unlimited in QTI 3.0 content', () => {
			const xml = `
				<graphicGapMatchInteraction responseIdentifier="RESPONSE" maxAssociations="0">
					<object type="image/png" data="diagram.png" />
					<gapText identifier="T1" matchMax="1">Label</gapText>
					<associableHotspot identifier="H1" shape="rect" coords="0,0,100,100" matchMax="1" />
				</graphicGapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE', element, new Map(), {
				qtiVersion: '3.0',
			} as ItemSessionEngineConfig);

			const result = standardGraphicGapMatchExtractor.extract(element, context);

			expect(result.maxAssociations).toBe(0);
		});
	});

	describe('maxAssociations per-version defaults through the Player', () => {
		test('QTI 3.0 item without max-associations gets the spec default of 1', () => {
			const itemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="ggm3-default">
				<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
				<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
				<qti-item-body>
					<qti-graphic-gap-match-interaction response-identifier="RESPONSE">
						<object type="image/png" data="map.png" width="100" height="100"></object>
						<qti-gap-text identifier="T1" match-max="1">Label</qti-gap-text>
						<qti-associable-hotspot identifier="H1" shape="circle" coords="10,10,5" match-max="1"/>
						<qti-associable-hotspot identifier="H2" shape="circle" coords="50,50,5" match-max="1"/>
					</qti-graphic-gap-match-interaction>
				</qti-item-body>
			</qti-assessment-item>`;

			const [interaction] = new Player({ itemXml }).getInteractionData() as GraphicGapMatchInteractionData[];

			expect(interaction?.maxAssociations).toBe(1);
		});

		test('QTI 2.2 item without maxAssociations gets the spec default of 1', () => {
			const itemXml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ggm22-default">
				<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
				<itemBody>
					<graphicGapMatchInteraction responseIdentifier="RESPONSE">
						<object type="image/png" data="map.png" width="100" height="100"></object>
						<gapText identifier="T1" matchMax="1">Label</gapText>
						<associableHotspot identifier="H1" shape="circle" coords="10,10,5" matchMax="1"/>
						<associableHotspot identifier="H2" shape="circle" coords="50,50,5" matchMax="1"/>
					</graphicGapMatchInteraction>
				</itemBody>
			</assessmentItem>`;

			const [interaction] = new Player({ itemXml }).getInteractionData() as GraphicGapMatchInteractionData[];

			expect(interaction?.maxAssociations).toBe(1);
		});

		test('QTI 2.1 item without maxAssociations keeps 0 (no interaction cap in 2.1)', () => {
			const itemXml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="ggm21-default">
				<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
				<itemBody>
					<graphicGapMatchInteraction responseIdentifier="RESPONSE">
						<object type="image/png" data="map.png" width="100" height="100"></object>
						<gapText identifier="T1" matchMax="1">Label</gapText>
						<associableHotspot identifier="H1" shape="circle" coords="10,10,5" matchMax="1"/>
						<associableHotspot identifier="H2" shape="circle" coords="50,50,5" matchMax="1"/>
					</graphicGapMatchInteraction>
				</itemBody>
			</assessmentItem>`;

			const [interaction] = new Player({ itemXml }).getInteractionData() as GraphicGapMatchInteractionData[];

			expect(interaction?.maxAssociations).toBe(0);
		});
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
			const data: GraphicGapMatchData = {
				gapTexts: [
					{ identifier: 'T1', text: 'Label 1', matchMax: 1 },
					{ identifier: 'T2', text: 'Label 2', matchMax: 1 },
				],
				hotspots: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
					{ identifier: 'H2', shape: 'circle', coords: '200,200,50', matchMax: 1 },
				],
				imageData: { type: 'image', src: 'test.png', width: 500, height: 400 },
				gapImages: [],
				maxAssociations: 1,
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty gapTexts', () => {
			const data: GraphicGapMatchData = {
				gapTexts: [],
				hotspots: [{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 }],
				imageData: { type: 'image', src: 'test.png', width: 500, height: 400 },
				gapImages: [],
				maxAssociations: 1,
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('graphicGapMatchInteraction must have at least one gapText or gapImg');
		});

		test('reports error for empty hotspots', () => {
			const data: GraphicGapMatchData = {
				gapTexts: [{ identifier: 'T1', text: 'Label', matchMax: 1 }],
				hotspots: [],
				imageData: { type: 'image', src: 'test.png', width: 500, height: 400 },
				gapImages: [],
				maxAssociations: 1,
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('graphicGapMatchInteraction must have at least one hotspot');
		});

		test('reports error for duplicate gapText identifiers', () => {
			const data: GraphicGapMatchData = {
				gapTexts: [
					{ identifier: 'T1', text: 'Label 1', matchMax: 1 },
					{ identifier: 'T1', text: 'Label 2', matchMax: 1 },
				],
				hotspots: [{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 }],
				imageData: { type: 'image', src: 'test.png', width: 500, height: 400 },
				gapImages: [],
				maxAssociations: 1,
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate gapText identifier: T1');
		});

		test('reports error for duplicate hotspot identifiers', () => {
			const data: GraphicGapMatchData = {
				gapTexts: [{ identifier: 'T1', text: 'Label', matchMax: 1 }],
				hotspots: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
					{ identifier: 'H1', shape: 'circle', coords: '200,200,50', matchMax: 1 },
				],
				imageData: { type: 'image', src: 'test.png', width: 500, height: 400 },
				gapImages: [],
				maxAssociations: 1,
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate hotspot identifier: H1');
		});

		test('a default-shape hotspot needs no coords: it is the whole image (QTI 3.0 §8.29)', () => {
			const data: GraphicGapMatchData = {
				gapTexts: [{ identifier: 'T1', text: 'Label', matchMax: 1 }],
				hotspots: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,100', matchMax: 1 },
					{ identifier: 'ALL', shape: 'default', coords: '', matchMax: 1 },
				],
				imageData: { type: 'image', src: 'test.png', width: 500, height: 400 },
				gapImages: [],
				maxAssociations: 1,
				prompt: null,
			};

			const validation = standardGraphicGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});
	});
});
