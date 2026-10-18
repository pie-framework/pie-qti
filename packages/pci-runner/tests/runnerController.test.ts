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

function createHarness(buildFiles: (type: string) => Record<string, string>) {
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
	return { controller, type, files, outbox, deliver, mount, containers, messages, last, hello, init, instantiate };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
		await sleep(10);
		expect(harness.last('module-loaded')).toBeDefined();
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
		await sleep(10);
		expect(harness.last('module-loaded')).toBeDefined();
	});

	test('after the lock, replies go only to the locked parent origin', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init();
		await sleep(10);
		for (const entry of harness.outbox) {
			if (entry.message.type === 'runner-ready') continue;
			expect(entry.targetOrigin).toBe(PARENT_ORIGIN);
		}
	});
});

describe('module loading and instantiation', () => {
	test('loads the entry module, adopts its registration, and injects the markup', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init();
		await sleep(10);

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
		await sleep(10);
		expect(harness.last('module-loaded')).toBeDefined();
	});

	test('reports module-error when the module never registers', async () => {
		const harness = createHarness(() => ({ [ENTRY_URL]: 'globalThis.__loaded = true;' }));
		harness.hello();
		harness.init({ registrationTimeoutMs: 40 });
		await sleep(150);
		const error = harness.last('module-error');
		expect(error).toBeDefined();
		expect((error?.message.payload as { message?: string } | undefined)?.message).toContain('did not register');
	});

	test('reports module-error when the module script fails to load', async () => {
		const harness = createHarness(() => ({}));
		harness.hello();
		harness.init();
		await sleep(10);
		expect(harness.last('module-error')).toBeDefined();
	});

	test('instantiates with the seeded state and reports instance-ready', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init({ markup: '<span class="markup"></span>' });
		await sleep(10);
		harness.instantiate({ state: { base: { string: 'A' } }, properties: { color: 'blue' } });
		await sleep(10);

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
		await sleep(10);
		harness.instantiate();
		await sleep(10);
		expect(harness.containers).toHaveLength(1);

		harness.instantiate({ status: 'review' });
		await sleep(10);
		// The old container was emptied and a new one created for the new instance.
		expect(harness.containers[0]?.children).toHaveLength(0);
		expect(harness.containers).toHaveLength(2);
		expect((globalThis as any).__echoConfiguration?.status).toBe('review');
	});

	test('set-enabled reaches the live instance', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init();
		await sleep(10);
		harness.instantiate();
		await sleep(10);
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
		await sleep(10);
		harness.instantiate();
		await sleep(10);
		const before = harness.messages('response-change').length;

		(globalThis as any).__echoInstance.setResponse('B');
		await sleep(120);
		const changes = harness.messages('response-change').slice(before);
		expect(changes.length).toBeGreaterThanOrEqual(1);
		expect(changes.at(-1)?.message.payload).toMatchObject({ response: { base: { string: 'B' } } });
	});

	test('teardown-instance stops the poll and disposes the container', async () => {
		const harness = createHarness((type) => ({ [ENTRY_URL]: echoModule(type) }));
		harness.hello();
		harness.init({ pollIntervalMs: 30 });
		await sleep(10);
		harness.instantiate();
		await sleep(10);
		harness.deliver(createSandboxEnvelope('teardown-instance', {}));
		await sleep(10);
		expect(harness.containers[0]?.children).toHaveLength(0);

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
