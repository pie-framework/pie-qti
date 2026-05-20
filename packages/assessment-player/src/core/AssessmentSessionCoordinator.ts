import type { SerializedItemSessionState } from '@pie-qti/item-player';
import type { AssessmentSessionState } from '../integration/api-contract.js';
import type { ItemResult } from '../types/index.js';
import {
	ItemSessionController,
	type ItemSessionControlSettings,
	type ItemSessionState,
} from './ItemSessionController.js';

export interface AssessmentSessionCoordinatorOptions {
	state: AssessmentSessionState;
	itemIdentifiers: string[];
	itemSessionControl?: ItemSessionControlSettings;
}

export interface ItemSessionInfo {
	canSubmit: boolean;
	remainingAttempts: number | null;
	attemptCount: number;
	showFeedback: boolean;
	showSolution: boolean;
	canReview: boolean;
	canSkip: boolean;
}

export class AssessmentSessionCoordinator {
	#state: AssessmentSessionState;
	#sessionController: ItemSessionController;
	#itemResults = new Map<string, ItemResult>();
	#itemIdentifiers: string[];

	constructor({ state, itemIdentifiers, itemSessionControl }: AssessmentSessionCoordinatorOptions) {
		this.#state = state;
		this.#itemIdentifiers = itemIdentifiers;
		this.#sessionController = new ItemSessionController(itemSessionControl);
		this.#initializeItemSessions();
		this.#restoreItemSessionsFromState(state);
		this.#restoreItemResultsFromScores(state);
	}

	get state() {
		return this.#state;
	}

	restoreState(state: AssessmentSessionState): void {
		this.#state = state;
		this.#restoreItemSessionsFromState(state);
		this.#restoreItemResultsFromScores(state);
	}

