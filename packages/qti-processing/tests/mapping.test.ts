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
import { qtiNull, qtiValue } from '../src/runtime/value.js';
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

	it('sums mapped values across a multiple-cardinality response, counting repeated values once', () => {
		// QTI ASI §15.3: "If a container contains multiple instances of the same
		// value then that value is counted once only" — {A,B,A} maps 2+1, not 2+1+2.
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl(['A', 'B', 'A'], MAPPING, 'identifier', 'multiple'),
			},
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 3));
	});

	it('counts {B,B,C} as 1.5, not 2.5 (spec example)', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl(
					['B', 'B', 'C'],
					{
						defaultValue: 0,
						entries: {
							B: { mapKey: 'B', mappedValue: 1 },
							C: { mapKey: 'C', mappedValue: 0.5 },
						},
					},
					'identifier',
					'multiple',
				),
			},
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 1.5));
	});

	it('counts repeated directed pairs once, keeping direction significant', () => {
		const PAIR_MAPPING = {
			defaultValue: 0,
			entries: {
				'W1 G1': { mapKey: 'W1 G1', mappedValue: 1 },
			},
		};
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl(['W1 G1', 'W1 G1'], PAIR_MAPPING, 'directedPair', 'multiple'),
			},
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 1));
	});

	it('counts a pair and its reversed spelling as the same value', () => {
		// pair cardinality is unordered, so 'G1 W1' and 'W1 G1' are the same pair;
		// mapping entries are stored under the order-normalized key, as the player
		// parses them.
		const PAIR_MAPPING = {
			defaultValue: 0,
			entries: {
				'G1 W1': { mapKey: 'G1 W1', mappedValue: 1 },
			},
		};
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl(['W1 G1', 'G1 W1'], PAIR_MAPPING, 'pair', 'multiple'),
			},
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 1));
	});

	it('counts duplicates once for ordered cardinality, keeping position duplicates in the container', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl(['A', 'A', 'B'], MAPPING, 'identifier', 'ordered'),
			},
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 3));
	});

	it('clamps the summed value to the declared upper bound', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: responseDecl(['A', 'B', 'A', 'B'], { ...MAPPING, upperBound: 2.5 }, 'identifier', 'multiple'),
			},
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		);
		// {A,B} sums to 3 once duplicates are collapsed, then clamps to 2.5.
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 2.5));
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
		// (10,10) is inside both areas; the QTI areaMapEntry rules (§5.5.4) give
		// priority to the entry listed first when areas overlap.
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

	it('counts different areas separately across a multiple-point response', () => {
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: {
					identifier: 'RESPONSE',
					baseType: 'point',
					cardinality: 'multiple',
					value: qtiValue('point', 'multiple', ['55 52', '10 10']),
					areaMapping: AREA_MAPPING,
				},
			},
			`<setOutcomeValue identifier="OUT"><mapResponsePoint identifier="RESPONSE"/></setOutcomeValue>`,
		);
		// Circle (2) plus rect (1).
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 3));
	});

	it('counts a mapped area once when several points fall inside it', () => {
		// QTI §2.11.1.6: "when mapping containers each area can be mapped once
		// only" — both points are inside the circle, so it still scores 2, not 4.
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				RESPONSE: {
					identifier: 'RESPONSE',
					baseType: 'point',
					cardinality: 'multiple',
					value: qtiValue('point', 'multiple', ['55 52', '48 47']),
					areaMapping: AREA_MAPPING,
				},
			},
			`<setOutcomeValue identifier="OUT"><mapResponsePoint identifier="RESPONSE"/></setOutcomeValue>`,
		);
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

	it('counts a repeated container value once', () => {
		// QTI ASI §15.3: duplicate container values count once, the same rule
		// mapResponse follows.
		const ctx = run(
			{
				OUT: { identifier: 'OUT', baseType: 'float', cardinality: 'single', value: qtiValue('float', 'single', 0) },
				FEEDBACK: {
					identifier: 'FEEDBACK',
					baseType: 'identifier',
					cardinality: 'multiple',
					value: qtiValue('identifier', 'multiple', ['correct', 'correct', 'partial']),
					mapping: {
						defaultValue: 0,
						entries: {
							correct: { mapKey: 'correct', mappedValue: 1 },
							partial: { mapKey: 'partial', mappedValue: 0.5 },
						},
					},
				},
			},
			`<setOutcomeValue identifier="OUT"><mapOutcome identifier="FEEDBACK"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 1.5));
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

/**
 * mapEntry caseSensitive (QTI ASI §5): it controls "whether or not a mapEntry string is matched
 * case sensitively", entry by entry. A case-sensitive entry matches only its own spelling, so a
 * response in another case takes the defaultValue. The player stores a case-insensitive entry
 * under its lower-case key as well, which is how a lower-cased response finds it.
 */
describe('mapEntry case sensitivity', () => {
	const OUT = { identifier: 'OUT', baseType: 'float' as const, cardinality: 'single' as const, value: qtiValue('float', 'single', 0) };

	function mapped(
		response: string,
		entries: NonNullable<DeclarationMap['RESPONSE']['mapping']>['entries'],
		baseType: 'identifier' | 'string',
	): QtiValue {
		return run(
			{ OUT, RESPONSE: responseDecl(response, { defaultValue: 0, caseSensitive: 'true', entries }, baseType) },
			`<setOutcomeValue identifier="OUT"><mapResponse identifier="RESPONSE"/></setOutcomeValue>`,
		).getValue('OUT');
	}

	const caseSensitive = { a: { mapKey: 'a', mappedValue: 1, caseSensitive: 'true' } };
	// As the player parses a case-insensitive entry: its key plus a lower-case alias.
	const caseInsensitive = {
		Paris: { mapKey: 'Paris', mappedValue: 1, caseSensitive: 'false' },
		paris: { mapKey: 'paris', mappedValue: 1, caseSensitive: 'false' },
	};

	for (const baseType of ['identifier', 'string'] as const) {
		it(`does not match a case-sensitive ${baseType} entry in another case`, () => {
			expect(mapped('A', caseSensitive, baseType)).toEqual(qtiValue('float', 'single', 0));
			expect(mapped('a', caseSensitive, baseType)).toEqual(qtiValue('float', 'single', 1));
		});

		it(`matches a case-insensitive ${baseType} entry through its lower-case key`, () => {
			expect(mapped('paris', caseInsensitive, baseType)).toEqual(qtiValue('float', 'single', 1));
			expect(mapped('Paris', caseInsensitive, baseType)).toEqual(qtiValue('float', 'single', 1));
		});
	}

	it('matches a case-insensitive string entry in any case', () => {
		expect(mapped('PARIS', caseInsensitive, 'string')).toEqual(qtiValue('float', 'single', 1));
		expect(mapped('pArIs', caseInsensitive, 'string')).toEqual(qtiValue('float', 'single', 1));
	});

	it('keeps each entry its own case sensitivity in one mapping', () => {
		const mixed = { ...caseSensitive, ...caseInsensitive };
		expect(mapped('PARIS', mixed, 'string')).toEqual(qtiValue('float', 'single', 1));
		expect(mapped('A', mixed, 'string')).toEqual(qtiValue('float', 'single', 0));
	});
});

/**
 * QTI ASI: a container with no values is treated as NULL, and a mapping's lowerBound and
 * upperBound bound the result of mapping a container. A NULL container is therefore the empty
 * container: its values sum to 0, which the bounds then clamp — it does not take the mapping's
 * defaultValue, which applies to a value with no mapping entry.
 */
describe('mapping a NULL response', () => {
	const OUT = { identifier: 'OUT', baseType: 'float' as const, cardinality: 'single' as const, value: qtiValue('float', 'single', 0) };
	/** A canonical penalising multi-select mapping (choice_multiple). */
	const PENALTY = {
		defaultValue: -2,
		lowerBound: 0,
		upperBound: 2,
		entries: {
			H: { mapKey: 'H', mappedValue: 1 },
			O: { mapKey: 'O', mappedValue: 1 },
			Cl: { mapKey: 'Cl', mappedValue: -1 },
		},
	};

	function mapped(
		value: QtiValue,
		mapping: NonNullable<DeclarationMap['RESPONSE']['mapping']>,
		cardinality: DeclarationMap['RESPONSE']['cardinality'],
		expression = 'mapResponse',
	): QtiValue {
		return run(
			{ OUT, RESPONSE: { identifier: 'RESPONSE', baseType: 'identifier', cardinality, value, mapping } },
			`<setOutcomeValue identifier="OUT"><${expression} identifier="RESPONSE"/></setOutcomeValue>`,
		).getValue('OUT');
	}

	for (const cardinality of ['multiple', 'ordered'] as const) {
		it(`maps a NULL ${cardinality} response as the empty container, within the bounds`, () => {
			const empty = mapped(qtiValue('identifier', cardinality, []), PENALTY, cardinality);
			expect(empty).toEqual(qtiValue('float', 'single', 0));
			expect(mapped(qtiNull('identifier', cardinality), PENALTY, cardinality)).toEqual(empty);
			// Partial responses keep their mapped sums, clamped to the bounds.
			expect(mapped(qtiValue('identifier', cardinality, ['H']), PENALTY, cardinality)).toEqual(qtiValue('float', 'single', 1));
			expect(mapped(qtiValue('identifier', cardinality, ['N']), PENALTY, cardinality)).toEqual(qtiValue('float', 'single', 0));
			expect(mapped(qtiValue('identifier', cardinality, ['H', 'O', 'Cl']), PENALTY, cardinality)).toEqual(
				qtiValue('float', 'single', 1),
			);
		});
	}

	it('clamps a NULL container to a positive lower bound, as the empty container', () => {
		const floor = { ...PENALTY, defaultValue: 1, lowerBound: 2 };
		expect(mapped(qtiValue('identifier', 'multiple', []), floor, 'multiple')).toEqual(qtiValue('float', 'single', 2));
		expect(mapped(qtiNull('identifier', 'multiple'), floor, 'multiple')).toEqual(qtiValue('float', 'single', 2));
	});

	it('maps a NULL container to 0 without bounds, not to the mapping default', () => {
		const unbounded = { defaultValue: -2, entries: PENALTY.entries };
		expect(mapped(qtiNull('identifier', 'multiple'), unbounded, 'multiple')).toEqual(qtiValue('float', 'single', 0));
	});

	it('maps a NULL single response to the mapping default within the bounds, as an unmapped value', () => {
		const below = { ...PENALTY, defaultValue: -1 };
		expect(mapped(qtiValue('identifier', 'single', 'N'), below, 'single')).toEqual(qtiValue('float', 'single', 0));
		expect(mapped(qtiNull('identifier', 'single'), below, 'single')).toEqual(qtiValue('float', 'single', 0));
		const within = { ...PENALTY, defaultValue: 0.25 };
		expect(mapped(qtiNull('identifier', 'single'), within, 'single')).toEqual(qtiValue('float', 'single', 0.25));
	});

	it('maps a NULL outcome container (mapOutcome) the same way', () => {
		const ctx = run(
			{
				OUT,
				FEEDBACK: {
					identifier: 'FEEDBACK',
					baseType: 'identifier',
					cardinality: 'multiple',
					value: qtiNull('identifier', 'multiple'),
					mapping: PENALTY,
				},
			},
			`<setOutcomeValue identifier="OUT"><mapOutcome identifier="FEEDBACK"/></setOutcomeValue>`,
		);
		expect(ctx.getValue('OUT')).toEqual(qtiValue('float', 'single', 0));
	});

	it('maps a NULL point container (mapResponsePoint) as the empty container, within the bounds', () => {
		const areaMapping = {
			defaultValue: -2,
			lowerBound: 0.5,
			entries: [{ shape: 'circle' as const, coords: '50,50,10', mappedValue: 2 }],
		};
		const pointMapped = (value: QtiValue) =>
			run(
				{ OUT, RESPONSE: { identifier: 'RESPONSE', baseType: 'point', cardinality: 'multiple', value, areaMapping } },
				`<setOutcomeValue identifier="OUT"><mapResponsePoint identifier="RESPONSE"/></setOutcomeValue>`,
			).getValue('OUT');
		expect(pointMapped(qtiValue('point', 'multiple', []))).toEqual(qtiValue('float', 'single', 0.5));
		expect(pointMapped(qtiNull('point', 'multiple'))).toEqual(qtiValue('float', 'single', 0.5));
	});
});
