import { describe, expect, it } from 'bun:test';
import { buildExpression, buildResponseProcessingAst } from '../src/ast/build.js';
import { evalExpr } from '../src/eval/evaluator.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap, QtiValue } from '../src/runtime/types.js';
import {
	coerceBaseValue,
	durationSeconds,
	durationSecondsFromMilliseconds,
	parseDurationSeconds,
	qtiNull,
	qtiValue,
	toNumber,
} from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

/**
 * QTI 2.2 and 3.0 define `duration` as "a single float that records time in seconds" (xsd:double),
 * and the built-in `duration` response variable as the accumulated time in seconds.
 */

function evaluate(xml: string, decls: DeclarationMap = {}): QtiValue {
	const ctx = new DeclarationContext(decls);
	return evalExpr(
		{ ctx, ops: new OperatorRegistry(), rng: () => 0.5 },
		buildExpression(parseXml(xml).documentElement, {}),
	);
}

function durationDeclaration(identifier: string, seconds: number | null): DeclarationMap[string] {
	const value = seconds === null ? qtiNull('duration', 'single') : qtiValue('duration', 'single', seconds);
	return { identifier, baseType: 'duration', cardinality: 'single', defaultValue: value, value };
}

describe('duration lexical forms', () => {
	it('reads the xsd:double lexical form as seconds', () => {
		expect(parseDurationSeconds('30')).toBe(30);
		expect(parseDurationSeconds(' 2.5 ')).toBe(2.5);
		expect(parseDurationSeconds('.5')).toBe(0.5);
		expect(parseDurationSeconds('1e2')).toBe(100);
	});

	it('accepts ISO 8601 durations as seconds', () => {
		expect(parseDurationSeconds('PT30S')).toBe(30);
		expect(parseDurationSeconds('PT1M30.5S')).toBe(90.5);
		expect(parseDurationSeconds('PT1H')).toBe(3600);
		expect(parseDurationSeconds('P1DT1S')).toBe(86_401);
	});

	it('rejects malformed durations', () => {
		for (const text of ['', 'abc', 'P', 'PT', 'P1DT', 'INF', 'NaN', '30s', 'PT-5S']) {
			expect(parseDurationSeconds(text)).toBeNull();
		}
	});

	it('coerces a duration baseValue to seconds, and an unreadable one to invalid', () => {
		expect(coerceBaseValue('duration', '10')).toEqual(qtiValue('duration', 'single', 10));
		expect(coerceBaseValue('duration', 'PT10S')).toEqual(qtiValue('duration', 'single', 10));
		expect(coerceBaseValue('duration', 'ten').kind).toBe('invalid');
	});

	it('reads numeric and literal runtime durations as seconds', () => {
		expect(durationSeconds(12.5)).toBe(12.5);
		expect(durationSeconds('PT12.5S')).toBe(12.5);
		expect(durationSeconds(Number.NaN)).toBeNull();
		expect(durationSeconds({})).toBeNull();
		expect(toNumber(qtiValue('duration', 'single', 'PT2S'))).toBe(2);
	});

	it('truncates elapsed milliseconds to a duration in seconds', () => {
		expect(durationSecondsFromMilliseconds(1500)).toBe(1.5);
		expect(durationSecondsFromMilliseconds(1999.9)).toBe(1.999);
		expect(durationSecondsFromMilliseconds(-5)).toBe(0);
		expect(durationSecondsFromMilliseconds(Number.NaN)).toBe(0);
	});
});

