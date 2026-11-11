/**
 * String comparison in response processing. QTI compares `string` values for equality: `match` is
 * true "if the two expressions represent the same value" (QTI 3.0 §6.9.21), `member` if the value
 * "is in the container" (§6.9.33) and `contains` if the first container contains the second
 * (§6.9.25). Case folds only where the content asks for it: `stringMatch` with
 * `case-sensitive="false"` (§5.138.1) and a `mapEntry` whose `case-sensitive` is false, its default
 * (§7.21.3).
 *
 * Two values that differ only in Unicode canonical equivalence compare equal: QTI is silent on
 * normalization, and Unicode conformance clause C6 says canonically equivalent sequences must not
 * be treated as distinct. Everything else that folds — script input marks, presentation forms,
 * script digits, Arabic letter variants — is the delivery option `stringComparison`, set by the
 * host, and is off by default.
 */

import { describe, expect, it } from 'bun:test';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { StringComparisonOptions } from '../src/runtime/normalize.js';
import type { Cardinality, DeclarationMap, Mapping, QtiValue } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

interface Delivery {
	language?: string;
	stringComparison?: StringComparisonOptions;
}

function response(value: unknown, cardinality: Cardinality = 'single', mapping?: Mapping): DeclarationMap {
	const current = qtiValue('string', cardinality, value);
	return {
		RESPONSE: { identifier: 'RESPONSE', baseType: 'string', cardinality, defaultValue: current, value: current, mapping },
	};
}

function evaluate(xml: string, decls: DeclarationMap, delivery: Delivery = {}): QtiValue {
	const expression = buildExpression(parseXml(xml).documentElement);
	return evalExpr({ ctx: new DeclarationContext(decls), rng: () => 0.5, ...delivery }, expression);
}

const text = (value: string): string => `<baseValue baseType="string">${value}</baseValue>`;
const RESPONSE = '<variable identifier="RESPONSE"/>';
const yes = qtiValue('boolean', 'single', true);
const no = qtiValue('boolean', 'single', false);

const KITAB = '\u0643\u062A\u0627\u0628'; // كتاب
const FOLD_SCRIPT_INPUT: StringComparisonOptions = { foldScriptInput: true };

/** Typed forms of an authored answer that only the script-input fold makes equal to it. */
const SCRIPT_INPUT_FORMS: Array<[string, string, string]> = [
	['tatweel', '\u0643\u0640\u0640\u062A\u0627\u0628', KITAB],
	['a right-to-left mark', `\u200F${KITAB}`, KITAB],
	['a left-to-right mark', `${KITAB}\u200E`, KITAB],
	['an isolate around the word', `\u2067${KITAB}\u2069`, KITAB],
	['Arabic presentation forms', '\uFEDB\uFE98\uFE8E\uFE8F', KITAB],
	['Arabic-Indic digits', '\u0663', '3'],
	['Extended Arabic-Indic digits', '\u06F1\u06F2', '12'],
	['the Arabic decimal separator', '\u0663\u066B\u0665', '3.5'],
];

/** Text whose NFC and NFD encodings differ, typed decomposed against the composed authored form. */
const CANONICAL_FORMS: Array<[string, string, string]> = [
	['e with a combining acute accent', 'caf\u0065\u0301', 'caf\u00E9'],
	['alef with a combining madda', '\u0627\u0653\u0645\u0646\u0629', '\u0622\u0645\u0646\u0629'],
];

const expressions = {
	match: (authored: string) => `<match>${RESPONSE}${text(authored)}</match>`,
	member: (authored: string) => `<member>${text(authored)}${RESPONSE}</member>`,
	contains: (authored: string) => `<contains>${RESPONSE}<multiple>${text(authored)}</multiple></contains>`,
};

const cardinalityOf = (operator: keyof typeof expressions): Cardinality => (operator === 'match' ? 'single' : 'multiple');
const typedValue = (operator: keyof typeof expressions, typed: string): unknown => (operator === 'match' ? typed : [typed]);

