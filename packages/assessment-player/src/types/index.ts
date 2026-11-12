/**
 * Public type definitions for the backend-authoritative assessment player.
 *
 * The client does not evaluate branching or outcome processing; it renders items and
 * delegates decisions to a BackendAdapter.
 */

export type QTIRole = import('@pie-qti/item-player').QTIRole;
export type OutcomeProcessingError = import('../integration/api-contract.js').OutcomeProcessingError;

/**
 * A candidate-facing section as listed by `AssessmentPlayer.getAllSections()`.
 *
 * Sections with `visible="false"` (or hidden by an invisible ancestor) are never
 * listed: per QTI their content appears as part of the parent and their titles are
 * not surfaced.
 */
export interface CandidateSectionView {
	id: string;
	title?: string;
	/** Position within the candidate-facing section list. */
	index: number;
	/**
	 * Whether jumping to this section is legal right now (navigationMode, test part
	 * locks and finalization). Illegal targets must not be offered to the candidate;
	 * navigating to one is rejected with an `AssessmentPlayerError`.
	 */
	navigable: boolean;
}

/**
 * Time limits (test/section/item level), matching QTI concepts.
 */
export interface TimeLimits {
	maxTime?: number; // seconds
	minTime?: number; // seconds
	allowLateSubmission?: boolean;
}

export interface NavigationState {
	currentIndex: number;
	totalItems: number;
	canNext: boolean;
	canPrevious: boolean;
	/**
	 * True while a navigation or submission transition is in flight. Shells must
	 * disable navigation controls while this is set; the core also serializes
	 * transitions so concurrent calls are rejected as busy.
	 */
	isLoading: boolean;
	/** True once the assessment is finalized; navigation is closed afterwards. */
	isComplete?: boolean;
	currentSection?: {
		id: string;
		title?: string;
		index: number;
	};
	totalSections?: number;
}

export interface ItemResult {
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
export type AssessmentEndReason = 'candidate' | 'expiry' | 'proctor' | 'branch';

export interface AssessmentResults {
	totalScore: number;
	maxScore: number;
	itemResults: ItemResult[];
	completedAt: Date;
	/**
	 * Set when test-level outcome processing failed on the backend: responses were
	 * accepted and persisted, but SCORE/testFeedback outcomes could not be computed.
	 */
	outcomeProcessingError?: OutcomeProcessingError;
	/** Why the test ended in this delivery; absent for a session restored already finalized. */
	endReason?: AssessmentEndReason;
}

/** A test feedback block `AssessmentPlayer.getVisibleFeedback()` shows now. */
export interface VisibleTestFeedback {
	/** Unique across the test; feedback identifiers repeat, for example in show/hide pairs. */
	key: string;
	identifier: string;
	content: string;
	access: 'atEnd' | 'during';
	/** Set for feedback authored on a test part. */
	testPartIdentifier?: string;
	/** The content's language (`TestFeedbackItem.language`), when it has one. */
	language?: string;
}

/**
 * Whether the shell should render an item-level "Check answer" control for the
 * active item, and the attempt facts it displays (`AssessmentPlayer.getCheckAnswerState()`).
 *
 * The control exists only in `individual` submission-mode parts that allow more than
 * one attempt (or deliver an adaptive item): QTI shows feedback for every non-final
 * attempt there, whatever `showFeedback` says. QTI gives simultaneous parts no per-item
 * submission, and a single attempt keeps the submit-on-move delivery (`reason`
 * `feedbackOff`: nothing to check in place).
 */
export interface CheckAnswerState {
	/** True when the control renders. */
	available: boolean;
	/** Why the control does not render (`feedbackOff`: a single attempt); null when it does. */
	reason: 'simultaneous' | 'feedbackOff' | null;
	/** Whether the active item is adaptive (its attempt loop stays open until completed). */
	adaptive: boolean;
	/** Counted attempts already submitted for the item. */
	attemptsUsed: number;
	/** The resolved maxAttempts; null when attempts are unlimited (adaptive or maxAttempts 0). */
	maxAttempts: number | null;
	/** Counted attempts left; null when unlimited. */
	remainingAttempts: number | null;
	/** True once every allowed attempt has been consumed: the control renders disabled. */
	attemptsExhausted: boolean;
}

/** One item feedback block captured from an item-level submission. */
export interface ItemFeedbackEntry {
	identifier: string;
	content: string;
	/** Authored title, when the feedback block declares one. */
	title?: string;
}

/** The item feedback a submission produced (`AssessmentPlayer.getLastItemFeedback()`). */
export interface ItemFeedbackView {
	itemIdentifier: string;
	feedback: ItemFeedbackEntry[];
}

/**
 * Candidate-facing results for the shell's opt-in completion summary
 * (`AssessmentPlayer.getResultsSummary()`); null before finalization.
 */
export interface ResultsSummary {
	totalScore: number;
	maxScore: number;
	items: Array<{
		identifier: string;
		/** 1-based position in the delivered order. */
		number: number;
		title?: string;
		status: import('../core/reviewState.js').ItemAnswerStatus;
		/** The backend's normalized score for the item, when it returned one. */
		score?: number;
		maxScore?: number;
	}>;
}
