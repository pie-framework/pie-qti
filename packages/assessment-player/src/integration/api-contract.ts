/**
 * QTI 2.2 Assessment Player - Backend Integration API Contract
 *
 * This file defines the secure API boundary between the client-side player
 * and backend services. The design prioritizes security by ensuring sensitive
 * data (correct answers, scoring rules) never reaches the client.
 *
 * ## Security Model
 *
 * - **Client-side**: Collects and submits candidate responses only
 * - **Server-side**: Stores QTI XML, performs scoring, validates submissions
 * - **Role-based**: Server controls what data client receives based on QTI role
 *
 * ## Reference Implementation
 *
 * See `ReferenceBackendAdapter.ts` for a simple localStorage-based implementation
 * that demonstrates the API contract without requiring a real backend.
 */

import type { QTIRole, ResolvedItemDeliveryContext, SerializedItemSessionState } from '@pie-qti/item-player';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Unique identifier for an assessment session
 * Format: "{assessmentId}:{candidateId}:{timestamp}" or similar
 */
export type SessionId = string;

/**
 * Initialize a new assessment session
 *
 * Security: Server validates candidate identity and assessment access
 */
export interface InitSessionRequest {
	/** Assessment identifier (QTI assessmentTest identifier) */
	assessmentId: string;
	/** Candidate identifier (from authentication system) */
	candidateId: string;
	/** Optional: Resume from existing session */
	resumeSessionId?: SessionId;
}

export interface InitSessionResponse {
	/** Unique session identifier for all subsequent requests */
	sessionId: SessionId;
	/** Assessment structure without sensitive data, as drawn for this session; a resume returns the same draw. */
	assessment: SecureAssessment;
	/** Restored state if resuming, undefined if new session */
	restoredState?: AssessmentSessionState;
	/**
	 * Item delivery starts at in a new session: the first item whose preconditions hold. A resumed
	 * session carries it in `restoredState`.
	 */
	currentItemIdentifier?: string;
	/** Test-level outcome values of a resumed session, once outcome processing has run */
	outcomes?: TestOutcomeValues;
}

/**
 * A test-level outcome value: a scalar for single cardinality, an array for multiple and ordered,
 * an object for record, and `null` for NULL.
 */
export type TestOutcomeValue =
	| string
	| number
	| boolean
	| null
	| Array<string | number | boolean | null>
	| Record<string, unknown>;

/** Test-level outcome values keyed by outcome identifier (e.g. "PASS", "GRADE"). */
export type TestOutcomeValues = Record<string, TestOutcomeValue>;

// ============================================================================
// ASSESSMENT STRUCTURE (CLIENT-SAFE)
// ============================================================================

/**
 * Assessment structure safe for client consumption
 *
 * Security: NO correct answers, NO scoring rules, NO sensitive rubrics
 */
export interface TestFeedbackItem {
	identifier: string;
	/** Outcome variable name to evaluate (e.g. "PASS", "GRADE") */
	outcomeIdentifier: string;
	/**
	 * 'show' = show when the outcome matches identifier (equality for a single value, membership
	 * for multiple and ordered); 'hide' = show when it does not
	 */
	showHide: 'show' | 'hide';
	/**
	 * 'atEnd' = once the test (or, for test-part feedback, the part) has ended;
	 * 'during' = whenever outcome processing has run
	 */
	access: 'atEnd' | 'during';
	/** HTML content to display */
	content: string;
}

export interface SecureTimeLimits {
	minTime?: number;
	maxTime?: number;
	allowLateSubmission?: boolean;
}

export interface SecureAssessment {
	identifier: string;
	title: string;
	/** Navigation mode affects UI */
	navigationMode: 'linear' | 'nonlinear';
	/** Submission mode affects when responses are finalized */
	submissionMode: 'individual' | 'simultaneous';
	/** Test parts contain sections */
	testParts: SecureTestPart[];
	/** Overall time limit in seconds (optional) */
	timeLimits?: SecureTimeLimits;
	/** QTI outcomeDeclarations for test-level variables */
	outcomeDeclarations?: Array<{
		identifier: string;
		baseType: string;
		cardinality: string;
		defaultValue?: unknown;
	}>;
	/** Raw <outcomeProcessing> XML string, if present */
	outcomeProcessingXml?: string;
	/** Base URL/path for resolving relative hrefs (e.g. assessmentSectionRef) */
	baseUrl?: string;
	/** QTI assessmentTest testFeedback blocks */
	testFeedback?: TestFeedbackItem[];
}

