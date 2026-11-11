/**
 * The PCI runner bridge controller, driven over an in-memory transport with
 * fixture modules evaluated through `new Function` — the same clean-room
 * approach as the item-player conformance suite, but from the runner side:
 * origin locking, module loading, instantiation, lifecycle bridging, polling,
 * and teardown.
 */

import { describe, expect, test } from 'bun:test';
import {
	PCI_SANDBOX_PROTOCOL_VERSION,
	createSandboxEnvelope,
} from '@pie-qti/item-player/pci';
import {
	createPciRunnerController,
	type PciRunnerFrameDocument,
	type PciRunnerTransport,
} from '../src/runnerController.js';

const PARENT_ORIGIN = 'https://app.example';
const ENTRY_URL = 'https://packages.example.com/pci/echo.js';

type InboxEvent = { origin: string; data: unknown; isParentSource: boolean };
type OutboxEntry = { targetOrigin: string; message: Record<string, unknown> };

interface FakeElement {
	children: FakeElement[];
	markup: string;
	parent: FakeElement | null;
	appendChild(child: FakeElement): FakeElement;
	replaceChildren(...nodes: FakeElement[]): void;
	remove(): void;
}

function fakeElement(): FakeElement {
	const element: FakeElement = {
		children: [],
		markup: '',
		parent: null,
		appendChild(child) {
			child.parent = element;
			element.children.push(child);
			return child;
		},
		replaceChildren(...nodes) {
			for (const child of element.children) child.parent = null;
			element.children = nodes;
		},
		remove() {
			const parent = element.parent;
			if (!parent) return;
			const index = parent.children.indexOf(element);
			if (index >= 0) parent.children.splice(index, 1);
			element.parent = null;
		},
	};
	// The controller writes `innerHTML` on containers; record it through `markup`.
	Object.defineProperty(element, 'innerHTML', {
		get: () => element.markup,
		set: (value: string) => {
			element.markup = value;
		},
	});
	return element;
}

const echoModule = (typeIdentifier: string, callsOnready = true) => `
	var ctx = qtiCustomInteractionContext;
	ctx.register({
		typeIdentifier: '${typeIdentifier}',
		getInstance: function (dom, configuration, state) {
			dom.innerHTML = '<div class="echo"></div>';
			var response = (state && state.base && state.base.string) || null;
			var instance = {
				getResponse: function () { return response === null ? null : { base: { string: response } }; },
				getState: function () { return { response: response }; },
				setResponse: function (value) { response = value; },
			};
			globalThis.__echoInstance = instance;
			globalThis.__echoConfiguration = configuration;
			${callsOnready ? 'configuration.onready(instance, { seeded: true });' : ''}
			return instance;
		},
	});
`;

let typeCounter = 0;
const nextType = () => `urn:test:runner-echo-${++typeCounter}`;

