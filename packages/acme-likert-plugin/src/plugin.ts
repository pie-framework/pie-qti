/**
 * ACME Likert Scale Plugin
 *
 * Provides Likert scale choice interactions for QTI assessments.
 */

import type { ExtractionRegistry, PluginContext, QTIPlugin, RenderContext } from '@pie-qti/qti2-item-player';
import { likertChoiceExtractor } from './extractors/index.js';

export const likertScalePlugin: QTIPlugin = {
	name: '@acme/likert-scale-plugin',
	version: '1.0.0',
	description: 'Likert scale choice interactions for QTI assessments',

	/**
	 * Register the Likert choice extractor
	 */
	registerExtractors(registry: ExtractionRegistry) {
		registry.register(likertChoiceExtractor);
	},

	lifecycle: {
		onRegister(_context: PluginContext) {
			console.log('[ACME Likert Plugin] Registered successfully');
			console.log('[ACME Likert Plugin] Likert choice extractor available with priority 500');
		},

		onBeforeRender(context: RenderContext) {
			// Optional: Log when rendering starts with Likert interactions
			const dom = context.dom;
			if (dom) {
				const likertChoices =
					typeof dom.querySelectorAll === 'function'
						? dom.querySelectorAll('likertChoice')
						: [];
				if (likertChoices.length > 0) {
					console.log(`[ACME Likert Plugin] Rendering ${likertChoices.length} likert choices`);
				}
			}
		},
	},
};