describe('durationLT and durationGTE', () => {
	it('compares the built-in duration, in seconds, to a seconds baseValue', () => {
		const decls = { duration: durationDeclaration('duration', 12.5) };
		expect(
			evaluate('<durationLT><variable identifier="duration"/><baseValue baseType="duration">20</baseValue></durationLT>', decls),
		).toEqual(qtiValue('boolean', 'single', true));
		expect(
			evaluate('<durationGTE><variable identifier="duration"/><baseValue baseType="duration">10</baseValue></durationGTE>', decls),
		).toEqual(qtiValue('boolean', 'single', true));
		expect(
			evaluate('<durationGTE><variable identifier="duration"/><baseValue baseType="duration">12.6</baseValue></durationGTE>', decls),
		).toEqual(qtiValue('boolean', 'single', false));
	});

	it('normalizes both operands, so ISO 8601 and seconds compare as one scale', () => {
		expect(
			evaluate(
				'<durationLT><baseValue baseType="duration">PT1M</baseValue><baseValue baseType="duration">61</baseValue></durationLT>',
			),
		).toEqual(qtiValue('boolean', 'single', true));
		expect(
			evaluate(
				'<durationGTE><baseValue baseType="duration">60</baseValue><baseValue baseType="duration">PT1M</baseValue></durationGTE>',
			),
		).toEqual(qtiValue('boolean', 'single', true));
	});

	it('normalizes a variable holding a duration literal', () => {
		const decls = {
			LIMIT: {
				identifier: 'LIMIT',
				baseType: 'duration' as const,
				cardinality: 'single' as const,
				value: qtiValue('duration', 'single', 'PT30S'),
			},
		};
		expect(
			evaluate('<durationLT><baseValue baseType="duration">29.9</baseValue><variable identifier="LIMIT"/></durationLT>', decls),
		).toEqual(qtiValue('boolean', 'single', true));
	});

	it('is NULL when either operand is NULL', () => {
		const decls = { duration: durationDeclaration('duration', null) };
		expect(
			evaluate('<durationLT><variable identifier="duration"/><baseValue baseType="duration">5</baseValue></durationLT>', decls),
		).toEqual(qtiNull('boolean', 'single'));
		expect(evaluate('<durationGTE><null/><baseValue baseType="duration">5</baseValue></durationGTE>').kind).toBe('null');
	});

	it('is invalid, never a silent false, for a malformed duration', () => {
		const decls = {
			BROKEN: {
				identifier: 'BROKEN',
				baseType: 'duration' as const,
				cardinality: 'single' as const,
				value: qtiValue('duration', 'single', 'soon'),
			},
		};
		expect(
			evaluate('<durationLT><variable identifier="BROKEN"/><baseValue baseType="duration">5</baseValue></durationLT>', decls).kind,
		).toBe('invalid');
		expect(
			evaluate('<durationGTE><baseValue baseType="duration">later</baseValue><baseValue baseType="duration">5</baseValue></durationGTE>').kind,
		).toBe('invalid');
	});

	it('is invalid for operands that are not durations', () => {
		expect(
			evaluate('<durationLT><baseValue baseType="float">1</baseValue><baseValue baseType="duration">5</baseValue></durationLT>').kind,
		).toBe('invalid');
	});
});

describe('match and equal on durations', () => {
	it('compare durations by their seconds, however they are written', () => {
		expect(
			evaluate('<match><baseValue baseType="duration">PT1H</baseValue><baseValue baseType="duration">3600</baseValue></match>'),
		).toEqual(qtiValue('boolean', 'single', true));
		expect(
			evaluate('<equal><baseValue baseType="duration">90.0</baseValue><baseValue baseType="duration">PT1M30S</baseValue></equal>'),
		).toEqual(qtiValue('boolean', 'single', true));
		expect(
			evaluate('<match><baseValue baseType="duration">PT1H</baseValue><baseValue baseType="duration">3599</baseValue></match>'),
		).toEqual(qtiValue('boolean', 'single', false));
	});
});

describe('response processing on the built-in duration', () => {
	it('sets an outcome from a seconds threshold', () => {
		const decls: DeclarationMap = {
			duration: durationDeclaration('duration', 42.25),
			FAST: {
				identifier: 'FAST',
				baseType: 'boolean',
				cardinality: 'single',
				value: qtiValue('boolean', 'single', false),
			},
		};
		const ctx = new DeclarationContext(decls);
		execProgram(
			{ ctx, ops: new OperatorRegistry(), rng: () => 0.5 },
			buildResponseProcessingAst(
				parseXml(`<responseProcessing>
					<responseCondition>
						<responseIf>
							<durationLT><variable identifier="duration"/><baseValue baseType="duration">60</baseValue></durationLT>
							<setOutcomeValue identifier="FAST"><baseValue baseType="boolean">true</baseValue></setOutcomeValue>
						</responseIf>
					</responseCondition>
				</responseProcessing>`).documentElement,
				{},
			),
		);
		expect(ctx.getValue('FAST')).toEqual(qtiValue('boolean', 'single', true));
	});
});
