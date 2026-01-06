/**
 * Standard QTI orderInteraction extractor
 *
 * Extracts data from orderInteraction elements (ordering/ranking tasks)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Order data extracted from orderInteraction elements
 */
export interface OrderData {
	choices: Array<{ identifier: string; text: string; fixed?: boolean; classes?: string[] }>;
	shuffle: boolean;
	orientation?: string;
	prompt: string | null;
}

/**
 * Standard QTI order interaction extractor
 * Handles orderInteraction elements with simpleChoice children
 */
export const standardOrderExtractor: ElementExtractor<OrderData> = {
	id: 'qti:order-interaction',
	name: 'QTI Standard Order Interaction',
	priority: 10,
	elementTypes: ['orderInteraction'],
	description: 'Extracts standard QTI orderInteraction (ordering/ranking tasks)',

	canHandle(element, context) {
		// Standard QTI order interactions have simpleChoice children
		return context.utils.hasChildWithTag(element, 'simpleChoice');
	},

	extract(element, context) {
		const { utils } = context;

		// Extract choices
		const simpleChoices = utils.getChildrenByTag(element, 'simpleChoice');
		const choices = simpleChoices.map((choice) => {
			const classes = utils.getClasses(choice);
			const fixed = utils.getBooleanAttribute(choice, 'fixed');

			return {
				identifier: utils.getAttribute(choice, 'identifier', ''),
				text: utils.getHtmlContent(choice),
				...(fixed ? { fixed } : {}),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract prompt
		const promptElement = utils.querySelector(element, 'prompt');
		const prompt = promptElement ? utils.getHtmlContent(promptElement) : null;

		// Extract attributes
		const shuffle = utils.getBooleanAttribute(element, 'shuffle');
		const orientation = utils.getAttribute(element, 'orientation', 'vertical');

		return {
			choices,
			shuffle,
			orientation,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate choices exist
		if (!data.choices || data.choices.length < 2) {
			errors.push('orderInteraction must have at least 2 choices');
		}

		// Warn if too many choices (difficult to order)
		if (data.choices && data.choices.length > 10) {
			warnings.push(
				`orderInteraction has ${data.choices.length} choices - this may be difficult for users to order`
			);
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

		// Validate orientation (only if provided)
		if (data.orientation) {
			const validOrientations = ['vertical', 'horizontal'];
			if (!validOrientations.includes(data.orientation)) {
				warnings.push(
					`orientation '${data.orientation}' is not standard (expected: ${validOrientations.join(', ')})`
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
