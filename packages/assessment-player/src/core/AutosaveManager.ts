/**
 * Debounced autosave for the assessment core.
 *
 * Collects a session snapshot after candidate activity settles (response edits,
 * navigation, flags, timer visibility, pause) and persists it through the backend's
 * `saveState`. The backend is the store: no offline queue, no client-side storage.
 *
 * Guarantees:
 * - **Non-fatal.** A failed save logs to the console, reports `failed` through
 *   `onStateChange` (plus `onError` for the raw detail) and retries on the next
 *   change or flush; delivery is never interrupted.
 * - **Busy-aware.** While a navigation or submission transition is in flight a
 *   due save is deferred and retried once the transition settles, so the snapshot
 *   is not taken mid-transition.
 * - **Terminal-safe.** Once `stop()` runs (finalization, destroy) nothing is saved.
 */

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'failed';

/** What the save indicator (and host callbacks) see. */
export interface AutosaveState {
	status: AutosaveStatus;
	/** Client clock (ms) of the last successful save; undefined until one lands. */
	lastSavedAt?: number;
}

export interface AutosaveManagerOptions {
	/** Whether the backend accepts saves at all (capability + config). */
	enabled: boolean;
	/** Debounce window in ms after the last activity. Default 1500. */
	intervalMs: number;
	/** Build the snapshot to persist. */
	collect: () => { sessionId: string; state: unknown };
	/** Persist one snapshot. */
	save: (request: { sessionId: string; state: unknown }) => Promise<{ success: boolean }>;
	/** True while a navigation or submission transition is in flight. */
	isBlocked: () => boolean;
	/** Whether delivery has ended (finalized, destroyed, stopped). */
	isStopped: () => boolean;
	/** Indicator/host state changes. */
	onStateChange: (state: AutosaveState) => void;
	/** Raw failure detail for logs and host callbacks. */
	onError: (error: Error) => void;
}

const DEFAULT_INTERVAL_MS = 1500;

export class AutosaveManager {
	private state: AutosaveState = { status: 'idle' };
	private timer: ReturnType<typeof setTimeout> | null = null;
	private flushing: Promise<void> | null = null;
	private stopped = false;
	private readonly intervalMs: number;

	constructor(private readonly options: AutosaveManagerOptions) {
		this.intervalMs = Math.max(0, options.intervalMs ?? DEFAULT_INTERVAL_MS);
	}

	/** The current indicator state. */
	public getState(): AutosaveState {
		return { ...this.state };
	}

	/**
	 * Candidate activity happened (response edit, navigation, flag, timer visibility,
	 * pause). Restarts the debounce window; a due-but-blocked save is re-queued until
	 * the transition settles.
	 */
	public notify(): void {
		if (this.stopped || !this.options.enabled || this.options.isStopped()) return;
		if (this.timer !== null) clearTimeout(this.timer);
		this.setState({ status: 'pending', lastSavedAt: this.state.lastSavedAt });
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.saveNow();
		}, this.intervalMs);
	}

	/**
	 * Save immediately (best-effort): `visibilitychange`/`pagehide`, or any host that
	 * wants a durable draft now. While a transition is in flight the save is re-queued
	 * on the debounce window instead of racing it. Safe to call concurrently; the
	 * in-flight save is shared.
	 */
	public flush(): Promise<void> {
		if (this.stopped || !this.options.enabled || this.options.isStopped()) {
			return Promise.resolve();
		}
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (this.options.isBlocked()) {
			this.scheduleRetry();
			return Promise.resolve();
		}
		this.flushing ??= this.persist().finally(() => {
			this.flushing = null;
		});
		return this.flushing;
	}

	/** Stop autosaving for good: nothing runs afterwards, pending timers cleared. */
	public stop(): void {
		this.stopped = true;
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.setState({ status: this.state.status === 'failed' ? 'failed' : 'idle', lastSavedAt: this.state.lastSavedAt });
	}

	private scheduleRetry(): void {
		if (this.timer !== null) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.saveNow();
		}, this.intervalMs);
	}

	private async saveNow(): Promise<void> {
		if (this.stopped || this.options.isStopped()) return;
		if (this.options.isBlocked()) {
			this.scheduleRetry();
			return;
		}
		if (this.flushing) return this.flushing;
		this.flushing = this.persist().finally(() => {
			this.flushing = null;
		});
		return this.flushing;
	}

	private async persist(): Promise<void> {
		this.setState({ status: 'saving', lastSavedAt: this.state.lastSavedAt });
		try {
			const request = this.options.collect();
			const response = await this.options.save(request as never);
			if (this.stopped || this.options.isStopped()) return;
			if (!response?.success) {
				throw new Error('Autosave was rejected by the backend.');
			}
			this.setState({ status: 'saved', lastSavedAt: Date.now() });
		} catch (error) {
			if (this.stopped || this.options.isStopped()) return;
			const failure = error instanceof Error ? error : new Error(String(error));
			// Non-fatal: the draft simply is not durable yet; the next change or flush retries.
			console.error('[AssessmentPlayer] autosave failed:', failure);
			this.options.onError(failure);
			this.setState({ status: 'failed', lastSavedAt: this.state.lastSavedAt });
		}
	}

	private setState(state: AutosaveState): void {
		this.state = state;
		this.options.onStateChange({ ...state });
	}
}
