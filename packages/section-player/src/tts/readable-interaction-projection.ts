/// <reference lib="dom" />

import { enforceItemXmlLimits, sanitizeHtml } from '@pie-qti/item-player/security';
import type { PlayerSecurityConfig } from '@pie-qti/item-player';
import { type ContentLink, prepareContentMarkup, readApipAccessElements } from '@pie-qti/qti-common/accessibility';

type DOMParserConstructor = new () => {
	parseFromString(xml: string, mimeType: string): Document;
};

type XMLSerializerLike = {
	serializeToString(node: Node): string;
};

interface ReadableProjectionOptions {
	DOMParserImpl?: DOMParserConstructor;
	XMLSerializerImpl?: new () => XMLSerializerLike;
	security?: PlayerSecurityConfig;
}

const interactionElementNames = new Set([
	'associateInteraction',
	'choiceInteraction',
	'customInteraction',
	'drawingInteraction',
	'endAttemptInteraction',
	'extendedTextInteraction',
	'gapMatchInteraction',
	'graphicAssociateInteraction',
	'graphicGapMatchInteraction',
	'graphicOrderInteraction',
	'hotspotInteraction',
	'hottextInteraction',
	'inlineChoiceInteraction',
	'matchInteraction',
	'mediaInteraction',
	'orderInteraction',
	'positionObjectInteraction',
	'selectPointInteraction',
	'sliderInteraction',
	'textEntryInteraction',
	'uploadInteraction',
]);

const readableChildNames = new Set([
	'gapText',
	'hottext',
	'inlineChoice',
	'object',
	'prompt',
	'simpleAssociableChoice',
	'simpleChoice',
]);

const optionLikeNames = new Set(['gapText', 'hottext', 'inlineChoice', 'simpleAssociableChoice', 'simpleChoice']);

/** A `spoken` catalog, in the shape the PIE toolkit registers per owner. */
export interface SpokenCatalog {
	identifier: string;
	cards: Array<{ catalog: 'spoken'; content: string }>;
}

export interface ReadableItemSpeech {
	/** Readable copies of the interaction content, which renders inside shadow roots. */
	html: string;
	catalogs: SpokenCatalog[];
	/** The content's `xml:lang`, when the item declares one. */
	language?: string;
}

// `screen-reader` asks the host to hide the node from assistive technology; machine read-aloud
// still speaks it. Unrecognised values suppress, as the PIE toolkit does.
const READ_ALOUD_KEPT = new Set(['screen-reader']);

