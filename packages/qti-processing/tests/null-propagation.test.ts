/**
 * NULL propagation through the boolean operators (QTI ASI §15.3, carried to QTI 2.2 and 3.0):
 * match, member, stringMatch, patternMatch, lt, lte, gt, gte and not result in NULL when an
 * operand is NULL; and/or follow three-valued logic; a condition that is NULL is not true, so
 * a responseIf / responseElseIf with a NULL condition passes to the next branch.
 */

import { describe, expect, it } from 'bun:test';
import { buildExpression, buildResponseProcessingAst } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { BaseType, Cardinality, DeclarationMap, QtiValue } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

function declaration(identifier: string, baseType: BaseType, cardinality: Cardinality, value: QtiValue): DeclarationMap[string] {
	return { identifier, baseType, cardinality, defaultValue: value, value };
}

function evaluate(xml: string, decls: DeclarationMap = {}): QtiValue {
	const expression = buildExpression(parseXml(xml).documentElement);
	return evalExpr({ ctx: new DeclarationContext(decls), ops: new OperatorRegistry(), rng: () => 0.5 }, expression);
}

const BOOLEAN_NULL = { kind: 'null', baseType: 'boolean', cardinality: 'single' };
const yes = qtiValue('boolean', 'single', true);
const no = qtiValue('boolean', 'single', false);

const TRUE = '<baseValue baseType="boolean">true</baseValue>';
const FALSE = '<baseValue baseType="boolean">false</baseValue>';
const NULL = '<null/>';
const id = (text: string): string => `<baseValue baseType="identifier">${text}</baseValue>`;
const str = (text: string): string => `<baseValue baseType="string">${text}</baseValue>`;
const int = (n: number): string => `<baseValue baseType="integer">${n}</baseValue>`;

describe('operators with a NULL operand result in NULL', () => {
	const cases: Array<[string, string]> = [
		['match(NULL, A)', `<match>${NULL}${id('A')}</match>`],
		['match(A, NULL)', `<match>${id('A')}${NULL}</match>`],
		['match(NULL, NULL)', `<match>${NULL}${NULL}</match>`],
		['member(A, NULL)', `<member>${id('A')}${NULL}</member>`],
		['member(NULL, {A})', `<member>${NULL}<multiple>${id('A')}</multiple></member>`],
		['stringMatch(NULL, "a")', `<stringMatch caseSensitive="true">${NULL}${str('a')}</stringMatch>`],
		['stringMatch("a", NULL)', `<stringMatch caseSensitive="false" substring="true">${str('a')}${NULL}</stringMatch>`],
		['patternMatch(NULL)', `<patternMatch pattern="a+">${NULL}</patternMatch>`],
		['lt(NULL, 1)', `<lt>${NULL}${int(1)}</lt>`],
		['lt(1, NULL)', `<lt>${int(1)}${NULL}</lt>`],
		['lte(NULL, 1)', `<lte>${NULL}${int(1)}</lte>`],
		['gt(NULL, 1)', `<gt>${NULL}${int(1)}</gt>`],
		['gte(1, NULL)', `<gte>${int(1)}${NULL}</gte>`],
		['not(NULL)', `<not>${NULL}</not>`],
		['not(not(NULL))', `<not><not>${NULL}</not></not>`],
		['not(match(NULL, A))', `<not><match>${NULL}${id('A')}</match></not>`],
	];
	for (const [name, xml] of cases) {
		it(name, () => {
			expect(evaluate(xml)).toEqual(BOOLEAN_NULL);
		});
	}

	it('reads an unanswered (empty) container and a value-less value as NULL', () => {
		const decls: DeclarationMap = {
			EMPTY: declaration('EMPTY', 'identifier', 'multiple', qtiValue('identifier', 'multiple', [])),
			VALUELESS: declaration('VALUELESS', 'integer', 'single', qtiValue('integer', 'single', null)),
		};
		expect(evaluate(`<match><variable identifier="EMPTY"/><multiple>${id('A')}</multiple></match>`, decls)).toEqual(BOOLEAN_NULL);
		expect(evaluate(`<member>${id('A')}<variable identifier="EMPTY"/></member>`, decls)).toEqual(BOOLEAN_NULL);
		expect(evaluate(`<lt><variable identifier="VALUELESS"/>${int(5)}</lt>`, decls)).toEqual(BOOLEAN_NULL);
		expect(evaluate('<not><variable identifier="EMPTY"/></not>', decls)).toEqual(BOOLEAN_NULL);
	});

	it('keeps the results for operands that are not NULL', () => {
		expect(evaluate(`<match>${id('A')}${id('A')}</match>`)).toEqual(yes);
		expect(evaluate(`<member>${id('B')}<multiple>${id('A')}</multiple></member>`)).toEqual(no);
		expect(evaluate(`<stringMatch caseSensitive="false">${str('Paris')}${str('paris')}</stringMatch>`)).toEqual(yes);
		expect(evaluate(`<patternMatch pattern="a+">${str('aaa')}</patternMatch>`)).toEqual(yes);
		expect(evaluate(`<lt>${int(1)}${int(2)}</lt>`)).toEqual(yes);
		expect(evaluate(`<lte>${int(2)}${int(2)}</lte>`)).toEqual(yes);
		expect(evaluate(`<gt>${int(1)}${int(2)}</gt>`)).toEqual(no);
		expect(evaluate(`<gte>${int(2)}${int(3)}</gte>`)).toEqual(no);
		expect(evaluate(`<not>${TRUE}</not>`)).toEqual(no);
		expect(evaluate(`<not>${FALSE}</not>`)).toEqual(yes);
	});
});

