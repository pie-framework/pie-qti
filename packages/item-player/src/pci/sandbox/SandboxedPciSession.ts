import type { PciLoadContext, PciModuleSession } from '../moduleSession.js';
import type {
	ExtractedPci,
	PciFrameConnector,
	PciModulePolicy,
	PciSandboxConfiguration,
	QtiPciConfiguration,
	QtiPciInstance,
} from '../types.js';
import { PciLoadError } from '../types.js';
import { htmlToString, sanitizeSharedHtml } from '../../security/index.js';
import { createIframeFrameConnector } from './iframeConnector.js';
import {
	createSandboxEnvelope,
	isPciSandboxEnvelope,
	type PciSandboxInitPayload,
	type PciSandboxInstantiatePayload,
	type PciSandboxModuleEntryPayload,
} from './protocol.js';

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;
const DEFAULT_POLL_INTERVAL_MS = 250;
const DEFAULT_REGISTRATION_TIMEOUT_MS = 5000;

export interface SandboxedSessionOptions {
	sandbox: PciSandboxConfiguration;
	data: ExtractedPci;
	baseUrl: string;
	/** Policy gate applied to module URLs before anything is handed to the frame. */
	modulePolicy?: PciModulePolicy;
	/** The page origin the runner locks to; injectable for tests. */
	parentOrigin?: () => string;
	/** Frame connection factory; defaults to a real sandboxed iframe. */
	frameConnector?: PciFrameConnector;
}

type RemoteReportHandler = (report: { state?: unknown }) => void;
type ErrorHandler = (error: Error) => void;

/**
 * The sandboxed engine: the module runs in a cross-origin runner frame
 * (`@pie-qti/pci-runner` deployed on a cookieless origin) and every contract
 * call crosses the postMessage bridge.
 *
 * Nothing here evaluates module code. Module URLs are resolved against the
 * package base, checked against the optional policy, and handed to the runner,
 * which loads them in its own opaque-origin document. `getResponse()` stays
 * synchronous for `PciHost` by answering from a cache the runner maintains:
 * pushes on every observed change, plus a bounded poll as the freshness floor.
 */
export class SandboxedPciSession implements PciModuleSession {
	private readonly runnerUrl: string;
	private readonly handshakeTimeoutMs: number;
	private readonly pollIntervalMs: number;
	private readonly registrationTimeoutMs: number;
	private readonly data: ExtractedPci;
	private readonly baseUrl: string;
	private readonly modulePolicy: PciModulePolicy | undefined;
	private readonly parentOrigin: () => string;
	private readonly connector: PciFrameConnector;

	private connection: ReturnType<PciFrameConnector> | null = null;
	private pendingInit: PciSandboxInitPayload | null = null;
	private handshook = false;
	private moduleReady = false;
	private handshakeTimer: ReturnType<typeof setTimeout> | undefined;
	private queuedInstantiate: PciSandboxInstantiatePayload | null = null;
	private currentConfiguration: QtiPciConfiguration | null = null;
	/** The proxy `PciHost`'s state machine talks to; reads answer from the cache. */
	private proxy: (QtiPciInstance & { disable?(): void; enable?(): void }) | null = null;
	private readonly cache: { response: unknown; state: unknown } = { response: null, state: undefined };
	private readonly reportHandlers = new Set<RemoteReportHandler>();
	private readonly errorHandlers = new Set<ErrorHandler>();
	private stopMessages: (() => void) | null = null;
	private disposed = false;

	constructor(options: SandboxedSessionOptions) {
		this.runnerUrl = options.sandbox.runnerUrl;
		this.handshakeTimeoutMs = options.sandbox.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
		this.pollIntervalMs = options.sandbox.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
		this.registrationTimeoutMs =
			options.sandbox.registrationTimeoutMs ?? DEFAULT_REGISTRATION_TIMEOUT_MS;
		this.data = options.data;
		this.baseUrl = options.baseUrl;
		this.modulePolicy = options.modulePolicy;
		this.parentOrigin = options.parentOrigin ?? defaultParentOrigin;
		this.connector = options.frameConnector ?? createIframeFrameConnector();

		// Config errors surface at construction, before any frame exists.
		let runnerOrigin: URL;
		try {
			runnerOrigin = new URL(this.runnerUrl);
		} catch {
			throw new Error(`PCI sandbox runnerUrl must be an absolute URL: '${this.runnerUrl}'`);
		}
		if (runnerOrigin.protocol !== 'https:' && runnerOrigin.protocol !== 'http:') {
			throw new Error(`PCI sandbox runnerUrl must be http(s): '${this.runnerUrl}'`);
		}
	}

	/** {@inheritdoc PciModuleSession.load} */
	public async load(_context: PciLoadContext): Promise<void> {
		if (this.disposed) throw new Error('Cannot load a destroyed PciHost');
		// Preparing the init payload resolves every authored path and runs the
		// policy gate before a frame exists; the module itself loads in the frame,
		// and its failures surface through onError.
		this.pendingInit = this.buildInitPayload();
	}

