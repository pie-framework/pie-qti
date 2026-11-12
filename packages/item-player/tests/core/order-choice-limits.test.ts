/**
 * The pure order-subset rule shared by response validation and the order renderers
 * (QTI 2.2 ASI §5.73 / §5.42 minChoices and maxChoices).
 */

import { describe, expect, test } from 'bun:test';
import { orderChoiceLimits } from '../../src/index.js';

describe('orderChoiceLimits', () => {
	test('minChoices unspecified: every choice is ordered and maxChoices is ignored', () => {
		expect(orderChoiceLimits({ choiceCount: 5 })).toEqual({ subset: false, minOrdered: 5, maxOrdered: 5 });
		expect(orderChoiceLimits({ minChoices: 0, maxChoices: 2, choiceCount: 5 })).toEqual({
			subset: false,
			minOrdered: 5,
			maxOrdered: 5,
		});
	});

	test('minChoices below the choice count requests a subset, capped by maxChoices', () => {
		expect(orderChoiceLimits({ minChoices: 2, maxChoices: 2, choiceCount: 5 })).toEqual({
			subset: true,
			minOrdered: 2,
			maxOrdered: 2,
		});
		expect(orderChoiceLimits({ minChoices: 1, maxChoices: 3, choiceCount: 5 })).toEqual({
			subset: true,
			minOrdered: 1,
			maxOrdered: 3,
		});
	});

	test('the cap is maxChoices clamped to the choice count; 0 means up to every choice', () => {
		expect(orderChoiceLimits({ minChoices: 2, maxChoices: 0, choiceCount: 5 }).maxOrdered).toBe(5);
		expect(orderChoiceLimits({ minChoices: 2, maxChoices: 9, choiceCount: 5 }).maxOrdered).toBe(5);
	});

	test('minChoices at or above the choice count is effectively full ordering', () => {
		expect(orderChoiceLimits({ minChoices: 5, maxChoices: 5, choiceCount: 5 })).toEqual({
			subset: false,
			minOrdered: 5,
			maxOrdered: 5,
		});
		expect(orderChoiceLimits({ minChoices: 7, choiceCount: 5 }).subset).toBe(false);
	});

	test('a maxChoices authored below minChoices cannot make the item unanswerable', () => {
		expect(orderChoiceLimits({ minChoices: 3, maxChoices: 2, choiceCount: 5 })).toEqual({
			subset: true,
			minOrdered: 3,
			maxOrdered: 3,
		});
	});

	test('non-numeric and negative attributes read as unspecified', () => {
		expect(orderChoiceLimits({ minChoices: Number.NaN, maxChoices: -1, choiceCount: 4 }).subset).toBe(false);
		expect(orderChoiceLimits({ minChoices: 2, maxChoices: Number.NaN, choiceCount: 4 }).maxOrdered).toBe(4);
	});
});
