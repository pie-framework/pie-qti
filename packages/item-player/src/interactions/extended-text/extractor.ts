/**
 * Standard QTI extendedTextInteraction extractor
 *
 * Extracts data from extendedTextInteraction elements (multi-line text input)
 */

import type { ElementExtractor } from '../../extraction/types.js';

/**
 * Extended text data extracted from extendedTextInteraction elements
 */
export interface ExtendedTextData {
	cardinality: 'single' | 'multiple' | 'ordered' | 'record';
	baseType?: string;
	base: number;
	stringIdentifier?: string;
	minStrings: number;
	maxStrings: number;
	expectedLines: number;
	/**
	 * The authored expected length, absent when not authored. A hint with no default in QTI 2.1
	 * (`xs:int`, optional), 2.2 (`xs:nonNegativeInteger`, optional) or 3.0, and not a limit; the
	 * `qti-counter-up`/`qti-counter-down` counters count against it, so none is invented.
	 */
	expectedLength?: number;
	prompt: string | null;
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
		// All extendedTextInteraction elements are standard (both QTI 2.x and 3.0)
		return (
			element.rawTagName === 'extendedTextInteraction' ||
			element.rawTagName === 'qti-extended-text-interaction'
		);
	},

	extract(element, context) {
		const { utils } = context;
		const declaration = context.declarations.get(context.responseId);

		// Extract attributes
		const cardinality = declaration?.cardinality ?? 'single';
		const base = utils.getNumberAttribute(element, 'base', 10);
		const stringIdentifier = utils.getAttribute(element, 'stringIdentifier', '') || undefined;
		const minStrings = utils.getNumberAttribute(element, 'minStrings', 0);
		const maxStrings = utils.getNumberAttribute(
			element,
			'maxStrings',
			cardinality === 'single' || cardinality === 'record' ? 1 : 0,
		);
		const expectedLines = utils.getNumberAttribute(element, 'expectedLines', 3);
		// A hint with no spec default: absent stays absent.
		const authoredExpectedLength = utils.getAttribute(element, 'expectedLength', '');
		const expectedLength = authoredExpectedLength ? Number(authoredExpectedLength) : undefined;
		const placeholderText = utils.getAttribute(element, 'placeholderText', '');
		const format = utils.getAttribute(element, 'format', 'plain');
		const patternMask = utils.getAttribute(element, 'patternMask', '') || null;
		// QTI 3.0 §5.48.4: the author's message for a response that does not match the mask is
		// the `data-patternmask-message` attribute (QTI 2.x has no equivalent; data-* names are
		// not renamed between versions), read as the text entry extractor reads it.
		const patternMaskMessage = utils.getAttribute(element, 'data-patternmask-message', '') || null;
		const interactionClasses = utils.getClasses(element);
		const prompt = utils.getPrompt(element);

		return {
			cardinality,
			baseType: declaration?.baseType,
			base,
			...(stringIdentifier ? { stringIdentifier } : {}),
			minStrings,
			maxStrings,
			expectedLines,
			...(expectedLength !== undefined ? { expectedLength } : {}),
			prompt,
			placeholderText,
			format,
			...(patternMask ? { patternMask } : {}),
			...(patternMaskMessage ? { patternMaskMessage } : {}),
			...(interactionClasses.length > 0 ? { interactionClasses } : {}),
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];
		if (data.cardinality === 'record') {
			if (data.baseType) errors.push('record cardinality must not declare a baseType');
			if (data.minStrings > 1 || data.maxStrings > 1) {
				errors.push('record cardinality captures exactly one numeric string');
			}
		} else if (!['string', 'integer', 'float'].includes(data.baseType ?? '')) {
			errors.push('extendedTextInteraction baseType must be string, integer, or float');
		}
		if (!Number.isInteger(data.base) || data.base < 2 || data.base > 36) {
			errors.push('base must be an integer from 2 through 36');
		}
		if (!Number.isInteger(data.minStrings) || data.minStrings < 0) {
			errors.push('minStrings must be a non-negative integer');
		}
		if (!Number.isInteger(data.maxStrings) || data.maxStrings < 0) {
			errors.push('maxStrings must be a non-negative integer');
		}
		if (data.maxStrings > 0 && data.minStrings > data.maxStrings) {
			errors.push('minStrings must not exceed maxStrings');
		}

		// Validate expectedLines
		if (!Number.isInteger(data.expectedLines) || data.expectedLines < 0) {
			errors.push('expectedLines must be a non-negative integer');
		}

		// Validate expectedLength, when authored
		if (data.expectedLength !== undefined && (!Number.isInteger(data.expectedLength) || data.expectedLength < 0)) {
			errors.push('expectedLength must be a non-negative integer');
		}

		// Validate format
		const validFormats = ['plain', 'preFormatted', 'preformatted', 'xhtml'];
		if (!validFormats.includes(data.format)) {
			warnings.push(
				`Unrecognized format "${data.format}" - expected plain, preformatted, preFormatted, or xhtml`
			);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