	/** {@inheritdoc PciModuleSession.instantiate} */
	public instantiate(
		dom: HTMLElement,
		configuration: QtiPciConfiguration,
		state: unknown
	): QtiPciInstance | undefined {
		if (this.disposed || !this.pendingInit) return undefined;
		this.currentConfiguration = configuration;

		if (!this.connection || !this.connection.isAttached()) {
			// First mount, or the renderer's scaffold reset removed the frame.
			this.resetConnection();
			this.connection = this.connector(this.runnerUrl, frameTitle(this.data));
			this.stopMessages = this.connection.onMessage((data) => this.handleMessage(data));
			dom.replaceChildren();
			this.connection.appendTo(dom);
			this.armHandshakeTimeout();
		}

		// A fresh read of the seeded state keeps the proxy honest before the
		// instance's first report arrives.
		this.cache.response = null;
		this.cache.state = undefined;
		this.proxy = {
			getResponse: () => this.cache.response,
			getState: () => this.cache.state,
			disable: () => this.post('set-enabled', { enabled: false }),
			enable: () => this.post('set-enabled', { enabled: true }),
		};

		const payload: PciSandboxInstantiatePayload = {
			responseIdentifier: configuration.responseIdentifier,
			status: configuration.status,
			properties: configuration.properties,
			...(configuration.templateVariables !== undefined
				? { templateVariables: configuration.templateVariables }
				: {}),
			...(configuration.contextVariables !== undefined
				? { contextVariables: configuration.contextVariables }
				: {}),
			...(state !== undefined ? { state } : {}),
		};
		if (this.moduleReady) {
			// Runner messages are handled in arrival order, so an in-frame instance
			// from a previous instantiation is torn down before this one is created.
			this.post('teardown-instance', {});
			this.post('instantiate', payload);
		} else {
			this.queuedInstantiate = payload;
		}
		return this.proxy;
	}

	/** {@inheritdoc PciModuleSession.destroyInstance} */
	public destroyInstance(_instance: QtiPciInstance): void {
		if (this.connection && this.moduleReady) {
			this.post('teardown-instance', {});
		}
		this.cache.response = null;
		this.cache.state = undefined;
		this.proxy = null;
	}

	/** {@inheritdoc PciModuleSession.dispose} */
	public dispose(): void {
		if (this.connection) {
			this.post('dispose', {});
		}
		this.resetConnection();
		this.disposed = true;
		this.pendingInit = null;
		this.currentConfiguration = null;
		this.queuedInstantiate = null;
	}

	/** {@inheritdoc PciModuleSession.onRemoteReport} */
	public onRemoteReport(handler: RemoteReportHandler): () => void {
		this.reportHandlers.add(handler);
		return () => this.reportHandlers.delete(handler);
	}

	/** {@inheritdoc PciModuleSession.onError} */
	public onError(handler: ErrorHandler): () => void {
		this.errorHandlers.add(handler);
		return () => this.errorHandlers.delete(handler);
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private buildInitPayload(): PciSandboxInitPayload {
		const entries: PciSandboxModuleEntryPayload[] = this.data.modules
			.filter((module) => module.primaryPath)
			.map((module) => {
				const primaryUrl = this.resolveChecked(module.primaryPath, 'primary');
				return {
					id: module.id || module.primaryPath,
					primaryUrl,
					...(module.fallbackPath
						? { fallbackUrl: this.resolveChecked(module.fallbackPath, 'fallback') }
						: {}),
				};
			});
		const entry =
			this.data.modules.find((module) => module.primaryPath === this.data.primaryPath) ??
			this.data.modules[this.data.modules.length - 1];
		const markup = this.data.markup;
		return {
			typeIdentifier: this.data.customInteractionTypeIdentifier,
			modules: entries,
			entryId: entry?.id || this.data.primaryPath,
			...(this.data.resolutionConfigPath
				? { resolutionConfigUrl: this.resolveUrl(this.data.resolutionConfigPath) }
				: {}),
			baseUrl: this.baseUrl,
			// The frame renders this as its interaction markup; the same sanitizer
			// the page-realm scaffold uses runs before it crosses the bridge.
			markup: htmlToString(sanitizeSharedHtml(htmlToString(markup))),
			registrationTimeoutMs: this.registrationTimeoutMs,
			pollIntervalMs: this.pollIntervalMs,
		};
	}

	/** Resolve one authored path and run the policy gate on the absolute URL. */
	private resolveChecked(path: string, kind: 'primary' | 'fallback'): string {
		const resolved = this.resolveUrl(path);
		if (this.modulePolicy) {
			this.modulePolicy(resolved, {
				authoredPath: path,
				kind,
				responseIdentifier: this.data.responseIdentifier,
				customInteractionTypeIdentifier: this.data.customInteractionTypeIdentifier,
			});
		}
		return resolved;
	}

	private resolveUrl(path: string): string {
		if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || path.startsWith('/')) {
			return path;
		}
		if (!this.baseUrl) return path;
		const base = this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/';
		try {
			return new URL(path, base).href;
		} catch {
			return base + path;
		}
	}

