/**
 * QTI 3 catalog info
 *
 * QTI 3.0 carries catalogs natively as `qti-catalog-info`, the shape the cards already have: each
 * catalog becomes a `qti-catalog` by its identifier, each card a `qti-card` with its support and
 * `xml:lang`. HTML content goes in `qti-html-content`; a `<speak>` script is put in the SSML
 * namespace, where QTI 3 admits it. A media payload becomes one `qti-file-href` per source, with
 * the MIME type QTI 3 requires (`application/octet-stream` when unknown) and its time range as a
 * media fragment. A card with neither body, and a catalog left without a card, are not written.
 */

import { SSML_NAMESPACE } from './apip.js';
import { type AccessibilityCatalog, type CatalogCard, mediaMimeType } from './catalog.js';

export interface QtiCatalogInfoOptions {
	/** Card HTML as the document's XML. Identity by default; SSML scripts bypass it. */
	html?: (content: string) => string;
}

const SPEAK = /^\s*<speak(?=[\s>/])/;

/** The `qti-catalog-info` element for `catalogs`, or `''` when none has a card to write. */
export function writeQtiCatalogInfo(
	catalogs: readonly AccessibilityCatalog[],
	options: QtiCatalogInfoOptions = {},
): string {
	const html = options.html ?? ((content: string) => content);
	const written = catalogs.flatMap(({ identifier, cards }) => {
		const xml = cards.flatMap((card) => cardXml(card, html) ?? []);
		return xml.length > 0 ? [`<qti-catalog id="${escapeAttribute(identifier)}">${xml.join('')}</qti-catalog>`] : [];
	});
	return written.length > 0 ? `<qti-catalog-info>${written.join('')}</qti-catalog-info>` : '';
}

function cardXml(card: CatalogCard, html: (content: string) => string): string | undefined {
	const body = card.content?.trim() ? htmlContent(card.content, html) : fileHrefs(card);
	if (!body) return undefined;
	const lang = card.language ? ` xml:lang="${escapeAttribute(card.language)}"` : '';
	return `<qti-card support="${escapeAttribute(card.catalog)}"${lang}>${body}</qti-card>`;
}

function htmlContent(content: string, html: (content: string) => string): string {
	if (!SPEAK.test(content)) return `<qti-html-content>${html(content)}</qti-html-content>`;
	const ssml = /^\s*<speak[^>]*\sxmlns\s*=/.test(content)
		? content
		: content.replace(SPEAK, (open) => `${open} xmlns="${SSML_NAMESPACE}"`);
	return `<qti-html-content>${ssml}</qti-html-content>`;
}

function fileHrefs({ payload }: CatalogCard): string | undefined {
	if (!payload) return undefined;
	const { fragment } = payload;
	const range = fragment
		? `#t=${fragment.startSeconds}${fragment.endSeconds === undefined ? '' : `,${fragment.endSeconds}`}`
		: '';
	const files = payload.media.sources
		.filter((source) => source.src.trim())
		.map((source) => {
			const type = mediaMimeType(source) ?? 'application/octet-stream';
			const href = source.src.includes('#') ? source.src : `${source.src}${range}`;
			return `<qti-file-href mime-type="${escapeAttribute(type)}">${escapeText(href)}</qti-file-href>`;
		});
	return files.length > 0 ? files.join('') : undefined;
}

function escapeText(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
	return escapeText(value).replace(/"/g, '&quot;');
}
