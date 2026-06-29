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

	for (const catalogEl of infoEl.querySelectorAll('qti-catalog')) {
		const identifier = catalogEl.getAttribute('id') ?? catalogEl.getAttribute('identifier');
		if (!identifier) continue;

		const entries: CatalogEntry[] = [];
		for (const cardEl of catalogEl.querySelectorAll('qti-card')) {
			const cardUsage = cardEl.getAttribute('support') ?? cardEl.getAttribute('usage');
			for (const entry of extractCardEntries(cardEl, cardUsage ?? undefined)) {
				entries.push(entry);
			}
		}

		if (entries.length > 0) {
			index.set(identifier, { entries });
		}
	}

	for (const cardEl of infoEl.querySelectorAll('qti-card')) {
		const identifier = cardEl.getAttribute('identifier');
		if (!identifier) continue;

		const entries = extractCardEntries(cardEl);

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

function extractCardEntries(cardEl: NhpElement, fallbackUsage?: string): CatalogEntry[] {
	const explicitEntries = cardEl.querySelectorAll('qti-card-entry');
	const entries: CatalogEntry[] = [];

	if (explicitEntries.length > 0) {
		for (const entryEl of explicitEntries) {
			const usage =
				entryEl.getAttribute('usage') ??
				entryEl.getAttribute('data-reading-type') ??
				fallbackUsage;
			if (!usage) continue;
			entries.push({
				usage,
				lang: getLang(entryEl),
				html: extractHtmlContent(entryEl),
			});
		}
		return entries;
	}

	if (fallbackUsage) {
		entries.push({
			usage: fallbackUsage,
			lang: getLang(cardEl),
			html: extractHtmlContent(cardEl),
		});
	}

	return entries;
}

function getLang(el: NhpElement): string | undefined {
	return el.getAttribute('xml:lang') ?? el.getAttribute('xmllang') ?? el.getAttribute('lang') ?? undefined;
}

function extractHtmlContent(el: NhpElement): string {
	const htmlContent = el.querySelector('qti-html-content');
	const fileHref = el.querySelector('qti-file-href');

	if (htmlContent) return htmlContent.innerHTML ?? htmlContent.text ?? '';
	if (fileHref) return fileHref.getAttribute('src') ?? fileHref.text?.trim() ?? '';
	return '';
}
