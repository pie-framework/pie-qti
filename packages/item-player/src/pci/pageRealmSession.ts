import type { PciLoadContext, PciModuleSession } from './moduleSession.js';
import type {
	ExtractedPci,
	PciModulePathKind,
	PciModuleResolver,
	PciRegistryObservation,
	QtiCustomInteractionRegistration,
	QtiPciConfiguration,
	QtiPciInstance,
} from './types.js';
import { PciLoadError, PciModuleResolverRequiredError } from './types.js';
import { getSharedPciRegistry } from './registry.js';
import {
	DEFAULT_RESOLUTION_CONFIG_PATHS,
	emptyResolutionConfig,
	parseModuleResolutionConfig,
	type PciResolutionConfig,
} from './resolutionConfig.js';
import { createAmdLoader } from './amdLoader.js';

const DEFAULT_REGISTRATION_TIMEOUT_MS = 5000;

export interface PageRealmSessionOptions {
	data: ExtractedPci;
	baseUrl: string;
	/**
	 * Undefined is allowed at construction so an unconfigured host can be built
	 * and report the secure-default error at load time, as it always has.
	 */
	moduleResolver?: PciModuleResolver;
	registry?: PciRegistryObservation;
	registrationTimeoutMs?: number;
}

/**
 * The page-realm engine: the host resolver evaluates the module in the page,
 * the registry global observes its registration, and instantiation is a direct
 * `getInstance` call. This is the behavior `PciHost` carried before the
 * sandboxed engine existed, extracted behind the session seam unchanged.
 */
export class PageRealmPciSession implements PciModuleSession {
	private readonly data: ExtractedPci;
	private readonly baseUrl: string;
	private readonly moduleResolver: PciModuleResolver | undefined;
	private readonly registry: PciRegistryObservation;
	private readonly registrationTimeoutMs: number;
	private registration: QtiCustomInteractionRegistration | null = null;

	constructor(options: PageRealmSessionOptions) {
		this.data = options.data;
		this.baseUrl = options.baseUrl;
		this.moduleResolver = options.moduleResolver;
		this.registry = options.registry ?? getSharedPciRegistry();
		this.registrationTimeoutMs = options.registrationTimeoutMs ?? DEFAULT_REGISTRATION_TIMEOUT_MS;
	}

	/** {@inheritdoc PciModuleSession.load} */
	public async load(context: PciLoadContext): Promise<void> {
		if (!this.moduleResolver) {
			throw new PciModuleResolverRequiredError(
				this.data.responseIdentifier,
				this.data.primaryPath
			);
		}
		const useAmd = this.data.modules.length > 1 || this.data.resolutionConfigPath !== undefined;
		if (useAmd) {
			await this.loadViaAmd(context);
			return;
		}

		const primary = this.resolveUrl(this.data.primaryPath);
		try {
			await this.evaluateModule(primary, this.data.primaryPath, 'primary');
			this.adoptRegistration(await this.awaitRegistration(), context);
			return;
		} catch (primaryErr) {
			if (!context.isCurrent()) throw primaryErr;
			if (!this.data.fallbackPath) {
				throw new PciLoadError(this.data.primaryPath, undefined, primaryErr as Error);
			}
		}

		const fallback = this.resolveUrl(this.data.fallbackPath!);
		try {
			await this.evaluateModule(fallback, this.data.fallbackPath!, 'fallback');
			this.adoptRegistration(await this.awaitRegistration(), context);
		} catch (fallbackErr) {
			if (!context.isCurrent()) throw fallbackErr;
			throw new PciLoadError(
				this.data.primaryPath,
				this.data.fallbackPath,
				fallbackErr as Error
			);
		}
	}

	/** {@inheritdoc PciModuleSession.instantiate} */
	public instantiate(
		dom: HTMLElement,
		configuration: QtiPciConfiguration,
		state: unknown
	): QtiPciInstance | undefined {
		if (!this.registration) return undefined;
		return this.registration.getInstance(dom, configuration, state);
	}

	/** {@inheritdoc PciModuleSession.destroyInstance} */
	public destroyInstance(instance: QtiPciInstance): void {
		(instance as { destroy?: () => void } | null)?.destroy?.();
	}

	/** {@inheritdoc PciModuleSession.dispose} */
	public dispose(): void {
		this.registration = null;
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

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
		const resolver = this.moduleResolver;
		if (!resolver) {
			// Unreachable through load(), which gates on the resolver first.
			throw new PciModuleResolverRequiredError(this.data.responseIdentifier, authoredPath);
		}
		return Promise.resolve(
			resolver(resolvedUrl, {
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
	private async loadViaAmd(context: PciLoadContext): Promise<void> {
		const entry =
			this.data.modules.find((module) => module.primaryPath === this.data.primaryPath) ??
			this.data.modules[this.data.modules.length - 1];
		const entryId = entry?.id || this.data.primaryPath;
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
				// On the fallback attempt the entry id rebinds to the fallback path.
				loader.addPaths(
					Object.fromEntries(
						this.data.modules
							.filter((module) => module.primaryPath)
							.map((module) => [module.id || module.primaryPath, module.primaryPath])
					)
				);
				loader.addPaths({ [entryId]: entryPath });
				await loader.load([entryId]);
				this.adoptRegistration(await this.awaitRegistration(), context);
			} finally {
				loader.dispose();
			}
		};

		try {
			await attempt(this.data.primaryPath, 'primary');
		} catch (primaryErr) {
			if (!context.isCurrent()) throw primaryErr;
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
				if (!context.isCurrent()) throw fallbackErr;
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

	private adoptRegistration(
		registration: QtiCustomInteractionRegistration,
		context: PciLoadContext
	): void {
		if (!registration || typeof registration.getInstance !== 'function') {
			throw new Error(
				`PCI registration for '${this.data.customInteractionTypeIdentifier}' is not a valid spec registration`
			);
		}
		if (!context.isCurrent()) {
			throw new Error('PciHost was destroyed before its module finished loading');
		}
		this.registration = registration;
	}
}
