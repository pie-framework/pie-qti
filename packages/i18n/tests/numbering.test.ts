import { describe, expect, test } from 'bun:test';
import { formattingLocale, numberingSystemFor } from '../src/core/numbering.js';

describe('numberingSystemFor', () => {
	test.each([
		['ar', 'latn'],
		['ar-EG', 'arab'],
		['ar-SA', 'arab'],
		['ar_SA', 'arab'],
		['ar-MA', 'latn'],
		['ar-AE', 'latn'],
		['ar-001', 'latn'],
		['fa', 'arabext'],
		['ps-AF', 'arabext'],
		['ur', 'latn'],
		['ur-IN', 'arabext'],
		['bn', 'beng'],
		['mr', 'deva'],
		['ne-NP', 'deva'],
		['en-US', 'latn'],
		['th-TH', 'latn'],
		['not a tag', 'latn'],
	])('%s uses %s', (tag, expected) => {
		expect(numberingSystemFor(tag)).toBe(expected);
	});

	test('a host numbering extension wins over the table', () => {
		expect(numberingSystemFor('ar-EG-u-nu-latn')).toBe('latn');
		expect(numberingSystemFor('ar-u-nu-arab')).toBe('arab');
	});
});

describe('formattingLocale', () => {
	test('pins the numbering system and the Gregorian calendar', () => {
		expect(formattingLocale('ar-SA')).toBe('ar-SA-u-ca-gregory-nu-arab');
		expect(formattingLocale('th-TH')).toBe('th-TH-u-ca-gregory-nu-latn');
	});

	test('keeps a host calendar', () => {
		expect(formattingLocale('fa-IR-u-ca-persian')).toBe('fa-IR-u-ca-persian-nu-arabext');
	});

	test('formats an unusable tag as English', () => {
		expect(formattingLocale('not a tag')).toBe('en-US');
	});
});
