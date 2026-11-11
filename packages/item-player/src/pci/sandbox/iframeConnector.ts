import type { PciFrameConnection, PciFrameConnector } from '../types.js';

/**
 * How a sandboxed frame's opaque origin serializes in `event.origin`. Without
 * `allow-same-origin` the frame's document has no tuple origin at all, so it
 * never equals the runner origin this connector is built from.
 */
const OPAQUE_ORIGIN = 'null';

/**
 * The production `PciFrameConnector`: one `<iframe sandbox="allow-scripts">`
 * per PCI, loaded from the runner origin. Without `allow-same-origin` the
 * frame's document has an opaque origin — it shares no storage, cookies, or
 * DOM with the player — while its base URL stays the runner URL, so authored
 * relative asset paths still resolve inside it. An opaque origin serializes as
 * the string `"null"` and never compares equal to a tuple origin.
 *
 * Incoming messages are accepted only when `event.source` is this frame's
 * `contentWindow` — the identity anchor, because a sender cannot forge a
 * source window — and `event.origin` is the runner origin or the opaque
 * `"null"` serialization. This frame is always `allow-scripts`-only, so every
 * message it sends carries `"null"`; filtering both spellings keeps the origin
 * check meaningful (a foreign origin is still rejected) without dropping the
 * only origin this frame can ever produce.
 *
 * Outgoing messages are posted to this frame's `contentWindow` with target
 * origin `'*'`. A tuple target origin can never match the frame's opaque
 * origin, so a locked target would silently drop every message and the
 * handshake could never complete. The recipient is bounded by the target
 * window: only this frame receives it, and a scripts-only sandboxed frame has
 * no access to parent state. The runner answers through the same window it was
 * reached by, and the `hello` handshake carries the parent origin so the frame
 * can verify where it talks to.
 */
export function createIframeFrameConnector(): PciFrameConnector {
	return (frameUrl: string, title: string) => new IframeFrameConnection(frameUrl, title);
}

class IframeFrameConnection implements PciFrameConnection {
	public readonly frameOrigin: string;

	/** The identity incoming events are filtered against: this frame's window. */
	public get source(): unknown {
		return this.frame.contentWindow;
	}

	private readonly frame: HTMLIFrameElement;
	private readonly handlers = new Set<(data: unknown) => void>();
	private readonly windowListener: (event: MessageEvent) => void;
	private disposed = false;

	constructor(frameUrl: string, title: string) {
		let url: URL;
		try {
			url = new URL(frameUrl);
		} catch {
			throw new Error(`PCI sandbox runnerUrl must be an absolute URL: '${frameUrl}'`);
		}
		if (url.protocol !== 'https:' && url.protocol !== 'http:') {
			throw new Error(`PCI sandbox runnerUrl must be http(s): '${frameUrl}'`);
		}
		this.frameOrigin = url.origin;

		const frame = document.createElement('iframe');
		// `allow-scripts` alone: a frame carrying it together with `allow-same-origin`
		// could strip its own sandbox attribute.
		frame.setAttribute('sandbox', 'allow-scripts');
		frame.src = frameUrl;
		frame.title = title;
		frame.style.width = '100%';
		frame.style.border = '0';
		frame.style.display = 'block';
		// The runner reports the interaction's height; until then the frame stays
		// out of the layout's way.
		frame.style.height = '0px';
		this.frame = frame;

		this.windowListener = (event: MessageEvent) => {
			if (this.disposed) return;
			// Identity anchor: only this frame's window may be the source — a sender
			// cannot forge it. The origin comparison is the secondary check: this
			// frame's opaque origin serializes as "null" and never equals the runner
			// tuple origin, so a frame message legitimately arrives under either
			// spelling while a foreign origin still matches neither.
			if (event.source !== this.frame.contentWindow) return;
			if (event.origin !== this.frameOrigin && event.origin !== OPAQUE_ORIGIN) return;
			for (const handler of this.handlers) handler(event.data);
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('message', this.windowListener);
		}
	}

	/** {@inheritdoc PciFrameConnection.post} */
	public post(message: unknown): void {
		// Target origin '*': the frame's origin is opaque, so no tuple target can
		// ever match it and a locked target would drop every message. The recipient
		// is bounded by posting to this frame's contentWindow only, and identity in
		// the reply direction is anchored on `event.source`, not the target origin.
		this.frame.contentWindow?.postMessage(message, '*');
	}

	/** {@inheritdoc PciFrameConnection.appendTo} */
	public appendTo(target: HTMLElement): void {
		target.appendChild(this.frame);
	}

	/** {@inheritdoc PciFrameConnection.isAttached} */
	public isAttached(): boolean {
		return this.frame.isConnected;
	}

	/** {@inheritdoc PciFrameConnection.setHeight} */
	public setHeight(height: number): void {
		if (Number.isFinite(height) && height >= 0) {
			this.frame.style.height = `${Math.ceil(height)}px`;
		}
	}

	/** {@inheritdoc PciFrameConnection.onMessage} */
	public onMessage(handler: (data: unknown) => void): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	/** {@inheritdoc PciFrameConnection.dispose} */
	public dispose(): void {
		this.disposed = true;
		this.handlers.clear();
		if (typeof window !== 'undefined') {
			window.removeEventListener('message', this.windowListener);
		}
		this.frame.remove();
	}
}
