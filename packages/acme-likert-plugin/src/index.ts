/**
 * ACME Likert Scale Plugin
 *
 * A QTI plugin that provides Likert scale choice interactions.
 *
 * @example
 * ```typescript
 * import { Player } from '@pie-qti/qti2-item-player';
 * import { likertScalePlugin } from '@acme/likert-scale-plugin';
 *
 * const player = new Player({
 *   itemXml: qtiXml,
 *   plugins: [likertScalePlugin]
 * });
 * ```
 *
 * @packageDocumentation
 */

export type { LikertChoiceData, LikertInteractionData } from './extractors/index.js';

// Extractor exports (for advanced use)
export { likertChoiceExtractor } from './extractors/index.js';
// Main plugin export
export { likertScalePlugin } from './plugin.js';
// Note: this package currently does not export a renderable web component.
// Rendering is handled by whichever `choiceInteraction` custom element your host app registers.
