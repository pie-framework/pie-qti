/**
 * Standard QTI customInteraction extractor
 *
 * Extracts data from customInteraction elements (custom/portable interactions)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Custom interaction data extracted from customInteraction elements
 */
export interface CustomData {
	xml: string;
	rawAttributes: Record<string, string>;
	prompt: string | null;
}

/**
 * Standard QTI custom interaction extractor
 * Handles customInteraction elements (vendor-specific or portable custom interactions)
 */
export const standardCustomExtractor: ElementExtractor<CustomData> = {
	id: 'qti:custom-interaction',
	name: 'QTI Standard Custom Interaction',
	priority: 10,
	elementTypes: ['customInteraction'],
	description: 'Extracts standard QTI customInteraction (custom/portable interactions)',

	canHandle(element, _context) {
		// All customInteraction elements are handled by this extractor
		return element.rawTagName === 'customInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Capture the raw XML for the custom interaction
		const xml = element.outerHTML || element.toString();

		// Extract all attributes
		const rawAttributes: Record<string, string> = {};
		if (element.attributes) {
			for (const [key, value] of Object.entries(element.attributes)) {
				rawAttributes[key] = String(value);
			}
		}

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			xml,
			rawAttributes,
			prompt,
		};
	},

	validate(_data) {
		const warnings: string[] = [];

		// Warn if no XML content
		if (!_data.xml || _data.xml.trim() === '') {
			warnings.push('customInteraction has no XML content');
		}

		return {
			valid: true,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
