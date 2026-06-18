/**
 * Core QTI types for the player
 */

import type {
	BaseType as ProcessingBaseType,
	Cardinality as ProcessingCardinality,
	QtiValue,
} from '@pie-qti/qti-processing';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { ResponseValidationResult } from './responseValidation.js';

/**
 * QTI base type identifier
 * Extensible string type allows custom base types
 */
export type VariableBaseType = ProcessingBaseType;

/**
 * QTI cardinality identifier
 * Extensible string type allows custom cardinality values
 */
export type VariableCardinality = ProcessingCardinality;

export interface VariableDeclaration {
	identifier: string;
	baseType: VariableBaseType;
	cardinality: VariableCardinality;
	value: any;
	defaultValue?: any;
	mapping?: Mapping;
	areaMapping?: AreaMapping;
}

export interface Mapping {
	defaultValue?: number;
	lowerBound?: number;
	upperBound?: number;
	/**
	 * QTI attribute on <mapping>. When "false", string mappings are case-insensitive by default.
	 * Stored as raw string to match XML attribute values ("true"/"false").
	 */
	caseSensitive?: string;
	entries: Record<string, MapEntry>;
}

export interface MapEntry {
	mapKey: string;
	mappedValue: number;
	caseSensitive?: string;
}

export interface AreaMapping {
	defaultValue?: number;
	lowerBound?: number;
	upperBound?: number;
	entries: AreaMapEntry[];
}

export interface AreaMapEntry {
	shape: 'circle' | 'rect' | 'poly' | 'ellipse' | 'default';
	coords: string;
	mappedValue: number;
}

export interface ResponseDeclaration extends VariableDeclaration {
	correctResponse?: any;
}

export interface OutcomeDeclaration extends VariableDeclaration {
	interpretation?: string;
	longInterpretation?: string;
	normalMaximum?: number;
	normalMinimum?: number;
	masteryValue?: number;
	views?: string[];
}

export interface ItemSessionState {
	[variableId: string]: any;
}

export type ItemLifecycleStatus = 'initial' | 'interacting' | 'suspended' | 'closed' | 'review' | 'solution' | 'answer';

export type SerializedVariableKind = 'response' | 'outcome' | 'template' | 'context';

export interface SerializedItemSessionVariable {
	identifier: string;
	kind: SerializedVariableKind;
	baseType: VariableBaseType;
	cardinality: VariableCardinality;
	value: any;
	defaultValue?: any;
}

export interface SerializedItemSessionState {
	itemIdentifier?: string;
	sessionGuid: string;
	lifecycleStatus: ItemLifecycleStatus;
	completionStatus: CompletionStatus;
	numAttempts: number;
	/**
	 * Time-on-task in milliseconds, stored as the QTI built-in duration variable value.
	 */
	duration: number;
	responseVariables: Record<string, SerializedItemSessionVariable>;
	outcomeVariables: Record<string, SerializedItemSessionVariable>;
	templateVariables: Record<string, SerializedItemSessionVariable>;
	contextVariables: Record<string, SerializedItemSessionVariable>;
	validationMessages: ResponseValidationResult['issues'];
	savedAt: string;
}

export type ItemSessionAction =
	| 'suspendAttempt'
	| 'endAttempt'
	| 'scoreAttempt'
	| 'newTemplate'
	| 'submitAttempt';

export type ItemSessionActionCommand =
	| { action: 'suspendAttempt' }
	| { action: 'endAttempt'; countAttempt?: boolean; validateResponses?: boolean }
	| { action: 'scoreAttempt' }
	| { action: 'newTemplate'; resetResponses?: boolean }
	| { action: 'submitAttempt'; countAttempt?: boolean };

export interface ItemSessionActionResult {
	action: ItemSessionAction;
	lifecycleStatus: ItemLifecycleStatus;
	completionStatus: CompletionStatus;
	numAttempts: number;
	duration: number;
	completed: boolean;
	sessionState: SerializedItemSessionState;
	validation?: ResponseValidationResult;
	scoring?: ScoringResult;
}

export interface InteractionResponse {
	[responseId: string]: any;
}

/**
 * Serializable representation of a QTI baseType="file" response.
 * (We cannot store a browser File object in session state / JSON exports.)
 */
export interface QTIFileResponse {
	name: string;
	type: string;
	size: number;
	lastModified: number;
	/** Base64 data URL, e.g. data:application/pdf;base64,... */
	dataUrl: string;
	/**
	 * Optional ImageData extracted from canvas (for drawing interactions).
	 * This allows custom operators to analyze drawing content synchronously
	 * without needing to decode the dataUrl asynchronously.
	 */
	imageData?: {
		data: Uint8ClampedArray;
		width: number;
		height: number;
	};
}

