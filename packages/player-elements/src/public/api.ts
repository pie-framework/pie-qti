/** Framework-neutral public contracts for @pie-qti/player-elements. */

export type QtiRole = import('@pie-qti/item-player').QTIRole;

/** Deliberately a narrow structural subset of @pie-qti/i18n's I18nProvider: hosts may pass any
 * object that can resolve keys with fallbacks; widening it to the full provider would break
 * minimal implementers. */
export interface QtiI18nProvider {
	t(
		key: string,
		fallbackOrParams?: string | Record<string, unknown>,
		params?: Record<string, unknown>,
	): string;
}

export type QtiUrlPolicyConfig = import('@pie-qti/item-player').UrlPolicyConfig;

export type QtiParsingLimitsConfig = import('@pie-qti/item-player').ParsingLimitsConfig;

export type QtiPlayerSecurityConfig = import('@pie-qti/item-player').PlayerSecurityConfig;

export type QtiPciModulePathKind = 'primary' | 'fallback';

export interface QtiPciModuleResolutionContext {
	authoredPath: string;
	kind: QtiPciModulePathKind;
	responseIdentifier: string;
	customInteractionTypeIdentifier: string;
}

export type QtiPciModuleResolver = (
	resolvedUrl: string,
	context: QtiPciModuleResolutionContext,
) => Promise<unknown> | unknown;

/** The sandboxed engine's variant: a policy over module URLs, never an in-page evaluation. */
export type QtiPciModulePolicy = (resolvedUrl: string, context: QtiPciModuleResolutionContext) => void;

/** Mirror of `@pie-qti/item-player`'s PciSandboxConfiguration. */
export interface QtiPciSandboxConfiguration {
	/** Absolute URL of the deployed `@pie-qti/pci-runner` page on a cookieless origin. */
	runnerUrl: string;
	handshakeTimeoutMs?: number;
	pollIntervalMs?: number;
	registrationTimeoutMs?: number;
}

export interface QtiPciConfiguration {
	baseUrl?: string;
	/**
	 * The host trust decision for executing a PCI module in the page realm.
	 * Required unless `sandbox` is configured.
	 */
	moduleResolver?: QtiPciModuleResolver;
	/** Opt-in hardened execution in a sandboxed cross-origin runner frame. */
	sandbox?: QtiPciSandboxConfiguration;
	/** Optional allow-list applied to module URLs handed to the sandbox runner. */
	modulePolicy?: QtiPciModulePolicy;
}

/** DOM-facing mirror of @pie-qti/item-player's PnpProfile; kept hand-written until verified
 * field-for-field against upstream (PnpToolSupports is a named upstream type). */
export interface QtiPnpProfile {
	display?: {
		colorScheme?: string;
		magnification?: number;
		interfaceLanguage?: string;
		invertPolarity?: { foreground?: string; background?: string };
		singleColumn?: boolean;
		textAppearance?: {
			fontSize?: number;
			fontFamily?: string;
			fontColor?: string;
			backgroundColor?: string;
			lineHeight?: number;
			letterSpacing?: number;
			wordSpacing?: number;
		};
	};
	content?: {
		glossaryOnScreen?: boolean;
		keywordTranslation?: { active: boolean; languageCode: string };
		illustratedGlossary?: boolean;
		catalogSupports?: Record<
			string,
			boolean | { active?: boolean; languageCode?: string } | undefined
		>;
		extendedTime?: { active: boolean; multiplier: number; fixedMinutes?: number };
	};
	cognitive?: {
		eliminationTool?: boolean;
		answerMasking?: boolean;
	};
	tools?: {
		supports?: string[];
		prohibitedSupports?: string[];
		activateAtInit?: string[];
		toolParameters?: Record<string, Record<string, unknown>>;
	};
}

export interface QtiProcessingFragmentRequest {
	href: string;
	mode: 'template' | 'response' | 'outcome';
	scope: 'item' | 'test';
	depth: number;
}

