/// <reference lib="dom" />

import { enforceItemXmlLimits, sanitizeHtml } from '@pie-qti/item-player/security';
import type { PlayerSecurityConfig } from '@pie-qti/item-player';
import { prepareContentMarkup } from '@pie-qti/qti-common/accessibility';

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

/** The `spoken` catalogs an item's SSML makes, in the shape the PIE toolkit registers per owner. */
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
 * The item's interaction content as readable markup, and the spoken catalogs its SSML makes.
 *
 * Reads the item as the item player renders it: the same preparation docks SSML under the same
 * generated idrefs, so the catalogs resolve against both the stem and this projection.
 */
export function extractReadableItemSpeech(itemXml?: string, options: ReadableProjectionOptions = {}): ReadableItemSpeech {
	if (!itemXml) return { html: '', catalogs: [] };
	enforceItemXmlLimits(itemXml, options.security);

	const prepared = prepareContentMarkup(itemXml, [], { hidingStyles: false });
	const catalogs = prepared.spoken.map(({ identifier, content }): SpokenCatalog => ({
		identifier,
		cards: [{ catalog: 'spoken', content }],
	}));

	const DOMParserImpl = getParser(options);
	if (!DOMParserImpl) return { html: '', catalogs };

	const document = new DOMParserImpl().parseFromString(prepared.xml, 'application/xml');
	if (document.getElementsByTagName('parsererror').length > 0) return { html: '', catalogs };

	const serializer = getSerializer(options);
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