describe('and / or follow three-valued logic', () => {
	// QTI: and is "false if any of them are false", NULL "if one or more sub-expressions are
	// NULL and all others are true"; or is "true if any of the sub-expressions are true", NULL
	// "if one or more sub-expressions are NULL and all the others are false".
	const cases: Array<[string, string, QtiValue | typeof BOOLEAN_NULL]> = [
		['and(true, true)', `<and>${TRUE}${TRUE}</and>`, yes],
		['and(true, false)', `<and>${TRUE}${FALSE}</and>`, no],
		['and(true, NULL)', `<and>${TRUE}${NULL}</and>`, BOOLEAN_NULL],
		['and(NULL, NULL)', `<and>${NULL}${NULL}</and>`, BOOLEAN_NULL],
		['and(false, NULL)', `<and>${FALSE}${NULL}</and>`, no],
		['and(NULL, false)', `<and>${NULL}${FALSE}</and>`, no],
		['or(false, false)', `<or>${FALSE}${FALSE}</or>`, no],
		['or(false, true)', `<or>${FALSE}${TRUE}</or>`, yes],
		['or(false, NULL)', `<or>${FALSE}${NULL}</or>`, BOOLEAN_NULL],
		['or(NULL, NULL)', `<or>${NULL}${NULL}</or>`, BOOLEAN_NULL],
		['or(true, NULL)', `<or>${TRUE}${NULL}</or>`, yes],
		['or(NULL, true)', `<or>${NULL}${TRUE}</or>`, yes],
		['not(and(true, NULL))', `<not><and>${TRUE}${NULL}</and></not>`, BOOLEAN_NULL],
		['not(or(false, NULL))', `<not><or>${FALSE}${NULL}</or></not>`, BOOLEAN_NULL],
	];
	for (const [name, xml, expected] of cases) {
		it(name, () => {
			expect(evaluate(xml)).toEqual(expected);
		});
	}
});

describe('a NULL condition is not true at the branch', () => {
	function scoreBranches(response: QtiValue, cardinality: Cardinality, conditions: string): DeclarationContext {
		const outcome = (identifier: string) =>
			declaration(identifier, 'float', 'single', qtiValue('float', 'single', 0));
		const correct = cardinality === 'single'
			? qtiValue('identifier', 'single', 'A')
			: qtiValue('identifier', cardinality, ['A']);
		const decls: DeclarationMap = {
			RESPONSE: { ...declaration('RESPONSE', 'identifier', cardinality, response), correctResponse: correct },
			IF: outcome('IF'),
			ELSEIF: outcome('ELSEIF'),
			ELSE: outcome('ELSE'),
		};
		const ctx = new DeclarationContext(decls);
		const rp = parseXml(`<responseProcessing>${conditions}</responseProcessing>`).documentElement;
		execProgram({ ctx, ops: new OperatorRegistry(), rng: () => 0.5 }, buildResponseProcessingAst(rp, {}));
		return ctx;
	}

	const set = (identifier: string) =>
		`<setOutcomeValue identifier="${identifier}"><baseValue baseType="float">1</baseValue></setOutcomeValue>`;
	const NOT_MATCH = '<not><match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match></not>';
	const NOT_WRONG = `<responseCondition><responseIf>${NOT_MATCH}${set('IF')}</responseIf><responseElse>${set('ELSE')}</responseElse></responseCondition>`;

	const unanswered: Array<[string, QtiValue, Cardinality]> = [
		['a NULL response', qtiNull('identifier', 'single'), 'single'],
		['a value-less response', qtiValue('identifier', 'single', null), 'single'],
		['an unanswered multiple response (empty container)', qtiValue('identifier', 'multiple', []), 'multiple'],
	];
	for (const [name, response, cardinality] of unanswered) {
		it(`responseIf(not(match(RESPONSE, correct))) takes the else branch for ${name}`, () => {
			const ctx = scoreBranches(response, cardinality, NOT_WRONG);
			expect(ctx.getValue('IF')).toEqual(qtiValue('float', 'single', 0));
			expect(ctx.getValue('ELSE')).toEqual(qtiValue('float', 'single', 1));
		});
	}

	it('takes the if branch for a wrong answer', () => {
		const ctx = scoreBranches(qtiValue('identifier', 'single', 'B'), 'single', NOT_WRONG);
		expect(ctx.getValue('IF')).toEqual(qtiValue('float', 'single', 1));
		expect(ctx.getValue('ELSE')).toEqual(qtiValue('float', 'single', 0));
	});

	it('passes a NULL responseElseIf condition to the else branch', () => {
		const rules = `<responseCondition>
			<responseIf><match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>${set('IF')}</responseIf>
			<responseElseIf>${NOT_MATCH}${set('ELSEIF')}</responseElseIf>
			<responseElse>${set('ELSE')}</responseElse>
		</responseCondition>`;
		const ctx = scoreBranches(qtiNull('identifier', 'single'), 'single', rules);
		expect(ctx.getValue('IF')).toEqual(qtiValue('float', 'single', 0));
		expect(ctx.getValue('ELSEIF')).toEqual(qtiValue('float', 'single', 0));
		expect(ctx.getValue('ELSE')).toEqual(qtiValue('float', 'single', 1));
	});
});
