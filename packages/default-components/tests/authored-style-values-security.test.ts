import { describe, expect, test } from 'bun:test';
import {
	normalizeCssPixelLength,
	normalizePixelDimension,
} from '@pie-qti/item-player/security';

describe('normalizeCssPixelLength', () => {
	test('canonicalizes unsigned pixel values', () => {
		expect(normalizeCssPixelLength('300')).toBe('300px');
		expect(normalizeCssPixelLength('300px')).toBe('300px');
		expect(normalizeCssPixelLength('12.5')).toBe('12.5px');
		expect(normalizeCssPixelLength(48)).toBe('48px');
	});

	test('rejects values that could terminate the declaration and inject another one', () => {
		const injection = '"; background-image: url(https://evil.example/x.png)';
		expect(normalizeCssPixelLength(injection)).toBeNull();
		expect(normalizeCssPixelLength('url(https://evil.example/x.png)')).toBeNull();
		expect(normalizeCssPixelLength('50%')).toBeNull();
		expect(normalizeCssPixelLength('-10')).toBeNull();
		expect(normalizeCssPixelLength('1e6')).toBeNull();
		expect(normalizeCssPixelLength('auto')).toBeNull();
		expect(normalizeCssPixelLength(undefined)).toBeNull();
		expect(normalizeCssPixelLength(null)).toBeNull();
	});
});

describe('normalizePixelDimension', () => {
	test('returns a unit-free positive pixel count for image attributes', () => {
		expect(normalizePixelDimension('400')).toBe('400');
		expect(normalizePixelDimension(400)).toBe('400');
		expect(normalizePixelDimension('12.5')).toBe('12.5');
	});

	test('rejects unit-bearing and hostile values instead of interpolating them', () => {
		expect(normalizePixelDimension('400px')).toBeUndefined();
		expect(normalizePixelDimension('0')).toBeUndefined();
		expect(normalizePixelDimension('-10')).toBeUndefined();
		expect(normalizePixelDimension('0; background:url(x)')).toBeUndefined();
		expect(normalizePixelDimension(null)).toBeUndefined();
	});

	test('falls back only when the fallback is itself a safe dimension', () => {
		expect(normalizePixelDimension('abc', 320)).toBe('320');
		expect(normalizePixelDimension('abc', 'inject; url(x)')).toBeUndefined();
		expect(normalizePixelDimension('abc')).toBeUndefined();
	});
});
