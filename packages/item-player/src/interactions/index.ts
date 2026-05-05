/**
 * Vertical QTI interaction modules.
 *
 * Each interaction folder owns the extractor entrypoint and interaction-specific
 * type exports. Legacy extractor and type paths re-export from this module layer.
 */

import type { ElementExtractor } from '../extraction/types.js';

export type {
	AssociableChoice,
	AssociableHotspot,
	BaseInteractionData,
	GraphicAssociateHotspot,
	GraphicOrderChoice,
	HotspotChoice,
	ImageData,
	MediaElement,
	Point,
	PositionObjectStage,
	QTIElement,
} from './shared/index.js';

export * from './associate/index.js';
export * from './choice/index.js';
export * from './custom/index.js';
export * from './drawing/index.js';
export * from './end-attempt/index.js';
export * from './extended-text/index.js';
export * from './gap-match/index.js';
export * from './graphic-associate/index.js';
export * from './graphic-gap-match/index.js';
export * from './graphic-order/index.js';
export * from './hotspot/index.js';
export * from './hottext/index.js';
export * from './inline/index.js';
export * from './inline-choice/index.js';
export * from './match/index.js';
export * from './media/index.js';
export * from './order/index.js';
export * from './portable-custom/index.js';
export * from './position-object/index.js';
export * from './select-point/index.js';
export * from './slider/index.js';
export * from './text-entry/index.js';
export * from './upload/index.js';

export type {
	InteractionData,
	InteractionDataMap,
	InteractionType,
	InteractionValueMap,
} from './shared/types.js';

import { standardAssociateExtractor } from './associate/index.js';
import { standardChoiceExtractor } from './choice/index.js';
import { standardCustomExtractor } from './custom/index.js';
import { standardDrawingExtractor } from './drawing/index.js';
import { standardEndAttemptExtractor } from './end-attempt/index.js';
import { standardExtendedTextExtractor } from './extended-text/index.js';
import { standardGapMatchExtractor } from './gap-match/index.js';
import { standardGraphicAssociateExtractor } from './graphic-associate/index.js';
import { standardGraphicGapMatchExtractor } from './graphic-gap-match/index.js';
import { standardGraphicOrderExtractor } from './graphic-order/index.js';
import { standardHotspotExtractor } from './hotspot/index.js';
import { standardHottextExtractor } from './hottext/index.js';
import { standardInlineChoiceExtractor } from './inline-choice/index.js';
import { standardMatchExtractor } from './match/index.js';
import { standardMediaExtractor } from './media/index.js';
import { standardOrderExtractor } from './order/index.js';
import { portableCustomExtractor } from './portable-custom/index.js';
import { standardPositionObjectExtractor } from './position-object/index.js';
import { standardSelectPointExtractor } from './select-point/index.js';
import { standardSliderExtractor } from './slider/index.js';
import { standardTextEntryExtractor } from './text-entry/index.js';
import { standardUploadExtractor } from './upload/index.js';

export const ALL_STANDARD_EXTRACTORS: ElementExtractor[] = [
	portableCustomExtractor,
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
