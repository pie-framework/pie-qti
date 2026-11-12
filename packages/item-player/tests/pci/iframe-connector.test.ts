import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { parseHTML } from 'linkedom';
import { createIframeFrameConnector } from '../../src/pci/sandbox/iframeConnector.js';

/**
 * The connector filters incoming messages on this frame's window (the identity
 * anchor) plus the runner origin or its opaque `"null"` serialization. Browser
 * origin semantics themselves cannot be asserted here: jsdom/linkedom never
 * applies real sandbox origins, so the events below are synthetic. The real
 * handshake still needs a manual/e2e check in a browser.
 */

type Listener = (event: MessageEvent) => void;

const RUNNER_ORIGIN = 'https://runner.example';

let listeners: Listener[];
let originalWindow: unknown;
let originalDocument: unknown;
const globals = globalThis as { window?: unknown; document?: unknown };

interface FrameInternals {
	frame: HTMLIFrameElement;
}

/** A synthetic message event: the connector reads only `source`, `origin`, `data`. */
function messageEvent(init: { source?: unknown; origin?: string; data?: unknown }): MessageEvent {
	return {
		source: init.source ?? null,
		origin: init.origin ?? '',
		data: init.data,
	} as unknown as MessageEvent;
}

beforeEach(() => {
	listeners = [];
	originalWindow = globals.window;
	originalDocument = globals.document;
	const { document } = parseHTML('<!doctype html><html><body></body></html>');
	globals.document = document;
	globals.window = {
		addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
		removeEventListener: (_type: string, listener: Listener) => {
			listeners = listeners.filter((registered) => registered !== listener);
		},
	};
});

afterEach(() => {
	globals.window = originalWindow;
	globals.document = originalDocument;
});

/** A connection whose sandboxed frame reports `frameWindow` as its contentWindow. */
function connected(frameWindow: object) {
	const connection = createIframeFrameConnector()(RUNNER_ORIGIN + '/pci-runner.html', 'frame');
	const internals = connection as unknown as FrameInternals;
	Object.defineProperty(internals.frame, 'contentWindow', {
		value: frameWindow,
		configurable: true,
	});
	return connection;
}

function dispatch(event: MessageEvent): void {
	for (const listener of [...listeners]) listener(event);
}

describe('IframeFrameConnection message filtering', () => {
	test('accepts a message from this frame with the opaque-origin serialization', () => {
		const frameWindow = {};
		const received: unknown[] = [];
		const connection = connected(frameWindow);
		connection.onMessage((data) => received.push(data));

		dispatch(messageEvent({ source: frameWindow, origin: 'null', data: { type: 'runner-ready' } }));

		expect(received).toEqual([{ type: 'runner-ready' }]);
		connection.dispose();
	});

	test('accepts a message from this frame carrying the runner tuple origin', () => {
		const frameWindow = {};
		const received: unknown[] = [];
		const connection = connected(frameWindow);
		connection.onMessage((data) => received.push(data));

		dispatch(messageEvent({ source: frameWindow, origin: RUNNER_ORIGIN, data: 'tuple' }));

		expect(received).toEqual(['tuple']);
		connection.dispose();
	});

	test('rejects a foreign window regardless of origin', () => {
		const received: unknown[] = [];
		const connection = connected({});
		connection.onMessage((data) => received.push(data));

		dispatch(messageEvent({ source: {}, origin: RUNNER_ORIGIN, data: 'foreign-tuple' }));
		dispatch(messageEvent({ source: {}, origin: 'null', data: 'foreign-opaque' }));

		expect(received).toEqual([]);
		connection.dispose();
	});

	test('rejects our window when the origin matches neither the runner nor the opaque form', () => {
		const frameWindow = {};
		const received: unknown[] = [];
		const connection = connected(frameWindow);
		connection.onMessage((data) => received.push(data));

		dispatch(messageEvent({ source: frameWindow, origin: 'https://attacker.example', data: 'spoofed' }));

		expect(received).toEqual([]);
		connection.dispose();
	});

	test('stops delivering after dispose', () => {
		const frameWindow = {};
		const received: unknown[] = [];
		const connection = connected(frameWindow);
		connection.onMessage((data) => received.push(data));
		connection.dispose();

		dispatch(messageEvent({ source: frameWindow, origin: 'null', data: 'late' }));

		expect(received).toEqual([]);
		expect(listeners).toEqual([]);
	});
});

describe('IframeFrameConnection outbound posts', () => {
	test('posts to this frame window with a wildcard target origin', () => {
		const posted: Array<{ message: unknown; targetOrigin: string }> = [];
		const frameWindow = {
			postMessage(message: unknown, targetOrigin: string) {
				posted.push({ message, targetOrigin });
			},
		};
		const connection = connected(frameWindow);

		connection.post({ type: 'hello' });

		expect(posted).toEqual([{ message: { type: 'hello' }, targetOrigin: '*' }]);
		connection.dispose();
	});
});
