/**
 * Interaction type mappings for strongly-typed registry
 *
 * This file defines the complete type system for the plugin-based
 * interaction renderer registry, ensuring compile-time type safety.
 */

import type { HTMLElement } from 'node-html-parser';
import type { ExtractedPci } from '../../pci/types.js';
import type { HtmlContent, QTIFileResponse } from '../../types/index.js';

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
	minChoices: number;
	prompt: string | null;
	choices: Array<{ identifier: string; text: HtmlContent; fixed?: boolean; classes?: string[] }>;
	/** CSS classes from the choiceInteraction element for custom renderer detection */
	interactionClasses?: string[];
	/** Message shown when candidate exceeds maxChoices (data-max-selections-message) */
	maxSelectionsMessage?: string | null;
	/** Message shown when candidate submits below minChoices (data-min-selections-message) */
	minSelectionsMessage?: string | null;
}

export interface TextEntryInteractionData extends BaseInteractionData {
	type: 'textEntryInteraction';
	expectedLength: number;
	patternMask: string | null;
	placeholderText: string;
	format?: string;
	/** CSS classes from the textEntryInteraction element (e.g. qti-input-width-N) */
	interactionClasses?: string[];
	/** Pattern mask validation message (data-patternmask-message) */
	patternMaskMessage?: string | null;
}

export interface ExtendedTextInteractionData extends BaseInteractionData {
	type: 'extendedTextInteraction';
	cardinality: 'single' | 'multiple' | 'ordered' | 'record';
	baseType?: string;
	base: number;
	stringIdentifier?: string;
	minStrings: number;
	/** Zero means no authored upper bound. */
	maxStrings: number;
	expectedLines: number;
	expectedLength: number;
	prompt: string | null;
	placeholderText: string;
	format: string;
	patternMask?: string | null;
	patternMaskMessage?: string | null;
	/** CSS classes from the extendedTextInteraction element (e.g. qti-height-lines-N) */
	interactionClasses?: string[];
}

export interface InlineChoiceInteractionData extends BaseInteractionData {
	type: 'inlineChoiceInteraction';
	shuffle: boolean;
	/** Placeholder label from the QTI <label> child element; shown as the unselected "Select…" option */
	label: string | null;
	/** Placeholder text from data-prompt attribute; alternative to <label> for dropdown default option */
	dataPrompt?: string | null;
	choices: Array<{ identifier: string; text: string; fixed?: boolean }>;
	/** CSS classes from the inlineChoiceInteraction element (e.g. qti-input-width-N) */
	interactionClasses?: string[];
}

export interface OrderInteractionData extends BaseInteractionData {
	type: 'orderInteraction';
	shuffle: boolean;
	minChoices: number;
	maxChoices: number;
	prompt: string | null;
	choices: Array<{ identifier: string; text: string; fixed?: boolean }>;
}

export interface AssociableChoice {
	identifier: string;
	text: string;
	matchMax: number;
	/** Minimum number of times this choice must appear in the response (QTI matchMin) */
	matchMin?: number;
	/** Pairing constraint: choice can only be paired with others sharing a group value (QTI matchGroup) */
	matchGroup?: string[];
	/** CSS classes from the choice element for custom renderer detection */
	classes?: string[];
}

export interface MatchInteractionData extends BaseInteractionData {
	type: 'matchInteraction';
	shuffle: boolean;
	maxAssociations: number;
	minAssociations?: number;
	prompt: string | null;
	sourceSet: AssociableChoice[];
	targetSet: AssociableChoice[];
	/** CSS classes from the matchInteraction element (e.g. qti-choices-top, qti-match-tabular) */
	interactionClasses?: string[];
	/** Message shown when candidate exceeds maxAssociations */
	maxSelectionsMessage?: string | null;
	/** Message shown when candidate submits below minAssociations */
	minSelectionsMessage?: string | null;
	/** Label for first column header in tabular mode (data-qti-first-column-header) */
	firstColumnHeader?: string | null;
}

export interface AssociateInteractionData extends BaseInteractionData {
	type: 'associateInteraction';
	shuffle: boolean;
	maxAssociations: number;
	minAssociations?: number;
	prompt: string | null;
	choices: AssociableChoice[];
}

