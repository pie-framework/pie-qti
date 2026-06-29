import type { ExtractedPci, PciBoundTo, PciModule } from './types.js';
import { PciLoadError } from './types.js';

/**
 * Loads, initializes, and manages the lifecycle of a single PCI module.
 *
 * Usage:
 *   const host = new PciHost(extractedData, baseUrl);
 *   await host.load();
 *   host.initialize(domNode);
 *   host.getResponse(); // returns current response
 *   host.destroy();     // cleanup on player teardown
 */
export class PciHost {
	private readonly data: ExtractedPci;
	private readonly baseUrl: string;
	private module: PciModule | null = null;
	private _response: unknown = null;
	private _onResponseChange: ((responseId: string, value: unknown) => void) | null = null;

	constructor(data: ExtractedPci, baseUrl: string) {
		this.data = data;
		this.baseUrl = baseUrl;
	}

	/**
	 * Register a callback to fire when the PCI's response changes.
	 * The player calls this to wire the PCI into its internal response map.
	 */
	public onResponseChange(callback: (responseId: string, value: unknown) => void): void {
		this._onResponseChange = callback;
	}

	/**
	 * Load the PCI module from primaryPath, falling back to fallbackPath.
	 * Throws PciLoadError if both fail.
	 */
	public async load(): Promise<void> {
		const primary = this.resolveUrl(this.data.primaryPath);
		try {
			const mod = await this.dynamicImport(primary);
			this.module = this.extractPciInterface(mod);
			return;
		} catch (primaryErr) {
			if (!this.data.fallbackPath) {
				throw new PciLoadError(this.data.primaryPath, undefined, primaryErr as Error);
			}
		}

		const fallback = this.resolveUrl(this.data.fallbackPath!);
		try {
			const mod = await this.dynamicImport(fallback);
			this.module = this.extractPciInterface(mod);
		} catch (fallbackErr) {
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
				this._onResponseChange?.(this.data.responseIdentifier, value);
			},
		};

		this.module.initialize(dom, this.data.config, boundTo);
	}

	/** Return the current response value from the PCI module. */
	public getResponse(): unknown {
		return this.module ? this.module.getResponse() : this._response;
	}

	/** Restore a response value into the PCI module (e.g. from session state). */
	public setResponse(value: unknown): void {
		this._response = value;
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
		this.module?.destroy();
		this.module = null;
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/** Thin wrapper around dynamic import — overridable in tests. */
	protected dynamicImport(url: string): Promise<any> {
		return import(/* @vite-ignore */ url);
	}

	private resolveUrl(path: string): string {
		if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
		// Relative path: resolve against baseUrl
		const base = this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/';
		return base + path;
	}

	/**
	 * Extract a PciModule from a dynamic import result.
	 * Supports: default export, named `getInstance` export, or the module itself.
	 */
	private extractPciInterface(mod: any): PciModule {
		const candidate = mod?.default ?? mod?.getInstance?.() ?? mod;
		if (typeof candidate?.initialize !== 'function') {
			throw new Error(
				`PCI module at '${this.data.primaryPath}' does not export a valid PciModule interface ` +
					'(expected .initialize, .getResponse, .setResponse, .disable, .enable, .destroy)'
			);
		}
		return candidate as PciModule;
	}
}
