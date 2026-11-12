/**
 * Standard QTI selectPointInteraction extractor
 *
 * Extracts data from selectPointInteraction elements (click point on image)
 */

import type { ElementExtractor } from '../../extraction/types.js';
import { normalizePixelDimension } from '../../security/styleValues.js';
import { extractImageAlternative, imgAlternativeSource } from '../shared/imageAlt.js';
import { findInteractionImage } from '../shared/interactionImage.js';
import { predatesQti22, unrestrictedLimitDefault } from '../shared/specDefaults.js';

/**
 * Image data for select point interaction
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

	canHandle(element, context) {
		// All selectPointInteraction elements are standard
		return context.utils.matchesTag(element, 'selectPointInteraction');
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
			// The stage's pixel space: the authored width/height, when declared. Without
			// them the renderer stages the raster at its natural size; a default here
			// would silently place points in a guessed space.
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
		} else if (interactionImage) {
			// QTI 3.0 <img>: the alt attribute is the text alternative (alt="" = decorative)
			const imgElement = interactionImage.element;
			const src = utils.getAttribute(imgElement, 'src', '');
			const width = normalizePixelDimension(utils.getAttribute(imgElement, 'width', ''));
			const height = normalizePixelDimension(utils.getAttribute(imgElement, 'height', ''));
			imageData = {
				type: 'image',
				src,
				width,
				height,
				...extractImageAlternative(imgElement, utils, dom, imgAlternativeSource(imgElement)),
			};
		}

		// Extract attributes. Absent maxChoices: "0" (no restriction) in QTI 2.2 (Table 5.95.2)
		// and QTI 3.0 (Table 5.128.2), resolved to 1 for a single-cardinality response, which
		// holds one point. QTI 2.1 keeps 1: its information model (`maxChoices [1] = 1`) and
		// its XSD (default "0") disagree, so 2.1 has no clear default to apply.
		const maxChoices = utils.getNumberAttribute(
			element,
			'maxChoices',
			predatesQti22(context) ? 1 : unrestrictedLimitDefault(context),
		);
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

		// Validate maxChoices — 0 means unlimited per QTI spec
		if (data.maxChoices < 0) {
			errors.push('maxChoices must be non-negative');
		}

		// Validate minChoices
		if (data.minChoices < 0) {
			errors.push('minChoices must be non-negative');
		}

		// Validate minChoices <= maxChoices (skip when maxChoices=0, meaning unlimited)
		if (data.maxChoices > 0 && data.minChoices > data.maxChoices) {
			errors.push(`minChoices (${data.minChoices}) must be less than or equal to maxChoices (${data.maxChoices})`);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
