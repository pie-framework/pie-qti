import { describe, expect, it } from 'bun:test';
import { buildExpression, buildOutcomeProcessingAst } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function makeEnv(args: { test: any }) {
	const decls: DeclarationMap = {};
	const ctx = new DeclarationContext(decls);
	return { ctx, rng: () => 0.5, test: args.test };
}

describe('qti-processing test-level expressions', () => {
	it('testVariables collects single-cardinality item variables and ignores NULL', () => {
		const env = makeEnv({
			test: {
				items: [
					{
						identifier: 'i1',
						variables: { SCORE: qtiValue('float', 'single', 1) },
					},
					{
						identifier: 'i2',
						variables: { SCORE: qtiNull('float', 'single') },
					},
					{
						identifier: 'i3',
						variables: { SCORE: qtiValue('float', 'single', 0) },
					},
				],
			},
		});

		const expr = {
			kind: 'expr.testVariables',
			id: 'e',
			variableIdentifier: 'SCORE',
			baseType: 'float',
		} as any;

		const out = evalExpr(env as any, expr);
		expect(out.kind).toBe('value');
		expect(out.baseType).toBe('float');
		expect(out.cardinality).toBe('multiple');
		expect(out.value).toEqual([1, 0]);
	});

	it('testVariables matches integer and float when baseType is omitted, weighting into float', () => {
		const env = makeEnv({
			test: {
				items: [
					{ identifier: 'i1', weights: { W: 2 }, variables: { V: qtiValue('integer', 'single', 1), S: qtiValue('string', 'single', 'a') } },
					{ identifier: 'i2', weights: { W: 0.5 }, variables: { V: qtiValue('integer', 'single', 4), S: qtiValue('identifier', 'single', 'b') } },
					{ identifier: 'i3', variables: { V: qtiValue('integer', 'multiple', [9]) } },
				],
			},
		});
		const testVariables = (attrs: Record<string, string>) =>
			evalExpr(env as any, { kind: 'expr.testVariables', id: 'e', variableIdentifier: 'V', ...attrs } as any);

		expect(testVariables({})).toEqual(qtiValue('integer', 'multiple', [1, 4]));
		expect(testVariables({ weightIdentifier: 'W' })).toEqual(qtiValue('float', 'multiple', [2, 2]));
		expect(testVariables({ baseType: 'float' })).toEqual(qtiNull('float', 'multiple'));
		expect(testVariables({ variableIdentifier: 'S' })).toEqual(qtiNull('integer', 'multiple'));
		expect(testVariables({ variableIdentifier: 'S', baseType: 'string' })).toEqual(qtiValue('string', 'multiple', ['a']));
	});

	it('outcomeMinimum/outcomeMaximum read declared bounds over filtered items, weighted', () => {
		const items = [
			{
				identifier: 'i1',
				sectionIdentifiers: ['s1'],
				categories: ['math'],
				weights: { W: 2 },
				outcomeBounds: { SCORE: { normalMinimum: -1, normalMaximum: 2 } },
				variables: { SCORE: qtiValue('float', 'single', 1) },
			},
			{
				identifier: 'i2',
				sectionIdentifiers: ['s1'],
				categories: ['math'],
				outcomeBounds: { SCORE: { normalMaximum: 5 } },
				variables: { SCORE: qtiValue('float', 'single', 3) },
			},
			{
				identifier: 'i3',
				sectionIdentifiers: ['s2'],
				categories: ['ela'],
				variables: { SCORE: qtiValue('float', 'single', 2) },
			},
		];
		const env = makeEnv({ test: { items } });
		const bound = (kind: string, attrs: Record<string, unknown> = {}) =>
			evalExpr(env as any, { kind, id: kind, outcomeIdentifier: 'SCORE', ...attrs } as any);
		const math = { sectionIdentifier: 's1', includeCategory: ['math'] };

		expect(bound('expr.outcomeMinimum', math)).toEqual(qtiValue('float', 'multiple', [-1]));
		expect(bound('expr.outcomeMaximum', math)).toEqual(qtiValue('float', 'multiple', [2, 5]));
		expect(bound('expr.outcomeMaximum', { ...math, weightIdentifier: 'W' })).toEqual(qtiValue('float', 'multiple', [4, 5]));
		// i3 declares no maximum, so the maximum over every item is NULL; the minimum ignores it.
		expect(bound('expr.outcomeMaximum')).toEqual(qtiNull('float', 'multiple'));
		expect(bound('expr.outcomeMinimum')).toEqual(qtiValue('float', 'multiple', [-1]));
	});

	it('numberCorrect/numberIncorrect use explicit flags when present', () => {
		const env = makeEnv({
			test: {
				items: [
					{ identifier: 'i1', variables: {}, correct: true },
					{ identifier: 'i2', variables: {}, incorrect: true },
					{ identifier: 'i3', variables: {}, correct: false },
				],
			},
		});

		const correct = { kind: 'expr.numberCorrect', id: 'c' } as any;
		const incorrect = { kind: 'expr.numberIncorrect', id: 'i' } as any;

		expect(evalExpr(env as any, correct)).toEqual(qtiValue('integer', 'single', 1));
		expect(evalExpr(env as any, incorrect)).toEqual(qtiValue('integer', 'single', 1));
	});

	it('AST builder parses testVariables/numberCorrect when scope=test', () => {
		const doc1 = parseXml('<testVariables variableIdentifier="SCORE" baseType="float"/>');
		const node1 = buildExpression(doc1.documentElement, { scope: 'test' });
		expect(node1.kind).toBe('expr.testVariables');

		const doc2 = parseXml('<numberCorrect/>');
		const node2 = buildExpression(doc2.documentElement, { scope: 'test' });
		expect(node2.kind).toBe('expr.numberCorrect');
	});
});



