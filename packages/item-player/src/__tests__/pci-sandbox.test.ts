/**
 * The sandboxed engine on the host side: `PciHost` with `sandbox` options
 * against a scripted fake runner over an in-memory frame connection. The real
 * runner implementation has its own suite in `packages/pci-runner`; this file
 * pins the host half of the bridge — handshake, init payload, queued
 * instantiation, cache reads, lifecycle dispatch, teardown, and error paths.
 */

import { describe, expect, mock, test } from 'bun:test';
import { PciHost } from '../pci/PciHost.js';
import { createAllowlistPciModulePolicy, PciModuleNotAllowedError } from '../pci/allowlistResolver.js';
import { PCI_SANDBOX_PROTOCOL, createSandboxEnvelope, type PciSandboxMessageType } from '../pci/sandbox/protocol.js';
import { PciLoadError } from '../pci/types.js';
import type {
	ExtractedPci,
	PciFrameConnection,
	PciSandboxConfiguration,
} from '../pci/types.js';

const PARENT_ORIGIN = 'https://app.example';
const RUNNER_ORIGIN = 'https://runner.example';
const RUNNER_URL = `${RUNNER_ORIGIN}/pci-runner.html`;
const ENTRY_URL = 'pci/echo.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeData(overrides: Partial<ExtractedPci> = {}): ExtractedPci {
	return {
		responseIdentifier: 'RESPONSE',
		customInteractionTypeIdentifier: 'urn:test:echo-pci',
		primaryPath: ENTRY_URL,
		fallbackPath: undefined,
		modules: [{ id: 'urn:test:echo-pci', primaryPath: ENTRY_URL }],
		markup: '<div class="pci-container"></div>',
		config: { color: 'blue' },
		...overrides,
	};
}

function sandbox(overrides: Partial<PciSandboxConfiguration> = {}): PciSandboxConfiguration {
	return { runnerUrl: RUNNER_URL, handshakeTimeoutMs: 30, ...overrides };
}

