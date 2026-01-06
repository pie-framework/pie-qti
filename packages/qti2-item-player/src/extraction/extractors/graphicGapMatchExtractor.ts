/**
 * Standard QTI graphicGapMatchInteraction extractor
 *
 * Extracts data from graphicGapMatchInteraction elements (drag text/images into gaps on image)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Image data for graphic gap match interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: number;
	height?: number;
}

/**
 * Graphic gap match data extracted from graphicGapMatchInteraction elements
 */
export interface GraphicGapMatchData {
	imageData: ImageData | null;
	gapTexts: Array<{
		identifier: string;
		text: string;
		matchMax: number;
		matchMin?: number;
		classes?: string[];
	}>;
	hotspots: Array<{ identifier: string; shape: string; coords: string; matchMax: number }>;
	prompt: string | null;
}

/**
 * Standard QTI graphic gap match interaction extractor
 * Handles graphicGapMatchInteraction elements (drag text/images into gaps on an image)
 */
export const standardGraphicGapMatchExtractor: ElementExtractor<GraphicGapMatchData> = {
	id: 'qti:graphic-gap-match-interaction',
	name: 'QTI Standard Graphic Gap Match Interaction',
	priority: 10,
	elementTypes: ['graphicGapMatchInteraction'],
	description: 'Extracts standard QTI graphicGapMatchInteraction (drag text/images into gaps)',

	canHandle(element, _context) {
		// All graphicGapMatchInteraction elements are standard
		return element.rawTagName === 'graphicGapMatchInteraction';
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
			const width = utils.getNumberAttribute(objectElement, 'width', 0);
			const height = utils.getNumberAttribute(objectElement, 'height', 0);

			if (type.startsWith('image/svg')) {
				// Extract inline SVG content - get full content including <svg> tag
				const content = utils.getHtmlContent(objectElement);
				imageData = {
					type: 'svg',
					content,
					...(width > 0 ? { width } : {}),
					...(height > 0 ? { height } : {}),
				};
			} else {
				// External image reference
				imageData = {
					type: 'image',
					src: data,
					...(width > 0 ? { width } : {}),
					...(height > 0 ? { height } : {}),
				};
			}
		}

		// Extract gapText children (draggable text labels)
		const gapTextElements = utils.getChildrenByTag(element, 'gapText');
		const gapTexts = gapTextElements.map((gapText) => {
			const classes = utils.getClasses(gapText);
			const matchMax = utils.getNumberAttribute(gapText, 'matchMax', 1);
			const matchMin = utils.getNumberAttribute(gapText, 'matchMin', 0);
			const text = utils.getHtmlContent(gapText);

			return {
				identifier: utils.getAttribute(gapText, 'identifier', ''),
				text,
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract associableHotspot elements (gap targets)
		const hotspotElements = utils.getChildrenByTag(element, 'associableHotspot');
		const hotspots = hotspotElements.map((hotspot) => ({
			identifier: utils.getAttribute(hotspot, 'identifier', ''),
			shape: utils.getAttribute(hotspot, 'shape', 'rect'),
			coords: utils.getAttribute(hotspot, 'coords', ''),
			matchMax: utils.getNumberAttribute(hotspot, 'matchMax', 1),
		}));

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			imageData,
			gapTexts,
			hotspots,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate image data (optional but recommended)
		if (!data.imageData) {
			warnings.push('graphicGapMatchInteraction has no background image');
		} else if (data.imageData.type === 'image' && !data.imageData.src) {
			errors.push('graphicGapMatchInteraction must have an image URL');
		} else if (data.imageData.type === 'svg' && !data.imageData.content) {
			errors.push('graphicGapMatchInteraction must have SVG content');
		}

		// Validate gapTexts exist
		if (!data.gapTexts || data.gapTexts.length === 0) {
			errors.push('graphicGapMatchInteraction must have at least one gapText');
		}

		// Validate hotspots exist
		if (!data.hotspots || data.hotspots.length === 0) {
			errors.push('graphicGapMatchInteraction must have at least one hotspot');
		}

		// Validate gapText identifiers
		if (data.gapTexts) {
			const identifiers = new Set<string>();
			for (const gapText of data.gapTexts) {
				if (!gapText.identifier) {
					errors.push('All gapTexts must have an identifier');
				} else if (identifiers.has(gapText.identifier)) {
					errors.push(`Duplicate gapText identifier: ${gapText.identifier}`);
				} else {
					identifiers.add(gapText.identifier);
				}
			}
		}

		// Validate hotspot identifiers
		if (data.hotspots) {
			const identifiers = new Set<string>();
			for (const hotspot of data.hotspots) {
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
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
