/** Framework-neutral public contracts for @pie-qti/player-elements. */

export type QtiRole =
	| 'candidate'
	| 'scorer'
	| 'proctor'
	| 'testConstructor'
	| 'tutor'
	| 'author';

export interface QtiI18nProvider {
	t(
		key: string,
		fallbackOrParams?: string | Record<string, unknown>,
		params?: Record<string, unknown>,
	): string;
}

export interface QtiUrlPolicyConfig {
	assetBaseUrl?: string;
	allowHttps?: boolean;
	allowHttp?: boolean;
	allowProtocolRelative?: boolean;
	allowDataImages?: boolean;
	allowSvgDataImages?: boolean;
	allowBlobImages?: boolean;
	allowBlobMedia?: boolean;
	allowedHosts?: string[];
}

export interface QtiParsingLimitsConfig {
	enabled?: boolean;
	rejectDoctype?: boolean;
	maxItemXmlBytes?: number;
	maxHtmlBytes?: number;
	maxHtmlNodes?: number;
	maxHtmlDepth?: number;
}

export interface QtiPlayerSecurityConfig {
	urlPolicy?: QtiUrlPolicyConfig;
	allowObjectEmbeds?: boolean;
	allowIframes?: boolean;
	parsingLimits?: QtiParsingLimitsConfig;
	trustedTypesPolicyName?: string;
}

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

export interface QtiPciConfiguration {
	baseUrl?: string;
	moduleResolver: QtiPciModuleResolver;
}

