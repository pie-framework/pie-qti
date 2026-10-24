import { describe, expect, test } from 'bun:test';
import { coerceBaseValue, parseResponseNumber } from '../src/runtime/index.js';

describe('parseResponseNumber', () => {
	test('keeps the Number() reading of ASCII text in every language', () => {
		expect(parseResponseNumber('3.5', 'de')).toBe(3.5);
		expect(parseResponseNumber('-12', 'fr')).toBe(-12);
		expect(parseResponseNumber('1e3')).toBe(1000);
	});

	test('reads digits in any script and the Arabic separators', () => {
		expect(parseResponseNumber('٣٫٥', 'ar')).toBe(3.5);
		expect(parseResponseNumber('۱۲', 'fa')).toBe(12);
		expect(parseResponseNumber('١٬٢٣٤', 'ar')).toBe(1234);
	});

	test("reads the language's decimal and group marks", () => {
		expect(parseResponseNumber('3,5', 'fr')).toBe(3.5);
		expect(parseResponseNumber('1 234,5', 'fr')).toBe(1234.5);
		expect(parseResponseNumber('1.234,5', 'de')).toBe(1234.5);
		expect(parseResponseNumber('1,234', 'en')).toBe(1234);
	});

	test('rejects marks outside groups of three', () => {
		expect(parseResponseNumber('3,5', 'en')).toBeNaN();
		expect(parseResponseNumber('12,34', 'en')).toBeNaN();
		expect(parseResponseNumber('abc', 'ar')).toBeNaN();
	});
});

test('coerceBaseValue reads numbers in the given language', () => {
	expect(coerceBaseValue('float', '3,5', 'fr')).toMatchObject({ kind: 'value', value: 3.5 });
	expect(coerceBaseValue('integer', '۳', 'fa')).toMatchObject({ kind: 'value', value: 3 });
	expect(coerceBaseValue('float', '3,5')).toMatchObject({ kind: 'invalid' });
	expect(coerceBaseValue('string', '٣', 'ar')).toMatchObject({ kind: 'value', value: '٣' });
});
