/**
 * The shell's connection to the headless player: creation, event wiring,
 * teardown, retry and the slow-load status. The shell keeps the session state
 * (dialogs, focus, completion) and hands this composable its handlers — the
 * bodies of the old `initialize()` listeners, moved verbatim.
 */
import type { I18nProvider } from '@pie-qti/i18n';
import {
	AssessmentPlayer,
	type AssessmentTimeExpiryEvent,
	type BackendAssessmentPlayerConfig,
	type ScopeTimeExpiryEvent,
} from '../core/AssessmentPlayer.js';
import type { AutosaveState } from '../core/AutosaveManager.js';
import type { AssessmentResults } from '../types/index.js';
import type { BackendAdapter, InitSessionRequest } from '../integration/api-contract.js';

/** A localized, candidate-safe failure of the load or of an item entry. */
export interface PlayerLoadError {
	message: string;
	supportCode: string | null;
}

/** The shell's handlers: core events → shell state. */
export interface PlayerConnectionHandlers {
	onItemChange: (index: number, total: number) => void | Promise<void>;
	onSectionChange: (index: number, total: number) => void;
	onTestFeedbackChange: () => void;
	onResponseChange: (responses: Record<string, unknown>) => void;
	onBusyChange: (busy: boolean) => void;
	onFlagChange: (itemIdentifier: string, flagged: boolean) => void;
	onAutosaveChange: (state: AutosaveState) => void;
	onComplete: (results: AssessmentResults) => void;
	onTimeExpired: (event: AssessmentTimeExpiryEvent) => void;
	onScopeTimeExpired: (event: ScopeTimeExpiryEvent) => void;
	onPauseChange: (paused: boolean, reason?: string) => void;
}

/** The creation inputs, read once per `initialize()` from the shell's props. */
export interface PlayerConnectionInputs {
	backend: BackendAdapter;
	initSession: InitSessionRequest;
	/** The host's config, spread into the core config verbatim. */
	config: Partial<BackendAssessmentPlayerConfig>;
	// The shell prop and the core option open the same gate / tune the same autosave.
	beginGate: boolean;
	autosave: boolean | undefined;
	autosaveIntervalMs: number | undefined;
}

export interface PlayerConnectionOptions {
	/** The shell's props, read when the session is created. */
	inputs: () => PlayerConnectionInputs;
	/** The provider the core retains (the shell's stable i18n proxy). */
	i18nProvider: I18nProvider;
	/** Localize a thrown failure for the failure screen. */
	localizeError: (err: unknown) => PlayerLoadError;
	/** The shell's announcer. */
	announce: (message: string, duration?: number, level?: 'polite' | 'assertive') => void;
	/**
	 * The shell's part of the core's `onError` hook: a failed item entry (the
	 * first item, or an expiry hop) additionally routes to the shell's typed
	 * failure screen instead of an eternal bare loading state.
	 */
	onPlayerError: (err: unknown) => void;
	/** Core events → shell state. */
	handlers: PlayerConnectionHandlers;
	/**
	 * Post-create shell sync: the restored pause, the terminal restored-finalized
	 * view, the sections. Runs before the core events are wired.
	 */
	onSessionCreated: (player: AssessmentPlayer) => void;
	/**
	 * The session is live: enter the first item and settle the shell (initial
	 * navigation, resume prompt, restored-pause announcement). Runs after the
	 * core events are wired.
	 */
	onSessionLive: (player: AssessmentPlayer) => Promise<void>;
}

