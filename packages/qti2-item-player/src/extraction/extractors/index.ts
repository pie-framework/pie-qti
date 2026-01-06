/**
 * Standard QTI Extractors
 *
 * Exports all standard QTI 2.2 interaction extractors
 */

import type { ElementExtractor } from '../types.js';

// Import extractors
import { standardAssociateExtractor } from './associateExtractor.js';
import { standardChoiceExtractor } from './choiceExtractor.js';
import { standardCustomExtractor } from './customExtractor.js';
import { standardDrawingExtractor } from './drawingExtractor.js';
import { standardEndAttemptExtractor } from './endAttemptExtractor.js';
import { standardExtendedTextExtractor } from './extendedTextExtractor.js';
import { standardGapMatchExtractor } from './gapMatchExtractor.js';
import { standardGraphicAssociateExtractor } from './graphicAssociateExtractor.js';
import { standardGraphicGapMatchExtractor } from './graphicGapMatchExtractor.js';
import { standardGraphicOrderExtractor } from './graphicOrderExtractor.js';
import { standardHotspotExtractor } from './hotspotExtractor.js';
import { standardHottextExtractor } from './hottextExtractor.js';
import { standardInlineChoiceExtractor } from './inlineChoiceExtractor.js';
import { standardMatchExtractor } from './matchExtractor.js';
import { standardMediaExtractor } from './mediaExtractor.js';
import { standardOrderExtractor } from './orderExtractor.js';
import { standardPositionObjectExtractor } from './positionObjectExtractor.js';
import { standardSelectPointExtractor } from './selectPointExtractor.js';
import { standardSliderExtractor } from './sliderExtractor.js';
import { standardTextEntryExtractor } from './textEntryExtractor.js';
import { standardUploadExtractor } from './uploadExtractor.js';

// Re-export types and extractors
export type { AssociateData } from './associateExtractor.js';
export { standardAssociateExtractor } from './associateExtractor.js';
export type { ChoiceData } from './choiceExtractor.js';
export { standardChoiceExtractor } from './choiceExtractor.js';
export type { CustomData } from './customExtractor.js';
export { standardCustomExtractor } from './customExtractor.js';
export type { DrawingData } from './drawingExtractor.js';
export { standardDrawingExtractor } from './drawingExtractor.js';
export type { EndAttemptData } from './endAttemptExtractor.js';
export { standardEndAttemptExtractor } from './endAttemptExtractor.js';
export type { ExtendedTextData } from './extendedTextExtractor.js';
export { standardExtendedTextExtractor } from './extendedTextExtractor.js';
export type { GapMatchData } from './gapMatchExtractor.js';
export { standardGapMatchExtractor } from './gapMatchExtractor.js';
export type { GraphicAssociateData } from './graphicAssociateExtractor.js';
export { standardGraphicAssociateExtractor } from './graphicAssociateExtractor.js';
export type { GraphicGapMatchData } from './graphicGapMatchExtractor.js';
export { standardGraphicGapMatchExtractor } from './graphicGapMatchExtractor.js';
export type { GraphicOrderData } from './graphicOrderExtractor.js';
export { standardGraphicOrderExtractor } from './graphicOrderExtractor.js';
export type { HotspotData } from './hotspotExtractor.js';
export { standardHotspotExtractor } from './hotspotExtractor.js';
export type { HottextData } from './hottextExtractor.js';
export { standardHottextExtractor } from './hottextExtractor.js';
export type { InlineChoiceData } from './inlineChoiceExtractor.js';
export { standardInlineChoiceExtractor } from './inlineChoiceExtractor.js';
export type { MatchData } from './matchExtractor.js';
export { standardMatchExtractor } from './matchExtractor.js';
export type { MediaData } from './mediaExtractor.js';
export { standardMediaExtractor } from './mediaExtractor.js';
export type { OrderData } from './orderExtractor.js';
export { standardOrderExtractor } from './orderExtractor.js';
export type { PositionObjectData } from './positionObjectExtractor.js';
export { standardPositionObjectExtractor } from './positionObjectExtractor.js';
export type { SelectPointData } from './selectPointExtractor.js';
export { standardSelectPointExtractor } from './selectPointExtractor.js';
export type { SliderData } from './sliderExtractor.js';
export { standardSliderExtractor } from './sliderExtractor.js';
export type { TextEntryData } from './textEntryExtractor.js';
export { standardTextEntryExtractor } from './textEntryExtractor.js';
export type { UploadData } from './uploadExtractor.js';
export { standardUploadExtractor } from './uploadExtractor.js';

/**
 * All standard QTI extractors
 * Register these with ExtractionRegistry to enable standard QTI support
 *
 * @example
 * import { ALL_STANDARD_EXTRACTORS } from '@pie-qti/qti2-item-player';
 *
 * const registry = new ExtractionRegistry();
 * for (const extractor of ALL_STANDARD_EXTRACTORS) {
 *   registry.register(extractor);
 * }
 */
export const ALL_STANDARD_EXTRACTORS: ElementExtractor[] = [
	// All 21 standard QTI 2.2 interaction extractors (Phase 2 - Complete)
	standardChoiceExtractor,
	standardTextEntryExtractor,
	standardExtendedTextExtractor,
	standardInlineChoiceExtractor,
	standardOrderExtractor,
	standardMatchExtractor,
	standardAssociateExtractor,
	standardGapMatchExtractor,
	standardSliderExtractor,
	standardHotspotExtractor,
	standardGraphicGapMatchExtractor,
	standardUploadExtractor,
	standardDrawingExtractor,
	standardCustomExtractor,
	standardMediaExtractor,
	standardHottextExtractor,
	standardSelectPointExtractor,
	standardGraphicOrderExtractor,
	standardGraphicAssociateExtractor,
	standardPositionObjectExtractor,
	standardEndAttemptExtractor,
];
