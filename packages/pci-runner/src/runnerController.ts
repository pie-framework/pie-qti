/**
 * The PCI runner's bridge controller.
 *
 * The runner page is a conformant PCI *host* in its own (opaque-origin) realm:
 * it installs `qtiCustomInteractionContext`, loads the authored module through
 * the AMD loader, instantiates it with `getInstance(dom, configuration, state)`,
 * and bridges every contract crossing — registration readiness, `onready` /
 * `ondone`, `getResponse()`/`getState()` reads, resize — back to the player
 * page over postMessage, using the `pie-qti-pci-sandbox` protocol.
 *
 * The controller is driver-agnostic: the browser entry (`main.ts`) wires it to
 * `window.postMessage`, DOM script injection, and a `ResizeObserver`; tests
 * drive it with an in-memory transport. Nothing here trusts the parent beyond
 * the locked origin — the first message is accepted only from
 * `window.parent`, and every later message must carry that origin.
 */

import {
	DEFAULT_RESOLUTION_CONFIG_PATHS,
	createAmdLoader,
	createSandboxEnvelope,
	emptyResolutionConfig,
	isPciSandboxEnvelope,
	installPciRegistry,
	parseModuleResolutionConfig,
	type PciRegistryObservation,
	type PciSandboxInitPayload,
	type PciSandboxInstantiatePayload,
	type QtiCustomInteractionRegistration,
	type QtiPciConfiguration,
	type QtiPciInstance,
} from '@pie-qti/item-player/pci';

/** Transport half the controller talks through; `main.ts` binds it to the window. */
export interface PciRunnerTransport {
	/** Send a structured-cloneable message to the parent window. */
	postToParent(message: unknown, targetOrigin: string): void;
	/** Incoming messages, with the sender's origin and whether it is the parent. */
	onMessage(
		handler: (event: { origin: string; data: unknown; isParentSource: boolean }) => void
	): () => void;
}

export interface PciRunnerEnvironment {
	transport: PciRunnerTransport;
	/** The element the interaction container is appended to. */
	mount: HTMLElement;
	/** Creates the per-instantiation container a module renders into. */
	createContainer(): HTMLElement;
	/** Fetch a resolution-config URL and return its text. */
	fetchText(url: string): Promise<string>;
	/** Evaluate one module URL in this realm (script injection in the browser). */
	evaluateScript(url: string): Promise<void>;
	/** Where the registry global is installed; defaults to `globalThis`. */
	registryTarget?: object;
}

type Snapshot = { response: unknown; state: unknown };

