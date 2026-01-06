/**
 * Interaction type mappings for strongly-typed registry
 *
 * This file defines the complete type system for the plugin-based
 * interaction renderer registry, ensuring compile-time type safety.
 */

import type { HTMLElement } from 'node-html-parser';
import type { HtmlContent } from './index.js';

/**
 * Type alias for parsed QTI XML elements
 * Uses node-html-parser's HTMLElement type directly
 */
export type QTIElement = HTMLElement;

export interface BaseInteractionData {
	type: string;
	responseId: string;
}

export interface ChoiceInteractionData extends BaseInteractionData {
	type: 'choiceInteraction';
	shuffle: boolean;
	maxChoices: number;
	prompt: string | null;
	choices: Array<{ identifier: string; text: HtmlContent; classes?: string[] }>;
	/** CSS classes from the choiceInteraction element for custom renderer detection */
	interactionClasses?: string[];
}

export interface TextEntryInteractionData extends BaseInteractionData {
	type: 'textEntryInteraction';
	expectedLength: number;
	patternMask: string | null;
	placeholderText: string;
}

export interface ExtendedTextInteractionData extends BaseInteractionData {
	type: 'extendedTextInteraction';
	expectedLines: number;
	expectedLength: number;
	placeholderText: string;
	format: string;
}

export interface InlineChoiceInteractionData extends BaseInteractionData {
	type: 'inlineChoiceInteraction';
	shuffle: boolean;
	choices: Array<{ identifier: string; text: string }>;
}

export interface OrderInteractionData extends BaseInteractionData {
	type: 'orderInteraction';
	shuffle: boolean;
	prompt: string | null;
	choices: Array<{ identifier: string; text: string }>;
}

export interface AssociableChoice {
	identifier: string;
	text: string;
	matchMax: number;
}

export interface MatchInteractionData extends BaseInteractionData {
	type: 'matchInteraction';
	shuffle: boolean;
	maxAssociations: number;
	prompt: string | null;
	sourceSet: AssociableChoice[];
	targetSet: AssociableChoice[];
}

export interface AssociateInteractionData extends BaseInteractionData {
	type: 'associateInteraction';
	shuffle: boolean;
	maxAssociations: number;
	prompt: string | null;
	choices: AssociableChoice[];
}

export interface GapMatchInteractionData extends BaseInteractionData {
	type: 'gapMatchInteraction';
	shuffle: boolean;
	prompt: string | null;
	gapTexts: Array<{ identifier: string; text: string; matchMax: number }>;
	gaps: Array<{ identifier: string; index: number }>;
	promptText: string;
}

export interface SliderInteractionData extends BaseInteractionData {
	type: 'sliderInteraction';
	lowerBound: number;
	upperBound: number;
	step: number;
	orientation: string;
	reverse: boolean;
	prompt: string | null;
}

export interface ImageData {
	type: 'svg' | 'image';
	content?: HtmlContent;
	src?: string;
	width: string;
	height: string;
}

export interface HotspotChoice {
	identifier: string;
	shape: string;
	coords: string;
}

export interface HotspotInteractionData extends BaseInteractionData {
	type: 'hotspotInteraction';
	maxChoices: number;
	prompt: string | null;
	imageData: ImageData | null;
	hotspotChoices: HotspotChoice[];
}

export interface AssociableHotspot {
	identifier: string;
	shape: string;
	coords: string;
	matchMax: number;
}

export interface GraphicGapMatchInteractionData extends BaseInteractionData {
	type: 'graphicGapMatchInteraction';
	prompt: string | null;
	imageData: ImageData | null;
	gapTexts: Array<{ identifier: string; text: string; matchMax: number }>;
	hotspots: AssociableHotspot[];
}

export interface UploadInteractionData extends BaseInteractionData {
	type: 'uploadInteraction';
	prompt: string | null;
	/** Allowed MIME types / extensions (vendor-dependent); empty = accept any */
	fileTypes: string[];
	rawAttributes: Record<string, string>;
}

export interface DrawingInteractionData extends BaseInteractionData {
	type: 'drawingInteraction';
	prompt: string | null;
	/** Optional background image/SVG to draw on top of */
	imageData: ImageData | null;
	rawAttributes: Record<string, string>;
}

export interface CustomInteractionData extends BaseInteractionData {
	type: 'customInteraction';
	prompt: string | null;
	rawAttributes: Record<string, string>;
	/** Outer XML snippet for debugging (best-effort) */
	xml: string;
}

export interface MediaElement {
	type: 'audio' | 'video' | 'object';
	src: string;
	mimeType: string;
	width?: number;
	height?: number;
}

export interface MediaInteractionData extends BaseInteractionData {
	type: 'mediaInteraction';
	prompt: string | null;
	autostart: boolean;
	minPlays: number;
	maxPlays: number; // 0 = unlimited
	loop: boolean;
	mediaElement: MediaElement;
	/** Whether the renderer should allow <object> embeds for this interaction (default false) */
	allowObjectEmbeds?: boolean;
}

export interface HottextChoice {
	identifier: string;
	text: string;
}

export interface HottextInteractionData extends BaseInteractionData {
	type: 'hottextInteraction';
	prompt: string | null;
	maxChoices: number;
	contentHtml: HtmlContent;
	hottextChoices: HottextChoice[];
}

export interface Point {
	x: number;
	y: number;
}

export interface SelectPointInteractionData extends BaseInteractionData {
	type: 'selectPointInteraction';
	prompt: string | null;
	maxChoices: number;
	minChoices: number;
	imageData: ImageData | null;
}

