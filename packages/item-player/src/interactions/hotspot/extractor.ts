/**
 * Standard QTI hotspotInteraction extractor
 *
 * Extracts data from hotspotInteraction elements (clickable areas on image)
 */

import type { ElementExtractor } from '../../extraction/types.js';
import { normalizePixelDimension } from '../../security/styleValues.js';
import { extractImageAlternative, imgAlternativeSource } from '../shared/imageAlt.js';

/**
 * Image data for hotspot interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: string;
	height?: string;
	/** Short text alternative extracted from the QTI source. */
	alt?: string;
	/** Longer description for complex images (SVG <desc>, aria description). */
	altDescription?: string;
	/** True only when the author explicitly marked the image decorative (`<img alt="">`). */
	decorative?: boolean;
}

/**
 * Hotspot data extracted from hotspotInteraction elements
 */
export interface HotspotData {
	imageData: ImageData | null;
	hotspotChoices: Array<{
		identifier: string;
		shape: 'circle' | 'rect' | 'poly' | 'ellipse' | 'default';
		coords: string;
		hotspotLabel?: string;
		classes?: string[];
	}>;
	maxChoices: number;
	minChoices?: number;
	prompt: string | null;
}

/**
 * Standard QTI hotspot interaction extractor
 * Handles hotspotInteraction elements (clickable areas on an image)
 */
