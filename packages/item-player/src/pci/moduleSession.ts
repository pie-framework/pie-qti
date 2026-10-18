import type { QtiPciConfiguration, QtiPciInstance } from './types.js';

/** Identity of one `PciHost.load()` call, so a stale load can be detected. */
export interface PciLoadContext {
	/** False once the host was destroyed or a newer load superseded this one. */
	isCurrent(): boolean;
}

/**
 * One module's execution backend beneath `PciHost`'s response-ownership state
 * machine. Two implementations exist: the page realm, where the host resolver
 * evaluates the module in-page, and the sandboxed engine, where the module runs
 * in a cross-origin runner frame and every contract call crosses the bridge.
 *
 * The instantiation seam is the specified one — `getInstance`-shaped: state in,
 * a `getResponse()`/`getState()` instance out, no setter. A sandboxed session
 * returns a proxy whose reads answer from the bridge-maintained cache.
 */
export interface PciModuleSession {
	/** Prepare/evaluate the module. Throws on failure, as `PciHost.load()` did. */
	load(context: PciLoadContext): Promise<void>;
	/**
	 * Create the interaction instance inside `dom`, seeded with `state`.
	 * Synchronous from the host's side: a sandboxed session queues the bridge
	 * messages and the instance reports readiness asynchronously.
	 */
	instantiate(
		dom: HTMLElement,
		configuration: QtiPciConfiguration,
		state: unknown
	): QtiPciInstance | undefined;
	/** Discard the instance; the session stays usable for a fresh `instantiate`. */
	destroyInstance(instance: QtiPciInstance): void;
	/** Final teardown of everything the session created. */
	dispose(): void;
	/**
	 * Response/state pushes that arrive outside the `onready`/`ondone` lifecycle
	 * — the sandboxed engine's poll. The handler's `state` joins the host's
	 * instance-state; the response itself travels through the returned
	 * instance's cache, which the host reads with `getResponse()`.
	 */
	onRemoteReport?(handler: (report: { state?: unknown }) => void): () => void;
	/** Asynchronous failures that surface after `load()` resolved. */
	onError?(handler: (error: Error) => void): () => void;
}
