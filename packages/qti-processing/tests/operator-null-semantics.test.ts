/**
 * NULL semantics of the numeric and logical operators (QTI ASI §5 and §15.3, carried to QTI 2.2
 * and 3.0): anyN is three-valued; max, min, gcd and lcm take containers; divide, power and
 * integerDivide give NULL where the result is undefined; an empty string is NULL in every
 * numeric operator; substring gives NULL for a NULL operand.
 */

import { describe, expect, it } from 'bun:test';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { BaseType, Cardinality, DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function declaration(identifier: string, baseType: BaseType, cardinality: Cardinality, value: QtiValue): DeclarationMap[string] {
	return { identifier, baseType, cardinality, defaultValue: value, value };
}

const DECLS: DeclarationMap = {
	INTS: declaration('INTS', 'integer', 'multiple', qtiValue('integer', 'multiple', [1, 5, 3])),
	PAIR: declaration('PAIR', 'integer', 'ordered', qtiValue('integer', 'ordered', [12, 18])),
	FLOATS: declaration('FLOATS', 'float', 'multiple', qtiValue('float', 'multiple', [1.5, -2])),
	NO_INTS: declaration('NO_INTS', 'integer', 'multiple', qtiValue('integer', 'multiple', [])),
	EMPTY_STRING: declaration('EMPTY_STRING', 'string', 'single', qtiValue('string', 'single', '')),
	EMPTY_FLOAT: declaration('EMPTY_FLOAT', 'float', 'single', qtiValue('float', 'single', '')),
	VALUELESS: declaration('VALUELESS', 'float', 'single', qtiValue('float', 'single', null)),
	TMPL_MIN: declaration('TMPL_MIN', 'integer', 'single', qtiValue('integer', 'single', 2)),
	TMPL_MAX: declaration('TMPL_MAX', 'integer', 'single', qtiValue('integer', 'single', 2)),
	TMPL_ONE: declaration('TMPL_ONE', 'integer', 'single', qtiValue('integer', 'single', 1)),
};

function evaluate(xml: string): QtiValue {
	const expression = buildExpression(parseXml(xml).documentElement);
	return evalExpr({ ctx: new DeclarationContext(structuredClone(DECLS)), rng: () => 0.5 }, expression);
}

const yes = qtiValue('boolean', 'single', true);
const no = qtiValue('boolean', 'single', false);
const isNull = (v: QtiValue): boolean => v.kind === 'null';

const TRUE = '<baseValue baseType="boolean">true</baseValue>';
const FALSE = '<baseValue baseType="boolean">false</baseValue>';
const NULL = '<null/>';
const int = (n: number): string => `<baseValue baseType="integer">${n}</baseValue>`;
const float = (n: number | string): string => `<baseValue baseType="float">${n}</baseValue>`;
const str = (text: string): string => `<baseValue baseType="string">${text}</baseValue>`;
const variable = (identifier: string): string => `<variable identifier="${identifier}"/>`;

describe('anyN is three-valued (QTI ASI §15.3)', () => {
	const anyN = (ops: string[], min = 3, max = 4): string => `<anyN min="${min}" max="${max}">${ops.join('')}</anyN>`;

	// The spec's own example: min 3, max 4.
	it('{true,true,false,NULL} is NULL: the NULL operand leaves the result undetermined', () => {
		expect(evaluate(anyN([TRUE, TRUE, FALSE, NULL]))).toEqual({ kind: 'null', baseType: 'boolean', cardinality: 'single' });
	});

	it('{true,false,false,NULL} is false: more than n - min operands are false', () => {
		expect(evaluate(anyN([TRUE, FALSE, FALSE, NULL]))).toEqual(no);
	});

	it('{true,true,true,NULL} is true: at least min operands are true', () => {
		expect(evaluate(anyN([TRUE, TRUE, TRUE, NULL]))).toEqual(yes);
	});

	it('more than max true operands is false whatever the NULL operands', () => {
		expect(evaluate(anyN([TRUE, TRUE, TRUE, NULL], 1, 2))).toEqual(no);
	});

	it('not(anyN) of an undetermined anyN stays NULL', () => {
		expect(isNull(evaluate(`<not>${anyN([TRUE, TRUE, FALSE, NULL])}</not>`))).toBe(true);
	});

	it('reads an empty container operand as NULL, not as false', () => {
		// {true, NULL} with min 2, max 2: the empty container could still be the second true.
		expect(isNull(evaluate(anyN([TRUE, variable('NO_INTS')], 2, 2)))).toBe(true);
	});

	it('keeps the results when no operand is NULL', () => {
		expect(evaluate(anyN([TRUE, TRUE, FALSE], 2, 2))).toEqual(yes);
		expect(evaluate(anyN([TRUE, TRUE, TRUE], 2, 2))).toEqual(no);
		expect(evaluate(anyN([TRUE, FALSE, FALSE], 2, 2))).toEqual(no);
	});
});

describe('anyN min and max are integerOrVariableRef (QTI ASI §10.2)', () => {
	it('reads min and max from template variables', () => {
		// min 2, max 2 from TMPL_MIN and TMPL_MAX; a literal default (min 1, max 3) would differ.
		expect(evaluate(`<anyN min="TMPL_MIN" max="TMPL_MAX">${TRUE}${TRUE}${TRUE}</anyN>`)).toEqual(no);
		expect(evaluate(`<anyN min="TMPL_MIN" max="TMPL_MAX">${TRUE}${FALSE}${FALSE}</anyN>`)).toEqual(no);
		expect(evaluate(`<anyN min="TMPL_MIN" max="TMPL_MAX">${TRUE}${TRUE}${FALSE}</anyN>`)).toEqual(yes);
	});

	it('accepts the braced {TEMPLATE} spelling', () => {
		expect(evaluate(`<anyN min="{TMPL_MIN}" max="{TMPL_MAX}">${TRUE}${TRUE}${TRUE}</anyN>`)).toEqual(no);
		expect(evaluate(`<anyN min="{TMPL_ONE}">${TRUE}${FALSE}</anyN>`)).toEqual(yes);
	});

	it('keeps literal bounds and the defaults (min 1, max the operand count)', () => {
		expect(evaluate(`<anyN min="2" max="2">${TRUE}${TRUE}${FALSE}</anyN>`)).toEqual(yes);
		expect(evaluate(`<anyN>${FALSE}${TRUE}${TRUE}</anyN>`)).toEqual(yes);
		expect(evaluate(`<anyN>${FALSE}${FALSE}</anyN>`)).toEqual(no);
	});

	it('is NULL when a bound refers to a variable with no value', () => {
		expect(isNull(evaluate(`<anyN min="NO_SUCH_VARIABLE">${TRUE}${FALSE}</anyN>`))).toBe(true);
	});
});

describe('max, min, gcd and lcm take single, multiple or ordered operands (QTI ASI §15.3)', () => {
	it('max and min range over every value of a container operand', () => {
		expect(evaluate(`<max>${variable('INTS')}</max>`)).toEqual(qtiValue('integer', 'single', 5));
		expect(evaluate(`<min>${variable('INTS')}</min>`)).toEqual(qtiValue('integer', 'single', 1));
	});

	it('max and min mix single and container operands', () => {
		expect(evaluate(`<max>${variable('INTS')}${int(7)}</max>`)).toEqual(qtiValue('integer', 'single', 7));
		expect(evaluate(`<min>${int(2)}${variable('INTS')}</min>`)).toEqual(qtiValue('integer', 'single', 1));
		// A float operand makes the result float.
		expect(evaluate(`<min>${variable('FLOATS')}${int(0)}</min>`)).toEqual(qtiValue('float', 'single', -2));
		expect(evaluate(`<max>${variable('INTS')}${float(2.5)}</max>`)).toEqual(qtiValue('float', 'single', 5));
	});

	it('gcd and lcm range over every value of a container operand', () => {
		expect(evaluate(`<gcd>${variable('PAIR')}</gcd>`)).toEqual(qtiValue('integer', 'single', 6));
		expect(evaluate(`<gcd>${variable('PAIR')}${int(8)}</gcd>`)).toEqual(qtiValue('integer', 'single', 2));
		expect(evaluate(`<lcm>${variable('PAIR')}</lcm>`)).toEqual(qtiValue('integer', 'single', 36));
		expect(evaluate(`<lcm>${int(5)}${variable('PAIR')}</lcm>`)).toEqual(qtiValue('integer', 'single', 180));
	});

	it('keeps the zero rules: gcd(0, n) is n, gcd(0, 0) is 0, lcm(0, n) is 0', () => {
		expect(evaluate(`<gcd>${int(0)}${int(18)}</gcd>`)).toEqual(qtiValue('integer', 'single', 18));
		expect(evaluate(`<gcd>${int(0)}${int(0)}</gcd>`)).toEqual(qtiValue('integer', 'single', 0));
		expect(evaluate(`<lcm>${int(0)}${int(18)}</lcm>`)).toEqual(qtiValue('integer', 'single', 0));
	});

	for (const operator of ['max', 'min', 'gcd', 'lcm']) {
		it(`${operator} is NULL for a NULL operand, an empty container or a non-numerical value`, () => {
			expect(isNull(evaluate(`<${operator}>${variable('PAIR')}${NULL}</${operator}>`))).toBe(true);
			// QTI ASI §5: an empty container is NULL.
			expect(isNull(evaluate(`<${operator}>${variable('NO_INTS')}</${operator}>`))).toBe(true);
			expect(isNull(evaluate(`<${operator}>${int(4)}${variable('NO_INTS')}</${operator}>`))).toBe(true);
			// "If any of the sub-expressions is not a numerical value, then the result is NULL."
			expect(isNull(evaluate(`<${operator}>${int(4)}${str('abc')}</${operator}>`))).toBe(true);
		});
	}
});

describe('divide, power and integerDivide give NULL where the result is undefined (QTI ASI §15.3)', () => {
	it('divide by zero is NULL ("the operator should result in NULL")', () => {
		expect(isNull(evaluate(`<divide>${float(1)}${float(0)}</divide>`))).toBe(true);
		expect(isNull(evaluate(`<divide>${int(0)}${int(0)}</divide>`))).toBe(true);
	});

	it('a divide result outside the float value set is NULL', () => {
		expect(isNull(evaluate(`<divide>${float('1e308')}${float('1e-308')}</divide>`))).toBe(true);
	});

	it('a power result outside the float value set is NULL ("shall result in NULL")', () => {
		expect(isNull(evaluate(`<power>${float('1e308')}${float(2)}</power>`))).toBe(true);
		expect(isNull(evaluate(`<power>${int(0)}${int(-1)}</power>`))).toBe(true);
	});

	it('integerDivide by zero is NULL', () => {
		expect(isNull(evaluate(`<integerDivide>${int(7)}${int(0)}</integerDivide>`))).toBe(true);
	});

	it('NULL operands give NULL', () => {
		expect(isNull(evaluate(`<power>${NULL}${int(2)}</power>`))).toBe(true);
		expect(isNull(evaluate(`<power>${int(2)}${NULL}</power>`))).toBe(true);
		expect(isNull(evaluate(`<integerDivide>${NULL}${int(2)}</integerDivide>`))).toBe(true);
		expect(isNull(evaluate(`<integerModulus>${int(7)}${NULL}</integerModulus>`))).toBe(true);
	});

	it('keeps the defined results', () => {
		expect(evaluate(`<divide>${int(6)}${int(4)}</divide>`)).toEqual(qtiValue('float', 'single', 1.5));
		expect(evaluate(`<power>${int(2)}${int(10)}</power>`)).toEqual(qtiValue('float', 'single', 1024));
		expect(evaluate(`<integerDivide>${int(7)}${int(2)}</integerDivide>`)).toEqual(qtiValue('integer', 'single', 3));
	});

	it('integerDivide rounds down to the greatest integer not above x/y', () => {
		// "rounded down to the greatest integer (i) such that i<=(x/y)": -7/2 is -4, so that
		// integerModulus, x - z*y, gives 1.
		expect(evaluate(`<integerDivide>${int(-7)}${int(2)}</integerDivide>`)).toEqual(qtiValue('integer', 'single', -4));
		expect(evaluate(`<integerModulus>${int(-7)}${int(2)}</integerModulus>`)).toEqual(qtiValue('integer', 'single', 1));
	});
});

describe('integerDivide and integerModulus read the operands as they are (QTI ASI §15.3)', () => {
	it('integerDivide floors the true quotient: 6.9/1.9 is 3 and -6.9/1.9 is -4', () => {
		// The operator truncates nothing: the operands are divided as they are, and only the
		// quotient is rounded down to the greatest integer not above it.
		expect(evaluate(`<integerDivide>${float(6.9)}${float(1.9)}</integerDivide>`)).toEqual(qtiValue('integer', 'single', 3));
		expect(evaluate(`<integerDivide>${float(-6.9)}${float(1.9)}</integerDivide>`)).toEqual(qtiValue('integer', 'single', -4));
	});

	it('only an actual zero divisor is NULL: 0.9 divides', () => {
		expect(evaluate(`<integerDivide>${float(5.5)}${float(0.9)}</integerDivide>`)).toEqual(qtiValue('integer', 'single', 6));
		expect(evaluate(`<integerModulus>${float(5.5)}${float(0.9)}</integerModulus>`)).toEqual(
			qtiValue('integer', 'single', 5.5 - 0.9 * Math.floor(5.5 / 0.9)),
		);
		expect(isNull(evaluate(`<integerDivide>${float(5.5)}${float(0)}</integerDivide>`))).toBe(true);
		expect(isNull(evaluate(`<integerModulus>${float(5.5)}${float(0)}</integerModulus>`))).toBe(true);
	});

	it('keeps integer operands as they were', () => {
		expect(evaluate(`<integerDivide>${int(7)}${int(2)}</integerDivide>`)).toEqual(qtiValue('integer', 'single', 3));
		expect(evaluate(`<integerDivide>${int(-7)}${int(2)}</integerDivide>`)).toEqual(qtiValue('integer', 'single', -4));
		expect(evaluate(`<integerModulus>${int(-7)}${int(2)}</integerModulus>`)).toEqual(qtiValue('integer', 'single', 1));
	});

	it('keeps the identity x = integerDivide(x,y)*y + integerModulus(x,y)', () => {
		for (const [x, y] of [
			[6.9, 1.9],
			[-6.9, 1.9],
			[5.5, 0.9],
			[-5.5, 0.9],
			[6.9, -1.9],
			[7, 2],
			[-7, 2],
			[5, 5],
			[0.3, 7.1],
		]) {
			const q = evaluate(`<integerDivide>${float(x)}${float(y)}</integerDivide>`);
			const m = evaluate(`<integerModulus>${float(x)}${float(y)}</integerModulus>`);
			const quotient = q.kind === 'value' && typeof q.value === 'number' ? q.value : NaN;
			const modulus = m.kind === 'value' && typeof m.value === 'number' ? m.value : NaN;
			expect(quotient * y + modulus).toBeCloseTo(x, 10);
		}
	});
});

describe('an empty string is NULL in every numeric operator (QTI ASI §5)', () => {
	const EMPTY_OPERANDS = ['EMPTY_STRING', 'EMPTY_FLOAT', 'VALUELESS'];
	const cases: Array<[string, (operand: string) => string]> = [
		['sum', (x) => `<sum>${x}${int(1)}</sum>`],
		['subtract (first)', (x) => `<subtract>${x}${int(3)}</subtract>`],
		['subtract (second)', (x) => `<subtract>${int(3)}${x}</subtract>`],
		['product', (x) => `<product>${int(2)}${x}</product>`],
		['divide (first)', (x) => `<divide>${x}${int(2)}</divide>`],
		['divide (second)', (x) => `<divide>${int(2)}${x}</divide>`],
		['max', (x) => `<max>${int(1)}${x}</max>`],
		['min', (x) => `<min>${x}${int(1)}</min>`],
		['gcd', (x) => `<gcd>${int(12)}${x}</gcd>`],
		['lcm', (x) => `<lcm>${x}${int(12)}</lcm>`],
		['mathOperator', (x) => `<mathOperator name="sin">${x}</mathOperator>`],
		['power', (x) => `<power>${x}${int(2)}</power>`],
		['integerDivide', (x) => `<integerDivide>${x}${int(2)}</integerDivide>`],
		['integerModulus', (x) => `<integerModulus>${x}${int(7)}</integerModulus>`],
		['roundTo', (x) => `<roundTo roundingMode="decimalPlaces" figures="2">${x}</roundTo>`],
	];
	for (const [name, xml] of cases) {
		it(`${name} is NULL for an empty string, as for a NULL operand`, () => {
			for (const operand of EMPTY_OPERANDS) {
				expect({ operand, result: evaluate(xml(variable(operand))).kind }).toEqual({ operand, result: 'null' });
			}
			expect(evaluate(xml(NULL)).kind).toBe('null');
		});
	}
});

describe('substring gives NULL for a NULL operand', () => {
	const ABC = str('abc');

	it('is NULL for a NULL operand, in either position', () => {
		expect(evaluate(`<substring>${ABC}${NULL}</substring>`)).toEqual({ kind: 'null', baseType: 'boolean', cardinality: 'single' });
		expect(evaluate(`<substring>${NULL}${ABC}</substring>`)).toEqual({
			kind: 'null',
			baseType: 'boolean',
			cardinality: 'single',
		});
		expect(isNull(evaluate(`<substring>${ABC}${variable('EMPTY_STRING')}</substring>`))).toBe(true);
		expect(isNull(evaluate(`<substring>${variable('EMPTY_STRING')}${ABC}</substring>`))).toBe(true);
	});
});
