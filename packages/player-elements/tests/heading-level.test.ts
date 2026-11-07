import { describe, expect, test } from 'bun:test';
import { parseHeadingLevel } from '../src/utils/heading-level.js';

describe('parseHeadingLevel', () => {
	test('accepts the integers 1 to 6', () => {
		expect([1, 2, 3, 4, 5, 6].map((level) => parseHeadingLevel(String(level)))).toEqual([1, 2, 3, 4, 5, 6]);
		expect(parseHeadingLevel(' 3 ')).toBe(3);
	});

	test('anything else leaves the level unset', () => {
		for (const value of [null, '', '0', '7', '2.5', 'two', '-1']) {
			expect(parseHeadingLevel(value)).toBeUndefined();
		}
	});
});
