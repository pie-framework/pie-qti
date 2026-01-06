/**
 * Plugin-based element extraction system
 *
 * Provides a pluggable architecture for extracting data from QTI XML elements
 * with priority-based dispatch, validation, and type safety.
 *
 * @example Basic usage
 * ```typescript
 * import { ExtractionRegistry, createExtractionContext } from '@pie-qti/qti2-item-player';
 *
 * const registry = new ExtractionRegistry();
 * registry.register(myExtractor);
 *
 * const context = createExtractionContext(element, 'RESPONSE', dom, declarations, config);
 * const result = registry.extract<MyData>(element, context);
 *
 * if (result.success) {
 *   console.log('Extracted:', result.data);
 * }
 * ```
 *
 * @example Custom extractor
 * ```typescript
 * const myExtractor: ElementExtractor<ChoiceData> = {
 *   id: 'custom:my-choice',
 *   name: 'My Custom Choice',
 *   priority: 100,
 *   elementTypes: ['choiceInteraction'],
 *   canHandle: (element, context) => {
 *     return context.utils.hasChildWithTag(element, 'customChoice');
 *   },
 *   extract: (element, context) => {
 *     return {
 *       choices: [...],
 *       shuffle: false,
 *       maxChoices: 1
 *     };
 *   }
 * };
 * ```
 */

export { createExtractionContext } from './createContext.js';
// Registry
export { createExtractionRegistry, ExtractionRegistry } from './ExtractionRegistry.js';

// Standard extractor data types (all 21 extractors)
export type {
	AssociateData,
	ChoiceData,
	CustomData,
	DrawingData,
	EndAttemptData,
	ExtendedTextData,
	GapMatchData,
	GraphicAssociateData,
	GraphicGapMatchData,
	GraphicOrderData,
	HotspotData,
	HottextData,
	InlineChoiceData,
	MatchData,
	MediaData,
	OrderData,
	PositionObjectData,
	SelectPointData,
	SliderData,
	TextEntryData,
	UploadData,
} from './extractors/index.js';

// Standard extractors (all 21 extractors)
export {
	ALL_STANDARD_EXTRACTORS,
	standardAssociateExtractor,
	standardChoiceExtractor,
	standardCustomExtractor,
	standardDrawingExtractor,
	standardEndAttemptExtractor,
	standardExtendedTextExtractor,
	standardGapMatchExtractor,
	standardGraphicAssociateExtractor,
	standardGraphicGapMatchExtractor,
	standardGraphicOrderExtractor,
	standardHotspotExtractor,
	standardHottextExtractor,
	standardInlineChoiceExtractor,
	standardMatchExtractor,
	standardMediaExtractor,
	standardOrderExtractor,
	standardPositionObjectExtractor,
	standardSelectPointExtractor,
	standardSliderExtractor,
	standardTextEntryExtractor,
	standardUploadExtractor,
} from './extractors/index.js';

// Core types
export type {
	ElementExtractor,
	ExtractionContext,
	ExtractionResult,
	ExtractionUtils,
	ValidationResult,
	VariableDeclaration,
} from './types.js';
export { ExtractionError, isErrorResult, isSuccessResult } from './types.js';
// Utilities
export { createExtractionUtils } from './utils.js';
