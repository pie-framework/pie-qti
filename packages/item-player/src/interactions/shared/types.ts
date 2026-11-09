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

/**
 * The interaction's authored accessible name and description, resolved to text from its
 * `aria-labelledby`, `aria-label`, `aria-describedby` and `aria-description`.
 */
export interface InteractionAccessibility {
	label?: string;
	description?: string;
}

/** The read-aloud attributes authored on an interaction element, for its renderer's host. */
export type InteractionReadAloud = Partial<Record<'lang' | 'data-catalog-idref' | 'data-tts-suppress', string>>;

export interface BaseInteractionData<TType extends string = string> {
	readonly type: TType;
	readonly responseId: string;
	readonly accessibility?: InteractionAccessibility;
	readonly readAloud?: InteractionReadAloud;
}

/**
 * An extractor payload after the delivery pipeline has attached its authoritative
 * renderer type and authored response identifier.
 *
 * Identity-looking properties in `TPayload` are deliberately omitted. The
 * pipeline applies the same rule at runtime by spreading payload first and
 * writing these two framework-owned fields last.
 */
export type DeliveredInteraction<
	TType extends string,
	TPayload extends object,
> = Readonly<
	Omit<TPayload, keyof BaseInteractionData> & BaseInteractionData<TType>
>;

export interface ChoiceInteractionData extends BaseInteractionData<'choiceInteraction'> {
	shuffle: boolean;
	maxChoices: number;
	minChoices: number;
	prompt: HtmlContent | null;
	choices: Array<{ identifier: string; text: HtmlContent; fixed?: boolean; classes?: string[] }>;
	/** CSS classes from the choiceInteraction element for custom renderer detection */
	interactionClasses?: string[];
	/** Message shown when candidate exceeds maxChoices (data-max-selections-message) */
	maxSelectionsMessage?: string | null;
	/** Message shown when candidate submits below minChoices (data-min-selections-message) */
	minSelectionsMessage?: string | null;
}

export interface TextEntryInteractionData extends BaseInteractionData<'textEntryInteraction'> {
	expectedLength: number;
	patternMask: string | null;
	placeholderText: string;
	format?: string;
	/** The bound response declaration's baseType, e.g. `integer` or `float` for a numeric keyboard */
	baseType?: string;
	/** QTI stringInteraction `base`: the number base a numeric response is entered in, when not 10 */
	base?: number;
	/**
	 * QTI stringInteraction `stringIdentifier`: the response, of base-type string, that holds the
	 * text the candidate entered — "3.50" where the numeric response is 3.5 — or NULL when empty
	 */
	stringIdentifier?: string;
	/** The authored `title`, an accessible name when no aria label is authored */
	title?: string;
	/** CSS classes from the textEntryInteraction element (e.g. qti-input-width-N) */
	interactionClasses?: string[];
	/** Pattern mask validation message (data-patternmask-message) */
	patternMaskMessage?: string | null;
}

export interface ExtendedTextInteractionData extends BaseInteractionData<'extendedTextInteraction'> {
	cardinality: 'single' | 'multiple' | 'ordered' | 'record';
	baseType?: string;
	base: number;
	stringIdentifier?: string;
	minStrings: number;
	/** Zero means no authored upper bound. */
	maxStrings: number;
	expectedLines: number;
	expectedLength: number;
	prompt: HtmlContent | null;
	placeholderText: string;
	format: string;
	patternMask?: string | null;
	patternMaskMessage?: string | null;
	/** CSS classes from the extendedTextInteraction element (e.g. qti-height-lines-N) */
	interactionClasses?: string[];
}

export interface InlineChoiceInteractionData extends BaseInteractionData<'inlineChoiceInteraction'> {
	shuffle: boolean;
	/** Placeholder label from the QTI <label> child element; shown as the unselected "Select…" option */
	label: string | null;
	/** Placeholder text from data-prompt attribute; alternative to <label> for dropdown default option */
	dataPrompt?: string | null;
	/** The authored `title`, an accessible name when no aria label is authored */
	title?: string;
	choices: Array<{ identifier: string; text: string; fixed?: boolean }>;
	/** CSS classes from the inlineChoiceInteraction element (e.g. qti-input-width-N) */
	interactionClasses?: string[];
}

export interface OrderInteractionData extends BaseInteractionData<'orderInteraction'> {
	shuffle: boolean;
	minChoices: number;
	maxChoices: number;
	prompt: HtmlContent | null;
	choices: Array<{ identifier: string; text: HtmlContent; fixed?: boolean }>;
	/** The authored `orientation` attribute: `vertical` (default) or `horizontal` */
	orientation?: string;
	/** CSS classes from the orderInteraction element (orientation and `qti-labels-*`) */
	interactionClasses?: string[];
	/** Message shown while the response orders fewer than minChoices (data-min-selections-message) */
	minSelectionsMessage?: string | null;
}

