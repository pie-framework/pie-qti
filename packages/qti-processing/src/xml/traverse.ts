/**
 * Minimal DOM traversal helpers for namespace-heavy QTI XML.
 *
 * We use `localName` rather than `tagName` so default namespaces don't break matching.
 */

export function localName(node: Node | null | undefined): string | null {
	if (!node) return null;
	// Element.localName exists; for safety we also handle older Node shapes
	return (node as any).localName || (node as any).tagName || null;
}

export function isElement(node: Node | null | undefined): node is Element {
	return !!node && (node as any).nodeType === 1;
}

export function childElements(parent: Node): Element[] {
	const out: Element[] = [];
	const children = (parent as any).childNodes as any;
	if (!children) return out;
	const len = typeof children.length === 'number' ? children.length : 0;
	for (let i = 0; i < len; i++) {
		const n = children[i] as Node;
		if (isElement(n)) out.push(n);
	}
	return out;
}

export function firstChildElement(parent: Node): Element | null {
	for (const el of childElements(parent)) return el;
	return null;
}

export function getAttr(el: Element, name: string): string | null {
	return el.getAttribute(name);
}

export function findFirstDescendant(parent: Node, wantedLocalName: string): Element | null {
	const stack: Node[] = [parent];
	while (stack.length) {
		const n = stack.pop()!;
		if (isElement(n) && localName(n)?.toLowerCase() === wantedLocalName.toLowerCase()) {
			return n;
		}
		const children = (n as any).childNodes as any;
		if (children) {
			const len = typeof children.length === 'number' ? children.length : 0;
			for (let i = len - 1; i >= 0; i--) stack.push(children[i]);
		}
	}
	return null;
}

export function findDescendants(parent: Node, wantedLocalName: string): Element[] {
	const out: Element[] = [];
	const stack: Node[] = [parent];
	const wanted = wantedLocalName.toLowerCase();
	while (stack.length) {
		const n = stack.pop()!;
		if (isElement(n) && localName(n)?.toLowerCase() === wanted) {
			out.push(n);
		}
		const children = (n as any).childNodes as any;
		if (children) {
			const len = typeof children.length === 'number' ? children.length : 0;
			for (let i = len - 1; i >= 0; i--) stack.push(children[i]);
		}
	}
	return out;
}

export function findAssessmentItem(doc: Document): Element {
	const root = doc.documentElement;
	if (!root) throw new Error('XML has no documentElement');

	// QTI items often have <assessmentItem> as the root element, but some wrappers exist.
	if (localName(root)?.toLowerCase() === 'assessmentitem') return root;

	const found = findFirstDescendant(root, 'assessmentItem');
	if (!found) throw new Error('Could not find assessmentItem element in XML');
	return found;
}


