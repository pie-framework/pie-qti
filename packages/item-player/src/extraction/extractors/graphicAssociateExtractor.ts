/**
 * Standard QTI graphicAssociateInteraction extractor
 *
 * Extracts data from graphicAssociateInteraction elements (associate items on image)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Image data for graphic associate interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: string;
	height?: string;
}

/**
 * Graphic associate data extracted from graphicAssociateInteraction elements
 */
export interface GraphicAssociateData {
	imageData: ImageData | null;
	associableHotspots: Array<{
		identifier: string;
		label: string;
		shape: string;
		coords: string;
		matchMax: number;
		matchMin?: number;
		classes?: string[];
	}>;
	maxAssociations: number;
	minAssociations: number;
	prompt: string | null;
}

/**
 * Standard QTI graphic associate interaction extractor
 * Handles graphicAssociateInteraction elements (creating associations between hotspots)
 */
export const standardGraphicAssociateExtractor: ElementExtractor<GraphicAssociateData> = {
	id: 'qti:graphic-associate-interaction',
	name: 'QTI Standard Graphic Associate Interaction',
	priority: 10,
	elementTypes: ['graphicAssociateInteraction'],
	description: 'Extracts standard QTI graphicAssociateInteraction (associate items on image)',

	canHandle(element, _context) {
		// All graphicAssociateInteraction elements are standard
		return element.rawTagName === 'graphicAssociateInteraction';
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

		// Extract associableHotspot children
		const hotspotElements = utils.getChildrenByTag(element, 'associableHotspot');
		const associableHotspots = hotspotElements.map((hotspot) => {
			const classes = utils.getClasses(hotspot);
			const identifier = utils.getAttribute(hotspot, 'identifier', '');
			const shape = utils.getAttribute(hotspot, 'shape', 'rect');
			const coords = utils.getAttribute(hotspot, 'coords', '0,0,50,50');
			const matchMax = utils.getNumberAttribute(hotspot, 'matchMax', 1);
			const matchMin = utils.getNumberAttribute(hotspot, 'matchMin', 0);

			// Get text content as label, use identifier as fallback
			const textContent = utils.getTextContent(hotspot).trim();
			const label = textContent || identifier;

			return {
				identifier,
				label,
				shape,
				coords,
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract attributes with proper defaults
		const maxAssociations = utils.getNumberAttribute(element, 'maxAssociations', 1);
		const minAssociations = utils.getNumberAttribute(element, 'minAssociations', 0);

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			imageData,
			associableHotspots,
			maxAssociations,
			minAssociations,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate image data
		if (!data.imageData) {
			warnings.push('graphicAssociateInteraction has no image data');
		} else if (data.imageData.type === 'image' && !data.imageData.src) {
			errors.push('graphicAssociateInteraction must have an image URL');
		} else if (data.imageData.type === 'svg' && !data.imageData.content) {
			errors.push('graphicAssociateInteraction must have SVG content');
		}

		// Validate hotspots exist
		if (!data.associableHotspots || data.associableHotspots.length < 2) {
			errors.push('graphicAssociateInteraction must have at least 2 hotspots');
		}

		// Validate hotspot identifiers and coords
		if (data.associableHotspots && data.associableHotspots.length > 0) {
			const identifiers = new Set<string>();
			for (const hotspot of data.associableHotspots) {
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

				// Validate matchMax
				if (hotspot.matchMax < 0) {
					errors.push(`matchMax must be non-negative for hotspot ${hotspot.identifier}`);
				}
			}
		}

		// Validate maxAssociations
		if (data.maxAssociations < 0) {
			errors.push('maxAssociations must be non-negative');
		}

		// Validate minAssociations
		if (data.minAssociations < 0) {
			errors.push('minAssociations must be non-negative');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
