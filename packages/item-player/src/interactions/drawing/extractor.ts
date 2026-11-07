/**
 * Standard QTI drawingInteraction extractor
 *
 * Extracts data from drawingInteraction elements (drawing on canvas)
 */

import type { ElementExtractor } from '../../extraction/types.js';
import { normalizePixelDimension } from '../../security/styleValues.js';
import { extractImageAlternative, imgAlternativeSource } from '../shared/imageAlt.js';

/**
 * Image data for drawing interaction
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
 * Drawing data extracted from drawingInteraction elements
 */
export interface DrawingData {
	imageData: ImageData | null;
	rawAttributes: Record<string, string>;
	prompt: string | null;
}

/**
 * Standard QTI drawing interaction extractor
 * Handles drawingInteraction elements (drawing on a canvas)
 */
export const standardDrawingExtractor: ElementExtractor<DrawingData> = {
	id: 'qti:drawing-interaction',
	name: 'QTI Standard Drawing Interaction',
	priority: 10,
	elementTypes: ['drawingInteraction'],
	description: 'Extracts standard QTI drawingInteraction (drawing on canvas)',

	canHandle(element, context) {
		// All drawingInteraction elements are standard
		return context.utils.matchesTag(element, 'drawingInteraction');
	},

	extract(element, context) {
		const { utils, dom } = context;

		// Extract background image data from the object element, or an img element (QTI 3.0) (optional)
		const objectElements = utils.getChildrenByTag(element, 'object');
		const imgElements = objectElements.length === 0 ? utils.getChildrenByTag(element, 'img') : [];
		let imageData: ImageData | null = null;

		if (objectElements.length > 0) {
			const objectElement = objectElements[0];
			const type = utils.getAttribute(objectElement, 'type', '');
			const data = utils.getAttribute(objectElement, 'data', '');
			const width = normalizePixelDimension(utils.getAttribute(objectElement, 'width', ''));
			const height = normalizePixelDimension(utils.getAttribute(objectElement, 'height', ''));
			const content = type.startsWith('image/svg') ? utils.getHtmlContent(objectElement) : '';

			if (/<svg[\s>]/i.test(content)) {
				// Inline SVG content
				imageData = {
					type: 'svg',
					content,
					...(width ? { width } : {}),
					...(height ? { height } : {}),
					...extractImageAlternative(objectElement, utils, dom, { inlineSvgContent: content }),
				};
			} else if (data) {
				// External image (or SVG file) reference; the <object>'s text is its alternative
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
			const src = utils.getAttribute(imgElement, 'src', '');
			const width = normalizePixelDimension(utils.getAttribute(imgElement, 'width', ''));
			const height = normalizePixelDimension(utils.getAttribute(imgElement, 'height', ''));
			if (src) {
				imageData = {
					type: 'image',
					src,
					...(width ? { width } : {}),
					...(height ? { height } : {}),
					...extractImageAlternative(imgElement, utils, dom, imgAlternativeSource(imgElement)),
				};
			}
		}

		// Extract all attributes
		const rawAttributes: Record<string, string> = {};
		if (element.attributes) {
			for (const [key, value] of Object.entries(element.attributes)) {
				rawAttributes[key] = String(value);
			}
		}

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			imageData,
			rawAttributes,
			prompt,
		};
	},

	validate(data) {
		const warnings: string[] = [];

		// Warn if no background image
		if (!data.imageData) {
			warnings.push(
				'drawingInteraction has no background image - students will draw on a blank canvas'
			);
		}

		return {
			valid: true,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
