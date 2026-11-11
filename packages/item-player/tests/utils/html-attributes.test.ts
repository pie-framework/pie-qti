/**
 * The one attribute reader for serialized HTML markup (see `readHtmlAttribute`).
 *
 * Three private readers used to serve this — one pairing quotes, one not; one tolerating empty
 * values, one not; one reading both QTI attribute spellings, two not. They are one now, with the
 * strictest of the three shapes.
 */

import { describe, expect, test } from 'bun:test';
import { readHtmlAttribute } from '../../src/utils/htmlAttributes.js';

describe('readHtmlAttribute', () => {
	test('reads a double- or single-quoted value', () => {
		expect(readHtmlAttribute(' identifier="g1"', 'identifier')).toBe('g1');
		expect(readHtmlAttribute("id='g1' class='x'", 'id')).toBe('g1');
	});

	test('requires paired quotes, so mixed quoting is not a value', () => {
		expect(readHtmlAttribute('identifier="g1\'', 'identifier')).toBeNull();
		expect(readHtmlAttribute("identifier='g1\"", 'identifier')).toBeNull();
	});

	test('an empty value is present and empty, not absent', () => {
		expect(readHtmlAttribute('identifier=""', 'identifier')).toBe('');
		expect(readHtmlAttribute('identifier=""', 'alt')).toBeNull();
	});

	test('only whitespace may precede the name, so longer names do not read as shorter ones', () => {
		expect(readHtmlAttribute('data-identifier="g1"', 'identifier')).toBeNull();
		expect(readHtmlAttribute('data-identifier="g1" identifier="g2"', 'identifier')).toBe('g2');
	});

	test('a camelCase name also tries its kebab-case spelling', () => {
		expect(readHtmlAttribute('outcomeIdentifier="F"', 'outcomeIdentifier')).toBe('F');
		expect(readHtmlAttribute('outcome-identifier="F"', 'outcomeIdentifier')).toBe('F');
		expect(readHtmlAttribute('outcomeIdentifier="A" outcome-identifier="B"', 'outcomeIdentifier')).toBe('A');
		expect(readHtmlAttribute('show-hide="hide"', 'showHide')).toBe('hide');
		expect(readHtmlAttribute('outcomeIdentifier="F"', 'showHide')).toBeNull();
	});
});
