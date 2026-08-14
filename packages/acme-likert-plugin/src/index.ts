/**
 * ACME Likert Scale Plugin
 *
 * A QTI plugin that provides Likert scale choice interactions.
 *
 * @example
 * ```typescript
 * import { createAssessmentItemDefinition } from '@pie-qti/item-player';
 * import { likertScalePlugin } from '@acme/likert-scale-plugin';
 *
 * const definition = createAssessmentItemDefinition({
 *   itemXml: qtiXml,
 *   plugins: [likertScalePlugin]
 * });
 * const session = definition.openSession();
 * ```
 *
 * @packageDocumentation
 */

export type {
	LikertChoiceData,
	LikertInteractionData,
	LikertInteractionPayload,
	LikertScaleType,
} from './extractors/index.js';

// Extractor exports (for advanced use)
export { likertChoiceExtractor } from './extractors/index.js';
// Main plugin export
export { likertScalePlugin } from './plugin.js';
// Note: this package currently does not export a renderable web component.
// Rendering is handled by whichever `choiceInteraction` custom element your host app registers.
