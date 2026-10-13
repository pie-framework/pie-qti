import {
	type ApipAccessElement,
	readApipAccessElements,
	type TextRange,
} from '@pie-qti/qti-common/accessibility';
import type { CatalogIndex } from './types.js';

/**
 * APIP 1.0 accessibility in a QTI 2.x item.
 *
 * Each access element is a catalog under its `identifier`, its supports entries under the QTI 3
 * support names `@pie-qti/qti-common/accessibility` maps them to. Its links dock that identifier
 * as `data-catalog-idref`, the attribute catalog lookups start from: on the element whose `id` a
 * link names, or on a span around the word or character range its `textLink` counts.
 *
 * Words are counted from 1 over the element's text split on whitespace, punctuation kept with its
 * word; characters from 1, each whitespace run one character and whitespace before the first word
 * none. A range that crosses markup is not docked. An element whose tag the player does not render
 * (a prompt, a choice, feedback) or that names a catalog already gets its content wrapped instead.
 */

/** Elements the player renders by their content, so an idref on their tag would not reach the page. */
const CONTENT_WRAPPED = new Set([
	'prompt',
	'simpleChoice',
	'simpleAssociableChoice',
	'inlineChoice',
	'gapText',
	'hottext',
	'modalFeedback',
	'feedbackBlock',
	'feedbackInline',
	'rubricBlock',
]);
/** The elements whose content the player renders, and which links can name. */
const CONTENT_ROOTS = new Set(['itemBody', 'modalFeedback', 'rubricBlock']);
const BLOCK_ELEMENTS = new Set([
	'address',
	'blockquote',
	'div',
	'dl',
	'figure',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'hr',
	'ol',
	'p',
	'pre',
	'table',
	'ul',
]);
const XML_WHITESPACE = /^[ \t\r\n]$/;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** The APIP access elements an item declares; none unless the XML carries any. */
export function readApipAccessibility(itemXml: string): ApipAccessElement[] {
	return itemXml.includes('accessElement') ? readApipAccessElements(itemXml) : [];
}

/** Access elements as catalog cards, by access element identifier. */
export function apipCatalogIndex(elements: readonly ApipAccessElement[]): CatalogIndex {
	const index: CatalogIndex = new Map();
	for (const element of elements) {
		if (!element.identifier) continue;
		const entries = element.cards.flatMap((card) => {
			const html = card.content ?? card.payload?.media.sources[0]?.src;
			return html ? [{ usage: card.catalog, ...(card.language ? { lang: card.language } : {}), html }] : [];
		});
		if (entries.length === 0) continue;
		const existing = index.get(element.identifier);
		if (existing) existing.entries.push(...entries);
		else index.set(element.identifier, { entries });
	}
	return index;
}

/** Dock each access element's links on the content of `item`, an `assessmentItem` element. */
export function dockApipLinks(item: Element, elements: readonly ApipAccessElement[]): void {
	const ids = contentIds(item);
	if (ids.size === 0) return;
	const links = elements.flatMap((element) =>
		element.identifier
			? element.links.flatMap((link) => {
					const target = ids.get(link.target);
					return target ? [{ ...link, target, idref: element.identifier }] : [];
				})
			: []
	);
	for (const link of links) {
		if (!link.range) dockElement(link.target, link.idref);
	}
	// Wider ranges first, so a range inside another still lies inside one text node once both wrap.
	const ranged = links
		.filter((link) => link.range)
		.map((link) => ({ ...link, length: (link.range?.stop ?? 0) - (link.range?.start ?? 0) }))
		.sort((a, b) => b.length - a.length);
	for (const link of ranged) {
		const located = link.range && locateRange(link.target, link.range);
		if (located) wrapText(located, link.idref);
	}
}

function contentIds(item: Element): Map<string, Element> {
	const ids = new Map<string, Element>();
	const visit = (element: Element, inContent: boolean): void => {
		const name = localName(element);
		const content = inContent || CONTENT_ROOTS.has(name);
		const id = element.getAttribute('id')?.trim();
		if (content && id && name !== 'itemBody' && !name.endsWith('Interaction') && !ids.has(id)) {
			ids.set(id, element);
		}
		for (const child of childElements(element)) visit(child, content);
	};
	visit(item, false);
	return ids;
}

function dockElement(element: Element, idref: string): void {
	if (element.getAttribute('data-catalog-idref') === idref) return;
	if (!CONTENT_WRAPPED.has(localName(element)) && !element.hasAttribute('data-catalog-idref')) {
		element.setAttribute('data-catalog-idref', idref);
		return;
	}
	const block = childElements(element).some((child) => BLOCK_ELEMENTS.has(localName(child).toLowerCase()));
	const wrapper = createWrapper(element, block ? 'div' : 'span', idref);
	while (element.firstChild) wrapper.appendChild(element.firstChild);
	element.appendChild(wrapper);
}

interface LocatedRange {
	text: Text;
	start: number;
	end: number;
}

function locateRange(element: Element, range: TextRange): LocatedRange | undefined {
	const characters: Array<LocatedRange & { space: boolean }> = [];
	let space: LocatedRange | undefined;
	for (const text of textNodes(element)) {
		for (let offset = 0; offset < text.data.length; offset += 1) {
			const unit = { text, start: offset, end: offset + 1 };
			if (XML_WHITESPACE.test(text.data.charAt(offset))) {
				if (characters.length > 0) space ??= unit;
				continue;
			}
			if (space) characters.push({ ...space, space: true });
			space = undefined;
			characters.push({ ...unit, space: false });
		}
	}

	let first = range.start - 1;
	let last = range.stop - 1;
	if (range.unit === 'word') {
		const words: Array<[number, number]> = [];
		characters.forEach((character, index) => {
			if (character.space) return;
			const word = words[words.length - 1];
			if (word && word[1] === index - 1) word[1] = index;
			else words.push([index, index]);
		});
		first = words[range.start - 1]?.[0] ?? Number.NaN;
		last = words[range.stop - 1]?.[1] ?? Number.NaN;
	}
	const from = characters[first];
	const to = characters[last];
	if (!from || !to || last < first || from.text !== to.text) return undefined;
	return { text: from.text, start: from.start, end: to.end };
}

function wrapText({ text, start, end }: LocatedRange, idref: string): void {
	const parent = text.parentNode as Element | null;
	if (!parent) return;
	const middle = text.splitText(start);
	middle.splitText(end - start);
	const wrapper = createWrapper(parent, 'span', idref);
	parent.replaceChild(wrapper, middle);
	wrapper.appendChild(middle);
}

/** An element in `context`'s namespace, so it serializes without a prefix of its own. */
function createWrapper(context: Element, name: string, idref: string): Element {
	const document = context.ownerDocument;
	const element = context.namespaceURI
		? document.createElementNS(context.namespaceURI, name)
		: document.createElement(name);
	element.setAttribute('data-catalog-idref', idref);
	return element;
}

function textNodes(element: Element): Text[] {
	const texts: Text[] = [];
	for (let child = element.firstChild; child; child = child.nextSibling) {
		if (child.nodeType === TEXT_NODE) texts.push(child as Text);
		else if (child.nodeType === ELEMENT_NODE) texts.push(...textNodes(child as Element));
	}
	return texts;
}

function childElements(element: Element): Element[] {
	const children: Element[] = [];
	for (let child = element.firstChild; child; child = child.nextSibling) {
		if (child.nodeType === ELEMENT_NODE) children.push(child as Element);
	}
	return children;
}

function localName(element: Element): string {
	return element.localName || element.nodeName.slice(element.nodeName.indexOf(':') + 1);
}
