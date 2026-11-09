/**
 * Standard QTI graphicAssociateInteraction extractor
 *
 * Extracts data from graphicAssociateInteraction elements (associate items on image)
 */

import type { ElementExtractor } from '../../extraction/types.js';
import { normalizePixelDimension } from '../../security/styleValues.js';
import { extractImageAlternative, imgAlternativeSource } from '../shared/imageAlt.js';

/**
 * Image data for graphic associate interaction
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
 * Graphic associate data extracted from graphicAssociateInteraction elements
 */
export interface GraphicAssociateData {
	imageData: ImageData | null;
	associableHotspots: Array<{
		identifier: string;
		/**
		 * The hotspot's authored text (`hotspotLabel` or element text). Empty when
		 * the author gave none: the renderer then names it by position. Never the
		 * identifier, which can leak the answer key to assistive technology.
		 */
		label: string;
		shape: string;
		coords: string;
		matchMax: number;
		matchMin?: number;
		matchGroup?: string[];
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

	canHandle(element, context) {
		// All graphicAssociateInteraction elements are standard
		return context.utils.matchesTag(element, 'graphicAssociateInteraction');
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
			// would silently place hotspots in a guessed space.
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

		// Extract associableHotspot children
		const hotspotElements = utils.getChildrenByTag(element, 'associableHotspot');
		const associableHotspots = hotspotElements.map((hotspot) => {
			const classes = utils.getClasses(hotspot);
			const identifier = utils.getAttribute(hotspot, 'identifier', '');
			const shape = utils.getAttribute(hotspot, 'shape', 'rect');
			const coords = utils.getAttribute(hotspot, 'coords', '0,0,50,50');
			const matchMax = utils.getNumberAttribute(hotspot, 'matchMax', 1);
			const matchMin = utils.getNumberAttribute(hotspot, 'matchMin', 0);
			const matchGroupRaw = utils.getAttribute(hotspot, 'matchGroup', '');
			const matchGroup = matchGroupRaw.split(/\s+/).filter(Boolean);

			// The authored label: hotspotLabel (QTI 2.2 / 3.0), else the hotspot's text.
			// No identifier fallback — identifiers can reveal the answer key.
			const label =
				utils.getAttribute(hotspot, 'hotspotLabel', '').trim() || utils.getTextContent(hotspot).trim();

			return {
				identifier,
				label,
				shape,
				coords,
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				...(matchGroup.length > 0 ? { matchGroup } : {}),
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
