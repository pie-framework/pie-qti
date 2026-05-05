/**
 * Standard QTI textEntryInteraction extractor
 *
 * Extracts data from textEntryInteraction elements (inline text input)
 */

import type { ElementExtractor } from '../../extraction/types.js';

/**
 * Text entry data extracted from textEntryInteraction elements
 */
export interface TextEntryData {
	expectedLength: number;
	patternMask: string | null;
	placeholderText: string;
	format?: string;
}

/**
 * Standard QTI text entry interaction extractor
 * Handles textEntryInteraction elements (inline text input)
 */
export const standardTextEntryExtractor: ElementExtractor<TextEntryData> = {
	id: 'qti:text-entry-interaction',
	name: 'QTI Standard Text Entry Interaction',
	priority: 10,
	elementTypes: ['textEntryInteraction'],
	description: 'Extracts standard QTI textEntryInteraction (inline text input)',

	canHandle(element, _context) {
		// All textEntryInteraction elements are standard (both QTI 2.x and 3.0)
		return (
			element.rawTagName === 'textEntryInteraction' || element.rawTagName === 'qti-text-entry-interaction'
		);
	},

	extract(element, context) {
		const { utils } = context;

		// Extract attributes
		const expectedLength = utils.getNumberAttribute(element, 'expectedLength', 20);
		const patternMask = utils.getAttribute(element, 'patternMask', '');
		const placeholderText = utils.getAttribute(element, 'placeholderText', '');
		const format = utils.getAttribute(element, 'format', '');
		const interactionClasses = utils.getClasses(element);
		const patternMaskMessage = utils.getAttribute(element, 'data-patternmask-message', '') || null;

		return {
			expectedLength,
			patternMask: patternMask || null,
			placeholderText,
			...(format ? { format } : {}),
			...(interactionClasses.length > 0 ? { interactionClasses } : {}),
			...(patternMaskMessage ? { patternMaskMessage } : {}),
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate expectedLength
		if (data.expectedLength < 1) {
			errors.push('expectedLength must be positive');
		}

		if (data.expectedLength > 1000) {
			warnings.push(
				`expectedLength (${data.expectedLength}) is very large - consider using extendedTextInteraction`
			);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
