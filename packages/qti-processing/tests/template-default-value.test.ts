/**
 * setDefaultValue (QTI ASI §10.3): a template rule that CHANGES the variable's
 * default value. The rule carries one expression; later resets of the variable
 * (attempt starts, response-processing outcome resets, templateConstraint
 * restarts) use the new default (§5.1). It is not a response-processing rule.
 */

import { describe, expect, it } from 'bun:test';
import {
	buildResponseProcessingAst,
	buildTemplateProcessingAst,
} from '../src/ast/build.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function program(kind: 'template' | 'response', body: string): Element {
	return parseXml(
		kind === 'template'
			? `<templateProcessing>${body}</templateProcessing>`
			: `<responseProcessing>${body}</responseProcessing>`,
	).documentElement;
}

function runTemplate(decls: DeclarationMap, body: string): DeclarationContext {
	const ctx = new DeclarationContext(decls);
	execProgram(
		{ ctx, ops: new OperatorRegistry(), rng: () => 0.5 },
		buildTemplateProcessingAst(program('template', body), {}),
	);
	return ctx;
}

function makeDecls(): DeclarationMap {
	return {
		R: {
			identifier: 'R',
			baseType: 'identifier',
			cardinality: 'single',
			defaultValue: qtiValue('identifier', 'single', 'A'),
			value: qtiValue('identifier', 'single', 'A'),
		},
		T1: {
			identifier: 'T1',
			baseType: 'integer',
			cardinality: 'single',
			defaultValue: qtiValue('integer', 'single', 0),
			value: qtiValue('integer', 'single', 0),
			isTemplate: true,
		},
		T2: {
			identifier: 'T2',
			baseType: 'integer',
			cardinality: 'single',
			defaultValue: qtiValue('integer', 'single', 0),
			value: qtiValue('integer', 'single', 0),
			isTemplate: true,
		},
		OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
	};
}

describe('setDefaultValue', () => {
	it('changes the variable to the value of its expression and updates the default', () => {
		const ctx = runTemplate(
			makeDecls(),
			`<setDefaultValue identifier="R"><baseValue baseType="identifier">C</baseValue></setDefaultValue>`,
		);
		expect(ctx.getValue('R')).toEqual(qtiValue('identifier', 'single', 'C'));
		expect(ctx.getDefaultValue('R')).toEqual(qtiValue('identifier', 'single', 'C'));
	});

	it('keeps the expression, so later resets use the new default (§5.1)', () => {
		const ctx = runTemplate(
			makeDecls(),
			`<setDefaultValue identifier="R"><baseValue baseType="identifier">C</baseValue></setDefaultValue>`,
		);
		ctx.resetToDefault('R');
		expect(ctx.getValue('R')).toEqual(qtiValue('identifier', 'single', 'C'));
	});

	it('takes its value from an expression over other variables', () => {
		const ctx = runTemplate(
			makeDecls(),
			`<setTemplateValue identifier="T1"><baseValue baseType="integer">5</baseValue></setTemplateValue>
       <setDefaultValue identifier="T2"><variable identifier="T1"/></setDefaultValue>`,
		);
		expect(ctx.getValue('T2')).toEqual(qtiValue('integer', 'single', 5));
		expect(ctx.getDefaultValue('T2')).toEqual(qtiValue('integer', 'single', 5));
	});

	it('the default expression answers the new default during response processing', () => {
		const decls = makeDecls();
		const ctx = runTemplate(
			decls,
			`<setDefaultValue identifier="R"><baseValue baseType="identifier">C</baseValue></setDefaultValue>`,
		);
		execProgram(
			{ ctx, ops: new OperatorRegistry(), rng: () => 0.5 },
			buildResponseProcessingAst(
				program('response', `<setOutcomeValue identifier="OUT"><default identifier="R"/></setOutcomeValue>`),
				{},
			),
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('identifier', 'single', 'C'));
	});

	it('is a template rule: response processing does not compile it', () => {
		const responseProgram = buildResponseProcessingAst(
			program('response', `<setDefaultValue identifier="R"><baseValue baseType="identifier">C</baseValue></setDefaultValue>`),
			{},
		);
		expect(responseProgram.statements).toHaveLength(0);

		const templateProgram = buildTemplateProcessingAst(
			program('template', `<setDefaultValue identifier="R"><baseValue baseType="identifier">C</baseValue></setDefaultValue>`),
			{},
		);
		expect(templateProgram.statements).toHaveLength(1);
	});
});
