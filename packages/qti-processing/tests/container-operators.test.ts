/**
 * Container operators (QTI ASI §15.3, carried unchanged to QTI 2.2 and 3.0): contains, delete,
 * multiple and ordered, read from XML so the builder's operand roles are exercised with the
 * evaluator.
 */

import { describe, expect, it } from 'bun:test';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { BaseType, Cardinality, DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function declaration(identifier: string, baseType: BaseType, cardinality: Cardinality, value: QtiValue): DeclarationMap[string] {
	return { identifier, baseType, cardinality, defaultValue: value, value };
}

function evaluate(xml: string, decls: DeclarationMap = {}): QtiValue {
	const expression = buildExpression(parseXml(xml).documentElement);
	return evalExpr({ ctx: new DeclarationContext(decls), rng: () => 0.5 }, expression);
}

const id = (text: string): string => `<baseValue baseType="identifier">${text}</baseValue>`;
const multiple = (...values: string[]): string => `<multiple>${values.map(id).join('')}</multiple>`;
const ordered = (...values: string[]): string => `<ordered>${values.map(id).join('')}</ordered>`;
const variable = (identifier: string): string => `<variable identifier="${identifier}"/>`;

const BOOLEAN_NULL = { kind: 'null', baseType: 'boolean', cardinality: 'single' };
const yes = qtiValue('boolean', 'single', true);
const no = qtiValue('boolean', 'single', false);

/** Declarations for NULL operands: a NULL variable and an unanswered (empty) container. */
const NULL_DECLS: DeclarationMap = {
	NOTHING: declaration('NOTHING', 'identifier', 'multiple', qtiNull('identifier', 'multiple')),
	EMPTY: declaration('EMPTY', 'identifier', 'multiple', qtiValue('identifier', 'multiple', [])),
};

describe('contains', () => {
	describe('multiple containers: every value of the second, counted, is in the first', () => {
		const cases: Array<[string, string, string, QtiValue]> = [
			['[A,B,C] contains [C,A] (order is irrelevant)', multiple('A', 'B', 'C'), multiple('C', 'A'), yes],
			['[A,B,C] contains [A,B]', multiple('A', 'B', 'C'), multiple('A', 'B'), yes],
			['[A,B,C] contains itself', multiple('A', 'B', 'C'), multiple('C', 'B', 'A'), yes],
			['[A,B,C] does not contain [B,B]', multiple('A', 'B', 'C'), multiple('B', 'B'), no],
			['[A,B,B,C] contains [B,B]', multiple('A', 'B', 'B', 'C'), multiple('B', 'B'), yes],
			['[A,B] does not contain [A,D]', multiple('A', 'B'), multiple('A', 'D'), no],
			['[A,B] does not contain [A,B,C]', multiple('A', 'B'), multiple('A', 'B', 'C'), no],
		];
		for (const [name, first, second, expected] of cases) {
			it(name, () => {
				expect(evaluate(`<contains>${first}${second}</contains>`)).toEqual(expected);
			});
		}
	});

	describe('ordered containers: the second is a contiguous sub-sequence of the first', () => {
		const cases: Array<[string, string, string, QtiValue]> = [
			['[A,B,C] contains [B,C]', ordered('A', 'B', 'C'), ordered('B', 'C'), yes],
			['[A,B,C] contains [A,B]', ordered('A', 'B', 'C'), ordered('A', 'B'), yes],
			['[A,B,C] contains itself', ordered('A', 'B', 'C'), ordered('A', 'B', 'C'), yes],
			['[A,B,C] does not contain [C,A] (order matters)', ordered('A', 'B', 'C'), ordered('C', 'A'), no],
			['[A,B,C] does not contain [A,C] (not contiguous)', ordered('A', 'B', 'C'), ordered('A', 'C'), no],
			['[A,B,C] does not contain [B,C,D]', ordered('A', 'B', 'C'), ordered('B', 'C', 'D'), no],
			['[A,B,A,C] contains [A,C] after a partial match', ordered('A', 'B', 'A', 'C'), ordered('A', 'C'), yes],
		];
		for (const [name, first, second, expected] of cases) {
			it(name, () => {
				expect(evaluate(`<contains>${first}${second}</contains>`)).toEqual(expected);
			});
		}
	});

	it('compares pairs without regard to the order of their two identifiers', () => {
		const decls: DeclarationMap = {
			RESPONSE: declaration('RESPONSE', 'pair', 'multiple', qtiValue('pair', 'multiple', ['A B', 'C D'])),
		};
		const second = '<multiple><baseValue baseType="pair">D C</baseValue></multiple>';
		expect(evaluate(`<contains>${variable('RESPONSE')}${second}</contains>`, decls)).toEqual(yes);
	});

	it('reads a single value as a container of that one value', () => {
		expect(evaluate(`<contains>${multiple('A', 'B', 'C')}${id('B')}</contains>`)).toEqual(yes);
		expect(evaluate(`<contains>${multiple('A', 'B', 'C')}${id('D')}</contains>`)).toEqual(no);
		expect(evaluate(`<contains>${ordered('A', 'B', 'C')}${id('C')}</contains>`)).toEqual(yes);
		expect(evaluate(`<contains>${id('A')}${multiple('A')}</contains>`)).toEqual(yes);
		expect(evaluate(`<contains>${id('A')}${multiple('A', 'B')}</contains>`)).toEqual(no);
	});

	it('is NULL when either sub-expression is NULL', () => {
		expect(evaluate(`<contains>${variable('NOTHING')}${multiple('A')}</contains>`, NULL_DECLS)).toEqual(BOOLEAN_NULL);
		expect(evaluate(`<contains>${multiple('A')}${variable('NOTHING')}</contains>`, NULL_DECLS)).toEqual(BOOLEAN_NULL);
		expect(evaluate(`<contains>${multiple('A')}<null/></contains>`)).toEqual(BOOLEAN_NULL);
	});

	it('reads an empty container as NULL', () => {
		expect(evaluate(`<contains>${variable('EMPTY')}${multiple('A')}</contains>`, NULL_DECLS)).toEqual(BOOLEAN_NULL);
		expect(evaluate(`<contains>${multiple('A')}${variable('EMPTY')}</contains>`, NULL_DECLS)).toEqual(BOOLEAN_NULL);
	});

	it('is invalid for containers of different cardinality', () => {
		expect(evaluate(`<contains>${multiple('A', 'B')}${ordered('A')}</contains>`).kind).toBe('invalid');
		expect(evaluate(`<contains>${ordered('A', 'B')}${multiple('A')}</contains>`).kind).toBe('invalid');
	});
});

describe('delete', () => {
	// QTI: "The first sub-expression must have single cardinality and the second must be a multiple
	// or ordered container ... when applied to A and {B,A,C,A} the result is the container {B,C}."
	it('removes every instance of the first sub-expression from the second (the specification example)', () => {
		expect(evaluate(`<delete>${id('A')}${multiple('B', 'A', 'C', 'A')}</delete>`)).toEqual(
			qtiValue('identifier', 'multiple', ['B', 'C']),
		);
	});

	it('keeps the order of an ordered container', () => {
		expect(evaluate(`<delete>${id('A')}${ordered('C', 'A', 'B', 'A')}</delete>`)).toEqual(
			qtiValue('identifier', 'ordered', ['C', 'B']),
		);
	});

	it('keeps repeated values other than the deleted one', () => {
		expect(evaluate(`<delete>${id('A')}${multiple('B', 'A', 'B')}</delete>`)).toEqual(
			qtiValue('identifier', 'multiple', ['B', 'B']),
		);
	});

	it('returns the container unchanged when the value is not in it', () => {
		expect(evaluate(`<delete>${id('D')}${multiple('B', 'A', 'C')}</delete>`)).toEqual(
			qtiValue('identifier', 'multiple', ['B', 'A', 'C']),
		);
	});

	it('reads a response variable as the container', () => {
		const decls: DeclarationMap = {
			RESPONSE: declaration('RESPONSE', 'identifier', 'ordered', qtiValue('identifier', 'ordered', ['A', 'B', 'B', 'C'])),
		};
		expect(evaluate(`<delete>${id('B')}${variable('RESPONSE')}</delete>`, decls)).toEqual(
			qtiValue('identifier', 'ordered', ['A', 'C']),
		);
	});

	it('compares pairs without regard to the order of their two identifiers', () => {
		const decls: DeclarationMap = {
			RESPONSE: declaration('RESPONSE', 'pair', 'multiple', qtiValue('pair', 'multiple', ['A B', 'C D'])),
		};
		expect(evaluate(`<delete><baseValue baseType="pair">B A</baseValue>${variable('RESPONSE')}</delete>`, decls)).toEqual(
			qtiValue('pair', 'multiple', ['C D']),
		);
	});

	it('is NULL (the empty container) once every value is removed', () => {
		const result = evaluate(`<delete>${id('A')}${multiple('A', 'A')}</delete>`);
		expect(result.kind).toBe('null');
	});

	it('is NULL when either sub-expression is NULL', () => {
		expect(evaluate(`<delete><null/>${multiple('A', 'B')}</delete>`).kind).toBe('null');
		expect(evaluate(`<delete>${id('A')}${variable('NOTHING')}</delete>`, NULL_DECLS).kind).toBe('null');
		expect(evaluate(`<delete>${id('A')}${variable('EMPTY')}</delete>`, NULL_DECLS).kind).toBe('null');
	});
});

describe('multiple and ordered ignore NULL sub-expressions', () => {
	it('multiple(A, NULL) is {A}', () => {
		expect(evaluate(`<multiple>${id('A')}<null/></multiple>`)).toEqual(qtiValue('identifier', 'multiple', ['A']));
	});

	it('ordered(NULL, A, NULL) is [A]', () => {
		expect(evaluate(`<ordered><null/>${id('A')}<null/></ordered>`)).toEqual(qtiValue('identifier', 'ordered', ['A']));
	});

	it('skips a NULL or empty variable and flattens a container sub-expression', () => {
		expect(evaluate(`<multiple>${id('A')}${variable('NOTHING')}${variable('EMPTY')}${multiple('B', 'C')}</multiple>`, NULL_DECLS)).toEqual(
			qtiValue('identifier', 'multiple', ['A', 'B', 'C']),
		);
	});

	it('is NULL when every sub-expression is NULL, or there are none', () => {
		expect(evaluate('<multiple><null/><null/></multiple>').kind).toBe('null');
		expect(evaluate('<ordered><null/></ordered>').kind).toBe('null');
		expect(evaluate('<multiple/>').kind).toBe('null');
		expect(evaluate('<isNull><multiple><null/></multiple></isNull>')).toEqual(yes);
	});

	it('counts and matches only the values it holds', () => {
		expect(evaluate(`<containerSize><multiple>${id('A')}<null/></multiple></containerSize>`)).toEqual(
			qtiValue('integer', 'single', 1),
		);
		expect(evaluate(`<containerSize><ordered><null/>${id('A')}<null/></ordered></containerSize>`)).toEqual(
			qtiValue('integer', 'single', 1),
		);
		expect(evaluate(`<match><multiple>${id('A')}<null/></multiple>${multiple('A')}</match>`)).toEqual(yes);
		expect(evaluate(`<match><ordered><null/>${id('A')}${id('B')}</ordered>${ordered('A', 'B')}</match>`)).toEqual(yes);
	});
});
