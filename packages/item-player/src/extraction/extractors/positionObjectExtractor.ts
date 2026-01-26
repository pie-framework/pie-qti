/**
 * Standard QTI positionObjectInteraction extractor
 *
 * Extracts data from positionObjectInteraction elements (drag objects to positions)
 *
 * ⚠️ IMPORTANT: QTI 2.2 positionObjectInteraction Limitations
 *
 * This interaction has severe limitations that make it impractical for most educational scenarios:
 *
 * 1. Response format is baseType="point" - only stores coordinates ["158 168"]
 * 2. NO way to track which specific object was placed where
 * 3. Designed ONLY for placing multiple copies of the SAME object (e.g., airport icons)
 * 4. Cannot support "place labeled objects on map" use cases
 *
 * The official QTI 2.2 spec example shows:
 * - ONE positionObjectStage (container) with background image
 * - ONE positionObjectInteraction with ONE draggable object
 * - maxChoices determines how many times the object can be placed
 * - Scoring uses areaMapping to check if ANY placement hits target zones
 *
 * This extractor supports a NON-STANDARD extension with multiple positionObjectStage
 * elements (each with identifiers), but the response format cannot preserve object identity.
 * For labeled-object placement, use graphicGapMatchInteraction instead.
 */

import type { ElementExtractor } from '../types.js';

/**
 * Image data for position object interaction
 */
export interface ImageData {
	type: 'image' | 'svg';
	src?: string;
	content?: string;
	width?: string;
	height?: string;
}

/**
 * Position object data extracted from positionObjectInteraction elements
 */
export interface PositionObjectData {
	imageData: ImageData | null;
	positionObjectStages: Array<{
		identifier: string;
		label: string;
		matchMax: number;
		matchMin?: number;
		objectData: ImageData | null;
		classes?: string[];
	}>;
	centerPoint: boolean;
	maxChoices: number;
	minChoices: number;
	prompt: string | null;
}

/**
 * Standard QTI position object interaction extractor
 * Handles positionObjectInteraction elements (dragging an object to a position)
 */
export const standardPositionObjectExtractor: ElementExtractor<PositionObjectData> = {
	id: 'qti:position-object-interaction',
	name: 'QTI Standard Position Object Interaction',
	priority: 10,
	elementTypes: ['positionObjectInteraction'],
	description: 'Extracts standard QTI positionObjectInteraction (drag object to position)',

	canHandle(element, _context) {
		// All positionObjectInteraction elements are standard
		return element.rawTagName === 'positionObjectInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract background image data from object element (direct child)
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

		// Extract positionObjectStage children
		const stageElements = utils.getChildrenByTag(element, 'positionObjectStage');
		const positionObjectStages = stageElements.map((stage) => {
			const classes = utils.getClasses(stage);
			const identifier = utils.getAttribute(stage, 'identifier', '');
			const matchMax = utils.getNumberAttribute(stage, 'matchMax', 1);
			const matchMin = utils.getNumberAttribute(stage, 'matchMin', 0);

			// Get text content as label, use identifier as fallback
			const textContent = utils.getTextContent(stage).trim();
			const label = textContent || identifier;

			// Extract object data from nested object element
			const stageObjectElements = utils.getChildrenByTag(stage, 'object');
			let objectData: ImageData | null = null;

			if (stageObjectElements.length > 0) {
				const objElement = stageObjectElements[0];
				const objType = utils.getAttribute(objElement, 'type', '');
				const objData = utils.getAttribute(objElement, 'data', '');
				const objWidth = utils.getAttribute(objElement, 'width', '50');
				const objHeight = utils.getAttribute(objElement, 'height', '50');

				if (objType.startsWith('image/svg')) {
					// Extract inline SVG content
					const content = utils.getHtmlContent(objElement);
					objectData = {
						type: 'svg',
						content,
						width: objWidth,
						height: objHeight,
					};
				} else {
					// External image reference
					objectData = {
						type: 'image',
						src: objData,
						width: objWidth,
						height: objHeight,
					};
				}
			}

			return {
				identifier,
				label,
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				objectData,
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract attributes
		// centerPoint defaults to true when not specified
		const centerPoint = utils.getBooleanAttribute(element, 'centerPoint', true);
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 0);
		const minChoices = utils.getNumberAttribute(element, 'minChoices', 0);

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			imageData,
			positionObjectStages,
			centerPoint,
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
			warnings.push('positionObjectInteraction has no background image');
		} else if (data.imageData.type === 'image' && !data.imageData.src) {
			errors.push('positionObjectInteraction must have an image URL');
		} else if (data.imageData.type === 'svg' && !data.imageData.content) {
			errors.push('positionObjectInteraction must have SVG content');
		}

		// Warn about dimension consistency (cannot verify actual file dimensions at extraction time)
		if (data.imageData && data.imageData.type === 'image') {
			warnings.push(
				'IMPORTANT: Ensure declared width/height match actual image file dimensions. ' +
					'Mismatched dimensions cause coordinate system errors in mapResponsePoint scoring. ' +
					`Declared: ${data.imageData.width || 'unspecified'}×${data.imageData.height || 'unspecified'}`
			);
		}

		// Validate positionObjectStages exist
		if (!data.positionObjectStages || data.positionObjectStages.length === 0) {
			errors.push('positionObjectInteraction must have at least one positionObjectStage');
		}

		// Validate positionObjectStage identifiers
		if (data.positionObjectStages) {
			const identifiers = new Set<string>();
			for (const stage of data.positionObjectStages) {
				if (!stage.identifier) {
					errors.push('All positionObjectStages must have an identifier');
				} else if (identifiers.has(stage.identifier)) {
					errors.push(`Duplicate positionObjectStage identifier: ${stage.identifier}`);
				} else {
					identifiers.add(stage.identifier);
				}
			}
		}

		// Validate maxChoices
		if (data.maxChoices < 0) {
			errors.push('maxChoices must be non-negative');
		}

		// Validate minChoices
		if (data.minChoices < 0) {
			errors.push('minChoices must be non-negative');
		}

		// Validate minChoices <= maxChoices
		if (data.maxChoices > 0 && data.minChoices > data.maxChoices) {
			errors.push('minChoices cannot exceed maxChoices');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
