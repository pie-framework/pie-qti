/**
 * Standard QTI graphicGapMatchInteraction extractor
 *
 * Extracts data from graphicGapMatchInteraction elements (drag text/images into gaps on image)
 */

import type { ElementExtractor } from '../../extraction/types.js';
import {
	normalizeCssPixelLength,
	normalizePixelDimension,
} from '../../security/styleValues.js';
import { extractImageAlternative, imgAlternativeSource } from '../shared/imageAlt.js';
import { findInteractionImage } from '../shared/interactionImage.js';
import { predatesQti22 } from '../shared/specDefaults.js';

/**
 * Image data for graphic gap match interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: number;
	height?: number;
	/** Short text alternative extracted from the QTI source. */
	alt?: string;
	/** Longer description for complex images (SVG <desc>, aria description). */
	altDescription?: string;
	/** True only when the author explicitly marked the image decorative (`<img alt="">`). */
	decorative?: boolean;
}

/**
 * Graphic gap match data extracted from graphicGapMatchInteraction elements
 */
export interface GraphicGapMatchData {
	imageData: ImageData | null;
	maxAssociations: number;
	/** QTI `minAssociations`, the associations a valid response makes; omitted when 0. */
	minAssociations?: number;
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
		/** Minimum number of hotspots this label must fill; omitted when 0. */
		matchMin?: number;
		matchGroup?: string[];
		/**
		 * The gapImg's authored `objectLabel` (QTI 2.1 `objectLabel.GapImg.Attr`,
		 * QTI 3.0 `object-label`). Names the label for assistive technology when
		 * the image itself carries no text alternative.
		 */
		objectLabel?: string;
		width?: number;
		height?: number;
	}>;
	hotspots: Array<{
		identifier: string;
		shape: string;
		coords: string;
		matchMax: number;
		/** Minimum number of labels this hotspot must take; omitted when 0. */
		matchMin?: number;
		matchGroup?: string[];
		/** The authored `hotspotLabel`; names the zone for assistive technology. */
		hotspotLabel?: string;
	}>;
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

	canHandle(element, context) {
		// All graphicGapMatchInteraction elements are standard
		return context.utils.matchesTag(element, 'graphicGapMatchInteraction');
	},

	extract(element, context) {
		const { utils, dom } = context;

		// Extract image data from the object element (QTI 2.x) or an img element
		// (QTI 3.0, plain or as a <picture>'s fallback img)
		const interactionImage = findInteractionImage(element, utils);
		let imageData: ImageData | null = null;

		if (interactionImage?.kind === 'object') {
			const objectElement = interactionImage.element;
			const type = utils.getAttribute(objectElement, 'type', '');
			const data = utils.getAttribute(objectElement, 'data', '');
			const normalizedWidth = normalizePixelDimension(utils.getAttribute(objectElement, 'width', ''));
			const normalizedHeight = normalizePixelDimension(utils.getAttribute(objectElement, 'height', ''));
			const width = normalizedWidth ? Number(normalizedWidth) : undefined;
			const height = normalizedHeight ? Number(normalizedHeight) : undefined;

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
						...(width ? { width } : {}),
						...(height ? { height } : {}),
						...extractImageAlternative(objectElement, utils, dom, { inlineSvgContent: content }),
					};
				} else {
					// External SVG file reference — render via <img src>
					imageData = {
						type: 'image',
						src: data,
						...(width ? { width } : {}),
						...(height ? { height } : {}),
						...extractImageAlternative(objectElement, utils, dom),
					};
				}
			} else {
				// External image reference
				imageData = {
					type: 'image',
					src: data,
					...(width ? { width } : {}),
					...(height ? { height } : {}),
					...extractImageAlternative(objectElement, utils, dom),
				};
			}
		} else if (interactionImage) {
			// QTI 3.0 <img>: the alt attribute is the text alternative (alt="" = decorative)
			const imgElement = interactionImage.element;
			const normalizedWidth = normalizePixelDimension(utils.getAttribute(imgElement, 'width', ''));
			const normalizedHeight = normalizePixelDimension(utils.getAttribute(imgElement, 'height', ''));
			imageData = {
				type: 'image',
				src: utils.getAttribute(imgElement, 'src', ''),
				...(normalizedWidth ? { width: Number(normalizedWidth) } : {}),
				...(normalizedHeight ? { height: Number(normalizedHeight) } : {}),
				...extractImageAlternative(imgElement, utils, dom, imgAlternativeSource(imgElement)),
			};
		}

		// Extract interaction-level attributes with the per-version spec default for an
		// absent maxAssociations: QTI 2.2 (Table 5.41.2) and QTI 3.0 (Table 5.60.2) give
		// it the default "1" (0 = no restriction), while the attribute does not exist on
		// graphicGapMatchInteraction in QTI 2.1, so absent means no interaction cap there
		// (the only 2.1 limits are the per-choice matchMax values). An explicit value is
		// honoured in every version as leniency, with "0" meaning unlimited.
		const maxAssociations = utils.getNumberAttribute(
			element,
			'maxAssociations',
			predatesQti22(context) ? 0 : 1,
		);
		// minAssociations (QTI 2.2; QTI 3.0 §5.60.1 min-associations): "The minimum number of
		// associations that the candidate is required to make to form a valid response. If
		// min-associations is 0 then the candidate is not required to make any associations."
		const minAssociations = utils.getNumberAttribute(element, 'minAssociations', 0);

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
			const matchMin = utils.getNumberAttribute(gapImg, 'matchMin', 0);
			const matchGroupRaw = utils.getAttribute(gapImg, 'matchGroup', '');
			const matchGroup = matchGroupRaw.split(/\s+/).filter(Boolean);
			const objectLabel = utils.getAttribute(gapImg, 'objectLabel', '').trim();
			// QTI 3.0 GapImgDType allows object, img or picture (delivered via its img fallback)
			const image = findInteractionImage(gapImg, utils);
			let src = '';
			let alt = '';
			let width: number | undefined;
			let height: number | undefined;
			// The image's text alternative names the draggable label for assistive
			// technology; an empty alt never falls back to the identifier.
			const imageElement = image?.element;
			if (imageElement) {
				const isImg = image?.kind === 'img';
				src = utils.getAttribute(imageElement, isImg ? 'src' : 'data', '');
				alt =
					extractImageAlternative(
						imageElement,
						utils,
						dom,
						isImg ? imgAlternativeSource(imageElement) : {},
					).alt ?? '';
				const w = normalizePixelDimension(utils.getAttribute(imageElement, 'width', ''));
				const h = normalizePixelDimension(utils.getAttribute(imageElement, 'height', ''));
				if (w) width = Number(w);
				if (h) height = Number(h);
			}
			return {
				identifier: utils.getAttribute(gapImg, 'identifier', ''),
				src,
				alt,
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				...(matchGroup.length > 0 ? { matchGroup } : {}),
				...(objectLabel ? { objectLabel } : {}),
				...(width !== undefined ? { width } : {}),
				...(height !== undefined ? { height } : {}),
			};
		});

		// Extract associableHotspot elements (gap targets)
		const hotspotElements = utils.getChildrenByTag(element, 'associableHotspot');
		const hotspots = hotspotElements.map((hotspot) => {
			const matchGroup = utils
				.getAttribute(hotspot, 'matchGroup', '')
				.split(/\s+/)
				.filter(Boolean);
			const matchMin = utils.getNumberAttribute(hotspot, 'matchMin', 0);
			const hotspotLabel = utils.getAttribute(hotspot, 'hotspotLabel', '').trim();
			return {
				identifier: utils.getAttribute(hotspot, 'identifier', ''),
				shape: utils.getAttribute(hotspot, 'shape', 'rect'),
				coords: utils.getAttribute(hotspot, 'coords', ''),
				matchMax: utils.getNumberAttribute(hotspot, 'matchMax', 1),
				...(matchMin > 0 ? { matchMin } : {}),
				// Authored matchGroup: the identifiers of the labels that may be matched with this hotspot.
				...(matchGroup.length > 0 ? { matchGroup } : {}),
				// The authored zone name for assistive technology (2.1 hotspotLabel,
				// 3.0 hotspot-label); an empty attribute never falls back to the identifier.
				...(hotspotLabel ? { hotspotLabel } : {}),
			};
		});

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		const interactionClasses = utils.getClasses(element);
		const choicesContainerWidth = normalizeCssPixelLength(
			utils.getAttribute(element, 'data-choices-container-width', ''),
		);
		const maxSelectionsMessage = utils.getAttribute(element, 'data-max-selections-message', '') || null;
		const minSelectionsMessage = utils.getAttribute(element, 'data-min-selections-message', '') || null;

		return {
			imageData,
			maxAssociations,
			...(minAssociations > 0 ? { minAssociations } : {}),
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

				// The default shape is the whole image (QTI 3.0 §8.29), so its coords
				// may be empty — the same rule the hotspot extractor applies.
				if (!hotspot.coords && hotspot.shape !== 'default') {
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