export function createPlayerConnection(options: PlayerConnectionOptions) {
	const state = $state({
		player: null as AssessmentPlayer | null,
		error: null as PlayerLoadError | null,
		initializing: false,
		/** Loading is taking long: a polite status, never a permanent error on its own. */
		stillLoading: false,
		hasFirstItem: false,
		/** The begin gate holds delivery: the core was created without starting it. */
		startPending: false,
	});

	// Initialize the player; a retry runs this again after a load failure. A slow
	// load is a polite status ("still loading"), never a permanent error: if the
	// backend recovers later, the shell proceeds on its own.
	let stillLoadingTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Bumped by every teardown: an `initialize()` whose `AssessmentPlayer.create()`
	 * resolves after one is stale. Without this, a shell unmounted (or torn down for
	 * a retry) while creation was in flight would adopt the resolved player — fully
	 * wired and stored — and nothing would ever destroy it (its TimeManager interval
	 * would tick forever).
	 */
	let teardownGeneration = 0;

	function clearStillLoadingTimer() {
		if (stillLoadingTimer) {
			clearTimeout(stillLoadingTimer);
			stillLoadingTimer = null;
		}
	}

	function armStillLoadingTimer() {
		clearStillLoadingTimer();
		// Behind a begin gate the start screen is the expected view, not a slow load.
		stillLoadingTimer = setTimeout(() => {
			stillLoadingTimer = null;
			if (!state.hasFirstItem && !state.error && !state.startPending) {
				state.stillLoading = true;
			}
		}, 10000);
	}

	/** Tear the half-created (or live) player down; the shell re-initializes after. */
	function teardown() {
		teardownGeneration += 1;
		const current = state.player;
		state.player = null;
		current?.destroy();
	}

	/** Unmount: stop the slow-load timer and destroy the player. */
	function destroy() {
		clearStillLoadingTimer();
		teardown();
	}

	/** The core config, built from the shell's props and the host's config. */
	function buildPlayerConfig(): BackendAssessmentPlayerConfig {
		const { backend, initSession, config, beginGate, autosave, autosaveIntervalMs } = options.inputs();
		const hostOnError = config.onError;
		return {
			backend,
			initSession,
			...config,
			beginGate: beginGate || config.beginGate === true,
			i18nProvider: options.i18nProvider,
			...(autosave === undefined ? {} : { autosave }),
			...(autosaveIntervalMs === undefined ? {} : { autosaveIntervalMs }),
			// The host's error hook stays; a failed item entry (the first item, or an
			// expiry hop) additionally routes to the shell's typed failure screen instead
			// of an eternal bare loading state.
			onError: (err) => {
				hostOnError?.(err);
				options.onPlayerError(err);
			},
		};
	}

	/** Subscribe the shell's handlers to the core's events. */
	function wireCoreEvents(created: AssessmentPlayer) {
		created.onItemChange(options.handlers.onItemChange);
		created.onSectionChange(options.handlers.onSectionChange);
		created.onTestFeedbackChange(options.handlers.onTestFeedbackChange);
		created.onResponseChange(options.handlers.onResponseChange);
		created.onBusyChange(options.handlers.onBusyChange);
		created.onFlagChange(options.handlers.onFlagChange);
		created.onAutosaveChange(options.handlers.onAutosaveChange);
		created.onComplete(options.handlers.onComplete);
		created.onTimeExpired(options.handlers.onTimeExpired);
		created.onScopeTimeExpired(options.handlers.onScopeTimeExpired);
		created.onPauseChange(options.handlers.onPauseChange);
	}

	async function initialize() {
		if (state.initializing) return;
		state.initializing = true;
		state.error = null;
		state.stillLoading = false;
		armStillLoadingTimer();

		try {
			const generation = teardownGeneration;
			const created = await AssessmentPlayer.create(buildPlayerConfig());
			if (generation !== teardownGeneration) {
				// The shell unmounted (or retried) while creation was in flight: state.player
				// is still null and nothing owns the resolved player, so destroy it here —
				// adopting it would leave its TimeManager interval ticking forever.
				created.destroy();
				return;
			}
			state.startPending = !created.hasStarted();
			state.player = created;

			// Restored-pause sync, the terminal restored-finalized view, sections.
			options.onSessionCreated(created);

			// A session the backend stored as finalized is terminal: delivery whose
			// every action rejects needs no event wiring.
			if (created.isFinalized()) return;

			// An item entry that already failed during creation (the first item could
			// not be entered) routes here: the typed failure screen replaces the bare
			// loading state. Later entry failures (an expiry hop) report through onError.
			if (created.hasEntryFailure()) {
				state.error = options.localizeError(created.getEntryError()!);
				state.stillLoading = false;
				clearStillLoadingTimer();
				options.announce(state.error.message, 3000, 'assertive');
				return;
			}

			// Set up event listeners, then let the shell enter the first item.
			wireCoreEvents(created);
			await options.onSessionLive(created);
		} catch (err) {
			console.error('Failed to initialize assessment player:', err);
			state.error = options.localizeError(err);
			options.announce(state.error.message, 3000, 'assertive');
			// The failure alert is announced; focus lands on its Retry control (the
			// error-focus effect in the shell).
		} finally {
			state.initializing = false;
			clearStillLoadingTimer();
		}
	}

	return {
		/** Reactive connection state. */
		state,
		initialize,
		/** Unmount: stop the slow-load timer and destroy the player. */
		destroy,
		/** Tear the player down without touching the timer (retry a failed load). */
		teardown,
		/** Clear the pending still-loading status timer. */
		clearStillLoadingTimer,
	};
}

export type PlayerConnection = ReturnType<typeof createPlayerConnection>;
