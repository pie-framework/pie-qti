import type { InteractionAccessibility, QTIElement } from '../interactions/shared/types.js';

function normalizeText(text: string | null | undefined): string {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

function findById(root: QTIElement, id: string): QTIElement | undefined {
	for (const child of root.childNodes ?? []) {
		if (child.nodeType !== 1) continue;
		const element = child as unknown as QTIElement;
		if (element.getAttribute?.('id') === id) return element;
		const found = findById(element, id);
		if (found) return found;
	}
	return undefined;
}

function referencedText(ids: string | undefined, root: QTIElement): string {
	if (!ids) return '';
	return ids
		.split(/\s+/)
		.filter(Boolean)
		.map((id) => normalizeText(findById(root, id)?.textContent))
		.filter(Boolean)
		.join(' ');
}

/**
 * The interaction's accessible name and description from its `aria-labelledby`, `aria-label`,
 * `aria-describedby` and `aria-description`. Renderers draw interactions in shadow roots, which
 * id references cannot cross, so referenced ids resolve to their text here, within `root`.
 * `aria-labelledby` wins over `aria-label`, as in accessible name computation.
 */
export function interactionAccessibility(
	element: QTIElement,
	root: QTIElement,
): InteractionAccessibility | undefined {
	const label =
		referencedText(element.getAttribute('aria-labelledby'), root) ||
		normalizeText(element.getAttribute('aria-label'));
	const description =
		referencedText(element.getAttribute('aria-describedby'), root) ||
		normalizeText(element.getAttribute('aria-description'));
	if (!label && !description) return undefined;
	return { ...(label ? { label } : {}), ...(description ? { description } : {}) };
}
