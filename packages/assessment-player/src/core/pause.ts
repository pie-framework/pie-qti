/**
 * The proctor pause state machine.
 *
 * A pause freezes every clock (assessment, test part, section, item) and the live
 * attempt, and candidate actions are rejected with a coded `assessmentPaused` error
 * until resume. A pause requested while a navigation or submission transition is in
 * flight applies once that transition settles. While already paused, a new reason
 * replaces the shown one.
 *
 * Extracted from `AssessmentPlayer.ts` as an independent piece (pure code motion):
 * the controller owns the paused/reason pair; the orchestrator supplies the effects
 * (freeze and unfreeze the clocks and the live attempt) and hears `changed` to fire
 * its `pauseChange` notifications. It never takes the transition lock itself.
 */

export interface PauseControllerOptions {
	/** Whether a navigation or submission transition is in flight right now. */
	isBusy: () => boolean;
	/** Subscribe to transition activity (used to apply a pause once a transition settles). */
	onTransitionActivity: (listener: () => void) => () => void;
	/** Freeze every clock and suspend the live attempt. */
	freeze: () => void;
	/** Continue the clocks and reopen the live attempt (only when `unfreezeAllowed`). */
	unfreeze: () => void;
	/** Whether delivery may continue the clocks now (begun, not finalized). */
	unfreezeAllowed: () => boolean;
	/** The pause started or ended (or, while paused, its reason changed). */
	changed: (paused: boolean, reason?: string) => void;
	/** Fires after a resume settled (the player re-checks a restored expiry finalization). */
	afterResume: () => void;
	/** True once the player is destroyed (resume is a no-op). */
	isDestroyed: () => boolean;
}

export class PauseController {
	#paused = false;
	#reason: string | undefined;
	readonly #options: PauseControllerOptions;

	constructor(options: PauseControllerOptions) {
		this.#options = options;
	}

	/** Whether a proctor pause is in force. */
	get paused(): boolean {
		return this.#paused;
	}

	/** The candidate-facing reason given for the current pause, if any. */
	get reason(): string | undefined {
		return this.#paused ? this.#reason : undefined;
	}

	/**
	 * Start (or re-reason) a pause. `reason` is host-supplied, candidate-facing text
	 * shown with the pause (localize it in the host).
	 */
	pause(reason?: string): void {
		const nextReason = reason?.trim() || undefined;
		if (this.#paused) {
			if (nextReason !== this.#reason) {
				this.#reason = nextReason;
				this.#options.changed(this.#paused, this.reason);
			}
			return;
		}
		if (this.#options.isBusy()) {
			const off = this.#options.onTransitionActivity(() => {
				if (this.#options.isBusy()) return;
				off();
				this.pause(reason);
			});
			return;
		}
		this.#paused = true;
		this.#reason = nextReason;
		this.#options.freeze();
		this.#options.changed(this.#paused, this.reason);
	}

	/** End a proctor pause: the clocks continue and the live attempt reopens where it stood. */
	resume(): void {
		if (!this.#paused || this.#options.isDestroyed()) return;
		this.#paused = false;
		this.#reason = undefined;
		if (this.#options.unfreezeAllowed()) this.#options.unfreeze();
		this.#options.changed(this.#paused, this.reason);
		this.#options.afterResume();
	}

	/**
	 * Adopt a pause carried by a snapshot (a session saved during a pause reopens
	 * paused, its clocks frozen). Returns whether the paused state changed, so the
	 * caller reports it once.
	 */
	setFromRestore(paused: boolean, rawReason: string | undefined): boolean {
		const wasPaused = this.#paused;
		this.#paused = paused;
		this.#reason = paused ? rawReason : undefined;
		return wasPaused !== paused;
	}

	/**
	 * The session reached its terminal state: the pause no longer holds anything
	 * (no pause event — the end of the test is it).
	 */
	clearSilently(): void {
		this.#paused = false;
		this.#reason = undefined;
	}
}