export type QtiProcessingFragmentResolver = (
	request: QtiProcessingFragmentRequest,
) => string | Document | Element | null | undefined;

export interface QtiProcessingFragmentLimits {
	maxDepth?: number;
	maxCharacters?: number;
}

/**
 * Resolved package context passed through to the item renderer.
 * The contract is intentionally extensible because new QTI 3 delivery resources
 * can be added without coupling consumers to the internal package graph.
 */
/** Composite shapes produced by the element's package-resolution pipeline (ims-cp-core provenance
 * + stimulus scoping); not a 1:1 mirror of any single upstream type. */
export interface QtiResolvedStylesheetRef {
	href: string;
	type?: string;
	media?: string;
	xml: string;
	resolvedHref: string;
	source: 'item' | 'stimulus';
	stimulusIdentifier?: string;
	cssText?: string;
}

export interface QtiResolvedCatalogSource {
	/**
	 * `package` sources come from shared catalog files the manifest lists
	 * (`imsqti_catalog_xmlv3p0`) and hold the lowest precedence; `item` sources
	 * win identifier collisions over them (QTI 3.0 §6.3).
	 */
	scope: 'item' | 'stimulus' | 'package';
	xml: string;
	baseHref: string;
	stimulusIdentifier?: string;
}

export interface QtiResolvedAssessmentStimulus {
	identifier: string;
	href: string;
	resolvedHref: string;
	title?: string;
	lang?: string;
	bodyHtml: string;
	stylesheets: QtiResolvedStylesheetRef[];
	catalogSource?: QtiResolvedCatalogSource;
	validationMessages: string[];
}

export type QtiResolvedItemDeliveryContext = import('@pie-qti/item-player').ResolvedItemDeliveryContext;

export type QtiScoringResult = import('@pie-qti/item-player').ScoringResult;

/** HTML already finalized by the item player's configured content policy. */
export type QtiHtmlContent = import('@pie-qti/item-player').HtmlContent;

export type QtiModalFeedback = import('@pie-qti/item-player').ModalFeedback;

export type QtiCompletionStatus = import('@pie-qti/item-player').CompletionStatus;

export type QtiAdaptiveAttemptResult = import('@pie-qti/item-player').AdaptiveAttemptResult;

export type QtiItemPlayerResponseMap = Record<string, unknown>;
export type QtiItemPlayerSubmissionResult = QtiScoringResult | QtiAdaptiveAttemptResult;

/**
 * The authoritative live item session accepted by the item-player element.
 * Create and control it through @pie-qti/item-player; the element never owns an injected session.
 */
export type QtiItemSessionReference = import('@pie-qti/item-player').ItemSession;
export type QtiAssessmentItemDefinitionPlugin =
	import('@pie-qti/item-player').AssessmentItemDefinitionPlugin;

export interface QtiItemPlayerResponseChangeDetail {
	responseId: string;
	value: unknown;
	responses: QtiItemPlayerResponseMap;
}

export interface QtiItemPlayerSubmitDetail {
	responses: QtiItemPlayerResponseMap;
	result: QtiItemPlayerSubmissionResult;
}

export interface QtiItemPlayerCompleteDetail {
	result: QtiAdaptiveAttemptResult;
}

/** Why the item player reported a failure, as the `error` event's `detail.code`. */
export type QtiItemPlayerErrorCode = import('@pie-qti/item-player').ItemPlayerErrorCode;

/**
 * An item player failure: a stable `code`, the raw `message` for host logs — never render it
 * to candidates, who see a localized generic message — and the item when known.
 */
export type QtiItemPlayerErrorDetail = import('@pie-qti/item-player').ItemPlayerErrorDetail;

export interface QtiItemPlayerEventMap {
	'response-change': CustomEvent<QtiItemPlayerResponseChangeDetail>;
	/** Fires once per successful mount; a broken item fires `error` instead. */
	ready: CustomEvent<void>;
	submit: CustomEvent<QtiItemPlayerSubmitDetail>;
	complete: CustomEvent<QtiItemPlayerCompleteDetail>;
	error: CustomEvent<QtiItemPlayerErrorDetail>;
}

