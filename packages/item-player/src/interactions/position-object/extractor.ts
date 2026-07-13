import type { ElementExtractor } from '../../extraction/types.js';
import type { QTIElement } from '../index.js';

export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: string;
	height?: string;
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
		label: string;
		matchMax: number;
		objectData: ImageData | null;
		classes?: string[];
	}>;
	centerPoint: boolean;
	maxChoices: number;
	minChoices: number;
	prompt: string | null;
}

function imageDataFromObject(
	objectElement: QTIElement | undefined,
	utils: Parameters<ElementExtractor<PositionObjectData>['extract']>[1]['utils'],
	defaultWidth: string,
	defaultHeight: string,
): ImageData | null {
	if (!objectElement) return null;

	const type = utils.getAttribute(objectElement, 'type', '');
	const data = utils.getAttribute(objectElement, 'data', '');
	const width = utils.getAttribute(objectElement, 'width', defaultWidth);
	const height = utils.getAttribute(objectElement, 'height', defaultHeight);
	const content = utils.getHtmlContent(objectElement);

	if (type.startsWith('image/svg') && /<svg[\s>]/i.test(content)) {
		return { type: 'svg', content, width, height };
	}

	return { type: 'image', src: data, width, height };
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
		const imageData = imageDataFromObject(backgroundObject, utils, '500', '300');
		const objectData = imageDataFromObject(draggableObject, utils, '50', '50');
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);
		const minChoices = utils.getNumberAttribute(element, 'minChoices', 0);
		const label = utils.getTextContent(draggableObject).trim() || responseId;
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
			// The renderer currently represents the QTI default (the object's centre)
			// as a boolean. Explicit centre coordinates remain a follow-up API change.
			centerPoint: true,
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