export interface QtiPnpProfile {
	display?: {
		colorScheme?: string;
		magnification?: number;
	};
	content?: {
		glossaryOnScreen?: boolean;
		keywordTranslation?: { active: boolean; languageCode: string };
		illustratedGlossary?: boolean;
		catalogSupports?: Record<
			string,
			boolean | { active?: boolean; languageCode?: string } | undefined
		>;
		extendedTime?: { active: boolean; multiplier: number };
	};
	cognitive?: {
		eliminationTool?: boolean;
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
	scope: 'item' | 'stimulus';
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

export interface QtiResolvedItemDeliveryContext {
	itemHref?: string;
	stimuli: Record<string, QtiResolvedAssessmentStimulus>;
	stylesheets: QtiResolvedStylesheetRef[];
	catalogSources: QtiResolvedCatalogSource[];
	validationMessages: string[];
}

export interface QtiScoringResult {
	score: number;
	maxScore: number;
	completed: boolean;
	outcomeValues: Record<string, unknown>;
	modalFeedback?: QtiModalFeedback[];
}

export interface QtiModalFeedback {
	identifier: string;
	outcomeIdentifier: string;
	showHide: 'show' | 'hide';
	content: string;
	title?: string;
}

export type QtiCompletionStatus =
	| 'not_attempted'
	| 'unknown'
	| 'incomplete'
	| 'completed';

export interface QtiAdaptiveAttemptResult extends QtiScoringResult {
	numAttempts: number;
	completionStatus: QtiCompletionStatus;
	canContinue: boolean;
}

export type QtiItemPlayerResponseMap = Record<string, unknown>;
export type QtiItemPlayerSubmissionResult = QtiScoringResult | QtiAdaptiveAttemptResult;

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

export interface QtiItemPlayerEventMap {
	'response-change': CustomEvent<QtiItemPlayerResponseChangeDetail>;
	ready: CustomEvent<void>;
	submit: CustomEvent<QtiItemPlayerSubmitDetail>;
	complete: CustomEvent<QtiItemPlayerCompleteDetail>;
}

export interface QtiItemPlayerElement extends HTMLElement {
	itemXml: string | undefined;
	role: QtiRole | null;
	disabled: boolean | undefined;
	renderItemBodyRubrics: boolean | undefined;
	typeset?: (element: HTMLElement) => void;
	i18n?: QtiI18nProvider;
	security?: QtiPlayerSecurityConfig;
	pnp?: QtiPnpProfile;
	deliveryContext?: QtiResolvedItemDeliveryContext;
	pci?: QtiPciConfiguration;
	resolveProcessingFragment?: QtiProcessingFragmentResolver;
	processingFragmentLimits?: QtiProcessingFragmentLimits;
	responses?: QtiItemPlayerResponseMap;
	onResponseChange?: (responseId: string, value: unknown) => void;
	onSubmit?: (
		responses: QtiItemPlayerResponseMap,
		result: QtiItemPlayerSubmissionResult,
	) => void;
	onComplete?: (result: QtiAdaptiveAttemptResult) => void;
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

export interface QtiTimeLimits {
	minTime?: number;
	maxTime?: number;
	allowLateSubmission?: boolean;
}

export interface QtiAssessmentRubricBlock {
	identifier?: string;
	content: string;
	view: QtiRole[];
	use?: string;
}

export interface QtiItemSessionControl {
	maxAttempts?: number;
	showFeedback?: boolean;
	allowReview?: boolean;
	showSolution?: boolean;
	allowComment?: boolean;
	allowSkipping?: boolean;
	validateResponses?: boolean;
}

export interface QtiSecureItemRef {
	identifier: string;
	itemXml: string;
	role: QtiRole;
	required?: boolean;
	fixed?: boolean;
	timeLimits?: QtiTimeLimits;
	deliveryContext?: QtiResolvedItemDeliveryContext;
	branchRule?: Array<{ target: string; conditionXml?: string }>;
	preConditions?: string[];
	weights?: Array<{ identifier: string; value: number }>;
}

export type QtiSecureSectionComponent =
	| { type: 'item'; item: QtiSecureItemRef }
	| { type: 'section'; section: QtiSecureSection };

export interface QtiSecureSection {
	identifier: string;
	title?: string;
	required?: boolean;
	fixed?: boolean;
	visible: boolean;
	assessmentItemRefs: QtiSecureItemRef[];
	sections?: QtiSecureSection[];
	children?: QtiSecureSectionComponent[];
	timeLimits?: QtiTimeLimits;
	rubricBlocks?: QtiAssessmentRubricBlock[];
	selection?: { select: number; withReplacement?: boolean };
	ordering?: { shuffle: boolean };
	preConditions?: string[];
	itemSessionControl?: QtiItemSessionControl;
}

export interface QtiSecureTestPart {
	identifier: string;
	navigationMode?: 'linear' | 'nonlinear';
	submissionMode?: 'individual' | 'simultaneous';
	sections: QtiSecureSection[];
	timeLimits?: QtiTimeLimits;
	rubricBlocks?: QtiAssessmentRubricBlock[];
	itemSessionControl?: QtiItemSessionControl;
}

export interface QtiSecureAssessment {
	identifier: string;
	title: string;
	navigationMode: 'linear' | 'nonlinear';
	submissionMode: 'individual' | 'simultaneous';
	testParts: QtiSecureTestPart[];
	timeLimits?: QtiTimeLimits;
	outcomeDeclarations?: Array<{
		identifier: string;
		baseType: string;
		cardinality: string;
		defaultValue?: unknown;
	}>;
	outcomeProcessingXml?: string;
	baseUrl?: string;
	testFeedback?: Array<{
		identifier: string;
		outcomeIdentifier: string;
		showHide: 'show' | 'hide';
		access: 'atEnd' | 'during';
		content: string;
	}>;
}

export type QtiAssessmentResponseValue = unknown;

export interface QtiAssessmentScoringResult {
	itemIdentifier: string;
	score: number;
	maxScore: number;
	completed: boolean;
	outcomeValues: Record<string, unknown>;
	feedback?: Array<{
		content: string;
		type: 'correct' | 'incorrect' | 'hint' | 'solution';
	}>;
	correctResponse?: Record<string, QtiAssessmentResponseValue>;
}

export interface QtiAssessmentSessionState {
	currentItemIdentifier: string;
	visitedItems: string[];
	itemResponses: Record<string, Record<string, QtiAssessmentResponseValue>>;
	itemScores?: Record<string, QtiAssessmentScoringResult>;
	itemSessionStates?: Record<
		string,
		{
			itemIdentifier: string;
			attemptCount: number;
			isAnswered: boolean;
			isSubmitted: boolean;
			lastSubmissionTime?: number;
		}
	>;
	itemSessions?: Record<string, QtiSerializedItemSessionState>;
	timing: {
		startedAt: number;
		itemTimes: Record<string, number>;
		sectionTimes?: Record<string, number>;
		testPartTimes?: Record<string, number>;
		totalTime: number;
		currentItemIdentifier?: string;
		currentSectionIdentifier?: string;
		currentTestPartIdentifier?: string;
		isPaused?: boolean;
	};
}

export interface QtiAssessmentInitSessionRequest {
	assessmentId: string;
	candidateId: string;
	resumeSessionId?: string;
}

export interface QtiAssessmentInitSessionResponse {
	sessionId: string;
	assessment: QtiSecureAssessment;
	restoredState?: QtiAssessmentSessionState;
}

export interface QtiAssessmentSubmitResponsesRequest {
	sessionId: string;
	itemIdentifier: string;
	responses: Record<string, QtiAssessmentResponseValue>;
	submittedAt: number;
	timeSpent?: number;
	timing?: {
		scope: 'assessment' | 'testPart' | 'section' | 'item';
		elapsedMs: number;
		limitSeconds?: number;
		expired?: boolean;
		allowLateSubmission?: boolean;
	};
	itemSession?: QtiSerializedItemSessionState;
}

export interface QtiAssessmentSubmitResponsesResponse {
	success: boolean;
	result?: QtiAssessmentScoringResult;
	nextItemIdentifier?: string;
	updatedState?: QtiAssessmentSessionState;
	error?: string;
}

export interface QtiAssessmentFinalizeResponse {
	success: boolean;
	totalScore: number;
	maxScore: number;
	itemScores: Record<string, QtiAssessmentScoringResult>;
	feedback?: string;
	outcomes?: Record<string, string>;
	finalizedAt: number;
}

export interface QtiAssessmentBackend {
	initSession(
		request: QtiAssessmentInitSessionRequest,
	): Promise<QtiAssessmentInitSessionResponse>;
	submitResponses(
		request: QtiAssessmentSubmitResponsesRequest,
	): Promise<QtiAssessmentSubmitResponsesResponse>;
	saveState(request: {
		sessionId: string;
		state: QtiAssessmentSessionState;
	}): Promise<{ success: boolean; savedAt: number }>;
	finalizeAssessment(request: { sessionId: string }): Promise<QtiAssessmentFinalizeResponse>;
	resumeSession?(sessionId: string): Promise<QtiAssessmentInitSessionResponse>;
	queryItemBank?(request: {
		sessionId: string;
		bankId: string;
		count: number;
		withReplacement?: boolean;
		filters?: Record<string, unknown>;
	}): Promise<{ items: QtiSecureItemRef[]; selectedAt: number }>;
}

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
	rng?: () => number;
	extendedTextEditor?: string;
	i18nProvider?: QtiI18nProvider;
	security?: QtiPlayerSecurityConfig;
	pci?: QtiPciConfiguration;
	sectionHost?: QtiSectionRuntimeHost;
	sectionTools?: QtiSectionToolConfig[];
	passageTools?: QtiSectionToolConfig[];
	itemTools?: QtiSectionToolConfig[];
	sendItemSessionToBackend?: boolean;
	showSections?: boolean;
	allowSectionNavigation?: boolean;
	showProgress?: boolean;
	timeWarningThreshold?: number;
	pnp?: QtiPnpProfile;
}

export interface QtiAssessmentItemResult {
	itemIdentifier: string;
	score: number;
	maxScore: number;
	responses: Record<string, unknown>;
}

export interface QtiAssessmentResults {
	totalScore: number;
	maxScore: number;
	itemResults: QtiAssessmentItemResult[];
	completedAt: Date;
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
	next(): Promise<void>;
	previous(): Promise<void>;
	navigateTo(index: number): Promise<void>;
	navigateToSection(sectionIdentifier: string): Promise<void>;
	submit(): Promise<QtiAssessmentResults | undefined>;
	getResponses(): Record<string, unknown> | undefined;
	getState(): QtiAssessmentSessionState | undefined;
	restoreState(
		state: QtiAssessmentSessionState,
	): Promise<void> | undefined;
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

export interface QtiSectionItemRef {
	identifier: string;
	sourcePath?: string;
	href?: string;
	title?: string;
	itemXml: string;
	responses?: Record<string, unknown>;
	sessionSnapshot?: QtiSerializedItemSessionState;
	deliveryContext?: QtiResolvedItemDeliveryContext;
	tools?: QtiSectionToolConfig[];
	diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiSerializedItemSessionVariable {
	identifier: string;
	kind: 'response' | 'outcome' | 'template' | 'context';
	baseType?: string;
	cardinality: 'single' | 'multiple' | 'ordered' | 'record';
	value: unknown;
	defaultValue?: unknown;
}

export interface QtiSerializedItemSessionState {
	itemIdentifier?: string;
	sessionGuid: string;
	lifecycleStatus: 'initial' | 'interacting' | 'suspended' | 'closed' | 'review' | 'solution' | 'answer';
	completionStatus: QtiCompletionStatus;
	numAttempts: number;
	duration: number;
	responseVariables: Record<string, QtiSerializedItemSessionVariable>;
	outcomeVariables: Record<string, QtiSerializedItemSessionVariable>;
	templateVariables: Record<string, QtiSerializedItemSessionVariable>;
	contextVariables: Record<string, QtiSerializedItemSessionVariable>;
	validationMessages: unknown[];
	savedAt: string;
}

export interface QtiSectionDiagnostic {
	severity: 'info' | 'warning' | 'error';
	source: string;
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
	rawHtml?: string;
	html?: unknown;
}

export interface QtiSharedStimulus {
	identifier: string;
	href?: string;
	source?: string;
	bodyHtml?: unknown;
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
	typeset?: (root: HTMLElement) => void | Promise<void>;
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
