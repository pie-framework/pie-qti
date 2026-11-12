/**
 * The image element of the graphic interactions.
 *
 * QTI 2.x content authors every interaction image as an
 * `<object data="…" width height>` with fallback text. The QTI 3.0 schemas give
 * the graphic interactions (hotspot, graphic order/associate/gap match, select
 * point, drawing, position object) and the `qti-gap-img` label a choice of
 * `object`, `img` **or `picture`** (3.0 XSD, e.g. HotspotInteractionDType and
 * GapImgDType), so each of those forms is valid delivered content.
 *
 * A `<picture>` delivers its `<img>` fallback — the child whose `src`, `alt`
 * and dimensions are what renders when no `<source>` matches — so the
 * extracted image data keeps the shape renderers already consume.
 */

import type { ExtractionUtils } from '../../extraction/types.js';
import type { QTIElement } from './types.js';

/** The resolved interaction image: the element and the authored form it came from. */
export interface InteractionImage {
	element: QTIElement;
	/** `object` for an `<object>` (QTI 2.x form), `img` for a plain or fallback `<img>` (QTI 3.0). */
	kind: 'object' | 'img';
}

type ImageLookup = Pick<ExtractionUtils, 'getChildrenByTag'>;

/**
 * Resolve the image an interaction draws on: its `object` child, else its
 * `img` child, else the `img` fallback of its `picture` child. `object` wins
 * over a sibling `img` (a document authoring both satisfies no version) to
 * preserve the QTI 2.x reading order the extractors have always used. `null`
 * when the container authors none of the forms.
 */
export function findInteractionImage(container: QTIElement, utils: ImageLookup): InteractionImage | null {
	const objectElement = utils.getChildrenByTag(container, 'object')[0];
	if (objectElement) return { element: objectElement, kind: 'object' };

	const imgElement = utils.getChildrenByTag(container, 'img')[0];
	if (imgElement) return { element: imgElement, kind: 'img' };

	// QTI 3.0 <picture>: the spec-valid form is (source*, img), and the <img>
	// fallback is required content — an img-less picture delivers no image.
	const pictureElement = utils.getChildrenByTag(container, 'picture')[0];
	if (pictureElement) {
		const fallbackImg = utils.getChildrenByTag(pictureElement, 'img')[0];
		if (fallbackImg) return { element: fallbackImg, kind: 'img' };
	}

	return null;
}
