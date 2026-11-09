/**
 * Tests for standardSelectPointExtractor
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../../src/core/Player.js';
import { standardSelectPointExtractor } from '../../../src/interactions/select-point/extractor.js';
import type { ItemSessionEngineConfig } from '../../../src/types/index.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardSelectPointExtractor', () => {
	describe('Single Point Selection', () => {
		test('extracts selectPointInteraction with image', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<prompt>Click on the center of the circle</prompt>
					<object data="circle.png" type="image/png" width="400" height="300"/>
				</selectPointInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardSelectPointExtractor.extract(element, context);

			expect(result.prompt).toBe('Click on the center of the circle');
			expect(result.maxChoices).toBe(1);
			expect(result.minChoices).toBe(0);
			expect(result.imageData?.type).toBe('image');
			expect(result.imageData?.src).toBe('circle.png');
			expect(result.imageData?.width).toBe('400');
			expect(result.imageData?.height).toBe('300');
		});

		test('extracts selectPointInteraction with img element', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<img src="map.jpg" width="600" height="400"/>
				</selectPointInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardSelectPointExtractor.extract(element, context);

			expect(result.imageData?.type).toBe('image');
			expect(result.imageData?.src).toBe('map.jpg');
			expect(result.imageData?.width).toBe('600');
			expect(result.imageData?.height).toBe('400');
		});
	});

	describe('Multiple Point Selection', () => {
		test('extracts selectPointInteraction with maxChoices > 1', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE" maxChoices="3" minChoices="2">
					<prompt>Mark three points on the diagram</prompt>
					<object data="diagram.png" type="image/png" width="500" height="400"/>
				</selectPointInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardSelectPointExtractor.extract(element, context);

			expect(result.maxChoices).toBe(3);
			expect(result.minChoices).toBe(2);
		});
	});

	describe('SVG Content', () => {
		test('extracts selectPointInteraction with inline SVG', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<prompt>Click on the red circle</prompt>
					<object type="image/svg+xml" width="300" height="200">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
							<circle cx="150" cy="100" r="50" fill="red"/>
						</svg>
					</object>
				</selectPointInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardSelectPointExtractor.extract(element, context);

			expect(result.imageData?.type).toBe('svg');
			expect(result.imageData?.content).toContain('<svg');
			expect(result.imageData?.content).toContain('circle');
			expect(result.imageData?.width).toBe('300');
			expect(result.imageData?.height).toBe('200');
		});
	});

	describe('Default Values', () => {
		test('uses default values when attributes not specified', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE">
					<object data="image.png" type="image/png"/>
				</selectPointInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardSelectPointExtractor.extract(element, context);

			// QTI 2.2 Table 5.95.2 / QTI 3.0 Table 5.128.2: maxChoices Default = "0" (no restriction).
			expect(result.maxChoices).toBe(0);
			expect(result.minChoices).toBe(0);
			expect(result.prompt).toBeNull();
			expect(result.imageData?.width).toBe('500');
			expect(result.imageData?.height).toBe('300');
		});

		describe('maxChoices default for an absent attribute (per QTI version)', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE">
					<object data="image.png" type="image/png"/>
				</selectPointInteraction>
			`;
			function extractWith(qtiVersion: string | undefined, cardinality?: 'single' | 'multiple') {
				const element = parseQTI(xml);
				const declarations = new Map(
					cardinality ? [['RESPONSE', { identifier: 'RESPONSE', cardinality, baseType: 'point' }]] : [],
				);
				const config = (qtiVersion ? { qtiVersion } : {}) as ItemSessionEngineConfig;
				return standardSelectPointExtractor.extract(
					element,
					createTestContext(element, 'RESPONSE', element, declarations as any, config),
				);
			}

			test('QTI 2.2 and 3.0: absent maxChoices is 0, no restriction, for a multiple response', () => {
				expect(extractWith('2.2', 'multiple').maxChoices).toBe(0);
				expect(extractWith('3.0', 'multiple').maxChoices).toBe(0);
			});

			test('QTI 2.2 and 3.0: a single-cardinality response holds one point, so absent maxChoices is 1', () => {
				expect(extractWith('2.2', 'single').maxChoices).toBe(1);
				expect(extractWith('3.0', 'single').maxChoices).toBe(1);
			});

			test('QTI 2.1 keeps 1: its information model (maxChoices [1] = 1) and XSD (default 0) disagree', () => {
				expect(extractWith('2.1', 'multiple').maxChoices).toBe(1);
			});

			test('an authored maxChoices is honoured', () => {
				const element = parseQTI(xml.replace('responseIdentifier="RESPONSE"', 'responseIdentifier="RESPONSE" maxChoices="3"'));
				const context = createTestContext(element, 'RESPONSE', element, new Map(), {
					qtiVersion: '3.0',
				} as ItemSessionEngineConfig);
				expect(standardSelectPointExtractor.extract(element, context).maxChoices).toBe(3);
			});

			test('a QTI 3.0 multiple-point item delivered through the Player reads the spec default', () => {
				const itemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="sp3" title="t" adaptive="false" time-dependent="false">
					<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="point"/>
					<qti-item-body>
						<qti-select-point-interaction response-identifier="RESPONSE">
							<img src="map.png" alt="Map" width="200" height="100"/>
						</qti-select-point-interaction>
					</qti-item-body>
				</qti-assessment-item>`;
				const [interaction] = new Player({ itemXml }).getInteractionData() as Array<{ maxChoices: number }>;
				expect(interaction?.maxChoices).toBe(0);
			});
		});

		test('replaces authored CSS payloads in image dimensions with safe defaults', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE">
					<object
						data="image.png"
						type="image/png"
						width="1; background-image: url(//tracker.test/pixel)"
						height="url(https://tracker.test/pixel)"
					/>
				</selectPointInteraction>
			`;

			const element = parseQTI(xml);
			const result = standardSelectPointExtractor.extract(
				element,
				createTestContext(element, 'RESPONSE'),
			);

			expect(result.imageData?.width).toBe('500');
			expect(result.imageData?.height).toBe('300');
			expect(JSON.stringify(result.imageData)).not.toContain('tracker.test');
		});
	});

	describe('Edge Cases', () => {
		test('handles missing image element', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<prompt>Click a point (no image provided)</prompt>
				</selectPointInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardSelectPointExtractor.extract(element, context);

			expect(result.imageData).toBeNull();
		});
	});

	describe('canHandle predicate', () => {
		test('handles selectPointInteraction element', () => {
			const xml = `
				<selectPointInteraction responseIdentifier="RESPONSE">
					<object data="test.png" type="image/png"/>
				</selectPointInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardSelectPointExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-selectPointInteraction elements', () => {
			const xml = `<hotspotInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardSelectPointExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct selectPoint data', () => {
			const data = {
				maxChoices: 1,
				minChoices: 0,
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardSelectPointExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error when minChoices > maxChoices', () => {
			const data = {
				maxChoices: 1,
				minChoices: 3,
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardSelectPointExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('minChoices (3) must be less than or equal to maxChoices (1)');
		});

		test('reports error for negative maxChoices', () => {
			const data = {
				maxChoices: -1,
				minChoices: 0,
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardSelectPointExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('maxChoices must be non-negative');
		});

		test('allows maxChoices=0 (means unlimited per QTI spec)', () => {
			const data = {
				maxChoices: 0,
				minChoices: 0,
				imageData: { type: 'image', src: 'test.png', width: '500', height: '400' },
				prompt: null,
			};

			const validation = standardSelectPointExtractor.validate!(data);

			expect(validation.valid).toBe(true);
		});

		test('reports warning for missing image data', () => {
			const data = {
				maxChoices: 1,
				minChoices: 0,
				imageData: null,
				prompt: null,
			};

			const validation = standardSelectPointExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('selectPointInteraction has no image data');
		});
	});
});
