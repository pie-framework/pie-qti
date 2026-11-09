/**
 * Tests for standardChoiceExtractor
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../../src/core/Player.js';
import { type ChoiceData, standardChoiceExtractor } from '../../../src/interactions/choice/extractor.js';
import type { ItemSessionEngineConfig } from '../../../src/types/index.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardChoiceExtractor', () => {
	test('extracts basic multiple choice interaction', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<prompt>What is the capital of France?</prompt>
				<simpleChoice identifier="A">London</simpleChoice>
				<simpleChoice identifier="B">Paris</simpleChoice>
				<simpleChoice identifier="C">Berlin</simpleChoice>
				<simpleChoice identifier="D">Madrid</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		expect(result.maxChoices).toBe(1);
		expect(result.prompt).toBe('What is the capital of France?');
		expect(result.choices).toHaveLength(4);
		expect(result.choices[0]).toEqual({ identifier: 'A', text: 'London' });
		expect(result.choices[1]).toEqual({ identifier: 'B', text: 'Paris' });
	});

	test('extracts multi-select interaction', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="3">
				<prompt>Select all prime numbers</prompt>
				<simpleChoice identifier="A">2</simpleChoice>
				<simpleChoice identifier="B">3</simpleChoice>
				<simpleChoice identifier="C">4</simpleChoice>
				<simpleChoice identifier="D">5</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(true);
		expect(result.maxChoices).toBe(3);
		expect(result.choices).toHaveLength(4);
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<simpleChoice identifier="A">Choice A</simpleChoice>
				<simpleChoice identifier="B">Choice B</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
		expect(result.choices).toHaveLength(2);
	});

	test('uses default values for missing attributes', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE">
				<simpleChoice identifier="A">Choice A</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		expect(result.maxChoices).toBe(1);
	});

	test('handles choices with HTML content', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<simpleChoice identifier="A">Choice with <strong>bold</strong> text</simpleChoice>
				<simpleChoice identifier="B">Choice with <em>italic</em> text</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.choices[0].text).toContain('bold');
		expect(result.choices[1].text).toContain('italic');
	});

	test('handles empty choice list', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<prompt>Question with no choices</prompt>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.choices).toHaveLength(0);
	});

	test('extracts choice CSS classes', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
				<simpleChoice identifier="A" class="special highlight">Choice A</simpleChoice>
				<simpleChoice identifier="B">Choice B</simpleChoice>
			</choiceInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardChoiceExtractor.extract(element, context);

		expect(result.choices[0].classes).toEqual(['special', 'highlight']);
		expect(result.choices[1].classes).toBeUndefined();
	});

	describe('maxChoices default for an absent attribute (per QTI version)', () => {
		const xml = `
			<choiceInteraction responseIdentifier="RESPONSE">
				<simpleChoice identifier="A">A</simpleChoice>
				<simpleChoice identifier="B">B</simpleChoice>
				<simpleChoice identifier="C">C</simpleChoice>
			</choiceInteraction>
		`;
		function extractWith(qtiVersion: string | undefined, cardinality?: 'single' | 'multiple') {
			const element = parseQTI(xml);
			const declarations = new Map(
				cardinality ? [['RESPONSE', { identifier: 'RESPONSE', cardinality, baseType: 'identifier' }]] : [],
			);
			const config = (qtiVersion ? { qtiVersion } : {}) as ItemSessionEngineConfig;
			return standardChoiceExtractor.extract(
				element,
				createTestContext(element, 'RESPONSE', element, declarations as any, config),
			);
		}

		test('QTI 2.2 and 3.0: absent maxChoices is 1 (Default = "1")', () => {
			expect(extractWith('2.2', 'multiple').maxChoices).toBe(1);
			expect(extractWith('3.0', 'multiple').maxChoices).toBe(1);
			expect(extractWith(undefined, 'multiple').maxChoices).toBe(1);
		});

		test('QTI 2.1: absent maxChoices is 0, no restriction (maxChoices [0..1] = 0)', () => {
			expect(extractWith('2.1', 'multiple').maxChoices).toBe(0);
		});

		test('QTI 2.1: a single-cardinality response holds one choice, so absent maxChoices is 1', () => {
			expect(extractWith('2.1', 'single').maxChoices).toBe(1);
		});

		test('an authored maxChoices is honoured in QTI 2.1', () => {
			const element = parseQTI(xml.replace('responseIdentifier="RESPONSE"', 'responseIdentifier="RESPONSE" maxChoices="2"'));
			const context = createTestContext(element, 'RESPONSE', element, new Map(), {
				qtiVersion: '2.1',
			} as ItemSessionEngineConfig);
			expect(standardChoiceExtractor.extract(element, context).maxChoices).toBe(2);
		});

		test('a QTI 2.1 item delivered through the Player reads the 2.1 default', () => {
			const itemXml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="choice21" title="t" adaptive="false" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>
				<itemBody>${xml}</itemBody>
			</assessmentItem>`;
			const [interaction] = new Player({ itemXml }).getInteractionData() as Array<{ maxChoices: number }>;
			expect(interaction?.maxChoices).toBe(0);
		});
	});

	describe('canHandle predicate', () => {
		test('handles choice interaction with simpleChoice children', () => {
			const xml = `
				<choiceInteraction responseIdentifier="RESPONSE">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardChoiceExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects choice interaction without simpleChoice children', () => {
			const xml = `
				<choiceInteraction responseIdentifier="RESPONSE">
					<prompt>No choices</prompt>
				</choiceInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardChoiceExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct choice data', () => {
			const data: ChoiceData = {
				choices: [
					{ identifier: 'A', text: 'Choice A' },
					{ identifier: 'B', text: 'Choice B' },
				],
				shuffle: false,
				maxChoices: 1,
				minChoices: 0,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty choices', () => {
			const data: ChoiceData = {
				choices: [],
				shuffle: false,
				maxChoices: 1,
				minChoices: 0,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('choiceInteraction must have at least one choice');
		});

		test('reports error for missing choice identifiers', () => {
			const data: ChoiceData = {
				choices: [
					{ identifier: '', text: 'Choice A' },
					{ identifier: 'B', text: 'Choice B' },
				],
				shuffle: false,
				maxChoices: 1,
				minChoices: 0,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('All choices must have an identifier');
		});

		test('reports error for duplicate identifiers', () => {
			const data: ChoiceData = {
				choices: [
					{ identifier: 'A', text: 'Choice A' },
					{ identifier: 'A', text: 'Choice B' },
				],
				shuffle: false,
				maxChoices: 1,
				minChoices: 0,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate choice identifier: A');
		});

		test('reports warning when maxChoices exceeds choice count', () => {
			const data: ChoiceData = {
				choices: [
					{ identifier: 'A', text: 'Choice A' },
					{ identifier: 'B', text: 'Choice B' },
				],
				shuffle: false,
				maxChoices: 5,
				minChoices: 0,
				prompt: null,
			};

			const validation = standardChoiceExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('maxChoices (5) is greater than the number of choices (2)');
		});
	});
});
