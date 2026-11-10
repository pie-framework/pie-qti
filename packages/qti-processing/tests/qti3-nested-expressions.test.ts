/**
 * QTI 3.0 nested expressions: operators must hand their `options` — which carry the QTI 3
 * kebab-case name mapping — to every nested `buildExpression` call. A dropped argument falls
 * back to the QTI 2.x mapper, which cannot read `qti-*` tags, so e.g. a `<qti-variable>`
 * inside `<qti-integer-modulus>` failed with "Unknown processing expression tag". The
 * item-player validation golden surfaced this on the conformance fixtures converted to QTI 3.0.
 *
 * Two layers:
 * - the affected operators, compiled with the QTI 3 element mapper the item player passes and
 *   evaluated, with QTI 3 kebab-case children;
 * - a guard walking every expression tag the builder supports (one row per `buildExpression`
 *   switch case), spelled for QTI 3 and carrying `qti-variable` children wherever the element
 *   takes child expressions, asserting it compiles. A dropped `options` anywhere makes the
 *   nested `qti-variable` build throw.
 */

import { describe, expect, it } from 'bun:test';
import { Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import type { ProcessingScope } from '../src/ast/types.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

const mapper = new Qti3ElementNameMapper();

function evaluate(body: string, decls: DeclarationMap = {}): QtiValue {
	const expression = buildExpression(parseXml(body).documentElement, { elementNameMapper: mapper });
	return evalExpr({ ctx: new DeclarationContext(decls), ops: new OperatorRegistry(), rng: () => 0.5 }, expression);
}

function declared(identifier: string, baseType: 'integer' | 'float' | 'string', value: unknown): DeclarationMap {
	return {
		[identifier]: {
			identifier,
			baseType,
			cardinality: 'single',
			value: qtiValue(baseType, 'single', value),
		},
	};
}

describe('affected operators with QTI 3.0 kebab-case children', () => {
	it('qti-integer-modulus builds both operands with the QTI 3 mapper', () => {
		expect(
			evaluate(
				'<qti-integer-modulus><qti-variable identifier="A"/><qti-base-value base-type="integer">3</qti-base-value></qti-integer-modulus>',
				declared('A', 'integer', 7),
			),
		).toEqual(qtiValue('integer', 'single', 1));
	});

	it('qti-integer-to-float builds its operand', () => {
		expect(
			evaluate('<qti-integer-to-float><qti-variable identifier="A"/></qti-integer-to-float>', declared('A', 'integer', 7)),
		).toEqual(qtiValue('float', 'single', 7));
	});

	it('qti-round-to builds its value operand', () => {
		expect(
			evaluate(
				'<qti-round-to rounding-mode="decimalPlaces" figures="2"><qti-variable identifier="F"/></qti-round-to>',
				declared('F', 'float', 123.4567),
			),
		).toEqual(qtiValue('float', 'single', 123.46));
	});

	it('qti-substring builds its optional length operand', () => {
		expect(
			evaluate(
				'<qti-substring><qti-base-value base-type="string">ABCDE</qti-base-value><qti-base-value base-type="integer">2</qti-base-value><qti-variable identifier="LEN"/></qti-substring>',
				declared('LEN', 'integer', 2),
			),
		).toEqual(qtiValue('string', 'single', 'BC'));
	});

	it('qti-substring builds without a length operand', () => {
		expect(
			evaluate(
				'<qti-substring><qti-base-value base-type="string">ABCDE</qti-base-value><qti-variable identifier="LEN"/></qti-substring>',
				declared('LEN', 'integer', 2),
			),
		).toEqual(qtiValue('string', 'single', 'BCDE'));
	});

	it('record builds qti-field-value member values as the item player compiles them', () => {
		// The QTI 2 → 3 conversion keeps the record element itself unprefixed, while its
		// fieldValue members become qti-field-value; their member value is a nested expression.
		expect(
			evaluate(
				'<qti-field-value field-identifier="x"><record><qti-field-value field-identifier="x"><qti-variable identifier="A"/></qti-field-value><qti-field-value field-identifier="y"><qti-base-value base-type="string">B</qti-base-value></qti-field-value></record></qti-field-value>',
				declared('A', 'integer', 42),
			),
		).toEqual(qtiValue('integer', 'single', 42));
	});
});

// ---------------------------------------------------------------------------
// Guard: every expression tag the builder supports compiles on the QTI 3 path
// ---------------------------------------------------------------------------

const ONE = '<qti-variable identifier="A"/>';
const TWO = `${ONE}${ONE}`;

/** Test-level outcome processing expressions: the builder only accepts them at test scope. */
const TEST_LEVEL = new Set([
	'numbercorrect',
	'numberincorrect',
	'numberpresented',
	'numberresponded',
	'numberselected',
	'outcomemaximum',
	'outcomeminimum',
	'testvariables',
]);

/**
 * One row per `buildExpression` switch case: [canonical tag, attributes, body]. `mapper.toNative`
 * spells the QTI 3.0 element name; for the one tag the builder supports beyond the QTI 3.0 schema
 * (preCondition) it yields the bare canonical name, which the QTI 3 mapper passes through
 * unchanged — the same spelling the 2 → 3 conversion leaves such elements with. Every child
 * expression is spelled kebab-case, so a nested call that drops `options` throws.
 */
const GUARD: ReadonlyArray<readonly [tag: string, attrs: string, body: string]> = [
	['and', '', TWO],
	['anyn', 'min="1" max="2"', TWO],
	['basevalue', 'base-type="integer"', '1'],
	['containersize', '', ONE],
	['contains', '', TWO],
	['correct', 'identifier="A"', ''],
	['customoperator', 'definition="https://example.com/op"', ONE],
	['default', 'identifier="A"', ''],
	['delete', '', TWO],
	['divide', '', TWO],
	['durationgte', '', TWO],
	['durationlt', '', TWO],
	['equal', '', TWO],
	['equalrounded', 'figures="2"', TWO],
	['fieldvalue', 'field-identifier="x"', ONE],
	['gcd', '', TWO],
	['gt', '', TWO],
	['gte', '', TWO],
	['index', 'n="1"', ONE],
	['inside', 'shape="default"', ONE],
	['integerdivide', '', TWO],
	['integermodulus', '', TWO],
	['integertofloat', '', ONE],
	['isnull', '', ONE],
	['istypeof', '', TWO],
	['lcm', '', TWO],
	['lookuptable', '', `${ONE}<qti-match-table/>`],
	['lt', '', TWO],
	['lte', '', TWO],
	['mapresponse', 'identifier="RESPONSE"', ''],
	['mapresponsepoint', 'identifier="RESPONSE"', ''],
	['match', '', TWO],
	['mathconstant', 'name="pi"', ''],
	['mathoperator', 'name="ln"', ONE],
	['max', '', TWO],
	['member', '', TWO],
	['min', '', TWO],
	['multiple', '', TWO],
	['not', '', ONE],
	['null', '', ''],
	['numbercorrect', '', ''],
	['numberincorrect', '', ''],
	['numberpresented', '', ''],
	['numberresponded', '', ''],
	['numberselected', '', ''],
	['or', '', TWO],
	['ordered', '', TWO],
	['outcomemaximum', 'outcome-identifier="SCORE"', ''],
	['outcomeminimum', 'outcome-identifier="SCORE"', ''],
	['patternmatch', 'pattern=".*"', ONE],
	['power', '', TWO],
	['precondition', '', ONE],
	['product', '', TWO],
	['random', '', ONE],
	['randomfloat', 'max="1.0"', ''],
	['randominteger', 'max="10"', ''],
	['record', '', `<qti-field-value field-identifier="x">${ONE}</qti-field-value>`],
	['repeat', 'number-repeats="2"', ONE],
	['round', '', ONE],
	['roundto', 'rounding-mode="decimalPlaces" figures="2"', ONE],
	['statsoperator', 'name="mean"', ONE],
	['stringmatch', '', TWO],
	['substring', '', '<qti-base-value base-type="string">ABCDE</qti-base-value><qti-base-value base-type="integer">2</qti-base-value><qti-variable identifier="LEN"/>'],
	['subtract', '', TWO],
	['sum', '', TWO],
	['testvariables', 'variable-identifier="A"', ''],
	['truncate', '', ONE],
	['variable', 'identifier="A"', ''],
];

describe.each(GUARD)('qti3 path compiles %s', (tag, attrs, body) => {
	it('compiles with the QTI 3 element mapper', () => {
		const name = mapper.toNative(tag);
		const xml = `<${name}${attrs ? ` ${attrs}` : ''}>${body}</${name}>`;
		const scope: ProcessingScope = TEST_LEVEL.has(tag) ? 'test' : 'item';
		expect(() => buildExpression(parseXml(xml).documentElement, { elementNameMapper: mapper, scope })).not.toThrow();
	});
});
