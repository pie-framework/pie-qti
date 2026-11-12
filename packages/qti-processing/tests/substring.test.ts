/**
 * The substring operator (QTI 2.1 §4.10 "Class : substring"; 2.2 §2.12.3.46; 3.0 §2.11.3.46):
 * a boolean containment test on exactly two string sub-expressions — "true if the first
 * expression is a substring of the second expression" — folded by substring@caseSensitive
 * [1]: boolean = true (required `case-sensitive` in the 3.0 XSD), NULL when either operand
 * is NULL. No QTI version defines a (string, start, length) extraction form or a string
 * result; the engine once implemented one, and building that shape now throws.
 */

import { describe, expect, it } from 'bun:test';
import { Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function evaluate(body: string, decls: DeclarationMap = {}, qti3 = false): QtiValue {
	const expression = buildExpression(parseXml(body).documentElement, qti3 ? { elementNameMapper: new Qti3ElementNameMapper() } : undefined);
	return evalExpr({ ctx: new DeclarationContext(decls), rng: () => 0.5 }, expression);
}

const declared = (identifier: string, value: unknown): DeclarationMap => ({
	[identifier]: { identifier, baseType: 'string', cardinality: 'single', value: qtiValue('string', 'single', value) },
});

const str = (text: string): string => `<baseValue baseType="string">${text}</baseValue>`;
const variable = (identifier: string): string => `<variable identifier="${identifier}"/>`;
const NULL = '<null/>';
const yes = qtiValue('boolean', 'single', true);
const no = qtiValue('boolean', 'single', false);
const booleanNull = qtiNull('boolean', 'single');

describe('substring is a containment test (the first expression in the second)', () => {
	it('is true when the first expression is a substring of the second', () => {
		expect(evaluate(`<substring>${str('ell')}${str('Hello')}</substring>`)).toEqual(yes);
	});

	it('is false when the first expression is not contained in the second', () => {
		expect(evaluate(`<substring>${str('Shell')}${str('Hell')}</substring>`)).toEqual(no);
		expect(evaluate(`<substring>${str('world')}${str('Hello')}</substring>`)).toEqual(no);
	});

	it('is true for equal strings', () => {
		expect(evaluate(`<substring>${str('Hello')}${str('Hello')}</substring>`)).toEqual(yes);
	});

	it('matches the whole string: the operands are not extracted', () => {
		// The old (string, start, length) reading gave "BC" for ("ABCDE", 2, 2); containment
		// gives false — "ABCDE" does not occur in "2", and a third operand is invalid content.
		expect(() => evaluate(`<substring>${str('ABCDE')}${str('2')}${str('2')}</substring>`)).toThrow(
			'<substring> requires exactly two child expressions',
		);
	});

	it('requires exactly two child expressions', () => {
		expect(() => evaluate(`<substring>${str('ABCDE')}</substring>`)).toThrow(
			'<substring> requires exactly two child expressions',
		);
	});
});

describe('substring@caseSensitive (default true)', () => {
	it('folds case only when caseSensitive is false: the spec example', () => {
		// 2.1 §4.10: "If false then the match is not case sensitive and 'Hell' is a substring of 'Shell'."
		expect(evaluate(`<substring caseSensitive="false">${str('Hell')}${str('Shell')}</substring>`)).toEqual(yes);
		expect(evaluate(`<substring>${str('Hell')}${str('Shell')}</substring>`)).toEqual(no);
	});

	it('stays sensitive when caseSensitive is true', () => {
		// The spec's own sensitive example: "Hell" is not a substring of "Shell" — but "hell"
		// literally is, so the fold is what decides.
		expect(evaluate(`<substring caseSensitive="true">${str('Hell')}${str('Shell')}</substring>`)).toEqual(no);
		expect(evaluate(`<substring caseSensitive="true">${str('hell')}${str('Shell')}</substring>`)).toEqual(yes);
	});

	it('folds case both ways, in either operand', () => {
		expect(evaluate(`<substring caseSensitive="false">${str('HELL')}${str('shell')}</substring>`)).toEqual(yes);
		expect(evaluate(`<substring caseSensitive="false">${str('shell')}${str('SHELL')}</substring>`)).toEqual(yes);
		// The fold only ignores case; it does not create a containment that is not there.
		expect(evaluate(`<substring caseSensitive="false">${str('shells')}${str('HELL')}</substring>`)).toEqual(no);
	});

	it('reads the QTI 3.0 kebab-case spelling (required in 3.0)', () => {
		expect(
			evaluate(
				'<qti-substring case-sensitive="false"><qti-base-value base-type="string">Hell</qti-base-value><qti-base-value base-type="string">Shell</qti-base-value></qti-substring>',
				{},
				true,
			),
		).toEqual(yes);
		expect(
			evaluate(
				'<qti-substring case-sensitive="true"><qti-base-value base-type="string">Hell</qti-base-value><qti-base-value base-type="string">Shell</qti-base-value></qti-substring>',
				{},
				true,
			),
		).toEqual(no);
	});
});

describe('substring NULL propagation (§4.10: a NULL operand gives NULL)', () => {
	it('is NULL for a NULL operand, in either position', () => {
		expect(evaluate(`<substring>${str('ell')}${NULL}</substring>`)).toEqual(booleanNull);
		expect(evaluate(`<substring>${NULL}${str('Hello')}</substring>`)).toEqual(booleanNull);
	});

	it('reads an empty string operand as NULL (§5: empty strings are NULL)', () => {
		const EMPTY = declared('EMPTY', '');
		expect(evaluate(`<substring>${str('ell')}${variable('EMPTY')}</substring>`, EMPTY)).toEqual(booleanNull);
		expect(evaluate(`<substring>${variable('EMPTY')}${str('Hello')}</substring>`, EMPTY)).toEqual(booleanNull);
	});

	it('is NULL for a NULL variable before it ever tests containment', () => {
		const UNANSWERED = declared('R', null);
		expect(evaluate(`<substring>${variable('R')}${str('Hello')}</substring>`, UNANSWERED)).toEqual(booleanNull);
	});
});
