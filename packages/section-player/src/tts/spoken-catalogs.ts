/// <reference lib="dom" />

import { contentLanguageAttributes } from '@pie-qti/i18n';
import { enforceItemXmlLimits } from '@pie-qti/item-player/security';
import type { PlayerSecurityConfig } from '@pie-qti/item-player';
import { type ContentLink, prepareContentMarkup, readApipAccessElements } from '@pie-qti/qti-common/accessibility';

type DOMParserConstructor = new () => {
	parseFromString(xml: string, mimeType: string): Document;
};

type XMLSerializerLike = {
	serializeToString(node: Node): string;
};

interface ItemSpeechOptions {
	DOMParserImpl?: DOMParserConstructor;
	XMLSerializerImpl?: new () => XMLSerializerLike;
	security?: PlayerSecurityConfig;
}

/** A `spoken` catalog, in the shape the PIE toolkit registers per owner. */
export interface SpokenCatalog {
	identifier: string;
	cards: Array<{ catalog: 'spoken'; content: string }>;
}

export interface ItemSpeech {
	catalogs: SpokenCatalog[];
	/** The content's `xml:lang`, when the item declares one. */
	language?: string;
}

/** The QTI 2 element name: `qti-catalog` reads as `catalog`. */
function qtiName(element: Element) {
	const local = element.localName;
	if (!local.startsWith('qti-')) return local;
	return local.slice(4).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function allElements(root: ParentNode) {
	return Array.from(root.querySelectorAll('*'));
}

function childElementsByName(element: Element, name: string) {
	return Array.from(element.children).filter((child) => qtiName(child) === name);
}

/** The language the item's content is written in: the item body's `xml:lang`, else the item's. */
function contentLanguageOf(document: Document) {
	const itemBody = allElements(document).find((element) => qtiName(element) === 'itemBody');
	const language =
		itemBody?.getAttribute('xml:lang')?.trim() || document.documentElement.getAttribute('xml:lang')?.trim();
	return language || undefined;
}

function getSerializer(options: ItemSpeechOptions) {
	const XMLSerializerImpl = options.XMLSerializerImpl ?? (typeof XMLSerializer !== 'undefined' ? XMLSerializer : null);
	return XMLSerializerImpl ? new XMLSerializerImpl() : null;
}

/**
 * The APIP access elements' spoken cards, and the links that dock their identifiers on the
 * content they describe: the identifiers the item player docks the same elements under.
 */
function apipSpeechOf(qtiXml: string): { links: ContentLink[]; catalogs: SpokenCatalog[] } {
	if (!qtiXml.includes('accessElement')) return { links: [], catalogs: [] };
	const links: ContentLink[] = [];
	const catalogs: SpokenCatalog[] = [];
	for (const { identifier, links: elementLinks, cards } of readApipAccessElements(qtiXml)) {
		const spoken = cards.flatMap((card) =>
			card.catalog === 'spoken' && card.content ? [{ catalog: 'spoken' as const, content: card.content }] : [],
		);
		if (!identifier || spoken.length === 0) continue;
		catalogs.push({ identifier, cards: spoken });
		links.push(...elementLinks.map((link) => ({ idref: identifier, ...link })));
	}
	return { links, catalogs };
}

const QTI_NAMESPACE_DECLARATION = /\s+xmlns(?::[\w-]+)?="http:\/\/www\.imsglobal\.org\/[^"]*"/g;

/** The `spoken` cards of the item's `qti-catalog-info`, their `qti-html-content` serialized as authored. */
function nativeSpokenCatalogs(document: Document, serializer: XMLSerializerLike | null): SpokenCatalog[] {
	if (!serializer) return [];
	const catalogs: SpokenCatalog[] = [];
	for (const catalog of allElements(document).filter((element) => qtiName(element) === 'catalog')) {
		const identifier = (catalog.getAttribute('id') ?? catalog.getAttribute('identifier'))?.trim();
		if (!identifier) continue;
		const cards = childElementsByName(catalog, 'card')
			.filter((card) => card.getAttribute('support') === 'spoken')
			.flatMap((card) => {
				const content = allElements(card)
					.filter((element) => qtiName(element) === 'htmlContent')
					.map((element) =>
						Array.from(element.childNodes)
							.map((node) => serializer.serializeToString(node))
							.join('')
							.replace(QTI_NAMESPACE_DECLARATION, '')
							.trim(),
					)
					.filter(Boolean)
					.join(' ');
				return content ? [{ catalog: 'spoken' as const, content }] : [];
			});
		if (cards.length > 0) catalogs.push({ identifier, cards });
	}
	return catalogs;
}