export interface GapMatchInteractionData extends BaseInteractionData {
	type: 'gapMatchInteraction';
	shuffle: boolean;
	prompt: string | null;
	gapTexts: Array<{ identifier: string; text: string; matchMax: number; matchGroup?: string[]; inputWidth?: number }>;
	gaps: Array<{ identifier: string; index: number }>;
	promptText: string;
	/** CSS classes from the gapMatchInteraction element (e.g. qti-choices-top, qti-choices-bottom) */
	interactionClasses?: string[];
	/** Width of the choice container in px (data-choices-container-width) */
	choicesContainerWidth?: string | null;
	/** Message shown when candidate exceeds max associations */
	maxSelectionsMessage?: string | null;
	/** Message shown when candidate submits below min associations */
	minSelectionsMessage?: string | null;
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
	/** Author-provided label for the hotspot; used as accessible aria-label */
	hotspotLabel?: string;
}

export interface HotspotInteractionData extends BaseInteractionData {
	type: 'hotspotInteraction';
	maxChoices: number;
	minChoices?: number;
	prompt: string | null;
	imageData: ImageData | null;
	hotspotChoices: HotspotChoice[];
	/** CSS classes from the hotspotInteraction element (e.g. qti-selections-light, qti-selections-dark) */
	interactionClasses?: string[];
	/** Message shown when candidate exceeds maxChoices */
	maxSelectionsMessage?: string | null;
	/** Message shown when candidate submits below minChoices */
	minSelectionsMessage?: string | null;
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
	maxAssociations: number;
	gapTexts: Array<{ identifier: string; text: string; matchMax: number; matchGroup?: string[] }>;
	/** Image-based draggable labels (gapImg elements); rendered as <img> in the choice pool */
	gapImages: Array<{ identifier: string; src: string; alt: string; matchMax: number; matchGroup?: string[]; width?: number; height?: number }>;
	hotspots: AssociableHotspot[];
	/** CSS classes from the graphicGapMatchInteraction element (e.g. qti-choices-top, qti-selections-dark) */
	interactionClasses?: string[];
	/** Width of the choice container in px (data-choices-container-width) */
	choicesContainerWidth?: string | null;
	/** Message shown when candidate exceeds max associations */
	maxSelectionsMessage?: string | null;
	/** Message shown when candidate submits below min associations */
	minSelectionsMessage?: string | null;
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

/** Canonical interaction data for QTI 2.x and 3.0 Portable Custom Interactions. */
export interface PortableCustomInteractionData extends BaseInteractionData, ExtractedPci {
	type: 'portableCustomInteraction';
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
	minChoices: number;
	contentHtml: HtmlContent;
	hottextChoices: HottextChoice[];
	/** CSS classes from the hottextInteraction element (e.g. qti-input-control-hidden) */
	interactionClasses?: string[];
	/** Message shown when candidate exceeds maxChoices */
	maxSelectionsMessage?: string | null;
	/** Message shown when candidate submits below minChoices */
	minSelectionsMessage?: string | null;
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
	/** Pairing constraint: hotspot can only be associated with others sharing a group value (QTI matchGroup) */
	matchGroup?: string[];
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
	| PortableCustomInteractionData
	| MediaInteractionData
	| HottextInteractionData
	| SelectPointInteractionData
	| GraphicOrderInteractionData
	| GraphicAssociateInteractionData
	| PositionObjectInteractionData
	| EndAttemptInteractionData;

/**
 * QTI interaction type identifier
 * Extensible string type allows custom interaction types
 */
export type InteractionType = string;

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
	portableCustomInteraction: PortableCustomInteractionData;
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
	uploadInteraction: QTIFileResponse | null;
	drawingInteraction: string;
	customInteraction: any;
	portableCustomInteraction: unknown;
	mediaInteraction: any;
	hottextInteraction: string[];
	selectPointInteraction: Array<{ x: number; y: number }>;
	graphicOrderInteraction: string[];
	graphicAssociateInteraction: Array<[string, string]>;
	positionObjectInteraction: Record<string, { x: number; y: number }>;
	endAttemptInteraction: boolean;
}