	snapshot(options: { includeItemSessions?: boolean } = {}): AssessmentSessionState {
		return {
			...this.#state,
			visitedItems: [...this.#state.visitedItems],
			itemResponses: { ...this.#state.itemResponses },
			itemScores: this.#state.itemScores ? { ...this.#state.itemScores } : undefined,
			itemSessions:
				options.includeItemSessions && this.#state.itemSessions
					? { ...this.#state.itemSessions }
					: undefined,
			itemSessionStates: this.#itemSessionStateSnapshot(),
			timing: {
				...this.#state.timing,
				itemTimes: { ...this.#state.timing.itemTimes },
			},
		};
	}

	activateItem(itemIdentifier: string): Record<string, unknown> {
		this.#state.currentItemIdentifier = itemIdentifier;
		return this.getResponses(itemIdentifier);
	}

	getActiveResponses(): Record<string, unknown> {
		return this.getResponses(this.#state.currentItemIdentifier);
	}

	getResponses(itemIdentifier: string): Record<string, unknown> {
		return { ...((this.#state.itemResponses?.[itemIdentifier] || {}) as Record<string, unknown>) };
	}

	updateActiveResponse(responseId: string, value: unknown): Record<string, unknown> {
		return this.updateResponseForItem(this.#state.currentItemIdentifier, responseId, value);
	}

	updateResponseForItem(
		itemIdentifier: string,
		responseId: string,
		value: unknown
	): Record<string, unknown> {
		const next = {
			...((this.#state.itemResponses?.[itemIdentifier] || {}) as Record<string, unknown>),
			[responseId]: value,
		};
		this.#state.itemResponses[itemIdentifier] = next as any;
		this.markAnswered(itemIdentifier, next);
		return next;
	}

	saveItemSession(
		itemIdentifier: string,
		responses: Record<string, unknown>,
		sessionState: SerializedItemSessionState,
		duration: number
	): void {
		this.#state.itemSessions = {
			...(this.#state.itemSessions ?? {}),
			[itemIdentifier]: sessionState,
		};
		this.#state.itemResponses[itemIdentifier] = responses as any;
		this.#state.timing.itemTimes[itemIdentifier] = duration;
		this.markAnswered(itemIdentifier, responses);
	}

	setItemSession(itemIdentifier: string, sessionState: SerializedItemSessionState): void {
		this.#state.itemSessions = {
			...(this.#state.itemSessions ?? {}),
			[itemIdentifier]: sessionState,
		};
	}

	mergeItemSessions(itemSessions: AssessmentSessionState['itemSessions']): void {
		if (!itemSessions) return;
		this.#state.itemSessions = {
			...(this.#state.itemSessions ?? {}),
			...itemSessions,
		};
	}

	replaceStatePreservingItemSessions(updatedState: AssessmentSessionState): void {
		const localItemSessions = this.#state.itemSessions;
		this.restoreState(updatedState);
		this.mergeItemSessions(localItemSessions);
	}

	replaceStatePreservingResponsesAndSessions(
		updatedState: AssessmentSessionState,
		itemResponses: AssessmentSessionState['itemResponses'],
		itemSessions: AssessmentSessionState['itemSessions']
	): void {
		this.restoreState(updatedState);
		this.#state.itemResponses = itemResponses;
		this.#state.itemSessions = itemSessions;
	}

	markVisited(itemIdentifier: string): void {
		if (!this.#state.visitedItems.includes(itemIdentifier)) {
			this.#state.visitedItems.push(itemIdentifier);
		}
	}

	markAnswered(itemIdentifier: string, responses: Record<string, unknown>): void {
		this.#sessionController.markAnswered(itemIdentifier, hasAnyResponse(responses));
	}

	canReview(itemIdentifier: string): boolean {
		return this.#sessionController.canReview(itemIdentifier);
	}

	canNavigateAway(
		itemIdentifier: string,
		responses: Record<string, unknown>
	): { allowed: boolean; reason?: string } {
		return this.#sessionController.canNavigateAway(itemIdentifier, hasAnyResponse(responses));
	}

	updateItemSessionControl(settings: ItemSessionControlSettings): void {
		this.#sessionController.updateSettings(settings);
	}

	mustValidateResponses(): boolean {
		return this.#sessionController.mustValidateResponses();
	}

	recordAttempt(itemIdentifier: string): void {
		this.#sessionController.recordAttempt(itemIdentifier);
	}

	setItemResult(itemResult: ItemResult): void {
		this.#itemResults.set(itemResult.itemIdentifier, itemResult);
	}

	hasItemResult(itemIdentifier: string): boolean {
		return this.#itemResults.has(itemIdentifier);
	}

	getItemSessionInfo(itemIdentifier: string): ItemSessionInfo {
		if (!this.#sessionController.getItemState(itemIdentifier)) {
			this.#sessionController.initializeItem(itemIdentifier);
		}
		const state = this.#sessionController.getItemState(itemIdentifier);
		return {
			canSubmit: this.#sessionController.canSubmit(itemIdentifier),
			remainingAttempts: this.#sessionController.getRemainingAttempts(itemIdentifier),
			attemptCount: state?.attemptCount ?? 0,
			showFeedback: this.#sessionController.shouldShowFeedback(itemIdentifier),
			showSolution: this.#sessionController.shouldShowSolution(itemIdentifier),
			canReview: this.#sessionController.canReview(itemIdentifier),
			canSkip: this.#sessionController.canSkip(itemIdentifier),
		};
	}

	#initializeItemSessions(): void {
		for (const itemIdentifier of this.#itemIdentifiers) {
			this.#sessionController.initializeItem(itemIdentifier);
		}
	}

	#restoreItemSessionsFromState(state: AssessmentSessionState): void {
		const restoredStates = new Map<string, ItemSessionState>();
		for (const itemIdentifier of this.#itemIdentifiers) {
			const persisted = state.itemSessionStates?.[itemIdentifier];
			if (persisted) {
				restoredStates.set(itemIdentifier, {
					itemIdentifier,
					attemptCount: Math.max(0, persisted.attemptCount),
					isAnswered: persisted.isAnswered,
					isSubmitted: persisted.isSubmitted,
					lastSubmissionTime: persisted.lastSubmissionTime,
				});
				continue;
			}

			const responses = state.itemResponses?.[itemIdentifier] ?? {};
			const isSubmitted = Boolean(state.itemScores?.[itemIdentifier]);
			restoredStates.set(itemIdentifier, {
				itemIdentifier,
				attemptCount: isSubmitted ? 1 : 0,
				isAnswered: hasAnyResponse(responses),
				isSubmitted,
			});
		}
		this.#sessionController.restoreStates(restoredStates);
	}

	#restoreItemResultsFromScores(state: AssessmentSessionState): void {
		this.#itemResults.clear();
		if (!state.itemScores) return;
		for (const [itemIdentifier, scoring] of Object.entries(state.itemScores)) {
			this.#itemResults.set(itemIdentifier, {
				itemIdentifier,
				score: scoring.score,
				maxScore: scoring.maxScore,
				responses: state.itemResponses?.[itemIdentifier] || {},
			});
		}
	}

	#itemSessionStateSnapshot(): Record<string, ItemSessionState> {
		return Object.fromEntries(
			[...this.#sessionController.getAllStates().entries()].map(([itemIdentifier, state]) => [
				itemIdentifier,
				{ ...state },
			])
		);
	}
}

function hasAnyResponse(responses: Record<string, unknown>): boolean {
	for (const value of Object.values(responses)) {
		if (value == null) continue;
		if (Array.isArray(value)) {
			if (value.length > 0) return true;
			continue;
		}
		if (typeof value === 'string') {
			if (value.trim().length > 0) return true;
			continue;
		}
		return true;
	}
	return false;
}

