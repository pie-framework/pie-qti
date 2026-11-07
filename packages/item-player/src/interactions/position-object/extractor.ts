import type { ElementExtractor } from '../../extraction/types.js';
import { normalizePixelDimension } from '../../security/styleValues.js';
import { extractImageAlternative } from '../shared/imageAlt.js';
import type { PositionObjectCenterPoint, QTIElement } from '../shared/types.js';

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
	/** True only when the author explicitly marked the image decorative. */
	decorative?: boolean;
}

export interface PositionObjectData {
	imageData: ImageData | null;
	/**
	 * Compatibility shape consumed by the existing renderer. Each extracted
	 * interaction contributes its one draggable object here; the actual QTI
	 * positionObjectStage is the interaction's parent and supplies imageData.
	 */
	positionObjectStages: Array<{
		identifier: string;
		/**
		 * The draggable object's authored text alternative. Empty when the author
		 * gave none: the renderer then names it generically. Never the response
		 * identifier, which can leak the answer key to assistive technology.
		 */
		label: string;
		matchMax: number;
		objectData: ImageData | null;
		classes?: string[];
	}>;
	/**
	 * The point on the draggable object image treated as its position, as an
	 * offset from the object image's top-left corner in its own pixels. `null`
	 * when unauthored: the QTI default is the centre of its bounding rectangle.
	 */
	centerPoint: PositionObjectCenterPoint | null;
	maxChoices: number;
	minChoices: number;
	prompt: string | null;
}

/**
 * Read the authored reference point. QTI 2.2 spells the attribute `centerPoint`
 * and the QTI 2.1 schema `centrePoint`; the attribute mapper resolves the QTI 3.0
 * kebab-case form of either. The value is two numbers, horizontal then vertical,
 * whitespace-separated (a comma is tolerated, as in `coords`). Anything else
 * counts as unauthored, so the object falls back to the QTI default, its centre.
 */
function readCenterPoint(
	element: QTIElement,
	{ utils }: Parameters<ElementExtractor<PositionObjectData>['extract']>[1],
): PositionObjectCenterPoint | null {
	const authored = utils.getAttribute(element, 'centerPoint') || utils.getAttribute(element, 'centrePoint');
	const parts = authored.trim().split(/[\s,]+/);
	if (parts.length !== 2 || !parts.every((part) => /^[+-]?\d+(\.\d+)?$/.test(part))) return null;
	return { x: Number(parts[0]), y: Number(parts[1]) };
}

function imageDataFromObject(
	objectElement: QTIElement | undefined,
	context: Parameters<ElementExtractor<PositionObjectData>['extract']>[1],
	defaultWidth: string,
	defaultHeight: string,
): ImageData | null {
	if (!objectElement) return null;

	const { utils, dom } = context;
	const type = utils.getAttribute(objectElement, 'type', '');
	const data = utils.getAttribute(objectElement, 'data', '');
	const width = normalizePixelDimension(
		utils.getAttribute(objectElement, 'width', ''),
		defaultWidth,
	);
	const height = normalizePixelDimension(
		utils.getAttribute(objectElement, 'height', ''),
		defaultHeight,
	);
	const content = utils.getHtmlContent(objectElement);

	if (type.startsWith('image/svg') && /<svg[\s>]/i.test(content)) {
		return {
			type: 'svg',
			content,
			width,
			height,
			...extractImageAlternative(objectElement, utils, dom, { inlineSvgContent: content }),
		};
	}

	return {
		type: 'image',
		src: data,
		width,
		height,
		...extractImageAlternative(objectElement, utils, dom),
	};
}

export const standardPositionObjectExtractor: ElementExtractor<PositionObjectData> = {
	id: 'qti:position-object-interaction',
	name: 'QTI Standard Position Object Interaction',
	priority: 10,
	elementTypes: ['positionObjectInteraction'],
	description: 'Extracts a positionObjectInteraction from its parent positionObjectStage',

	canHandle(element) {
		const tagName = element.rawTagName?.toLowerCase();
		return tagName === 'positionobjectinteraction' || tagName === 'qti-position-object-interaction';
	},

	extract(element, context) {
		const { utils, responseId } = context;
		const parent = element.parentNode as QTIElement | undefined;
		const parentTagName = parent?.rawTagName?.toLowerCase();
		const isPositionObjectStage =
			parentTagName === 'positionobjectstage' || parentTagName === 'qti-position-object-stage';
		const stage = parent && isPositionObjectStage && utils.getChildrenByTag(parent, 'positionObjectInteraction').includes(element)
			? parent
			: undefined;

		const backgroundObject = stage ? utils.getChildrenByTag(stage, 'object')[0] : undefined;
		const draggableObject = utils.getChildrenByTag(element, 'object')[0];
		const imageData = imageDataFromObject(backgroundObject, context, '500', '300');
		const objectData = imageDataFromObject(draggableObject, context, '50', '50');
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);
		const minChoices = utils.getNumberAttribute(element, 'minChoices', 0);
		// The draggable object's authored alternative names it. No identifier
		// fallback: the renderer substitutes a localized generic name instead.
		const label = objectData?.alt ?? '';
		const classes = utils.getClasses(element);
		const prompt = utils.getPrompt(element);

		return {
			imageData,
			positionObjectStages: [
				{
					identifier: responseId,
					label,
					matchMax: maxChoices,
					objectData,
					...(classes.length > 0 ? { classes } : {}),
				},
			],
			// The point on the draggable object recorded as its position; null keeps
			// the QTI default (the centre of the object's bounding rectangle).
			centerPoint: readCenterPoint(element, context),
			maxChoices,
			minChoices,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!data.imageData) {
			errors.push('positionObjectInteraction must have a parent positionObjectStage with a background object');
		} else if (data.imageData.type === 'image' && !data.imageData.src) {
			errors.push('positionObjectStage background object must have a data URL');
		} else if (data.imageData.type === 'svg' && !data.imageData.content) {
			errors.push('positionObjectStage background object must have SVG content');
		}

		const draggable = data.positionObjectStages[0];
		if (!draggable?.objectData) {
			errors.push('positionObjectInteraction must contain one draggable object');
		} else if (draggable.objectData.type === 'image' && !draggable.objectData.src) {
			errors.push('positionObjectInteraction draggable object must have a data URL');
		}

		if (data.maxChoices < 0) errors.push('maxChoices must be non-negative');
		if (data.minChoices < 0) errors.push('minChoices must be non-negative');
		if (data.maxChoices > 0 && data.minChoices > data.maxChoices) {
			errors.push('minChoices cannot exceed maxChoices');
		}

		const objectWidth = Number(draggable?.objectData?.width);
		const objectHeight = Number(draggable?.objectData?.height);
		if (
			data.centerPoint &&
			objectWidth > 0 &&
			objectHeight > 0 &&
			(data.centerPoint.x < 0 || data.centerPoint.y < 0 || data.centerPoint.x > objectWidth || data.centerPoint.y > objectHeight)
		) {
			warnings.push(
				`centerPoint ${data.centerPoint.x} ${data.centerPoint.y} lies outside the ${objectWidth}×${objectHeight} object image`,
			);
		}

		if (data.imageData?.type === 'image') {
			warnings.push(
				'Ensure the declared positionObjectStage width/height match the image dimensions. ' +
					`Declared: ${data.imageData.width || 'unspecified'}×${data.imageData.height || 'unspecified'}`,
			);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
