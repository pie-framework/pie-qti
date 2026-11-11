/**
 * templateConstraint (QTI ASI §10.3): when the constraint is false, "templateProcessing is
 * restarted" — the rejected pass is discarded, not built upon. Template rules other than
 * setTemplateValue also write declarations a restart must undo: setCorrectResponse changes a
 * response's correct response, and setDefaultValue changes a variable's default (and value). A
 * restart therefore restores every declaration to its state before template processing began.
 */

import { describe, expect, it } from 'bun:test';
import { buildExpression, buildTemplateProcessingAst } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

/** A random source that replays `draws`, then repeats the last one. */
function replay(draws: number[]): () => number {
	let index = 0;
	return () => draws[Math.min(index++, draws.length - 1)]!;
}

function makeDecls(): DeclarationMap {
	return {
		R: {
			identifier: 'R',
			baseType: 'identifier',
			cardinality: 'single',
			defaultValue: qtiValue('identifier', 'single', 'A'),
			value: qtiValue('identifier', 'single', 'A'),
			correctResponse: qtiValue('identifier', 'single', 'A'),
		},
		OUT: {
			identifier: 'OUT',
			baseType: 'float',
			cardinality: 'single',
			defaultValue: qtiValue('float', 'single', 0),
			value: qtiValue('float', 'single', 0),
		},
		T: {
			identifier: 'T',
			baseType: 'integer',
			cardinality: 'single',
			value: qtiValue('integer', 'single', 0),
			defaultValue: qtiValue('integer', 'single', 0),
			isTemplate: true,
		},
		T2: {
			identifier: 'T2',
			baseType: 'integer',
			cardinality: 'single',
			value: qtiValue('integer', 'single', 0),
			defaultValue: qtiValue('integer', 'single', 0),
			isTemplate: true,
		},
	};
}

/**
 * T draws 1 on the first pass and 2 on the second (randomInteger 1..2 over the replayed draws
 * 0 and 0.75). The constraint accepts only T=2, so the first pass is rejected and restarted.
 */
function runTemplate(decls: DeclarationMap, firstPassRules: string, secondPassRules = '', draws = [0, 0.75]) {
	const ctx = new DeclarationContext(decls);
	const xml = `<templateProcessing>
		<setTemplateValue identifier="T"><randomInteger min="1" max="2"/></setTemplateValue>
		<templateCondition>
			<templateIf>
				<match><variable identifier="T"/><baseValue baseType="integer">1</baseValue></match>
				${firstPassRules}
			</templateIf>
			<templateElse>${secondPassRules}</templateElse>
		</templateCondition>
		<templateConstraint>
			<match><variable identifier="T"/><baseValue baseType="integer">2</baseValue></match>
		</templateConstraint>
	</templateProcessing>`;
	execProgram(
		{ ctx, rng: replay(draws) },
		buildTemplateProcessingAst(parseXml(xml).documentElement, {}),
	);
	return ctx;
}

describe('templateConstraint restart', () => {
	it('discards a correct response set by the rejected pass', () => {
		const ctx = runTemplate(
			makeDecls(),
			`<setCorrectResponse identifier="R"><baseValue baseType="identifier">B</baseValue></setCorrectResponse>`,
		);
		expect(ctx.getValue('T')).toEqual(qtiValue('integer', 'single', 2));
		expect(ctx.getCorrectResponse('R')).toEqual(qtiValue('identifier', 'single', 'A'));
	});

	it('discards a response or outcome default set by the rejected pass', () => {
		const ctx = runTemplate(
			makeDecls(),
			`<setDefaultValue identifier="R"><baseValue baseType="identifier">C</baseValue></setDefaultValue>
			 <setDefaultValue identifier="OUT"><baseValue baseType="float">7</baseValue></setDefaultValue>`,
		);
		expect(ctx.getDefaultValue('R')).toEqual(qtiValue('identifier', 'single', 'A'));
		expect(ctx.getValue('R')).toEqual(qtiValue('identifier', 'single', 'A'));
		expect(ctx.getDefaultValue('OUT')).toEqual(qtiValue('float', 'single', 0));
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 0));
	});

	it('discards a template default set by the rejected pass', () => {
		const ctx = runTemplate(
			makeDecls(),
			`<setDefaultValue identifier="T2"><baseValue baseType="integer">5</baseValue></setDefaultValue>`,
		);
		expect(ctx.getDefaultValue('T2')).toEqual(qtiValue('integer', 'single', 0));
		expect(ctx.getValue('T2')).toEqual(qtiValue('integer', 'single', 0));
	});

	it('keeps what the accepted pass sets', () => {
		const ctx = runTemplate(
			makeDecls(),
			`<setCorrectResponse identifier="R"><baseValue baseType="identifier">B</baseValue></setCorrectResponse>`,
			`<setCorrectResponse identifier="R"><baseValue baseType="identifier">C</baseValue></setCorrectResponse>
			 <setDefaultValue identifier="OUT"><baseValue baseType="float">3</baseValue></setDefaultValue>`,
		);
		expect(ctx.getCorrectResponse('R')).toEqual(qtiValue('identifier', 'single', 'C'));
		expect(ctx.getDefaultValue('OUT')).toEqual(qtiValue('float', 'single', 3));
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 3));
	});

	it('restores the pre-processing state before continuing once the retry cap is reached', () => {
		// T always draws 1: every pass is rejected until the cap, after which processing
		// continues past the constraint from the restored state.
		const ctx = runTemplate(
			makeDecls(),
			`<setCorrectResponse identifier="R"><baseValue baseType="identifier">B</baseValue></setCorrectResponse>`,
			'',
			[0],
		);
		expect(ctx.getValue('T')).toEqual(qtiValue('integer', 'single', 0));
		expect(ctx.getCorrectResponse('R')).toEqual(qtiValue('identifier', 'single', 'A'));
	});
});

