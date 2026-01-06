/**
 * Tests for Likert Choice Extractor
 */

import { describe, expect, test } from 'bun:test';
import type { ExtractionContext } from '@pie-qti/qti2-item-player';
import { parse } from 'node-html-parser';
import { likertChoiceExtractor } from '../../src/extractors/likertChoiceExtractor.js';

// Helper to create extraction context
function createContext(element: any): ExtractionContext {
	return {
		element,
		responseId: 'RESPONSE',
		dom: element,
		declarations: new Map(),
		utils: {
			getChildrenByTag(el: any, tagName: string) {
				return el.childNodes?.filter((n: any) => n.rawTagName === tagName) || [];
			},
			hasChildWithTag(el: any, tagName: string) {
				return el.childNodes?.some((n: any) => n.rawTagName === tagName) || false;
			},
			getHtmlContent(el: any) {
				return el?.innerHTML?.trim() || '';
			},
			getTextContent(el: any) {
				return el?.textContent?.trim() || '';
			},
			getAttribute(el: any, name: string, defaultValue = '') {
				return el.getAttribute(name) || defaultValue;
			},
			getBooleanAttribute(el: any, name: string, defaultValue = false) {
				const value = el.getAttribute(name);
				if (value === null || value === undefined) return defaultValue;
				return value === 'true';
			},
			getNumberAttribute(el: any, name: string, defaultValue: number) {
				const value = el.getAttribute(name);
				return value ? Number(value) : defaultValue;
			},
			getClasses(el: any) {
				const classAttr = el.getAttribute('class');
				return classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
			},
			querySelectorAll(el: any, selector: string) {
				return el.querySelectorAll?.(selector) || [];
			},
			querySelector(el: any, selector: string) {
				return el.querySelector?.(selector) || null;
			},
		},
		config: {},
	};
}

