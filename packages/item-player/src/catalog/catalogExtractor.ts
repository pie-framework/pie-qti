import { parse as parseHtml } from 'node-html-parser';
import type { HTMLElement as NhpElement } from 'node-html-parser';
import { apipCatalogIndex, readApipAccessibility } from './apipAccessibility.js';
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
 * Parse a raw QTI item XML string and extract the embedded catalog: QTI 3.0 <qti-catalog-info>
 * and the access elements of QTI 2.x APIP accessibility, each a catalog under its identifier.
 * Used by Player when integrating with the full item XML.
 */
export function extractCatalogFromItemXml(itemXml: string): CatalogIndex {
	const doc = parseHtml(itemXml, { lowerCaseTagName: true });
	const infoEl = doc.querySelector('qti-catalog-info');
	const index = infoEl ? buildIndex(infoEl) : new Map();
	for (const [identifier, card] of apipCatalogIndex(readApipAccessibility(itemXml))) {
		const existing = index.get(identifier);
		if (existing) existing.entries.push(...card.entries);
		else index.set(identifier, card);
	}
	return index;
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

/**
 * A card entry's content: every `qti-html-content` and `qti-file-href` in document order.
 * A lone file href stays a bare URL, which the player resolves through its URL policy. Alongside
 * other content a file href becomes the element its MIME type plays in (`img`, `audio` or
 * `video`), or a link.
 */
function extractHtmlContent(el: NhpElement): string {
	const parts = el.querySelectorAll('qti-html-content, qti-file-href');
	if (parts.length === 1 && parts[0].rawTagName.toLowerCase() === 'qti-file-href') {
		return fileHrefOf(parts[0]);
	}
	return parts
		.map((part) =>
			part.rawTagName.toLowerCase() === 'qti-html-content'
				? (part.innerHTML ?? part.text ?? '')
				: fileHrefContent(part),
		)
		.filter((content) => content.trim() !== '')
		.join('');
}

function fileHrefOf(el: NhpElement): string {
	return el.getAttribute('src') ?? el.text?.trim() ?? '';
}

function mediaKindOf(el: NhpElement): 'img' | 'audio' | 'video' | undefined {
	const type = el.getAttribute('mime-type')?.trim().toLowerCase() ?? '';
	if (type.startsWith('image/')) return 'img';
	if (type.startsWith('audio/')) return 'audio';
	if (type.startsWith('video/')) return 'video';
	return undefined;
}

function escapeAttr(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fileHrefContent(el: NhpElement): string {
	const href = fileHrefOf(el);
	if (!href) return '';
	const src = escapeAttr(href);
	const kind = mediaKindOf(el);
	if (kind === 'img') return `<img src="${src}" alt="">`;
	if (kind) return `<${kind} controls src="${src}"></${kind}>`;
	return `<a href="${src}">${src}</a>`;
}
