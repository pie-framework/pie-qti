/**
 * Text-alternative extraction for the graphic interactions' image data.
 *
 * Every graphic interaction (hotspot, graphic order/associate/gap match,
 * select point, position object, drawing) draws its response surface on an
 * image authored as an `<object>` (QTI 2.x) or `<img>` (QTI 3.0 content).
 * The alternative text lives in different places per encoding:
 *
 * - `aria-label` / `aria-labelledby` / `aria-describedby` / `aria-description`
 *   on the image element itself (labelledby/describedby ids resolve inside the
 *   item, mirroring `interactionAccessibility`, because renderers draw in
 *   shadow roots that id references cannot cross);
 * - the `<object>` element's fallback text content (QTI 2.x convention), but
 *   only for external images — an inline SVG's text content is its drawing;
 * - inline SVG `<title>` (name) and `<desc>` (long description);
 * - the `alt` attribute of an `<img>` (QTI 3.0). An *empty* `alt` attribute is
 *   an explicit author statement that the image is decorative.
 *
 * Authored aria naming wins over the other sources, as in accessible name
 * computation. An `<object>` with no alternative is an authoring omission, not
 * a decorative image, so `decorative` is never inferred from it; renderers fall
 * back to a localized generic name (never a QTI identifier).
 */

import { interactionAccessibility } from '../../extraction/interactionAccessibility.js';
import type { QTIElement } from './types.js';

export interface ImageAlternative {
	/** Short text alternative for the image. */
	alt?: string;
	/** Longer description for complex images (SVG `<desc>`, aria description). */
	altDescription?: string;
	/** True only when the author explicitly marked the image decorative (`alt=""`). */
	decorative?: boolean;
}

export interface ImageAlternativeSource {
	/** The image element's inline SVG markup, when the image is inline SVG. */
	inlineSvgContent?: string;
	/** The `alt` attribute of an `<img>` element; omit for `<object>` elements. */
	explicitAlt?: string;
}

type ExtractUtils = {
	getTextContent: (element: QTIElement) => string;
};

function normalizeText(text: string | null | undefined): string {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** First captured group of `regex` in `content`, tag-stripped and whitespace-collapsed. */
function markupText(content: string, regex: RegExp): string {
	const match = regex.exec(content);
	return normalizeText(match?.[1]?.replace(/<[^>]*>/g, ''));
}

/** The element's text outside any `<svg>` child: an `<object>`'s fallback text beside inline SVG. */
function textOutsideSvg(element: QTIElement): string {
	const parts: string[] = [];
	for (const child of element.childNodes ?? []) {
		if (child.nodeType === 1 && (child as QTIElement).rawTagName?.toLowerCase() === 'svg') continue;
		parts.push(child.textContent ?? '');
	}
	return normalizeText(parts.join(' '));
}

function compact(alt: string | undefined, altDescription: string | undefined): ImageAlternative {
	return {
		...(alt ? { alt } : {}),
		...(altDescription ? { altDescription } : {}),
	};
}

/**
 * The alternative source of a QTI 3.0 `<img>`: its `alt` attribute when present
 * (an empty one marks the image decorative), otherwise nothing authored.
 */
export function imgAlternativeSource(img: QTIElement): ImageAlternativeSource {
	return img.hasAttribute('alt') ? { explicitAlt: img.getAttribute('alt') ?? '' } : {};
}

/**
 * Extract the text alternative for a graphic interaction's image element.
 *
 * `contextRoot` is the element id references (`aria-labelledby` etc.) resolve
 * against — pass the extraction context's `dom`.
 */
export function extractImageAlternative(
	imageElement: QTIElement,
	utils: ExtractUtils,
	contextRoot: QTIElement,
	source: ImageAlternativeSource = {},
): ImageAlternative {
	const accessibility = interactionAccessibility(imageElement, contextRoot);

	if (source.explicitAlt !== undefined) {
		// QTI 3.0 <img>: alt="" is the author's explicit "decorative" marker,
		// unless the author also named the image through aria.
		const alt = accessibility?.label || normalizeText(source.explicitAlt);
		if (!alt) return { decorative: true };
		return compact(alt, accessibility?.description);
	}

	if (source.inlineSvgContent !== undefined) {
		// Inline SVG: aria name, else the SVG's <title>, else the <object>'s own
		// fallback text beside the <svg> (never the drawing's internal text).
		const svg = source.inlineSvgContent;
		return compact(
			accessibility?.label ||
				markupText(svg, /<title\b[^>]*>([\s\S]*?)<\/title>/i) ||
				textOutsideSvg(imageElement),
			accessibility?.description || markupText(svg, /<desc\b[^>]*>([\s\S]*?)<\/desc>/i),
		);
	}

	// QTI 2.x <object> referencing an external image: aria name, else the
	// element's fallback text content. Nothing found is an omission.
	return compact(
		accessibility?.label || normalizeText(utils.getTextContent(imageElement)),
		accessibility?.description,
	);
}
