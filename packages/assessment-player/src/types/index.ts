/**
 * Public type definitions for the backend-authoritative assessment player.
 *
 * The client does not evaluate branching or outcome processing; it renders items and
 * delegates decisions to a BackendAdapter.
 */

export type QTIRole = import('@pie-qti/item-player').QTIRole;
export type ResolvedItemDeliveryContext = import('@pie-qti/item-player').ResolvedItemDeliveryContext;
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
 * Minimal item reference shape used by the UI renderer.
 */
export interface ItemRef {
	identifier: string;
	title?: string;
	required?: boolean;
	/** Client-safe item XML (backend filtered by role). */
	itemXml?: string;
	/** Optional resolved QTI 3 delivery context produced by package/assessment layers. */
	deliveryContext?: ResolvedItemDeliveryContext;
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
}
