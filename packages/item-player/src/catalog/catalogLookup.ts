import { languageTagLookupSequence, normalizeLanguageTag } from '@pie-qti/i18n';
import type { CatalogIndex } from './types.js';

/**
 * Look up a catalog entry by card identifier, usage type, and optional language.
 *
 * Language fallback order, comparing tags through `normalizeLanguageTag` so a
 * POSIX `es_ES` entry answers an `es-ES` request:
 *   1. The request's RFC 4647 lookup sequence, most specific first
 *      (`es-MX` tries `es-mx`, then `es`), as pie-players' catalog resolver does
 *   2. Any entry in the requested language (`en` reaches `en-US`, `en-GB`
 *      reaches `en-US`)
 *   3. Entry with no lang specified (universal fallback)
 *   4. The only entry for the usage, whatever its lang
 *   5. null — no match found
 *
 * @param index   CatalogIndex built by extractCatalog / extractCatalogFromItemXml
 * @param idref   The data-catalog-idref value (maps to qti-card identifier)
 * @param usage   Catalog usage type (e.g. 'glossary-on-screen')
 * @param lang    Optional preferred language code (e.g. 'en-US', 'es')
 * @returns The matched entry's html string, or null if nothing found
 */
export function getCatalogEntry(
	index: CatalogIndex,
	idref: string,
	usage: string,
	lang?: string
): string | null {
	const card = index.get(idref);
	if (!card) return null;

	const candidates = card.entries.filter((e) => e.usage === usage);
	if (candidates.length === 0) return null;

	const sequence = languageTagLookupSequence(lang);
	if (sequence.length > 0) {
		const tagged = candidates
			.filter((e) => e.lang)
			.map((entry) => ({ entry, tag: normalizeLanguageTag(entry.lang) }));

		// 1. Lookup sequence
		for (const step of sequence) {
			const hit = tagged.find((t) => t.tag === step);
			if (hit) return hit.entry.html;
		}

		// 2. Same language, narrower or sibling tag
		const language = sequence[sequence.length - 1];
		const sameLanguage = tagged.find((t) => t.tag.split('-')[0] === language);
		if (sameLanguage) return sameLanguage.entry.html;
	}

	// 3. No-lang fallback (entry without a lang attribute)
	const noLang = candidates.find((e) => !e.lang);
	if (noLang) return noLang.html;

	// 4. If we get here and there's only one candidate, return it regardless of lang
	if (candidates.length === 1) return candidates[0].html;

	return null;
}

/**
 * Delivery-level usage aliases: APIP-derived catalogs name a few supports by their AfA
 * support name, where QTI 3 catalogs use the newer usage string. A lookup under a QTI 3
 * usage falls back to its alias so host routing finds both catalog flavors.
 */
export const USAGE_ALIASES: Readonly<Record<string, string>> = {
	'braille-text': 'braille',
	'signing-definition': 'sign-language',
};

/** Look `usage` up, then its QTI 3 → APIP alias, so one idref answers under either name. */
export function getCatalogEntryWithAliases(
	index: CatalogIndex,
	idref: string,
	usage: string,
	lang?: string
): string | null {
	const direct = getCatalogEntry(index, idref, usage, lang);
	if (direct !== null) return direct;
	const alias = USAGE_ALIASES[usage];
	return alias ? getCatalogEntry(index, idref, alias, lang) : null;
}
