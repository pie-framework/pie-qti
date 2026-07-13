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
	private readonly _responseChangeListeners = new Set<
		(responseId: string, value: unknown) => void
	>();

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

	/** Restore a response value into the PCI module (e.g. from session state). */
	public setResponse(value: unknown): void {
		this._response = value;
		this._hasResponse = true;
		this.module?.setResponse(value);
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
