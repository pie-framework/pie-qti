import type { SerializedItemSessionState } from '@pie-qti/item-player';
import type { AssessmentScoringResult, AssessmentSessionState } from '../integration/api-contract.js';
import type { ItemResult } from '../types/index.js';
import { AssessmentPlayerError } from './errors.js';
import {
	ItemSessionController,
	type ItemSessionControlSettings,
	type ItemSessionState,
} from './ItemSessionController.js';
import {
	asResponseValues,
	cloneData,
	cloneResponseRecord,
	closedItemSession,
	responseValuesEqual,
} from './sessionRecords.js';

export interface AssessmentSessionCoordinatorOptions {
	state: AssessmentSessionState;
	itemIdentifiers: string[];
	itemSessionControl?: ItemSessionControlSettings;
	/** Effective itemSessionControl per item, overriding `itemSessionControl` for those items. */
	itemSessionControlByItem?: Record<string, ItemSessionControlSettings>;
}

export interface ItemSessionInfo {
	canSubmit: boolean;
	remainingAttempts: number | null;
	attemptCount: number;
	showFeedback: boolean;
	showSolution: boolean;
	canReview: boolean;
	canSkip: boolean;
	canComment: boolean;
}

export class AssessmentSessionCoordinator {
	#state: AssessmentSessionState;
	#sessionController: ItemSessionController;
	#itemResults = new Map<string, ItemResult>();
	#itemIdentifiers: string[];

