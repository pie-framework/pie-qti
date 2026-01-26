/**
 * ItemSessionController
 *
 * Manages QTI itemSessionControl rules for individual items.
 * Enforces attempt limits, feedback visibility, review/skip controls, and validation.
 *
 * QTI 2.2 itemSessionControl attributes:
 * - maxAttempts: Maximum number of submission attempts (0 = unlimited)
 * - showFeedback: Whether to show feedback after responses
 * - showSolution: Whether to show correct answers
 * - allowReview: Allow returning to already-answered items
 * - allowSkipping: Allow skipping items without answering
 * - validateResponses: Require valid responses before moving on
 * - allowComment: Allow candidate comments (not implemented yet)
 */

export interface ItemSessionControlSettings {
	maxAttempts?: number; // 0 = unlimited
	showFeedback?: boolean;
	allowReview?: boolean;
	showSolution?: boolean;
	allowComment?: boolean;
	allowSkipping?: boolean;
	validateResponses?: boolean;
}

export interface ItemSessionState {
	itemIdentifier: string;
	attemptCount: number;
	isAnswered: boolean;
	isSubmitted: boolean;
	lastSubmissionTime?: number;
}

export class ItemSessionController {
	private settings: ItemSessionControlSettings;
	private sessionStates: Map<string, ItemSessionState> = new Map();

	constructor(settings: ItemSessionControlSettings = {}) {
		// Apply defaults per QTI 2.2 spec
		this.settings = {
			maxAttempts: settings.maxAttempts ?? 0, // 0 = unlimited
			showFeedback: settings.showFeedback ?? false,
			allowReview: settings.allowReview ?? true,
			showSolution: settings.showSolution ?? false,
			allowComment: settings.allowComment ?? false,
			allowSkipping: settings.allowSkipping ?? true,
			validateResponses: settings.validateResponses ?? false,
		};
	}

	/**
	 * Initialize session state for an item
	 */
	initializeItem(itemIdentifier: string): void {
		if (!this.sessionStates.has(itemIdentifier)) {
			this.sessionStates.set(itemIdentifier, {
				itemIdentifier,
				attemptCount: 0,
				isAnswered: false,
				isSubmitted: false,
			});
		}
	}

	/**
	 * Get session state for an item
	 */
	getItemState(itemIdentifier: string): ItemSessionState | null {
		return this.sessionStates.get(itemIdentifier) ?? null;
	}

	/**
	 * Record a submission attempt for an item
	 */
	recordAttempt(itemIdentifier: string): void {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state) {
			throw new Error(`Item session not initialized: ${itemIdentifier}`);
		}

		state.attemptCount++;
		state.isSubmitted = true;
		state.lastSubmissionTime = Date.now();
	}

	/**
	 * Mark item as answered (has responses)
	 */
	markAnswered(itemIdentifier: string, hasResponses: boolean): void {
		const state = this.sessionStates.get(itemIdentifier);
		if (state) {
			state.isAnswered = hasResponses;
		}
	}

	/**
	 * Check if item can be submitted
	 */
	canSubmit(itemIdentifier: string): boolean {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state) {
			return false;
		}

		// Check maxAttempts
		const maxAttempts = this.settings.maxAttempts ?? 0;
		if (maxAttempts > 0 && state.attemptCount >= maxAttempts) {
			return false;
		}

		return true;
	}

	/**
	 * Get remaining attempts for an item
	 */
	getRemainingAttempts(itemIdentifier: string): number | null {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state) {
			return null;
		}

		const maxAttempts = this.settings.maxAttempts ?? 0;
		if (maxAttempts === 0) {
			return null; // Unlimited
		}

		return Math.max(0, maxAttempts - state.attemptCount);
	}

	/**
	 * Check if feedback should be shown for an item
	 */
	shouldShowFeedback(itemIdentifier: string): boolean {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state || !state.isSubmitted) {
			return false;
		}

		return this.settings.showFeedback ?? false;
	}

	/**
	 * Check if solution should be shown for an item
	 */
	shouldShowSolution(itemIdentifier: string): boolean {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state || !state.isSubmitted) {
			return false;
		}

		return this.settings.showSolution ?? false;
	}

	/**
	 * Check if candidate can navigate to a previously answered item
	 */
	canReview(itemIdentifier: string): boolean {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state || !state.isSubmitted) {
			return true; // Can always navigate to unsubmitted items
		}

		return this.settings.allowReview ?? true;
	}

	/**
	 * Check if candidate can skip an item without answering
	 */
	canSkip(_itemIdentifier: string): boolean {
		return this.settings.allowSkipping ?? true;
	}

	/**
	 * Check if responses must be validated before navigation
	 */
	mustValidateResponses(): boolean {
		return this.settings.validateResponses ?? false;
	}

	/**
	 * Validate that an item has valid responses (if validation is required)
	 */
	validateItem(itemIdentifier: string, hasValidResponses: boolean): {
		isValid: boolean;
		error?: string;
	} {
		if (!this.mustValidateResponses()) {
			return { isValid: true };
		}

		const state = this.sessionStates.get(itemIdentifier);
		if (!state) {
			return { isValid: true };
		}

		// If item is required and has no valid responses, fail validation
		if (!hasValidResponses) {
			return {
				isValid: false,
				error: 'This item requires a valid response before continuing.',
			};
		}

		return { isValid: true };
	}

	/**
	 * Check if navigation away from current item is allowed
	 */
	canNavigateAway(itemIdentifier: string, hasValidResponses: boolean): {
		allowed: boolean;
		reason?: string;
	} {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state) {
			return { allowed: true };
		}

		// Check if skipping is allowed when item is unanswered
		if (!state.isAnswered && !this.canSkip(itemIdentifier)) {
			return {
				allowed: false,
				reason: 'You must answer this item before continuing.',
			};
		}

		// Check validation requirements
		if (this.mustValidateResponses() && state.isAnswered && !hasValidResponses) {
			return {
				allowed: false,
				reason: 'Please provide valid responses before continuing.',
			};
		}

		return { allowed: true };
	}

	/**
	 * Get full settings
	 */
	getSettings(): ItemSessionControlSettings {
		return { ...this.settings };
	}

	/**
	 * Update settings (useful for different sections with different controls)
	 */
	updateSettings(settings: Partial<ItemSessionControlSettings>): void {
		this.settings = { ...this.settings, ...settings };
	}

	/**
	 * Get all session states (for persistence)
	 */
	getAllStates(): Map<string, ItemSessionState> {
		return new Map(this.sessionStates);
	}

	/**
	 * Restore session states (from persistence)
	 */
	restoreStates(states: Map<string, ItemSessionState>): void {
		this.sessionStates = new Map(states);
	}

	/**
	 * Reset session state for an item (useful for practice/retry scenarios)
	 */
	resetItem(itemIdentifier: string): void {
		const state = this.sessionStates.get(itemIdentifier);
		if (state) {
			state.attemptCount = 0;
			state.isAnswered = false;
			state.isSubmitted = false;
			state.lastSubmissionTime = undefined;
		}
	}

	/**
	 * Clear all session states
	 */
	clear(): void {
		this.sessionStates.clear();
	}
}
