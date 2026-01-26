/**
 * Standard QTI endAttemptInteraction extractor
 *
 * Extracts data from endAttemptInteraction elements (end attempt button)
 */

import type { ElementExtractor } from '../types.js';

/**
 * End attempt data extracted from endAttemptInteraction elements
 */
export interface EndAttemptData {
	title?: string;
	countAttempt?: boolean;
	prompt: string | null;
}

/**
 * Standard QTI end attempt interaction extractor
 * Handles endAttemptInteraction elements (button to end the attempt)
 */
export const standardEndAttemptExtractor: ElementExtractor<EndAttemptData> = {
	id: 'qti:end-attempt-interaction',
	name: 'QTI Standard End Attempt Interaction',
	priority: 10,
	elementTypes: ['endAttemptInteraction'],
	description: 'Extracts standard QTI endAttemptInteraction (end attempt button)',

	canHandle(element, _context) {
		// All endAttemptInteraction elements are standard
		return element.rawTagName === 'endAttemptInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract attributes with defaults
		const title = utils.getAttribute(element, 'title', 'End Attempt');
		const countAttempt = element.hasAttribute('countAttempt')
			? utils.getBooleanAttribute(element, 'countAttempt')
			: true;

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			title,
			countAttempt,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate title is not empty
		if (!data.title || data.title.trim() === '') {
			errors.push('endAttemptInteraction must have a title');
		}

		// Warn if countAttempt is false (uncommon usage)
		if (data.countAttempt === false) {
			warnings.push('endAttemptInteraction has countAttempt=false - make sure this is intentional');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
