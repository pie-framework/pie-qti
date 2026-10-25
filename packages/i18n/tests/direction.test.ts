/**
 * Tests for `src/core/direction.ts`.
 *
 * The `languageDirection`, `canonicalLanguageTag` and content-attribute cases
 * are pie-players' (`players-shared/tests/i18n-conformance-fixtures.json`
 * `direction`, and `i18n-provider.test.ts`), so both repositories stamp the
 * same `lang`/`dir` for the same declaration.
 */

import { describe, expect, it } from 'bun:test';
import {
	canonicalLanguageTag,
	contentLanguageAttributes,
	interfaceLocaleAttributes,
	languageDirection,
} from '../src/core/direction.js';
import { DefaultI18nProvider } from '../src/core/I18n.js';

describe('languageDirection', () => {
	it.each([
		['ar-SA', 'rtl'],
		['he', 'rtl'],
		['fa', 'rtl'],
		['ur', 'rtl'],
		['he-IL', 'rtl'],
		['ckb', 'rtl'],
		['ar_EG', 'rtl'],
		['en-US', 'ltr'],
		['nl-NL', 'ltr'],
		['zh-Hans-CN', 'ltr'],
		['not-a-tag-at-all', 'ltr'],
		['', 'ltr'],
	] as const)('%s is %s', (tag, expected) => {
		expect(languageDirection(tag)).toBe(expected);
	});

	it('answers from the subtag list when Intl.Locale has no text info', () => {
		const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale');
		Object.defineProperty(Intl, 'Locale', {
			configurable: true,
			value: class {
				constructor() {
					throw new RangeError('unsupported');
				}
			},
		});
		try {
			expect(languageDirection('ar-SA')).toBe('rtl');
			expect(languageDirection('ug')).toBe('rtl');
			expect(languageDirection('fr')).toBe('ltr');
		} finally {
			if (descriptor) Object.defineProperty(Intl, 'Locale', descriptor);
		}
	});

	it('is what the default provider reports', () => {
		expect(new DefaultI18nProvider('ar-EG').getDirection()).toBe('rtl');
		expect(new DefaultI18nProvider('en-US').getDirection()).toBe('ltr');
	});
});

describe('canonicalLanguageTag', () => {
	it.each([
		['es_MX', 'es-MX'],
		['NL-nl', 'nl-NL'],
		['zh-hans-cn', 'zh-Hans-CN'],
		['es_ES.UTF-8', 'es-ES'],
		['ar', 'ar'],
		['ar-EG-u-nu-latn', 'ar-EG'],
		['fa-IR-u-ca-persian', 'fa-IR'],
	])('%s becomes %s', (tag, expected) => {
		expect(canonicalLanguageTag(tag)).toBe(expected);
	});

	it.each([['Spanish'], [''], ['  '], ['e'], ['12-34']])('rejects %p', (tag) => {
		expect(canonicalLanguageTag(tag)).toBeUndefined();
	});

	it('rejects nullish input', () => {
		expect(canonicalLanguageTag(null)).toBeUndefined();
		expect(canonicalLanguageTag(undefined)).toBeUndefined();
	});
});

describe('contentLanguageAttributes', () => {
	it('gives declared content its canonical tag and direction', () => {
		expect(contentLanguageAttributes('es_MX')).toEqual({ lang: 'es-MX', dir: 'ltr' });
		expect(contentLanguageAttributes('ar-SA')).toEqual({ lang: 'ar-SA', dir: 'rtl' });
	});

	it('asserts nothing for undeclared or unusable content', () => {
		expect(contentLanguageAttributes(undefined)).toBeUndefined();
		expect(contentLanguageAttributes(null)).toBeUndefined();
		expect(contentLanguageAttributes('Spanish')).toBeUndefined();
	});
});

describe('interfaceLocaleAttributes', () => {
	it("takes the provider's locale and direction", () => {
		expect(interfaceLocaleAttributes(new DefaultI18nProvider('ar-SA'))).toEqual({ lang: 'ar-SA', dir: 'rtl' });
		expect(interfaceLocaleAttributes({ getLocale: () => 'en_US', getDirection: () => 'ltr' })).toEqual({
			lang: 'en-US',
			dir: 'ltr',
		});
	});

	it("derives the direction from the locale when the provider reports none", () => {
		expect(interfaceLocaleAttributes({ getLocale: () => 'nl-NL' })).toEqual({ lang: 'nl-NL', dir: 'ltr' });
		expect(interfaceLocaleAttributes({ getLocale: () => 'ar' })).toEqual({ lang: 'ar', dir: 'rtl' });
	});

	it('keeps a locale that is not a canonical tag as given', () => {
		expect(interfaceLocaleAttributes({ getLocale: () => 'pseudo' })).toEqual({ lang: 'pseudo', dir: 'ltr' });
	});

	it('returns nothing without a provider', () => {
		expect(interfaceLocaleAttributes(undefined)).toBeUndefined();
		expect(interfaceLocaleAttributes(null)).toBeUndefined();
	});
});
