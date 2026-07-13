import { describe, expect, test } from 'bun:test';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function record(fields: Record<string, ReturnType<typeof qtiValue>>) {
	return qtiValue(undefined, 'record', fields);
}

function env(declarations: DeclarationMap = {}) {
	return {
		ctx: new DeclarationContext(declarations),
		ops: new OperatorRegistry(),
		rng: () => 0.5,
	};
}

describe('record cardinality evaluation', () => {
	test('record expressions have record cardinality and fieldValue preserves the field type', () => {
		const expression = buildExpression(
			parseXml(`
				<fieldValue fieldIdentifier="points">
					<record>
						<fieldValue fieldIdentifier="label"><baseValue baseType="string">A</baseValue></fieldValue>
						<fieldValue fieldIdentifier="points"><baseValue baseType="float">2.5</baseValue></fieldValue>
					</record>
				</fieldValue>
			`).documentElement,
			{ scope: 'item' },
		);

		expect(evalExpr(env(), expression)).toEqual(qtiValue('float', 'single', 2.5));
	});

	test('fieldValue returns NULL for a missing field', () => {
		const expression = buildExpression(
			parseXml(`
				<fieldValue fieldIdentifier="missing">
					<record><fieldValue fieldIdentifier="present"><baseValue baseType="string">A</baseValue></fieldValue></record>
				</fieldValue>
			`).documentElement,
			{ scope: 'item' },
		);

		expect(evalExpr(env(), expression)).toEqual(qtiNull());
	});

	test('match compares record fields by identifier rather than XML/object order', () => {
		const left = record({
			label: qtiValue('identifier', 'single', 'A'),
			points: qtiValue('float', 'single', 2.5),
		});
		const right = record({
			points: qtiValue('float', 'single', 2.5),
			label: qtiValue('identifier', 'single', 'A'),
		});
		const declarations: DeclarationMap = {
			LEFT: { identifier: 'LEFT', cardinality: 'record', defaultValue: left, value: left },
			RIGHT: { identifier: 'RIGHT', cardinality: 'record', defaultValue: right, value: right },
		};
		const expression = buildExpression(
			parseXml('<match><variable identifier="LEFT"/><variable identifier="RIGHT"/></match>').documentElement,
			{ scope: 'item' },
		);

		expect(evalExpr(env(declarations), expression)).toEqual(qtiValue('boolean', 'single', true));
	});
});
