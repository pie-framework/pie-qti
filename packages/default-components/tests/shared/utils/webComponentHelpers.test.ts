import { describe, expect, test } from 'bun:test';
import { parseJsonProp, responseProp } from '../../../src/shared/utils/webComponentHelpers.js';

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

// A response is a value. A string response is the candidate's text (or a choice identifier), so
// text that reads as JSON stays that text.
describe('responseProp', () => {
	test.each(['1.50', '1e5', 'true', 'false', 'null', '"quoted"', '[1]', '{"a":1}'])(
		'keeps the string %s exactly as given',
		(value) => {
			expect(responseProp(value)).toBe(value);
		},
	);

	test('keeps lists, records, numbers and booleans as the same values', () => {
		const list = ['A', 'B'];
		const record = { stringValue: '1.50' };
		expect(responseProp(list)).toBe(list);
		expect(responseProp(record)).toBe(record);
		expect(responseProp(0)).toBe(0);
		expect(responseProp(false)).toBe(false);
		expect(responseProp('')).toBe('');
	});

	test('reads null as no response', () => {
		expect(responseProp(null)).toBeUndefined();
		expect(responseProp(undefined)).toBeUndefined();
	});
});
