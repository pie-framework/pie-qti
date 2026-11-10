/**
 * Autosave wiring: the debounced draft snapshot the player persists through
 * `BackendAdapter.saveState`.
 *
 * The engine is `AutosaveManager` (debounce, busy-deferral, bounded backoff,
 * stop semantics). This module owns the player-side defaults: the capability +
 * config decision, the 1500 ms default window, and the snapshot shape — the
 * current session snapshot, with every item session closed when the caller says
 * the snapshot records an ended test, and the save time stamped on the timing.
 *
 * Extracted from `AssessmentPlayer.ts` (pure code motion): the caller supplies
 * the live reads (snapshot, blocked/stopped probes) exactly as before.
 */

import type { AssessmentSessionState, BackendAdapter, SessionId } from '../integration/api-contract.js';
import { closedItemSession } from './sessionRecords.js';
import { AutosaveManager, type AutosaveState } from './AutosaveManager.js';

export interface SessionAutosaveOptions {
	/** `config.autosave` (off for hosts that persist state themselves). */
	autosave?: boolean;
	/** `config.autosaveIntervalMs` (default 1500). */
	autosaveIntervalMs?: number;
	/** `backend.canSaveState` (a backend that cannot store drafts disables autosave). */
	canSaveState: BackendAdapter['canSaveState'];
	sessionId: SessionId;
	/** The current session snapshot (`getState({ includeItemSessions: true })`). */
	getSnapshot: () => AssessmentSessionState;
	/** True while the snapshot being taken records an ended test (its item sessions are closed). */
	snapshotsCloseItemSessions: () => boolean;
	/** True while a navigation or submission transition is in flight. */
	isBlocked: () => boolean;
	/** True once delivery has ended (finalized or destroyed). */
	isStopped: () => boolean;
	/** `backend.saveState`. */
	saveState: BackendAdapter['saveState'];
	/** Indicator/host state changes. */
	onStateChange: (state: AutosaveState) => void;
	/** Raw failure detail for logs and host callbacks. */
	onError: (error: Error) => void;
}

/**
 * The debounced draft persistence, ON by default when the backend reports the save
 * capability (`canSaveState !== false`); `autosave === false` disables it for hosts
 * that persist state themselves. Null when disabled.
 */
export function createSessionAutosave(options: SessionAutosaveOptions): AutosaveManager | null {
	const enabled = options.autosave !== false && options.canSaveState !== false;
	if (!enabled) return null;
	return new AutosaveManager({
		enabled: true,
		intervalMs: options.autosaveIntervalMs ?? 1500,
		collect: () => {
			const snapshot = options.getSnapshot();
			if (options.snapshotsCloseItemSessions() && snapshot.itemSessions) {
				snapshot.itemSessions = Object.fromEntries(
					Object.entries(snapshot.itemSessions).map(([identifier, session]) => [
						identifier,
						closedItemSession(session),
					]),
				);
			}
			snapshot.timing = { ...snapshot.timing, savedAt: Date.now() };
			return { sessionId: options.sessionId, state: snapshot };
		},
		save: (request) => options.saveState(request as never),
		isBlocked: options.isBlocked,
		isStopped: options.isStopped,
		onStateChange: options.onStateChange,
		onError: options.onError,
	});
}
