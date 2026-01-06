/**
 * Standard QTI extendedTextInteraction extractor
 *
 * Extracts data from extendedTextInteraction elements (multi-line text input)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Extended text data extracted from extendedTextInteraction elements
 */
export interface ExtendedTextData {
	expectedLines: number;
	expectedLength: number;
	placeholderText: string;
	format: string;
}

/**
 * Standard QTI extended text interaction extractor
 * Handles extendedTextInteraction elements (multi-line text input)
 */
export const standardExtendedTextExtractor: ElementExtractor<ExtendedTextData> = {
	id: 'qti:extended-text-interaction',
	name: 'QTI Standard Extended Text Interaction',
	priority: 10,
	elementTypes: ['extendedTextInteraction'],
	description: 'Extracts standard QTI extendedTextInteraction (multi-line text input)',

	canHandle(element, _context) {
		// All extendedTextInteraction elements are standard
		return element.rawTagName === 'extendedTextInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract attributes
		const expectedLines = utils.getNumberAttribute(element, 'expectedLines', 3);
		const expectedLength = utils.getNumberAttribute(element, 'expectedLength', 200);
		const placeholderText = utils.getAttribute(element, 'placeholderText', '');
		const format = utils.getAttribute(element, 'format', 'plain');

		return {
			expectedLines,
			expectedLength,
			placeholderText,
			format,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate expectedLines
		if (data.expectedLines < 1) {
			errors.push('expectedLines must be at least 1');
		}

		// Validate expectedLength
		if (data.expectedLength < 1) {
			errors.push('expectedLength must be positive');
		}

		// Validate format
		const validFormats = ['plain', 'preFormatted', 'xhtml'];
		if (!validFormats.includes(data.format)) {
			warnings.push(
				`Unrecognized format "${data.format}" - expected plain, preFormatted, or xhtml`
			);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
