/**
 * Accessible text of rich choice content.
 *
 * Choice content is rich HTML: an image-only choice must read its `alt`, a
 * MathML formula must read its `alttext` (not a flattened "x2"), an SVG must
 * read its `title`. `textContent` drops all of that, so names and live-region
 * announcements built from it describe images as nothing at all.
 *
 * `accessibleTextFromHtml` walks the content in reading order and returns the
 * text assistive technology would derive. It never substitutes a placeholder
 * itself: callers decide the fallback, and must not fall back to "Item" or an
 * identifier when content exists — a silent "Item" names every choice alike
 * and makes the interaction unusable.
 */

import type { HtmlContent } from '@pie-qti/item-player';

/** Collapse runs of whitespace so announcements read like sentences, not source. */
function collapseWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/** An element's own text alternative (`alt`, `alttext`, `aria-label`, `<title>`), if any. */
function ownAlternative(element: Element): string {
	const tag = element.tagName.toLowerCase();
	if (tag === 'img' || tag === 'object') {
		return element.getAttribute('alt') ?? '';
	}
	if (tag === 'math') {
		return element.getAttribute('alttext') ?? element.getAttribute('aria-label') ?? '';
	}
	if (tag === 'svg') {
		const title = element.querySelector(':scope > title')?.textContent ?? '';
		return title || element.getAttribute('aria-label') || '';
	}
	return '';
}

function textFromNode(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
	if (node.nodeType !== Node.ELEMENT_NODE) return '';
	const element = node as Element;
	// Hidden content contributes nothing, even an icon that carries alt text or a
	// title: a hidden icon beside the same visible word must not read it twice.
	if (element.getAttribute('aria-hidden') === 'true') return '';
	const alternative = ownAlternative(element);
	// A node with its own alternative is read as that alternative; its children
	// (e.g. an <object>'s fallback markup) are not announced in addition.
	if (alternative) return alternative;
	return Array.from(element.childNodes).map(textFromNode).join(' ');
}

/**
 * The text assistive technology would read for a rich-content HTML snippet:
 * `img`/`object` alt, MathML `alttext`/`aria-label`, SVG `<title>`/`aria-label`,
 * otherwise the text content. Returns '' when there is nothing to read, so the
 * caller can pick a meaningful fallback. Safe on the server: falls back to a
 * tag-stripping pass when no DOM is available (there, image alt text cannot be
 * recovered from serialized HTML and only visible text survives).
 */
export function accessibleTextFromHtml(html: HtmlContent | null | undefined): string {
	if (html == null || html === '') return '';
	if (typeof document !== 'undefined') {
		const template = document.createElement('template');
		// Passing the value through unchanged preserves TrustedHTML identity at
		// this parsing sink; the resulting text is used only for accessibility.
		template.innerHTML = html as unknown as string;
		return collapseWhitespace(Array.from(template.content.childNodes).map(textFromNode).join(' '));
	}
	const serialized = typeof html === 'string' ? html : String(html);
	return collapseWhitespace(serialized.replace(/<[^>]*>/g, ' '));
}
