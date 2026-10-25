/**
 * Digits and calendar for locale formatting
 *
 * The runtime's own defaults are not used: they follow whatever CLDR its ICU
 * ships, so `ar-SA` formats with Western digits in one browser and
 * Arabic-Indic in the next, and `ur-IN` differs between Bun and Node today.
 * The digit table below is pinned to CLDR 48 instead, and every format runs on
 * the Gregorian calendar, so a `fa-IR` or `th-TH` date shows the same year the
 * rest of the assessment does.
 *
 * A host overrides either per tag with a Unicode extension (`ar-SA-u-nu-latn`,
 * `fa-IR-u-ca-persian`). The extensions only steer formatting: catalog lookup
 * and the `lang` attribute use the tag without them.
 */

/** CLDR 48 default numbering systems that differ from `latn`, by language and region. */
const NUMBERING_SYSTEMS: Readonly<Record<string, string>> = {
	'ar-BH': 'arab',
	'ar-DJ': 'arab',
	'ar-EG': 'arab',
	'ar-ER': 'arab',
	'ar-IL': 'arab',
	'ar-IQ': 'arab',
	'ar-JO': 'arab',
	'ar-KM': 'arab',
	'ar-KW': 'arab',
	'ar-LB': 'arab',
	'ar-MR': 'arab',
	'ar-OM': 'arab',
	'ar-PS': 'arab',
	'ar-QA': 'arab',
	'ar-SA': 'arab',
	'ar-SD': 'arab',
	'ar-SO': 'arab',
	'ar-SS': 'arab',
	'ar-SY': 'arab',
	'ar-TD': 'arab',
	'ar-YE': 'arab',
	bn: 'beng',
	fa: 'arabext',
	mr: 'deva',
	ne: 'deva',
	ps: 'arabext',
	'ur-IN': 'arabext',
};

const FALLBACK_LOCALE = 'en-US';

function parseLocale(tag: string): Intl.Locale | undefined {
	const candidate = tag.trim().replace(/_/g, '-').split(/[.@]/)[0] ?? '';
	try {
		return new Intl.Locale(candidate);
	} catch {
		return undefined;
	}
}

/**
 * The numbering system a tag formats with: a host-supplied `-u-nu-`, else the
 * pinned table by language and region, then by language, else `latn`.
 *
 * @example numberingSystemFor('ar') => 'latn'
 * @example numberingSystemFor('ar-EG') => 'arab'
 * @example numberingSystemFor('ar-EG-u-nu-latn') => 'latn'
 */
export function numberingSystemFor(tag: string): string {
	const locale = parseLocale(tag);
	if (!locale) return 'latn';
	if (locale.numberingSystem) return locale.numberingSystem;
	const regional = locale.region ? NUMBERING_SYSTEMS[`${locale.language}-${locale.region}`] : undefined;
	return regional ?? NUMBERING_SYSTEMS[locale.language] ?? 'latn';
}

/**
 * The tag to hand `Intl` formatters: the locale with its pinned numbering
 * system and the Gregorian calendar unless the host set either. A tag `Intl`
 * rejects formats as English.
 *
 * @example formattingLocale('ar-SA') => 'ar-SA-u-ca-gregory-nu-arab'
 */
export function formattingLocale(tag: string): string {
	const locale = parseLocale(tag);
	if (!locale) return FALLBACK_LOCALE;
	return new Intl.Locale(locale.baseName, {
		calendar: locale.calendar ?? 'gregory',
		numberingSystem: numberingSystemFor(tag),
	}).toString();
}
