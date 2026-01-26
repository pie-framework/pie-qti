/**
 * Standard QTI hotspotInteraction extractor
 *
 * Extracts data from hotspotInteraction elements (clickable areas on image)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Image data for hotspot interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: string;
	height?: string;
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

	canHandle(element, _context) {
		// All hotspotInteraction elements are standard
		return element.rawTagName === 'hotspotInteraction';
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
			const width = utils.getAttribute(objectElement, 'width', 'auto');
			const height = utils.getAttribute(objectElement, 'height', 'auto');

			if (type.startsWith('image/svg')) {
				// Extract inline SVG content - keep the full <svg>...</svg> markup.
				// (Using the innerHTML of the <svg> element would drop the wrapper tag and render as plain text.)
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

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			imageData,
			hotspotChoices,
			maxChoices,
			...(minChoices > 0 ? { minChoices } : {}),
			prompt,
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
