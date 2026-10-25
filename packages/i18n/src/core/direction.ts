/**
 * Writing direction and the `lang`/`dir` pair a player writes on its roots.
 *
 * A player writes two pairs on two channels. Chrome roots (toolbars, navigation,
 * the shell) take the interface locale's; content roots (the item body, a
 * passage) take the content language's, which the item declares with
 * `xml:lang`. Content that declares no language gets no attributes and inherits
 * the chrome's. Mirrors `stampInterfaceLocale` and `stampContentLanguage` in
 * pie-players' `players-shared`, returning attributes for a template to spread
 * where those write them onto an element.
 */

import type { I18nProvider } from './I18nProvider.js';
import { normalizeLanguageTag } from './language-tags.js';

export type TextDirection = 'ltr' | 'rtl';

/** `lang` and `dir` for one root. */
export interface LanguageAttributes {
	lang: string;
	dir: TextDirection;
}

/**
 * Right-to-left primary language subtags.
 *
 * Only consulted when the engine has no `Intl.Locale` text info: it is the
 * authoritative source but shipped late in Safari, and an assessment rendered
 * left-to-right for an Arabic reader is not a graceful degradation.
 */
const RTL_LANGUAGES = new Set([
	'ar', // Arabic
	'ckb', // Central Kurdish
	'dv', // Dhivehi
	'fa', // Persian
	'he',
	'iw', // Hebrew (current and legacy subtags)
	'ks', // Kashmiri
	'ku', // Kurdish
	'nqo', // N'Ko
	'ps', // Pashto
	'sd', // Sindhi
	'syr', // Syriac
	'ug', // Uyghur
	'ur', // Urdu
	'yi', // Yiddish
]);

type TextInfoLocale = Intl.Locale & {
	getTextInfo?: () => { direction?: string };
	textInfo?: { direction?: string };
};

/** Writing direction of a language tag; `ltr` for anything unrecognised. */
export function languageDirection(tag: string | null | undefined): TextDirection {
	const normalized = normalizeLanguageTag(tag);
	if (!normalized) return 'ltr';
	try {
		const locale = new Intl.Locale(normalized) as TextInfoLocale;
		const direction = (locale.getTextInfo?.() ?? locale.textInfo)?.direction;
		if (direction === 'rtl' || direction === 'ltr') return direction;
	} catch {
		// Not a tag Intl.Locale accepts; the subtag check below still answers.
	}
	return RTL_LANGUAGES.has(normalized.split('-')[0] ?? '') ? 'rtl' : 'ltr';
}

/**
 * The canonical form of a usable language tag, or `undefined` for anything a
 * language in use would not be: `es_MX` becomes `es-MX`, `NL-nl` becomes
 * `nl-NL`, and `Spanish` or an empty string are not tags. Unicode extensions
 * are dropped (`ar-EG-u-nu-latn` becomes `ar-EG`): they steer formatting and
 * have no place in a `lang` attribute.
 */
export function canonicalLanguageTag(tag: string | null | undefined): string | undefined {
	const candidate = (tag ?? '').trim().replace(/_/g, '-').split(/[.@]/)[0] ?? '';
	// Intl accepts any 5-8 letter primary subtag, `Spanish` included; a language
	// in use has an ISO 639 code of two or three letters.
	if (!/^[a-z]{2,3}(-|$)/i.test(candidate)) return undefined;
	try {
		const canonical = Intl.getCanonicalLocales(candidate)[0];
		return canonical ? new Intl.Locale(canonical).baseName : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Chrome attributes: the provider's locale and direction, or `undefined`
 * without a provider, so a host that passes none keeps what the page has.
 */
export function interfaceLocaleAttributes(
	provider: Pick<I18nProvider, 'getLocale' | 'getDirection'> | null | undefined
): LanguageAttributes | undefined {
	if (!provider) return undefined;
	const locale = provider.getLocale();
	return {
		lang: canonicalLanguageTag(locale) ?? locale,
		dir: provider.getDirection?.() ?? languageDirection(locale),
	};
}

/**
 * Content attributes for a declared content language, or `undefined` when the
 * content declares none or the declaration is not a language tag. Nothing is
 * invented: undeclared content inherits its context's attributes.
 */
export function contentLanguageAttributes(language: string | null | undefined): LanguageAttributes | undefined {
	const lang = canonicalLanguageTag(language);
	return lang ? { lang, dir: languageDirection(lang) } : undefined;
}
