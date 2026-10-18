/**
 * Mapping expressions: mapResponse, mapResponsePoint, and mapOutcome — the
 * author-facing scoring features for partially-credited and spatial items.
 */

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

function responseDecl(
	value: unknown,
	mapping?: DeclarationMap['RESPONSE']['mapping'],
	baseType: DeclarationMap['RESPONSE']['baseType'] = 'identifier',
	cardinality: DeclarationMap['RESPONSE']['cardinality'] = 'single',
): DeclarationMap['RESPONSE'] {
	return {
		identifier: 'RESPONSE',
		baseType,
		cardinality,
		value: qtiValue(baseType, cardinality, value),
		mapping,
	};
}

function outcomeDecl(identifier: string, value: unknown, mapping?: DeclarationMap['OUT']['mapping']): DeclarationMap['OUT'] {
	return {
		identifier,
		baseType: 'identifier',
		cardinality: 'single',
		value: qtiValue('identifier', 'single', value),
		mapping,
	};
}

describe('mapResponse', () => {
	const MAPPING = {
		defaultValue: 0,
		entries: {
			A: { mapKey: 'A', mappedValue: 2 },
			B: { mapKey: 'B', mappedValue: 1 },
		},
	};

	it('maps a single response to its mapped value', () => {
		const ctx = run(
			{ OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) }, RESPONSE: responseDecl('A', MAPPING) },
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 2));
	});

	it('answers with the mapping default for an unlisted key', () => {
		const ctx = run(
			{ OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) }, RESPONSE: responseDecl('Z', MAPPING) },
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 0));
	});

	it('answers with the mapping default when nothing was responded', () => {
		const ctx = run(
			{ OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) }, RESPONSE: responseDecl(null, MAPPING) },
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 0));
	});

	it('sums mapped values across a multiple-cardinality response', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl(['A', 'B', 'A'], MAPPING, 'identifier', 'multiple'),
			},
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 5));
	});

	it('clamps the summed value to the declared upper bound', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl(['A', 'A', 'A'], { ...MAPPING, upperBound: 4 }, 'identifier', 'multiple'),
			},
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 4));
	});

	it('keeps directed-pair direction significant, per the QTI base type', () => {
		const PAIR_MAPPING = {
			defaultValue: 0,
			entries: {
				'W1 G1': { mapKey: 'W1 G1', mappedValue: 1 },
			},
		};
		const runPair = (response: string) =>
			run(
				{
					OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
					RESPONSE: responseDecl(response, PAIR_MAPPING, 'directedPair'),
				},
				`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
			).getValue('OUT');

		// The authored direction scores; the reversed pair does not.
		expect(runPair('W1 G1')).toEqual(qtiValue('float', 'single', 1));
		expect(runPair('G1 W1')).toEqual(qtiValue('float', 'single', 0));
	});
});

describe('mapResponsePoint', () => {
	const AREA_MAPPING = {
		defaultValue: 0,
		entries: [
			{ shape: 'circle' as const, coords: '50,50,10', mappedValue: 2 },
			{ shape: 'rect' as const, coords: '0,0,20,20', mappedValue: 1 },
		],
	};

	it('scores a point inside a mapped area', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: {
					identifier: 'RESPONSE',
					baseType: 'point',
					cardinality: 'single',
					value: qtiValue('point', 'single', '55 52'),
					areaMapping: AREA_MAPPING,
				},
			},
			`<setOutcomeValue identifier="OUT"><mapResponsePoint identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 2));
	});

	it('answers with the area default outside every mapped area', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: {
					identifier: 'RESPONSE',
					baseType: 'point',
					cardinality: 'single',
					value: qtiValue('point', 'single', '200 200'),
					areaMapping: AREA_MAPPING,
				},
			},
			`<setOutcomeValue identifier="OUT"><mapResponsePoint identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 0));
	});

	it('scores a point inside several areas with the first matching area, not a sum', () => {
		// (10,10) is inside both areas below; the engine scores the first match.
		// (If content ever needs overlapping areas to accumulate, this is the
		// line to revisit — the QTI areaMapping rules are worth a spec check.)
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: {
					identifier: 'RESPONSE',
					baseType: 'point',
					cardinality: 'single',
					value: qtiValue('point', 'single', '10 10'),
					areaMapping: {
						defaultValue: 0,
						entries: [
							{ shape: 'rect' as const, coords: '0,0,20,20', mappedValue: 1 },
							{ shape: 'circle' as const, coords: '10,10,30', mappedValue: 2 },
						],
					},
				},
			},
			`<setOutcomeValue identifier="OUT"><mapResponsePoint identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 1));
	});

	it('sums mapped values across a multiple-cardinality point response', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: {
					identifier: 'RESPONSE',
					baseType: 'point',
					cardinality: 'multiple',
					value: qtiValue('point', 'multiple', ['55 52', '200 200']),
					areaMapping: AREA_MAPPING,
				},
			},
			`<setOutcomeValue identifier="OUT"><mapResponsePoint identifier="RESPONSE"/></setOutcomeValue>`,
		);
		// One point hits the circle (2), the other lands outside (default 0).
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 2));
	});
});

describe('mapOutcome', () => {
	it('maps an outcome variable through its mapping', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				FEEDBACK: outcomeDecl('FEEDBACK', 'correct', {
					defaultValue: 0,
					entries: {
						correct: { mapKey: 'correct', mappedValue: 1 },
					},
				}),
			},
			`<setOutcomeValue identifier="OUT"><mapOutcome identifier="FEEDBACK"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 1));
	});

	it('treats an unmapped outcome value as the mapping default', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				FEEDBACK: outcomeDecl('FEEDBACK', 'partial', {
					defaultValue: 0.5,
					entries: {
						correct: { mapKey: 'correct', mappedValue: 1 },
					},
				}),
			},
			`<setOutcomeValue identifier="OUT"><mapOutcome identifier="FEEDBACK"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 0.5));
	});
});

describe('mapping inside a full response condition', () => {
	it('drives partial credit scoring end to end', () => {
		const ctx = run(
			{
				SCORE: { identifier: 'SCORE', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl('B', {
					defaultValue: 0,
					entries: {
						A: { mapKey: 'A', mappedValue: 2 },
						B: { mapKey: 'B', mappedValue: 1 },
					},
				}),
			},
			`<responseCondition>
        <responseIf>
          <isNull><variable identifier="RESPONSE"/></isNull>
          <setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue>
        </responseIf>
        <responseElse>
          <setOutcomeValue identifier="SCORE"><mapResponse identifier="RESPONSE"/></setOutcomeValue>
        </responseElse>
      </responseCondition>`,
		);
		expect(ctx.getValue('SCORE')).toEqual(qtiValue('float', 'single', 1));
	});
});
