import { describe, expect, it } from 'bun:test';
import { buildExpression, buildResponseProcessingAst } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function makeEnv(decls: DeclarationMap) {
	return {
		ctx: new DeclarationContext(decls),
		ops: new OperatorRegistry(),
		rng: () => 0.5,
	};
}

describe('qti-processing index@n', () => {
	it('parses QTI index@n as a one-child container expression plus numeric index', () => {
		const doc = parseXml('<index n="1"><variable identifier="RESPONSE"/></index>');

		const expr = buildExpression(doc.documentElement, { scope: 'item' });

		expect(expr.kind).toBe('expr.index');
		if (expr.kind !== 'expr.index') return;
		expect(expr.container).toMatchObject({
			kind: 'expr.variable',
			identifier: 'RESPONSE',
		});
		expect(expr.index).toMatchObject({
			kind: 'expr.baseValue',
			baseType: 'integer',
			text: '1',
		});
	});

	it('preserves identifier-backed index@n runtime lookup semantics', () => {
		const doc = parseXml('<index n="POSITION"><variable identifier="RESPONSE"/></index>');
		const expr = buildExpression(doc.documentElement, { scope: 'item' });
		const env = makeEnv({
			RESPONSE: {
				identifier: 'RESPONSE',
				baseType: 'identifier',
				cardinality: 'ordered',
				defaultValue: qtiValue('identifier', 'ordered', ['A', 'B', 'C']),
				value: qtiValue('identifier', 'ordered', ['A', 'B', 'C']),
			},
			POSITION: {
				identifier: 'POSITION',
				baseType: 'integer',
				cardinality: 'single',
				defaultValue: qtiValue('integer', 'single', 2),
				value: qtiValue('integer', 'single', 2),
			},
		});

		const out = evalExpr(env, expr);

		expect(out).toEqual(qtiValue('identifier', 'single', 'B'));
	});

	it('evaluates index@n with QTI 1-based and out-of-range behavior', () => {
		const env = makeEnv({
			RESPONSE: {
				identifier: 'RESPONSE',
				baseType: 'identifier',
				cardinality: 'ordered',
				defaultValue: qtiValue('identifier', 'ordered', ['Line1', 'Line2']),
				value: qtiValue('identifier', 'ordered', ['Line1', 'Line2']),
			},
		});

		const first = buildExpression(parseXml('<index n="1"><variable identifier="RESPONSE"/></index>').documentElement, {
			scope: 'item',
		});
		const second = buildExpression(parseXml('<index n="2"><variable identifier="RESPONSE"/></index>').documentElement, {
			scope: 'item',
		});
		const outOfRange = buildExpression(
			parseXml('<index n="3"><variable identifier="RESPONSE"/></index>').documentElement,
			{ scope: 'item' },
		);

		expect(evalExpr(env, first)).toEqual(qtiValue('identifier', 'single', 'Line1'));
		expect(evalExpr(env, second)).toEqual(qtiValue('identifier', 'single', 'Line2'));
		expect(evalExpr(env, outOfRange)).toMatchObject({
			kind: 'null',
			baseType: 'identifier',
			cardinality: 'single',
		});
	});

	it('keeps unknown processing statements strict, <console> included', () => {
		// <console> is no QTI statement (none of the 2.1/2.2/3.0 XSDs define it), so it errors like
		// any other unknown element instead of being silently ignored.
		const vendor = parseXml('<responseProcessing><vendorRule>nope</vendorRule></responseProcessing>');
		expect(() => buildResponseProcessingAst(vendor.documentElement)).toThrow(
			'Unknown processing statement tag: <vendorrule> (mode=response)',
		);
		const consoleEl = parseXml('<responseProcessing><console>PART1</console></responseProcessing>');
		expect(() => buildResponseProcessingAst(consoleEl.documentElement)).toThrow(
			'Unknown processing statement tag: <console> (mode=response)',
		);
	});
});
