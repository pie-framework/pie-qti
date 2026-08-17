import type {
	ExtractedPci,
	PciBoundTo,
	PciHostController,
	PciHostOptions,
	PciModule,
	PciModulePathKind,
	PciModuleResolver,
} from './types.js';
import { PciLoadError, PciModuleResolverRequiredError } from './types.js';

/**
 * Loads, initializes, and manages the lifecycle of a single PCI module.
 *
 * Usage:
 *   const host = new PciHost(extractedData, { baseUrl, moduleResolver });
 *   await host.load();
 *   host.initialize(domNode);
 *   host.getResponse(); // returns current response
 *   host.destroy();     // cleanup on player teardown
 */
export class PciHost implements PciHostController {
	private readonly data: ExtractedPci;
	private readonly baseUrl: string;
	private readonly moduleResolver: PciModuleResolver | undefined;
	private module: PciModule | null = null;
	private destroyed = false;
	private loadGeneration = 0;
	private _response: unknown = null;
	private _hasResponse = false;
	/**
	 * True once a mounted module has reported a response. While set, the module
	 * is the source of truth and `hydrate()` will not overwrite it.
	 */
	private _moduleOwnsResponse = false;
	private readonly _responseChangeListeners = new Set<
		(responseId: string, value: unknown) => void
	>();
	private readonly _reinitializeListeners = new Set<() => void>();

	constructor(data: ExtractedPci, options: PciHostOptions | string = {}) {
		this.data = data;
		this.baseUrl = typeof options === 'string' ? options : (options.baseUrl ?? '');
		this.moduleResolver = typeof options === 'string' ? undefined : options.moduleResolver;
	}

	/**
	 * Register a callback to fire when the PCI's response changes.
	 * The player calls this to wire the PCI into its internal response map.
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
	 * `remount(node)`.
	 */
	public onReinitializeRequest(callback: () => void): () => void {
		this._reinitializeListeners.add(callback);
		return () => this._reinitializeListeners.delete(callback);
	}

	/**
	 * Load the PCI module from primaryPath, falling back to fallbackPath.
	 * Throws PciLoadError if both fail.
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

		const primary = this.resolveUrl(this.data.primaryPath);
		try {
			const mod = await this.resolveModule(primary, this.data.primaryPath, 'primary');
			this.adoptResolvedModule(mod, this.data.primaryPath, generation);
			return;
		} catch (primaryErr) {
			if (!this.isCurrentLoad(generation)) throw primaryErr;
			if (!this.data.fallbackPath) {
				throw new PciLoadError(this.data.primaryPath, undefined, primaryErr as Error);
			}
		}

		const fallback = this.resolveUrl(this.data.fallbackPath!);
		try {
			const mod = await this.resolveModule(fallback, this.data.fallbackPath!, 'fallback');
			this.adoptResolvedModule(mod, this.data.fallbackPath!, generation);
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
	 * Initialize the PCI inside the given DOM element.
	 * Must be called after load() resolves.
	 */
	public initialize(dom: HTMLElement): void {
		if (!this.module) return;

		const boundTo: PciBoundTo = {
			onReady: () => {},
			onResponseChange: (value: unknown) => {
				this._response = value;
				this._hasResponse = true;
				this._moduleOwnsResponse = true;
				for (const listener of this._responseChangeListeners) {
					listener(this.data.responseIdentifier, value);
				}
			},
		};

		try {
			this.module.initialize(dom, this.data.config, boundTo);
			if (this._hasResponse) {
				this.module.setResponse(this._response);
			}
		} catch (error) {
			const failedModule = this.module;
			this.module = null;
			failedModule.destroy();
			throw error;
		}
	}

	/** Return the current response value from the PCI module. */
	public getResponse(): unknown {
		return this.module ? this.module.getResponse() : this._response;
	}

	/**
	 * Offer a response the player believes to be current.
	 *
	 * Declined once a mounted module has reported a response of its own. The
	 * player's response map echoes every change back through `setResponses`, so
	 * an unconditional push would hand the module its own value mid-interaction
	 * and rebuild whatever internal state — selection, cursor, undo history —
	 * the module derives from it. Use `restore()` when the player's value must
	 * win regardless.
	 *
	 * @returns `false` when the module retained ownership and the value was not applied.
	 */
	public hydrate(value: unknown): boolean {
		if (this._moduleOwnsResponse) return false;
		this._response = value;
		this._hasResponse = true;
		this.module?.setResponse(value);
		return true;
	}

	/**
	 * Authoritatively replace the response, discarding in-progress candidate
	 * state and returning ownership to the player.
	 *
	 * A mounted module is rebuilt from the restored value rather than mutated:
	 * "discard candidate state" is what re-instantiation means, and it is the
	 * only form the QTI 3.0 PCI contract offers, since state is injected at
	 * `getInstance` and there is no setter. Before mount, the value is held and
	 * applied by `initialize()`.
	 */
	public restore(value: unknown): void {
		this._response = value;
		this._hasResponse = true;
		this._moduleOwnsResponse = false;
		if (!this.module) return;
		for (const listener of this._reinitializeListeners) listener();
	}

	/**
	 * Rebuild the module in place from the currently held response.
	 *
	 * The caller must reset the sanitized DOM scaffold into `dom` first: this
	 * discards the previous module instance, resolves a fresh one through the
	 * host resolver, and initializes it, which seeds the held response.
	 */
	public async remount(dom: HTMLElement): Promise<void> {
		if (this.destroyed) throw new Error('Cannot remount a destroyed PciHost');
		this.module?.destroy();
		this.module = null;
		await this.load();
		this.initialize(dom);
	}

	/** Disable the PCI (e.g. when role is not candidate, or after final submission). */
	public disable(): void {
		this.module?.disable();
	}

	/** Re-enable the PCI. */
	public enable(): void {
		this.module?.enable();
	}

	/** Tear down the PCI and release all resources. */
	public destroy(): void {
		this.destroyed = true;
		this.loadGeneration++;
		this.module?.destroy();
		this.module = null;
		this._responseChangeListeners.clear();
		this._reinitializeListeners.clear();
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private resolveModule(
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

	private adoptResolvedModule(mod: unknown, authoredPath: string, generation: number): void {
		const candidate = this.extractPciInterface(mod, authoredPath);
		if (!this.isCurrentLoad(generation)) {
			candidate.destroy();
			throw new Error('PciHost was destroyed before its module finished loading');
		}
		this.module?.destroy();
		this.module = candidate;
		// A freshly adopted module has reported nothing yet.
		this._moduleOwnsResponse = false;
	}

	/**
	 * Extract a PciModule from the host resolver's result.
	 * Supports: default export, named `getInstance` export, or the module itself.
	 */
	private extractPciInterface(mod: any, authoredPath: string): PciModule {
		const candidate = mod?.default ?? mod?.getInstance?.() ?? mod;
		const requiredMethods = [
			'initialize',
			'getResponse',
			'setResponse',
			'disable',
			'enable',
			'destroy',
		] as const;
		const missingMethods = requiredMethods.filter(
			(method) => typeof candidate?.[method] !== 'function'
		);
		if (missingMethods.length > 0) {
			throw new Error(
				`PCI module at '${authoredPath}' does not export a valid PciModule interface; ` +
					`missing: ${missingMethods.join(', ')}`
			);
		}
		return candidate as PciModule;
	}
}