export interface GraphicOrderChoice {
	identifier: string;
	shape: string;
	coords: string;
	label: string;
}

export interface GraphicOrderInteractionData extends BaseInteractionData {
	type: 'graphicOrderInteraction';
	prompt: string | null;
	imageData: ImageData | null;
	hotspotChoices: GraphicOrderChoice[];
}

export interface GraphicAssociateHotspot {
	identifier: string;
	shape: string;
	coords: string;
	matchMax: number;
	label: string;
}

export interface GraphicAssociateInteractionData extends BaseInteractionData {
	type: 'graphicAssociateInteraction';
	prompt: string | null;
	maxAssociations: number;
	minAssociations: number;
	imageData: ImageData | null;
	associableHotspots: GraphicAssociateHotspot[];
}

export interface PositionObjectStage {
	identifier: string;
	matchMax: number;
	objectData: {
		type: 'image' | 'svg';
		src?: string;
		content?: HtmlContent;
		width?: string;
		height?: string;
	} | null;
	label: string;
}

export interface PositionObjectInteractionData extends BaseInteractionData {
	type: 'positionObjectInteraction';
	prompt: string | null;
	maxChoices: number;
	minChoices: number;
	centerPoint: boolean;
	imageData: ImageData | null;
	positionObjectStages: PositionObjectStage[];
}

export interface EndAttemptInteractionData extends BaseInteractionData {
	type: 'endAttemptInteraction';
	prompt: string | null;
	title: string;
	/** Whether this interaction counts as an attempt (default: true) */
	countAttempt: boolean;
}

export type InteractionData =
	| ChoiceInteractionData
	| TextEntryInteractionData
	| ExtendedTextInteractionData
	| InlineChoiceInteractionData
	| OrderInteractionData
	| MatchInteractionData
	| AssociateInteractionData
	| GapMatchInteractionData
	| SliderInteractionData
	| HotspotInteractionData
	| GraphicGapMatchInteractionData
	| UploadInteractionData
	| DrawingInteractionData
	| CustomInteractionData
	| MediaInteractionData
	| HottextInteractionData
	| SelectPointInteractionData
	| GraphicOrderInteractionData
	| GraphicAssociateInteractionData
	| PositionObjectInteractionData
	| EndAttemptInteractionData;

/**
 * All supported QTI 2.2 interaction types
 */
export type InteractionType =
	| 'choiceInteraction'
	| 'textEntryInteraction'
	| 'extendedTextInteraction'
	| 'inlineChoiceInteraction'
	| 'orderInteraction'
	| 'matchInteraction'
	| 'associateInteraction'
	| 'gapMatchInteraction'
	| 'sliderInteraction'
	| 'hotspotInteraction'
	| 'graphicGapMatchInteraction'
	| 'uploadInteraction'
	| 'drawingInteraction'
	| 'customInteraction'
	| 'mediaInteraction'
	| 'hottextInteraction'
	| 'selectPointInteraction'
	| 'graphicOrderInteraction'
	| 'graphicAssociateInteraction'
	| 'positionObjectInteraction'
	| 'endAttemptInteraction';

/**
 * Map interaction types to their data structures
 * TypeScript will ensure registrations use the correct data type
 */
export interface InteractionDataMap {
	choiceInteraction: ChoiceInteractionData;
	textEntryInteraction: TextEntryInteractionData;
	extendedTextInteraction: ExtendedTextInteractionData;
	inlineChoiceInteraction: InlineChoiceInteractionData;
	orderInteraction: OrderInteractionData;
	matchInteraction: MatchInteractionData;
	associateInteraction: AssociateInteractionData;
	gapMatchInteraction: GapMatchInteractionData;
	sliderInteraction: SliderInteractionData;
	hotspotInteraction: HotspotInteractionData;
	graphicGapMatchInteraction: GraphicGapMatchInteractionData;
	uploadInteraction: UploadInteractionData;
	drawingInteraction: DrawingInteractionData;
	customInteraction: CustomInteractionData;
	mediaInteraction: MediaInteractionData;
	hottextInteraction: HottextInteractionData;
	selectPointInteraction: SelectPointInteractionData;
	graphicOrderInteraction: GraphicOrderInteractionData;
	graphicAssociateInteraction: GraphicAssociateInteractionData;
	positionObjectInteraction: PositionObjectInteractionData;
	endAttemptInteraction: EndAttemptInteractionData;
}

/**
 * Map interaction types to their response value types
 * Ensures getValue/setValue use the correct types
 */
export interface InteractionValueMap {
	choiceInteraction: string | string[];
	textEntryInteraction: string;
	extendedTextInteraction: string;
	inlineChoiceInteraction: string;
	orderInteraction: string[];
	matchInteraction: Record<string, string>;
	associateInteraction: Array<[string, string]>;
	gapMatchInteraction: Record<string, string>;
	sliderInteraction: number;
	hotspotInteraction: string[];
	graphicGapMatchInteraction: Record<string, string>;
	uploadInteraction: import('../types/index.js').QTIFileResponse[];
	drawingInteraction: string;
	customInteraction: any;
	mediaInteraction: any;
	hottextInteraction: string[];
	selectPointInteraction: Array<{ x: number; y: number }>;
	graphicOrderInteraction: string[];
	graphicAssociateInteraction: Array<[string, string]>;
	positionObjectInteraction: Record<string, { x: number; y: number }>;
	endAttemptInteraction: boolean;
}
