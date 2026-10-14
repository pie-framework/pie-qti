/**
 * Item content pass
 *
 * Item content reaches the host as serialized markup, resolved first by one walk over a copy of
 * its XML by canonical element name, so nested elements and both QTI spellings resolve alike. A
 * handler registered for a canonical name receives each matching element and returns the nodes
 * that replace it, or `undefined` to keep the element and walk into it. Replacement nodes are
 * walked in turn, so a handler that unwraps an element still has the elements inside it resolved.
 * The item body, rubric blocks and modal feedback all go through the pass.
 */

import type { ElementNameMapper } from '@pie-qti/qti-common';
import { isElement, localName } from '@pie-qti/qti-processing';

/** Nodes replacing `element`: new nodes or its own children, never `element` itself. */
export type ContentHandler = (element: Element) => readonly Node[] | undefined;

/** Handlers by canonical element name, e.g. `printedvariable`. */
export type ContentHandlers = ReadonlyMap<string, ContentHandler>;

/** A copy of `element` with every registered element resolved; the source is not modified. */
export function resolveContent(element: Element, handlers: ContentHandlers, names: ElementNameMapper): Element {
	const copy = element.cloneNode(true) as Element;
	if (handlers.size > 0) resolveChildren(copy, handlers, names);
	return copy;
}

function resolveChildren(parent: Node, handlers: ContentHandlers, names: ElementNameMapper): void {
	for (const child of Array.from(parent.childNodes)) resolveNode(child, handlers, names);
}

function resolveNode(node: Node, handlers: ContentHandlers, names: ElementNameMapper): void {
	if (!isElement(node)) return;
	const replacement = handlers.get(names.toCanonical(localName(node) ?? ''))?.(node);
	if (replacement === undefined) {
		resolveChildren(node, handlers, names);
		return;
	}
	const parent = node.parentNode;
	if (!parent) return;
	for (const inserted of replacement) parent.insertBefore(inserted, node);
	parent.removeChild(node);
	for (const inserted of replacement) resolveNode(inserted, handlers, names);
}
