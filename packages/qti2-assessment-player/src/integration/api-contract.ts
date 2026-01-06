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

import type { QTIRole } from '@pie-qti/qti2-item-player';

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
	/** Assessment structure WITHOUT sensitive data */
	assessment: SecureAssessment;
	/** Restored state if resuming, undefined if new session */
	restoredState?: SessionState;
}

// ============================================================================
// ASSESSMENT STRUCTURE (CLIENT-SAFE)
// ============================================================================

/**
 * Assessment structure safe for client consumption
 *
 * Security: NO correct answers, NO scoring rules, NO sensitive rubrics
 */
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
	timeLimits?: {
		maxTime?: number; // seconds
		allowLateSubmission?: boolean;
	};
}

export interface SecureTestPart {
	identifier: string;
	/** Sections contain items */
	sections: SecureSection[];
	/** Candidate instructions (safe for display) */
	rubrics?: RubricBlock[];
	/**
	 * Item session control (QTI testPart/itemSessionControl).
	 * Server is authoritative; client uses this for UI hints only.
	 */
	itemSessionControl?: {
		maxAttempts?: number;
		showFeedback?: boolean;
		allowReview?: boolean;
		showSolution?: boolean;
		allowComment?: boolean;
		allowSkipping?: boolean;
		validateResponses?: boolean;
	};
}

export interface SecureSection {
	identifier: string;
	title?: string;
	/** Visible determines if section appears in navigation */
	visible: boolean;
	/** Item references */
	items: SecureItemRef[];
	/** Section-level time limit */
	timeLimits?: {
		maxTime?: number;
	};
	/** Candidate instructions (safe for display) */
	rubrics?: RubricBlock[];
}

export interface SecureItemRef {
	/** Unique item identifier */
	identifier: string;
	/** Item XML WITHOUT responseProcessing if role is 'candidate' */
	itemXml: string;
	/** QTI role determines what's visible in itemXml */
	role: QTIRole;
	/** Required=true means item must be attempted */
	required?: boolean;
}

export interface RubricBlock {
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
}

/**
 * Response value can be string, string[], or complex types
 */
export type ResponseValue = string | string[] | Record<string, any>;

export interface SubmitResponsesResponse {
	/** Was submission accepted? */
	success: boolean;
	/** Scoring result (if submission mode allows immediate scoring) */
	result?: ScoringResult;
	/**
	 * Backend-authoritative next item (branching/navigation decision).
	 * If omitted, client may fall back to linear next/previous UI navigation.
	 */
	nextItemIdentifier?: string;
	/**
	 * Backend-authoritative session state snapshot after applying the submission.
	 * If provided, client should replace its local state with this.
	 */
	updatedState?: SessionState;
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
export interface ScoringResult {
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
export interface SaveStateRequest {
	sessionId: SessionId;
	state: SessionState;
}

export interface SaveStateResponse {
	success: boolean;
	/** Server timestamp of save */
	savedAt: number;
}

/**
 * Session state for persistence
 */
export interface SessionState {
	/** Current item identifier */
	currentItemIdentifier: string;
	/** Visited items (for navigation) */
	visitedItems: string[];
	/** Submitted responses per item */
	itemResponses: Record<string, Record<string, ResponseValue>>;
	/** Scoring results per item (populated after submission) */
	itemScores?: Record<string, ScoringResult>;
	/** Time tracking */
	timing: {
		/** Session start time */
		startedAt: number;
		/** Time spent per item (ms) */
		itemTimes: Record<string, number>;
		/** Total elapsed time (ms) */
		totalTime: number;
	};
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
	itemScores: Record<string, ScoringResult>;
	/** Assessment-level feedback */
	feedback?: string;
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
	saveState(request: SaveStateRequest): Promise<SaveStateResponse>;

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
