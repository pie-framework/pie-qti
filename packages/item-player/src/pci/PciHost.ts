import type {
	ExtractedPci,
	PciHostController,
	PciHostOptions,
	PciModuleResolver,
	PciRegistryObservation,
	QtiPciConfiguration,
	QtiPciInstance,
} from './types.js';
import { PciModuleResolverRequiredError } from './types.js';
import { getSharedPciRegistry } from './registry.js';
import { fromQtiVariableJson, toQtiVariableJson } from './qtiVariableJson.js';
import { PageRealmPciSession } from './pageRealmSession.js';
import { SandboxedPciSession } from './sandbox/SandboxedPciSession.js';
import type { PciModuleSession } from './moduleSession.js';

/**
 * Loads, initializes, and manages the lifecycle of a single PCI module under the
 * QTI 3.0 §6.1 contract.
 *
 * The module-facing contract is engine-independent: a module registers itself
 * against `qtiCustomInteractionContext` as its code evaluates, instantiation
 * goes through the registered `getInstance(dom, configuration, state)` factory
 * — state in, `getResponse()` / `getState()` out, no setter — and an
 * authoritative response change re-instantiates the module. What the host
 * chooses is *where that code runs*: by default the page realm behind a host
 * resolver (`moduleResolver`), or, with `sandbox` configured, a cross-origin
 * runner frame whose document has an opaque origin. The response-ownership
 * state machine below is shared by both engines; only the execution backend
 * (`PciModuleSession`) differs.
 *
 * Usage:
 *   const host = new PciHost(extractedData, { baseUrl, moduleResolver });
 *   await host.load();
 *   host.initialize(domNode);
 *   host.getResponse(); // current response, in the player's runtime value shape
 *   host.destroy();     // cleanup on player teardown
 */
export class PciHost implements PciHostController {
	private readonly data: ExtractedPci;
	private readonly baseUrl: string;
	private readonly moduleResolver: PciModuleResolver | undefined;
	private readonly sandboxConfig: PciHostOptions['sandbox'];
	private readonly responseDeclaration: PciHostOptions['responseDeclaration'];
	private readonly statusSource: PciHostOptions['status'];
	private readonly registry: PciRegistryObservation;
	private readonly session: PciModuleSession;
	private instance: QtiPciInstance | null = null;
	private mountNode: HTMLElement | null = null;
	private loaded = false;
	private destroyed = false;
	private loadGeneration = 0;
	private _response: unknown = null;
	private _hasResponse = false;
	/**
	 * True once a mounted module has reported a response (through its own getResponse
	 * captured at `onready`/`ondone`). While set, the module is the source of truth and
	 * `offerResponse()` will not overwrite it.
	 */
	private _moduleOwnsResponse = false;
	/**
	 * True between an authoritative `restore()` and the rebuild that applies it.
	 * The mounted module still holds the superseded value during that window, so
	 * `getResponse()` must report the held one.
	 */
	private _restorePending = false;
	/** The module's own state snapshot, seeded back at the next `getInstance`. */
	private _instanceState: unknown;
	/** The held value the current instantiation was seeded with, for no-op echo detection. */
	private _lastSeed: unknown;
	private readonly _responseChangeListeners = new Set<
		(responseId: string, value: unknown) => void
	>();
	private readonly _remountRequestListeners = new Set<() => void>();
	private readonly _errorListeners = new Set<(error: Error) => void>();

	constructor(data: ExtractedPci, options: PciHostOptions | string = {}) {
		this.data = data;
		this.baseUrl = typeof options === 'string' ? options : (options.baseUrl ?? '');
		this.moduleResolver = typeof options === 'string' ? undefined : options.moduleResolver;
		this.sandboxConfig = typeof options === 'string' ? undefined : options.sandbox;
		this.responseDeclaration =
			typeof options === 'string' ? undefined : options.responseDeclaration;
		this.statusSource = typeof options === 'string' ? undefined : options.status;
		this.registry = typeof options === 'string' ? getSharedPciRegistry() : (options.registry ?? getSharedPciRegistry());

		if (this.sandboxConfig) {
			this.session = new SandboxedPciSession({
				sandbox: this.sandboxConfig,
				data,
				baseUrl: this.baseUrl,
				modulePolicy: typeof options === 'string' ? undefined : options.modulePolicy,
				frameConnector: typeof options === 'string' ? undefined : options.frameConnector,
				parentOrigin: typeof options === 'string' ? undefined : options.parentOrigin,
			});
		} else {
			this.session = new PageRealmPciSession({
				data,
				baseUrl: this.baseUrl,
				moduleResolver: this.moduleResolver,
				registry: this.registry,
				...(typeof options === 'string' ? {} : { registrationTimeoutMs: options.registrationTimeoutMs }),
			});
		}
		this.session.onRemoteReport?.((report) => {
			// The proxy's cache already carries the pushed response; the state
			// joins the instance state and the report counts as the module's own.
			if (report.state !== undefined) this._instanceState = report.state;
			this.captureInstanceResponse();
		});
		this.session.onError?.((error) => {
			for (const listener of this._errorListeners) listener(error);
		});
	}