export function createPciRunnerController(environment: PciRunnerEnvironment) {
	const registry: PciRegistryObservation = installPciRegistry(
		environment.registryTarget ?? globalThis
	);

	let lockedParentOrigin: string | null = null;
	let listening = false;
	let stopListening: (() => void) | null = null;
	let init: PciSandboxInitPayload | null = null;
	let registration: QtiCustomInteractionRegistration | null = null;
	let instance: QtiPciInstance | null = null;
	let container: HTMLElement | null = null;
	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let lastSnapshotJson: string | null = null;

	function send(type: Parameters<typeof createSandboxEnvelope>[0], payload: unknown): void {
		const message = createSandboxEnvelope(type, payload);
		try {
			// Before the lock there is nothing to address the parent by: the only
			// message is `runner-ready`, which carries no secrets.
			environment.transport.postToParent(message, lockedParentOrigin ?? '*');
		} catch {
			// A payload a structured clone refuses (a function-bearing response)
			// must not kill the bridge; retry without the uncloneable snapshot.
			if (type === 'response-change' || type === 'ready' || type === 'done') {
				try {
					environment.transport.postToParent(
						createSandboxEnvelope(type, { response: null }),
						lockedParentOrigin ?? '*'
					);
				} catch {
					// The parent is unreachable; nothing further can be reported.
				}
			}
		}
	}

	function handleMessage(event: { origin: string; data: unknown; isParentSource: boolean }): void {
		if (!isPciSandboxEnvelope(event.data)) return;
		if (!lockedParentOrigin) {
			if (event.data.type !== 'hello' || !event.isParentSource) return;
			if (typeof event.origin !== 'string' || event.origin.length === 0) return;
			lockedParentOrigin = event.origin;
			return;
		}
		if (event.origin !== lockedParentOrigin || !event.isParentSource) return;
		const payload = event.data.payload;
		switch (event.data.type) {
			case 'init':
				if (!listening) return;
				void handleInit(payload as PciSandboxInitPayload);
				return;
			case 'instantiate':
				if (!listening) return;
				handleInstantiate(payload as PciSandboxInstantiatePayload);
				return;
			case 'set-enabled': {
				const enabled = (payload as { enabled?: unknown })?.enabled !== false;
				// Optional nudges; conformant modules read configuration.status instead.
				const target = instance as { enable?: () => void; disable?: () => void } | null;
				if (enabled) target?.enable?.();
				else target?.disable?.();
				return;
			}
			case 'teardown-instance':
				teardownInstance();
				return;
			case 'dispose':
				teardownInstance();
				stop();
				return;
			default:
				return;
		}
	}

	async function handleInit(payload: PciSandboxInitPayload): Promise<void> {
		init = payload;
		try {
			registration = await loadModule(payload);
			send('module-loaded', { typeIdentifier: payload.typeIdentifier });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			send('module-error', { message });
		}
	}

	/**
	 * Fetch the resolution config (authored reference first, then the defined
	 * default locations), then drive the entry module through the AMD loader so
	 * `define` dependencies wire up, and wait for its registration.
	 */
	async function loadModule(payload: PciSandboxInitPayload): Promise<QtiCustomInteractionRegistration> {
		const config = await loadResolutionConfig(payload);
		const loader = createAmdLoader({
			baseUrl: payload.baseUrl,
			config,
			evaluate: (resolvedUrl) => environment.evaluateScript(resolvedUrl),
			resolveUrl: (path) => resolveAgainstBase(path, payload.baseUrl),
		});
		loader.install();
		try {
			loader.addPaths(
				Object.fromEntries(payload.modules.map((module) => [module.id, module.primaryUrl]))
			);
			return await withTimeout(
				(async () => {
					await loader.load([payload.entryId]);
					return registry.whenRegistered(payload.typeIdentifier);
				})(),
				payload.registrationTimeoutMs,
				`PCI module for '${payload.typeIdentifier}' did not register in the runner frame`
			);
		} finally {
			loader.dispose();
		}
	}

	async function loadResolutionConfig(payload: PciSandboxInitPayload) {
		const candidates = payload.resolutionConfigUrl
			? [payload.resolutionConfigUrl, ...DEFAULT_RESOLUTION_CONFIG_PATHS.map((p) => resolveAgainstBase(p, payload.baseUrl))]
			: DEFAULT_RESOLUTION_CONFIG_PATHS.map((p) => resolveAgainstBase(p, payload.baseUrl));
		for (const url of candidates) {
			try {
				const text = await environment.fetchText(url);
				const parsed = parseModuleResolutionConfig(text);
				if (Object.keys(parsed.paths).length > 0) return parsed;
			} catch {
				// A package without a config file at this location falls through.
			}
		}
		return emptyResolutionConfig();
	}

	function handleInstantiate(payload: PciSandboxInstantiatePayload): void {
		if (!registration) {
			send('instance-error', { message: 'no module has loaded in this runner' });
			return;
		}
		teardownInstance();
		container = environment.createContainer();
		environment.mount.appendChild(container);
		container.innerHTML = init?.markup ?? '';

		const configuration: QtiPciConfiguration = {
			responseIdentifier: payload.responseIdentifier,
			status: (payload.status ?? 'interacting') as QtiPciConfiguration['status'],
			properties: payload.properties ?? {},
			...(payload.templateVariables !== undefined
				? { templateVariables: payload.templateVariables }
				: {}),
			...(payload.contextVariables !== undefined
				? { contextVariables: payload.contextVariables }
				: {}),
			onready: (_instance, state) => sendLifecycle('ready', state),
			ondone: (_instance, state) => sendLifecycle('done', state),
		};
		try {
			instance = registration.getInstance(container, configuration, payload.state) ?? null;
		} catch (error) {
			instance = null;
			const message = error instanceof Error ? error.message : String(error);
			send('instance-error', { message });
			return;
		}
		const snapshot = readSnapshot();
		lastSnapshotJson = JSON.stringify(snapshot);
		send('instance-ready', snapshot);
		startPolling();
	}

	function sendLifecycle(type: 'ready' | 'done', stateArg: unknown): void {
		const snapshot = readSnapshot();
		if (stateArg !== undefined) snapshot.state = stateArg;
		lastSnapshotJson = JSON.stringify(snapshot);
		send(type, snapshot);
	}

	function readSnapshot(): Snapshot {
		let response: unknown = null;
		let state: unknown = undefined;
		if (instance) {
			try {
				response = instance.getResponse();
			} catch {
				// A module whose getResponse() throws has reported nothing yet.
			}
			try {
				state = instance.getState?.();
			} catch {
				state = undefined;
			}
		}
		return { response, state };
	}

	function startPolling(): void {
		stopPolling();
		const interval = Math.max(50, init?.pollIntervalMs ?? 250);
		pollTimer = setInterval(() => {
			const snapshot = readSnapshot();
			const json = JSON.stringify(snapshot);
			if (json === lastSnapshotJson) return;
			lastSnapshotJson = json;
			send('response-change', snapshot);
		}, interval);
	}

	function stopPolling(): void {
		if (pollTimer !== undefined) {
			clearInterval(pollTimer);
			pollTimer = undefined;
		}
	}

	function teardownInstance(): void {
		stopPolling();
		(instance as { destroy?: () => void } | null)?.destroy?.();
		instance = null;
		container?.replaceChildren();
		container = null;
		lastSnapshotJson = null;
	}

	/** Resize reporting the browser entry wires to a ResizeObserver. */
	function notifyResize(height: number): void {
		if (!listening || !Number.isFinite(height)) return;
		send('resize', { height: Math.max(0, Math.ceil(height)) });
	}

	function start(): void {
		if (listening) return;
		listening = true;
		stopListening = environment.transport.onMessage(handleMessage);
		send('runner-ready', {});
	}

	function stop(): void {
		listening = false;
		stopListening?.();
		stopListening = null;
		teardownInstance();
		init = null;
		registration = null;
		registry.dispose();
	}

	return { start, stop, notifyResize };
}

function resolveAgainstBase(path: string, baseUrl: string): string {
	if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || path.startsWith('/')) {
		return path;
	}
	if (!baseUrl) return path;
	const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
	try {
		return new URL(path, base).href;
	} catch {
		return base + path;
	}
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => {
		if (timer !== undefined) clearTimeout(timer);
	});
}
