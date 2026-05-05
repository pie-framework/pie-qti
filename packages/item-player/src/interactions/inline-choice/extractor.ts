/**
 * Standard QTI inlineChoiceInteraction extractor
 *
 * Extracts data from inlineChoiceInteraction elements (dropdown in text)
 */

import type { ElementExtractor } from '../../extraction/types.js';

/**
 * Inline choice data extracted from inlineChoiceInteraction elements
 */
export interface InlineChoiceData {
	choices: Array<{ identifier: string; text: string; fixed?: boolean }>;
	shuffle: boolean;
	/** Text from the QTI <label> child element; used as the placeholder "Select…" option */
	label: string | null;
}

/**
 * Standard QTI inline choice interaction extractor
 * Handles inlineChoiceInteraction elements (dropdown selections within text)
 */
export const standardInlineChoiceExtractor: ElementExtractor<InlineChoiceData> = {
	id: 'qti:inline-choice-interaction',
	name: 'QTI Standard Inline Choice Interaction',
	priority: 10,
	elementTypes: ['inlineChoiceInteraction'],
	description: 'Extracts standard QTI inlineChoiceInteraction (dropdown in text)',

	canHandle(element, _context) {
		// All inlineChoiceInteraction elements are standard
		return element.rawTagName === 'inlineChoiceInteraction' || element.rawTagName === 'qti-inline-choice-interaction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract choices (inlineChoice children)
		const inlineChoices = utils.getChildrenByTag(element, 'inlineChoice');
		const choices = inlineChoices.map((choice) => {
			const fixed = utils.getBooleanAttribute(choice, 'fixed');
			return {
				identifier: utils.getAttribute(choice, 'identifier', ''),
				text: utils.getTextContent(choice),
				...(fixed ? { fixed } : {}),
			};
		});

		// Extract <label> child — used as placeholder text in the dropdown
		const labelElements = utils.getChildrenByTag(element, 'label');
		const label = labelElements.length > 0 ? utils.getTextContent(labelElements[0]) : null;

		// data-prompt: alternative placeholder for the dropdown default option
		const dataPrompt = utils.getAttribute(element, 'data-prompt', '') || null;

		// Extract attributes
		const shuffle = utils.getBooleanAttribute(element, 'shuffle');
		const interactionClasses = utils.getClasses(element);

		return {
			choices,
			shuffle,
			label,
			...(dataPrompt ? { dataPrompt } : {}),
			...(interactionClasses.length > 0 ? { interactionClasses } : {}),
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate choices exist
		if (!data.choices || data.choices.length === 0) {
			errors.push('inlineChoiceInteraction must have at least one choice');
		}

		// Validate choice identifiers
		if (data.choices) {
			const identifiers = new Set<string>();
			for (const choice of data.choices) {
				if (!choice.identifier) {
					errors.push('All choices must have an identifier');
				} else if (identifiers.has(choice.identifier)) {
					errors.push(`Duplicate choice identifier: ${choice.identifier}`);
				} else {
					identifiers.add(choice.identifier);
				}
			}

			// Warn if too many choices
			if (data.choices.length >= 10) {
				warnings.push(
					`inlineChoiceInteraction has ${data.choices.length} choices - consider limiting for better usability`
				);
			}
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
