/**
 * Core QTI types for the player
 */

import type { I18nProvider } from '@pie-qti/i18n';
import type {
	BaseType as ProcessingBaseType,
	Cardinality as ProcessingCardinality,
	ProcessingFragmentResolver,
	QtiValue,
	StringComparisonOptions,
} from '@pie-qti/qti-processing';
import type {
	AttributeNameMapper,
	ElementNameMapper,
	QtiVersion,
} from '@pie-qti/qti-common';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { PciConfiguration } from '../pci/types.js';
import type { ComponentRegistry } from '../core/ComponentRegistry.js';
import type { ExtractionRegistry } from '../extraction/ExtractionRegistry.js';
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
	/** Omitted for record cardinality. */
	baseType?: VariableBaseType;
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

/** @internal Private engine snapshot shape; use SerializedItemSessionState. */
export interface ItemSessionState {
	[variableId: string]: any;
}

export type ItemLifecycleStatus = 'initial' | 'interacting' | 'suspended' | 'closed' | 'review' | 'solution' | 'answer';

export type SerializedVariableKind = 'response' | 'outcome' | 'template' | 'context';

export interface SerializedItemSessionVariable {
	identifier: string;
	kind: SerializedVariableKind;
	/** Omitted for record cardinality. */
	baseType?: VariableBaseType;
	cardinality: VariableCardinality;
	value: any;
	/**
	 * The variable's default value for this session, which a setDefaultValue
	 * template rule can change (QTI 2.1 ASI §8 / QTI 3.0 ASI §10: template-rule
	 * effects are fixed for the session); null when the variable has no default
	 * value. Restore applies it as-is, so null restores a NULL default rather
	 * than the default parsed from the item XML.
	 */
	defaultValue: any;
	/**
	 * The response declaration's correct response for this session, including one
	 * computed by a setCorrectResponse template rule (QTI 2.1 ASI §8 / QTI 3.0 ASI
	 * §10: template-rule effects are fixed for the session). Present on every
	 * response variable that has or had a correct response, with null meaning the
	 * correct response is NULL; absent when the variable has no correct response.
	 * Restore applies it as-is when present.
	 */
	correctResponse?: any;
}

export interface SerializedItemSessionState {
	itemIdentifier?: string;
	sessionGuid: string;
	lifecycleStatus: ItemLifecycleStatus;
	completionStatus: CompletionStatus;
	numAttempts: number;
	/**
	 * Time on task in milliseconds. The QTI built-in `duration` variable (in
	 * `contextVariables.duration`) holds the same time in seconds, as QTI defines it.
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
	/** Time on task in milliseconds; the QTI `duration` variable holds it in seconds. */
	duration: number;
	completed: boolean;
	sessionState: SerializedItemSessionState;
	validation?: ResponseValidationResult;
	scoring?: ScoringResult;
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
	/**
	 * Whether every declared response matches its correct response; absent when the item has no
	 * response or one declares no correct response.
	 */
	correct?: boolean;
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

/**
 * Why an item player reported a failure, as `error.code`. The `message` is raw engine or
 * parser text for host logs only — never render it to candidates.
 */
export type ItemPlayerErrorCode =
	| 'item-load-failed'
	| 'response-processing-failed'
	| 'submission-failed'
	| 'render-failed';

/** A player failure as hosts receive it: a stable `code`, the raw `message`, and the item when known. */
export interface ItemPlayerErrorDetail {
	code: ItemPlayerErrorCode;
	/** Raw message, for logs and host diagnostics — never render it to candidates. */
	message: string;
	itemIdentifier?: string;
}

export type RubricBlockScope = 'direct' | 'itemBody';

/** @internal Private engine rubric query. */
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
 * QTI compliance checks run once, when the item compiles. They are not an XSD validator: they check
 * the version's namespace, every element name against the XSD-verified QTI 2.2 / 3.0 vocabulary
 * (unknown QTI-namespace elements, and unknown `qti-` elements in QTI 3.0), interactions whose
 * `responseIdentifier` names no responseDeclaration, QTI interactions with no
 * `responseIdentifier`, and response-bound elements no registered extractor renders.
 *
 * Findings are listed on `AssessmentItemDefinition.diagnostics`: warnings by default, errors in
 * strict mode. An unsupported `responseProcessing@template` always fails compilation with an
 * `UnsupportedResponseProcessingTemplateError`, strict or not.
 */
export interface QTIComplianceConfig {
	/**
	 * Strict mode: findings are errors, and items in versions other than QTI 2.2 and 3.0 (the
	 * certifiable versions) are findings too. Default: false (findings are warnings).
	 */
	enabled?: boolean;

	/** In strict mode, throw a `QtiComplianceError` listing every finding instead of compiling. Default: false */
	rejectUnknownExtensions?: boolean;

