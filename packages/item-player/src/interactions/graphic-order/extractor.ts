/**
 * Standard QTI graphicOrderInteraction extractor
 *
 * Extracts data from graphicOrderInteraction elements (order items on image)
 */

import type { ElementExtractor } from '../../extraction/types.js';
import { normalizePixelDimension } from '../../security/styleValues.js';
import { extractImageAlternative, imgAlternativeSource } from '../shared/imageAlt.js';

/**
 * Image data for graphic order interaction
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
 * Graphic order data extracted from graphicOrderInteraction elements
 */
export interface GraphicOrderData {
	imageData: ImageData | null;
	hotspotChoices: Array<{
		identifier: string;
		/**
		 * The hotspot's authored text. Empty when the author gave none: the
		 * renderer then names it by position. Never the identifier, which can
		 * leak the answer key to assistive technology.
		 */
		label: string;
		shape: string;
		coords: string;
		fixed?: boolean;
		classes?: string[];
	}>;
	prompt: string | null;
	/** Minimum number of hotspots the response must order (QTI minChoices); omitted when 0. */
	minChoices?: number;
	/** Maximum number of hotspots the response may order (QTI maxChoices); omitted when 0. */
	maxChoices?: number;
	/** Message shown while the response orders fewer than minChoices (data-min-selections-message) */
	minSelectionsMessage?: string;
}

/**
 * Standard QTI graphic order interaction extractor
 * Handles graphicOrderInteraction elements (ordering hotspots on an image)
 */
export const standardGraphicOrderExtractor: ElementExtractor<GraphicOrderData> = {
	id: 'qti:graphic-order-interaction',
	name: 'QTI Standard Graphic Order Interaction',
	priority: 10,
	elementTypes: ['graphicOrderInteraction'],
	description: 'Extracts standard QTI graphicOrderInteraction (order items on image)',

	canHandle(element, context) {
		// All graphicOrderInteraction elements are standard
		return context.utils.matchesTag(element, 'graphicOrderInteraction');
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
			// The stage's pixel space: the authored width/height, when declared. Without
			// them the renderer stages the raster at its natural size; a default here
			// would silently place areas in a guessed space.
			const width = normalizePixelDimension(utils.getAttribute(objectElement, 'width', ''));
			const height = normalizePixelDimension(utils.getAttribute(objectElement, 'height', ''));
			const content = type.startsWith('image/svg') ? utils.getHtmlContent(objectElement) : '';

			if (/<svg[\s>]/i.test(content)) {
				// Inline SVG: <object type="image/svg+xml"><svg>...</svg></object>
				imageData = {
					type: 'svg',
					content,
					width,
					height,
					...extractImageAlternative(objectElement, utils, dom, { inlineSvgContent: content }),
				};
			} else {
				// External image (or SVG file) reference; the <object>'s text is its alternative
				imageData = {
					type: 'image',
					src: data,
					width,
					height,
					...extractImageAlternative(objectElement, utils, dom),
				};
			}
		} else if (imgElements.length > 0) {
			// QTI 3.0 <img>: the alt attribute is the text alternative (alt="" = decorative)
			const imgElement = imgElements[0];
			imageData = {
				type: 'image',
				src: utils.getAttribute(imgElement, 'src', ''),
				width: normalizePixelDimension(utils.getAttribute(imgElement, 'width', '')),
				height: normalizePixelDimension(utils.getAttribute(imgElement, 'height', '')),
				...extractImageAlternative(imgElement, utils, dom, imgAlternativeSource(imgElement)),
			};
		}

		// Extract hotspotChoice children
		const hotspotElements = utils.getChildrenByTag(element, 'hotspotChoice');
		const hotspotChoices = hotspotElements.map((hotspot) => {
			const classes = utils.getClasses(hotspot);
			const identifier = utils.getAttribute(hotspot, 'identifier', '');
			const shape = utils.getAttribute(hotspot, 'shape', 'rect');
			const coords = utils.getAttribute(hotspot, 'coords', '0,0,50,50');
			const fixed = utils.getBooleanAttribute(hotspot, 'fixed');

			// The authored label: hotspotLabel (QTI 2.2 / 3.0), else the choice's text.
			// No identifier fallback — identifiers can reveal the answer key.
			const label =
				utils.getAttribute(hotspot, 'hotspotLabel', '').trim() || utils.getTextContent(hotspot).trim();

			return {
				identifier,
				label,
				shape,
				coords,
				...(fixed ? { fixed } : {}),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		const minChoices = utils.getNumberAttribute(element, 'minChoices', 0);
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 0);

		return {
			imageData,
			hotspotChoices,
			prompt,
			...(minChoices > 0 ? { minChoices } : {}),
			...(maxChoices > 0 ? { maxChoices } : {}),
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate image data
		if (!data.imageData) {
			warnings.push('graphicOrderInteraction has no image data');
		} else if (data.imageData.type === 'image' && !data.imageData.src) {
			errors.push('graphicOrderInteraction must have an image URL');
		} else if (data.imageData.type === 'svg' && !data.imageData.content) {
			errors.push('graphicOrderInteraction must have SVG content');
		}

		// Validate hotspot choices exist
		if (!data.hotspotChoices || data.hotspotChoices.length < 2) {
			errors.push('graphicOrderInteraction must have at least 2 hotspots');
		}

		// Validate hotspot choice identifiers and coords
		if (data.hotspotChoices) {
			const identifiers = new Set<string>();
			for (const hotspot of data.hotspotChoices) {
				if (!hotspot.identifier) {
					errors.push('All hotspot choices must have an identifier');
				} else if (identifiers.has(hotspot.identifier)) {
					errors.push(`Duplicate hotspot identifier: ${hotspot.identifier}`);
				} else {
					identifiers.add(hotspot.identifier);
				}

				if (!hotspot.coords) {
					errors.push(`Hotspot ${hotspot.identifier} must have coords`);
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