export interface SecureTestPart {
	identifier: string;
	/** Navigation and submission modes are scoped to each QTI testPart. */
	navigationMode?: 'linear' | 'nonlinear';
	submissionMode?: 'individual' | 'simultaneous';
	/** Sections contain items */
	sections: SecureSection[];
	/** TestPart-level time limit. */
	timeLimits?: SecureTimeLimits;
	/** Candidate instructions (safe for display) */
	rubricBlocks?: AssessmentRubricBlock[];
	/** QTI testPart testFeedback blocks */
	testFeedback?: TestFeedbackItem[];
	/**
	 * Item session control (QTI testPart/itemSessionControl). Each attribute cascades through every
	 * enclosing section to the item ref; the backend enforces maxAttempts.
	 */
	itemSessionControl?: SecureItemSessionControl;
	/** Serialized direct preCondition expressions, evaluated by the backend on entering the part. */
	preConditions?: string[];
	/** Branch rules the backend evaluates after the part's last item, in linear navigation. */
	branchRule?: SecureBranchRule[];
}

export interface SecureSection {
	identifier: string;
	title?: string;
	required?: boolean;
	fixed?: boolean;
	/** Visible determines if section appears in navigation */
	visible: boolean;
	/** Assessment item references, in the order the backend drew for this session. */
	assessmentItemRefs: SecureItemRef[];
	/** Nested QTI sections, retained instead of being flattened during XML ingestion. */
	sections?: SecureSection[];
	/**
	 * Direct delivery components in document order. When present, this is the
	 * authoritative order for mixed item/section children.
	 */
	children?: SecureSectionComponent[];
	/** Section-level time limit */
	timeLimits?: SecureTimeLimits;
	/** Candidate instructions (safe for display) */
	rubricBlocks?: AssessmentRubricBlock[];
	/**
	 * QTI selection: how many children to present from this section. Backends draw selection when
	 * the session starts and return the drawn assessment without it; the client never draws.
	 */
	selection?: {
		/** Number of items selected for this session */
		select: number;
		withReplacement?: boolean;
	};
	/** QTI ordering: whether non-fixed children are shuffled. Backends apply it with selection. */
	ordering?: {
		shuffle: boolean;
	};
	/** Serialized direct preCondition expressions, evaluated by the backend. */
	preConditions?: string[];
	/** Branch rules the backend evaluates after the section's last item, in linear navigation. */
	branchRule?: SecureBranchRule[];
	/**
	 * QTI keepTogether, default true. An invisible section with keepTogether false has its children
	 * mixed into the parent's ordering; the backend applies it while drawing.
	 */
	keepTogether?: boolean;
	/**
	 * Item session control (QTI assessmentSection/itemSessionControl). Attributes set here override
	 * the enclosing section's and test part's.
	 */
	itemSessionControl?: SecureItemSessionControl;
}

/** QTI itemSessionControl. Absent attributes inherit from the enclosing section or test part. */
export interface SecureItemSessionControl {
	/** Default 1; 0 means unlimited. Adaptive items are unlimited whatever the value. */
	maxAttempts?: number;
	showFeedback?: boolean;
	allowReview?: boolean;
	showSolution?: boolean;
	allowComment?: boolean;
	allowSkipping?: boolean;
	validateResponses?: boolean;
}

export interface SecureBranchRule {
	/** Identifier of the target item, section or test part, or EXIT_TEST, EXIT_TESTPART or EXIT_SECTION. */
	target: string;
	/** Serialised QTI expression XML (the child of <branchRule>). Absent means unconditional. */
	conditionXml?: string;
}

export type SecureSectionComponent =
	| { type: 'item'; item: SecureItemRef }
	| { type: 'section'; section: SecureSection };

export interface SecureItemRef {
	/** Unique item identifier */
	identifier: string;
	/** Item XML WITHOUT responseProcessing if role is 'candidate' */
	itemXml: string;
	/** QTI role determines what's visible in itemXml */
	role: QTIRole;
	/** Required=true means item must be attempted */
	required?: boolean;
	fixed?: boolean;
	/** Item-ref-level time limit. */
	timeLimits?: SecureTimeLimits;
	/** Optional resolved QTI 3 delivery context. Additive; itemXml remains the compatibility path. */
	deliveryContext?: ResolvedItemDeliveryContext;
	/**
	 * QTI branchRule: ordered branch rules on this item. The backend evaluates them after scoring, in
	 * linear navigation, and returns the resolved target as nextItemIdentifier.
	 */
	branchRule?: SecureBranchRule[];
	/** Serialized direct preCondition expressions, evaluated by the backend. */
	preConditions?: string[];
	/** QTI item-ref weights, preserved for backend outcome processing. */
	weights?: Array<{ identifier: string; value: number }>;
	/** QTI item-ref categories, matched by includeCategory/excludeCategory in outcome processing. */
	categories?: string[];
	/** Item session control (assessmentItemRef/itemSessionControl), the innermost cascade level. */
	itemSessionControl?: SecureItemSessionControl;
	/** QTI variableMapping: item variables the test reads under another identifier. */
	variableMappings?: Array<{ sourceIdentifier: string; targetIdentifier: string }>;
	/**
	 * QTI templateDefault: serialized expressions, evaluated against test outcomes, that replace a
	 * template variable's default before template processing.
	 */
	templateDefaults?: Array<{ templateIdentifier: string; expressionXml: string }>;
}

