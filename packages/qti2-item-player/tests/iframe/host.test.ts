import { describe, expect, it } from 'bun:test';

import { createEnvelope, QTI_IFRAME_PROTOCOL_VERSION } from '../../src/iframe/protocol.js';

type MessageListener = (event: any) => void;

class FakeWindow {
	private listeners = new Map<string, Set<MessageListener>>();
	setTimeout = globalThis.setTimeout.bind(globalThis);

	addEventListener(type: string, listener: MessageListener) {
		const set = this.listeners.get(type) ?? new Set<MessageListener>();
		set.add(listener);
		this.listeners.set(type, set);
	}

	removeEventListener(type: string, listener: MessageListener) {
		this.listeners.get(type)?.delete(listener);
	}

	dispatchMessage(event: any) {
		for (const listener of this.listeners.get('message') ?? []) listener(event);
	}
}

describe('IFramePlayerHost (minimal)', () => {
	it('ignores READY from wrong origin or wrong source', async () => {
		const realWindow = (globalThis as any).window;
		const realDocument = (globalThis as any).document;

		const fakeWindow = new FakeWindow();
		const fakeContentWindow = { postMessage() {} };

		const fakeIframe: any = {
			src: '',
			sandbox: { value: '' },
			referrerPolicy: '',
			style: {},
			contentWindow: fakeContentWindow,
		};

		const fakeDocumentObj: any = {
			createElement(tag: string) {
				if (tag !== 'iframe') throw new Error(`unexpected tag: ${tag}`);
				return fakeIframe;
			},
		};

		const fakeContainer: any = { appendChild() {} };

		(globalThis as any).window = fakeWindow;
		(globalThis as any).document = fakeDocumentObj;

		try {
			const mod = await import('../../src/iframe/IFramePlayerHost.js');
			const host = new mod.IFramePlayerHost({
				container: fakeContainer,
				iframeUrl: 'https://runtime.example/runtime',
				allowedOrigins: ['https://runtime.example'],
				readyTimeoutMs: 50,
			});

			// Wrong origin
			fakeWindow.dispatchMessage({
				origin: 'https://evil.example',
				source: fakeContentWindow,
				data: createEnvelope('READY', { version: QTI_IFRAME_PROTOCOL_VERSION }),
			});

			// Right origin, wrong source
			fakeWindow.dispatchMessage({
				origin: 'https://runtime.example',
				source: { postMessage() {} },
				data: createEnvelope('READY', { version: QTI_IFRAME_PROTOCOL_VERSION }),
			});

			let resolved = false;
			host.ready().then(() => (resolved = true)).catch(() => {});

			await new Promise((r) => setTimeout(r, 60));
			expect(resolved).toBe(false);

			host.destroy();
		} finally {
			(globalThis as any).window = realWindow;
			(globalThis as any).document = realDocument;
		}
	});

	it('resolves READY from allowed origin and correct source', async () => {
		const realWindow = (globalThis as any).window;
		const realDocument = (globalThis as any).document;

		const fakeWindow = new FakeWindow();
		const fakeContentWindow = { postMessage() {} };

		const fakeIframe: any = {
			src: '',
			sandbox: { value: '' },
			referrerPolicy: '',
			style: {},
			contentWindow: fakeContentWindow,
		};

		const fakeDocumentObj: any = {
			createElement(tag: string) {
				if (tag !== 'iframe') throw new Error(`unexpected tag: ${tag}`);
				return fakeIframe;
			},
		};

		const fakeContainer: any = { appendChild() {} };

		(globalThis as any).window = fakeWindow;
		(globalThis as any).document = fakeDocumentObj;

		try {
			const mod = await import('../../src/iframe/IFramePlayerHost.js');
			const host = new mod.IFramePlayerHost({
				container: fakeContainer,
				iframeUrl: 'https://runtime.example/runtime',
				allowedOrigins: ['https://runtime.example'],
				readyTimeoutMs: 100,
			});

			const readyPromise = host.ready();
			fakeWindow.dispatchMessage({
				origin: 'https://runtime.example',
				source: fakeContentWindow,
				data: createEnvelope('READY', { version: QTI_IFRAME_PROTOCOL_VERSION }),
			});

			const ready = await readyPromise;
			expect(ready.origin).toBe('https://runtime.example');
			expect(ready.version).toBe(QTI_IFRAME_PROTOCOL_VERSION);

			host.destroy();
		} finally {
			(globalThis as any).window = realWindow;
			(globalThis as any).document = realDocument;
		}
	});
});


