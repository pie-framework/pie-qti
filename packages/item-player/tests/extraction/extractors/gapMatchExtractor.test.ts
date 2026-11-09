/**
 * Tests for standardGapMatchExtractor
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../../src/core/Player.js';
import type { GapMatchInteractionData } from '../../../src/interactions/shared/types.js';
import { type GapMatchData, standardGapMatchExtractor } from '../../../src/interactions/gap-match/extractor.js';
import type { ItemSessionEngineConfig } from '../../../src/types/index.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardGapMatchExtractor', () => {
	test('extracts basic gap match interaction', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>Fill in the <gap identifier="G1" /> with the correct word.</prompt>
				<gapText identifier="T1" matchMax="1">cat</gapText>
				<gapText identifier="T2" matchMax="1">dog</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		expect(result.gapTexts).toHaveLength(2);
		expect(result.promptText).toContain('[GAP:G1]');
	});

	test('rejects declaration and URL payloads in the authored palette width', () => {
		const xml = `
			<gapMatchInteraction
				responseIdentifier="RESPONSE"
				data-choices-container-width="1px; background-image: url(//tracker.test/pixel)"
			>
				<prompt>Fill in <gap identifier="G1" />.</prompt>
				<gapText identifier="T1" matchMax="1">safe</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect((result as { choicesContainerWidth?: string }).choicesContainerWidth).toBeUndefined();
	});

	test('canonicalizes a numeric authored palette width to pixels', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" data-choices-container-width="320">
				<prompt>Fill in <gap identifier="G1" />.</prompt>
				<gapText identifier="T1" matchMax="1">safe</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);

		const result = standardGapMatchExtractor.extract(
			element,
			createTestContext(element, 'RESPONSE'),
		);

		expect((result as { choicesContainerWidth?: string }).choicesContainerWidth).toBe('320px');
	});

	test('extracts gapText elements with matchMax values', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>Fill the gaps: <gap identifier="G1" /> and <gap identifier="G2" /></prompt>
				<gapText identifier="T1" matchMax="1">first</gapText>
				<gapText identifier="T2" matchMax="2">second</gapText>
				<gapText identifier="T3" matchMax="0">unlimited</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.gapTexts).toHaveLength(3);
		expect(result.gapTexts[0]).toEqual({ identifier: 'T1', text: 'first', matchMax: 1 });
		expect(result.gapTexts[1]).toEqual({ identifier: 'T2', text: 'second', matchMax: 2 });
		expect(result.gapTexts[2]).toEqual({ identifier: 'T3', text: 'unlimited', matchMax: 0 });
	});

	test('uses default matchMax when not specified', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>Fill the gap: <gap identifier="G1" /></prompt>
				<gapText identifier="T1">word without matchMax</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.gapTexts[0].matchMax).toBe(1);
	});

	test('extracts gap identifiers from prompt content', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>The <gap identifier="G1" /> jumps over the <gap identifier="G2" />.</prompt>
				<gapText identifier="T1" matchMax="1">cat</gapText>
				<gapText identifier="T2" matchMax="1">fence</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.promptText).toContain('[GAP:G1]');
		expect(result.promptText).toContain('[GAP:G2]');
	});

	test('processes promptText with gap placeholders replaced', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>The <gap identifier="G1" /> is <gap identifier="G2" />.</prompt>
				<gapText identifier="T1" matchMax="1">sky</gapText>
				<gapText identifier="T2" matchMax="1">blue</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.promptText).toBe('The [GAP:G1] is [GAP:G2].');
	});

	test('sanitizes prompt markup before building promptText', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt><span onclick="alert('xss')">Fill</span> <gap identifier="G1" /></prompt>
				<gapText identifier="T1" matchMax="1">safe</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.promptText).toContain('<span>Fill</span> [GAP:G1]');
		expect(result.promptText).not.toContain('onclick');
		expect(result.promptText).not.toContain('alert(');
	});

	test('handles interaction with shuffle enabled', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="true">
				<prompt>Fill the gap: <gap identifier="G1" /></prompt>
				<gapText identifier="T1" matchMax="1">answer</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.shuffle).toBe(true);
	});

	test('handles interaction without shuffle attribute', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE">
				<prompt>Fill the gap: <gap identifier="G1" /></prompt>
				<gapText identifier="T1" matchMax="1">answer</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<gapText identifier="T1" matchMax="1">answer</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
		expect(result.promptText).toBe('');
		expect(result.gaps).toHaveLength(0);
	});

	test('handles interaction with no gapText elements', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>Fill the gap: <gap identifier="G1" /></prompt>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.gapTexts).toHaveLength(0);
		expect(result.promptText).toContain('[GAP:G1]');
	});

	test('handles prompt with no gap elements', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>This is a prompt without any gaps.</prompt>
				<gapText identifier="T1" matchMax="1">unused</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.promptText).toBe('This is a prompt without any gaps.');
		expect(result.promptText).not.toContain('[GAP');
	});

	test('handles gapText with HTML content', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>Fill the gap: <gap identifier="G1" /></prompt>
				<gapText identifier="T1" matchMax="1">text with <strong>bold</strong></gapText>
				<gapText identifier="T2" matchMax="1">text with <em>italic</em></gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.gapTexts[0].text).toContain('bold');
		expect(result.gapTexts[1].text).toContain('italic');
	});

	test('handles multiple gaps in complex prompt', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>
					In <gap identifier="G1" />, the capital is <gap identifier="G2" />.
					The population is <gap identifier="G3" /> million.
				</prompt>
				<gapText identifier="T1" matchMax="1">France</gapText>
				<gapText identifier="T2" matchMax="1">Paris</gapText>
				<gapText identifier="T3" matchMax="1">67</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.promptText).toContain('[GAP:G1]');
		expect(result.promptText).toContain('[GAP:G2]');
		expect(result.promptText).toContain('[GAP:G3]');
		expect(result.gapTexts).toHaveLength(3);
	});

	test('handles self-closing gap tags with extra whitespace', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>Gap 1: <gap identifier="G1"  />  and Gap 2: <gap identifier="G2"   /></prompt>
				<gapText identifier="T1" matchMax="1">answer</gapText>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.promptText).toContain('[GAP:G1]');
		expect(result.promptText).toContain('[GAP:G2]');
	});

	test('extracts sibling gap content when prompt is separate and gap identifier is not first attribute', () => {
		const xml = `
			<gapMatchInteraction class="qti-choices-top" maxAssociations="0" responseIdentifier="RESPONSE">
				<prompt>Demonstrates all gap element qti-input-width classes</prompt>
				<gapText identifier="gt1" matchMax="1">M</gapText>
				<gapText identifier="gt2" matchMax="1">MM</gapText>
				<p>
					qti-input-width-1: <gap class="qti-input-width-1" identifier="G1" /><br/>
					qti-input-width-2: <gap class="qti-input-width-2" identifier="G2" />
				</p>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.gaps).toEqual(['G1', 'G2']);
		expect(result.prompt).toBe('Demonstrates all gap element qti-input-width classes');
		expect(result.promptText).toContain('qti-input-width-1: [GAP:G1]');
		expect(result.promptText).toContain('qti-input-width-2: [GAP:G2]');
		expect(result.promptText).not.toContain('<gapText');
	});

	test('sanitizes sibling content before building fallback promptText', () => {
		const xml = `
			<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
				<prompt>Fill the gap.</prompt>
				<gapText identifier="T1" matchMax="1">safe</gapText>
				<p onmouseover="alert('xss')">
					<img src="javascript:alert('xss')" /> <gap identifier="G1" />
				</p>
			</gapMatchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardGapMatchExtractor.extract(element, context);

		expect(result.promptText).toContain('[GAP:G1]');
		expect(result.promptText).not.toContain('onmouseover');
		expect(result.promptText).not.toContain('javascript:');
		expect(result.promptText).not.toContain('alert(');
	});

	describe('matchGroup extraction', () => {
		test('extracts single matchGroup value', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill: <gap identifier="G1" /></prompt>
					<gapText identifier="T1" matchMax="1" matchGroup="animal">Cat</gapText>
					<gapText identifier="T2" matchMax="1">Other</gapText>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGapMatchExtractor.extract(element, context);

			expect(result.gapTexts[0].matchGroup).toEqual(['animal']);
		});

		test('extracts multiple matchGroup values', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill: <gap identifier="G1" /></prompt>
					<gapText identifier="T1" matchMax="1" matchGroup="set-a set-b">Item</gapText>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGapMatchExtractor.extract(element, context);

			expect(result.gapTexts[0].matchGroup).toEqual(['set-a', 'set-b']);
		});

		test('omits matchGroup when absent', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill: <gap identifier="G1" /></prompt>
					<gapText identifier="T1" matchMax="1">Item</gapText>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGapMatchExtractor.extract(element, context);

			expect(result.gapTexts[0].matchGroup).toBeUndefined();
		});

		test('reads each gap matchGroup (the choices it accepts) inside the prompt', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>First <gap identifier="G1" matchGroup="T1 T2" /> then <gap identifier="G2" />.</prompt>
					<gapText identifier="T1" matchMax="1">one</gapText>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);

			const result = standardGapMatchExtractor.extract(element, createTestContext(element, 'RESPONSE'));

			expect(result.gaps).toEqual(['G1', 'G2']);
			expect(result.gapMatchGroups).toEqual({ G1: ['T1', 'T2'] });
		});

		test('reads each gap matchGroup when the gaps sit in body content beside the prompt', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill the gaps.</prompt>
					<gapText identifier="T1" matchMax="1">one</gapText>
					<p>First <gap identifier="G1" /> then <gap matchGroup="T1" identifier="G2" />.</p>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);

			const result = standardGapMatchExtractor.extract(element, createTestContext(element, 'RESPONSE'));

			expect(result.gaps).toEqual(['G1', 'G2']);
			expect(result.gapMatchGroups).toEqual({ G2: ['T1'] });
		});

		test('omits gapMatchGroups when no gap authors one', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill: <gap identifier="G1" /></prompt>
					<gapText identifier="T1" matchMax="1" matchGroup="G1">Item</gapText>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);

			const result = standardGapMatchExtractor.extract(element, createTestContext(element, 'RESPONSE'));

			expect(result).not.toHaveProperty('gapMatchGroups');
		});
	});

	describe('delivered interaction data', () => {
		test('gaps are delivered as the identifier strings of GapMatchInteractionData, with QTI 3.0 match-group', () => {
			const itemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gm3">
				<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
				<qti-item-body>
					<qti-gap-match-interaction response-identifier="RESPONSE">
						<qti-gap-text identifier="W1" match-max="1" match-group="G1">one</qti-gap-text>
						<qti-gap-text identifier="W2" match-max="1">two</qti-gap-text>
						<p>First <qti-gap identifier="G1"/> then <qti-gap identifier="G2" match-group="W2"/>.</p>
					</qti-gap-match-interaction>
				</qti-item-body>
			</qti-assessment-item>`;

			const [interaction] = new Player({ itemXml }).getInteractionData() as GapMatchInteractionData[];

			expect(interaction?.gaps).toEqual(['G1', 'G2']);
			expect(interaction?.gapMatchGroups).toEqual({ G2: ['W2'] });
			expect(interaction?.gapTexts.find((gapText) => gapText.identifier === 'W1')?.matchGroup).toEqual(['G1']);
		});
	});

	describe('gapImg extraction', () => {
		test('extracts QTI 2.x gapImg with an object child', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill: <gap identifier="G1" /></prompt>
					<gapText identifier="T1" matchMax="1">cat</gapText>
					<gapImg identifier="I1" matchMax="1">
						<object data="images/sun.png" width="40" height="30" type="image/png">Sun</object>
					</gapImg>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGapMatchExtractor.extract(element, context);

			expect(result.gapImages).toHaveLength(1);
			expect(result.gapImages[0]).toMatchObject({
				identifier: 'I1',
				src: 'images/sun.png',
				alt: 'Sun',
				matchMax: 1,
				width: 40,
				height: 30,
			});
		});

		test('extracts image choices with matchGroup and matchMax', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill: <gap identifier="G1" /></prompt>
					<gapImg identifier="I1" matchMax="2" matchGroup="shapes">
						<object data="images/circle.png">Circle</object>
					</gapImg>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGapMatchExtractor.extract(element, context);

			expect(result.gapImages[0].matchMax).toBe(2);
			expect(result.gapImages[0].matchGroup).toEqual(['shapes']);
		});

		test('supports mixed pools: gapText and gapImg choices can shuffle together', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="true">
					<prompt>Fill: <gap identifier="G1" /> and <gap identifier="G2" /></prompt>
					<gapText identifier="T1" matchMax="1">cat</gapText>
					<gapImg identifier="I1" matchMax="1">
						<object data="images/dog.png">Dog</object>
					</gapImg>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGapMatchExtractor.extract(element, context);

			// Shuffling redistributes the combined pool; both kinds survive it.
			expect(result.gapTexts).toHaveLength(1);
			expect(result.gapImages).toHaveLength(1);
			expect(result.shuffle).toBe(true);
		});

		test('keeps authored pool order when shuffle is off', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill: <gap identifier="G1" /></prompt>
					<gapText identifier="T1" matchMax="1">cat</gapText>
					<gapImg identifier="I1" matchMax="1">
						<object data="images/dog.png">Dog</object>
					</gapImg>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGapMatchExtractor.extract(element, context);

			expect(result.gapTexts[0].identifier).toBe('T1');
			expect(result.gapImages[0].identifier).toBe('I1');
		});

		test('an image-only item has no gapTexts but extracts the image', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<prompt>Fill: <gap identifier="G1" /></prompt>
					<gapImg identifier="I1" matchMax="1">
						<object data="images/sun.png">Sun</object>
					</gapImg>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardGapMatchExtractor.extract(element, context);

			expect(result.gapTexts).toHaveLength(0);
			expect(result.gapImages).toHaveLength(1);
			expect(result.gapImages[0].src).toBe('images/sun.png');
		});
	});

	describe('maxAssociations (per QTI version)', () => {
		const xml = (attributes = '') => `
			<gapMatchInteraction responseIdentifier="RESPONSE"${attributes}>
				<gapText identifier="W1" matchMax="1">one</gapText>
				<gapText identifier="W2" matchMax="1">two</gapText>
				<p>A <gap identifier="G1"/> and <gap identifier="G2"/>.</p>
			</gapMatchInteraction>
		`;
		function extractWith(qtiVersion: string | undefined, attributes = '') {
			const element = parseQTI(xml(attributes));
			const config = (qtiVersion ? { qtiVersion } : {}) as ItemSessionEngineConfig;
			return standardGapMatchExtractor.extract(element, createTestContext(element, 'RESPONSE', element, new Map(), config));
		}

		test('QTI 2.2 and 3.0: absent maxAssociations is 1 (Default = "1", Tables 5.38.3 / 5.57.3)', () => {
			expect(extractWith('2.2').maxAssociations).toBe(1);
			expect(extractWith('3.0').maxAssociations).toBe(1);
			expect(extractWith(undefined).maxAssociations).toBe(1);
		});

		test('QTI 2.1: absent maxAssociations is 0, no cap: the attribute was added in QTI 2.2', () => {
			expect(extractWith('2.1').maxAssociations).toBe(0);
		});

		test('an authored maxAssociations is honoured in every version, "0" meaning unlimited', () => {
			expect(extractWith('2.1', ' maxAssociations="3"').maxAssociations).toBe(3);
			expect(extractWith('3.0', ' maxAssociations="0"').maxAssociations).toBe(0);
			expect(extractWith('2.2', ' maxAssociations="2"').maxAssociations).toBe(2);
		});

		test('a QTI 3.0 item delivers max-associations, defaulting to 1', () => {
			const itemXml = (attributes: string) => `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gm3" title="t" adaptive="false" time-dependent="false">
				<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
				<qti-item-body>
					<qti-gap-match-interaction response-identifier="RESPONSE"${attributes}>
						<qti-gap-text identifier="W1" match-max="1">one</qti-gap-text>
						<p>A <qti-gap identifier="G1"/> and <qti-gap identifier="G2"/>.</p>
					</qti-gap-match-interaction>
				</qti-item-body>
			</qti-assessment-item>`;
			const read = (attributes: string) =>
				(new Player({ itemXml: itemXml(attributes) }).getInteractionData()[0] as GapMatchInteractionData).maxAssociations;
			expect(read('')).toBe(1);
			expect(read(' max-associations="2"')).toBe(2);
		});
	});

	describe('canHandle predicate', () => {
		test('handles gapMatchInteraction element', () => {
			const xml = `
				<gapMatchInteraction responseIdentifier="RESPONSE">
					<gapText identifier="T1">text</gapText>
				</gapMatchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardGapMatchExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-gapMatchInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardGapMatchExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct gapMatch data', () => {
			const data: GapMatchData = {
				gapTexts: [
					{ identifier: 'T1', text: 'Text 1', matchMax: 1 },
					{ identifier: 'T2', text: 'Text 2', matchMax: 1 },
				],
				gapImages: [],
				gaps: ['G1', 'G2'],
				promptText: 'Fill [GAP:G1] and [GAP:G2]',
				shuffle: false,
				prompt: 'Fill the gaps',
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('validates an image-only item (gapImg without gapText)', () => {
			const data: GapMatchData = {
				gapTexts: [],
				gapImages: [{ identifier: 'I1', src: 'images/sun.png', alt: 'Sun', matchMax: 1 }],
				gaps: ['G1'],
				promptText: 'Fill [GAP:G1]',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty gapTexts and gapImages', () => {
			const data: GapMatchData = {
				gapTexts: [],
				gapImages: [],
				gaps: ['G1'],
				promptText: '[GAP:G1]',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('gapMatchInteraction must have at least one gapText or gapImg');
		});

		test('reports error for a gapImg without an image source', () => {
			const data: GapMatchData = {
				gapTexts: [{ identifier: 'T1', text: 'Text', matchMax: 1 }],
				gapImages: [{ identifier: 'I1', src: '', alt: 'Sun', matchMax: 1 }],
				gaps: ['G1'],
				promptText: '[GAP:G1]',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('gapImg I1 must reference an image source');
		});

		test('reports error when a gapImg identifier collides with a gapText identifier', () => {
			const data: GapMatchData = {
				gapTexts: [{ identifier: 'T1', text: 'Text', matchMax: 1 }],
				gapImages: [{ identifier: 'T1', src: 'images/sun.png', alt: 'Sun', matchMax: 1 }],
				gaps: ['G1'],
				promptText: '[GAP:G1]',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate choice identifier: T1');
		});

		test('reports error for empty gaps', () => {
			const data: GapMatchData = {
				gapTexts: [{ identifier: 'T1', text: 'Text', matchMax: 1 }],
				gaps: [],
				gapImages: [],
				promptText: 'No gaps',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('gapMatchInteraction must have at least one gap in the prompt');
		});

		test('reports error for duplicate gapText identifiers', () => {
			const data: GapMatchData = {
				gapTexts: [
					{ identifier: 'T1', text: 'Text 1', matchMax: 1 },
					{ identifier: 'T1', text: 'Text 2', matchMax: 1 },
				],
				gaps: ['G1'],
				gapImages: [],
				promptText: '[GAP:G1]',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate choice identifier: T1');
		});
	});
});