export interface AssessmentRubricBlock {
	/** Optional rubric identifier (QTI rubricBlock@identifier) */
	identifier?: string;
	/** Rubric content (HTML) */
	content: string;
	/** View controls when rubric is shown */
	view: QTIRole[];
	/** Optional rubric use (QTI rubricBlock@use), e.g. "passage" */
	use?: string;
}

// ============================================================================
// RESPONSE SUBMISSION
// ============================================================================

/**
 * Submit responses for scoring
 *
 * Security: Client sends responses only, server performs scoring
 */
export interface SubmitResponsesRequest {
	sessionId: SessionId;
	/** Item identifier */
	itemIdentifier: string;
	/** Response data keyed by responseIdentifier */
	responses: Record<string, ResponseValue>;
	/** Client timestamp for analytics */
	submittedAt: number;
	/** Time spent on item (ms) for analytics */
	timeSpent?: number;
	/** Optional client timing evidence; production backends remain authoritative. */
	timing?: SubmitTimingEvidence;
	/**
	 * Serialized item session used by backends to restore template/context variables while scoring.
	 * Production backends should treat this as a client save format and validate against server-owned state.
	 */
	itemSession?: SerializedItemSessionState;
	/** Candidate comment, accepted only when the item's allowComment is on. */
	comment?: string;
}

export interface SubmitTimingEvidence {
	scope: 'assessment' | 'testPart' | 'section' | 'item';
	elapsedMs: number;
	limitSeconds?: number;
	expired?: boolean;
	allowLateSubmission?: boolean;
}

/**
 * Response value can be string, string[], or complex types
 */
export type ResponseValue = string | string[] | Record<string, any>;

export interface SubmitResponsesResponse {
	/** Was submission accepted? */
	success: boolean;
	/** Scoring result (if submission mode allows immediate scoring) */
	result?: AssessmentScoringResult;
	/**
	 * Backend-authoritative next item (branching/navigation decision).
	 * If omitted, client may fall back to linear next/previous UI navigation.
	 */
	nextItemIdentifier?: string;
	/**
	 * Backend-authoritative session state snapshot after applying the submission.
	 * If provided, client should replace its local state with this.
	 */
	updatedState?: AssessmentSessionState;
	/** Test-level outcome values after the outcome processing this submission triggers */
	outcomes?: TestOutcomeValues;
	/** Error message if success=false */
	error?: string;
}

// ============================================================================
// SCORING RESULTS
// ============================================================================

/**
 * Scoring result returned from server
 *
 * Security: Server computes this, client never sees scoring rules
 */
export interface AssessmentScoringResult {
	/** Item identifier */
	itemIdentifier: string;
	/** Normalized score 0.0-1.0 */
	score: number;
	/** Maximum possible score (usually 1.0) */
	maxScore: number;
	/** Was item completed? */
	completed: boolean;
	/** QTI outcome variables */
	outcomeValues: Record<string, any>;
	/** Feedback to display (role-dependent) */
	feedback?: FeedbackItem[];
	/** Correct response (only if role allows) */
	correctResponse?: Record<string, ResponseValue>;
}

export interface FeedbackItem {
	/** Feedback content (HTML) */
	content: string;
	/** Feedback type */
	type: 'correct' | 'incorrect' | 'hint' | 'solution';
}

// ============================================================================
// STATE PERSISTENCE
// ============================================================================

/**
 * Save assessment state
 *
 * Security: State includes responses but not scores (until finalized)
 */
export interface SaveAssessmentStateRequest {
	sessionId: SessionId;
	state: AssessmentSessionState;
}

export interface SaveAssessmentStateResponse {
	success: boolean;
	/** Server timestamp of save */
	savedAt: number;
}

