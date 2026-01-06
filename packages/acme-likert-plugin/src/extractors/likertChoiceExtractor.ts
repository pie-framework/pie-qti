/**
 * Likert Choice Extractor
 *
 * Extracts Likert scale choices from custom <likertChoice> elements
 * within choiceInteraction elements.
 */

import type {
	ElementExtractor,
	ExtractionContext,
	ValidationResult,
} from '@pie-qti/qti2-item-player';

export interface LikertChoiceData {
	identifier: string;
	text: string;
	classes: string[];
	fixed: boolean;
	metadata: {
		likertIndex: number;
		scalePoints: number;
		scaleType: 'agreement' | 'frequency' | 'satisfaction' | 'quality' | 'importance' | 'likelihood' | 'unknown';
	};
}

export interface LikertInteractionData {
	choices: LikertChoiceData[];
	shuffle: boolean;
	maxChoices: number;
	prompt: string | null;
	metadata: {
		isLikert: true;
		scalePoints: number;
		scaleType: string;
	};
}

/**
 * Detect the scale type based on choice text patterns
 */
function detectScaleType(choices: LikertChoiceData[]): string {
	const allText = choices.map((c) => c.text.toLowerCase()).join(' ');

	// Agreement scale (most common)
	if (
		allText.includes('agree') ||
		allText.includes('disagree') ||
		allText.includes('strongly')
	) {
		return 'agreement';
	}

	// Frequency scale
	if (
		allText.includes('always') ||
		allText.includes('never') ||
		allText.includes('sometimes') ||
		allText.includes('often') ||
		allText.includes('rarely')
	) {
		return 'frequency';
	}

	// Satisfaction scale
	if (
		allText.includes('satisfied') ||
		allText.includes('dissatisfied') ||
		allText.includes('happy') ||
		allText.includes('unhappy')
	) {
		return 'satisfaction';
	}

	// Quality scale
	if (
		allText.includes('excellent') ||
		allText.includes('poor') ||
		allText.includes('good') ||
		allText.includes('fair')
	) {
		return 'quality';
	}

	// Importance scale
	if (
		allText.includes('important') ||
		allText.includes('unimportant') ||
		allText.includes('critical') ||
		allText.includes('trivial')
	) {
		return 'importance';
	}

	// Likelihood scale
	if (
		allText.includes('likely') ||
		allText.includes('unlikely') ||
		allText.includes('probable') ||
		allText.includes('improbable')
	) {
		return 'likelihood';
	}

	return 'unknown';
}

/**
 * Get default label for a Likert choice based on index and scale size
 */
function getDefaultLabel(identifier: string, index: number, scalePoints: number): string {
	// 5-point agreement scale (most common)
	if (scalePoints === 5) {
		const labels = [
			'Strongly Disagree',
			'Disagree',
			'Neutral',
			'Agree',
			'Strongly Agree',
		];
		return labels[index] || identifier;
	}

	// 7-point agreement scale
	if (scalePoints === 7) {
		const labels = [
			'Strongly Disagree',
			'Disagree',
			'Somewhat Disagree',
			'Neutral',
			'Somewhat Agree',
			'Agree',
			'Strongly Agree',
		];
		return labels[index] || identifier;
	}

	// 3-point scale
	if (scalePoints === 3) {
		const labels = ['Disagree', 'Neutral', 'Agree'];
		return labels[index] || identifier;
	}

	// 4-point scale (no neutral)
	if (scalePoints === 4) {
		const labels = ['Strongly Disagree', 'Disagree', 'Agree', 'Strongly Agree'];
		return labels[index] || identifier;
	}

	// Fallback: use identifier
	return identifier;
}

/**
 * Likert Choice Extractor
 *
 * Priority 500 - Higher than standard choice extractor (10)
 * Handles <likertChoice> elements in choiceInteraction
 */
export const likertChoiceExtractor: ElementExtractor<LikertInteractionData> = {
	id: 'acme:likert-choice',
	name: 'ACME Likert Scale Choice',
	priority: 500,
	elementTypes: ['choiceInteraction'],

	canHandle(element, context) {
		// Check if interaction contains <likertChoice> children
		return context.utils.hasChildWithTag(element, 'likertChoice');
	},

	extract(element, context) {
		// Extract all likertChoice elements
		const likertChoices = context.utils.getChildrenByTag(element, 'likertChoice');

		const choices: LikertChoiceData[] = likertChoices.map((choice, index) => {
			const identifier = context.utils.getAttribute(choice, 'identifier', '');
			let text = context.utils.getTextContent(choice);

			// Use default label if empty
			if (!text || text.trim() === '') {
				text = getDefaultLabel(identifier, index, likertChoices.length);
			}

			return {
				identifier,
				text,
				classes: ['likert-choice'],
				fixed: true, // Likert choices should never shuffle
				metadata: {
					likertIndex: index,
					scalePoints: likertChoices.length,
					scaleType: 'unknown', // Will be set after all choices are extracted
				},
			};
		});

		// Detect scale type from all choice texts
		const scaleType = detectScaleType(choices);

		// Update metadata with detected scale type
		for (const choice of choices) {
			choice.metadata.scaleType = scaleType as any;
		}

		// Extract prompt
		const promptChildren = context.utils.getChildrenByTag(element, 'prompt');
		const prompt = promptChildren.length > 0
			? context.utils.getHtmlContent(promptChildren[0])
			: null;

		return {
			choices,
			shuffle: false, // Likert scales should never shuffle
			maxChoices: 1, // Single selection only
			prompt,
			metadata: {
				isLikert: true,
				scalePoints: choices.length,
				scaleType,
			},
		};
	},

	validate(data) {
		const errors: string[] = [];

		// Validate scale size (2-7 points typical)
		if (data.choices.length < 2) {
			errors.push('Likert scale must have at least 2 choices');
		}
		if (data.choices.length > 7) {
			errors.push('Likert scale should have at most 7 choices (got ' + data.choices.length + ')');
		}

		// Validate shuffle is false
		if (data.shuffle) {
			errors.push('Likert scales should not shuffle choices');
		}

		// Validate maxChoices is 1
		if (data.maxChoices !== 1) {
			errors.push('Likert scales should have maxChoices=1 (single selection)');
		}

		// Validate all choices have identifiers
		for (let i = 0; i < data.choices.length; i++) {
			if (!data.choices[i].identifier) {
				errors.push(`Choice at index ${i} is missing an identifier`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	},
};