describe('likertChoiceExtractor', () => {
	describe('canHandle', () => {
		test('returns true for choiceInteraction with likertChoice children', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE">
					<likertChoice identifier="A">Strongly Disagree</likertChoice>
					<likertChoice identifier="B">Disagree</likertChoice>
					<likertChoice identifier="C">Neutral</likertChoice>
					<likertChoice identifier="D">Agree</likertChoice>
					<likertChoice identifier="E">Strongly Agree</likertChoice>
				</choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			expect(likertChoiceExtractor.canHandle(element, context)).toBe(true);
		});

		test('returns false for standard choiceInteraction', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE">
					<simpleChoice identifier="A">Option A</simpleChoice>
					<simpleChoice identifier="B">Option B</simpleChoice>
				</choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			expect(likertChoiceExtractor.canHandle(element, context)).toBe(false);
		});

		test('returns false for other interaction types', () => {
			const xml = `<textEntryInteraction responseIdentifier="RESPONSE" />`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			expect(likertChoiceExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('extract', () => {
		test('extracts 5-point agreement scale', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE">
					<prompt>How much do you agree with this statement?</prompt>
					<likertChoice identifier="strongly_disagree">Strongly Disagree</likertChoice>
					<likertChoice identifier="disagree">Disagree</likertChoice>
					<likertChoice identifier="neutral">Neutral</likertChoice>
					<likertChoice identifier="agree">Agree</likertChoice>
					<likertChoice identifier="strongly_agree">Strongly Agree</likertChoice>
				</choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			const result = likertChoiceExtractor.extract(element, context);

			expect(result.choices).toHaveLength(5);
			expect(result.shuffle).toBe(false);
			expect(result.maxChoices).toBe(1);
			expect(result.prompt).toBe('How much do you agree with this statement?');
			expect(result.metadata.isLikert).toBe(true);
			expect(result.metadata.scalePoints).toBe(5);
			expect(result.metadata.scaleType).toBe('agreement');

			// Check first choice
			expect(result.choices[0]).toEqual({
				identifier: 'strongly_disagree',
				text: 'Strongly Disagree',
				classes: ['likert-choice'],
				fixed: true,
				metadata: {
					likertIndex: 0,
					scalePoints: 5,
					scaleType: 'agreement',
				},
			});
		});

		test('extracts 7-point scale', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE"><likertChoice identifier="1">Strongly Disagree</likertChoice><likertChoice identifier="2">Disagree</likertChoice><likertChoice identifier="3">Somewhat Disagree</likertChoice><likertChoice identifier="4">Neutral</likertChoice><likertChoice identifier="5">Somewhat Agree</likertChoice><likertChoice identifier="6">Agree</likertChoice><likertChoice identifier="7">Strongly Agree</likertChoice></choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			const result = likertChoiceExtractor.extract(element, context);

			expect(result.choices).toHaveLength(7);
			expect(result.metadata.scalePoints).toBe(7);
			expect(result.metadata.scaleType).toBe('agreement');
		});

		test('detects frequency scale type', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE"><likertChoice identifier="never">Never</likertChoice><likertChoice identifier="rarely">Rarely</likertChoice><likertChoice identifier="sometimes">Sometimes</likertChoice><likertChoice identifier="often">Often</likertChoice><likertChoice identifier="always">Always</likertChoice></choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			const result = likertChoiceExtractor.extract(element, context);

			expect(result.metadata.scaleType).toBe('frequency');
		});

		test('detects satisfaction scale type', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE"><likertChoice identifier="very_dissatisfied">Very Dissatisfied</likertChoice><likertChoice identifier="dissatisfied">Dissatisfied</likertChoice><likertChoice identifier="neutral">Neutral</likertChoice><likertChoice identifier="satisfied">Satisfied</likertChoice><likertChoice identifier="very_satisfied">Very Satisfied</likertChoice></choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			const result = likertChoiceExtractor.extract(element, context);

			expect(result.metadata.scaleType).toBe('satisfaction');
		});

		test('detects quality scale type', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE"><likertChoice identifier="poor">Poor</likertChoice><likertChoice identifier="fair">Fair</likertChoice><likertChoice identifier="good">Good</likertChoice><likertChoice identifier="excellent">Excellent</likertChoice></choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			const result = likertChoiceExtractor.extract(element, context);

			expect(result.metadata.scaleType).toBe('quality');
		});

		test('uses default labels for empty likertChoice elements (5-point)', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE"><likertChoice identifier="1"></likertChoice><likertChoice identifier="2"></likertChoice><likertChoice identifier="3"></likertChoice><likertChoice identifier="4"></likertChoice><likertChoice identifier="5"></likertChoice></choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			const result = likertChoiceExtractor.extract(element, context);

			expect(result.choices[0].text).toBe('Strongly Disagree');
			expect(result.choices[1].text).toBe('Disagree');
			expect(result.choices[2].text).toBe('Neutral');
			expect(result.choices[3].text).toBe('Agree');
			expect(result.choices[4].text).toBe('Strongly Agree');
		});

		test('uses default labels for empty likertChoice elements (3-point)', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE"><likertChoice identifier="1"></likertChoice><likertChoice identifier="2"></likertChoice><likertChoice identifier="3"></likertChoice></choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			const result = likertChoiceExtractor.extract(element, context);

			expect(result.choices[0].text).toBe('Disagree');
			expect(result.choices[1].text).toBe('Neutral');
			expect(result.choices[2].text).toBe('Agree');
		});

		test('handles interaction without prompt', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE"><likertChoice identifier="A">Strongly Disagree</likertChoice><likertChoice identifier="B">Agree</likertChoice></choiceInteraction>`;
			const element = parse(xml).firstChild;
			const context = createContext(element);

			const result = likertChoiceExtractor.extract(element, context);

			expect(result.prompt).toBeNull();
		});
	});

	describe('validate', () => {
		test('passes validation for valid 5-point scale', () => {
			const data = {
				choices: Array.from({ length: 5 }, (_, i) => ({
					identifier: `choice_${i}`,
					text: `Choice ${i}`,
					classes: ['likert-choice'],
					fixed: true,
					metadata: {
						likertIndex: i,
						scalePoints: 5,
						scaleType: 'agreement' as const,
					},
				})),
				shuffle: false,
				maxChoices: 1,
				prompt: 'Test prompt',
				metadata: {
					isLikert: true as const,
					scalePoints: 5,
					scaleType: 'agreement',
				},
			};

			const result = likertChoiceExtractor.validate(data);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		test('fails validation for scale with only 1 choice', () => {
			const data = {
				choices: [
					{
						identifier: 'choice_0',
						text: 'Only Choice',
						classes: ['likert-choice'],
						fixed: true,
						metadata: {
							likertIndex: 0,
							scalePoints: 1,
							scaleType: 'agreement' as const,
						},
					},
				],
				shuffle: false,
				maxChoices: 1,
				prompt: null,
				metadata: {
					isLikert: true as const,
					scalePoints: 1,
					scaleType: 'agreement',
				},
			};

			const result = likertChoiceExtractor.validate(data);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Likert scale must have at least 2 choices');
		});

		test('warns for scale with more than 7 choices', () => {
			const data = {
				choices: Array.from({ length: 10 }, (_, i) => ({
					identifier: `choice_${i}`,
					text: `Choice ${i}`,
					classes: ['likert-choice'],
					fixed: true,
					metadata: {
						likertIndex: i,
						scalePoints: 10,
						scaleType: 'agreement' as const,
					},
				})),
				shuffle: false,
				maxChoices: 1,
				prompt: null,
				metadata: {
					isLikert: true as const,
					scalePoints: 10,
					scaleType: 'agreement',
				},
			};

			const result = likertChoiceExtractor.validate(data);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Likert scale should have at most 7 choices (got 10)');
		});

		test('fails validation if shuffle is true', () => {
			const data = {
				choices: Array.from({ length: 5 }, (_, i) => ({
					identifier: `choice_${i}`,
					text: `Choice ${i}`,
					classes: ['likert-choice'],
					fixed: true,
					metadata: {
						likertIndex: i,
						scalePoints: 5,
						scaleType: 'agreement' as const,
					},
				})),
				shuffle: true, // INVALID
				maxChoices: 1,
				prompt: null,
				metadata: {
					isLikert: true as const,
					scalePoints: 5,
					scaleType: 'agreement',
				},
			};

			const result = likertChoiceExtractor.validate(data);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Likert scales should not shuffle choices');
		});

		test('fails validation if maxChoices is not 1', () => {
			const data = {
				choices: Array.from({ length: 5 }, (_, i) => ({
					identifier: `choice_${i}`,
					text: `Choice ${i}`,
					classes: ['likert-choice'],
					fixed: true,
					metadata: {
						likertIndex: i,
						scalePoints: 5,
						scaleType: 'agreement' as const,
					},
				})),
				shuffle: false,
				maxChoices: 3, // INVALID
				prompt: null,
				metadata: {
					isLikert: true as const,
					scalePoints: 5,
					scaleType: 'agreement',
				},
			};

			const result = likertChoiceExtractor.validate(data);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Likert scales should have maxChoices=1 (single selection)');
		});

		test('fails validation if choice is missing identifier', () => {
			const data = {
				choices: [
					{
						identifier: 'choice_0',
						text: 'Choice 0',
						classes: ['likert-choice'],
						fixed: true,
						metadata: {
							likertIndex: 0,
							scalePoints: 2,
							scaleType: 'agreement' as const,
						},
					},
					{
						identifier: '', // INVALID
						text: 'Choice 1',
						classes: ['likert-choice'],
						fixed: true,
						metadata: {
							likertIndex: 1,
							scalePoints: 2,
							scaleType: 'agreement' as const,
						},
					},
				],
				shuffle: false,
				maxChoices: 1,
				prompt: null,
				metadata: {
					isLikert: true as const,
					scalePoints: 2,
					scaleType: 'agreement',
				},
			};

			const result = likertChoiceExtractor.validate(data);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Choice at index 1 is missing an identifier');
		});
	});

	describe('priority and metadata', () => {
		test('has priority 500 (vendor-specific)', () => {
			expect(likertChoiceExtractor.priority).toBe(500);
		});

		test('has correct id and name', () => {
			expect(likertChoiceExtractor.id).toBe('acme:likert-choice');
			expect(likertChoiceExtractor.name).toBe('ACME Likert Scale Choice');
		});

		test('handles choiceInteraction element type', () => {
			expect(likertChoiceExtractor.elementTypes).toContain('choiceInteraction');
		});
	});
});
