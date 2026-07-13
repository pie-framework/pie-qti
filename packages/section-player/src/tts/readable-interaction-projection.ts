/// <reference lib="dom" />

import { enforceItemXmlLimits, sanitizeHtml } from '@pie-qti/item-player/security';
import type { PlayerSecurityConfig } from '@pie-qti/item-player';

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
	if (!isElement(node)) return '';

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
	// into their text instead, retaining only sanitized MathML and line breaks.
	return Array.from(node.childNodes)
		.map((child) => serializeReadableNode(child, serializer, options))
		.join('');
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

function childElementsByLocalName(element: Element, localName: string) {
	return Array.from(element.children).filter((child) => child.localName === localName);
}

function allElements(root: ParentNode) {
	return Array.from(root.querySelectorAll('*'));
}

function descendantElementsByLocalNames(element: Element, localNames: Set<string>) {
	return allElements(element).filter((child) => localNames.has(child.localName));
}

function paragraph(markup: string, source: string) {
	return markup ? `<p data-qti-readable-source="${escapeHtml(source)}">${markup}</p>` : '';
}

function readableMarkupForElement(
	element: Element,
	serializer: XMLSerializerLike | null,
	options: ReadableProjectionOptions,
) {
	if (element.localName === 'object') {
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

	for (const prompt of childElementsByLocalName(interaction, 'prompt')) {
		const markup = readableMarkupForElement(prompt, serializer, options);
		if (markup) chunks.push(paragraph(markup, 'prompt'));
	}

	const optionElements = descendantElementsByLocalNames(interaction, optionLikeNames);
	for (const option of optionElements) {
		const markup = readableMarkupForElement(option, serializer, options);
		if (markup) chunks.push(paragraph(markup, option.localName));
	}

	if (chunks.length === 0) {
		for (const readable of descendantElementsByLocalNames(interaction, readableChildNames)) {
			const markup = readableMarkupForElement(readable, serializer, options);
			if (markup) chunks.push(paragraph(markup, readable.localName));
		}
	}

	return chunks;
}

export function extractReadableInteractionSpeechHtml(itemXml?: string, options: ReadableProjectionOptions = {}) {
	if (!itemXml) return '';
	enforceItemXmlLimits(itemXml, options.security);

	const DOMParserImpl = getParser(options);
	if (!DOMParserImpl) return '';

	const document = new DOMParserImpl().parseFromString(itemXml, 'application/xml');
	if (document.getElementsByTagName('parsererror').length > 0) return '';

	const serializer = getSerializer(options);
	const interactions = allElements(document).filter((element) => interactionElementNames.has(element.localName));
	const chunks = interactions.flatMap((interaction) => extractInteractionChunks(interaction, serializer, options));

	return chunks.join('');
}
