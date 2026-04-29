import { parse as parseHtml } from 'node-html-parser';
import type { HTMLElement as NhpElement } from 'node-html-parser';
import type { CatalogCard, CatalogEntry, CatalogIndex } from './types.js';

/**
 * Parse an XML string containing a QTI 3.0 <qti-catalog-info> element into a CatalogIndex.
 *
 * The mapper is not needed here because we parse the QTI 3.0 element names directly.
 * All element names use lower-case matching (node-html-parser normalises tags).
 */
export function extractCatalog(xml: string): CatalogIndex {
	if (!xml.trim()) return new Map();

	const doc = parseHtml(`<root>${xml}</root>`, { lowerCaseTagName: true });

	// Find <qti-catalog-info> (QTI 3.0 kebab form)
	const infoEl = doc.querySelector('qti-catalog-info');
	if (!infoEl) return new Map();

	return buildIndex(infoEl);
}

/**
 * Parse a raw QTI item XML string and extract the embedded catalog.
 * Used by Player when integrating with the full item XML.
 */
export function extractCatalogFromItemXml(itemXml: string): CatalogIndex {
	const doc = parseHtml(itemXml, { lowerCaseTagName: true });
	const infoEl = doc.querySelector('qti-catalog-info');
	if (!infoEl) return new Map();
	return buildIndex(infoEl);
}

/**
 * Merge two CatalogIndex maps. itemLevel entries win on collision (same identifier).
 */
export function mergeCatalogs(base: CatalogIndex, override: CatalogIndex): CatalogIndex {
	const merged: CatalogIndex = new Map(base);
	for (const [id, card] of override) {
		merged.set(id, card);
	}
	return merged;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function buildIndex(infoEl: NhpElement): CatalogIndex {
	const index: CatalogIndex = new Map();

	for (const cardEl of infoEl.querySelectorAll('qti-card')) {
		const identifier = cardEl.getAttribute('identifier');
		if (!identifier) continue;

		const entries: CatalogEntry[] = [];

		for (const entryEl of cardEl.querySelectorAll('qti-card-entry')) {
			const usage = entryEl.getAttribute('usage');
			if (!usage) continue;

			// xml:lang is stored as 'xml:lang' or just 'lang' in node-html-parser
			const lang =
				entryEl.getAttribute('xml:lang') ??
				entryEl.getAttribute('xmllang') ??
				entryEl.getAttribute('lang') ??
				undefined;

			// Inner content: from <qti-html-content> (innerHTML) or <qti-file-href> (src attr)
			const htmlContent = entryEl.querySelector('qti-html-content');
			const fileHref = entryEl.querySelector('qti-file-href');

			let html = '';
			if (htmlContent) {
				html = htmlContent.innerHTML ?? htmlContent.text ?? '';
			} else if (fileHref) {
				html = fileHref.getAttribute('src') ?? fileHref.text?.trim() ?? '';
			}

			entries.push({ usage, lang: lang || undefined, html });
		}

		if (entries.length > 0) {
			const existing = index.get(identifier);
			if (existing) {
				existing.entries.push(...entries);
			} else {
				index.set(identifier, { entries });
			}
		}
	}

	return index;
}