export interface AssociableChoice {
	identifier: string;
	text: HtmlContent;
	matchMax: number;
	/** Minimum number of times this choice must appear in the response (QTI matchMin) */
	matchMin?: number;
	/**
	 * Authored `matchGroup` (QTI 2.2/3.0: the identifiers of the choices this one may be paired
	 * with; content also uses the tokens as shared group labels). Empty/absent: unrestricted.
	 */
	matchGroup?: string[];
	/** CSS classes from the choice element for custom renderer detection */
	classes?: string[];
}

export interface MatchInteractionData extends BaseInteractionData<'matchInteraction'> {
	shuffle: boolean;
	maxAssociations: number;
	minAssociations?: number;
	prompt: HtmlContent | null;
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

export interface AssociateInteractionData extends BaseInteractionData<'associateInteraction'> {
	shuffle: boolean;
	maxAssociations: number;
	minAssociations?: number;
	prompt: HtmlContent | null;
	choices: AssociableChoice[];
	/** Message shown while the response has fewer than minAssociations (data-min-selections-message) */
	minSelectionsMessage?: string | null;
}

export interface GapMatchInteractionData extends BaseInteractionData<'gapMatchInteraction'> {
	shuffle: boolean;
	prompt: HtmlContent | null;
	gapTexts: Array<{
		identifier: string;
		text: string;
		matchMax: number;
		/** Minimum number of gaps this choice must fill (QTI matchMin); absent means 0. */
		matchMin?: number;
		matchGroup?: string[];
		inputWidth?: number;
	}>;
	/**
	 * Image choices from gapImg (QTI 2.x) / qti-gap-img (QTI 3.0); optional so
	 * hand-built text-only data stays valid. `src` passes the resource-URL policy
	 * through the module's delivery field.
	 */
	gapImages?: Array<{
		identifier: string;
		src: string;
		alt: string;
		matchMax: number;
		/** Minimum number of gaps this choice must fill (QTI matchMin); absent means 0. */
		matchMin?: number;
		matchGroup?: string[];
		width?: number;
		height?: number;
	}>;
	/** Identifiers of the `<gap>` elements, in reading order (what the extractor delivers). */
	gaps: string[];
	/**
	 * Authored `matchGroup` tokens per gap identifier (QTI 2.2/3.0: the identifiers of the
	 * choices that may be matched with this gap). Present only when a gap authors one.
	 */
	gapMatchGroups?: Record<string, string[]>;
	/**
	 * Identifiers of the gaps authored `required`: a valid response fills each of them (QTI 2.1
	 * gap; QTI 3.0 §5.55.5). Present only when a gap is required.
	 */
	requiredGaps?: string[];
	/** Finalized HTML template containing `[GAP:identifier]` text markers. */
	promptText: HtmlContent;
	/** CSS classes from the gapMatchInteraction element (e.g. qti-choices-top, qti-choices-bottom) */
	interactionClasses?: string[];
	/** Width of the choice container in px (data-choices-container-width) */
	choicesContainerWidth?: string | null;
	/** Message shown when candidate exceeds max associations */
	maxSelectionsMessage?: string | null;
	/** Message shown when candidate submits below min associations */
	minSelectionsMessage?: string | null;
}

export interface SliderInteractionData extends BaseInteractionData<'sliderInteraction'> {
	lowerBound: number;
	upperBound: number;
	step: number;
	/** Authored `stepLabel` attribute: render a label at each step interval. */
	stepLabel?: boolean;
	orientation: string;
	reverse: boolean;
	prompt: HtmlContent | null;
}

export interface ImageData {
	type: 'svg' | 'image';
	content?: HtmlContent;
	src?: string;
	width: string;
	height: string;
	/** Short text alternative extracted from the QTI source (see `shared/imageAlt.ts`). */
	alt?: string;
	/** Longer description for complex images (SVG `<desc>`, resolved aria description). */
	altDescription?: string;
	/** True only when the author explicitly marked the image decorative (`<img alt="">`). */
	decorative?: boolean;
}

export interface HotspotChoice {
	identifier: string;
	shape: string;
	coords: string;
	/** Author-provided label for the hotspot; used as accessible aria-label */
	hotspotLabel?: string;
}

export interface HotspotInteractionData extends BaseInteractionData<'hotspotInteraction'> {
	maxChoices: number;
	minChoices?: number;
	prompt: HtmlContent | null;
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
	/** Authored `matchGroup`: the identifiers of the labels that may be matched with this hotspot. */
	matchGroup?: string[];
}

export interface GraphicGapMatchInteractionData extends BaseInteractionData<'graphicGapMatchInteraction'> {
	prompt: HtmlContent | null;
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

export interface UploadInteractionData extends BaseInteractionData<'uploadInteraction'> {
	prompt: HtmlContent | null;
	/** Allowed MIME types / extensions (vendor-dependent); empty = accept any */
	fileTypes: string[];
	rawAttributes: Record<string, string>;
}

export interface DrawingInteractionData extends BaseInteractionData<'drawingInteraction'> {
	prompt: HtmlContent | null;
	/** Optional background image/SVG to draw on top of */
	imageData: ImageData | null;
	rawAttributes: Record<string, string>;
}

export interface CustomInteractionData extends BaseInteractionData<'customInteraction'> {
	prompt: HtmlContent | null;
	rawAttributes: Record<string, string>;
	/** Outer XML snippet for debugging (best-effort) */
	xml: string;
}

/** Canonical interaction data for QTI 2.x and 3.0 Portable Custom Interactions. */
export interface PortableCustomInteractionData
	extends BaseInteractionData<'portableCustomInteraction'>,
		ExtractedPci {}

/** One authored `<source>` of an audio or video element. */
export interface MediaElementSource {
	src: string;
	mimeType: string;
}

/** The timed text track kinds HTML defines for `<track>`. */
export type MediaTrackKind = 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata';

/** One authored `<track>` of an audio or video element: captions, subtitles, descriptions. */
export interface MediaElementTrack {
	src: string;
	kind: MediaTrackKind;
	srclang?: string;
	label?: string;
	default?: boolean;
}

export interface MediaElement {
	type: 'audio' | 'video' | 'object';
	/** The object's `data`, or the first source of an audio or video element. */
	src: string;
	mimeType: string;
	width?: number;
	height?: number;
	/** Every source of an audio or video element, in document order (the browser picks the first it can play). */
	sources?: MediaElementSource[];
	/** Every text track of an audio or video element, in document order. */
	tracks?: MediaElementTrack[];
	/** The authored `crossorigin` mode; cross-origin caption files load only with one. */
	crossOrigin?: 'anonymous' | 'use-credentials';
}

export interface MediaInteractionData extends BaseInteractionData<'mediaInteraction'> {
	prompt: HtmlContent | null;
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

export interface HottextInteractionData extends BaseInteractionData<'hottextInteraction'> {
	prompt: HtmlContent | null;
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

export interface SelectPointInteractionData extends BaseInteractionData<'selectPointInteraction'> {
	prompt: HtmlContent | null;
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

export interface GraphicOrderInteractionData extends BaseInteractionData<'graphicOrderInteraction'> {
	prompt: HtmlContent | null;
	imageData: ImageData | null;
	hotspotChoices: GraphicOrderChoice[];
	/** Minimum number of hotspots the response must order (QTI minChoices); absent means 0. */
	minChoices?: number;
	/** Maximum number of hotspots the response may order (QTI maxChoices); absent means 0, no limit. */
	maxChoices?: number;
	/** Message shown while the response orders fewer than minChoices (data-min-selections-message) */
	minSelectionsMessage?: string | null;
}

export interface GraphicAssociateHotspot {
	identifier: string;
	shape: string;
	coords: string;
	matchMax: number;
	label: string;
	/**
	 * Authored `matchGroup` (QTI 2.2/3.0: the identifiers of the hotspots this one may be
	 * associated with; content also uses the tokens as shared group labels).
	 */
	matchGroup?: string[];
}

export interface GraphicAssociateInteractionData extends BaseInteractionData<'graphicAssociateInteraction'> {
	prompt: HtmlContent | null;
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

/**
 * A point on a draggable object image, in that image's own pixel coordinates,
 * measured from its top-left corner (QTI `centerPoint`, horizontal then vertical).
 */
export interface PositionObjectCenterPoint {
	x: number;
	y: number;
}

export interface PositionObjectInteractionData extends BaseInteractionData<'positionObjectInteraction'> {
	prompt: HtmlContent | null;
	maxChoices: number;
	minChoices: number;
	/**
	 * The point on the object image treated as the object's position: it is the
	 * point placed under the candidate's pointer and recorded, in stage
	 * coordinates, as the response. `null` is the QTI default, the centre of the
	 * object image's bounding rectangle.
	 */
	centerPoint: PositionObjectCenterPoint | null;
	imageData: ImageData | null;
	positionObjectStages: PositionObjectStage[];
}

export interface EndAttemptInteractionData extends BaseInteractionData<'endAttemptInteraction'> {
	prompt: HtmlContent | null;
	title: string;
	/** Whether this interaction counts as an attempt (default: true) */
	countAttempt: boolean;
}

/** Closed union of the interaction shapes supplied by the standard modules. */
export type StandardInteractionData =
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