	/** Write findings to the console (errors in strict mode, warnings otherwise). Default: true */
	logDeviations?: boolean;
}

/** @internal Configuration for the private item-session engine. */
export interface ItemSessionEngineConfig {
	itemXml: string;
	/**
	 * QTI 3.0 §6.2 Personal Needs and Preferences profile.
	 * Display needs are applied as attributes and custom properties on the player root.
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
	role?: QTIRole;
	/**
	 * Values for the item's context variables, set before template processing: `QTI_CONTEXT`, a
	 * record, and any declared by `contextDeclaration` (`qti-context-declaration`).
	 */
	contextVariables?: Readonly<Record<string, unknown>>;
	/**
	 * Default values for template variables, set before template processing and kept by
	 * `newTemplate`, as an assessmentItemRef's `templateDefault` requires.
	 */
	templateDefaults?: Readonly<Record<string, unknown>>;
	/** Optional seed for deterministic random operations (e.g. templateProcessing randomInteger) */
	seed?: number;
	/** Optional RNG override (takes precedence over seed if provided) */
	rng?: () => number;
	/**
	 * Optional element name mapper for handling different QTI versions.
	 * Defaults to Qti2xElementNameMapper (primary supported QTI format).
	 * @since 0.2.0
	 */
	elementNameMapper?: ElementNameMapper;
	/**
	 * Optional attribute name mapper for handling different QTI versions.
	 * Defaults to Qti2xAttributeNameMapper (primary supported QTI format).
	 * @since 0.3.0
	 */
	attributeNameMapper?: AttributeNameMapper;
	/**
	 * The item's detected QTI version, applied by extractors that carry per-version spec
	 * defaults (e.g. graphicGapMatchInteraction maxAssociations). Detected from the item
	 * XML when not supplied.
	 */
	qtiVersion?: QtiVersion;
	/** Optional web component registry for custom interaction components */
	componentRegistry?: ComponentRegistry;
	/** Optional extraction registry for custom element extractors */
	extractionRegistry?: ExtractionRegistry;
	/**
	 * Optional i18n provider for internationalization.
	 * If not provided, defaults to DefaultI18nProvider with English messages.
	 */
	i18nProvider?: I18nProvider;
	/**
	 * Optional registry for executing QTI <customOperator> expressions.
	 * Keyed by operator `class` (preferred) or `definition` URI.
	 */
	customOperators?: Record<string, (args: QtiValue[], meta: { class?: string; definition?: string }) => QtiValue>;
	/** String comparison folds beyond QTI's equality; see `AssessmentItemDefinitionConfig.stringComparison`. */
	stringComparison?: StringComparisonOptions;
	/**
	 * Host-controlled resolver for xi:include processing fragments.
	 * The player never fetches an authored href directly; package hosts must resolve
	 * and containment-check it, then return XML synchronously.
	 */
	resolveProcessingFragment?: ProcessingFragmentResolver;
	/** Resource limits applied cumulatively while compiling external processing fragments. */
	processingFragmentLimits?: {
		/** Maximum nested xi:include depth. Default: 16. */
		maxDepth?: number;
		/** Maximum cumulative XML characters. Default: 2 MiB. */
		maxCharacters?: number;
	};
	/**
	 * Portable Custom Interaction runtime configuration.
	 * A moduleResolver is required before any authored PCI code can execute.
	 */
	pci?: PciConfiguration;
	/**
	 * Security-related controls for untrusted QTI rendered into the host DOM.
	 * Defaults are conservative for same-DOM embedding.
	 */
	security?: PlayerSecurityConfig;

	/**
	 * QTI compliance checks; see `QTIComplianceConfig`. Set `enabled` for strict mode.
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
	/** Allow blob: URLs for package-resolved images (default false). */
	allowBlobImages?: boolean;
	/** Allow blob: URLs for package-resolved audio/video media (default false). */
	allowBlobMedia?: boolean;
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
	 * Parsing/processing guardrails that reduce DoS risk from untrusted QTI. On by default;
	 * `parsingLimits.enabled: false` opts out.
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
	 * The limits apply unless this is `false`. Opt out only for trusted content that needs more
	 * than the limits allow (or a DOCTYPE), never to accept untrusted QTI.
	 */
	enabled?: boolean;
	/**
	 * Reject any XML containing <!DOCTYPE ...> (case-insensitive). Default true.
	 * Helps reduce entity-expansion and other parser edge-case risks.
	 */
	rejectDoctype?: boolean;
	/**
	 * Maximum bytes for `itemXml` input (UTF-8). Default 10,000,000.
	 */
	maxItemXmlBytes?: number;
	/**
	 * Maximum bytes for HTML strings passed to the sanitizer (UTF-8). Default 5,000,000.
	 */
	maxHtmlBytes?: number;
	/**
	 * Maximum number of element nodes sanitized per HTML input. Default 200,000.
	 */
	maxHtmlNodes?: number;
	/**
	 * Maximum element depth sanitized per HTML input. Default 200.
	 */
	maxHtmlDepth?: number;
}

export * from './responseValidation.js';
