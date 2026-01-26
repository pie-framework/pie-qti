/**
 * Standard QTI textEntryInteraction extractor
 *
 * Extracts data from textEntryInteraction elements (inline text input)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Text entry data extracted from textEntryInteraction elements
 */
export interface TextEntryData {
	expectedLength: number;
	patternMask: string | null;
	placeholderText: string;
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
		// All textEntryInteraction elements are standard
		return element.rawTagName === 'textEntryInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract attributes
		const expectedLength = utils.getNumberAttribute(element, 'expectedLength', 20);
		const patternMask = utils.getAttribute(element, 'patternMask', '');
		const placeholderText = utils.getAttribute(element, 'placeholderText', '');

		return {
			expectedLength,
			patternMask: patternMask || null,
			placeholderText,
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
