import { describe, expect, test } from 'bun:test';
import {
	normalizeCssPixelLength,
	normalizePixelDimension,
} from '../../src/security/styleValues.js';

describe('authored style value normalization', () => {
	test('canonicalizes palette widths as one pixel length', () => {
		expect(normalizeCssPixelLength(' 320 ')).toBe('320px');
		expect(normalizeCssPixelLength('320px')).toBe('320px');
		expect(normalizeCssPixelLength('.5PX')).toBe('0.5px');
	});

	test('rejects declaration and URL payloads in palette widths', () => {
		expect(normalizeCssPixelLength('1px; background-image: url(//tracker.test/pixel)')).toBeNull();
		expect(normalizeCssPixelLength('url(https://tracker.test/pixel)')).toBeNull();
		expect(normalizeCssPixelLength('calc(100% - 1px)')).toBeNull();
		expect(normalizeCssPixelLength('100001')).toBeNull();
	});

	test('canonicalizes positive image dimensions and rejects CSS syntax', () => {
		expect(normalizePixelDimension('00400')).toBe('400');
		expect(normalizePixelDimension('120.5')).toBe('120.5');
		expect(normalizePixelDimension('1; background: url(//tracker.test)')).toBeUndefined();
		expect(normalizePixelDimension('320px')).toBeUndefined();
		expect(normalizePixelDimension('-1')).toBeUndefined();
		expect(normalizePixelDimension('100001')).toBeUndefined();
	});

	test('uses only a valid positive fallback', () => {
		expect(normalizePixelDimension('url(//tracker.test)', '500')).toBe('500');
		expect(normalizePixelDimension('', '0')).toBeUndefined();
		expect(normalizePixelDimension('', '1px; color: red')).toBeUndefined();
	});
});