/** The QTI 2 element name: `qti-choice-interaction` reads as `choiceInteraction`. */
function qtiName(element: Element) {
	const local = element.localName;
	if (!local.startsWith('qti-')) return local;
	return local.slice(4).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function isSilenced(element: Element) {
	const suppress = element.getAttribute('data-tts-suppress') ?? element.getAttribute('data-qti-suppress-tts');
	if (suppress !== null && !READ_ALOUD_KEPT.has(suppress.trim().toLowerCase())) return true;
	return (element.getAttribute('class') ?? '').split(/\s+/).includes('qti-hidden');
}

/** The attributes read-aloud reads from a node: its catalog idref and its content language. */
function readAloudAttributes(element: Element) {
	return ['data-catalog-idref', 'lang']
		.map((name) => {
			const value = element.getAttribute(name)?.trim();
			return value ? ` ${name}="${escapeHtml(value).replace(/"/g, '&quot;')}"` : '';
		})
		.join('');
}

/** The language the item's content is written in: the item body's `xml:lang`, else the item's. */
function contentLanguageOf(document: Document) {
	const itemBody = allElements(document).find((element) => qtiName(element) === 'itemBody');
	const language =
		itemBody?.getAttribute('xml:lang')?.trim() || document.documentElement.getAttribute('xml:lang')?.trim();
	return language || undefined;
}

function escapeHtml(value: string) {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getParser(options: ReadableProjectionOptions) {
	return options.DOMParserImpl ?? (typeof DOMParser !== 'undefined' ? DOMParser : null);
}

function getSerializer(options: ReadableProjectionOptions) {
	const XMLSerializerImpl = options.XMLSerializerImpl ?? (typeof XMLSerializer !== 'undefined' ? XMLSerializer : null);
	return XMLSerializerImpl ? new XMLSerializerImpl() : null;
}

function isElement(node: Node): node is Element {
	return node.nodeType === 1;
}

function serializeReadableNode(
	node: Node,
	serializer: XMLSerializerLike | null,
	options: ReadableProjectionOptions,
): string {
	if (node.nodeType === 3) return escapeHtml(node.textContent ?? '');
	if (!isElement(node) || isSilenced(node)) return '';

	const localName = node.localName.toLowerCase();
	if (localName === 'object' || localName === 'img') {
		const label = node.getAttribute('aria-label') || node.getAttribute('alt') || node.getAttribute('title');
		return label?.trim() ? escapeHtml(label.trim()) : '';
	}
	if (localName === 'br') return '<br>';
	if (localName === 'math') {
		const markup = serializer
			? serializer.serializeToString(node)
			: (node as Element & { outerHTML?: string }).outerHTML ?? escapeHtml(node.textContent ?? '');
		return sanitizeHtml(markup, { security: options.security });
	}

	// The projection exists only to expose readable content to TTS. Do not copy
	// arbitrary authored elements or attributes into the host document: recurse
	// into their text instead, retaining only sanitized MathML, line breaks, the catalog
	// idrefs the read-aloud tool resolves to the item's spoken cards, and content language.
	const markup = Array.from(node.childNodes)
		.map((child) => serializeReadableNode(child, serializer, options))
		.join('');
	const attributes = readAloudAttributes(node);
	return attributes && markup ? `<span${attributes}>${markup}</span>` : markup;
}

function serializeChildren(
	element: Element,
	serializer: XMLSerializerLike | null,
	options: ReadableProjectionOptions,
) {
	return Array.from(element.childNodes)
		.map((node) => serializeReadableNode(node, serializer, options))
		.join('')
		.trim();
}

function childElementsByName(element: Element, name: string) {
	return Array.from(element.children).filter((child) => qtiName(child) === name);
}

function allElements(root: ParentNode) {
	return Array.from(root.querySelectorAll('*'));
}

function descendantElementsByNames(element: Element, names: Set<string>) {
	return allElements(element).filter((child) => names.has(qtiName(child)) && !silencedWithin(child, element));
}

/** Whether `element` or an ancestor below `root` is silenced. */
function silencedWithin(element: Element, root: Element) {
	for (let current: Element | null = element; current && current !== root; current = current.parentElement) {
		if (isSilenced(current)) return true;
	}
	return false;
}

function paragraph(markup: string, source: Element) {
	return markup
		? `<p data-qti-readable-source="${escapeHtml(qtiName(source))}"${readAloudAttributes(source)}>${markup}</p>`
		: '';
}

function readableMarkupForElement(
	element: Element,
	serializer: XMLSerializerLike | null,
	options: ReadableProjectionOptions,
) {
	if (qtiName(element) === 'object') {
		const label = element.getAttribute('aria-label') || element.getAttribute('alt') || element.getAttribute('title');
		if (label?.trim()) return escapeHtml(label.trim());
	}

	return serializeChildren(element, serializer, options);
}

function extractInteractionChunks(
	interaction: Element,
	serializer: XMLSerializerLike | null,
	options: ReadableProjectionOptions,
) {
	const chunks: string[] = [];

	for (const prompt of childElementsByName(interaction, 'prompt')) {
		if (isSilenced(prompt)) continue;
		const markup = readableMarkupForElement(prompt, serializer, options);
		if (markup) chunks.push(paragraph(markup, prompt));
	}

	const optionElements = descendantElementsByNames(interaction, optionLikeNames);
	for (const option of optionElements) {
		const markup = readableMarkupForElement(option, serializer, options);
		if (markup) chunks.push(paragraph(markup, option));
	}

	if (chunks.length === 0) {
		for (const readable of descendantElementsByNames(interaction, readableChildNames)) {
			const markup = readableMarkupForElement(readable, serializer, options);
			if (markup) chunks.push(paragraph(markup, readable));
		}
	}

	return chunks;
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
 */
export function prepareReadableBlock(rawHtml: string): { html: string; catalogs: SpokenCatalog[] } {
	if (!/ssml|synthesis/.test(rawHtml)) return { html: rawHtml, catalogs: [] };
	const open = '<qti-stimulus-body>';
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
 * The item's interaction content as readable markup, and its spoken catalogs: the `spoken` cards of
 * its `qti-catalog-info` and APIP access elements, and those its SSML makes.
 *
 * Reads the item as the item player renders it: the same preparation docks SSML under the same
 * generated idrefs, so the catalogs resolve against both the stem and this projection.
 */
export function extractReadableItemSpeech(itemXml?: string, options: ReadableProjectionOptions = {}): ReadableItemSpeech {
	if (!itemXml) return { html: '', catalogs: [] };
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

	const DOMParserImpl = getParser(options);
	if (!DOMParserImpl) return { html: '', catalogs };

	const document = new DOMParserImpl().parseFromString(prepared.xml, 'application/xml');
	if (document.getElementsByTagName('parsererror').length > 0) return { html: '', catalogs };

	const serializer = getSerializer(options);
	catalogs.unshift(...nativeSpokenCatalogs(document, serializer));
	const interactions = allElements(document).filter(
		(element) => interactionElementNames.has(qtiName(element)) && !silencedWithin(element, document.documentElement),
	);
	const chunks = interactions.flatMap((interaction) => extractInteractionChunks(interaction, serializer, options));
	const language = contentLanguageOf(document);

	return { html: chunks.join(''), catalogs, ...(language ? { language } : {}) };
}

export function extractReadableInteractionSpeechHtml(itemXml?: string, options: ReadableProjectionOptions = {}) {
	return extractReadableItemSpeech(itemXml, options).html;
}
