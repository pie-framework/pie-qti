import { describe, expect, it } from 'bun:test';
import { buildExpression } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function makeEnv(args: { test: any }) {
	const decls: DeclarationMap = {};
	const ctx = new DeclarationContext(decls);
	const ops = new OperatorRegistry();
	return { ctx, ops, rng: () => 0.5, test: args.test };
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


