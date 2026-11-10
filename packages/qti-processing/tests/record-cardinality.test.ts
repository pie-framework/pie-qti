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
	test('fieldValue reads a record variable field and keeps the field type', () => {
		// A record value reaches expressions through a record-typed variable (the host or the
		// delivery data holds it) — no QTI version defines an authored record constructor.
		const declarations: DeclarationMap = {
			REC: {
				identifier: 'REC',
				cardinality: 'record',
				value: record({
					label: qtiValue('string', 'single', 'A'),
					points: qtiValue('float', 'single', 2.5),
				}),
			},
		};
		const expression = buildExpression(
			parseXml('<fieldValue fieldIdentifier="points"><variable identifier="REC"/></fieldValue>').documentElement,
			{ scope: 'item' },
		);

		expect(evalExpr(env(declarations), expression)).toEqual(qtiValue('float', 'single', 2.5));
	});

	test('fieldValue returns NULL for a missing field', () => {
		const declarations: DeclarationMap = {
			REC: {
				identifier: 'REC',
				cardinality: 'record',
				value: record({ present: qtiValue('string', 'single', 'A') }),
			},
		};
		const expression = buildExpression(
			parseXml('<fieldValue fieldIdentifier="missing"><variable identifier="REC"/></fieldValue>').documentElement,
			{ scope: 'item' },
		);

		expect(evalExpr(env(declarations), expression)).toEqual(qtiNull());
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
