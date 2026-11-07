import { describe, expect, test } from 'bun:test';
import {
	characterCount,
	isSpellcheckAllowed,
	patternExcludesMinus,
	reachedExpectedLength,
	responseInputMode,
	writingAssistance,
} from '../src/plugins/extended-text/textInput';

describe('extended text input helpers', () => {
	test('spell checking is granted only explicitly', () => {
		expect(isSpellcheckAllowed(true)).toBe(true);
		expect(isSpellcheckAllowed('true')).toBe(true);
		expect(isSpellcheckAllowed(' TRUE ')).toBe(true);
		// The bare attribute on the custom element.
		expect(isSpellcheckAllowed('')).toBe(true);
		expect(isSpellcheckAllowed(false)).toBe(false);
		expect(isSpellcheckAllowed('false')).toBe(false);
		expect(isSpellcheckAllowed(undefined)).toBe(false);
		expect(isSpellcheckAllowed(null)).toBe(false);
		expect(isSpellcheckAllowed('yes')).toBe(false);
	});

	test('writing assistance follows the grant; capitalization is never automatic', () => {
		expect(writingAssistance(false)).toEqual({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' });
		expect(writingAssistance(true)).toEqual({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'off' });
	});

	test('numeric responses get a numeric keyboard only when a digit-only patternMask proves no minus is needed', () => {
		// Phone number pads have no minus key: without a mask that excludes `-`,
		// a negative answer could be untypable, so the text keyboard stays.
		expect(responseInputMode({ baseType: 'integer', base: 10, cardinality: 'single' })).toBeUndefined();
		expect(
			responseInputMode({ baseType: 'integer', base: 10, cardinality: 'single', patternMask: '^[0-9]+$' }),
		).toBe('numeric');
		expect(
			responseInputMode({ baseType: 'integer', base: 2, cardinality: 'multiple', patternMask: '\\d+' }),
		).toBe('numeric');
		expect(
			responseInputMode({ baseType: 'float', base: 10, cardinality: 'single', patternMask: '[0-9]+([.][0-9]+)?' }),
		).toBe('decimal');
		expect(
			responseInputMode({ baseType: undefined, base: 10, cardinality: 'record', patternMask: '[0-9]+' }),
		).toBe('decimal');
		// A mask that can match `-`, or none at all, keeps the text keyboard.
		expect(
			responseInputMode({ baseType: 'integer', base: 10, cardinality: 'single', patternMask: '-?[0-9]+' }),
		).toBeUndefined();
		expect(
			responseInputMode({ baseType: 'integer', base: 10, cardinality: 'single', patternMask: '[^a]' }),
		).toBeUndefined();
	});

	test('a base above 10 writes digits as letters and keeps the text keyboard', () => {
		expect(responseInputMode({ baseType: 'integer', base: 16, cardinality: 'single', patternMask: '[0-9]+' })).toBeUndefined();
		expect(responseInputMode({ baseType: 'string', base: 10, cardinality: 'single', patternMask: '[0-9]+' })).toBeUndefined();
	});

	test('the pattern scan agrees with the item player on which masks exclude a minus', () => {
		expect(patternExcludesMinus('^[0-9]+$')).toBe(true);
		expect(patternExcludesMinus('-?[0-9]+')).toBe(false);
		expect(patternExcludesMinus('[0-9]-[0-9]')).toBe(false);
		expect(patternExcludesMinus('')).toBe(true);
		// The empty pattern matches only the empty string, which has no minus.
	});

	test('the character count ignores markup and counts what was typed', () => {
		expect(characterCount('abcd', 'plain')).toBe(4);
		expect(characterCount('<p>ab</p>', 'plain')).toBe(9);
		expect(characterCount('<p>a<strong>b</strong></p>', 'xhtml')).toBe(2);
		expect(characterCount('<p>a&amp;b&nbsp;c</p>', 'xhtml')).toBe(5);
		// A character outside the Basic Multilingual Plane is one character.
		expect(characterCount('😀a', 'plain')).toBe(2);
	});

	test('reaching the expected length is a forward crossing only', () => {
		expect(reachedExpectedLength(4, 5, 5)).toBe(true);
		expect(reachedExpectedLength(0, 9, 5)).toBe(true);
		expect(reachedExpectedLength(5, 6, 5)).toBe(false);
		expect(reachedExpectedLength(6, 4, 5)).toBe(false);
		expect(reachedExpectedLength(0, 3, 0)).toBe(false);
	});
});
