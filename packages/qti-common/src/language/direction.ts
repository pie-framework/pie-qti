/**
 * Writing direction of a language tag.
 *
 * The same answer as `languageDirection` in `@pie-qti/i18n`, which this package
 * does not depend on; item-player's `language-direction-parity.test.ts` holds
 * the two to one table.
 */

export type TextDirection = 'ltr' | 'rtl';

/** Right-to-left primary subtags, for engines whose `Intl.Locale` has no text info. */
const RTL_LANGUAGES = new Set([
	'ar',
	'ckb',
	'dv',
	'fa',
	'he',
	'iw',
	'ks',
	'ku',
	'nqo',
	'ps',
	'sd',
	'syr',
	'ug',
	'ur',
	'yi',
]);

type TextInfoLocale = Intl.Locale & {
	getTextInfo?: () => { direction?: string };
	textInfo?: { direction?: string };
};

/** Writing direction of a language tag; `ltr` for anything unrecognised. */
export function languageDirection(tag: string | null | undefined): TextDirection {
	const normalized = (tag ?? '').trim().replace(/_/g, '-').split(/[.@]/)[0]?.toLowerCase() ?? '';
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
