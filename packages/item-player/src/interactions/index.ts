/**
 * Vertical QTI interaction modules.
 *
 * Each interaction folder owns the extractor entrypoint and interaction-specific
 * type exports. Legacy extractor and type paths re-export from this module layer.
 */

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
export * from './modules.js';
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
