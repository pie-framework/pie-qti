/**
 * Standard QTI hottextInteraction extractor
 *
 * Extracts data from hottextInteraction elements (select text spans)
 */

import { sanitizeHtml } from '../../core/sanitizer.js';
import type { QTIElement } from '../../types/interactions.js';
import type { ElementExtractor } from '../types.js';

/**
 * Hottext data extracted from hottextInteraction elements
 */
export interface HottextData {
	hottextChoices: Array<{ identifier: string; text: string; classes?: string[] }>;
	contentHtml: string;
	maxChoices: number;
	minChoices?: number;
	prompt: string | null;
}

/**
 * Standard QTI hottext interaction extractor
 * Handles hottextInteraction elements (selectable text spans)
 */
export const standardHottextExtractor: ElementExtractor<HottextData> = {
	id: 'qti:hottext-interaction',
	name: 'QTI Standard Hottext Interaction',
	priority: 10,
	elementTypes: ['hottextInteraction'],
	description: 'Extracts standard QTI hottextInteraction (select text spans)',

	canHandle(element, _context) {
		// All hottextInteraction elements are standard
		return element.rawTagName === 'hottextInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract hottext children (selectable text spans) - recursively search entire tree
		const findHottextElements = (el: any): any[] => {
			const results: any[] = [];
			if (el.rawTagName === 'hottext') {
				results.push(el);
			}
			if (el.childNodes) {
				for (const child of el.childNodes) {
					if (typeof child !== 'string') {
						results.push(...findHottextElements(child));
					}
				}
			}
			return results;
		};

		const hottextElements = findHottextElements(element);
		const hottextChoices = hottextElements.map((hottext) => {
			const classes = utils.getClasses(hottext);
			return {
				identifier: utils.getAttribute(hottext, 'identifier', ''),
				text: utils.getTextContent(hottext),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract attributes
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);
		const minChoices = utils.getNumberAttribute(element, 'minChoices', 0);

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		// Extract content HTML (all content except prompt)
		let contentHtml = '';
		for (const child of element.childNodes) {
			// Skip prompt elements
			if (typeof child !== 'string' && (child as QTIElement).rawTagName !== 'prompt') {
				contentHtml += (child as QTIElement).outerHTML || child.toString();
			} else if (typeof child === 'string') {
				contentHtml += child;
			}
		}

		// Sanitize extracted HTML before rendering via {@html} in the component.
		contentHtml = sanitizeHtml(contentHtml, { security: context.config.security });

		return {
			hottextChoices,
			contentHtml,
			maxChoices,
			...(minChoices > 0 ? { minChoices } : {}),
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate hottextChoices exist
		if (!data.hottextChoices || data.hottextChoices.length === 0) {
			errors.push('hottextInteraction must have at least one hottext');
		}

		// Validate hottext identifiers
		if (data.hottextChoices) {
			const identifiers = new Set<string>();
			for (const hottext of data.hottextChoices) {
				if (!hottext.identifier) {
					errors.push('All hottext elements must have an identifier');
				} else if (identifiers.has(hottext.identifier)) {
					errors.push(`Duplicate hottext identifier: ${hottext.identifier}`);
				} else {
					identifiers.add(hottext.identifier);
				}
			}
		}

		// Validate maxChoices
		if (data.maxChoices < 0) {
			errors.push('maxChoices must be non-negative');
		}

		// Warn if maxChoices exceeds hottext count
		if (data.hottextChoices && data.maxChoices > data.hottextChoices.length) {
			warnings.push(
				`maxChoices (${data.maxChoices}) exceeds the number of hottext choices (${data.hottextChoices.length})`
			);
		}

		// Validate minChoices
		if (data.minChoices !== undefined && data.minChoices < 0) {
			errors.push('minChoices must be non-negative');
		}

		// Validate minChoices <= maxChoices
		if (
			data.minChoices !== undefined &&
			data.maxChoices > 0 &&
			data.minChoices > data.maxChoices
		) {
			errors.push('minChoices cannot exceed maxChoices');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
