import { describe, expect, test } from 'bun:test';
import { exceedsLimit, isAtLimit, isLimited, limitMessage } from '../../../src/shared/utils/capacity';

describe('capacity limits: a positive limit restricts, 0 is no restriction', () => {
	test('isLimited', () => {
		expect(isLimited(0)).toBe(false);
		expect(isLimited(1)).toBe(true);
		expect(isLimited(3)).toBe(true);
	});

	test('isAtLimit: reached at the limit, never for 0', () => {
		expect(isAtLimit(1, 2)).toBe(false);
		expect(isAtLimit(2, 2)).toBe(true);
		expect(isAtLimit(3, 2)).toBe(true);
		expect(isAtLimit(0, 0)).toBe(false);
		expect(isAtLimit(100, 0)).toBe(false);
	});

	test('exceedsLimit: past the limit, never for 0', () => {
		expect(exceedsLimit(2, 2)).toBe(false);
		expect(exceedsLimit(3, 2)).toBe(true);
		expect(exceedsLimit(100, 0)).toBe(false);
	});

	test('a value that is not a positive number restricts nothing', () => {
		for (const limit of [Number.NaN, -1]) {
			expect(isLimited(limit)).toBe(false);
			expect(isAtLimit(5, limit)).toBe(false);
			expect(exceedsLimit(5, limit)).toBe(false);
		}
	});
});

describe('limitMessage: the author’s message when it has text, else the default', () => {
	test('an authored message wins, trimmed', () => {
		expect(limitMessage('Two at most.', 'default')).toBe('Two at most.');
		expect(limitMessage('  Two at most. ', 'default')).toBe('Two at most.');
	});

	test('an absent or blank message falls back to the default', () => {
		expect(limitMessage(undefined, 'default')).toBe('default');
		expect(limitMessage(null, 'default')).toBe('default');
		expect(limitMessage('', 'default')).toBe('default');
		expect(limitMessage('   ', 'default')).toBe('default');
	});
});