describe.each(Object.keys(expressions) as Array<keyof typeof expressions>)('%s on string values', (operator) => {
	const compare = (typed: string, authored: string, delivery?: Delivery) =>
		evaluate(expressions[operator](authored), response(typedValue(operator, typed), cardinalityOf(operator)), delivery);

	describe('by default, compares the exact values', () => {
		for (const [name, typed, authored] of SCRIPT_INPUT_FORMS) {
			it(`does not match a value typed with ${name}`, () => {
				expect(compare(typed, authored)).toEqual(no);
				expect(compare(typed, authored, { language: 'ar' })).toEqual(no);
			});
		}

		for (const [name, typed, authored] of CANONICAL_FORMS) {
			it(`matches ${name}, typed decomposed`, () => {
				expect(compare(typed, authored)).toEqual(yes);
			});
		}

		it('does not fold case', () => {
			expect(compare('paris', 'Paris')).toEqual(no);
			expect(compare('Paris', 'Paris')).toEqual(yes);
		});
	});

	describe('with stringComparison.foldScriptInput', () => {
		for (const [name, typed, authored] of SCRIPT_INPUT_FORMS) {
			it(`matches a value typed with ${name}`, () => {
				expect(compare(typed, authored, { language: 'ar', stringComparison: FOLD_SCRIPT_INPUT })).toEqual(yes);
			});
		}

		it('still does not fold case or Arabic letter variants', () => {
			expect(compare('paris', 'Paris', { stringComparison: FOLD_SCRIPT_INPUT })).toEqual(no);
			expect(compare('\u0627\u062D\u0645\u062F', '\u0623\u062D\u0645\u062F', { stringComparison: FOLD_SCRIPT_INPUT })).toEqual(no);
		});
	});

	it('folds Arabic letter variants with stringComparison.foldLetterVariants', () => {
		const delivery: Delivery = { stringComparison: { foldLetterVariants: true } };
		// أحمد typed احمد, مدرسة typed مدرسه, إلى typed الي.
		expect(compare('\u0627\u062D\u0645\u062F', '\u0623\u062D\u0645\u062F', delivery)).toEqual(yes);
		expect(compare('\u0645\u062F\u0631\u0633\u0647', '\u0645\u062F\u0631\u0633\u0629', delivery)).toEqual(yes);
		expect(compare('\u0627\u0644\u064A', '\u0625\u0644\u0649', delivery)).toEqual(yes);
		expect(compare('\u0627\u062D\u0645\u062F', '\u0623\u062D\u0645\u062F')).toEqual(no);
	});
});

describe('mapResponse on string values', () => {
	const OUT_FLOAT = (value: QtiValue): number => Number((value as { value: number }).value);

	function mapped(typed: unknown, mapping: Mapping, delivery?: Delivery, cardinality: Cardinality = 'single'): number {
		return OUT_FLOAT(evaluate('<mapResponse identifier="RESPONSE"/>', response(typed, cardinality, mapping), delivery));
	}

	const entryFor = (mapKey: string, caseSensitive?: 'true' | 'false'): Mapping => ({
		defaultValue: 0,
		entries: { [mapKey]: { mapKey, mappedValue: 2, ...(caseSensitive ? { caseSensitive } : {}) } },
	});

	describe('by default, finds an entry by its exact key', () => {
		for (const [name, typed, authored] of SCRIPT_INPUT_FORMS) {
			it(`does not find the entry for a value typed with ${name}`, () => {
				expect(mapped(typed, entryFor(authored))).toBe(0);
				expect(mapped(typed, entryFor(authored, 'true'))).toBe(0);
			});
		}

		for (const [name, typed, authored] of CANONICAL_FORMS) {
			it(`finds the entry for ${name}, typed decomposed`, () => {
				expect(mapped(typed, entryFor(authored))).toBe(2);
				expect(mapped(typed, entryFor(authored, 'true'))).toBe(2);
			});
		}

		it('folds case only for an entry that is not case sensitive', () => {
			expect(mapped('PARIS', entryFor('Paris'))).toBe(2);
			expect(mapped('PARIS', entryFor('Paris', 'false'))).toBe(2);
			expect(mapped('PARIS', entryFor('Paris', 'true'))).toBe(0);
		});

		it('folds case in the content language', () => {
			expect(mapped('ISTANBUL', entryFor('İstanbul'), { language: 'tr' })).toBe(0);
			expect(mapped('istanbul', entryFor('İstanbul'), { language: 'tr' })).toBe(2);
			expect(mapped('ıstanbul', entryFor('Istanbul'), { language: 'tr' })).toBe(2);
		});

		it('counts values the mapping treats as one value once, and other values apart', () => {
			// QTI 3.0 §6.9.47: a value in a container more than once is counted once.
			const cities: Mapping = { defaultValue: 0.5, entries: { Paris: { mapKey: 'Paris', mappedValue: 1 } } };
			expect(mapped(['Paris', 'PARIS'], cities, undefined, 'multiple')).toBe(1);
			// Two different strings no entry matches are two values, each with the default.
			expect(mapped(['London', 'LONDON'], cities, undefined, 'multiple')).toBe(1);
			expect(mapped([KITAB, '\u0643\u0640\u062A\u0627\u0628'], entryFor(KITAB), undefined, 'multiple')).toBe(2);
		});
	});

	describe('with stringComparison.foldScriptInput', () => {
		for (const [name, typed, authored] of SCRIPT_INPUT_FORMS) {
			it(`finds the entry for a value typed with ${name}`, () => {
				const delivery: Delivery = { language: 'ar', stringComparison: FOLD_SCRIPT_INPUT };
				expect(mapped(typed, entryFor(authored), delivery)).toBe(2);
				expect(mapped(typed, entryFor(authored, 'true'), delivery)).toBe(2);
			});
		}

		it('counts the folded forms of one value once', () => {
			const delivery: Delivery = { language: 'ar', stringComparison: FOLD_SCRIPT_INPUT };
			expect(mapped([KITAB, '\u0643\u0640\u062A\u0627\u0628'], entryFor(KITAB), delivery, 'multiple')).toBe(2);
		});
	});
});

