import { describe, expect, test } from 'bun:test';
import { isShownByIdentifier, matchesIdentifier } from '../index.js';

describe('feedback and template visibility', () => {
	test('matches a single value by equality and a container by membership', () => {
		expect(matchesIdentifier('CORRECT', 'CORRECT')).toBe(true);
		expect(matchesIdentifier('INCORRECT', 'CORRECT')).toBe(false);
		expect(matchesIdentifier(['SEEN', 'CORRECT'], 'CORRECT')).toBe(true);
		expect(matchesIdentifier(['SEEN'], 'CORRECT')).toBe(false);
		expect(matchesIdentifier(2, '2')).toBe(true);
	});

	test('NULL matches nothing', () => {
		for (const value of [null, undefined, '', []]) expect(matchesIdentifier(value, 'CORRECT')).toBe(false);
	});

	test('showHide="hide" shows the element unless the identifier matches', () => {
		expect(isShownByIdentifier('CORRECT', 'CORRECT')).toBe(true);
		expect(isShownByIdentifier('CORRECT', 'CORRECT', 'show')).toBe(true);
		expect(isShownByIdentifier('CORRECT', 'CORRECT', 'hide')).toBe(false);
		expect(isShownByIdentifier(['A', 'B'], 'C', 'hide')).toBe(true);
		expect(isShownByIdentifier(null, 'CORRECT', 'hide')).toBe(true);
		expect(isShownByIdentifier(null, 'CORRECT', 'show')).toBe(false);
	});
});