/**
 * randomInteger and randomFloat are empty elements in every QTI version (2.1 RandomInteger.Type
 * extends EmptyPrimitiveType, line 9317; 2.2 line 16462; 3.0 RandomIntegerDType line 8487; same
 * for RandomFloat): min/max/step are attributes, and the element takes no child expressions. Only
 * max is required: min is optional with default "0" for both elements (2.1 lines 3364 and 3409,
 * 2.2 lines 8515 and 8485, 3.0 lines 8490 and 8459), and randomInteger's step defaults to "1".
 */
describe('randomInteger and randomFloat element forms', () => {
	function templateOf(body: string): Element {
		return parseXml(`<templateProcessing>${body}</templateProcessing>`).documentElement;
	}

	/** Random draws 0, 1/40, …, 39/40 and just under 1, so every value of a small range comes up. */
	const SWEEP = [...Array.from({ length: 40 }, (_, i) => i / 40), 0.999_999];

	/** What `xml` yields under each draw of the sweep, as single values of `baseType`. */
	function drawsOf(xml: string, baseType: 'integer' | 'float'): number[] {
		const expression = buildExpression(parseXml(xml).documentElement);
		return SWEEP.map((draw) => {
			const v = evalExpr({ ctx: new DeclarationContext({}), rng: () => draw }, expression);
			expect(v).toMatchObject({ kind: 'value', baseType, cardinality: 'single' });
			return v.kind === 'value' ? Number(v.value) : Number.NaN;
		});
	}

	const distinct = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);

	it('draws an integer from the min/max/step attributes and a float from min/max', () => {
		const ctx = new DeclarationContext(makeDecls());
		execProgram(
			{ ctx, rng: replay([0.5]) },
			buildTemplateProcessingAst(
				templateOf(`<setTemplateValue identifier="T"><randomInteger min="1" max="5" step="2"/></setTemplateValue>
					<setTemplateValue identifier="T2"><randomFloat min="0" max="1"/></setTemplateValue>`),
				{},
			),
		);
		// count = floor((5-1)/2)+1 = 3, k = floor(0.5*3) = 1, so 1 + 2*1 = 3; the float draws 0.5.
		expect(ctx.getValue('T')).toEqual(qtiValue('integer', 'single', 3));
		expect(ctx.getValue('T2')).toEqual(qtiValue('float', 'single', 0.5));
	});

	it('defaults an absent min to 0: <randomInteger max="3"/> only ever yields 0..3', () => {
		const values = drawsOf('<randomInteger max="3"/>', 'integer');
		expect(values.every((n) => Number.isInteger(n) && n >= 0 && n <= 3)).toBe(true);
		expect(distinct(values)).toEqual([0, 1, 2, 3]);
	});

	it('defaults an absent min to 0: <randomFloat max="1.5"/> yields values in [0, 1.5]', () => {
		const values = drawsOf('<randomFloat max="1.5"/>', 'float');
		expect(values.every((x) => x >= 0 && x <= 1.5)).toBe(true);
		// The lowest draw lands on the defaulted min, the highest just under max.
		expect(Math.min(...values)).toBe(0);
		expect(Math.max(...values)).toBeGreaterThan(1.49);
	});

	it('still requires max on both elements', () => {
		for (const xml of ['<randomInteger/>', '<randomInteger min="1" step="2"/>']) {
			expect(() => buildExpression(parseXml(xml).documentElement)).toThrow('<randomInteger> requires a max attribute');
		}
		for (const xml of ['<randomFloat/>', '<randomFloat min="0.5"/>']) {
			expect(() => buildExpression(parseXml(xml).documentElement)).toThrow('<randomFloat> requires a max attribute');
		}
	});

	it('still steps by 1 when step is absent, as its XSD default reads', () => {
		expect(drawsOf('<randomInteger max="3"/>', 'integer')).toEqual(drawsOf('<randomInteger max="3" step="1"/>', 'integer'));
		expect(drawsOf('<randomInteger min="2" max="5"/>', 'integer')).toEqual(
			drawsOf('<randomInteger min="2" max="5" step="1"/>', 'integer'),
		);
		expect(distinct(drawsOf('<randomInteger min="2" max="5"/>', 'integer'))).toEqual([2, 3, 4, 5]);
		// An explicit step does thin the range, so the equalities above are not vacuous.
		expect(distinct(drawsOf('<randomInteger max="3" step="2"/>', 'integer'))).toEqual([0, 2]);
	});

	it('is a compile error for the child-expression form no QTI version defines', () => {
		// The legacy form carries min and max as children, so it has no max attribute.
		const childForm = '<setTemplateValue identifier="T"><randomInteger><baseValue baseType="integer">1</baseValue><baseValue baseType="integer">5</baseValue></randomInteger></setTemplateValue>';
		expect(() => buildTemplateProcessingAst(templateOf(childForm), {})).toThrow(
			'<randomInteger> requires a max attribute',
		);
		const floatChildForm = '<setTemplateValue identifier="T"><randomFloat><baseValue baseType="float">0</baseValue><baseValue baseType="float">1</baseValue></randomFloat></setTemplateValue>';
		expect(() => buildTemplateProcessingAst(templateOf(floatChildForm), {})).toThrow(
			'<randomFloat> requires a max attribute',
		);
	});
});
