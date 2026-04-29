import type { CatalogIndex } from './types.js';

/**
 * Look up a catalog entry by card identifier, usage type, and optional language.
 *
 * Language fallback order (mirrors APIP 1.0 / HTTP Accept-Language conventions):
 *   1. Exact lang match (e.g. 'en-US')
 *   2. Language-prefix match (e.g. 'en' matches entry with lang 'en-US')
 *   3. Entry with no lang specified (universal fallback)
 *   4. null — no match found
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

	// 1. Exact language match
	if (lang) {
		const exact = candidates.find((e) => e.lang === lang);
		if (exact) return exact.html;

		// 2. Language-prefix match: requested lang prefix matches entry lang
		//    e.g. lang='en' matches entry.lang='en-US'
		//    e.g. lang='en-US' matches entry.lang='en' (broader fallback)
		const prefix = lang.split('-')[0];
		const prefixMatch = candidates.find(
			(e) => e.lang && (e.lang === prefix || e.lang.startsWith(`${prefix}-`) || lang.startsWith(`${e.lang}-`))
		);
		if (prefixMatch) return prefixMatch.html;
	}

	// 3. No-lang fallback (entry without a lang attribute)
	const noLang = candidates.find((e) => !e.lang);
	if (noLang) return noLang.html;

	// 4. If we get here and there's only one candidate, return it regardless of lang
	if (candidates.length === 1) return candidates[0].html;

	return null;
}
