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
});
