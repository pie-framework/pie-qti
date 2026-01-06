/**
 * Core QTI types for the player
 */

import type { QtiValue } from '@pie-qti/qti-processing';

export type BaseType =
	| 'boolean'
	| 'integer'
	| 'float'
	| 'string'
	| 'point'
	| 'pair'
	| 'directedPair'
	| 'duration'
	| 'file'
	| 'uri'
	| 'intOrIdentifier'
	| 'identifier';

export type Cardinality = 'single' | 'multiple' | 'ordered' | 'record';

export interface VariableDeclaration {
	identifier: string;
	baseType: BaseType;
	cardinality: Cardinality;
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
	entries: Record<string, AreaMapEntry>;
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

export interface SessionState {
	[variableId: string]: any;
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
 * QTI 2.2 standard roles
 * - candidate: Student/test-taker
 * - scorer: Automated or human scoring system
 * - proctor: Test administrator/invigilator
 * - testConstructor: Test author/developer
 * - tutor: Instructional/learning mode
 * - author: Content author
 */
export type QTIRole = 'candidate' | 'scorer' | 'proctor' | 'testConstructor' | 'tutor' | 'author';

export interface RubricBlock {
	view: string[]; // Array of role strings that can see this rubric
	html: HtmlContent; // HTML content of the rubric
}

export interface PlayerConfig {
	itemXml?: string;
	sessionState?: SessionState;
	responses?: InteractionResponse;
	role?: QTIRole;
	/** Optional seed for deterministic random operations (e.g. templateProcessing randomInteger) */
	seed?: number;
	/** Optional RNG override (takes precedence over seed if provided) */
	rng?: () => number;
	/** Optional web component registry for custom interaction components */
	componentRegistry?: any; // Will be ComponentRegistry, but avoiding circular dependency
	/** Optional extraction registry for custom element extractors */
	extractionRegistry?: any; // Will be ExtractionRegistry, but avoiding circular dependency
	/** Optional plugins to extend player functionality */
	plugins?: any[]; // Will be QTIPlugin[], but avoiding circular dependency
	/**
	 * Optional registry for executing QTI <customOperator> expressions.
	 * Keyed by operator `class` (preferred) or `definition` URI.
	 */
	customOperators?: Record<string, (args: QtiValue[], meta: { class?: string; definition?: string }) => QtiValue>;

	/**
	 * Security-related controls for untrusted QTI rendered into the host DOM.
	 * Defaults are conservative for same-DOM embedding.
	 */
	security?: PlayerSecurityConfig;
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
// Exported here so consumers can import them from `@pie-qti/qti2-item-player`.
export * from './interactions.js';
export * from './responseValidation.js';
