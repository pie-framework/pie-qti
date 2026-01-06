/**
 * Browser-only iframe host helper.
 *
 * This intentionally depends on DOM globals and must be imported via the subpath:
 * - `@pie-qti/qti2-item-player/iframe`
 *
 * Do NOT export from the main entrypoint to keep SSR safe.
 */

import type { PlayerSecurityConfig, QTIRole } from '../types/index.js';
import {
	createEnvelope,
	parseQtiIframeMessage,
	type QtiIframeEnvelope,
	type QtiIframeInitPayload,
	type QtiIframeMessage,
	type QtiIframeMessageType,
	type QtiIframeProtocolVersion,
} from './protocol.js';

export interface IFramePlayerHostConfig {
	/**
	 * The URL to load inside the iframe (the integrator-hosted runtime page).
	 * For best isolation, host this on a separate origin.
	 */
	iframeUrl: string;

	/**
	 * Allowed runtime origins. Incoming messages from other origins are ignored.
	 *
	 * Examples:
	 * - `['https://player-runtime.example']`
	 * - `['http://localhost:5173']`
	 */
	allowedOrigins: string[];

	/**
	 * Either provide an existing iframe, or provide a container and the host will create one.
	 */
	iframe?: HTMLIFrameElement;
	container?: HTMLElement;

	/**
	 * Sandbox attribute value. If not provided, defaults to a safe baseline.
	 *
	 * Default: `allow-scripts` (no allow-same-origin).
	 */
	sandbox?: string;

	/**
	 * When true, automatically sets `iframe.style.height` on RESIZE messages.
	 * Default: true.
	 */
	autoResize?: boolean;

	/**
	 * Default: `no-referrer` to reduce leakage when loading assets.
	 */
	referrerPolicy?: HTMLIFrameElement['referrerPolicy'];

	/**
	 * Milliseconds to wait for READY before rejecting init/commands.
	 * Default: 10s.
	 */
	readyTimeoutMs?: number;
}

export type IFramePlayerHostEvent =
	| { type: 'ready'; payload: { origin: string; version: QtiIframeProtocolVersion } }
	| { type: 'resize'; payload: { height: number } }
	| { type: 'responseChange'; payload: { responses: Record<string, unknown> } }
	| { type: 'submitResult'; payload: { result: unknown } }
	| { type: 'error'; payload: { message: string; code?: string; details?: unknown } };

export class IFramePlayerHost {
	private readonly config: IFramePlayerHostConfig;
	private readonly iframe: HTMLIFrameElement;
	private readonly pendingReady: Promise<{ origin: string; version: QtiIframeProtocolVersion }>;
	private resolveReady!: (value: { origin: string; version: QtiIframeProtocolVersion }) => void;
	private rejectReady!: (reason?: unknown) => void;
	private lockedOrigin: string | null = null;
	private destroyed = false;
	private readonly listeners = new Set<(event: IFramePlayerHostEvent) => void>();
	private readonly onMessageBound = (event: MessageEvent) => this.onMessage(event);

	constructor(config: IFramePlayerHostConfig) {
		this.config = config;

		if (!config.iframe && !config.container) {
			throw new Error('IFramePlayerHost requires either `iframe` or `container`.');
		}
		if (config.allowedOrigins.length === 0) {
			throw new Error('IFramePlayerHost requires at least one allowed origin.');
		}

		this.iframe = config.iframe ?? document.createElement('iframe');
		if (!config.iframe) {
			config.container!.appendChild(this.iframe);
		}

		this.iframe.src = config.iframeUrl;
		this.iframe.sandbox.value = config.sandbox ?? 'allow-scripts';
		this.iframe.referrerPolicy = config.referrerPolicy ?? 'no-referrer';
		this.iframe.style.width = '100%';
		this.iframe.style.border = '0';

		this.pendingReady = new Promise((resolve, reject) => {
			this.resolveReady = resolve;
			this.rejectReady = reject;
		});

		window.addEventListener('message', this.onMessageBound);

		const timeoutMs = config.readyTimeoutMs ?? 10_000;
		window.setTimeout(() => {
			if (this.destroyed) return;
			if (this.lockedOrigin) return;
			this.rejectReady(new Error(`Timed out waiting for iframe READY after ${timeoutMs}ms`));
		}, timeoutMs);
	}

