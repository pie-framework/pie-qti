/**
 * The session-side catalog: the QTI 3.0 §6.3 catalog index compiled from the delivery
 * context, shared catalog XML and item XML, and the entry lookup that delivers a
 * sanitized, trusted result.
 */
import type { HtmlContent, ItemSessionEngineConfig, PlayerSecurityConfig } from '../types/index.js';
import { sanitizeHtml } from '../core/sanitizer.js';
import { toTrustedHtml } from '../core/trustedTypes.js';
import { sanitizeResourceUrl } from '../core/urlPolicy.js';
import type { CatalogIndex } from './types.js';
import { extractCatalog, extractCatalogFromItemXml, mergeCatalogs } from './catalogExtractor.js';
import { getCatalogEntryWithAliases } from './catalogLookup.js';

/** The item-level and stimulus catalog indexes of one compiled item. */
export interface SessionCatalogIndexes {
	readonly catalogIndex: CatalogIndex;
	readonly stimulusCatalogIndexes: Map<string, CatalogIndex>;
}

/**
 * Build the catalog indexes from shared catalog XML, item XML, and resolved delivery context.
 * Sanitized item-level delivery context entries win over raw item XML on collisions.
 * Stimulus entries are kept separately so rendered stimulus terms can avoid ID collisions.
 * Package (shared catalog file) entries merge first: they hold the lowest
 * precedence, below catalogXml and the item's own catalogs (QTI 3.0 §6.3).
 */
export function buildSessionCatalogIndexes(input: {
	config: ItemSessionEngineConfig;
	itemXml: string;
}): SessionCatalogIndexes {
	const { config, itemXml } = input;
	const stimulusCatalogIndexes: Map<string, CatalogIndex> = new Map();
	let mergedCatalog: CatalogIndex = new Map();
	let deliveryItemCatalog: CatalogIndex = new Map();
	for (const source of config.deliveryContext?.catalogSources ?? []) {
		const sourceCatalog = extractCatalog(source.xml);
		if (source.scope === 'stimulus' && source.stimulusIdentifier) {
			const existing = stimulusCatalogIndexes.get(source.stimulusIdentifier) ?? new Map();
			stimulusCatalogIndexes.set(
				source.stimulusIdentifier,
				mergeCatalogs(existing, sourceCatalog),
			);
		} else if (source.scope === 'package') {
			mergedCatalog = mergeCatalogs(mergedCatalog, sourceCatalog);
		} else {
			deliveryItemCatalog = mergeCatalogs(deliveryItemCatalog, sourceCatalog);
		}
	}
	if (config.catalogXml) {
		mergedCatalog = mergeCatalogs(
			mergedCatalog,
			extractCatalogFromItemXml(config.catalogXml),
		);
	}
	mergedCatalog = mergeCatalogs(mergedCatalog, extractCatalogFromItemXml(itemXml));
	const catalogIndex = mergeCatalogs(mergedCatalog, deliveryItemCatalog);
	return { catalogIndex, stimulusCatalogIndexes };
}

/**
 * Look up a catalog entry by card identifier, usage type, and optional language.
 * Returns the HTML string for the matched entry, or null if not found.
 *
 * Language fallback: exact match → prefix match → no-lang entry → null.
 */
export function catalogEntryOf(
	indexes: SessionCatalogIndexes,
	idref: string,
	usage: string,
	lang?: string,
	options?: { stimulusIdentifier?: string },
	security?: PlayerSecurityConfig,
): HtmlContent | null {
	const stimulusHtml = options?.stimulusIdentifier
		? getCatalogEntryWithAliases(indexes.stimulusCatalogIndexes.get(options.stimulusIdentifier) ?? new Map(), idref, usage, lang)
		: null;
	const html =
		stimulusHtml ?? getCatalogEntryWithAliases(indexes.catalogIndex, idref, usage, lang);
	if (html === null) return null;
	if (looksLikeCatalogUrl(html)) {
		return sanitizeResourceUrl(html.trim(), security?.urlPolicy, 'img');
	}
	return toTrustedHtml(
		sanitizeHtml(html, { security }),
		security?.trustedTypesPolicyName,
	);
}

function looksLikeCatalogUrl(value: string): boolean {
	const trimmed = value.trim();
	return /^(https?:\/\/|\/\/|\/|\.{0,2}\/|data:|blob:)/i.test(trimmed) ||
		/\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm|pdf)(\?.*)?$/i.test(trimmed);
}