export interface QtiItemPlayerElement extends HTMLElement {
	itemXml: string | undefined;
	session?: QtiItemSessionReference;
	/**
	 * The QTI view the item renders for. Declaratively the `qti-role` attribute: a bare `role`
	 * attribute is the ARIA role. Unknown values render as `candidate`.
	 */
	role: QtiRole | null;
	disabled: boolean | undefined;
	/** Per-element interface locale, declaratively the `locale` attribute; needs `i18n`. */
	locale?: string | null;
	/**
	 * Standalone opt-in for integrated feedback (`show-feedback`); QTI's
	 * `itemSessionControl@showFeedback` default is false, so it is hidden unless set.
	 */
	showFeedback?: boolean;
	/** Standalone opt-in to show correct responses once the attempt ends (`show-solution`). */
	showSolution?: boolean;
	renderItemBodyRubrics: boolean | undefined;
	typeset?: (element: HTMLElement) => void;
	i18n?: QtiI18nProvider;
	security?: QtiPlayerSecurityConfig;
	pnp?: QtiPnpProfile;
	deliveryContext?: QtiResolvedItemDeliveryContext;
	pci?: QtiPciConfiguration;
	plugins?: readonly QtiAssessmentItemDefinitionPlugin[];
	resolveProcessingFragment?: QtiProcessingFragmentResolver;
	processingFragmentLimits?: QtiProcessingFragmentLimits;
	responses?: QtiItemPlayerResponseMap;
	submit(countAttempt?: boolean): QtiItemPlayerSubmissionResult | undefined;
	addEventListener<K extends keyof QtiItemPlayerEventMap>(
		type: K,
		listener: (this: QtiItemPlayerElement, event: QtiItemPlayerEventMap[K]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
}

export interface QtiItemPlayerElementConstructor {
	new (): QtiItemPlayerElement;
	readonly prototype: QtiItemPlayerElement;
	readonly observedAttributes: string[];
}

export type QtiTimeLimits = import('@pie-qti/assessment-player').SecureTimeLimits;

export type QtiAssessmentRubricBlock = import('@pie-qti/assessment-player').AssessmentRubricBlock;

export type QtiItemSessionControl = import('@pie-qti/assessment-player').SecureItemSessionControl;

export type QtiSecureItemRef = import('@pie-qti/assessment-player').SecureItemRef;

export type QtiSecureSectionComponent = import('@pie-qti/assessment-player').SecureSectionComponent;

export type QtiSecureSection = import('@pie-qti/assessment-player').SecureSection;

export type QtiSecureTestPart = import('@pie-qti/assessment-player').SecureTestPart;

export type QtiTestFeedback = import('@pie-qti/assessment-player').TestFeedbackItem;

/**
 * A test-level outcome value: a scalar for single cardinality, an array for multiple and ordered,
 * an object for record, and `null` for NULL.
 */
export type QtiTestOutcomeValue = import('@pie-qti/assessment-player').TestOutcomeValue;

export type QtiSecureAssessment = import('@pie-qti/assessment-player').SecureAssessment;

export type QtiAssessmentResponseValue = unknown;

export type QtiAssessmentScoringResult = import('@pie-qti/assessment-player').AssessmentScoringResult;

export type QtiAssessmentSessionState = import('@pie-qti/assessment-player').AssessmentSessionState;

export type QtiAssessmentInitSessionRequest = import('@pie-qti/assessment-player').InitSessionRequest;

export type QtiAssessmentInitSessionResponse = import('@pie-qti/assessment-player').InitSessionResponse;

export type QtiAssessmentSubmitResponsesRequest = import('@pie-qti/assessment-player').SubmitResponsesRequest;

export type QtiAssessmentSubmitResponsesResponse = import('@pie-qti/assessment-player').SubmitResponsesResponse;

export type QtiAssessmentFinalizeResponse = import('@pie-qti/assessment-player').FinalizeAssessmentResponse;

export type QtiAssessmentBackend = import('@pie-qti/assessment-player').BackendAdapter;

export interface QtiSectionToolConfig {
	toolId: string;
	label?: string;
	view?: string[];
	enabled?: boolean;
	scope?: 'section' | 'passage' | 'item';
	provider?: Record<string, unknown>;
	renderParams?: Record<string, unknown>;
}

export interface QtiPackageResolveContext {
	ownerHref?: string;
	referenceKind:
		| 'item'
		| 'passage'
		| 'stimulus'
		| 'stylesheet'
		| 'catalog-file'
		| 'asset'
		| 'source-xml';
}

export interface QtiSharedHtmlSanitizeContext {
	source?: string;
	kind: 'passage' | 'rubric' | 'stimulus' | 'test-feedback' | 'instructions';
}

export interface QtiAssetUrlPolicyContext {
	source?: string;
	kind: 'img' | 'media' | 'object' | 'link' | 'any';
}

export interface QtiSectionActiveItemChangeEvent {
	sectionIdentifier: string;
	itemIdentifier: string;
	itemIndex: number;
	itemCount: number;
}

export interface QtiSectionFrameworkError {
	sectionIdentifier?: string;
	itemIdentifier?: string;
	code: string;
	message: string;
	cause?: unknown;
}

export interface QtiSectionRuntimeHost {
	resolvePackageUrl?(
		href: string,
		context: QtiPackageResolveContext,
	): string | null;
	readPackageFile?(
		href: string,
		context: QtiPackageResolveContext,
	): Promise<string | Uint8Array | null>;
	sanitizeSharedHtml?(html: string, context: QtiSharedHtmlSanitizeContext): string;
	sanitizeAssetUrl?(href: string, context: QtiAssetUrlPolicyContext): string | null;
	onResponseDelta?(event: QtiSectionResponseDeltaDetail): void;
	onActiveItemChange?(event: QtiSectionActiveItemChangeEvent): void;
	onSnapshotChange?(snapshot: QtiSectionSnapshot): void;
	onFrameworkError?(error: QtiSectionFrameworkError): void;
}

export interface QtiAssessmentPlayerConfig {
	role?: QtiRole;
	/**
	 * Seeds selection and ordering when the element runs its built-in reference
	 * backend (reference/preview mode). Ignored in authoritative-backend
	 * delivery: there the backend draws selection and ordering at session
	 * start.
	 */
	rng?: () => number;
	plugins?: readonly QtiAssessmentItemDefinitionPlugin[];
	i18nProvider?: QtiI18nProvider;
	security?: QtiPlayerSecurityConfig;
	pci?: QtiPciConfiguration;
	sectionHost?: QtiSectionRuntimeHost;
	sectionTools?: QtiSectionToolConfig[];
	passageTools?: QtiSectionToolConfig[];
	itemTools?: QtiSectionToolConfig[];
	/**
	 * Send the serialized item session with each submission to a production backend (off by
	 * default: template variables can hold answer keys). Reference mode always sends it —
	 * its local backend scores from it (`requiresItemSession`).
	 */
	sendItemSessionToBackend?: boolean;
	showSections?: boolean;
	allowSectionNavigation?: boolean;
	showProgress?: boolean;
	/**
	 * Seconds before a time limit expires at which a warning is announced. Default 60 when unset;
	 * `0` turns this default warning off (`timeWarningThresholds` still announce).
	 */
	timeWarningThreshold?: number;
	/** Additional warning thresholds in seconds, e.g. `[300, 60]`; each is announced once per limit. */
	timeWarningThresholds?: number[];
	/** Opt-in begin gate, like the `begin-gate` attribute: delivery and the clocks wait for Begin. */
	beginGate?: boolean;
	pnp?: QtiPnpProfile;
	/**
	 * Shared catalog files from the content package manifest (resource type
	 * `imsqti_catalog_xmlv3p0`), as the host that read the manifest discovered
	 * them. Their entries back every item's `data-catalog-idref` terms; item-level
	 * catalogs win on identifier collisions.
	 */
	sharedCatalogs?: ReadonlyArray<{ href?: string; xml?: string }>;
}

export interface QtiAssessmentItemResult {
	itemIdentifier: string;
	score: number;
	maxScore: number;
	responses: Record<string, unknown>;
}

/**
 * Why the test ended: the candidate's submit, a time expiry, a proctor's forced submit,
 * or a QTI branch rule (`EXIT_TEST`, or an `EXIT_TESTPART`/`EXIT_SECTION` with nothing
 * following). An end that collects a delivery the time already closed — the whole test
 * expired, or a scope expiry left nothing open — is `expiry` whoever triggers it (the
 * automatic submission, the candidate's Submit after it failed, a proctor's force-submit).
 */
export type QtiAssessmentEndReason = 'candidate' | 'expiry' | 'proctor' | 'branch';

export interface QtiAssessmentResults {
	totalScore: number;
	maxScore: number;
	itemResults: QtiAssessmentItemResult[];
	completedAt: Date;
	/** Why the test ended in this delivery; absent for a session restored already finalized. */
	endReason?: QtiAssessmentEndReason;
}

export interface QtiAssessmentResponseChangeDetail {
	responses: Record<string, unknown>;
}

export interface QtiAssessmentItemChangeDetail {
	itemIndex: number;
	totalItems: number;
}

export interface QtiAssessmentSectionChangeDetail {
	sectionIndex: number;
	totalSections: number;
}

export interface QtiAssessmentSubmitDetail {
	results: QtiAssessmentResults;
}

export interface QtiAssessmentLoadErrorDetail {
	message: string;
}

/** Core/backend failure (`player-error`). Never render `message` to candidates. */
export interface QtiAssessmentErrorDetail {
	/** Stable code when the failure is a coded assessment-player error. */
	code?: string;
	message: string;
}

/**
 * A hard time limit ran out with no late submission (`time-expired`): the whole test —
 * the player then submits automatically (`autoFinalized`) — or a part, section or
 * question whose expiry left nothing to work on (`submissionRequired`).
 */
export interface QtiAssessmentTimeExpiredDetail {
	scope: 'assessment' | 'testPart' | 'section' | 'item';
	/** The expired scope's identifier; absent for the whole test. */
	identifier?: string;
	/** The player already submitted the test automatically. */
	autoFinalized: boolean;
	/** The candidate must submit now (auto-submit failed, or nothing unlocked remains). */
	submissionRequired: boolean;
}

/** A proctor pause started (`player-pause`); `reason` is the text the candidate sees. */
export interface QtiAssessmentPauseDetail {
	reason?: string;
}

/**
 * A test part, section or question limit ran out (`scope-time-expired`): its items
 * closed, and delivery moved on (`deliveryContinues`) or nothing open remains.
 */
export interface QtiAssessmentScopeTimeExpiredDetail {
	scope: 'testPart' | 'section' | 'item';
	identifier: string;
	deliveryContinues: boolean;
	/**
	 * The flat index of the open question delivery moves to (forward in the part, an open
	 * question earlier in a nonlinear part, or the next part); absent when the candidate
	 * was outside the expired scope, and at a dead end.
	 */
	nextIndex?: number;
}

/**
 * The session is terminal (`session-finalized`): finalized in this delivery
 * (`restored: false`, `endReason` says which path ended the test — the candidate's
 * submit, a time expiry, a proctor's force-submit, or a QTI branch rule), or restored
 * already finalized at mount (`restored: true`).
 */
export interface QtiAssessmentSessionFinalizedDetail {
	restored: boolean;
	results: QtiAssessmentResults;
	/** Why this delivery ended the test; absent when it was already finalized (`restored`). */
	endReason?: QtiAssessmentEndReason;
}

/** The countdown state a proctor console reads (`getTimeState()`). */
export interface QtiAssessmentTimeState {
	/** Whether any active scope carries a hard maximum. */
	limited: boolean;
	/** Seconds left on the nearest active maximum; null when nothing is limited. */
	remainingSeconds: number | null;
	elapsedSeconds: number;
	expired: boolean;
	scope: 'assessment' | 'testPart' | 'section' | 'item' | null;
	allowLateSubmission: boolean;
	/** Whether a proctor pause freezes the clocks. */
	paused: boolean;
	/** Whether delivery has begun (false behind the begin gate). */
	started: boolean;
}

export interface QtiAssessmentPlayerEventMap {
	ready: CustomEvent<void>;
	'load-start': CustomEvent<void>;
	'load-end': CustomEvent<void>;
	'load-error': CustomEvent<QtiAssessmentLoadErrorDetail>;
	'item-change': CustomEvent<QtiAssessmentItemChangeDetail>;
	'section-change': CustomEvent<QtiAssessmentSectionChangeDetail>;
	'response-change': CustomEvent<QtiAssessmentResponseChangeDetail>;
	submit: CustomEvent<QtiAssessmentSubmitDetail>;
	complete: CustomEvent<void>;
	'player-error': CustomEvent<QtiAssessmentErrorDetail>;
	'time-expired': CustomEvent<QtiAssessmentTimeExpiredDetail>;
	'scope-time-expired': CustomEvent<QtiAssessmentScopeTimeExpiredDetail>;
	'session-finalized': CustomEvent<QtiAssessmentSessionFinalizedDetail>;
	'player-pause': CustomEvent<QtiAssessmentPauseDetail>;
	'player-resume': CustomEvent<void>;
}

export type QtiItemMap = Record<string, string>;

export interface QtiItemFetchPolicy {
	maxItems?: number;
	maxItemBytes?: number;
	maxTotalBytes?: number;
	concurrency?: number;
	timeoutMs?: number;
	allowOutsideBase?: boolean;
}

export interface QtiAssessmentPlayerElement extends HTMLElement {
	config: QtiAssessmentPlayerConfig;
	security?: QtiPlayerSecurityConfig;
	pci?: QtiPciConfiguration;
	backend?: QtiAssessmentBackend;
	initSession?: QtiAssessmentInitSessionRequest;
	assessmentId?: string;
	candidateId?: string;
	referenceMode: boolean;
	assessmentTestXml: string | null;
	itemBaseUrl?: string;
	items?: QtiItemMap;
	itemFetchPolicy?: QtiItemFetchPolicy;
	/** Fill the viewport (`100dvh`, safe-area aware) instead of the element's box. Reflects `full-viewport`. */
	fullViewport: boolean;
	/** Heading level (1–6) of the assessment title; passage and item titles follow one below. Reflects `heading-level`. */
	headingLevel?: number;
	/** Opt-in begin gate: a start screen holds delivery and the clocks until Begin. Reflects `begin-gate`. */
	beginGate: boolean;
	/**
	 * Host opt-in: after finalization the completion screen may add a per-question
	 * results summary (answered state plus the backend's scores). Off by default, so
	 * high-stakes embeds keep showing no scores. Reflects `show-results-summary`.
	 */
	showResultsSummary: boolean;
	/**
	 * Whether the resume prompt offers "Start over" (default true). Start over clears the
	 * candidate's answers but keeps the time accounting. Reflects `allow-start-over`.
	 */
	allowStartOver: boolean;
	next(): Promise<void>;
	previous(): Promise<void>;
	navigateTo(index: number): Promise<void>;
	navigateToSection(sectionIdentifier: string): Promise<void>;
	/**
	 * End the test. `{ force: true }` is the proctor's force-submit: it ends the test
	 * during a pause too; a candidate's submit stays blocked while paused.
	 */
	submit(options?: { force?: boolean }): Promise<QtiAssessmentResults | undefined>;
	getResponses(): Record<string, unknown> | undefined;
	getState(): QtiAssessmentSessionState | undefined;
	restoreState(
		state: QtiAssessmentSessionState,
	): Promise<void> | undefined;
	/** Open the begin gate (as the candidate's Begin does): delivery and the clocks start. */
	start(): Promise<void>;
	/** Whether delivery has begun (false while the begin gate holds the start screen). */
	hasStarted(): boolean;
	/** Proctor pause: freeze every clock and block candidate input until `resume()`. */
	pause(reason?: string): void;
	/** End a proctor pause. */
	resume(): void;
	/** Whether a proctor pause is in force (a session restored paused reports it at mount). */
	isPaused(): boolean;
	/** The candidate-facing reason of the pause in force, if any. */
	getPauseReason(): string | undefined;
	/** Whether the session is terminal: finalized here, or restored already finalized. */
	isFinalized(): boolean;
	/** The countdown state for a proctor console; undefined before the session is ready. */
	getTimeState(): QtiAssessmentTimeState | undefined;
	/** Save the current draft now (best-effort). */
	flushAutosave(): Promise<void>;
	addEventListener<K extends keyof QtiAssessmentPlayerEventMap>(
		type: K,
		listener: (
			this: QtiAssessmentPlayerElement,
			event: QtiAssessmentPlayerEventMap[K],
		) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
}

export interface QtiAssessmentPlayerElementConstructor {
	new (): QtiAssessmentPlayerElement;
	readonly prototype: QtiAssessmentPlayerElement;
	readonly observedAttributes: string[];
}

interface QtiSectionItemRefBase {
	identifier: string;
	sourcePath?: string;
	href?: string;
	title?: string;
	itemXml: string;
	deliveryContext?: QtiResolvedItemDeliveryContext;
	tools?: QtiSectionToolConfig[];
	diagnostics?: QtiSectionDiagnostic[];
}

export type QtiSectionItemRef =
	| (QtiSectionItemRefBase & {
			session: QtiItemSessionReference;
			responses?: never;
	  })
	| (QtiSectionItemRefBase & {
			session?: undefined;
			responses?: Record<string, unknown>;
	  });

export type QtiSerializedItemSessionVariable = import('@pie-qti/item-player').SerializedItemSessionVariable;

export type QtiSerializedItemSessionState = import('@pie-qti/item-player').SerializedItemSessionState;

export type QtiSectionDiagnosticSource =
	| 'assessment-player'
	| 'host'
	| 'manifest'
	| 'assessment-test'
	| 'item'
	| 'stimulus'
	| 'security'
	| 'section-player';

export interface QtiSectionDiagnostic {
	severity: 'info' | 'warning' | 'error';
	source: QtiSectionDiagnosticSource;
	code: string;
	message: string;
	path?: string;
}

export interface QtiSharedHtmlBlock {
	identifier: string;
	kind: 'passage' | 'instructions' | 'rubric' | 'stimulus' | 'test-feedback';
	scope: 'assessment' | 'testPart' | 'section' | 'item' | 'stimulus';
	source?: string;
	view?: string[];
	tools?: QtiSectionToolConfig[];
	/** The passage or stimulus title; untitled passages get a neutral localized heading. */
	title?: string;
	rawHtml?: string;
	/** The block's content language, from its `xml:lang`; sets its `lang` and its read-aloud voice. */
	language?: string;
	html?: QtiHtmlContent;
}

export interface QtiSharedStimulus {
	identifier: string;
	href?: string;
	source?: string;
	bodyHtml?: QtiHtmlContent;
	rawBodyHtml?: string;
	stylesheets?: QtiSectionResolvedStylesheetRef[];
	catalogSource?: QtiSectionResolvedCatalogSource;
	diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiSectionResolvedStylesheetRef {
	href: string;
	resolvedHref?: string;
	renderHref?: string;
	browserHref?: string;
	source?: string;
}

export interface QtiSectionResolvedCatalogSource {
	scope: 'item' | 'stimulus' | 'section';
	xml: string;
	baseHref?: string;
	stimulusIdentifier?: string;
}

export interface QtiSectionSharedContext {
	passages: QtiSharedHtmlBlock[];
	stimuli: QtiSharedStimulus[];
	rubricBlocks: QtiSharedHtmlBlock[];
	testFeedback: QtiSharedHtmlBlock[];
	stylesheets: QtiSectionResolvedStylesheetRef[];
	catalogSources: QtiSectionResolvedCatalogSource[];
	assetDiagnostics: QtiSectionDiagnostic[];
}

export interface QtiSectionModel {
	identifier: string;
	title?: string;
	role?: QtiRole;
	view?: string[];
	layoutPreference?: 'split-pane' | 'vertical' | 'auto';
	navigationMode?: 'linear' | 'nonlinear';
	submissionMode?: 'individual' | 'simultaneous';
	tools?: QtiSectionToolConfig[];
	itemRefs: QtiSectionItemRef[];
	sharedContext?: QtiSectionSharedContext;
	diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiSectionSnapshot {
	sectionIdentifier: string;
	activeItemIdentifier: string;
	activeItemIndex: number;
	itemCount: number;
	responses: Record<string, Record<string, unknown>>;
}

export interface QtiSectionComposition {
	section: QtiSectionModel;
	activeItem: QtiSectionItemRef;
	activeItemIndex: number;
	sharedContext: QtiSectionSharedContext;
	layout: 'split-pane' | 'vertical';
	canPrevious: boolean;
	canNext: boolean;
	snapshot: QtiSectionSnapshot;
	diagnostics: QtiSectionDiagnostic[];
	security?: QtiPlayerSecurityConfig;
	host?: QtiSectionRuntimeHost;
}

export interface QtiSectionResponseDeltaDetail {
	sectionIdentifier: string;
	itemIdentifier: string;
	responseIdentifier: string;
	value: unknown;
}

export interface QtiSectionPlayerEventMap {
	'qti-section-response-delta': CustomEvent<QtiSectionResponseDeltaDetail>;
}

export interface QtiSectionPlayerElement extends HTMLElement {
	composition: QtiSectionComposition | null;
	security?: QtiPlayerSecurityConfig;
	pci?: QtiPciConfiguration;
	i18n?: QtiI18nProvider;
	typeset?: (root: HTMLElement) => void | Promise<void>;
	/** Heading level (1–6) of the passage and item titles. Default 3. Reflects `heading-level`. */
	headingLevel?: number;
	addEventListener<K extends keyof QtiSectionPlayerEventMap>(
		type: K,
		listener: (this: QtiSectionPlayerElement, event: QtiSectionPlayerEventMap[K]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
}

export interface QtiSectionPlayerSplitPaneElement extends QtiSectionPlayerElement {}

export interface QtiSectionPlayerVerticalElement extends QtiSectionPlayerElement {}

export interface QtiSectionPlayerElementConstructor {
	new (): QtiSectionPlayerElement;
	readonly prototype: QtiSectionPlayerElement;
}

export interface ParsedAssessmentItemRef {
	identifier: string;
	title?: string;
	href?: string;
	required?: boolean;
	itemXml?: string;
}

export interface ParsedAssessmentSection {
	identifier: string;
	title?: string;
	visible?: boolean;
	rubricBlocks?: QtiAssessmentRubricBlock[];
	assessmentItemRefs?: ParsedAssessmentItemRef[];
	sections?: ParsedAssessmentSection[];
}

export interface ParsedTestPart {
	identifier: string;
	navigationMode: 'linear' | 'nonlinear';
	submissionMode: 'individual' | 'simultaneous';
	sections: ParsedAssessmentSection[];
}

export interface ParsedAssessmentTest {
	identifier?: string;
	title?: string;
	testParts: ParsedTestPart[];
}

export interface ResolveItemsForAssessmentOptions {
	assessment: ParsedAssessmentTest;
	itemBaseUrl?: string;
	items?: QtiItemMap;
	security?: QtiPlayerSecurityConfig;
	fetchPolicy?: QtiItemFetchPolicy;
	fetch?: typeof globalThis.fetch;
	signal?: AbortSignal;
}
