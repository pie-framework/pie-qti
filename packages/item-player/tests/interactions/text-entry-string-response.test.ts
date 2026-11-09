/**
 * The companion response a textEntryInteraction's stringIdentifier names (QTI ASI §5.122.3)
 * holds the text the candidate entered, or NULL for an empty field.
 */

import { describe, expect, test } from 'bun:test';
import {
	createTextEntryStringResponse,
	textEntryStringIdentifier,
} from '../../src/interactions/text-entry/response.js';

describe('createTextEntryStringResponse', () => {
	test('typed text is kept as entered, before any numeric reading', () => {
		expect(createTextEntryStringResponse('3.50', {})).toBe('3.50');
		expect(createTextEntryStringResponse('101', { base: 2 })).toBe('101');
		expect(createTextEntryStringResponse('abc', {})).toBe('abc');
	});

	test('an empty field gives NULL', () => {
		expect(createTextEntryStringResponse('', {})).toBeNull();
		expect(createTextEntryStringResponse('   ', {})).toBeNull();
		expect(createTextEntryStringResponse(null, {})).toBeNull();
		expect(createTextEntryStringResponse(undefined, {})).toBeNull();
	});

	test('a number written by a host is spelled in the interaction base', () => {
		expect(createTextEntryStringResponse(5, { base: 2 })).toBe('101');
		expect(createTextEntryStringResponse(255, { base: 16 })).toBe('ff');
		expect(createTextEntryStringResponse(3.5, {})).toBe('3.5');
	});
});

describe('textEntryStringIdentifier', () => {
	test('names the companion response', () => {
		expect(textEntryStringIdentifier({ responseId: 'NUM', stringIdentifier: 'STR' })).toBe('STR');
	});

	test('is undefined when absent, or when it repeats the interaction response', () => {
		expect(textEntryStringIdentifier({ responseId: 'NUM' })).toBeUndefined();
		expect(textEntryStringIdentifier({ responseId: 'NUM', stringIdentifier: '' })).toBeUndefined();
		expect(textEntryStringIdentifier({ responseId: 'NUM', stringIdentifier: 'NUM' })).toBeUndefined();
	});
});
