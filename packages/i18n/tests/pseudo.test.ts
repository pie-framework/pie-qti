/**
 * Tests for `src/core/pseudo.ts`. The plural and options cases are pie-players'
 * (`players-shared/tests/i18n-pseudo.test.ts`), so both repositories produce
 * the same pseudo strings.
 */

import { describe, expect, test } from 'bun:test';
import { DefaultI18nProvider, languageDirection } from '../src/index.js';
import en from '../src/locales/en.js';
import { PSEUDO_LOCALE_EXPANDED, PSEUDO_LOCALE_RTL, pseudoLocalize } from '../src/core/pseudo.js';

const PLACEHOLDER = /\{\w+\}/g;

function flatten(node: unknown, prefix = '', out = new Map<string, string>()): Map<string, string> {
	if (node && typeof node === 'object') {
		for (const [key, child] of Object.entries(node)) flatten(child, prefix ? `${prefix}.${key}` : key, out);
	} else if (typeof node === 'string') {
		out.set(prefix, node);
	}
	return out;
}

describe('pseudoLocalize', () => {
	test('every key of the English catalog survives with its placeholder set', () => {
		const pseudo = flatten(pseudoLocalize(en));
		const english = flatten(en);
		expect([...pseudo.keys()].sort()).toEqual([...english.keys()].sort());
		for (const [key, source] of english) {
			const value = pseudo.get(key) ?? '';
			expect(value.match(PLACEHOLDER) ?? [], key).toEqual(source.match(PLACEHOLDER) ?? []);
		}
	});

	test('strings grow, carry accents and sit inside the brackets', () => {
		for (const [key, value] of flatten(pseudoLocalize(en))) {
			expect(value.startsWith('['), key).toBe(true);
			expect(value.endsWith(']'), key).toBe(true);
			expect(value.length, key).toBeGreaterThan((flatten(en).get(key) ?? '').length);
		}
	});

	test('every Latin letter maps to one accented letter', () => {
		const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const out = pseudoLocalize({ letters }, { brackets: false, expansion: 0 }).letters as string;
		expect([...out]).toHaveLength(letters.length);
		expect(out).not.toMatch(/[a-zA-Z]/);
	});

	test('plural categories are preserved verbatim', () => {
		const pseudo = pseudoLocalize({ triesLeft: { one: '1 try left.', other: '{count} tries left.' } });
		const group = pseudo.triesLeft as Record<string, string>;
		expect(Object.keys(group).sort()).toEqual(['one', 'other']);
		expect(group.other).toBe('[{count} ŧŕíéš ĺéƒŧ. ~~~~~]');
	});

	test('options turn the accents, the padding and the brackets off', () => {
		expect(pseudoLocalize({ close: 'Close' }, { accents: false, brackets: false, expansion: 0 }).close).toBe('Close');
	});

	test('the pseudo tags resolve direction without a catalog', () => {
		expect(languageDirection(PSEUDO_LOCALE_EXPANDED)).toBe('ltr');
		expect(languageDirection(PSEUDO_LOCALE_RTL)).toBe('rtl');
	});

	test('serves through the provider as a customMessages-only locale', async () => {
		const i18n = new DefaultI18nProvider(PSEUDO_LOCALE_RTL, { [PSEUDO_LOCALE_RTL]: pseudoLocalize(en) });
		await i18n.loadLocale(PSEUDO_LOCALE_RTL);
		expect(i18n.getDirection()).toBe('rtl');
		const close = i18n.t('common.close');
		expect(close.startsWith('[')).toBe(true);
		expect(close.endsWith(']')).toBe(true);
		expect(i18n.t('common.close')).not.toBe(en.common.close);
	});
});
