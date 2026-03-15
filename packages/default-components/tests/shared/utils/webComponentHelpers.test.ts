import { describe, expect, test } from 'bun:test';
import { parseJsonProp } from '../../../src/shared/utils/webComponentHelpers.js';

describe('parseJsonProp', () => {
	test('returns undefined for null-ish values', () => {
		expect(parseJsonProp(null)).toBeUndefined();
		expect(parseJsonProp(undefined)).toBeUndefined();
		expect(parseJsonProp('null')).toBeUndefined();
	});

	test('parses valid JSON strings', () => {
		expect(parseJsonProp<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
	});

	test('keeps plain strings as strings when JSON parse fails', () => {
		expect(parseJsonProp<string>('response-id-1')).toBe('response-id-1');
	});
});
