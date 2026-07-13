import type { ElementExtractor } from '../extraction/types.js';
import type { InteractionDataMap } from './shared/types.js';
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
import { standardPositionObjectExtractor } from './position-object/index.js';
import { portableCustomExtractor } from './portable-custom/index.js';
import { standardSelectPointExtractor } from './select-point/index.js';
import { standardSliderExtractor } from './slider/index.js';
import { standardTextEntryExtractor } from './text-entry/index.js';
import { standardUploadExtractor } from './upload/index.js';

export type StandardInteractionType = keyof InteractionDataMap;
export type InteractionPlacement = 'block' | 'inline';

export interface StandardInteractionModule {
	type: StandardInteractionType;
	extractor: ElementExtractor;
	placement: InteractionPlacement;
}

export const STANDARD_INTERACTION_MODULES = [
	{ type: 'choiceInteraction', extractor: standardChoiceExtractor, placement: 'block' },
	{ type: 'textEntryInteraction', extractor: standardTextEntryExtractor, placement: 'inline' },
	{ type: 'extendedTextInteraction', extractor: standardExtendedTextExtractor, placement: 'block' },
	{ type: 'inlineChoiceInteraction', extractor: standardInlineChoiceExtractor, placement: 'inline' },
	{ type: 'orderInteraction', extractor: standardOrderExtractor, placement: 'block' },
	{ type: 'matchInteraction', extractor: standardMatchExtractor, placement: 'block' },
	{ type: 'associateInteraction', extractor: standardAssociateExtractor, placement: 'block' },
	{ type: 'gapMatchInteraction', extractor: standardGapMatchExtractor, placement: 'block' },
	{ type: 'sliderInteraction', extractor: standardSliderExtractor, placement: 'block' },
	{ type: 'hotspotInteraction', extractor: standardHotspotExtractor, placement: 'block' },
	{ type: 'graphicGapMatchInteraction', extractor: standardGraphicGapMatchExtractor, placement: 'block' },
	{ type: 'uploadInteraction', extractor: standardUploadExtractor, placement: 'block' },
	{ type: 'drawingInteraction', extractor: standardDrawingExtractor, placement: 'block' },
	{ type: 'customInteraction', extractor: standardCustomExtractor, placement: 'block' },
	{ type: 'portableCustomInteraction', extractor: portableCustomExtractor, placement: 'block' },
	{ type: 'mediaInteraction', extractor: standardMediaExtractor, placement: 'block' },
	{ type: 'hottextInteraction', extractor: standardHottextExtractor, placement: 'block' },
	{ type: 'selectPointInteraction', extractor: standardSelectPointExtractor, placement: 'block' },
	{ type: 'graphicOrderInteraction', extractor: standardGraphicOrderExtractor, placement: 'block' },
	{ type: 'graphicAssociateInteraction', extractor: standardGraphicAssociateExtractor, placement: 'block' },
	{ type: 'positionObjectInteraction', extractor: standardPositionObjectExtractor, placement: 'block' },
	{ type: 'endAttemptInteraction', extractor: standardEndAttemptExtractor, placement: 'block' },
] as const satisfies readonly StandardInteractionModule[];

export function getStandardInteractionModules(): readonly StandardInteractionModule[] {
	return STANDARD_INTERACTION_MODULES;
}

export function getStandardBlockInteractionModules(): readonly StandardInteractionModule[] {
	return STANDARD_INTERACTION_MODULES.filter((module) => module.placement === 'block');
}

export function getStandardInlineInteractionModules(): readonly StandardInteractionModule[] {
	return STANDARD_INTERACTION_MODULES.filter((module) => module.placement === 'inline');
}

export function getStandardInteractionExtractors(): readonly ElementExtractor[] {
	return STANDARD_INTERACTION_MODULES.map((module) => module.extractor);
}

export function getStandardInteractionElementTypes(): string[] {
	const elementTypes = new Set<string>();
	for (const module of STANDARD_INTERACTION_MODULES) {
		for (const elementType of module.extractor.elementTypes) {
			elementTypes.add(elementType);
		}
	}
	return [...elementTypes];
}

const STANDARD_TYPE_BY_LOWERCASE = new Map(
	STANDARD_INTERACTION_MODULES.map((module) => [module.type.toLowerCase(), module.type])
);

export function normalizeInteractionTypeFromTagName(tagName: string): string {
	const lowerTagName = tagName.toLowerCase();
	if (lowerTagName.startsWith('qti-')) {
		return lowerTagName.slice(4).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
	}
	return STANDARD_TYPE_BY_LOWERCASE.get(lowerTagName) ?? tagName;
}

export function getStandardInteractionModule(type: string): StandardInteractionModule | null {
	const normalizedType = normalizeInteractionTypeFromTagName(type);
	return STANDARD_INTERACTION_MODULES.find((module) => module.type === normalizedType) ?? null;
}

export function isStandardInlineInteractionType(type: string): type is 'textEntryInteraction' | 'inlineChoiceInteraction' {
	return getStandardInteractionModule(type)?.placement === 'inline';
}

export function isStandardBlockInteractionType(type: string): boolean {
	return getStandardInteractionModule(type)?.placement === 'block';
}

export function isStandardInlineInteractionTagName(tagName: string): boolean {
	return isStandardInlineInteractionType(normalizeInteractionTypeFromTagName(tagName));
}