	/**
	 * Register a callback to fire when the PCI's response changes. The player calls
	 * this to wire the PCI into its internal response map. Values arrive in the
	 * player's runtime shape; QTI variable JSON conversion happened at the boundary.
	 */
	public onResponseChange(callback: (responseId: string, value: unknown) => void): () => void {
		this._responseChangeListeners.add(callback);
		return () => this._responseChangeListeners.delete(callback);
	}

	/**
	 * Register a callback fired when an authoritative `restore()` lands on a
	 * mounted module and the module must be rebuilt from the restored value.
	 *
	 * The renderer owns the DOM scaffold and its sanitization, so it performs the
	 * rebuild: reset the sanitized markup into the mount node, then call
	 * `remount(node)`. A host with no renderer wired here re-instantiates the
	 * module on the last mount node itself.
	 */
	public onRemountRequest(callback: () => void): () => void {
		this._remountRequestListeners.add(callback);
		return () => this._remountRequestListeners.delete(callback);
	}

	/**
	 * Register a callback for asynchronous engine failures: the sandboxed
	 * engine's frame handshake, in-frame module load, or instance errors. The
	 * page-realm engine rejects `load()` instead and never uses this channel.
	 */
	public onError(callback: (error: Error) => void): () => void {
		this._errorListeners.add(callback);
		return () => this._errorListeners.delete(callback);
	}

	/**
	 * Bring the module's execution backend up: page-realm hosts evaluate the
	 * module (primary path, then fallback, through the AMD loader for
	 * multi-module declarations) and adopt its registration; the sandboxed
	 * engine prepares the init payload and defers the module load to the runner
	 * frame, whose failures surface through `onError`. Throws PciLoadError when
	 * both page-realm paths fail or the module never registers.
	 */
	public async load(): Promise<void> {
		if (this.destroyed) {
			throw new Error('Cannot load a destroyed PciHost');
		}
		const generation = ++this.loadGeneration;
		await this.session.load({ isCurrent: () => this.isCurrentLoad(generation) });
		// A freshly adopted module has reported nothing yet; its old instance,
		// from a previous load, is gone with the re-resolution.
		this.destroyInstance();
		this._moduleOwnsResponse = false;
		this.loaded = true;
	}

	/**
	 * Instantiate the PCI inside the given DOM element through the registered
	 * `getInstance` factory, seeding it with the held state. Must be called after
	 * load() resolves. The sandboxed engine mounts its runner frame here instead:
	 * the frame element replaces the scaffold's markup, because the module renders
	 * inside the frame, not on the page.
	 */
	public initialize(dom: HTMLElement): void {
		if (!this.loaded) return;
		this.mountNode = dom;
		this._lastSeed = this.seedValue();

		try {
			const returned = this.session.instantiate(dom, this.buildConfiguration(), this.seedValue());
			if (returned && typeof returned === 'object') this.instance = returned;
			this._restorePending = false;
		} catch (error) {
			this.instance = null;
			throw error;
		}
	}

	/** Return the current response value, in the player's runtime value shape. */
	public getResponse(): unknown {
		if (this._restorePending) return this._response;
		if (this.instance) {
			try {
				const value = fromQtiVariableJson(this.instance.getResponse());
				if ((value === null || value === undefined) && this._hasResponse && !this._moduleOwnsResponse) {
					// A freshly instantiated module that has reported nothing yet: the
					// held value is what this instantiation was seeded with (the
					// sandboxed engine's cache stays empty until the frame's first
					// report crosses the bridge).
					return this._response;
				}
				return value;
			} catch {
				return this._response;
			}
		}
		return this._response;
	}

	/** The mounted module's state snapshot, when it exposes `getState()`. */
	public getState(): unknown {
		const live = this.instance?.getState?.();
		return live === undefined ? this._instanceState : live;
	}

	/**
	 * Offer a response the player believes to be current.
	 *
	 * Declined once a mounted module has reported a response of its own. Under the
	 * spec contract there is no setter, so an accepted offer before any report is
	 * either held for the next instantiation or, when the value differs from what
	 * the mounted module was seeded with, applied by re-instantiating it in place.
	 *
	 * @returns `false` when the module retained ownership and the value was not applied.
	 */
	public offerResponse(value: unknown): boolean {
		if (this._moduleOwnsResponse) return false;
		const unchanged = this.instance !== null && this.valuesEqual(value, this._lastSeed);
		this._response = value;
		this._hasResponse = true;
		if (!this.instance || unchanged) return true;
		this.rebuildInPlace();
		return true;
	}