	/**
	 * Subscribe to host events.
	 * Returns an unsubscribe function.
	 */
	on(listener: (event: IFramePlayerHostEvent) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private emit(event: IFramePlayerHostEvent): void {
		for (const listener of this.listeners) listener(event);
	}

	getIFrameElement(): HTMLIFrameElement {
		return this.iframe;
	}

	/**
	 * Resolves once the runtime has sent READY and origin is locked.
	 */
	ready(): Promise<{ origin: string; version: QtiIframeProtocolVersion }> {
		return this.pendingReady;
	}

	async init(params: {
		itemXml: string;
		role?: QTIRole;
		seed?: number;
		security?: PlayerSecurityConfig;
		responses?: Record<string, unknown>;
		runtimeConfig?: Record<string, unknown>;
	}): Promise<void> {
		await this.ready();
		const payload: QtiIframeInitPayload = {
			itemXml: params.itemXml,
			role: params.role,
			seed: params.seed,
			security: params.security,
			responses: params.responses,
			runtimeConfig: params.runtimeConfig,
		};
		this.post('INIT', payload);
	}

	async setResponses(responses: Record<string, unknown>): Promise<void> {
		await this.ready();
		this.post('SET_RESPONSES', { responses });
	}

	async submit(): Promise<void> {
		await this.ready();
		this.post('SUBMIT', {});
	}

	async reset(): Promise<void> {
		await this.ready();
		this.post('RESET', {});
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		window.removeEventListener('message', this.onMessageBound);
		this.listeners.clear();
	}

	private post<TType extends QtiIframeMessageType, TPayload>(type: TType, payload: TPayload): void {
		const targetWindow = this.iframe.contentWindow;
		if (!targetWindow) return;

		const envelope = createEnvelope(type, payload);
		const origin = this.lockedOrigin ?? '*';
		targetWindow.postMessage(envelope satisfies QtiIframeEnvelope, origin);
	}

	private onMessage(event: MessageEvent): void {
		if (this.destroyed) return;
		if (!this.isAllowedOrigin(event.origin)) return;
		// Only accept messages from the intended iframe window.
		// This prevents other frames (even on an allowed origin) from spoofing protocol messages.
		if (!this.iframe.contentWindow || event.source !== this.iframe.contentWindow) return;

		const msg = parseQtiIframeMessage(event.data);
		if (!msg) return;

		// Lock the origin on first valid protocol message (ideally READY)
		if (!this.lockedOrigin) {
			this.lockedOrigin = event.origin;
		}
		if (event.origin !== this.lockedOrigin) return;

		this.handleMessage(msg, event.origin);
	}

	private isAllowedOrigin(origin: string): boolean {
		return this.config.allowedOrigins.includes(origin);
	}

	private handleMessage(msg: QtiIframeMessage, origin: string): void {
		switch (msg.type) {
			case 'READY': {
				this.resolveReady({ origin, version: msg.payload.version });
				this.emit({ type: 'ready', payload: { origin, version: msg.payload.version } });
				return;
			}
			case 'RESIZE': {
				const height = (msg.payload as any)?.height;
				if (typeof height === 'number' && Number.isFinite(height) && height >= 0) {
					if (this.config.autoResize ?? true) {
						this.iframe.style.height = `${height}px`;
					}
					this.emit({ type: 'resize', payload: { height } });
				}
				return;
			}
			case 'RESPONSE_CHANGE': {
				const responses = (msg.payload as any)?.responses;
				if (responses && typeof responses === 'object') {
					this.emit({ type: 'responseChange', payload: { responses } });
				}
				return;
			}
			case 'SUBMIT_RESULT': {
				this.emit({ type: 'submitResult', payload: { result: (msg.payload as any)?.result } });
				return;
			}
			case 'ERROR': {
				this.emit({
					type: 'error',
					payload: {
						message: (msg.payload as any)?.message ?? 'Unknown iframe runtime error',
						code: (msg.payload as any)?.code,
						details: (msg.payload as any)?.details,
					},
				});
				return;
			}
			default:
				return;
		}
	}
}


