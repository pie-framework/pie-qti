/**
 * ItemSessionController
 *
 * Manages QTI itemSessionControl rules for individual items.
 * Enforces attempt limits, feedback visibility, review/skip controls, and validation.
 *
 * QTI 2.2 itemSessionControl attributes:
 * - maxAttempts: Maximum number of submission attempts (default 1; 0 = unlimited, for adaptive items)
 * - showFeedback: Whether to show feedback after responses
 * - showSolution: Whether to show correct answers
 * - allowReview: Allow returning to already-answered items
 * - allowSkipping: Allow skipping items without answering
 * - validateResponses: Require valid responses before moving on
 * - allowComment: Allow candidate comments
 *
 * Settings apply per item where `setItemSettings` has set them, and fall back to the shared settings.
 */

import type { AssessmentPlayerErrorCode } from './errors.js';

/** Why navigation away from an item is blocked; localized via `assessment.errors.codes.<reason>`. */
export type ItemNavigationBlockReason = Extract<
	AssessmentPlayerErrorCode,
	'responseRequired' | 'responseInvalid'
>;

export interface ItemSessionControlSettings {
	maxAttempts?: number; // default 1; 0 = unlimited (adaptive items)
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
	private itemSettings: Map<string, ItemSessionControlSettings> = new Map();

	constructor(settings: ItemSessionControlSettings = {}) {
		// Apply defaults per QTI 2.2/3.0 spec: one attempt for non-adaptive items
		// (0 = unlimited), feedback/solution/comment off, review and skipping on,
		// response validation off.
		this.settings = {
			maxAttempts: settings.maxAttempts ?? 1,
			showFeedback: settings.showFeedback ?? false,
			allowReview: settings.allowReview ?? true,
			showSolution: settings.showSolution ?? false,
			allowComment: settings.allowComment ?? false,
			allowSkipping: settings.allowSkipping ?? true,
			validateResponses: settings.validateResponses ?? false,
		};
	}

	/** Sets an item's effective itemSessionControl, overriding the shared settings for that item. */
	setItemSettings(itemIdentifier: string, settings: ItemSessionControlSettings): void {
		this.itemSettings.set(itemIdentifier, { ...this.settings, ...settings });
	}

	/** Effective settings for an item. */
	settingsFor(itemIdentifier: string | undefined): ItemSessionControlSettings {
		return (itemIdentifier === undefined ? undefined : this.itemSettings.get(itemIdentifier)) ?? this.settings;
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

		// Check maxAttempts (0 = unlimited)
		const maxAttempts = this.settingsFor(itemIdentifier).maxAttempts ?? 1;
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

		const maxAttempts = this.settingsFor(itemIdentifier).maxAttempts ?? 1;
		if (maxAttempts === 0) {
			return null; // Unlimited
		}

		return Math.max(0, maxAttempts - state.attemptCount);
	}

	/**
	 * Check if feedback should be shown for an item. QTI is attempt-relative here: with
	 * more than one attempt allowed (or unlimited attempts), feedback for every non-final
	 * attempt must be shown; once the last attempt has been used, `showFeedback` governs.
	 */
	shouldShowFeedback(itemIdentifier: string): boolean {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state || !state.isSubmitted) {
			return false;
		}

		const settings = this.settingsFor(itemIdentifier);
		if (settings.showFeedback === true) return true;
		const maxAttempts = settings.maxAttempts ?? 1;
		return maxAttempts === 0 || (maxAttempts > 1 && state.attemptCount < maxAttempts);
	}

	/**
	 * Check if solution should be shown for an item
	 */
	shouldShowSolution(itemIdentifier: string): boolean {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state || !state.isSubmitted) {
			return false;
		}

		return this.settingsFor(itemIdentifier).showSolution ?? false;
	}

	/**
	 * Check if candidate can navigate to a previously answered item. QTI `allowReview`
	 * governs an item whose session is over — after its LAST attempt, or for an adaptive
	 * item (unlimited attempts) once it completed (`completed`). While attempts remain the
	 * candidate may return to use them, whatever `allowReview` says.
	 */
	canReview(itemIdentifier: string, options: { completed?: boolean } = {}): boolean {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state || !state.isSubmitted) {
			return true; // Can always navigate to unsubmitted items
		}

		if ((this.settingsFor(itemIdentifier).allowReview ?? true) === true) return true;
		if (options.completed === true) return false;
		return this.canSubmit(itemIdentifier);
	}

	/**
	 * Check if candidate can skip an item without answering
	 */
	canSkip(itemIdentifier: string): boolean {
		return this.settingsFor(itemIdentifier).allowSkipping ?? true;
	}

	/** Check if the candidate may comment on an item */
	canComment(itemIdentifier: string): boolean {
		return this.settingsFor(itemIdentifier).allowComment ?? false;
	}

	/**
	 * Check if responses must be validated before navigation
	 */
	mustValidateResponses(itemIdentifier?: string): boolean {
		return this.settingsFor(itemIdentifier).validateResponses ?? false;
	}

	/**
	 * Validate that an item has valid responses (if validation is required).
	 * `error` is a stable reason code, localized by the shell — never raw English text.
	 */
	validateItem(itemIdentifier: string, hasValidResponses: boolean): {
		isValid: boolean;
		error?: ItemNavigationBlockReason;
	} {
		if (!this.mustValidateResponses(itemIdentifier)) {
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
				error: 'responseInvalid',
			};
		}

		return { isValid: true };
	}

	/**
	 * Check if navigation away from current item is allowed.
	 * `reason` is a stable code the shell localizes — never raw English text.
	 */
	canNavigateAway(itemIdentifier: string, hasValidResponses: boolean): {
		allowed: boolean;
		reason?: ItemNavigationBlockReason;
	} {
		const state = this.sessionStates.get(itemIdentifier);
		if (!state) {
			return { allowed: true };
		}

		// Check if skipping is allowed when item is unanswered
		if (!state.isAnswered && !this.canSkip(itemIdentifier)) {
			return {
				allowed: false,
				reason: 'responseRequired',
			};
		}

		// Check validation requirements
		if (this.mustValidateResponses(itemIdentifier) && state.isAnswered && !hasValidResponses) {
			return {
				allowed: false,
				reason: 'responseInvalid',
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

	/** Get an item's effective settings */
	getItemSettings(itemIdentifier: string): ItemSessionControlSettings {
		return { ...this.settingsFor(itemIdentifier) };
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
