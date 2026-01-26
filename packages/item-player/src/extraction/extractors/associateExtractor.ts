/**
 * Standard QTI associateInteraction extractor
 *
 * Extracts data from associateInteraction elements (associating items)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Associate data extracted from associateInteraction elements
 */
export interface AssociateData {
	choices: Array<{
		identifier: string;
		text: string;
		matchMax: number;
		matchMin?: number;
		classes?: string[];
	}>;
	shuffle: boolean;
	maxAssociations: number;
	minAssociations?: number;
	prompt: string | null;
}

/**
 * Standard QTI associate interaction extractor
 * Handles associateInteraction elements (creating associations between items)
 */
export const standardAssociateExtractor: ElementExtractor<AssociateData> = {
	id: 'qti:associate-interaction',
	name: 'QTI Standard Associate Interaction',
	priority: 10,
	elementTypes: ['associateInteraction'],
	description: 'Extracts standard QTI associateInteraction (associating items)',

	canHandle(element, context) {
		// All associateInteraction elements with simpleAssociableChoice are standard
		return (
			element.rawTagName === 'associateInteraction' &&
			context.utils.hasChildWithTag(element, 'simpleAssociableChoice')
		);
	},

	extract(element, context) {
		const { utils } = context;

		// Extract simpleAssociableChoice children
		const choiceElements = utils.getChildrenByTag(element, 'simpleAssociableChoice');
		const choices = choiceElements.map((choice) => {
			const classes = utils.getClasses(choice);
			const matchMax = utils.getNumberAttribute(choice, 'matchMax', 1);
			const matchMin = utils.getNumberAttribute(choice, 'matchMin', 0);

			return {
				identifier: utils.getAttribute(choice, 'identifier', ''),
				text: utils.getHtmlContent(choice),
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract attributes with proper defaults
		const shuffle = utils.getBooleanAttribute(element, 'shuffle');
		const maxAssociations = utils.getNumberAttribute(element, 'maxAssociations', 0);
		const minAssociations = utils.getNumberAttribute(element, 'minAssociations', 0);

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			choices,
			shuffle,
			maxAssociations,
			...(minAssociations > 0 ? { minAssociations } : {}),
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];

		// Validate choices exist
		if (!data.choices || data.choices.length < 2) {
			errors.push('associateInteraction must have at least 2 choices');
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

				// Validate matchMax
				if (choice.matchMax < 0) {
					errors.push(`matchMax must be non-negative for choice ${choice.identifier}`);
				}

				// Validate matchMin
				if (choice.matchMin !== undefined && choice.matchMin < 0) {
					errors.push(`matchMin must be non-negative for choice ${choice.identifier}`);
				}
			}
		}

		// Validate maxAssociations
		if (data.maxAssociations < 0) {
			errors.push('maxAssociations must be non-negative');
		}

		// Validate minAssociations
		if (data.minAssociations !== undefined && data.minAssociations < 0) {
			errors.push('minAssociations must be non-negative');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		};
	},
};