	private post(type: Parameters<typeof createSandboxEnvelope>[0], payload: unknown): void {
		if (!this.connection) return;
		this.connection.post(createSandboxEnvelope(type, payload));
	}

	private resetConnection(): void {
		if (this.handshakeTimer !== undefined) {
			clearTimeout(this.handshakeTimer);
			this.handshakeTimer = undefined;
		}
		this.stopMessages?.();
		this.stopMessages = null;
		this.connection?.dispose();
		this.connection = null;
		this.handshook = false;
		this.moduleReady = false;
	}

	private armHandshakeTimeout(): void {
		if (this.handshakeTimer !== undefined) clearTimeout(this.handshakeTimer);
		this.handshakeTimer = setTimeout(() => {
			this.handshakeTimer = undefined;
			if (this.disposed || this.moduleReady) return;
			// A frame that never became ready (or a module that never loaded) is
			// reported but not torn down: a late load still recovers the interaction.
			// Not a PciLoadError — no authored path was attempted yet.
			this.emitError(
				new Error(`PCI runner frame did not become ready within ${this.handshakeTimeoutMs}ms`)
			);
		}, this.handshakeTimeoutMs);
	}

	private emitError(error: Error): void {
		for (const handler of this.errorHandlers) handler(error);
	}

	private handleMessage(data: unknown): void {
		if (!isPciSandboxEnvelope(data)) return;
		switch (data.type) {
			case 'runner-ready': {
				if (this.handshook) return;
				this.handshook = true;
				// Sent in order: the runner locks on `hello` before `init` arrives.
				this.post('hello', { parentOrigin: this.parentOrigin() });
				if (this.pendingInit) this.post('init', this.pendingInit);
				return;
			}
			case 'module-loaded': {
				this.moduleReady = true;
				if (this.handshakeTimer !== undefined) {
					clearTimeout(this.handshakeTimer);
					this.handshakeTimer = undefined;
				}
				if (this.queuedInstantiate) {
					this.post('instantiate', this.queuedInstantiate);
					this.queuedInstantiate = null;
				}
				return;
			}
			case 'module-error': {
				const message =
					typeof (data.payload as { message?: unknown })?.message === 'string'
						? (data.payload as { message: string }).message
						: 'unknown error';
				this.emitError(
					new PciLoadError(
						this.data.primaryPath,
						this.data.fallbackPath,
						new Error(message)
					)
				);
				return;
			}
			case 'instance-ready': {
				this.applySnapshot(data.payload);
				return;
			}
			case 'ready': {
				this.applySnapshot(data.payload);
				if (this.proxy) {
					this.currentConfiguration?.onready(this.proxy, (data.payload as { state?: unknown }).state);
				}
				return;
			}
			case 'done': {
				this.applySnapshot(data.payload);
				if (this.proxy) {
					this.currentConfiguration?.ondone(this.proxy, (data.payload as { state?: unknown }).state);
				}
				return;
			}
			case 'response-change': {
				this.applySnapshot(data.payload);
				const state = (data.payload as { state?: unknown }).state;
				for (const handler of this.reportHandlers) handler({ state });
				return;
			}
			case 'instance-error': {
				const message =
					typeof (data.payload as { message?: unknown })?.message === 'string'
						? (data.payload as { message: string }).message
						: 'unknown error';
				this.emitError(new Error(`PCI runner failed to instantiate: ${message}`));
				return;
			}
			case 'resize': {
				const height = (data.payload as { height?: unknown })?.height;
				if (typeof height === 'number') this.connection?.setHeight(height);
				return;
			}
			default:
				return;
		}
	}

	/** Take a bridge snapshot into the cache the proxy reads from. */
	private applySnapshot(payload: unknown): void {
		if (typeof payload !== 'object' || payload === null) return;
		const snapshot = payload as { response?: unknown; state?: unknown };
		if ('response' in snapshot) this.cache.response = snapshot.response ?? null;
		if ('state' in snapshot && snapshot.state !== undefined) this.cache.state = snapshot.state;
	}
}

function defaultParentOrigin(): string {
	return globalThis.location?.origin ?? '';
}

/** The frame's accessible name: the PCI type's tail, locale-neutral by nature. */
function frameTitle(data: ExtractedPci): string {
	const typeIdentifier = data.customInteractionTypeIdentifier;
	const tail = typeIdentifier.split(/[/:#]/).pop();
	return tail && tail.length > 0 ? `Interactive content: ${tail}` : 'Interactive content';
}
