/**
 * Standard QTI choiceInteraction extractor
 *
 * Extracts data from choiceInteraction elements with simpleChoice children
 */

import type { ChoiceInteractionData } from '../../types/interactions.js';
import type { ElementExtractor, ExtractionContext } from '../types.js';

/**
 * Choice data extracted from simpleChoice elements
 */
export interface ChoiceData {
	choices: Array<{ identifier: string; text: string; classes?: string[] }>;
	shuffle: boolean;
	maxChoices: number;
	prompt: string | null;
}

/**
 * Standard QTI choice interaction extractor
 * Handles choiceInteraction elements with simpleChoice children
 */
export const standardChoiceExtractor: ElementExtractor<ChoiceData> = {
	id: 'qti:choice-interaction',
	name: 'QTI Standard Choice Interaction',
	priority: 10,
	elementTypes: ['choiceInteraction'],
	description: 'Extracts standard QTI choiceInteraction with simpleChoice elements',

	canHandle(element, context) {
		// Standard QTI choice interactions have simpleChoice children
		return context.utils.hasChildWithTag(element, 'simpleChoice');
	},

	extract(element, context) {
		const { utils } = context;

		// Extract choices
		const simpleChoices = utils.getChildrenByTag(element, 'simpleChoice');
		const choices = simpleChoices.map((choice) => {
			const classes = utils.getClasses(choice);
			return {
				identifier: utils.getAttribute(choice, 'identifier', ''),
				text: utils.getHtmlContent(choice),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract prompt
		const promptElement = utils.querySelector(element, 'prompt');
		const prompt = promptElement ? utils.getHtmlContent(promptElement) : null;

		// Extract attributes
		const shuffle = utils.getBooleanAttribute(element, 'shuffle');
		const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);

		return {
			choices,
			shuffle,
			maxChoices,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate choices exist
		if (!data.choices || data.choices.length === 0) {
			errors.push('choiceInteraction must have at least one choice');
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
		}

		// Validate maxChoices
		if (data.maxChoices < 0) {
			errors.push('maxChoices must be non-negative');
		}

		if (data.maxChoices === 0) {
			warnings.push('maxChoices=0 means unlimited selections');
		}

		if (data.maxChoices > data.choices.length) {
			warnings.push(
				`maxChoices (${data.maxChoices}) is greater than the number of choices (${data.choices.length})`
			);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
