/**
 * Standard QTI sliderInteraction extractor
 *
 * Extracts data from sliderInteraction elements (slider input)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Slider data extracted from sliderInteraction elements
 */
export interface SliderData {
	lowerBound: number;
	upperBound: number;
	step: number;
	stepLabel?: boolean;
	orientation: string;
	reverse: boolean;
	prompt: string | null;
}

/**
 * Standard QTI slider interaction extractor
 * Handles sliderInteraction elements (slider for numeric input)
 */
export const standardSliderExtractor: ElementExtractor<SliderData> = {
	id: 'qti:slider-interaction',
	name: 'QTI Standard Slider Interaction',
	priority: 10,
	elementTypes: ['sliderInteraction'],
	description: 'Extracts standard QTI sliderInteraction (slider input)',

	canHandle(element, _context) {
		// All sliderInteraction elements are standard
		return element.rawTagName === 'sliderInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract required attributes
		const lowerBound = utils.getNumberAttribute(element, 'lowerBound', 0);
		const upperBound = utils.getNumberAttribute(element, 'upperBound', 100);
		const step = utils.getNumberAttribute(element, 'step', 1);
		const orientation = utils.getAttribute(element, 'orientation', 'horizontal');
		const reverse = utils.getBooleanAttribute(element, 'reverse', false);

		// Extract optional attributes
		const stepLabel = utils.getBooleanAttribute(element, 'stepLabel');

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		return {
			lowerBound,
			upperBound,
			step,
			orientation,
			reverse,
			...(stepLabel ? { stepLabel } : {}),
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate bounds
		if (data.lowerBound >= data.upperBound) {
			errors.push('lowerBound must be less than upperBound');
		}

		// Validate step
		if (data.step <= 0) {
			errors.push('step must be greater than 0');
		}

		// Validate orientation
		if (data.orientation && !['horizontal', 'vertical'].includes(data.orientation)) {
			errors.push('orientation must be "horizontal" or "vertical"');
		}

		// Warn if step is larger than range
		const range = data.upperBound - data.lowerBound;
		if (data.step > range) {
			warnings.push(`step (${data.step}) is larger than the range (${range})`);
		} else if (range % data.step !== 0) {
			// Warn if step doesn't evenly divide range
			warnings.push(
				`step ${data.step} does not evenly divide range ${range} (${data.lowerBound} to ${data.upperBound})`
			);
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
