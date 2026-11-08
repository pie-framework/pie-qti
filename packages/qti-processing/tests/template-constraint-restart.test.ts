/**
 * templateConstraint (QTI ASI §10.3): when the constraint is false, "templateProcessing is
 * restarted" — the rejected pass is discarded, not built upon. Template rules other than
 * setTemplateValue also write declarations a restart must undo: setCorrectResponse changes a
 * response's correct response, and setDefaultValue changes a variable's default (and value). A
 * restart therefore restores every declaration to its state before template processing began.
 */

import { describe, expect, it } from 'bun:test';
import { buildTemplateProcessingAst } from '../src/ast/build.js';
import { OperatorRegistry } from '../src/eval/operators.js';
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
		{ ctx, ops: new OperatorRegistry(), rng: replay(draws) },
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
