/**
 * Tests for pairHelpers - utilities for managing pairs in matching interactions
 */

import { describe, expect, test } from 'bun:test';
import {
	getTargetForSource,
	getTargetsForSource,
	getSourceForTarget,
	createOrUpdatePair,
	removePairBySource,
	removePair,
	removePairByTarget,
	pairIncludesId,
	countPairsWithId,
	countPairsForSource,
	placeSourceOnTarget,
	hasUnorderedPair,
} from '../../../src/shared/utils/pairHelpers.js';

describe('pairHelpers', () => {
	describe('getTargetForSource', () => {
		test('should return target for matching source', () => {
			const pairs = ['A T1', 'B T2', 'C T3'];
			expect(getTargetForSource(pairs, 'B')).toBe('T2');
		});

		test('should return null when source not found', () => {
			const pairs = ['A T1', 'B T2'];
			expect(getTargetForSource(pairs, 'C')).toBe(null);
		});

		test('should return first match only (one-to-one display)', () => {
			const pairs = ['A T1', 'A T2', 'A T3'];
			expect(getTargetForSource(pairs, 'A')).toBe('T1');
		});

		test('should return null for empty pairs array', () => {
			expect(getTargetForSource([], 'A')).toBe(null);
		});
	});

	describe('getTargetsForSource', () => {
		test('should return all targets for a source (many-to-many)', () => {
			const pairs = ['A T1', 'A T2', 'A T3', 'B T4'];
			const targets = getTargetsForSource(pairs, 'A');
			expect(targets).toEqual(['T1', 'T2', 'T3']);
		});

		test('should return empty array when source not found', () => {
			const pairs = ['A T1', 'B T2'];
			const targets = getTargetsForSource(pairs, 'C');
			expect(targets).toEqual([]);
		});

		test('should return empty array for empty pairs', () => {
			const targets = getTargetsForSource([], 'A');
			expect(targets).toEqual([]);
		});

		test('should filter out malformed pairs', () => {
			const pairs = ['A T1', 'A', 'A T2', 'B T3'];
			const targets = getTargetsForSource(pairs, 'A');
			expect(targets).toEqual(['T1', 'T2']);
		});

		test('should handle single pair', () => {
			const pairs = ['A T1'];
			const targets = getTargetsForSource(pairs, 'A');
			expect(targets).toEqual(['T1']);
		});
	});

	describe('getSourceForTarget', () => {
		test('should return source for matching target', () => {
			const pairs = ['A T1', 'B T2', 'C T3'];
			expect(getSourceForTarget(pairs, 'T2')).toBe('B');
		});

		test('should return null when target not found', () => {
			const pairs = ['A T1', 'B T2'];
			expect(getSourceForTarget(pairs, 'T3')).toBe(null);
		});

		test('should return first match only', () => {
			const pairs = ['A T1', 'B T1', 'C T1'];
			expect(getSourceForTarget(pairs, 'T1')).toBe('A');
		});

		test('should return null for empty pairs array', () => {
			expect(getSourceForTarget([], 'T1')).toBe(null);
		});
	});

	describe('createOrUpdatePair', () => {
		test('should add new pair to empty array', () => {
			const pairs: string[] = [];
			const result = createOrUpdatePair(pairs, 'A', 'T1');
			expect(result).toEqual(['A T1']);
		});

		test('should add new pair without affecting existing pairs', () => {
			const pairs = ['A T1', 'B T2'];
			const result = createOrUpdatePair(pairs, 'C', 'T3');
			expect(result).toEqual(['A T1', 'B T2', 'C T3']);
		});

		test('should allow same source to map to multiple targets (many-to-many)', () => {
			const pairs = ['A T1'];
			const result = createOrUpdatePair(pairs, 'A', 'T2');
			expect(result).toEqual(['A T1', 'A T2']);
		});

		test('should replace target assignment (target can only be assigned once)', () => {
			const pairs = ['A T1', 'B T2'];
			const result = createOrUpdatePair(pairs, 'C', 'T1');
			// T1 was with A, now should be with C only
			expect(result).toEqual(['B T2', 'C T1']);
		});

		test('should not create duplicate pairs', () => {
			const pairs = ['A T1', 'B T2'];
			const result = createOrUpdatePair(pairs, 'A', 'T1');
			expect(result).toEqual(['B T2', 'A T1']);
		});

		test('should handle complex many-to-many scenario', () => {
			let pairs: string[] = [];
			pairs = createOrUpdatePair(pairs, 'A', 'T1');
			pairs = createOrUpdatePair(pairs, 'A', 'T2');
			pairs = createOrUpdatePair(pairs, 'B', 'T3');
			pairs = createOrUpdatePair(pairs, 'A', 'T3');

			// A maps to T1, T2, T3 (but T3 moved from B to A)
			expect(pairs).toEqual(['A T1', 'A T2', 'A T3']);
		});
	});

	describe('removePairBySource', () => {
		test('should remove all pairs for a source', () => {
			const pairs = ['A T1', 'A T2', 'B T3'];
			const result = removePairBySource(pairs, 'A');
			expect(result).toEqual(['B T3']);
		});

		test('should handle source not found', () => {
			const pairs = ['A T1', 'B T2'];
			const result = removePairBySource(pairs, 'C');
			expect(result).toEqual(['A T1', 'B T2']);
		});

		test('should return empty array when removing only source', () => {
			const pairs = ['A T1'];
			const result = removePairBySource(pairs, 'A');
			expect(result).toEqual([]);
		});

		test('should preserve other pairs', () => {
			const pairs = ['A T1', 'B T2', 'C T3'];
			const result = removePairBySource(pairs, 'B');
			expect(result).toEqual(['A T1', 'C T3']);
		});
	});

	describe('removePair', () => {
		test('should remove specific pair by source and target', () => {
			const pairs = ['A T1', 'A T2', 'B T3'];
			const result = removePair(pairs, 'A', 'T1');
			expect(result).toEqual(['A T2', 'B T3']);
		});

		test('should only remove exact match', () => {
			const pairs = ['A T1', 'A T2', 'B T1'];
			const result = removePair(pairs, 'A', 'T1');
			expect(result).toEqual(['A T2', 'B T1']);
		});

		test('should handle pair not found', () => {
			const pairs = ['A T1', 'B T2'];
			const result = removePair(pairs, 'C', 'T3');
			expect(result).toEqual(['A T1', 'B T2']);
		});

		test('should handle empty array', () => {
			const result = removePair([], 'A', 'T1');
			expect(result).toEqual([]);
		});

		test('should preserve all other pairs', () => {
			const pairs = ['A T1', 'A T2', 'A T3', 'B T4'];
			const result = removePair(pairs, 'A', 'T2');
			expect(result).toEqual(['A T1', 'A T3', 'B T4']);
		});
	});

	describe('removePairByTarget', () => {
		test('should remove pair by target', () => {
			const pairs = ['A T1', 'B T2', 'C T3'];
			const result = removePairByTarget(pairs, 'T2');
			expect(result).toEqual(['A T1', 'C T3']);
		});

		test('should handle target not found', () => {
			const pairs = ['A T1', 'B T2'];
			const result = removePairByTarget(pairs, 'T3');
			expect(result).toEqual(['A T1', 'B T2']);
		});

		test('should remove all occurrences of target', () => {
			const pairs = ['A T1', 'B T1', 'C T2'];
			const result = removePairByTarget(pairs, 'T1');
			// Removes both A T1 and B T1
			expect(result).toEqual(['C T2']);
		});

		test('should return empty array when removing only pair', () => {
			const pairs = ['A T1'];
			const result = removePairByTarget(pairs, 'T1');
			expect(result).toEqual([]);
		});
	});

	describe('Integration scenarios', () => {
		test('should handle complete matching workflow', () => {
			let pairs: string[] = [];

			// User creates pairs
			pairs = createOrUpdatePair(pairs, 'A', 'T1');
			pairs = createOrUpdatePair(pairs, 'B', 'T2');
			pairs = createOrUpdatePair(pairs, 'A', 'T3'); // A now maps to T1 and T3

			expect(pairs).toEqual(['A T1', 'B T2', 'A T3']);
			expect(getTargetsForSource(pairs, 'A')).toEqual(['T1', 'T3']);

			// User removes one specific A->T1 pair
			pairs = removePair(pairs, 'A', 'T1');
			expect(pairs).toEqual(['B T2', 'A T3']);

			// User removes all B pairs
			pairs = removePairBySource(pairs, 'B');
			expect(pairs).toEqual(['A T3']);
		});

		test('should handle target reassignment', () => {
			let pairs = ['A T1', 'B T2'];

			// Reassign T1 from A to C
			pairs = createOrUpdatePair(pairs, 'C', 'T1');

			// A T1 should be removed, C T1 added
			expect(pairs).toContain('C T1');
			expect(pairs).not.toContain('A T1');
			expect(pairs).toContain('B T2');
		});
	});

	describe('pairIncludesId', () => {
		test('should match identifier as source token', () => {
			expect(pairIncludesId('A T1', 'A')).toBe(true);
		});

		test('should match identifier as target token', () => {
			expect(pairIncludesId('A T1', 'T1')).toBe(true);
		});

		test('should not match substring collisions between identifiers', () => {
			// "H1" is a substring of "H10" but a different identifier
			expect(pairIncludesId('H10 T2', 'H1')).toBe(false);
			expect(pairIncludesId('A1 T1', 'A')).toBe(false);
			expect(pairIncludesId('A T10', 'T1')).toBe(false);
		});

		test('should not match unrelated identifiers', () => {
			expect(pairIncludesId('A T1', 'B')).toBe(false);
		});
	});

	describe('countPairsWithId', () => {
		test('should count pairs using an identifier as source or target', () => {
			const pairs = ['H1 T1', 'H1 T2', 'H2 T1'];
			expect(countPairsWithId(pairs, 'H1')).toBe(2);
			expect(countPairsWithId(pairs, 'T1')).toBe(2);
			expect(countPairsWithId(pairs, 'H2')).toBe(1);
			expect(countPairsWithId(pairs, 'H9')).toBe(0);
		});

		test('should not cross-count identifiers that are substrings of other tokens', () => {
			// "H10 H11" contains neither "H1" nor "H11" spelled "H1"
			const pairs = ['H10 H11'];
			expect(countPairsWithId(pairs, 'H1')).toBe(0);
			expect(countPairsWithId(pairs, 'H10')).toBe(1);
			expect(countPairsWithId(pairs, 'H11')).toBe(1);
		});
	});

	describe('countPairsForSource', () => {
		test('counts the pairs whose first token is the source, whole tokens only', () => {
			const pairs = ['A T1', 'A T2', 'B A', 'AB T3'];
			expect(countPairsForSource(pairs, 'A')).toBe(2);
			expect(countPairsForSource(pairs, 'B')).toBe(1);
			expect(countPairsForSource(pairs, 'T1')).toBe(0);
		});
	});

	describe('placeSourceOnTarget (move-aware directed placement)', () => {
		test('a single-use label dropped from H1 onto H2 moves: exactly "L H2"', () => {
			expect(placeSourceOnTarget(['L H1'], 'L', 'H2', 1)).toEqual(['L H2']);
			// The many-to-many helper keeps the label on its old hotspot, so the graphic gap
			// match must not use it.
			expect(createOrUpdatePair(['L H1'], 'L', 'H2')).toEqual(['L H1', 'L H2']);
		});

		test('a target holds one source: its previous pair is replaced', () => {
			expect(placeSourceOnTarget(['A T1', 'B T2'], 'C', 'T1', 1)).toEqual(['B T2', 'C T1']);
		});

		test('below its capacity a source is reused; at it, it moves; 0 is no limit', () => {
			expect(placeSourceOnTarget(['A T1'], 'A', 'T2', 2)).toEqual(['A T1', 'A T2']);
			expect(placeSourceOnTarget(['A T1', 'A T2'], 'A', 'T3', 2)).toEqual(['A T3']);
			expect(placeSourceOnTarget(['A T1', 'A T2'], 'A', 'T3', 0)).toEqual(['A T1', 'A T2', 'A T3']);
		});

		test('an empty source clears the target', () => {
			expect(placeSourceOnTarget(['A T1', 'B T2'], '', 'T1', 1)).toEqual(['B T2']);
		});

		test('identifiers are whole tokens: "AB" is not a placement of "A"', () => {
			expect(placeSourceOnTarget(['AB T1'], 'A', 'T2', 1)).toEqual(['AB T1', 'A T2']);
		});

		test('properties over random responses: "source target" order, one source per target, the capacity rule', () => {
			let state = 20261110;
			const next = () => {
				state = (state * 1103515245 + 12345) & 0x7fffffff;
				return state / 0x7fffffff;
			};
			const pick = <T>(values: readonly T[]): T => values[Math.floor(next() * values.length)] as T;
			const sources = ['A', 'B', 'C', 'AB'];
			const targets = ['T1', 'T2', 'T3', 'T11'];
			const bySource = (pairs: readonly string[], source: string) => pairs.filter((p) => p.startsWith(`${source} `));

			for (let run = 0; run < 500; run++) {
				const pairs = Array.from({ length: Math.floor(next() * 7) }, () => `${pick(sources)} ${pick(targets)}`);
				const source = pick(sources);
				const target = pick(targets);
				const capacity = pick([0, 1, 2, 3]);
				const original = [...pairs];
				const placed = placeSourceOnTarget(pairs, source, target, capacity);
				const context = JSON.stringify({ pairs, source, target, capacity, placed });

				// The new pair is "source target", appended, and the only pair on the target.
				expect(placed.at(-1), context).toBe(`${source} ${target}`);
				expect(placed.filter((p) => p.endsWith(` ${target}`)), context).toEqual([`${source} ${target}`]);
				// Pairs of other sources on other targets are kept, in order.
				const untouched = (list: readonly string[]) =>
					list.filter((p) => !p.startsWith(`${source} `) && !p.endsWith(` ${target}`));
				expect(untouched(placed), context).toEqual(untouched(pairs));
				// The source is reused below its capacity and moves at it; it never exceeds it.
				const rest = pairs.filter((p) => !p.endsWith(` ${target}`));
				const moves = capacity > 0 && bySource(rest, source).length >= capacity;
				expect(bySource(placed, source), context).toEqual(
					moves ? [`${source} ${target}`] : [...bySource(rest, source), `${source} ${target}`],
				);
				if (capacity > 0) expect(bySource(placed, source).length, context).toBeLessThanOrEqual(capacity);
				// The input is not mutated.
				expect(pairs, context).toEqual(original);
			}
		});
	});

	describe('hasUnorderedPair', () => {
		test('finds a pair in either order, whole tokens only', () => {
			expect(hasUnorderedPair(['A B'], 'A', 'B')).toBe(true);
			expect(hasUnorderedPair(['B A'], 'A', 'B')).toBe(true);
			expect(hasUnorderedPair(['A BC'], 'A', 'B')).toBe(false);
			expect(hasUnorderedPair([], 'A', 'B')).toBe(false);
		});
	});
});
