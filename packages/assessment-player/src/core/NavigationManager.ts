/**
 * The presented-items record for the assessment player's navigation UI hints:
 * every item delivery has shown (the review screen's visited marks ride it).
 *
 * Deliberately kept separate from the backend contract's `state.visitedItems`
 * (the session state the coordinator owns): the two records coincide only where
 * a submission happened, and merging them is `getState()`'s job, not this
 * class's. Deliberately NOT a navigation decision-maker either: QTI's real
 * navigation rules (testPart sequencing, time locks, review-after-submit, branch
 * targets) live in `AssessmentPlayer`'s navigation policy, which reads session
 * state this class knows nothing about. Keeping only presentation tracking here
 * avoids a second, divergent source of navigation truth.
 */

export class NavigationManager {
	/** The flat delivery indexes presented so far. */
	private presentedIndexes: Set<number>;

	constructor() {
		this.presentedIndexes = new Set<number>();
	}

	/** Mark an item as presented. */
	markVisited(index: number): void {
		this.presentedIndexes.add(index);
	}

	/** Whether the candidate has been presented this item (by flat index). */
	isVisited(index: number): boolean {
		return this.presentedIndexes.has(index);
	}

	/** The presented flat indexes, ascending (for snapshots). */
	getVisited(): number[] {
		return [...this.presentedIndexes].sort((a, b) => a - b);
	}

	/** Restore the presented-index record (for save/resume). */
	restoreState(visitedItems: number[]): void {
		this.presentedIndexes = new Set(visitedItems);
	}
}
