/**
 * Parity test for `src/core/language-tags.ts`.
 *
 * These are the cases of pie-players'
 * `packages/players-shared/tests/language-tags.test.ts` for the functions this
 * package mirrors. Keep both suites identical for those functions, so a tag
 * negotiates to the same catalog in both repositories.
 */

import { describe, expect, it } from 'bun:test';
import {
	languageTagLookupSequence,
	languageTagScript,
	languageTagScriptsMatch,
	normalizeLanguageTag,
} from '../src/core/language-tags.js';

describe('normalizeLanguageTag', () => {
	it('unifies POSIX and BCP-47 separators', () => {
		expect(normalizeLanguageTag('es_ES')).toBe('es-es');
		expect(normalizeLanguageTag('es-ES')).toBe('es-es');
	});

	it('strips POSIX charset and modifier suffixes', () => {
		expect(normalizeLanguageTag('es_ES.UTF-8')).toBe('es-es');
		expect(normalizeLanguageTag('es_ES@euro')).toBe('es-es');
	});

	it('treats nullish and blank input as no declared language', () => {
		expect(normalizeLanguageTag(undefined)).toBe('');
		expect(normalizeLanguageTag(null)).toBe('');
		expect(normalizeLanguageTag('   ')).toBe('');
	});
});

describe('languageTagLookupSequence', () => {
	it('orders from most to least specific', () => {
		expect(languageTagLookupSequence('es-MX')).toEqual(['es-mx', 'es']);
		expect(languageTagLookupSequence('zh-Hant-TW')).toEqual(['zh-hant-tw', 'zh-hant', 'zh']);
	});

	it('keeps a single-subtag tag as one step', () => {
		expect(languageTagLookupSequence('en')).toEqual(['en']);
	});

	it('normalizes POSIX input before truncating', () => {
		expect(languageTagLookupSequence('es_419')).toEqual(['es-419', 'es']);
	});

	it('never stops on a dangling singleton subtag', () => {
		// RFC 4647 §3.4: a truncation ending in a singleton is skipped, so `de-de-u`
		// never appears.
		expect(languageTagLookupSequence('de-DE-u-co')).not.toContain('de-de-u');
		expect(languageTagLookupSequence('de-DE-u-co')).toContain('de-de');
	});

	it('returns nothing for an absent tag', () => {
		expect(languageTagLookupSequence(undefined)).toEqual([]);
	});
});

describe('languageTagScript', () => {
	it('reads an explicit script, then the CLDR likely script', () => {
		expect(languageTagScript('sr-Latn')).toBe('latn');
		expect(languageTagScript('zh-TW')).toBe('hant');
		expect(languageTagScript('zh')).toBe('hans');
		expect(languageTagScript('ar_SA')).toBe('arab');
	});

	it('has no script for a blank or unparseable tag', () => {
		expect(languageTagScript('')).toBeUndefined();
		expect(languageTagScript('not a tag!')).toBeUndefined();
	});
});

describe('languageTagScriptsMatch', () => {
	it('passes when either side has no script data', () => {
		expect(languageTagScriptsMatch('zh-TW', 'not a tag!')).toBe(true);
		expect(languageTagScriptsMatch('zh-TW', 'zh')).toBe(false);
	});

	it('passes every tag when the runtime has no Intl.Locale', () => {
		const intl = Intl as { Locale?: typeof Intl.Locale };
		const { Locale } = intl;
		delete intl.Locale;
		try {
			expect(languageTagScriptsMatch('zh-HK', 'zh-CN')).toBe(true);
		} finally {
			intl.Locale = Locale;
		}
	});
});