	/**
	 * Authoritatively replace the response, discarding in-progress candidate
	 * state and returning ownership to the player.
	 *
	 * "Discard candidate state" is re-instantiation: state is injected at
	 * `getInstance` and the contract offers no setter. Where a renderer is wired
	 * to `onRemountRequest` it rebuilds through a scaffold reset; otherwise this
	 * host re-instantiates the module on the last mount node itself. Until the
	 * rebuild lands, `getResponse()` reports the restored value rather than the
	 * module's superseded one.
	 */
	public restore(value: unknown): void {
		this._response = value;
		this._hasResponse = true;
		this._moduleOwnsResponse = false;
		if (!this.instance && !this.mountNode) return;
		if (this._remountRequestListeners.size > 0) {
			this._restorePending = true;
			for (const listener of this._remountRequestListeners) listener();
			return;
		}
		if (this.instance) this.rebuildInPlace();
	}

	/**
	 * Rebuild the module in place from the currently held response.
	 *
	 * The caller must reset the sanitized DOM scaffold into `dom` first: this
	 * discards the previous module instance, re-resolves the registration, and
	 * instantiates it with the held state.
	 */
	public async remount(dom: HTMLElement): Promise<void> {
		if (this.destroyed) throw new Error('Cannot remount a destroyed PciHost');
		this.destroyInstance();
		await this.load();
		this.initialize(dom);
	}

	/**
	 * Nudge the module out of interaction, for hosts whose module exposes the
	 * optional `disable` method. Conformant modules read their fixed
	 * `configuration.status` instead.
	 */
	public disable(): void {
		(this.instance as { disable?: () => void } | null)?.disable?.();
	}

	/** The counterpart of `disable()`, for modules that expose it. */
	public enable(): void {
		(this.instance as { enable?: () => void } | null)?.enable?.();
	}

	/** Tear down the PCI and release all resources. */
	public destroy(): void {
		this.destroyed = true;
		this.loadGeneration++;
		// Keep the last known module state answerable after teardown.
		this._instanceState = this.instance?.getState?.() ?? this._instanceState;
		this.destroyInstance();
		this.session.dispose();
		this._responseChangeListeners.clear();
		this._remountRequestListeners.clear();
		this._errorListeners.clear();
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private destroyInstance(): void {
		const instance = this.instance;
		this.instance = null;
		if (!instance) return;
		this.session.destroyInstance(instance);
	}

	/**
	 * Re-instantiate the current module on the last mount node, discarding the
	 * previous instance. The DOM scaffold is not reset here — that is the
	 * renderer's job, and this path exists for hosts that wired none.
	 */
	private rebuildInPlace(): void {
		if (!this.mountNode || !this.loaded || this.destroyed) return;
		this.destroyInstance();
		this._instanceState = undefined;
		this.initialize(this.mountNode);
	}

	private buildConfiguration(): QtiPciConfiguration {
		return {
			responseIdentifier: this.data.responseIdentifier,
			status: typeof this.statusSource === 'function' ? this.statusSource() : (this.statusSource ?? 'interacting'),
			properties: { ...this.data.config },
			onready: (_instance, state) => {
				if (state !== undefined) this._instanceState = state;
				this.captureInstanceResponse();
			},
			ondone: (_instance, state) => {
				if (state !== undefined) this._instanceState = state;
				this.captureInstanceResponse();
			},
		};
	}

	/** Take the mounted module's response as its own report and publish it. */
	private captureInstanceResponse(): void {
		if (!this.instance) return;
		try {
			const value = fromQtiVariableJson(this.instance.getResponse());
			if (value === null && !this._hasResponse) return;
			this._response = value;
			this._hasResponse = true;
			this._moduleOwnsResponse = true;
			this._restorePending = false;
			for (const listener of this._responseChangeListeners) {
				listener(this.data.responseIdentifier, value);
			}
		} catch {
			// A module whose getResponse() throws has reported nothing yet.
		}
	}

	/** The held response as the `state` a fresh instantiation receives. */
	private seedValue(): unknown {
		if (this._instanceState !== undefined) return this._instanceState;
		if (!this._hasResponse) return undefined;
		const cardinality = this.responseDeclaration?.cardinality ?? inferCardinality(this._response);
		return toQtiVariableJson(
			this._response,
			this.responseDeclaration?.baseType,
			cardinality
		);
	}

	private valuesEqual(a: unknown, b: unknown): boolean {
		if (a === b) return true;
		try {
			return JSON.stringify(a) === JSON.stringify(b);
		} catch {
			return false;
		}
	}

	private isCurrentLoad(generation: number): boolean {
		return !this.destroyed && generation === this.loadGeneration;
	}
}

/** A response's cardinality from its JavaScript shape, when no declaration is known. */
function inferCardinality(value: unknown): 'single' | 'multiple' {
	return Array.isArray(value) ? 'multiple' : 'single';
}
