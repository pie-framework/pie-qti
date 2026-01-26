/**
 * Standard QTI drawingInteraction extractor
 *
 * Extracts data from drawingInteraction elements (drawing on canvas)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Image data for drawing interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: string;
	height?: string;
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

	canHandle(element, _context) {
		// All drawingInteraction elements are standard
		return element.rawTagName === 'drawingInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract background image data from object element (optional)
		const objectElements = utils.getChildrenByTag(element, 'object');
		let imageData: ImageData | null = null;

		if (objectElements.length > 0) {
			const objectElement = objectElements[0];
			const type = utils.getAttribute(objectElement, 'type', '');
			const data = utils.getAttribute(objectElement, 'data', '');
			const width = utils.getAttribute(objectElement, 'width', '');
			const height = utils.getAttribute(objectElement, 'height', '');

			if (type.startsWith('image/svg')) {
				// Extract inline SVG content
				const content = utils.getHtmlContent(objectElement);
				imageData = {
					type: 'svg',
					content,
					...(width ? { width } : {}),
					...(height ? { height } : {}),
				};
			} else if (data) {
				// External image reference
				imageData = {
					type: 'image',
					src: data,
					...(width ? { width } : {}),
					...(height ? { height } : {}),
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
