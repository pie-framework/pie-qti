/**
 * Tests for standardGapMatchExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardGapMatchExtractor } from '../../../src/extraction/extractors/gapMatchExtractor.js';
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
			const data = {
				gapTexts: [
					{ identifier: 'T1', text: 'Text 1', matchMax: 1 },
					{ identifier: 'T2', text: 'Text 2', matchMax: 1 },
				],
				gaps: ['G1', 'G2'],
				promptText: 'Fill [GAP:G1] and [GAP:G2]',
				shuffle: false,
				prompt: 'Fill the gaps',
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty gapTexts', () => {
			const data = {
				gapTexts: [],
				gaps: ['G1'],
				promptText: '[GAP:G1]',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('gapMatchInteraction must have at least one gapText');
		});

		test('reports error for empty gaps', () => {
			const data = {
				gapTexts: [{ identifier: 'T1', text: 'Text', matchMax: 1 }],
				gaps: [],
				promptText: 'No gaps',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('gapMatchInteraction must have at least one gap in the prompt');
		});

		test('reports error for duplicate gapText identifiers', () => {
			const data = {
				gapTexts: [
					{ identifier: 'T1', text: 'Text 1', matchMax: 1 },
					{ identifier: 'T1', text: 'Text 2', matchMax: 1 },
				],
				gaps: ['G1'],
				promptText: '[GAP:G1]',
				shuffle: false,
				prompt: null,
			};

			const validation = standardGapMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate gapText identifier: T1');
		});
	});
});