/**
 * A passage's markup as it reads aloud, and the spoken catalogs its SSML makes: `data-ssml`
 * and inline SSML dock under generated idrefs, the item player's preparation of item content.
 * Its `xml:lang` is restated as `lang` (with `dir` where the direction changes against the
 * passage's own `language`), with or without SSML: HTML ignores `xml:lang`.
 */
export function prepareReadableBlock(rawHtml: string, language?: string): { html: string; catalogs: SpokenCatalog[] } {
	if (!/ssml|synthesis|xml:lang/.test(rawHtml)) return { html: rawHtml, catalogs: [] };
	// The passage's direction is the one its nested languages are compared against.
	const dir = contentLanguageAttributes(language)?.dir;
	const open = dir ? `<qti-stimulus-body dir="${dir}">` : '<qti-stimulus-body>';
	const close = '</qti-stimulus-body>';
	const prepared = prepareContentMarkup(`${open}${rawHtml}${close}`, [], { hidingStyles: false });
	const start = prepared.xml.indexOf(open);
	const end = prepared.xml.lastIndexOf(close);
	if (start < 0 || end < start) return { html: rawHtml, catalogs: [] };
	return {
		html: prepared.xml.slice(start + open.length, end),
		catalogs: prepared.spoken.map(({ identifier, content }) => ({ identifier, cards: [{ catalog: 'spoken', content }] })),
	};
}

/**
 * The item's spoken catalogs and content language: the `spoken` cards of its `qti-catalog-info`
 * and APIP access elements, and those its SSML makes. The item player renders the same preparation,
 * so the generated idrefs resolve against its content.
 */
export function extractItemSpeech(itemXml?: string, options: ItemSpeechOptions = {}): ItemSpeech {
	if (!itemXml) return { catalogs: [] };
	enforceItemXmlLimits(itemXml, options.security);

	const apip = apipSpeechOf(itemXml);
	const prepared = prepareContentMarkup(itemXml, apip.links, { hidingStyles: false });
	const catalogs = [
		...apip.catalogs,
		...prepared.spoken.map(({ identifier, content }): SpokenCatalog => ({
			identifier,
			cards: [{ catalog: 'spoken', content }],
		})),
	];

	const DOMParserImpl = options.DOMParserImpl ?? (typeof DOMParser !== 'undefined' ? DOMParser : null);
	if (!DOMParserImpl) return { catalogs };
	const document = new DOMParserImpl().parseFromString(prepared.xml, 'application/xml');
	if (document.getElementsByTagName('parsererror').length > 0) return { catalogs };

	catalogs.unshift(...nativeSpokenCatalogs(document, getSerializer(options)));
	const language = contentLanguageOf(document);
	return { catalogs, ...(language ? { language } : {}) };
}

/** The outcome of `tryExtractItemSpeech`: the speech, or the reported failure. */
export type ItemSpeechOutcome =
	| { ok: true; speech: ItemSpeech }
	| { ok: false; message: string; cause: unknown };

/**
 * `extractItemSpeech` for section shells: a security rejection (a `<!DOCTYPE>`, an
 * item over the parsing limit) comes back as a failure instead of a throw, so a
 * section layout can report it and keep rendering the item — the item player
 * degrades to its own per-item alert for the same item — simply without
 * read-aloud catalogs.
 */
export function tryExtractItemSpeech(itemXml?: string, options: ItemSpeechOptions = {}): ItemSpeechOutcome {
	try {
		return { ok: true, speech: extractItemSpeech(itemXml, options) };
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : 'Unable to prepare the item for read-aloud.',
			cause: error,
		};
	}
}

/** The outcome of `tryPrepareReadableBlock`: the readable markup, or `rawHtml` with the failure. */
export type ReadableBlockOutcome =
	| { ok: true; html: string; catalogs: SpokenCatalog[] }
	| { ok: false; html: string; message: string; cause: unknown };

/**
 * `prepareReadableBlock` for section shells: markup a safe preparer rejects comes
 * back as authored (no catalogs) with the failure reported, so a passage, rubric
 * or feedback block degrades instead of taking the section layout's render down.
 * `prepare` is the preparation to run; it defaults to `prepareReadableBlock`.
 */
export function tryPrepareReadableBlock(
	rawHtml: string,
	language?: string,
	prepare: typeof prepareReadableBlock = prepareReadableBlock,
): ReadableBlockOutcome {
	try {
		return { ok: true, ...prepare(rawHtml, language) };
	} catch (error) {
		return {
			ok: false,
			html: rawHtml,
			message: error instanceof Error ? error.message : 'Unable to prepare the block for read-aloud.',
			cause: error,
		};
	}
}