export interface AssessmentSessionState {
	/** Current item identifier */
	currentItemIdentifier: string;
	/** Visited items (for navigation) */
	visitedItems: string[];
	/** Submitted responses per item */
	itemResponses: Record<string, Record<string, ResponseValue>>;
	/** Scoring results per item (populated after submission) */
	itemScores?: Record<string, AssessmentScoringResult>;
	/** ItemSession lifecycle hints per item, used to restore attempt/review UI state */
	itemSessionStates?: Record<string, AssessmentItemSessionState>;
	/** Rich QTI item session snapshots, used to restore variables and score saved sessions. */
	itemSessions?: Record<string, SerializedItemSessionState>;
	/** Candidate comments per item, captured where allowComment is on. */
	itemComments?: Record<string, string>;
	/** Time tracking */
	timing: {
		/** Session start time */
		startedAt: number;
		/** Time spent per item (ms) */
		itemTimes: Record<string, number>;
		/** Time spent per assessment section (ms). */
		sectionTimes?: Record<string, number>;
		/** Time spent per testPart (ms). */
		testPartTimes?: Record<string, number>;
		/** Total elapsed time (ms) */
		totalTime: number;
		/** Active scope identifiers retained for save/resume timing continuity. */
		currentItemIdentifier?: string;
		currentSectionIdentifier?: string;
		currentTestPartIdentifier?: string;
		isPaused?: boolean;
	};
}

export interface AssessmentItemSessionState {
	itemIdentifier: string;
	attemptCount: number;
	isAnswered: boolean;
	isSubmitted: boolean;
	lastSubmissionTime?: number;
}

// ============================================================================
// FINALIZE ASSESSMENT
// ============================================================================

/**
 * Finalize assessment and get full results
 *
 * Security: Server computes final scores, applies late penalties, etc.
 */
export interface FinalizeAssessmentRequest {
	sessionId: SessionId;
}

export interface FinalizeAssessmentResponse {
	success: boolean;
	/** Overall assessment score */
	totalScore: number;
	/** Maximum possible score */
	maxScore: number;
	/** Per-item results */
	itemScores: Record<string, AssessmentScoringResult>;
	/** Assessment-level feedback (legacy: single string; prefer outcomes + assessment.testFeedback) */
	feedback?: string;
	/** Test-level outcome values after outcomeProcessing; testFeedback visibility reads them. */
	outcomes?: TestOutcomeValues;
	/** Server timestamp */
	finalizedAt: number;
}

// ============================================================================
// ITEM BANK QUERIES
// ============================================================================

/**
 * Request items from an item bank for random selection
 *
 * Security: Server validates candidate access to bank
 */
export interface QueryItemBankRequest {
	/** Unique session identifier */
	sessionId: SessionId;
	/** Item bank identifier (from selection/@fromBank attribute) */
	bankId: string;
	/** Number of items to select */
	count: number;
	/** Whether to allow selecting same item multiple times */
	withReplacement?: boolean;
	/** Optional filtering criteria (difficulty, topic, etc.) */
	filters?: {
		difficulty?: 'easy' | 'medium' | 'hard';
		topics?: string[];
		[key: string]: unknown;
	};
}

/**
 * Items selected from item bank
 *
 * Security: Returns items WITHOUT correct answers or scoring rules
 */
export interface QueryItemBankResponse {
	/** Selected item references (client-safe) */
	items: SecureItemRef[];
	/** Server timestamp */
	selectedAt: number;
}

// ============================================================================
// BACKEND ADAPTER INTERFACE
// ============================================================================

/**
 * Backend adapter interface - implement this for your backend
 *
 * @example
 * ```typescript
 * class MyBackendAdapter implements BackendAdapter {
 *   async initSession(req: InitSessionRequest): Promise<InitSessionResponse> {
 *     const response = await fetch('/api/qti/init', {
 *       method: 'POST',
 *       body: JSON.stringify(req)
 *     });
 *     return response.json();
 *   }
 *   // ... implement other methods
 * }
 * ```
 */
export interface BackendAdapter {
	/**
	 * Initialize new assessment session
	 */
	initSession(request: InitSessionRequest): Promise<InitSessionResponse>;

	/**
	 * Submit item responses for scoring
	 */
	submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse>;

	/**
	 * Save session state (auto-save during assessment)
	 */
	saveState(request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse>;

	/**
	 * Finalize assessment and get results
	 */
	finalizeAssessment(request: FinalizeAssessmentRequest): Promise<FinalizeAssessmentResponse>;

	/**
	 * Resume session (optional - can reuse initSession)
	 */
	resumeSession?(sessionId: SessionId): Promise<InitSessionResponse>;

	/**
	 * Query item bank for random item selection
	 *
	 * Security: Server validates access and returns items WITHOUT sensitive data
	 */
	queryItemBank?(request: QueryItemBankRequest): Promise<QueryItemBankResponse>;
}
