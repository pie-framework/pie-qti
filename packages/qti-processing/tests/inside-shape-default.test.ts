/**
 * The inside operator (QTI 2.2 ASI §15.3.2, unchanged in QTI 3.0). Shape vocabulary (§5.54.2):
 * "default" refers to the entire area of the associated image, so it takes no coordinates —
 * an empty or absent coords attribute is valid, and every point is inside it. Every other shape
 * needs its coords.
 */

import { describe, expect, it } from 'bun:test';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function evaluate(xml: string, decls: DeclarationMap = {}): QtiValue {
	const expression = buildExpression(parseXml(xml).documentElement);
	return evalExpr({ ctx: new DeclarationContext(decls), rng: () => 0.5 }, expression);
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

		// Pins each shape's hit-test geometry exactly: the boundary counts as inside for
		// rect/circle/ellipse (their tests are inclusive), and degenerate or malformed
		// coords hold no point at all.
		describe('shape geometry', () => {
			it('rect: corners and edges are inside, inclusive on the boundary', () => {
				const coords = '0,0,10,10';
				expect(evaluate(`<inside shape="rect" coords="${coords}">${point('0 0')}</inside>`)).toEqual(yes);
				expect(evaluate(`<inside shape="rect" coords="${coords}">${point('10 10')}</inside>`)).toEqual(yes);
				// Coords given corner-first still read as the same rectangle.
				expect(evaluate(`<inside shape="rect" coords="10,10,0,0">${point('3 7')}</inside>`)).toEqual(yes);
				expect(evaluate(`<inside shape="rect" coords="${coords}">${point('10.5 5')}</inside>`)).toEqual(no);
			});

			it('circle: inside and on the radius, outside beyond it', () => {
				const coords = '50,50,10';
				expect(evaluate(`<inside shape="circle" coords="${coords}">${point('55 52')}</inside>`)).toEqual(yes);
				expect(evaluate(`<inside shape="circle" coords="${coords}">${point('40 50')}</inside>`)).toEqual(yes);
				expect(evaluate(`<inside shape="circle" coords="${coords}">${point('50 65')}</inside>`)).toEqual(no);
			});

			it('ellipse: within both radii, outside past either, zero radius holds nothing', () => {
				const coords = '50,50,20,10';
				expect(evaluate(`<inside shape="ellipse" coords="${coords}">${point('50 55')}</inside>`)).toEqual(yes);
				expect(evaluate(`<inside shape="ellipse" coords="${coords}">${point('75 50')}</inside>`)).toEqual(no);
				expect(evaluate(`<inside shape="ellipse" coords="${coords}">${point('50 65')}</inside>`)).toEqual(no);
				// rx 0 or ry 0 would divide by zero; the shape simply holds no point.
				expect(evaluate(`<inside shape="ellipse" coords="50,50,0,10">${point('50 50')}</inside>`)).toEqual(no);
			});

			it('poly: inside the ring, outside it, malformed coords hold nothing', () => {
				const square = '0,0,10,0,10,10,0,10';
				expect(evaluate(`<inside shape="poly" coords="${square}">${point('5 5')}</inside>`)).toEqual(yes);
				expect(evaluate(`<inside shape="poly" coords="${square}">${point('15 5')}</inside>`)).toEqual(no);
				// Fewer than six numbers, or an odd count, is no polygon at all.
				expect(evaluate(`<inside shape="poly" coords="0,0,10,0,10">${point('5 5')}</inside>`)).toEqual(no);
				expect(evaluate(`<inside shape="poly" coords="0,0,10,0,10,10,0">${point('5 5')}</inside>`)).toEqual(no);
			});
		});

		it('a missing shape is still rejected', () => {
			expect(() => buildExpression(parseXml(`<inside coords="0,0,10,10">${point('1 1')}</inside>`).documentElement)).toThrow(
				'<inside> requires shape attribute',
			);
		});
	});
});