function createHarness(
	buildFiles: (type: string) => Record<string, string>,
	options: { frameDocument?: PciRunnerFrameDocument } = {},
) {
	// A unique type per harness: the registry global persists for the process,
	// so a reused identifier would leak registrations across tests.
	const type = nextType();
	const files = buildFiles(type);
	const outbox: OutboxEntry[] = [];
	const listeners = new Set<(event: InboxEvent) => void>();
	const transport: PciRunnerTransport = {
		postToParent(message, targetOrigin) {
			outbox.push({ targetOrigin, message: message as Record<string, unknown> });
		},
		onMessage(handler) {
			listeners.add(handler);
			return () => listeners.delete(handler);
		},
	};
	const containers: FakeElement[] = [];
	const mount = fakeElement();
	const controller = createPciRunnerController({
		transport,
		frameDocument: options.frameDocument,
		mount: mount as unknown as HTMLElement,
		createContainer: () => {
			const element = fakeElement();
			containers.push(element);
			return element as unknown as HTMLElement;
		},
		fetchText: async (url) => {
			const text = files[url];
			if (text === undefined) throw new Error(`no such file: ${url}`);
			return text;
		},
		evaluateScript: async (url) => {
			const source = files[url];
			if (source === undefined) throw new Error(`failed to load PCI module '${url}'`);
			new Function(source)();
		},
	});
	const deliver = (data: unknown, origin = PARENT_ORIGIN, isParentSource = true) => {
		for (const listener of [...listeners]) listener({ origin, data, isParentSource });
	};
	const initPayload = (overrides: Partial<Record<string, unknown>> = {}) => ({
		typeIdentifier: type,
		modules: [{ id: type, primaryUrl: ENTRY_URL }],
		entryId: type,
		baseUrl: 'https://packages.example.com/',
		markup: '<div class="scaffold"></div>',
		registrationTimeoutMs: 500,
		pollIntervalMs: 50,
		...overrides,
	});
	const hello = () => deliver(createSandboxEnvelope('hello', { parentOrigin: PARENT_ORIGIN }));
	const init = (overrides?: Partial<Record<string, unknown>>) =>
		deliver(createSandboxEnvelope('init', initPayload(overrides)));
	const instantiate = (overrides: Record<string, unknown> = {}) =>
		deliver(
			createSandboxEnvelope('instantiate', {
				responseIdentifier: 'RESPONSE',
				status: 'interacting',
				properties: {},
				...overrides,
			})
		);
	const messages = (msgType: string) => outbox.filter((entry) => entry.message.type === msgType);
	const last = (msgType: string) => messages(msgType).at(-1);
	controller.start();
	return { controller, type, files, outbox, deliver, mount, containers, messages, last, hello, init, instantiate, initPayload };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Poll until a condition holds, with a deadline — the convention used by the
// assessment-player autosave suite — instead of racing async work against a
// fixed sleep. Fixed sleeps remain only where a test asserts absence over a
// window.
async function until(check: () => boolean, timeout = 2000): Promise<void> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error(`condition not met within ${timeout}ms`);
}

type Harness = ReturnType<typeof createHarness>;

const waitForMessage = (harness: Harness, msgType: string, timeout = 2000) =>
	until(() => harness.last(msgType) !== undefined, timeout);

describe('origin locking', () => {
	test('announces runner-ready to any origin before the lock exists', () => {
		const harness = createHarness(() => ({}));
		expect(harness.last('runner-ready')?.targetOrigin).toBe('*');
	});

	test('ignores init before hello and hello from a non-parent source', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.init();
		await sleep(10);
		expect(harness.last('module-loaded')).toBeUndefined();

		harness.deliver(createSandboxEnvelope('hello', { parentOrigin: PARENT_ORIGIN }), PARENT_ORIGIN, false);
		harness.init();
		await sleep(10);
		expect(harness.last('module-loaded')).toBeUndefined();

		harness.hello();
		harness.init();
		await waitForMessage(harness, 'module-loaded');
	});

	test('once locked, messages from another origin are refused', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.deliver(createSandboxEnvelope('init', {
			typeIdentifier: harness.type,
			modules: [{ id: harness.type, primaryUrl: ENTRY_URL }],
			entryId: harness.type,
			baseUrl: 'https://packages.example.com/',
			markup: '',
			registrationTimeoutMs: 500,
			pollIntervalMs: 50,
		}), 'https://evil.example');
		await sleep(10);
		expect(harness.last('module-loaded')).toBeUndefined();
		expect(harness.last('module-error')).toBeUndefined();

		harness.init();
		await waitForMessage(harness, 'module-loaded');
	});

	test('after the lock, replies go only to the locked parent origin', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init();
		await waitForMessage(harness, 'module-loaded');
		for (const entry of harness.outbox) {
			if (entry.message.type === 'runner-ready') continue;
			expect(entry.targetOrigin).toBe(PARENT_ORIGIN);
		}
	});

	// A host page that is itself sandboxed (the LTI-style embed this sandbox
	// architecture targets) serializes its origin as "null". That string can
	// never be a usable postMessage targetOrigin — parsing it yields no origin
	// that is same-origin with the parent — so every runner→host message would
	// be silently dropped and the handshake could never complete. The runner
	// must fall back to '*' outbound while the inbound lock keeps filtering on
	// the "null" spelling.
	test('an opaque-parent handshake (origin "null") delivers messages both ways', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		const OPAQUE = 'null';
		const fromParent = (data: unknown) => harness.deliver(data, OPAQUE);
		fromParent(createSandboxEnvelope('hello', { parentOrigin: OPAQUE }));
		fromParent(createSandboxEnvelope('init', harness.initPayload()));
		await waitForMessage(harness, 'module-loaded');
		fromParent(
			createSandboxEnvelope('instantiate', {
				responseIdentifier: 'RESPONSE',
				status: 'interacting',
				properties: {},
			})
		);
		await waitForMessage(harness, 'instance-ready');

		// Outbound: every post-lock message goes with '*', never the dead
		// "null" target.
		for (const entry of harness.outbox) {
			if (entry.message.type === 'runner-ready') continue;
			expect(entry.targetOrigin).toBe('*');
			expect(entry.targetOrigin).not.toBe(OPAQUE);
		}

		// Inbound: messages keep arriving from the opaque parent — the poll
		// picks up the module's new response and crosses the bridge.
		(globalThis as any).__echoInstance.setResponse('opaque');
		await until(() => harness.messages('response-change').length >= 1);
		expect(harness.last('response-change')?.message.payload).toMatchObject({
			response: { base: { string: 'opaque' } },
		});

		// The lock still refuses a tuple origin that is not the locked spelling.
		harness.deliver(createSandboxEnvelope('init', harness.initPayload()), 'https://evil.example');
		await sleep(10);
		expect(harness.last('module-error')).toBeUndefined();
		expect(harness.messages('module-loaded')).toHaveLength(1);
	});
});

