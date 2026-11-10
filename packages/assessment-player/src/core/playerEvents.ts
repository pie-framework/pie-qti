/**
 * Typed event emitter for the assessment player's notifications.
 *
 * Replaces the thirteen per-event listener `Set`s AssessmentPlayer used to hold
 * (pure code motion): insertion-order, synchronous dispatch exactly as the sets
 * did — listeners run in the order they subscribed, each notification happens in
 * the same synchronous block as before, and a listener that unsubscribes itself
 * (or another not-yet-visited listener) during dispatch takes effect for the
 * remaining listeners, because iteration walks the live set.
 *
 * The player's public `on*` subscription methods keep their exact signatures;
 * the host-config callbacks (`config.onItemChange` &c.) stay in the player's
 * notify helpers, which fire after the listener set exactly as before.
 */

export type Listener<Args extends unknown[]> = (...args: Args) => void;

export class TypedEventEmitter<Events extends { [K in keyof Events]: unknown[] }> {
	#sets = new Map<keyof Events & string, Set<Listener<never>>>();

	/** Subscribe; returns the unsubscribe function (idempotent). */
	on<K extends keyof Events & string>(event: K, listener: Listener<Events[K]>): () => void {
		let set = this.#sets.get(event);
		if (!set) {
			set = new Set();
			this.#sets.set(event, set);
		}
		set.add(listener as Listener<never>);
		return () => {
			set.delete(listener as Listener<never>);
		};
	}

	/** Call every current listener of `event` with `args`, in subscription order. */
	emit<K extends keyof Events & string>(event: K, ...args: Events[K]): void {
		const set = this.#sets.get(event);
		if (!set) return;
		for (const listener of set) (listener as Listener<Events[K]>)(...args);
	}

	/** Drop every listener of every event (teardown). */
	clear(): void {
		this.#sets.clear();
	}
}

/** The player's notification contract: one entry per public `on*` subscription. */
export interface AssessmentPlayerEventMap {
	itemChange: [index: number, total: number];
	sectionChange: [index: number, totalSections: number];
	responseChange: [responses: Record<string, unknown>];
	complete: [results: import('../types/index.js').AssessmentResults];
	busyChange: [busy: boolean];
	testFeedbackChange: [];
	timeWarning: [remainingSeconds: number];
	timeExpired: [event: import('./AssessmentPlayer.js').AssessmentTimeExpiryEvent];
	scopeTimeExpired: [event: import('./AssessmentPlayer.js').ScopeTimeExpiryEvent];
	pauseChange: [paused: boolean, reason?: string];
	timeTick: [remainingSeconds: number, elapsedSeconds: number];
	flagChange: [itemIdentifier: string, flagged: boolean];
	autosaveChange: [state: import('./AutosaveManager.js').AutosaveState];
}