export interface ModalFeedback {
	/** Unique identifier for this feedback block */
	identifier: string;
	/** Outcome variable identifier this feedback is tied to */
	outcomeIdentifier: string;
	/** When to show: 'show' means display when outcome matches identifier */
	showHide: 'show' | 'hide';
	/** HTML content to display */
	content: HtmlContent;
	/** Optional title for the feedback */
	title?: string;
}

export interface ScoringResult {
	score: number;
	maxScore: number;
	completed: boolean;
	outcomeValues: Record<string, any>;
	/** Modal feedback elements that should be displayed based on outcome values */
	modalFeedback?: ModalFeedback[];
}

/**
 * QTI 2.2 completionStatus values for adaptive items
 * - not_attempted: No interaction has occurred yet
 * - unknown: Response exists but hasn't been scored/evaluated
 * - incomplete: Item has been scored but is still active (can submit again)
 * - completed: Item is finished (final state)
 */
export type CompletionStatus = 'not_attempted' | 'unknown' | 'incomplete' | 'completed';

/**
 * Extended scoring result for adaptive items with multi-attempt support
 */
export interface AdaptiveAttemptResult extends ScoringResult {
	/** Number of attempts made so far */
	numAttempts: number;
	/** Current completion status of the item */
	completionStatus: CompletionStatus;
	/** Whether the item can accept more submissions */
	canContinue: boolean;
}

/**
 * QTI role/view actors used for audience filtering (for example rubric/outcome visibility).
 * Runtime interaction behavior (readonly vs editable, correct-answer visibility) is a player
 * policy layered on top of these roles.
 */
export type QTIRole = 'candidate' | 'scorer' | 'proctor' | 'testConstructor' | 'tutor' | 'author';

export type RubricBlockScope = 'direct' | 'itemBody';

export interface RubricBlockOptions {
	/**
	 * `direct` rubrics are assessment-item children and are intended for host placement.
	 * `itemBody` rubrics are authored in the visible item body flow.
	 */
	scope?: RubricBlockScope | 'all';
}

export interface RubricBlock {
	view: string[]; // Array of role strings that can see this rubric
	html: HtmlContent; // HTML content of the rubric
	scope: RubricBlockScope;
	use?: string;
}

/**
 * QTI specification compliance configuration.
 * Controls whether the player enforces strict QTI 2.2 spec or allows vendor extensions.
 */
export interface QTIComplianceConfig {
	/** Enable strict QTI 2.2 compliance mode. Default: false (lenient) */
	enabled?: boolean;

	/** Reject items with unknown or non-standard elements. Default: false */
	rejectUnknownExtensions?: boolean;

	/** Log warnings for spec deviations and vendor extensions. Default: true */
	logDeviations?: boolean;
}

export interface PlayerConfig {
	itemXml?: string;
	/**
	 * QTI 3.0 §6.2 Personal Needs and Preferences profile.
	 * Color scheme is applied immediately as data-qti-colorscheme on the player root.
	 * Use player.updatePnp() to change mid-session without re-parsing the item.
	 */
	pnp?: import('../pnp/types.js').PnpProfile;
	/**
	 * Optional shared catalog XML string (QTI 3.0 §6.3).
	 * Parsed and merged with any catalog embedded in the item XML.
	 * Item-level catalog entries take precedence over shared entries with the same identifier.
	 * Deferred: external catalog files from IMS manifest (G-15) are not yet supported.
	 */
	catalogXml?: string;
	/**
	 * Optional resolved delivery context produced by IMS package/assessment layers.
	 * This is additive to catalogXml: shared catalog sources are merged first, then
	 * catalogXml, then item-embedded catalog entries so item-local entries win.
	 */
	deliveryContext?: ResolvedItemDeliveryContext;
	sessionState?: ItemSessionState;
	responses?: InteractionResponse;
	role?: QTIRole;
	/** Optional seed for deterministic random operations (e.g. templateProcessing randomInteger) */
	seed?: number;
	/** Optional RNG override (takes precedence over seed if provided) */
	rng?: () => number;
	/**
	 * Optional element name mapper for handling different QTI versions.
	 * Defaults to Qti2xElementNameMapper (primary supported QTI format).
	 * @since 0.2.0
	 */
	elementNameMapper?: any; // Will be ElementNameMapper from @pie-qti/qti-common
	/**
	 * Optional attribute name mapper for handling different QTI versions.
	 * Defaults to Qti2xAttributeNameMapper (primary supported QTI format).
	 * @since 0.3.0
	 */
	attributeNameMapper?: any; // Will be AttributeNameMapper from @pie-qti/qti-common
	/** Optional web component registry for custom interaction components */
	componentRegistry?: any; // Will be ComponentRegistry, but avoiding circular dependency
	/** Optional extraction registry for custom element extractors */
	extractionRegistry?: any; // Will be ExtractionRegistry, but avoiding circular dependency
	/** Optional plugins to extend player functionality */
	plugins?: any[]; // Will be QTIPlugin[], but avoiding circular dependency
	/**
	 * Optional i18n provider for internationalization.
	 * If not provided, defaults to DefaultI18nProvider with English messages.
	 */
	i18nProvider?: any; // Will be I18nProvider from @pie-qti/i18n
	/**
	 * Optional registry for executing QTI <customOperator> expressions.
	 * Keyed by operator `class` (preferred) or `definition` URI.
	 */
	customOperators?: Record<string, (args: QtiValue[], meta: { class?: string; definition?: string }) => QtiValue>;
	/**
	 * Optional base URL for resolving relative PCI module paths.
	 * Defaults to document.baseURI when running in a browser.
	 */
	pciBaseUrl?: string;

