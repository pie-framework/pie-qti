/**
 * ACME Likert Scale Plugin
 *
 * Provides Likert scale choice interactions for QTI assessments.
 */

import type { AssessmentItemDefinitionPlugin, ExtractionRegistry } from '@pie-qti/item-player';
import { likertChoiceExtractor } from './extractors/index.js';

export const likertScalePlugin: AssessmentItemDefinitionPlugin = {
	kind: 'assessment-item-definition-plugin',
	name: '@acme/likert-scale-plugin',
	version: '1.0.0',
	description: 'Likert scale choice interactions for QTI assessments',

	/**
	 * Register the Likert choice extractor
	 */
	registerExtractors(registry: ExtractionRegistry) {
		registry.register(likertChoiceExtractor);
	},
};