describe('stringMatch', () => {
	const stringMatch = (caseSensitive: boolean, authored: string) =>
		`<stringMatch caseSensitive="${caseSensitive}">${RESPONSE}${text(authored)}</stringMatch>`;
	const compare = (caseSensitive: boolean, typed: string, authored: string, delivery?: Delivery) =>
		evaluate(stringMatch(caseSensitive, authored), response(typed), delivery);

	it('folds case only when caseSensitive is false', () => {
		expect(compare(false, 'PARIS', 'Paris')).toEqual(yes);
		expect(compare(true, 'PARIS', 'Paris')).toEqual(no);
	});

	it('folds dotted and dotless i in the content language', () => {
		expect(compare(false, 'istanbul', 'İstanbul', { language: 'tr' })).toEqual(yes);
		expect(compare(false, 'ISTANBUL', 'İstanbul', { language: 'tr' })).toEqual(no);
		expect(compare(false, 'ISTANBUL', 'istanbul', { language: 'en' })).toEqual(yes);
	});

	it('matches canonically equivalent text', () => {
		for (const [, typed, authored] of CANONICAL_FORMS) {
			expect(compare(true, typed, authored)).toEqual(yes);
			expect(compare(false, typed, authored)).toEqual(yes);
		}
	});

	for (const [name, typed, authored] of SCRIPT_INPUT_FORMS) {
		it(`matches a value typed with ${name} only with stringComparison.foldScriptInput`, () => {
			expect(compare(false, typed, authored, { language: 'ar' })).toEqual(no);
			expect(compare(false, typed, authored, { language: 'ar', stringComparison: FOLD_SCRIPT_INPUT })).toEqual(yes);
		});
	}

	it('folds case and script input together when both apply', () => {
		expect(compare(false, '\u202BPARIS\u202C', 'Paris')).toEqual(no);
		expect(compare(false, '\u202BPARIS\u202C', 'Paris', { stringComparison: FOLD_SCRIPT_INPUT })).toEqual(yes);
	});
});

describe('patternMatch tests the string as entered', () => {
	const patternMatch = (pattern: string) => `<patternMatch pattern="${pattern}">${RESPONSE}</patternMatch>`;
	const every: Delivery[] = [{}, { language: 'ar', stringComparison: { foldScriptInput: true, foldLetterVariants: true } }];

	for (const delivery of every) {
		const label = delivery.stringComparison ? 'with every fold on' : 'by default';
		it(`${label}: the author's pattern sees the typed characters`, () => {
			expect(evaluate(patternMatch('[0-9]+'), response('\u0663'), delivery)).toEqual(no);
			expect(evaluate(patternMatch('[0-9]+'), response('3'), delivery)).toEqual(yes);
			expect(evaluate(patternMatch(KITAB), response('\u0643\u0640\u062A\u0627\u0628'), delivery)).toEqual(no);
			expect(evaluate(patternMatch(KITAB), response(KITAB), delivery)).toEqual(yes);
		});
	}
});