function makeConnectionPair() {
	const posts: Array<{ type: string; payload: any }> = [];
	const handlers = new Set<(data: unknown) => void>();
	let appended: HTMLElement | null = null;
	let disposed = false;
	const connection: PciFrameConnection = {
		frameOrigin: RUNNER_ORIGIN,
		source: Symbol('contentWindow'),
		post(message) {
			const envelope = message as { type?: string; payload?: unknown };
			posts.push({ type: envelope.type ?? '', payload: envelope.payload });
			pump?.(envelope as { type: string; payload: unknown });
		},
		appendTo(target) {
			appended = target;
		},
		isAttached: () => !disposed,
		setHeight() {},
		onMessage(handler) {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
		dispose() {
			disposed = true;
		},
	};
	let pump: ((message: { type: string; payload: unknown }) => void) | null = null;
	const deliver = (envelope: unknown) => {
		for (const handler of [...handlers]) handler(envelope);
	};
	return {
		connection,
		posts,
		deliver,
		isDisposed: () => disposed,
		appendedTarget: () => appended,
		/** The fake runner's inbound hook, wired after construction. */
		setPump(fn: (message: { type: string; payload: unknown }) => void) {
			pump = fn;
		},
	};
}

function makeMountNode() {
	return {
		replaceChildren: mock(() => {}),
		appendChild: mock(() => {}),
	} as any as HTMLElement;
}

/**
 * A scripted runner: records what the host sends and replies on demand, the
 * way `createPciRunnerController` would, without loading real modules.
 */
function makeFakeRunner(deliver: (envelope: unknown) => void) {
	const received: Array<{ type: string; payload: any }> = [];
	const enabledLog: boolean[] = [];
	let locked = false;
	let initSeen = false;
	let lastInit: { type: string; payload: any } | undefined;
	const reply = (type: PciSandboxMessageType, payload: unknown) =>
		deliver(createSandboxEnvelope(type, payload));
	const pump = (message: { type: string; payload: unknown }) => {
		if (message.type === 'runner-ready') return;
		if (!locked && message.type !== 'hello') return;
		received.push({ type: message.type, payload: message.payload });
		switch (message.type) {
			case 'hello':
				locked = true;
				return;
			case 'init':
				initSeen = true;
				lastInit = message as { type: string; payload: any };
				return;
			case 'set-enabled':
				enabledLog.push((message.payload as { enabled?: unknown }).enabled !== false);
				return;
			default:
				return;
		}
	};
	return {
		received,
		enabledLog,
		pump,
		/** Announce the runner page loaded (triggers hello + init). */
		runnerReady() {
			reply('runner-ready', {});
		},
		moduleLoaded() {
			if (initSeen) reply('module-loaded', { typeIdentifier: 'urn:test:echo-pci' });
		},
		moduleError(message: string) {
			if (initSeen) reply('module-error', { message });
		},
		/** Reply to the last instantiate with an echo snapshot of the seeded state. */
		instanceReady(response?: unknown, state?: unknown) {
			const instantiate = [...received].reverse().find((entry) => entry.type === 'instantiate');
			const seed = instantiate?.payload?.state;
			const echoed = response ?? seed ?? null;
			reply('instance-ready', {
				response: echoed,
				...(state !== undefined ? { state } : seed !== undefined ? { state: { echoed: seed } } : {}),
			});
			reply('ready', {
				response: echoed,
				...(seed !== undefined ? { state: { fromOnready: true } } : {}),
			});
		},
		pushResponseChange(response: unknown, state?: unknown) {
			reply('response-change', { response, ...(state !== undefined ? { state } : {}) });
		},
		lastInit: () => lastInit,
	};
}

describe('PciHost sandboxed engine', () => {
	function setup(
		data: ExtractedPci = makeData(),
		options: { sandbox?: Partial<PciSandboxConfiguration> } = {}
	) {
		const pair = makeConnectionPair();
		const runner = makeFakeRunner(pair.deliver);
		pair.setPump(runner.pump);
		const errors: Error[] = [];
		const responses: Array<{ responseId: string; value: unknown }> = [];
		const host = new PciHost(data, {
			baseUrl: 'https://packages.example.com/items/',
			sandbox: sandbox(options.sandbox),
			frameConnector: () => pair.connection,
			parentOrigin: () => PARENT_ORIGIN,
			responseDeclaration: { baseType: 'identifier', cardinality: 'single' },
		});
		host.onError((error) => errors.push(error));
		host.onResponseChange((responseId, value) => responses.push({ responseId, value }));
		return { host, pair, runner, errors, responses };
	}

	test('a sandbox-only configuration needs no moduleResolver', () => {
		expect(new PciHost(makeData(), { sandbox: sandbox() })).toBeDefined();
	});

	test('construction validates the runner URL', () => {
		expect(() => new PciHost(makeData(), { sandbox: { runnerUrl: 'not a url' } })).toThrow(/absolute URL/);
		expect(() => new PciHost(makeData(), { sandbox: { runnerUrl: 'javascript:alert(1)' } })).toThrow(
			/http\(s\)/
		);
	});

	test('handshake sends hello then init with resolved module URLs and sanitized markup', async () => {
		const { host, pair, runner } = setup();
		await host.load();

		host.initialize(makeMountNode());
		expect(pair.appendedTarget()).not.toBeNull();
		runner.runnerReady();
		await sleep(5);

		const hello = pair.posts.find((message) => message.type === 'hello');
		expect(hello?.payload.parentOrigin).toBe(PARENT_ORIGIN);

		const init = runner.lastInit();
		expect(init).toBeDefined();
		expect(init!.payload.typeIdentifier).toBe('urn:test:echo-pci');
		expect(init!.payload.modules).toEqual([
			{ id: 'urn:test:echo-pci', primaryUrl: 'https://packages.example.com/items/pci/echo.js' },
		]);
		expect(init!.payload.entryId).toBe('urn:test:echo-pci');
		expect(init!.payload.baseUrl).toBe('https://packages.example.com/items/');
		expect(String(init!.payload.markup)).toContain('pci-container');
		expect(typeof init!.payload.registrationTimeoutMs).toBe('number');
	});

	test('instantiate waits for module-loaded and carries the seeded state', async () => {
		const { host, runner } = setup();
		const reported: unknown[] = [];
		host.onResponseChange((_id, value) => reported.push(value));
		host.offerResponse('A');
		await host.load();
		host.initialize(makeMountNode());

		runner.runnerReady();
		await sleep(5);
		runner.moduleLoaded();
		await sleep(5);
		runner.instanceReady();
		await sleep(5);

		const instantiate = runner.received.find((entry) => entry.type === 'instantiate');
		expect(instantiate?.payload.responseIdentifier).toBe('RESPONSE');
		expect(instantiate?.payload.status).toBe('interacting');
		expect(instantiate?.payload.properties).toEqual({ color: 'blue' });
		expect(instantiate?.payload.state).toEqual({ base: { identifier: 'A' } });
		// The module echoed its seed back through onready; the host published it.
		expect(reported).toEqual(['A']);
		expect(host.getResponse()).toBe('A');
		expect(host.getState()).toEqual({ fromOnready: true });
	});

	test('module-error surfaces through onError as a PciLoadError', async () => {
		const { host, runner, errors } = setup();
		await host.load();
		host.initialize(makeMountNode());
		runner.runnerReady();
		await sleep(5);
		runner.moduleError('bundle not found');
		await sleep(5);

		expect(errors).toHaveLength(1);
		expect(errors[0]).toBeInstanceOf(PciLoadError);
	});

	test('a frame that never becomes ready fails through onError', async () => {
		const { host, errors } = setup(makeData(), { sandbox: { handshakeTimeoutMs: 20 } });
		await host.load();
		host.initialize(makeMountNode());
		await sleep(60);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('did not become ready');
	});

	test('modulePolicy denies module URLs before any frame exists', async () => {
		const policy = createAllowlistPciModulePolicy({ allowedOrigins: ['https://trusted.example'] });
		const host = new PciHost(makeData(), { sandbox: sandbox(), modulePolicy: policy });
		await expect(host.load()).rejects.toBeInstanceOf(PciModuleNotAllowedError);
	});

	test('response-change pushes update the cache, own the response, and decline offers', async () => {
		const { host, runner } = setup();
		await host.load();
		host.initialize(makeMountNode());
		runner.runnerReady();
		await sleep(5);
		runner.moduleLoaded();
		await sleep(5);
		runner.instanceReady({ base: { string: 'A' } }, { v: 1 });
		await sleep(5);

		runner.pushResponseChange({ base: { string: 'B' } }, { v: 2 });
		await sleep(5);
		expect(host.getResponse()).toBe('B');
		expect(host.getState()).toEqual({ v: 2 });
		expect(host.offerResponse('C')).toBe(false);
	});

	test('restore() without a renderer re-instantiates in the frame with the restored value', async () => {
		const { host, runner } = setup();
		await host.load();
		host.initialize(makeMountNode());
		runner.runnerReady();
		await sleep(5);
		runner.moduleLoaded();
		await sleep(5);
		runner.instanceReady({ base: { string: 'A' } });
		await sleep(5);

		host.restore('R');
		await sleep(5);
		const instantiates = runner.received.filter((entry) => entry.type === 'instantiate');
		expect(instantiates).toHaveLength(2);
		expect(instantiates[1].payload.state).toEqual({ base: { identifier: 'R' } });
		// The old instance was torn down across the bridge before the new one was
		// created (destroyInstance and the pre-instantiate guard may both send it).
		const teardownIndex = runner.received.map((entry) => entry.type).lastIndexOf('teardown-instance');
		expect(teardownIndex).toBeGreaterThanOrEqual(0);
		expect(teardownIndex).toBeLessThan(runner.received.indexOf(instantiates[1]));
		// Until the rebuilt instance reports, getResponse() reports the restored value.
		expect(host.getResponse()).toBe('R');

		runner.instanceReady({ base: { string: 'R' } });
		await sleep(5);
		expect(host.getResponse()).toBe('R');
	});

	test('disable/enable nudge the proxy, which posts to the frame', async () => {
		const { host, runner } = setup();
		await host.load();
		host.initialize(makeMountNode());
		runner.runnerReady();
		await sleep(5);
		runner.moduleLoaded();
		await sleep(5);
		runner.instanceReady();
		await sleep(5);

		host.disable();
		host.enable();
		await sleep(5);
		const enabled = runner.received.filter((entry) => entry.type === 'set-enabled');
		expect(enabled.map((entry) => entry.payload.enabled)).toEqual([false, true]);
	});

	test('destroy posts dispose and ignores later frame messages', async () => {
		const { host, pair, runner, responses } = setup();
		await host.load();
		host.initialize(makeMountNode());
		runner.runnerReady();
		await sleep(5);
		runner.moduleLoaded();
		await sleep(5);
		runner.instanceReady();
		await sleep(5);

		host.destroy();
		expect(pair.isDisposed()).toBe(true);
		const changeCount = responses.length;
		runner.pushResponseChange({ base: { string: 'Z' } });
		await sleep(5);
		expect(responses.length).toBe(changeCount);
	});
});
