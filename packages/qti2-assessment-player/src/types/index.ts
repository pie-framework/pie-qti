/**
 * Public type definitions for the backend-authoritative assessment player.
 *
 * The client does not evaluate branching or outcome processing; it renders items and
 * delegates decisions to a BackendAdapter.
 */

export type QTIRole = import('@pie-qti/qti2-item-player').QTIRole;

/**
 * Minimal item reference shape used by the UI renderer.
 */
export interface QuestionRef {
	identifier: string;
	title?: string;
	required?: boolean;
	/** Client-safe item XML (backend filtered by role). */
	itemXml?: string;
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
	isLoading: boolean;
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
}