	/**
	 * Security-related controls for untrusted QTI rendered into the host DOM.
	 * Defaults are conservative for same-DOM embedding.
	 */
	security?: PlayerSecurityConfig;

	/**
	 * QTI specification compliance settings.
	 * Set strictQtiCompliance.enabled = true for strict QTI 2.2 validation.
	 */
	strictQtiCompliance?: QTIComplianceConfig;
}

export interface UrlPolicyConfig {
	/**
	 * Optional base URL used to resolve relative asset URLs (e.g. images/media).
	 * If omitted, relative URLs are preserved as-is.
	 */
	assetBaseUrl?: string;
	/** Allow https: URLs */
	allowHttps?: boolean;
	/** Allow http: URLs (default false; prefer https) */
	allowHttp?: boolean;
	/** Allow protocol-relative URLs (e.g. //cdn.example/asset). Default false. */
	allowProtocolRelative?: boolean;
	/** Allow data:image/* for <img src>. */
	allowDataImages?: boolean;
	/** Allow data:image/svg+xml (default false) */
	allowSvgDataImages?: boolean;
	/** Optional allowlist of hostnames for absolute URLs (exact match). */
	allowedHosts?: string[];
}

/**
 * Trusted Types support:
 * - When enabled and supported by the host browser + CSP, HTML-returning APIs may return TrustedHTML instead of string.
 * - When not enabled (default), APIs return plain strings as before.
 */
export type TrustedTypesHtml = typeof globalThis extends { TrustedHTML: infer T } ? T : never;
export type HtmlContent = string | TrustedTypesHtml;

export interface PlayerSecurityConfig {
	/** URL policy applied to extracted URL fields and HTML attribute URLs */
	urlPolicy?: UrlPolicyConfig;
	/** Allow <object>/<embed> usage (default false) */
	allowObjectEmbeds?: boolean;
	/** Allow <iframe> usage (default false) */
	allowIframes?: boolean;
	/**
	 * Optional parsing/processing guardrails to reduce DoS risk from untrusted QTI.
	 * Disabled by default for compatibility.
	 */
	parsingLimits?: ParsingLimitsConfig;
	/**
	 * Optional Trusted Types policy name (host-controlled).
	 * When set, and Trusted Types is available, the player will produce TrustedHTML for HTML injection sinks.
	 *
	 * Note: this is only effective when the host enables Trusted Types via CSP.
	 */
	trustedTypesPolicyName?: string;
}

export interface ParsingLimitsConfig {
	/**
	 * Enables parsing limits. When false/undefined, the player behaves exactly as before (compat default).
	 */
	enabled?: boolean;
	/**
	 * Reject any XML containing <!DOCTYPE ...> (case-insensitive) when enabled.
	 * Helps reduce entity-expansion and other parser edge-case risks.
	 */
	rejectDoctype?: boolean;
	/**
	 * Maximum bytes for `itemXml` input (UTF-8). Enforced when enabled.
	 */
	maxItemXmlBytes?: number;
	/**
	 * Maximum bytes for HTML strings passed to sanitizer (UTF-8). Enforced when enabled.
	 */
	maxHtmlBytes?: number;
	/**
	 * Maximum number of element nodes sanitized per HTML input. Enforced when enabled.
	 */
	maxHtmlNodes?: number;
	/**
	 * Maximum element depth sanitized per HTML input. Enforced when enabled.
	 */
	maxHtmlDepth?: number;
}

export interface InteractionContext {
	responseIdentifier: string;
	maxChoices?: number;
	minChoices?: number;
	shuffle?: boolean;
	orientation?: 'horizontal' | 'vertical';
}

// Interaction data shapes for the component/plugin system.
// Exported here so consumers can import them from `@pie-qti/item-player`.
export type * from '../interactions/index.js';
export * from './responseValidation.js';
