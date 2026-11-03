/**
 * Visited-item tracking for the assessment player's navigation UI hints.
 *
 * Deliberately NOT a navigation decision-maker: QTI's real navigation rules
 * (testPart sequencing, time locks, review-after-submit, branch targets) live in
 * `AssessmentPlayer`'s `canNavigateByTestPart`/`canNext`/`canPrevious`, which read
 * session state this class knows nothing about. Keeping only visit tracking here
 * avoids a second, divergent source of navigation truth.
 */

export type NavigationMode = 'linear' | 'nonlinear';

export class NavigationManager {
	private visitedItems: Set<number>;

	constructor() {
		this.visitedItems = new Set<number>();
	}

	/** Mark an item as visited. */
	markVisited(index: number): void {
		this.visitedItems.add(index);
	}

	/** Restore visited state (for save/resume). */
	restoreState(visitedItems: number[]): void {
		this.visitedItems = new Set(visitedItems);
	}
}
