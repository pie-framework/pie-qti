/// <reference lib="dom" />

type DOMParserConstructor = new () => {
	parseFromString(xml: string, mimeType: string): Document;
};

type XMLSerializerLike = {
	serializeToString(node: Node): string;
};

interface ReadableProjectionOptions {
	DOMParserImpl?: DOMParserConstructor;
	XMLSerializerImpl?: new () => XMLSerializerLike;
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

function serializeNode(node: Node, serializer: XMLSerializerLike | null): string {
	if (node.nodeType === 3) return escapeHtml(node.textContent ?? '');
	if (!isElement(node)) return '';
	if (serializer) return serializer.serializeToString(node);
	return (node as Element & { outerHTML?: string }).outerHTML ?? escapeHtml(node.textContent ?? '');
}

function serializeChildren(element: Element, serializer: XMLSerializerLike | null) {
	return Array.from(element.childNodes)
		.map((node) => serializeNode(node, serializer))
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

function readableMarkupForElement(element: Element, serializer: XMLSerializerLike | null) {
	if (element.localName === 'object') {
		const label = element.getAttribute('aria-label') || element.getAttribute('alt') || element.getAttribute('title');
		if (label?.trim()) return escapeHtml(label.trim());
	}

	return serializeChildren(element, serializer);
}

function extractInteractionChunks(interaction: Element, serializer: XMLSerializerLike | null) {
	const chunks: string[] = [];

	for (const prompt of childElementsByLocalName(interaction, 'prompt')) {
		const markup = readableMarkupForElement(prompt, serializer);
		if (markup) chunks.push(paragraph(markup, 'prompt'));
	}

	const optionElements = descendantElementsByLocalNames(interaction, optionLikeNames);
	for (const option of optionElements) {
		const markup = readableMarkupForElement(option, serializer);
		if (markup) chunks.push(paragraph(markup, option.localName));
	}

	if (chunks.length === 0) {
		for (const readable of descendantElementsByLocalNames(interaction, readableChildNames)) {
			const markup = readableMarkupForElement(readable, serializer);
			if (markup) chunks.push(paragraph(markup, readable.localName));
		}
	}

	return chunks;
}

export function extractReadableInteractionSpeechHtml(itemXml?: string, options: ReadableProjectionOptions = {}) {
	if (!itemXml) return '';

	const DOMParserImpl = getParser(options);
	if (!DOMParserImpl) return '';

	const document = new DOMParserImpl().parseFromString(itemXml, 'application/xml');
	if (document.getElementsByTagName('parsererror').length > 0) return '';

	const serializer = getSerializer(options);
	const interactions = allElements(document).filter((element) => interactionElementNames.has(element.localName));
	const chunks = interactions.flatMap((interaction) => extractInteractionChunks(interaction, serializer));

	return chunks.join('');
}