describe('module loading and instantiation', () => {
	test('loads the entry module, adopts its registration, and injects the markup', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init();
		await waitForMessage(harness, 'module-loaded');

		expect(harness.last('module-loaded')?.message.payload).toEqual({ typeIdentifier: harness.type });
		// The container (and the markup inside it) appears at instantiation.
		expect(harness.containers).toHaveLength(0);
	});

	test('fetches the authored resolution config and applies its paths', async () => {
		const configUrl = 'https://packages.example.com/modules/module_resolution.js';
		const depUrl = 'https://packages.example.com/pci/lib.js';
		const harness = createHarness((type) => ({
			[configUrl]: JSON.stringify({ paths: { 'echo-lib': 'pci/lib.js' } }),
			[ENTRY_URL]: `define(['echo-lib'], function () { ${echoModule(type)}; });`,
			[depUrl]: 'define(function () { return { name: "lib" }; });',
		}));
		harness.hello();
		harness.init({ resolutionConfigUrl: configUrl });
		await waitForMessage(harness, 'module-loaded');
	});

	test('reports module-error when the module never registers', async () => {
		const harness = createHarness(() => ({ [ENTRY_URL]: 'globalThis.__loaded = true;' }));
		harness.hello();
		harness.init({ registrationTimeoutMs: 40 });
		await waitForMessage(harness, 'module-error');
		const error = harness.last('module-error');
		expect(error).toBeDefined();
		expect((error?.message.payload as { message?: string } | undefined)?.message).toContain('did not register');
	});

	test('reports module-error when the module script fails to load', async () => {
		const harness = createHarness(() => ({}));
		harness.hello();
		harness.init();
		await waitForMessage(harness, 'module-error');
	});

	test('instantiates with the seeded state and reports instance-ready', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init({ markup: '<span class="markup"></span>' });
		await waitForMessage(harness, 'module-loaded');
		harness.instantiate({ state: { base: { string: 'A' } }, properties: { color: 'blue' } });
		await waitForMessage(harness, 'instance-ready');

		expect(harness.last('instance-ready')?.message.payload).toEqual({
			response: { base: { string: 'A' } },
			state: { response: 'A' },
		});
		// The onready the module called during getInstance crossed the bridge with
		// its state argument intact.
		const lifecycle = harness.last('ready');
		expect((lifecycle?.message.payload as { state?: unknown } | undefined)?.state).toEqual({ seeded: true });
		// The container getInstance received is the one seeded with the init markup;
		// the module replaced its contents, as a page-realm scaffold's module would.
		expect(harness.containers[0]?.markup).toBe('<div class="echo"></div>');
	});

	test('a fresh instantiation tears the previous one down first', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init();
		await waitForMessage(harness, 'module-loaded');
		harness.instantiate();
		await waitForMessage(harness, 'instance-ready');
		expect(harness.containers).toHaveLength(1);

		harness.instantiate({ status: 'review' });
		await until(() => harness.messages('instance-ready').length >= 2);
		// The old container is removed from the mount entirely — an emptied
		// wrapper left behind would accumulate one dead <div> per re-instantiation.
		expect(harness.containers[0]?.parent).toBeNull();
		expect(harness.mount.children).toHaveLength(1);
		expect(harness.mount.children[0]).toBe(harness.containers[1]);
		expect(harness.containers).toHaveLength(2);
		expect((globalThis as any).__echoConfiguration?.status).toBe('review');
	});

	test('set-enabled reaches the live instance', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init();
		await waitForMessage(harness, 'module-loaded');
		harness.instantiate();
		await waitForMessage(harness, 'instance-ready');
		const instance = (globalThis as any).__echoInstance;
		instance.disable = () => {
			instance.disabled = true;
		};
		harness.deliver(createSandboxEnvelope('set-enabled', { enabled: false }));
		expect(instance.disabled).toBe(true);
	});
});