	constructor({ state, itemIdentifiers, itemSessionControl, itemSessionControlByItem }: AssessmentSessionCoordinatorOptions) {
		this.#state = state;
		this.#itemIdentifiers = itemIdentifiers;
		this.#sessionController = new ItemSessionController(itemSessionControl);
		for (const [itemIdentifier, settings] of Object.entries(itemSessionControlByItem ?? {})) {
			this.#sessionController.setItemSettings(itemIdentifier, settings);
		}
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
			itemComments: this.#state.itemComments ? { ...this.#state.itemComments } : undefined,
			itemFlags: this.#state.itemFlags ? { ...this.#state.itemFlags } : undefined,
			branchDecisions: this.#state.branchDecisions ? { ...this.#state.branchDecisions } : undefined,
			timing: {
				...this.#state.timing,
				itemTimes: { ...this.#state.timing.itemTimes },
				sectionTimes: this.#state.timing.sectionTimes
					? { ...this.#state.timing.sectionTimes }
					: undefined,
				testPartTimes: this.#state.timing.testPartTimes
					? { ...this.#state.timing.testPartTimes }
					: undefined,
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

	getPersistedItemSession(itemIdentifier: string): SerializedItemSessionState | undefined {
		return this.#state.itemSessions?.[itemIdentifier];
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
		this.#state.itemResponses[itemIdentifier] = asResponseValues(next);
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
		this.#state.itemResponses[itemIdentifier] = asResponseValues(responses);
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
		// Where the candidate stands is the client's: delivery moves through navigation (a
		// branch decision is `nextItemIdentifier`), never through a backend state update,
		// whose position may be stale — or already overtaken by a scope expiry's move.
		const currentItemIdentifier = this.#state.currentItemIdentifier;
		this.restoreState(updatedState);
		this.#state.currentItemIdentifier = currentItemIdentifier;
		// Own the accepted snapshots rather than retaining the submit loop's mutable
		// working maps. Later provisional items must not appear committed until their
		// backend request succeeds.
		this.#state.itemResponses = { ...itemResponses };
		this.#state.itemSessions = itemSessions ? { ...itemSessions } : undefined;
	}

	// ---------------------------------------------------------------------------
	// Submission commits — the only writers of session state.
	//
	// One method per submit-path combination (individual / simultaneous × backend
	// returns / omits `updatedState`), reproducing exactly the state writes the
	// player's submit loops used to make inline.
	// ---------------------------------------------------------------------------

	/** Where delivery stands (navigation owns the pointer; the snapshot carries it). */
	setCurrentItem(itemIdentifier: string): void {
		this.#state.currentItemIdentifier = itemIdentifier;
	}

	/** The backend decision kept for the item (`state.branchDecisions`), if any. */
	getBranchDecision(itemIdentifier: string): string | undefined {
		return this.#state.branchDecisions?.[itemIdentifier];
	}

	/** Keep `target` as the one decision delivery may still follow — the item's freshest. */
	keepBranchDecision(itemIdentifier: string, target: string): void {
		this.#state.branchDecisions = { [itemIdentifier]: target };
	}

	/** Every kept decision is void: a counted submission moved the outcomes they decided on. */
	clearBranchDecisions(): void {
		delete this.#state.branchDecisions;
	}

	/**
	 * The live item session's responses mirrored into the persisted record: an
	 * equality-checked write (identical responses are not re-written or re-notified)
	 * plus the answered mark. Returns whether the record changed.
	 */
	mirrorResponses(itemIdentifier: string, responses: Readonly<Record<string, unknown>>): boolean {
		const current = this.getResponses(itemIdentifier);
		if (responseValuesEqual(current, responses)) return false;

		const snapshot = cloneResponseRecord(responses);
		this.#state.itemResponses[itemIdentifier] = asResponseValues(snapshot);
		this.markAnswered(itemIdentifier, snapshot);
		return true;
	}

	/**
	 * A counted individual submission the backend accepted WITH its `updatedState`:
	 * replace the session state with the backend's, keeping the client-owned position
	 * and the client-collected responses and sessions (the snapshot may only include
	 * the items submitted so far, which would otherwise wipe later answers).
	 */
	recordSubmittedItemInUpdatedState(
		itemIdentifier: string,
		responses: Record<string, unknown>,
		updatedState: AssessmentSessionState,
	): void {
		const localResponses = cloneData(this.#state.itemResponses || {})!;
		localResponses[itemIdentifier] = asResponseValues(cloneResponseRecord(responses));
		this.replaceStatePreservingResponsesAndSessions(
			updatedState,
			localResponses,
			cloneData(this.#state.itemSessions || {})!,
		);
	}

	/**
	 * A counted individual submission the backend accepted WITHOUT a state update:
	 * the minimal local commit — score, visited mark, responses, session snapshot.
	 */
	recordIndividualSubmission(
		itemIdentifier: string,
		responses: Record<string, unknown>,
		itemSession: SerializedItemSessionState | undefined,
		scoring: AssessmentScoringResult,
	): void {
		this.#state.itemScores = this.#state.itemScores || {};
		this.#state.itemScores[itemIdentifier] = scoring;
		this.markVisited(itemIdentifier);
		this.#state.itemResponses[itemIdentifier] = asResponseValues(responses);
		if (itemSession) {
			this.setItemSession(itemIdentifier, itemSession);
		}
	}

	/**
	 * A counted simultaneous-flush submission the backend accepted WITHOUT a state
	 * update: the minimal local commit plus the attempt record and the accepted
	 * result (its responses read back from the persisted record, as the flush loop did).
	 */
	recordSimultaneousSubmission(
		itemIdentifier: string,
		responses: Record<string, unknown>,
		itemSession: SerializedItemSessionState,
		scoring: AssessmentScoringResult,
	): void {
		this.#state.itemScores = this.#state.itemScores || {};
		this.#state.itemScores[itemIdentifier] = scoring;
		this.markVisited(itemIdentifier);
		this.#state.itemResponses[itemIdentifier] = asResponseValues(responses);
		this.setItemSession(itemIdentifier, itemSession);
		this.recordAttempt(itemIdentifier);
		this.setItemResult({
			itemIdentifier,
			score: scoring.score,
			maxScore: scoring.maxScore,
			responses: this.#state.itemResponses[itemIdentifier] || {},
		});
	}

	/**
	 * Record an attempt locally only when the backend has not counted it already: a
	 * backend `updatedState` carries its own authoritative count (`itemSessionStates`),
	 * which must not be counted twice.
	 */
	recordAttemptIfUncounted(itemIdentifier: string, attemptsBefore: number): void {
		try {
			if (this.getItemSessionInfo(itemIdentifier).attemptCount <= attemptsBefore) {
				this.recordAttempt(itemIdentifier);
			}
		} catch {
			// ignore
		}
	}

	/** The test ended: every delivered item session in the persisted record is closed. */
	closeAllItemSessions(): void {
		const sessions = this.#state.itemSessions;
		if (sessions) {
			this.#state.itemSessions = Object.fromEntries(
				Object.entries(sessions).map(([identifier, session]) => [identifier, closedItemSession(session)]),
			);
		}
	}

	/** Whether the candidate hid the countdown (a persisted shell preference). */
	setTimerHidden(hidden: boolean): void {
		this.#state.timerHidden = hidden;
	}

	markVisited(itemIdentifier: string): void {
		if (!this.#state.visitedItems.includes(itemIdentifier)) {
			this.#state.visitedItems.push(itemIdentifier);
		}
	}

	markAnswered(itemIdentifier: string, responses: Record<string, unknown>): void {
		this.#sessionController.markAnswered(itemIdentifier, hasAnyResponse(responses));
	}

	/**
	 * Whether the candidate may return to the item: always before its first submission, and
	 * while attempts remain (an adaptive item: until it `completed`); after that QTI
	 * `allowReview` decides.
	 */
	canReview(itemIdentifier: string, options: { completed?: boolean } = {}): boolean {
		return this.#sessionController.canReview(itemIdentifier, options);
	}

	updateItemSessionControl(settings: ItemSessionControlSettings): void {
		this.#sessionController.updateSettings(settings);
	}

	mustValidateResponses(itemIdentifier?: string): boolean {
		return this.#sessionController.mustValidateResponses(itemIdentifier);
	}

	canSubmit(itemIdentifier: string): boolean {
		return this.#sessionController.canSubmit(itemIdentifier);
	}

	getItemSettings(itemIdentifier: string): ItemSessionControlSettings {
		return this.#sessionController.getItemSettings(itemIdentifier);
	}

	/** Records the candidate's comment on an item; throws a coded error unless its allowComment is on. */
	setItemComment(itemIdentifier: string, comment: string): void {
		if (!this.#sessionController.canComment(itemIdentifier)) {
			throw new AssessmentPlayerError(
				'commentsNotAllowed',
				`Comments are not allowed for item "${itemIdentifier}".`,
			);
		}
		this.#state.itemComments = { ...(this.#state.itemComments ?? {}), [itemIdentifier]: comment };
	}

	getItemComment(itemIdentifier: string): string | undefined {
		return this.#state.itemComments?.[itemIdentifier];
	}

	/** Sets (or clears) the candidate's flag-for-review on an item. */
	setItemFlag(itemIdentifier: string, flagged: boolean): void {
		const flags = { ...(this.#state.itemFlags ?? {}) };
		if (flagged) flags[itemIdentifier] = true;
		else delete flags[itemIdentifier];
		this.#state.itemFlags = flags;
	}

	isItemFlagged(itemIdentifier: string): boolean {
		return this.#state.itemFlags?.[itemIdentifier] === true;
	}

	getFlaggedItemIdentifiers(): string[] {
		return Object.keys(this.#state.itemFlags ?? {}).filter((id) => this.#state.itemFlags?.[id] === true);
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
			canComment: this.#sessionController.canComment(itemIdentifier),
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

/**
 * True when any response value in the record carries learner input. Shared with the
 * reference backend adapter so "answered" is decided identically on both sides.
 */
export function hasAnyResponse(responses: Record<string, unknown>): boolean {
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

/** A response variable's declared default, with the cardinality that decides how it compares. */
export interface ResponseDefault {
	value: unknown;
	cardinality?: string;
}

/**
 * QTI's skipped item (itemSessionControl `allowSkipping`): every response is NULL, empty, or
 * still equal to its declared default — the same test `numberResponded` applies (a response
 * that differs from its default). A `multiple` response compares as an unordered container.
 */
export function isSkippedResponseSet(
	responses: Record<string, unknown>,
	defaults: Readonly<Record<string, ResponseDefault>> = {},
): boolean {
	for (const [identifier, value] of Object.entries(responses)) {
		if (!hasAnyResponse({ [identifier]: value })) continue;
		const declared = defaults[identifier];
		if (declared && declared.value != null && responseEqualsDefault(value, declared)) continue;
		return false;
	}
	return true;
}

function responseEqualsDefault(value: unknown, declared: ResponseDefault): boolean {
	if (declared.cardinality === 'multiple' && Array.isArray(value) && Array.isArray(declared.value)) {
		const canonical = (entries: unknown[]) => entries.map((entry) => JSON.stringify(entry)).sort();
		const left = canonical(value);
		const right = canonical(declared.value);
		return left.length === right.length && left.every((entry, index) => entry === right[index]);
	}
	return JSON.stringify(value) === JSON.stringify(declared.value);
}
