import type { ElementExtractor } from '../extraction/types.js';
import {
	htmlField,
	type InteractionDeliveryField,
	urlField,
} from '../extraction/deliveryTypes.js';
import type { InteractionDataMap } from './shared/types.js';
import { standardAssociateExtractor } from './associate/extractor.js';
import { standardChoiceExtractor } from './choice/extractor.js';
import { standardCustomExtractor } from './custom/extractor.js';
import { standardDrawingExtractor } from './drawing/extractor.js';
import { standardEndAttemptExtractor } from './end-attempt/extractor.js';
import { standardExtendedTextExtractor } from './extended-text/extractor.js';
import { standardGapMatchExtractor } from './gap-match/extractor.js';
import { standardGraphicAssociateExtractor } from './graphic-associate/extractor.js';
import { standardGraphicGapMatchExtractor } from './graphic-gap-match/extractor.js';
import { standardGraphicOrderExtractor } from './graphic-order/extractor.js';
import { standardHotspotExtractor } from './hotspot/extractor.js';
import { standardHottextExtractor } from './hottext/extractor.js';
import { standardInlineChoiceExtractor } from './inline-choice/extractor.js';
import { standardMatchExtractor } from './match/extractor.js';
import { standardMediaExtractor } from './media/extractor.js';
import { standardOrderExtractor } from './order/extractor.js';
import { standardPositionObjectExtractor } from './position-object/extractor.js';
import { portableCustomExtractor } from './portable-custom/extractor.js';
import { standardSelectPointExtractor } from './select-point/extractor.js';
import { standardSliderExtractor } from './slider/extractor.js';
import { standardTextEntryExtractor } from './text-entry/extractor.js';
import { standardUploadExtractor } from './upload/extractor.js';

export type StandardInteractionType = keyof InteractionDataMap;
export type InteractionPlacement = 'block' | 'inline';

export interface StandardInteractionModule {
	type: StandardInteractionType;
	extractor: ElementExtractor<any, string>;
	placement: InteractionPlacement;
	/** Render-sink fields owned by this InteractionModule. */
	delivery: readonly InteractionDeliveryField[];
}

const prompt = htmlField('prompt');
const image = [
	htmlField('imageData', 'content'),
	urlField('img', 'imageData', 'src'),
] as const;

const STANDARD_INTERACTION_MODULE_DEFINITIONS = [
	{
		type: 'choiceInteraction',
		extractor: standardChoiceExtractor,
		placement: 'block',
		delivery: [prompt, htmlField('choices', '*', 'text')],
	},
	{
		type: 'textEntryInteraction',
		extractor: standardTextEntryExtractor,
		placement: 'inline',
		delivery: [],
	},
	{
		type: 'extendedTextInteraction',
		extractor: standardExtendedTextExtractor,
		placement: 'block',
		delivery: [prompt],
	},
	{
		type: 'inlineChoiceInteraction',
		extractor: standardInlineChoiceExtractor,
		placement: 'inline',
		delivery: [],
	},
	{
		type: 'orderInteraction',
		extractor: standardOrderExtractor,
		placement: 'block',
		delivery: [prompt, htmlField('choices', '*', 'text')],
	},
	{
		type: 'matchInteraction',
		extractor: standardMatchExtractor,
		placement: 'block',
		delivery: [
			prompt,
			htmlField('sourceSet', '*', 'text'),
			htmlField('targetSet', '*', 'text'),
		],
	},
	{
		type: 'associateInteraction',
		extractor: standardAssociateExtractor,
		placement: 'block',
		delivery: [prompt, htmlField('choices', '*', 'text')],
	},
	{
		type: 'gapMatchInteraction',
		extractor: standardGapMatchExtractor,
		placement: 'block',
		delivery: [prompt, htmlField('promptText')],
	},
	{
		type: 'sliderInteraction',
		extractor: standardSliderExtractor,
		placement: 'block',
		delivery: [prompt],
	},
	{
		type: 'hotspotInteraction',
		extractor: standardHotspotExtractor,
		placement: 'block',
		delivery: [prompt, ...image],
	},
	{
		type: 'graphicGapMatchInteraction',
		extractor: standardGraphicGapMatchExtractor,
		placement: 'block',
		delivery: [prompt, ...image, urlField('img', 'gapImages', '*', 'src')],
	},
	{
		type: 'uploadInteraction',
		extractor: standardUploadExtractor,
		placement: 'block',
		delivery: [prompt],
	},
	{
		type: 'drawingInteraction',
		extractor: standardDrawingExtractor,
		placement: 'block',
		delivery: [prompt, ...image],
	},
	{
		type: 'customInteraction',
		extractor: standardCustomExtractor,
		placement: 'block',
		delivery: [prompt],
	},
	{
		type: 'portableCustomInteraction',
		extractor: portableCustomExtractor,
		placement: 'block',
		delivery: [htmlField('markup')],
	},
	{
		type: 'mediaInteraction',
		extractor: standardMediaExtractor,
		placement: 'block',
		delivery: [prompt, urlField('media-or-object', 'mediaElement', 'src')],
	},
	{
		type: 'hottextInteraction',
		extractor: standardHottextExtractor,
		placement: 'block',
		delivery: [prompt, htmlField('contentHtml')],
	},
	{
		type: 'selectPointInteraction',
		extractor: standardSelectPointExtractor,
		placement: 'block',
		delivery: [prompt, ...image],
	},
	{
		type: 'graphicOrderInteraction',
		extractor: standardGraphicOrderExtractor,
		placement: 'block',
		delivery: [prompt, ...image],
	},
	{
		type: 'graphicAssociateInteraction',
		extractor: standardGraphicAssociateExtractor,
		placement: 'block',
		delivery: [prompt, ...image],
	},
	{
		type: 'positionObjectInteraction',
		extractor: standardPositionObjectExtractor,
		placement: 'block',
		delivery: [
			prompt,
			...image,
			htmlField('positionObjectStages', '*', 'objectData', 'content'),
			urlField('img', 'positionObjectStages', '*', 'objectData', 'src'),
		],
	},
	{
		type: 'endAttemptInteraction',
		extractor: standardEndAttemptExtractor,
		placement: 'block',
		delivery: [prompt],
	},
] as const satisfies readonly StandardInteractionModule[];

/**
 * Immutable process-wide inventory. Definitions still snapshot its delivery
 * fields into their own sealed registry, so session behavior does not depend on
 * later access to this exported catalog.
 */
export const STANDARD_INTERACTION_MODULES = freezeStandardInteractionModules(
	STANDARD_INTERACTION_MODULE_DEFINITIONS,
);

export function getStandardInteractionModules(): readonly StandardInteractionModule[] {
	return STANDARD_INTERACTION_MODULES;
}

export function getStandardBlockInteractionModules(): readonly StandardInteractionModule[] {
	return STANDARD_INTERACTION_MODULES.filter((module) => module.placement === 'block');
}

export function getStandardInlineInteractionModules(): readonly StandardInteractionModule[] {
	return STANDARD_INTERACTION_MODULES.filter((module) => module.placement === 'inline');
}

export function getStandardInteractionExtractors(): readonly ElementExtractor<any, string>[] {
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

function freezeStandardInteractionModules(
	modules: readonly StandardInteractionModule[],
): readonly StandardInteractionModule[] {
	return Object.freeze(
		modules.map((module) =>
			Object.freeze({
				...module,
				delivery: Object.freeze(
					module.delivery.map((field) =>
						Object.freeze({
							...field,
							path: Object.freeze([...field.path]),
						}),
					),
				),
			}),
		),
	);
}
