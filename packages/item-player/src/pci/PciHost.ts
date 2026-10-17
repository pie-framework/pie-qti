import type {
	ExtractedPci,
	PciHostController,
	PciHostOptions,
	PciModulePathKind,
	PciModuleResolver,
	PciRegistryObservation,
	QtiCustomInteractionRegistration,
	QtiPciConfiguration,
	QtiPciInstance,
} from './types.js';
import { PciLoadError, PciModuleResolverRequiredError } from './types.js';
import { getSharedPciRegistry } from './registry.js';
import { fromQtiVariableJson, toQtiVariableJson } from './qtiVariableJson.js';
import {
	DEFAULT_RESOLUTION_CONFIG_PATHS,
	emptyResolutionConfig,
	parseModuleResolutionConfig,
	type PciResolutionConfig,
} from './resolutionConfig.js';
import { createAmdLoader } from './amdLoader.js';

const DEFAULT_REGISTRATION_TIMEOUT_MS = 5000;

/**
 * Loads, initializes, and manages the lifecycle of a single PCI module under the
 * QTI 3.0 §6.1 contract.
 *
 * The module is expected to register itself against the page's
 * `qtiCustomInteractionContext` as its code evaluates; the host resolver decides
 * whether that evaluation happens. Instantiation goes through the registered
 * `getInstance(dom, configuration, state)` factory — state in, `getResponse()` /
 * `getState()` out — and there is no setter: an authoritative response change
 * re-instantiates the module.
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
	private readonly responseDeclaration: PciHostOptions['responseDeclaration'];
	private readonly statusSource: PciHostOptions['status'];
	private readonly registrationTimeoutMs: number;
	private readonly registry: PciRegistryObservation;
	private registration: QtiCustomInteractionRegistration | null = null;
	private instance: QtiPciInstance | null = null;
	private mountNode: HTMLElement | null = null;
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

	constructor(data: ExtractedPci, options: PciHostOptions | string = {}) {
		this.data = data;
		this.baseUrl = typeof options === 'string' ? options : (options.baseUrl ?? '');
		this.moduleResolver = typeof options === 'string' ? undefined : options.moduleResolver;
		this.responseDeclaration =
			typeof options === 'string' ? undefined : options.responseDeclaration;
		this.statusSource = typeof options === 'string' ? undefined : options.status;
		this.registrationTimeoutMs =
			typeof options === 'string'
				? DEFAULT_REGISTRATION_TIMEOUT_MS
				: (options.registrationTimeoutMs ?? DEFAULT_REGISTRATION_TIMEOUT_MS);
		this.registry = typeof options === 'string' ? getSharedPciRegistry() : (options.registry ?? getSharedPciRegistry());
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
	 * Evaluate the PCI module from primaryPath, falling back to fallbackPath, and
	 * take the module's registration from `qtiCustomInteractionContext`. A
	 * multi-module declaration (or an authored resolution config) loads through
	 * the AMD loader, which wires `define` dependencies by id. Throws PciLoadError
	 * when both paths fail or the module never registers.
	 */
	public async load(): Promise<void> {
		if (this.destroyed) {
			throw new Error('Cannot load a destroyed PciHost');
		}
		if (!this.moduleResolver) {
			throw new PciModuleResolverRequiredError(
				this.data.responseIdentifier,
				this.data.primaryPath
			);
		}
		const generation = ++this.loadGeneration;

		const useAmd = this.data.modules.length > 1 || this.data.resolutionConfigPath !== undefined;
		if (useAmd) {
			await this.loadViaAmd(generation);
			return;
		}

		const primary = this.resolveUrl(this.data.primaryPath);
		try {
			await this.evaluateModule(primary, this.data.primaryPath, 'primary');
			this.adoptRegistration(await this.awaitRegistration(), generation);
			return;
		} catch (primaryErr) {
			if (!this.isCurrentLoad(generation)) throw primaryErr;
			if (!this.data.fallbackPath) {
				throw new PciLoadError(this.data.primaryPath, undefined, primaryErr as Error);
			}
		}

		const fallback = this.resolveUrl(this.data.fallbackPath!);
		try {
			await this.evaluateModule(fallback, this.data.fallbackPath!, 'fallback');
			this.adoptRegistration(await this.awaitRegistration(), generation);
		} catch (fallbackErr) {
			if (!this.isCurrentLoad(generation)) throw fallbackErr;
			throw new PciLoadError(
				this.data.primaryPath,
				this.data.fallbackPath,
				fallbackErr as Error
			);
		}
	}

	/**
	 * Instantiate the PCI inside the given DOM element through the registered
	 * `getInstance` factory, seeding it with the held state. Must be called after
	 * load() resolves.
	 */
	public initialize(dom: HTMLElement): void {
		if (!this.registration) return;
		this.mountNode = dom;
		this._lastSeed = this.seedValue();

		try {
			const returned = this.registration.getInstance(dom, this.buildConfiguration(), this.seedValue());
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
				return fromQtiVariableJson(this.instance.getResponse());
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
		this._responseChangeListeners.clear();
		this._remountRequestListeners.clear();
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private destroyInstance(): void {
		const instance = this.instance as { destroy?: () => void } | null;
		instance?.destroy?.();
		this.instance = null;
	}

	/**
	 * Re-instantiate the current module on the last mount node, discarding the
	 * previous instance. The DOM scaffold is not reset here — that is the
	 * renderer's job, and this path exists for hosts that wired none.
	 */
	private rebuildInPlace(): void {
		if (!this.mountNode || !this.registration || this.destroyed) return;
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

	private awaitRegistration(): Promise<QtiCustomInteractionRegistration> {
		const typeIdentifier = this.data.customInteractionTypeIdentifier;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(new Error(`PCI module for '${typeIdentifier}' did not register`)),
				this.registrationTimeoutMs
			);
		});
		return Promise.race([this.registry.whenRegistered(typeIdentifier), timeout]).finally(() => {
			if (timer !== undefined) clearTimeout(timer);
		});
	}

	private evaluateModule(
		resolvedUrl: string,
		authoredPath: string,
		kind: PciModulePathKind
	): Promise<unknown> {
		return Promise.resolve(
			this.moduleResolver!(resolvedUrl, {
				authoredPath,
				kind,
				responseIdentifier: this.data.responseIdentifier,
				customInteractionTypeIdentifier: this.data.customInteractionTypeIdentifier,
			})
		);
	}

	/**
	 * Multi-module loading: fetch the resolution config (authored reference first,
	 * then the defined default locations), then drive the entry module — its
	 * primary path, or its fallback — through the AMD loader so `define`
	 * dependencies wire up before the registration is read.
	 */
	private async loadViaAmd(generation: number): Promise<void> {
		const entry =
			this.data.modules.find((module) => module.primaryPath === this.data.primaryPath) ??
			this.data.modules[this.data.modules.length - 1];
		const attempt = async (entryPath: string, kind: PciModulePathKind): Promise<void> => {
			const config = await this.loadResolutionConfig();
			const loader = createAmdLoader({
				baseUrl: this.baseUrl,
				config,
				evaluate: (resolvedUrl, authoredPath) => this.evaluateModule(resolvedUrl, authoredPath, kind),
				resolveUrl: (path) => this.resolveUrl(path),
			});
			loader.install();
			try {
				// Authored `qti-interaction-module` entries bind their own ids; the
				// resolution config fills in dependency ids the item does not declare.
				loader.addPaths(
					Object.fromEntries(
						this.data.modules
							.filter((module) => module.primaryPath)
							.map((module) => [module.id || module.primaryPath, module.primaryPath])
					)
				);
				const entryId = this.data.modules.find((module) => module.primaryPath === entryPath)?.id || entryPath;
				await loader.load([entryId]);
				this.adoptRegistration(await this.awaitRegistration(), generation);
			} finally {
				loader.dispose();
			}
		};

		try {
			await attempt(this.data.primaryPath, 'primary');
		} catch (primaryErr) {
			if (!this.isCurrentLoad(generation)) throw primaryErr;
			const fallbackPath = entry?.fallbackPath;
			if (!fallbackPath) {
				throw new PciLoadError(
					this.data.primaryPath,
					undefined,
					primaryErr as Error
				);
			}
			try {
				await attempt(fallbackPath, 'fallback');
			} catch (fallbackErr) {
				if (!this.isCurrentLoad(generation)) throw fallbackErr;
				throw new PciLoadError(
					this.data.primaryPath,
					fallbackPath,
					fallbackErr as Error
				);
			}
		}
	}

	/** The resolution config: the authored reference, then the defined default locations. */
	private async loadResolutionConfig(): Promise<PciResolutionConfig> {
		const candidates = this.data.resolutionConfigPath
			? [this.data.resolutionConfigPath, ...DEFAULT_RESOLUTION_CONFIG_PATHS]
			: DEFAULT_RESOLUTION_CONFIG_PATHS;
		for (const path of candidates) {
			try {
				const raw = await this.evaluateModule(this.resolveUrl(path), path, 'primary');
				const parsed = parseModuleResolutionConfig(raw);
				if (Object.keys(parsed.paths).length > 0) return parsed;
			} catch {
				// A package without a config file at this location falls through.
			}
		}
		return emptyResolutionConfig();
	}

	private resolveUrl(path: string): string {
		if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || path.startsWith('/')) {
			return path;
		}
		if (!this.baseUrl) return path;
		// Relative path: resolve against baseUrl
		const base = this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/';
		try {
			return new URL(path, base).href;
		} catch {
			return base + path;
		}
	}

	private isCurrentLoad(generation: number): boolean {
		return !this.destroyed && generation === this.loadGeneration;
	}

	private adoptRegistration(
		registration: QtiCustomInteractionRegistration,
		generation: number
	): void {
		if (!registration || typeof registration.getInstance !== 'function') {
			throw new Error(
				`PCI registration for '${this.data.customInteractionTypeIdentifier}' is not a valid spec registration`
			);
		}
		if (!this.isCurrentLoad(generation)) {
			throw new Error('PciHost was destroyed before its module finished loading');
		}
		this.registration = registration;
		// A freshly adopted module has reported nothing yet; its old instance,
		// from a previous load, is gone with the re-resolution.
		this.destroyInstance();
		this._moduleOwnsResponse = false;
	}
}

/** A response's cardinality from its JavaScript shape, when no declaration is known. */
function inferCardinality(value: unknown): 'single' | 'multiple' {
	return Array.isArray(value) ? 'multiple' : 'single';
}
