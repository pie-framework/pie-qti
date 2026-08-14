import { describe, expect, it } from 'bun:test';
import { buildResponseProcessingAst } from '../src/ast/build.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function responseProcessing(body: string): Element {
	return parseXml(`<responseProcessing>${body}</responseProcessing>`).documentElement;
}

function run(decls: DeclarationMap, body: string): DeclarationContext {
	const ctx = new DeclarationContext(decls);
	execProgram(
		{ ctx, ops: new OperatorRegistry(), rng: () => 0.5 },
		buildResponseProcessingAst(responseProcessing(body), {}),
	);
	return ctx;
}

function declaration(baseType: 'integer' | 'float', value: unknown): DeclarationMap[string] {
	return {
		identifier: 'OUT',
		baseType,
		cardinality: 'single',
		defaultValue: qtiValue(baseType, 'single', value),
		value: qtiValue(baseType, 'single', value),
	};
}

function numericDecls(outBaseType: 'integer' | 'float' = 'integer'): DeclarationMap {
	return {
		OUT: { ...declaration(outBaseType, 0), identifier: 'OUT' },
		A: { ...declaration('integer', 3), identifier: 'A' },
		B: { ...declaration('integer', 4), identifier: 'B' },
		F: { ...declaration('float', 1.5), identifier: 'F' },
	};
}

function outValue(ctx: DeclarationContext): QtiValue {
	return ctx.getValue('OUT');
}

describe('numeric operator base types', () => {
	// QTI 2.2: sum/subtract/product/max/min yield a single float, or a single integer when
	// every sub-expression is an integer. `match` is base-type strict, so widening an
	// all-integer result to float silently stops it matching integer variables.
	const cases: Array<{ name: string; body: string; expected: number }> = [
		{
			name: 'sum',
			body: '<sum><variable identifier="A"/><variable identifier="B"/></sum>',
			expected: 7,
		},
		{
			name: 'subtract',
			body: '<subtract><variable identifier="B"/><variable identifier="A"/></subtract>',
			expected: 1,
		},
		{
			name: 'product',
			body: '<product><variable identifier="A"/><variable identifier="B"/></product>',
			expected: 12,
		},
		{
			name: 'max',
			body: '<max><variable identifier="A"/><variable identifier="B"/></max>',
			expected: 4,
		},
		{
			name: 'min',
			body: '<min><variable identifier="A"/><variable identifier="B"/></min>',
			expected: 3,
		},
	];

	for (const { name, body, expected } of cases) {
		it(`${name} of integers stays an integer`, () => {
			const ctx = run(numericDecls(), `<setOutcomeValue identifier="OUT">${body}</setOutcomeValue>`);
			const out = outValue(ctx);
			expect(out.kind).toBe('value');
			expect(out.baseType).toBe('integer');
			expect((out as { value: unknown }).value).toBe(expected);
		});
	}

	it('widens to float as soon as one operand is a float', () => {
		const ctx = run(
			numericDecls('float'),
			'<setOutcomeValue identifier="OUT"><sum><variable identifier="A"/><variable identifier="F"/></sum></setOutcomeValue>',
		);
		const out = outValue(ctx);
		expect(out.baseType).toBe('float');
		expect((out as { value: unknown }).value).toBe(4.5);
	});

	it('matches an integer variable against an all-integer sum', () => {
		const decls = numericDecls('float');
		decls.RESPONSE = { ...declaration('integer', 7), identifier: 'RESPONSE' };
		const ctx = run(
			decls,
			[
				'<responseCondition><responseIf>',
				'<match><variable identifier="RESPONSE"/><sum><variable identifier="A"/><variable identifier="B"/></sum></match>',
				'<setOutcomeValue identifier="OUT"><baseValue baseType="float">1</baseValue></setOutcomeValue>',
				'</responseIf></responseCondition>',
			].join(''),
		);
		expect((outValue(ctx) as { value: unknown }).value).toBe(1);
	});

	it('conforms an assigned value to the declared numeric base type', () => {
		// A float-typed result assigned to an integer declaration is restamped, so later
		// base-type-strict comparisons against integers still hold.
		const decls = numericDecls('integer');
		const ctx = run(
			decls,
			'<setOutcomeValue identifier="OUT"><sum><variable identifier="F"/><variable identifier="F"/></sum></setOutcomeValue>',
		);
		const out = outValue(ctx);
		expect(out.baseType).toBe('integer');
		expect((out as { value: unknown }).value).toBe(3);
	});

	it('leaves a fractional value assigned to an integer declaration alone', () => {
		const decls = numericDecls('integer');
		const ctx = run(
			decls,
			'<setOutcomeValue identifier="OUT"><variable identifier="F"/></setOutcomeValue>',
		);
		const out = outValue(ctx);
		expect(out.baseType).toBe('float');
		expect((out as { value: unknown }).value).toBe(1.5);
	});
});
