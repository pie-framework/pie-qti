/**
 * NavigationManager
 *
 * Handles navigation logic for linear and nonlinear assessment modes.
 * - Linear: Sequential navigation only (can go back, but can't skip forward)
 * - Nonlinear: Free navigation (can jump to any item)
 */

export type NavigationMode = 'linear' | 'nonlinear';

export class NavigationManager {
	private mode: NavigationMode;
	private totalItems: number;
	private visitedItems: Set<number>;

	constructor(mode: NavigationMode, totalItems: number) {
		this.mode = mode;
		this.totalItems = totalItems;
		this.visitedItems = new Set<number>();
	}

	/**
	 * Check if navigation to a specific index is allowed
	 */
	canNavigateTo(targetIndex: number, currentIndex: number): boolean {
		// Out of bounds check
		if (targetIndex < 0 || targetIndex >= this.totalItems) {
			return false;
		}

		// In nonlinear mode, can navigate anywhere
		if (this.mode === 'nonlinear') {
			return true;
		}

		// In linear mode:
		// - Can go back to any visited item
		// - Can only go forward to the next unvisited item
		if (targetIndex <= currentIndex) {
			return true; // Can always go back
		}

		if (targetIndex === currentIndex + 1) {
			return true; // Can advance to next item
		}

		// Can't skip ahead in linear mode
		return false;
	}

	/**
	 * Check if "next" navigation is allowed
	 */
	canNext(currentIndex: number): boolean {
		return currentIndex < this.totalItems - 1;
	}

	/**
	 * Check if "previous" navigation is allowed
	 */
	canPrevious(currentIndex: number): boolean {
		return currentIndex > 0;
	}

	/**
	 * Get the next valid index
	 */
	getNextIndex(currentIndex: number): number | null {
		if (!this.canNext(currentIndex)) {
			return null;
		}
		return currentIndex + 1;
	}

	/**
	 * Get the previous valid index
	 */
	getPreviousIndex(currentIndex: number): number | null {
		if (!this.canPrevious(currentIndex)) {
			return null;
		}
		return currentIndex - 1;
	}

	/**
	 * Mark an item as visited
	 */
	markVisited(index: number): void {
		this.visitedItems.add(index);
	}

	/**
	 * Check if an item has been visited
	 */
	isVisited(index: number): boolean {
		return this.visitedItems.has(index);
	}

	/**
	 * Get all visited item indices
	 */
	getVisitedItems(): number[] {
		return Array.from(this.visitedItems).sort((a, b) => a - b);
	}

	/**
	 * Get navigation mode
	 */
	getMode(): NavigationMode {
		return this.mode;
	}

	/**
	 * Reset visited items (e.g., for retaking assessment)
	 */
	reset(): void {
		this.visitedItems.clear();
	}

	/**
	 * Restore state (for save/resume)
	 */
	restoreState(visitedItems: number[]): void {
		this.visitedItems = new Set(visitedItems);
	}
}
