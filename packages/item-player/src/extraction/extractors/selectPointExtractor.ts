/**
 * Standard QTI selectPointInteraction extractor
 *
 * Extracts data from selectPointInteraction elements (click point on image)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Image data for select point interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: string;
	height?: string;
}

/**
 * Select point data extracted from selectPointInteraction elements
 */
export interface SelectPointData {
	imageData: ImageData | null;
	maxChoices: number;
	minChoices: number;
	prompt: string | null;
}

/**
 * Standard QTI select point interaction extractor
 * Handles selectPointInteraction elements (clicking points on an image)
 */
export const standardSelectPointExtractor: ElementExtractor<SelectPointData> = {
	id: 'qti:select-point-interaction',
	name: 'QTI Standard Select Point Interaction',
	priority: 10,
	elementTypes: ['selectPointInteraction'],
	description: 'Extracts standard QTI selectPointInteraction (click point on image)',

	canHandle(element, _context) {
		// All selectPointInteraction elements are standard
		return element.rawTagName === 'selectPointInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract image data from object or img element
		const objectElements = utils.getChildrenByTag(element, 'object');
		const imgElements = utils.getChildrenByTag(element, 'img');
		let imageData: ImageData | null = null;

		if (objectElements.length > 0) {
			const objectElement = objectElements[0];
			const type = utils.getAttribute(objectElement, 'type', '');
			const data = utils.getAttribute(objectElement, 'data', '');
			const width = utils.getAttribute(objectElement, 'width', '500');
			const height = utils.getAttribute(objectElement, 'height', '300');

			if (type.startsWith('image/svg')) {
				// Extract inline SVG content - get full content including <svg> tag
				const content = utils.getHtmlContent(objectElement);
				imageData = {
					type: 'svg',
					content,
					width,
					height,
				};
			} else {
				// External image reference
				imageData = {
					type: 'image',
					src: data,
					width,
					height,
				};
			}
		} else if (imgElements.length > 0) {
			// Handle img element as fallback
			const imgElement = imgElements[0];
			const src = utils.getAttribute(imgElement, 'src', '');
			const width = utils.getAttribute(imgElement, 'width', '500');
			const height = utils.getAttribute(imgElement, 'height', '300');
			imageData = {
				type: 'image',
				src,
				width,
				height,
			};
		}

		// Extract attributes
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);
		const minChoices = utils.getNumberAttribute(element, 'minChoices', 0);

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			imageData,
			maxChoices,
			minChoices,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate image data
		if (!data.imageData) {
			warnings.push('selectPointInteraction has no image data');
		} else if (data.imageData.type === 'image' && !data.imageData.src) {
			errors.push('selectPointInteraction must have an image URL');
		} else if (data.imageData.type === 'svg' && !data.imageData.content) {
			errors.push('selectPointInteraction must have SVG content');
		}

		// Validate maxChoices
		if (data.maxChoices <= 0) {
			errors.push('maxChoices must be at least 1');
		}

		// Validate minChoices
		if (data.minChoices < 0) {
			errors.push('minChoices must be non-negative');
		}

		// Validate minChoices <= maxChoices
		if (data.minChoices > data.maxChoices) {
			errors.push(`minChoices (${data.minChoices}) must be less than or equal to maxChoices (${data.maxChoices})`);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