/**
 * QTI ASI §15.1 variable, at test scope: an item variable is looked up as ITEMREF.VARIABLE, and
 * the optional weightIdentifier names a weight of that assessmentItemRef (1.0 when the itemRef
 * defines none). Weights apply only to integer and float variables, are treated as float, and
 * multiply each contained value of a multiple/ordered variable; any other type ignores them.
 */
describe('qti-processing test-scope variable weightIdentifier', () => {
	function weightedEnv() {
		const decl = (identifier: string, value: ReturnType<typeof qtiValue> | ReturnType<typeof qtiNull>) => ({
			identifier,
			baseType: value.baseType,
			cardinality: value.cardinality ?? 'single',
			value,
		});
		const decls: DeclarationMap = {
			'i1.SCORE': decl('i1.SCORE', qtiValue('float', 'single', 2)),
			'i1.S': decl('i1.S', qtiValue('string', 'single', 'a')),
			'i1.M': decl('i1.M', qtiValue('float', 'multiple', [1, 2])),
			'i1.NONE': decl('i1.NONE', qtiNull('integer', 'single')),
			'i2.N': decl('i2.N', qtiValue('integer', 'single', 3)),
			'i3.N': decl('i3.N', qtiValue('integer', 'single', 3)),
			'item.dotted.SCORE': decl('item.dotted.SCORE', qtiValue('float', 'single', 1)),
			TOTAL: decl('TOTAL', qtiValue('float', 'single', 5)),
		} as DeclarationMap;
		return {
			ctx: new DeclarationContext(decls),
			rng: () => 0.5,
			test: {
				items: [
					{ identifier: 'i1', weights: { W: 1.5 }, variables: {} },
					{ identifier: 'i2', variables: {} },
					{ identifier: 'i3', weights: { W: 2 }, variables: {} },
					{ identifier: 'item', weights: { W: 10 }, variables: {} },
					{ identifier: 'item.dotted', weights: { W: 4 }, variables: {} },
				],
			},
		};
	}

	const variable = (attrs: string) =>
		buildExpression(parseXml(`<variable ${attrs}/>`).documentElement, { scope: 'test' });

	it('keeps weightIdentifier on the variable expression', () => {
		expect(variable('identifier="i1.SCORE" weightIdentifier="W"')).toMatchObject({
			kind: 'expr.variable',
			identifier: 'i1.SCORE',
			weightIdentifier: 'W',
		});
		expect(variable('identifier="i1.SCORE"')).not.toHaveProperty('weightIdentifier');
	});

	it('multiplies a float item variable by the itemRef weight', () => {
		const env = weightedEnv();
		expect(evalExpr(env as any, variable('identifier="i1.SCORE" weightIdentifier="W"'))).toEqual(
			qtiValue('float', 'single', 3),
		);
	});

	it('leaves an unweighted lookup unchanged', () => {
		const env = weightedEnv();
		expect(evalExpr(env as any, variable('identifier="i1.SCORE"'))).toEqual(qtiValue('float', 'single', 2));
		expect(evalExpr(env as any, variable('identifier="i2.N"'))).toEqual(qtiValue('integer', 'single', 3));
	});

	it('assumes weight 1.0 when the itemRef defines no such weight, promoting to float', () => {
		const env = weightedEnv();
		expect(evalExpr(env as any, variable('identifier="i2.N" weightIdentifier="W"'))).toEqual(
			qtiValue('float', 'single', 3),
		);
		expect(evalExpr(env as any, variable('identifier="i1.SCORE" weightIdentifier="OTHER"'))).toEqual(
			qtiValue('float', 'single', 2),
		);
	});

	it('weights an integer variable into a float', () => {
		const env = weightedEnv();
		expect(evalExpr(env as any, variable('identifier="i3.N" weightIdentifier="W"'))).toEqual(
			qtiValue('float', 'single', 6),
		);
	});

	it('weights each value of a container and keeps NULL as a float NULL', () => {
		const env = weightedEnv();
		expect(evalExpr(env as any, variable('identifier="i1.M" weightIdentifier="W"'))).toEqual(
			qtiValue('float', 'multiple', [1.5, 3]),
		);
		expect(evalExpr(env as any, variable('identifier="i1.NONE" weightIdentifier="W"'))).toEqual(
			qtiNull('float', 'single'),
		);
	});

	it('ignores the weight for non-numeric item variables and for variables not looked up through an itemRef', () => {
		const env = weightedEnv();
		expect(evalExpr(env as any, variable('identifier="i1.S" weightIdentifier="W"'))).toEqual(
			qtiValue('string', 'single', 'a'),
		);
		expect(evalExpr(env as any, variable('identifier="TOTAL" weightIdentifier="W"'))).toEqual(
			qtiValue('float', 'single', 5),
		);
	});

	it('resolves the itemRef by its longest identifier prefix', () => {
		const env = weightedEnv();
		expect(evalExpr(env as any, variable('identifier="item.dotted.SCORE" weightIdentifier="W"'))).toEqual(
			qtiValue('float', 'single', 4),
		);
	});

	it('applies the weight in a test-scope outcome processing program', () => {
		const env = weightedEnv();
		(env.ctx.getAll() as DeclarationMap).TOTAL = {
			identifier: 'TOTAL',
			baseType: 'float',
			cardinality: 'single',
			value: qtiValue('float', 'single', 0),
		};
		const program = buildOutcomeProcessingAst(
			parseXml(`<outcomeProcessing>
				<setOutcomeValue identifier="TOTAL">
					<sum>
						<variable identifier="i1.SCORE" weightIdentifier="W"/>
						<variable identifier="i3.N" weightIdentifier="W"/>
					</sum>
				</setOutcomeValue>
			</outcomeProcessing>`).documentElement,
			{ scope: 'test' },
		);
		execProgram(env as any, program);
		expect(env.ctx.getValue('TOTAL')).toEqual(qtiValue('float', 'single', 9));
	});
});
