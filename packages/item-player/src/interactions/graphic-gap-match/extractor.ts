/**
 * Standard QTI graphicGapMatchInteraction extractor
 *
 * Extracts data from graphicGapMatchInteraction elements (drag text/images into gaps on image)
 */

import type { ElementExtractor } from '../../extraction/types.js';

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
	maxAssociations: number;
	gapTexts: Array<{
		identifier: string;
		text: string;
		matchMax: number;
		matchMin?: number;
		matchGroup?: string[];
		classes?: string[];
	}>;
	gapImages: Array<{
		identifier: string;
		src: string;
		alt: string;
		matchMax: number;
		matchGroup?: string[];
		width?: number;
		height?: number;
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
				// Inline SVG: <object type="image/svg+xml"><svg>...</svg></object>
				// External SVG: <object type="image/svg+xml" data="path/to/file.svg"/>
				// The <object> may contain alt text (not SVG markup) — only treat as inline if content has <svg.
				const content = utils.getHtmlContent(objectElement);
				const hasSvgMarkup = /<svg[\s>]/i.test(content);
				if (hasSvgMarkup) {
					imageData = {
						type: 'svg',
						content,
						...(width > 0 ? { width } : {}),
						...(height > 0 ? { height } : {}),
					};
				} else {
					// External SVG file reference — render via <img src>
					imageData = {
						type: 'image',
						src: data,
						...(width > 0 ? { width } : {}),
						...(height > 0 ? { height } : {}),
					};
				}
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

		// Extract interaction-level attributes
		const maxAssociations = utils.getNumberAttribute(element, 'maxAssociations', 0);

		// Extract gapText children (draggable text labels)
		const gapTextElements = utils.getChildrenByTag(element, 'gapText');
		const gapTexts = gapTextElements.map((gapText) => {
			const classes = utils.getClasses(gapText);
			const matchMax = utils.getNumberAttribute(gapText, 'matchMax', 1);
			const matchMin = utils.getNumberAttribute(gapText, 'matchMin', 0);
			const matchGroupRaw = utils.getAttribute(gapText, 'matchGroup', '');
			const matchGroup = matchGroupRaw.split(/\s+/).filter(Boolean);
			const text = utils.getHtmlContent(gapText);

			return {
				identifier: utils.getAttribute(gapText, 'identifier', ''),
				text,
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				...(matchGroup.length > 0 ? { matchGroup } : {}),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract gapImg children (draggable image labels)
		const gapImgElements = utils.getChildrenByTag(element, 'gapImg');
		const gapImages = gapImgElements.map((gapImg) => {
			const matchMax = utils.getNumberAttribute(gapImg, 'matchMax', 1);
			const matchGroupRaw = utils.getAttribute(gapImg, 'matchGroup', '');
			const matchGroup = matchGroupRaw.split(/\s+/).filter(Boolean);
			const objectChildren = utils.getChildrenByTag(gapImg, 'object');
			let src = '';
			let alt = '';
			let width: number | undefined;
			let height: number | undefined;
			if (objectChildren.length > 0) {
				const obj = objectChildren[0];
				src = utils.getAttribute(obj, 'data', '');
				alt = utils.getTextContent(obj);
				const w = utils.getNumberAttribute(obj, 'width', 0);
				const h = utils.getNumberAttribute(obj, 'height', 0);
				if (w > 0) width = w;
				if (h > 0) height = h;
			}
			return {
				identifier: utils.getAttribute(gapImg, 'identifier', ''),
				src,
				alt,
				matchMax,
				...(matchGroup.length > 0 ? { matchGroup } : {}),
				...(width !== undefined ? { width } : {}),
				...(height !== undefined ? { height } : {}),
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

		const interactionClasses = utils.getClasses(element);
		const choicesContainerWidth = utils.getAttribute(element, 'data-choices-container-width', '') || null;
		const maxSelectionsMessage = utils.getAttribute(element, 'data-max-selections-message', '') || null;
		const minSelectionsMessage = utils.getAttribute(element, 'data-min-selections-message', '') || null;

		return {
			imageData,
			maxAssociations,
			gapTexts,
			gapImages,
			hotspots,
			prompt,
			...(interactionClasses.length > 0 ? { interactionClasses } : {}),
			...(choicesContainerWidth ? { choicesContainerWidth } : {}),
			...(maxSelectionsMessage ? { maxSelectionsMessage } : {}),
			...(minSelectionsMessage ? { minSelectionsMessage } : {}),
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

		// Validate that at least one draggable choice type is present
		if ((!data.gapTexts || data.gapTexts.length === 0) && (!data.gapImages || data.gapImages.length === 0)) {
			errors.push('graphicGapMatchInteraction must have at least one gapText or gapImg');
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
