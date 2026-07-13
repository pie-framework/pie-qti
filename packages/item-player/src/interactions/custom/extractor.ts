/**
 * Standard QTI customInteraction extractor
 *
 * Extracts data from customInteraction elements (custom/portable interactions)
 */

import type { ElementExtractor } from '../../extraction/types.js';

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
		const tag = element.rawTagName?.toLowerCase() ?? '';
		if (tag !== 'custominteraction' && tag !== 'qti-custom-interaction') return false;

		// A QTI 2.x customInteraction containing a namespaced PCI payload is handled
		// by portableCustomExtractor. All other custom interactions keep this fallback.
		return !containsPortableCustomInteraction(element);
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

function containsPortableCustomInteraction(element: Parameters<typeof standardCustomExtractor.canHandle>[0]): boolean {
	const visit = (parent: typeof element): boolean => {
		for (const child of parent.childNodes ?? []) {
			const candidate = child as typeof element;
			const rawTag = candidate.rawTagName?.toLowerCase() ?? '';
			const localTag = rawTag.includes(':') ? rawTag.slice(rawTag.lastIndexOf(':') + 1) : rawTag;
			if (localTag === 'portablecustominteraction' || localTag === 'qti-portable-custom-interaction') {
				return true;
			}
			if (candidate.rawTagName && visit(candidate)) return true;
		}
		return false;
	};
	return visit(element);
}