describe('response freshness', () => {
	test('polls the instance and pushes response changes', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init({ pollIntervalMs: 30 });
		await waitForMessage(harness, 'module-loaded');
		harness.instantiate();
		await waitForMessage(harness, 'instance-ready');
		const before = harness.messages('response-change').length;

		(globalThis as any).__echoInstance.setResponse('B');
		await until(() => harness.messages('response-change').length > before);
		const changes = harness.messages('response-change').slice(before);
		expect(changes.length).toBeGreaterThanOrEqual(1);
		expect(changes.at(-1)?.message.payload).toMatchObject({ response: { base: { string: 'B' } } });
	});

	test('teardown-instance stops the poll and removes the container', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init({ pollIntervalMs: 30 });
		await waitForMessage(harness, 'module-loaded');
		harness.instantiate();
		await waitForMessage(harness, 'instance-ready');
		harness.deliver(createSandboxEnvelope('teardown-instance', {}));
		await until(() => harness.mount.children.length === 0);
		expect(harness.containers[0]?.parent).toBeNull();
		expect(harness.mount.children).toHaveLength(0);

		const before = harness.messages('response-change').length;
		(globalThis as any).__echoInstance.setResponse('C');
		await sleep(120);
		expect(harness.messages('response-change').length).toBe(before);
	});
});

describe('protocol hygiene', () => {
	test('non-protocol or wrong-version envelopes are ignored', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.deliver({ protocol: 'something-else', version: PCI_SANDBOX_PROTOCOL_VERSION, type: 'init', payload: {} });
		harness.deliver({ protocol: 'pie-qti-pci-sandbox', version: '9.9.9', type: 'init', payload: {} });
		await sleep(10);
		expect(harness.last('module-loaded')).toBeUndefined();
	});
});

describe('frame language (round 6)', () => {
	function fakeFrameDocument(): PciRunnerFrameDocument {
		return {
			documentElement: {},
			title: 'PCI runner',
		};
	}

	test('an init payload carrying language, direction and title states them on the frame document', async () => {
		const frame = fakeFrameDocument();
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }), { frameDocument: frame });
		harness.hello();
		harness.init({ language: 'ar-EG', direction: 'rtl', frameTitle: 'محتوى تفاعلي' });
		await waitForMessage(harness, 'module-loaded');
		harness.instantiate();
		await waitForMessage(harness, 'instance-ready');

		expect(frame.documentElement.lang).toBe('ar-EG');
		expect(frame.documentElement.dir).toBe('rtl');
		expect(frame.title).toBe('محتوى تفاعلي');
		// Applied while the module loaded, before the instance existed.
		expect(harness.last('instance-ready')).toBeDefined();
	});

	test('an init payload without language fields leaves the frame document untouched', async () => {
		const frame = fakeFrameDocument();
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }), { frameDocument: frame });
		harness.hello();
		harness.init();
		await sleep(10);

		expect(frame.documentElement.lang).toBeUndefined();
		expect(frame.documentElement.dir).toBeUndefined();
		expect(frame.title).toBe('PCI runner');
	});
});