export const standardHotspotExtractor: ElementExtractor<HotspotData> = {
	id: 'qti:hotspot-interaction',
	name: 'QTI Standard Hotspot Interaction',
	priority: 10,
	elementTypes: ['hotspotInteraction'],
	description: 'Extracts standard QTI hotspotInteraction (clickable areas on image)',

	canHandle(element, context) {
		// All hotspotInteraction elements are standard
		return context.utils.matchesTag(element, 'hotspotInteraction');
	},

	extract(element, context) {
		const { utils, dom } = context;

		// Extract image data from the object element (QTI 2.x / 3.0) or an img element (QTI 3.0)
		const objectElements = utils.getChildrenByTag(element, 'object');
		const imgElements = objectElements.length === 0 ? utils.getChildrenByTag(element, 'img') : [];
		let imageData: ImageData | null = null;

		if (objectElements.length > 0) {
			const objectElement = objectElements[0];
			const type = utils.getAttribute(objectElement, 'type', '');
			const data = utils.getAttribute(objectElement, 'data', '');
			const width = normalizePixelDimension(utils.getAttribute(objectElement, 'width', ''));
			const height = normalizePixelDimension(utils.getAttribute(objectElement, 'height', ''));

			// Author-provided text alternative (WCAG 1.1.1): aria-* on the element,
			// inline SVG <title>/<desc>, or the <object>'s fallback text content.
			if (type.startsWith('image/svg')) {
				// Inline SVG: <object type="image/svg+xml"><svg>...</svg></object>
				// External SVG: <object type="image/svg+xml" data="path/to/file.svg"/>
				// The <object> may contain alt text (not SVG markup) — only treat as inline if content has <svg.
				const content = utils.getHtmlContent(objectElement);
				const hasSvgMarkup = /<svg[\s>]/i.test(content);
				if (hasSvgMarkup) {
					imageData = {
						type: 'svg',
						content,
						...(width ? { width } : {}),
						...(height ? { height } : {}),
						...extractImageAlternative(objectElement, utils, dom, { inlineSvgContent: content }),
					};
				} else {
					// External SVG file reference — render via <img src> (SVG renders in img tags)
					imageData = {
						type: 'image',
						src: data,
						...(width ? { width } : {}),
						...(height ? { height } : {}),
						...extractImageAlternative(objectElement, utils, dom),
					};
				}
			} else {
				// External image reference
				imageData = {
					type: 'image',
					src: data,
					...(width ? { width } : {}),
					...(height ? { height } : {}),
					...extractImageAlternative(objectElement, utils, dom),
				};
			}
		} else if (imgElements.length > 0) {
			// QTI 3.0 <img>: the alt attribute is the text alternative (alt="" = decorative)
			const imgElement = imgElements[0];
			const width = normalizePixelDimension(utils.getAttribute(imgElement, 'width', ''));
			const height = normalizePixelDimension(utils.getAttribute(imgElement, 'height', ''));
			imageData = {
				type: 'image',
				src: utils.getAttribute(imgElement, 'src', ''),
				...(width ? { width } : {}),
				...(height ? { height } : {}),
				...extractImageAlternative(imgElement, utils, dom, imgAlternativeSource(imgElement)),
			};
		}

		// Extract hotspotChoice children
		const hotspotElements = utils.getChildrenByTag(element, 'hotspotChoice');
		const hotspotChoices = hotspotElements.map((hotspot) => {
			const classes = utils.getClasses(hotspot);
			const shape = utils.getAttribute(hotspot, 'shape', 'rect');
			const coords = utils.getAttribute(hotspot, 'coords', '');
			const hotspotLabel = utils.getAttribute(hotspot, 'hotspotLabel', '');

			return {
				identifier: utils.getAttribute(hotspot, 'identifier', ''),
				shape: shape as 'circle' | 'rect' | 'poly' | 'ellipse' | 'default',
				coords,
				...(hotspotLabel ? { hotspotLabel } : {}),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract attributes
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);
		const minChoices = utils.getNumberAttribute(element, 'minChoices', 0);
		const interactionClasses = utils.getClasses(element);
		const maxSelectionsMessage = utils.getAttribute(element, 'data-max-selections-message', '') || null;
		const minSelectionsMessage = utils.getAttribute(element, 'data-min-selections-message', '') || null;

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			imageData,
			hotspotChoices,
			maxChoices,
			...(minChoices > 0 ? { minChoices } : {}),
			prompt,
			...(interactionClasses.length > 0 ? { interactionClasses } : {}),
			...(maxSelectionsMessage ? { maxSelectionsMessage } : {}),
			...(minSelectionsMessage ? { minSelectionsMessage } : {}),
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate image data
		if (!data.imageData) {
			warnings.push('hotspotInteraction has no image data');
		} else if (data.imageData.type === 'image' && !data.imageData.src) {
			errors.push('hotspotInteraction must have an image URL');
		} else if (data.imageData.type === 'svg' && !data.imageData.content) {
			errors.push('hotspotInteraction must have SVG content');
		}

		// Validate hotspots exist
		if (!data.hotspotChoices || data.hotspotChoices.length === 0) {
			errors.push('hotspotInteraction must have at least one hotspot');
		}

		// Validate hotspot identifiers and coords
		if (data.hotspotChoices && data.hotspotChoices.length > 0) {
			const identifiers = new Set<string>();
			for (const hotspot of data.hotspotChoices) {
				if (!hotspot.identifier) {
					errors.push('All hotspots must have an identifier');
				} else if (identifiers.has(hotspot.identifier)) {
					errors.push(`Duplicate hotspot identifier: ${hotspot.identifier}`);
				} else {
					identifiers.add(hotspot.identifier);
				}

				if (!hotspot.coords) {
					errors.push(`Hotspot ${hotspot.identifier} must have coords`);
				}
			}

			// Warn if maxChoices exceeds hotspot count
			if (data.maxChoices > data.hotspotChoices.length) {
				warnings.push(
					`maxChoices (${data.maxChoices}) exceeds the number of hotspots (${data.hotspotChoices.length})`
				);
			}
		}

		// Validate maxChoices
		if (data.maxChoices < 0) {
			errors.push('maxChoices must be non-negative');
		}

		// Validate minChoices
		if (data.minChoices !== undefined && data.minChoices < 0) {
			errors.push('minChoices must be non-negative');
		}

		// Validate minChoices <= maxChoices
		if (
			data.minChoices !== undefined &&
			data.maxChoices > 0 &&
			data.minChoices > data.maxChoices
		) {
			errors.push('minChoices cannot exceed maxChoices');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
