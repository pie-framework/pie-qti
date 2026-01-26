/**
 * Standard QTI matchInteraction extractor
 *
 * Extracts data from matchInteraction elements (matching pairs)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Match data extracted from matchInteraction elements
 */
export interface MatchData {
	sourceSet: Array<{ identifier: string; text: string; matchMax: number; classes?: string[] }>;
	targetSet: Array<{ identifier: string; text: string; matchMax: number; classes?: string[] }>;
	shuffle: boolean;
	maxAssociations: number;
	prompt: string | null;
}

/**
 * Standard QTI match interaction extractor
 * Handles matchInteraction elements (matching pairs between two sets)
 */
export const standardMatchExtractor: ElementExtractor<MatchData> = {
	id: 'qti:match-interaction',
	name: 'QTI Standard Match Interaction',
	priority: 10,
	elementTypes: ['matchInteraction'],
	description: 'Extracts standard QTI matchInteraction (matching pairs)',

	canHandle(element, _context) {
		// All matchInteraction elements are standard
		return element.rawTagName === 'matchInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract all simpleAssociableChoice children
		const allChoices = utils.getChildrenByTag(element, 'simpleAssociableChoice');

		// Determine which are source vs target based on matchSet structure
		// In QTI, matchInteraction can have two simpleMatchSet elements
		const matchSets = utils.getChildrenByTag(element, 'simpleMatchSet');

		let sourceSet: Array<{ identifier: string; text: string; matchMax: number; classes?: string[] }> = [];
		let targetSet: Array<{ identifier: string; text: string; matchMax: number; classes?: string[] }> = [];

		if (matchSets.length >= 2) {
			// Extract choices from first matchSet (source)
			const sourceMatchSet = matchSets[0];
			const sourceElements = utils.getChildrenByTag(sourceMatchSet, 'simpleAssociableChoice');
			sourceSet = sourceElements.map((choice) => {
				const classes = utils.getClasses(choice);
				const matchMax = utils.getNumberAttribute(choice, 'matchMax', 1);
				return {
					identifier: utils.getAttribute(choice, 'identifier', ''),
					text: utils.getHtmlContent(choice),
					matchMax,
					...(classes.length > 0 ? { classes } : {}),
				};
			});

			// Extract choices from second matchSet (target)
			const targetMatchSet = matchSets[1];
			const targetElements = utils.getChildrenByTag(targetMatchSet, 'simpleAssociableChoice');
			targetSet = targetElements.map((choice) => {
				const classes = utils.getClasses(choice);
				const matchMax = utils.getNumberAttribute(choice, 'matchMax', 1);
				return {
					identifier: utils.getAttribute(choice, 'identifier', ''),
					text: utils.getHtmlContent(choice),
					matchMax,
					...(classes.length > 0 ? { classes } : {}),
				};
			});
		} else {
			// Fallback: treat all choices as both source and target
			const extractedChoices = allChoices.map((choice) => {
				const classes = utils.getClasses(choice);
				const matchMax = utils.getNumberAttribute(choice, 'matchMax', 1);
				return {
					identifier: utils.getAttribute(choice, 'identifier', ''),
					text: utils.getHtmlContent(choice),
					matchMax,
					...(classes.length > 0 ? { classes } : {}),
				};
			});
			sourceSet = extractedChoices;
			targetSet = extractedChoices;
		}

		// Extract attributes
		const shuffle = utils.getBooleanAttribute(element, 'shuffle');
		const maxAssociations = utils.getNumberAttribute(element, 'maxAssociations', 1);

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			sourceSet,
			targetSet,
			shuffle,
			maxAssociations,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];

		// Validate source choices exist
		if (!data.sourceSet || data.sourceSet.length === 0) {
			errors.push('matchInteraction must have at least one source choice');
		}

		// Validate target choices exist
		if (!data.targetSet || data.targetSet.length === 0) {
			errors.push('matchInteraction must have at least one target choice');
		}

		// Validate choice identifiers
		if (data.sourceSet) {
			const identifiers = new Set<string>();
			for (const choice of data.sourceSet) {
				if (!choice.identifier) {
					errors.push('All source choices must have an identifier');
				} else if (identifiers.has(choice.identifier)) {
					errors.push(`Duplicate source identifier: ${choice.identifier}`);
				} else {
					identifiers.add(choice.identifier);
				}
			}
		}

		if (data.targetSet) {
			const identifiers = new Set<string>();
			for (const choice of data.targetSet) {
				if (!choice.identifier) {
					errors.push('All target choices must have an identifier');
				} else if (identifiers.has(choice.identifier)) {
					errors.push(`Duplicate target identifier: ${choice.identifier}`);
				} else {
					identifiers.add(choice.identifier);
				}
			}
		}

		// Validate maxAssociations
		if (data.maxAssociations < 0) {
			errors.push('maxAssociations must be non-negative');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		};
	},
};
