/**
 * The inside operator (QTI 2.2 ASI §15.3.2, unchanged in QTI 3.0). Shape vocabulary (§5.54.2):
 * "default" refers to the entire area of the associated image, so it takes no coordinates —
 * an empty or absent coords attribute is valid, and every point is inside it. Every other shape
 * needs its coords.
 */

import { describe, expect, it } from 'bun:test';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function evaluate(xml: string, decls: DeclarationMap = {}): QtiValue {
	const expression = buildExpression(parseXml(xml).documentElement);
	return evalExpr({ ctx: new DeclarationContext(decls), ops: new OperatorRegistry(), rng: () => 0.5 }, expression);
}

const point = (value: string): string => `<baseValue baseType="point">${value}</baseValue>`;

const yes = qtiValue('boolean', 'single', true);
const no = qtiValue('boolean', 'single', false);

describe('inside', () => {
	describe('shape="default" covers the whole image and needs no coords', () => {
		const points = ['0 0', '10 20', '-5 -5', '100000 3'];
		for (const coordsAttribute of [' coords=""', '']) {
			const label = coordsAttribute ? 'empty coords' : 'no coords attribute';
			for (const value of points) {
				it(`${label}: (${value}) is inside`, () => {
					expect(evaluate(`<inside shape="default"${coordsAttribute}>${point(value)}</inside>`)).toEqual(yes);
				});
			}
		}

		it('a NULL point stays NULL', () => {
			const decls: DeclarationMap = {
				P: {
					identifier: 'P',
					baseType: 'point',
					cardinality: 'single',
					defaultValue: qtiNull('point', 'single'),
					value: qtiNull('point', 'single'),
				},
			};
			expect(evaluate('<inside shape="default" coords=""><variable identifier="P"/></inside>', decls)).toEqual(
				qtiNull('boolean', 'single'),
			);
		});
	});

	describe('every other shape still needs its coords', () => {
		for (const shape of ['rect', 'circle', 'ellipse', 'poly']) {
			it(`shape="${shape}" without coords is rejected`, () => {
				expect(() => buildExpression(parseXml(`<inside shape="${shape}">${point('1 1')}</inside>`).documentElement)).toThrow(
					'<inside> requires coords attribute',
				);
				expect(() =>
					buildExpression(parseXml(`<inside shape="${shape}" coords="">${point('1 1')}</inside>`).documentElement),
				).toThrow('<inside> requires coords attribute');
			});
		}

		it('a shape with coords still tests the point against them', () => {
			expect(evaluate(`<inside shape="rect" coords="0,0,10,10">${point('5 5')}</inside>`)).toEqual(yes);
			expect(evaluate(`<inside shape="rect" coords="0,0,10,10">${point('50 5')}</inside>`)).toEqual(no);
		});

		it('a missing shape is still rejected', () => {
			expect(() => buildExpression(parseXml(`<inside coords="0,0,10,10">${point('1 1')}</inside>`).documentElement)).toThrow(
				'<inside> requires shape attribute',
			);
		});
	});
});
