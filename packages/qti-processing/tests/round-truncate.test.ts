/**
 * round and truncate (QTI ASI §15.3, carried to QTI 2.2 and 3.0): "The result is a value of
 * base-type integer". `match` is base-type strict, so a float result stops matching integers.
 * roundTo keeps its float result.
 */

import { describe, expect, it } from 'bun:test';
import { buildExpression, buildResponseProcessingAst } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function evaluate(xml: string): QtiValue {
	const expression = buildExpression(parseXml(xml).documentElement);
	return evalExpr({ ctx: new DeclarationContext({}), ops: new OperatorRegistry(), rng: () => 0.5 }, expression);
}

const float = (n: number): string => `<baseValue baseType="float">${n}</baseValue>`;
const int = (n: number): string => `<baseValue baseType="integer">${n}</baseValue>`;
const integer = (n: number): QtiValue => qtiValue('integer', 'single', n);
const yes = qtiValue('boolean', 'single', true);

describe('round', () => {
	// The specification's examples: "6.8 and 6.5 both round up to 7, 6.49 rounds down to 6 and
	// -6.5 rounds up to -6".
	const cases: Array<[number, number]> = [
		[6.8, 7],
		[6.5, 7],
		[6.49, 6],
		[-6.5, -6],
		[-6.51, -7],
		[2.4, 2],
	];
	for (const [input, expected] of cases) {
		it(`round(${input}) is the integer ${expected}`, () => {
			expect(evaluate(`<round>${float(input)}</round>`)).toEqual(integer(expected));
		});
	}

	it('keeps an integer operand an integer', () => {
		expect(evaluate(`<round>${int(4)}</round>`)).toEqual(integer(4));
	});

	it('matches an integer', () => {
		expect(evaluate(`<match><round>${float(3.2)}</round>${int(3)}</match>`)).toEqual(yes);
	});

	it('is NULL for a NULL operand', () => {
		expect(evaluate('<round><null/></round>')).toEqual({ kind: 'null', baseType: 'integer', cardinality: 'single' });
	});
});

describe('truncate', () => {
	// "the value 6.8 becomes 6 and the value -6.8 becomes -6"
	const cases: Array<[number, number]> = [
		[6.8, 6],
		[-6.8, -6],
		[3.9, 3],
		[0.2, 0],
	];
	for (const [input, expected] of cases) {
		it(`truncate(${input}) is the integer ${expected}`, () => {
			expect(evaluate(`<truncate>${float(input)}</truncate>`)).toEqual(integer(expected));
		});
	}

	it('matches an integer', () => {
		expect(evaluate(`<match><truncate>${float(3.9)}</truncate>${int(3)}</match>`)).toEqual(yes);
	});

	it('is NULL for a NULL operand', () => {
		expect(evaluate('<truncate><null/></truncate>')).toEqual({ kind: 'null', baseType: 'integer', cardinality: 'single' });
	});
});

describe('integer results in numeric operators', () => {
	it('a sum of rounded values and integers is an integer', () => {
		expect(evaluate(`<sum><round>${float(2.4)}</round>${int(1)}</sum>`)).toEqual(integer(3));
		expect(evaluate(`<match><sum><round>${float(2.4)}</round>${int(1)}</sum>${int(3)}</match>`)).toEqual(yes);
	});

	it('a product of a truncated value and an integer is an integer', () => {
		expect(evaluate(`<product><truncate>${float(2.9)}</truncate>${int(3)}</product>`)).toEqual(integer(6));
	});

	it('a float operand still makes the sum a float', () => {
		expect(evaluate(`<sum><round>${float(2.4)}</round>${float(0.5)}</sum>`)).toEqual(qtiValue('float', 'single', 2.5));
	});

	it('a float outcome holds a rounded value as a float, an integer outcome as an integer', () => {
		const decls: DeclarationMap = {
			FLOAT_OUT: { identifier: 'FLOAT_OUT', baseType: 'float', cardinality: 'single', defaultValue: qtiValue('float', 'single', 0), value: qtiValue('float', 'single', 0) },
			INT_OUT: { identifier: 'INT_OUT', baseType: 'integer', cardinality: 'single', defaultValue: integer(0), value: integer(0) },
		};
		const ctx = new DeclarationContext(decls);
		const rp = parseXml(`<responseProcessing>
			<setOutcomeValue identifier="FLOAT_OUT"><round>${float(2.6)}</round></setOutcomeValue>
			<setOutcomeValue identifier="INT_OUT"><truncate>${float(2.6)}</truncate></setOutcomeValue>
		</responseProcessing>`).documentElement;
		execProgram({ ctx, ops: new OperatorRegistry(), rng: () => 0.5 }, buildResponseProcessingAst(rp, {}));
		expect(ctx.getValue('FLOAT_OUT')).toEqual(qtiValue('float', 'single', 3));
		expect(ctx.getValue('INT_OUT')).toEqual(integer(2));
	});

	it('roundTo keeps a float result', () => {
		expect(evaluate(`<roundTo roundingMode="decimalPlaces" figures="0">${float(2.6)}</roundTo>`)).toEqual(
			qtiValue('float', 'single', 3),
		);
		expect(evaluate(`<roundTo roundingMode="decimalPlaces" figures="2">${float(12.3456)}</roundTo>`)).toEqual(
			qtiValue('float', 'single', 12.35),
		);
	});
});

/**
 * equalRounded@roundingMode is an enumerated attribute: the XSDs of 2.1, 2.2 and 3.0 enumerate
 * exactly decimalPlaces and significantFigures, with significantFigures as the default. Like
 * roundTo, the same file's other roundingMode reader, the builder takes those spellings only —
 * a present but invalid value is a compile error, not a silent default.
 */
describe('equalRounded roundingMode', () => {
	const sigFig = (mode: string | undefined): string =>
		`<equalRounded${mode === undefined ? '' : ` roundingMode="${mode}"`} figures="3">${float(3.175)}${float(3.183)}</equalRounded>`;

	it('rounds both operands to 3 significant figures', () => {
		expect(evaluate(sigFig('significantFigures'))).toEqual(yes);
		expect(evaluate(sigFig('decimalPlaces'))).toEqual(qtiValue('boolean', 'single', false));
	});

	it('defaults to significantFigures when the attribute is absent', () => {
		expect(evaluate(sigFig(undefined))).toEqual(yes);
	});

	it('is a compile error for a spelling the XSD does not enumerate', () => {
		for (const mode of ['significantFigure', 'decimalplace', 'DECIMALPLACES', 'bogus']) {
			expect(() => buildExpression(parseXml(sigFig(mode)).documentElement)).toThrow(
				'<equalRounded> roundingMode must be "decimalPlaces"|"significantFigures"',
			);
		}
	});
});
