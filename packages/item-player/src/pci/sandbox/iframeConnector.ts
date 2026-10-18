import type { PciFrameConnection, PciFrameConnector } from '../types.js';

/**
 * The production `PciFrameConnector`: one `<iframe sandbox="allow-scripts">`
 * per PCI, loaded from the runner origin. Without `allow-same-origin` the
 * frame's document has an opaque origin — it shares no storage, cookies, or
 * DOM with the player — while its base URL stays the runner URL, so authored
 * relative asset paths still resolve inside it.
 *
 * Incoming messages are accepted only when `event.origin` is the runner origin
 * and `event.source` is this frame's `contentWindow`; outgoing messages are
 * posted locked to the runner origin.
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
			if (event.source !== this.frame.contentWindow) return;
			if (event.origin !== this.frameOrigin) return;
			for (const handler of this.handlers) handler(event.data);
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('message', this.windowListener);
		}
	}

	/** {@inheritdoc PciFrameConnection.post} */
	public post(message: unknown): void {
		this.frame.contentWindow?.postMessage(message, this.frameOrigin);
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
