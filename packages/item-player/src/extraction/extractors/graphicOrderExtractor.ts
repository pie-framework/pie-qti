/**
 * Standard QTI graphicOrderInteraction extractor
 *
 * Extracts data from graphicOrderInteraction elements (order items on image)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Image data for graphic order interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: string;
	height?: string;
}

/**
 * Graphic order data extracted from graphicOrderInteraction elements
 */
export interface GraphicOrderData {
	imageData: ImageData | null;
	hotspotChoices: Array<{
		identifier: string;
		label: string;
		shape: string;
		coords: string;
		fixed?: boolean;
		classes?: string[];
	}>;
	prompt: string | null;
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

	canHandle(element, _context) {
		// All graphicOrderInteraction elements are standard
		return element.rawTagName === 'graphicOrderInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract image data from object element
		const objectElements = utils.getChildrenByTag(element, 'object');
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
		}

		// Extract hotspotChoice children
		const hotspotElements = utils.getChildrenByTag(element, 'hotspotChoice');
		const hotspotChoices = hotspotElements.map((hotspot) => {
			const classes = utils.getClasses(hotspot);
			const identifier = utils.getAttribute(hotspot, 'identifier', '');
			const shape = utils.getAttribute(hotspot, 'shape', 'rect');
			const coords = utils.getAttribute(hotspot, 'coords', '0,0,50,50');
			const fixed = utils.getBooleanAttribute(hotspot, 'fixed');

			// Get text content as label, use identifier as fallback
			const textContent = utils.getTextContent(hotspot).trim();
			const label = textContent || identifier;

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

		return {
			imageData,
			hotspotChoices,
			prompt,
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
