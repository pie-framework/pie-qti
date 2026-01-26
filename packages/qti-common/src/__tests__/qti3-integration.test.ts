import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { createQtiParser, isQti3 } from '../parser-factory.js';
import { getAttribute, getBooleanAttribute, getNumberAttribute } from '../xml/index.js';

function loadFixture(filename: string): string {
	const path = join(__dirname, 'fixtures', filename);
	return readFileSync(path, 'utf-8');
}

function parseXml(xml: string): Document {
	const parser = new DOMParser();
	return parser.parseFromString(xml, 'text/xml');
}

describe('QTI 3.0 Integration Tests', () => {
	describe('Version Detection', () => {
		it('should detect QTI 3.0 from choice interaction fixture', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			expect(isQti3(xml)).toBe(true);

			const { version, mapper } = createQtiParser(xml);
			expect(version).toBe('3.0');
			expect(mapper.version).toBe('3.0');
		});

		it('should detect QTI 3.0 from match interaction fixture', () => {
			const xml = loadFixture('qti3-match-interaction.xml');
			expect(isQti3(xml)).toBe(true);
		});

		it('should detect QTI 3.0 from text entry fixture', () => {
			const xml = loadFixture('qti3-text-entry.xml');
			expect(isQti3(xml)).toBe(true);
		});
	});

	describe('Element Name Mapping', () => {
		it('should map qti-choice-interaction to canonical form', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			const { mapper } = createQtiParser(xml);

			expect(mapper.toCanonical('qti-choice-interaction')).toBe('choiceinteraction');
			expect(mapper.toCanonical('qti-simple-choice')).toBe('simplechoice');
			expect(mapper.toCanonical('qti-response-declaration')).toBe('responsedeclaration');
			expect(mapper.toCanonical('qti-item-body')).toBe('itembody');
		});

		it('should map canonical names back to QTI 3.0 format', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			const { mapper } = createQtiParser(xml);

			expect(mapper.toNative('choiceinteraction')).toBe('qti-choice-interaction');
			expect(mapper.toNative('simplechoice')).toBe('qti-simple-choice');
			expect(mapper.toNative('responsedeclaration')).toBe('qti-response-declaration');
			expect(mapper.toNative('itembody')).toBe('qti-item-body');
		});

		it('should map match interaction elements', () => {
			const xml = loadFixture('qti3-match-interaction.xml');
			const { mapper } = createQtiParser(xml);

			expect(mapper.toCanonical('qti-match-interaction')).toBe('matchinteraction');
			expect(mapper.toCanonical('qti-simple-match-set')).toBe('simplematchset');
			expect(mapper.toCanonical('qti-simple-associable-choice')).toBe('simpleassociablechoice');
		});

		it('should map text entry elements', () => {
			const xml = loadFixture('qti3-text-entry.xml');
			const { mapper } = createQtiParser(xml);

			expect(mapper.toCanonical('qti-text-entry-interaction')).toBe('textentryinteraction');
		});

		it('should map extended text elements', () => {
			const xml = loadFixture('qti3-extended-text.xml');
			const { mapper } = createQtiParser(xml);

			expect(mapper.toCanonical('qti-extended-text-interaction')).toBe('extendedtextinteraction');
		});

		it('should map response processing elements', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			const { mapper } = createQtiParser(xml);

			expect(mapper.toCanonical('qti-response-processing')).toBe('responseprocessing');
			expect(mapper.toCanonical('qti-response-condition')).toBe('responsecondition');
			expect(mapper.toCanonical('qti-response-if')).toBe('responseif');
			expect(mapper.toCanonical('qti-response-else')).toBe('responseelse');
			expect(mapper.toCanonical('qti-set-outcome-value')).toBe('setoutcomevalue');
			expect(mapper.toCanonical('qti-match')).toBe('match');
			expect(mapper.toCanonical('qti-variable')).toBe('variable');
			expect(mapper.toCanonical('qti-correct')).toBe('correct');
			expect(mapper.toCanonical('qti-base-value')).toBe('basevalue');
		});
	});

	describe('Attribute Handling', () => {
		it('should handle kebab-case attributes in QTI 3.0', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			const doc = parseXml(xml);
			const responseDecls = doc.getElementsByTagName('qti-response-declaration');

			expect(responseDecls.length).toBeGreaterThan(0);
			const responseDecl = responseDecls[0];
			if (responseDecl) {
				// QTI 3.0 uses kebab-case: base-type
				expect(getAttribute(responseDecl, 'base-type')).toBe('identifier');
				expect(getAttribute(responseDecl, 'cardinality')).toBe('single');
				expect(getAttribute(responseDecl, 'identifier')).toBe('RESPONSE');

				// Smart accessor should also find by camelCase
				expect(getAttribute(responseDecl, 'baseType')).toBe('identifier');
			}
		});

		it('should handle kebab-case attributes in choice interaction', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			const doc = parseXml(xml);
			const interactions = doc.getElementsByTagName('qti-choice-interaction');
			const interaction = interactions[0];

			expect(interaction).toBeDefined();
			if (interaction) {
				// QTI 3.0: response-identifier, max-choices
				expect(getAttribute(interaction, 'response-identifier')).toBe('RESPONSE');
				expect(getNumberAttribute(interaction, 'max-choices', 0)).toBe(1);
				expect(getBooleanAttribute(interaction, 'shuffle')).toBe(false);

				// Smart accessor should also find by camelCase
				expect(getAttribute(interaction, 'responseIdentifier')).toBe('RESPONSE');
				expect(getNumberAttribute(interaction, 'maxChoices', 0)).toBe(1);
			}
		});

		it('should handle attributes in match interaction', () => {
			const xml = loadFixture('qti3-match-interaction.xml');
			const doc = parseXml(xml);
			const interactions = doc.getElementsByTagName('qti-match-interaction');
			const interaction = interactions[0];

			expect(interaction).toBeDefined();
			if (interaction) {
				expect(getAttribute(interaction, 'response-identifier')).toBe('RESPONSE');
				expect(getNumberAttribute(interaction, 'max-associations', 0)).toBe(3);
				expect(getBooleanAttribute(interaction, 'shuffle')).toBe(false);

				// Try camelCase
				expect(getAttribute(interaction, 'responseIdentifier')).toBe('RESPONSE');
				expect(getNumberAttribute(interaction, 'maxAssociations', 0)).toBe(3);
			}
		});

		it('should handle attributes in extended text interaction', () => {
			const xml = loadFixture('qti3-extended-text.xml');
			const doc = parseXml(xml);
			const interactions = doc.getElementsByTagName('qti-extended-text-interaction');
			const interaction = interactions[0];

			expect(interaction).toBeDefined();
			if (interaction) {
				expect(getAttribute(interaction, 'response-identifier')).toBe('RESPONSE');
				expect(getNumberAttribute(interaction, 'expected-lines', 0)).toBe(10);
				expect(getNumberAttribute(interaction, 'expected-length', 0)).toBe(500);
				expect(getAttribute(interaction, 'format')).toBe('plain');

				// Try camelCase
				expect(getAttribute(interaction, 'responseIdentifier')).toBe('RESPONSE');
				expect(getNumberAttribute(interaction, 'expectedLines', 0)).toBe(10);
				expect(getNumberAttribute(interaction, 'expectedLength', 0)).toBe(500);
			}
		});
	});

	describe('Response Processing', () => {
		it('should parse response processing structure', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			const doc = parseXml(xml);
			const { mapper } = createQtiParser(xml);

			const responseProcessings = doc.getElementsByTagName('qti-response-processing');
			expect(responseProcessings.length).toBeGreaterThan(0);
			const responseProcessing = responseProcessings[0];

			if (responseProcessing) {
				const conditions = responseProcessing.getElementsByTagName('qti-response-condition');
				expect(conditions.length).toBeGreaterThan(0);

				const responseIfs = responseProcessing.getElementsByTagName('qti-response-if');
				expect(responseIfs.length).toBeGreaterThan(0);

				const matches = responseProcessing.getElementsByTagName('qti-match');
				expect(matches.length).toBeGreaterThan(0);

				const setOutcomes = responseProcessing.getElementsByTagName('qti-set-outcome-value');
				expect(setOutcomes.length).toBeGreaterThan(0);
				const setOutcome = setOutcomes[0];
				if (setOutcome) {
					expect(getAttribute(setOutcome, 'identifier')).toBe('SCORE');
				}
			}
		});

		it('should verify element names map correctly in response processing', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			const { mapper } = createQtiParser(xml);

			// Verify all response processing elements can be mapped
			const elements = [
				'qti-response-processing',
				'qti-response-condition',
				'qti-response-if',
				'qti-response-else',
				'qti-match',
				'qti-variable',
				'qti-correct',
				'qti-set-outcome-value',
				'qti-base-value',
			];

			for (const element of elements) {
				const canonical = mapper.toCanonical(element);
				expect(canonical).toBeTruthy();
				expect(canonical).not.toContain('qti-');
				expect(canonical).not.toContain('-');

				// Verify round-trip
				const native = mapper.toNative(canonical);
				expect(native).toBe(element);
			}
		});
	});

	describe('Feedback Elements', () => {
		it('should handle modal feedback elements', () => {
			const xml = loadFixture('qti3-choice-single.xml');
			const doc = parseXml(xml);
			const { mapper } = createQtiParser(xml);

			const feedbacks = doc.getElementsByTagName('qti-modal-feedback');
			expect(feedbacks.length).toBeGreaterThan(0);

			const feedback = feedbacks[0];
			if (feedback) {
				expect(getAttribute(feedback, 'outcome-identifier')).toBe('SCORE');
				expect(getAttribute(feedback, 'show-hide')).toBe('show');

				// Try camelCase
				expect(getAttribute(feedback, 'outcomeIdentifier')).toBe('SCORE');
				expect(getAttribute(feedback, 'showHide')).toBe('show');
			}

			// Verify element name mapping
			expect(mapper.toCanonical('qti-modal-feedback')).toBe('modalfeedback');
			expect(mapper.toCanonical('qti-content-body')).toBe('contentbody');
		});
	});

	describe('Multiple Cardinality', () => {
		it('should handle multiple cardinality response declaration', () => {
			const xml = loadFixture('qti3-choice-multiple.xml');
			const doc = parseXml(xml);

			const responseDecls = doc.getElementsByTagName('qti-response-declaration');
			expect(responseDecls.length).toBeGreaterThan(0);
			const responseDecl = responseDecls[0];

			if (responseDecl) {
				expect(getAttribute(responseDecl, 'cardinality')).toBe('multiple');
				expect(getAttribute(responseDecl, 'base-type')).toBe('identifier');

				const correctResponses = responseDecl.getElementsByTagName('qti-correct-response');
				expect(correctResponses.length).toBeGreaterThan(0);
				const correctResponse = correctResponses[0];

				if (correctResponse) {
					const values = correctResponse.getElementsByTagName('qti-value');
					expect(values.length).toBe(2);
				}
			}
		});
	});

	describe('Ordered Cardinality', () => {
		it('should handle ordered cardinality in order interaction', () => {
			const xml = loadFixture('qti3-order-interaction.xml');
			const doc = parseXml(xml);

			const responseDecls = doc.getElementsByTagName('qti-response-declaration');
			expect(responseDecls.length).toBeGreaterThan(0);
			const responseDecl = responseDecls[0];

			if (responseDecl) {
				expect(getAttribute(responseDecl, 'cardinality')).toBe('ordered');
				expect(getAttribute(responseDecl, 'base-type')).toBe('identifier');
			}

			const interactions = doc.getElementsByTagName('qti-order-interaction');
			expect(interactions.length).toBeGreaterThan(0);
			const interaction = interactions[0];

			if (interaction) {
				expect(getNumberAttribute(interaction, 'max-choices', 0)).toBe(4);
				expect(getNumberAttribute(interaction, 'min-choices', 0)).toBe(4);
				expect(getBooleanAttribute(interaction, 'shuffle')).toBe(true);
			}
		});
	});
});
