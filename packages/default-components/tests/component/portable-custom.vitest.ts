import { afterEach, describe, expect, test, vi } from 'vitest';
import type { I18nProvider } from '@pie-qti/i18n';
import type { PciHostController, PortableCustomInteractionData } from '@pie-qti/item-player';
import PortableCustomInteraction from '../../src/plugins/portable-custom/PortableCustomInteraction.svelte';
import { cleanupInteraction, mountInteraction, qa, q, settle } from './helpers';

/**
 * English fallback provider. The components call `i18n?.t(key, fallback)`, so with no
 * provider at all no text is produced; this stub reproduces what the player supplies.
 */
const i18n: I18nProvider = {
	getLocale: () => 'en',
	setLocale: () => {},
	t: (key, defaultOrValues) => (typeof defaultOrValues === 'string' ? defaultOrValues : key),
};

/** A minimal, valid PCI extraction — markup plus the paths a resolver would be handed. */
function pciData(overrides: Partial<PortableCustomInteractionData> = {}): PortableCustomInteractionData {
	return {
		type: 'portableCustomInteraction',
		responseId: 'RESPONSE',
		responseIdentifier: 'RESPONSE',
		customInteractionTypeIdentifier: 'urn:example:echo-pci',
		primaryPath: 'https://cdn.example.com/pci/echo.js',
		modules: [{ id: 'echo-pci', primaryPath: 'https://cdn.example.com/pci/echo.js' }],
		markup: '<div class="pci-container" data-echo></div>',
		config: { color: 'blue' },
		...overrides,
	};
}

/** A spec-shaped registration whose getInstance reports readiness with a fixed response. */
function registeringModule(response: unknown) {
	const configurations: Array<Record<string, unknown>> = [];
	return {
		configurations,
		registration: {
			typeIdentifier: 'urn:example:echo-pci',
			getInstance: (_dom: HTMLElement, configuration: Record<string, unknown>) => {
				configurations.push(configuration);
				const instance = {
					getResponse: () => response,
					getState: () => undefined,
				};
				// Conformant modules report readiness through the configuration callback —
				// after getInstance returned (the host captures the response only then).
				queueMicrotask(() => (configuration.onready as (instance: unknown) => void)(instance));
				return instance;
			},
		},
	};
}

interface FakeHostCalls {
	load: number;
	initialize: HTMLElement[];
	offerResponse: unknown[];
	disable: number;
	enable: number;
	destroy: number;
	remount: number;
}

/** A host controller stub recording every call the renderer makes on it. */
function fakeHost(
	options: { loadError?: Error; holdLoad?: boolean } = {},
): PciHostController & {
	calls: FakeHostCalls;
	reportResponse: (value: unknown) => void;
	emitError: (error: Error) => void;
	requestRemount: () => void;
	releaseLoad: () => void;
} {
	const calls: FakeHostCalls = {
		load: 0,
		initialize: [],
		offerResponse: [],
		disable: 0,
		enable: 0,
		destroy: 0,
		remount: 0,
	};
	let responseListener: ((responseId: string, value: unknown) => void) | null = null;
	let errorListener: ((error: Error) => void) | null = null;
	let remountListener: (() => void) | null = null;
	let releaseLoad: (() => void) | null = null;
	return {
		calls,
		onResponseChange(callback: (responseId: string, value: unknown) => void) {
			responseListener = callback;
			return () => {
				responseListener = null;
			};
		},
		onRemountRequest(callback: () => void) {
			remountListener = callback;
			return () => {
				remountListener = null;
			};
		},
		onError(callback: (error: Error) => void) {
			errorListener = callback;
			return () => {
				errorListener = null;
			};
		},
		async load() {
			calls.load += 1;
			if (options.loadError) throw options.loadError;
			if (options.holdLoad) {
				// Park until the test releases, so the loading state is observable.
				await new Promise<void>((resolve) => {
					releaseLoad = resolve;
				});
			}
		},
		initialize(dom: HTMLElement) {
			calls.initialize.push(dom);
		},
		async remount() {
			calls.remount += 1;
		},
		getResponse() {
			return null;
		},
		getState() {
			return undefined;
		},
		offerResponse(value: unknown) {
			calls.offerResponse.push(value);
			return true;
		},
		restore() {},
		disable() {
			calls.disable += 1;
		},
		enable() {
			calls.enable += 1;
		},
		destroy() {
			calls.destroy += 1;
		},
		/** Test helpers: act as the module/engine would. */
		reportResponse(value: unknown) {
			responseListener?.('RESPONSE', value);
		},
		emitError(error: Error) {
			errorListener?.(error);
		},
		requestRemount() {
			remountListener?.();
		},
		releaseLoad() {
			releaseLoad?.();
		},
	};
}

type FakeHost = ReturnType<typeof fakeHost>;

/** Wait for the renderer's async load() → initialize() chain to settle. */
async function waitForReady(host: FakeHost, timeoutMs = 2000): Promise<void> {
	const start = Date.now();
	while (host.calls.initialize.length === 0) {
		if (Date.now() - start > timeoutMs) throw new Error('PCI host never reached initialize()');
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	await settle();
}

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('PortableCustomInteraction (pie-qti-portable-custom)', () => {
	test('renders without crashing for a minimal PCI and mounts the module into the sanitized scaffold', async () => {
		// Hold the load so the loading state is deterministic.
		const host = fakeHost({ holdLoad: true });
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			createPciHost: () => host,
		});
		await settle();

		// The group is announced before the module is even loaded.
		const root = q(mounted, '[part="root"]');
		expect(root?.getAttribute('role')).toBe('group');
		expect(root?.getAttribute('aria-label')).toBe('Portable custom interaction');
		expect(q(mounted, '[role="alert"]')).toBeNull();
		expect(q(mounted, '[role="status"]')?.textContent).toContain('Loading');
		expect(q(mounted, '.pci-mount')?.getAttribute('aria-busy')).toBe('true');

		host.releaseLoad();
		await waitForReady(host);

		// Loading happened through the player-owned factory; the module was mounted
		// into the scaffold and the loading status cleared.
		expect(host.calls.load).toBe(1);
		expect(host.calls.initialize).toHaveLength(1);
		expect(q(mounted, '.pci-mount')?.querySelector('.pci-container')).not.toBeNull();
		expect(q(mounted, '[role="status"]')).toBeNull();
		expect(q(mounted, '.pci-mount')?.getAttribute('aria-busy')).toBe('false');
	});

	test('hostile markup in the scaffold is sanitized: handlers and scripts stripped, content kept', async () => {
		const host = fakeHost();
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData({
				markup: '<img src="x" onerror="alert(1)"><div class="pci-container"></div><script>alert(2)</script>',
			}),
			createPciHost: () => host,
		});
		await waitForReady(host);

		const scaffold = q(mounted, '.pci-mount')!;
		expect(scaffold.querySelector('.pci-container')).not.toBeNull();
		const img = scaffold.querySelector('img');
		expect(img).not.toBeNull();
		expect(img?.hasAttribute('onerror')).toBe(false);
		expect(scaffold.querySelector('script')).toBeNull();
	});

	test('an authored accessibility label names the group and the description is referenced', async () => {
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData({
				accessibility: { label: 'Interactive molecule builder', description: 'Drag atoms to build a molecule' },
			}),
			createPciHost: () => fakeHost(),
		});
		await settle();

		const root = q(mounted, '[part="root"]');
		expect(root?.getAttribute('aria-label')).toBe('Interactive molecule builder');
		const describedBy = root?.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(mounted.host.querySelector(`#${CSS.escape(describedBy!)}`)?.textContent).toBe(
			'Drag atoms to build a molecule',
		);
	});

	test('a missing interaction is announced as an alert, and nothing mounts', async () => {
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: undefined,
			createPciHost: () => fakeHost(),
		});
		await settle();

		const alert = q(mounted, '[role="alert"]');
		expect(alert?.textContent).toContain('No interaction data provided');
		expect(q(mounted, '.pci-mount')).toBeNull();
	});

	test('a load failure is announced as an alert with the engine message', async () => {
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			createPciHost: () => fakeHost({ loadError: new Error('Module refused to load') }),
		});
		await settle();

		const alert = q(mounted, '[role="alert"]');
		expect(alert?.textContent).toContain('Module refused to load');
		expect(mounted.instance.response).toBeUndefined();
	});

	test('an asynchronous engine failure reported through onError lands in the alert', async () => {
		const host = fakeHost();
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			createPciHost: () => host,
		});
		await waitForReady(host);
		expect(q(mounted, '[role="alert"]')).toBeNull();

		host.emitError(new Error('Runner frame handshake failed'));
		await settle();

		expect(q(mounted, '[role="alert"]')?.textContent).toContain('Runner frame handshake failed');
	});

	test('module responses propagate: response prop and the composed qti-change event (standalone host)', async () => {
		const module = registeringModule({ base: { string: 'echo-response' } });
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			pci: {
				baseUrl: 'https://cdn.example.com/pci/',
				moduleResolver: async () => {
					// Evaluating the module registers it as a side effect, as in the page realm.
					(
						globalThis as unknown as {
							qtiCustomInteractionContext: { register: (registration: unknown) => void };
						}
					).qtiCustomInteractionContext.register(module.registration);
					return { default: module.registration };
				},
			},
		});

		const start = Date.now();
		while (mounted.events.length === 0) {
			if (Date.now() - start > 2000) throw new Error('no qti-change emitted; module never reported ready');
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		await settle();

		// The module's QTI variable JSON was converted to the runtime value and published
		// through the standard change event a host player listens for.
		expect(mounted.instance.response).toBe('echo-response');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.type).toBe('qti-change');
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 'echo-response' });
		expect(mounted.events[0]!.bubbles).toBe(true);
		expect(mounted.events[0]!.composed).toBe(true);
		// The module received the spec configuration: response id and authored properties.
		expect(module.configurations[0]?.responseIdentifier).toBe('RESPONSE');
		expect(module.configurations[0]?.properties).toEqual({ color: 'blue' });
	});

	test('a player-owned host publishes the response itself: the renderer must not emit qti-change twice', async () => {
		const host = fakeHost();
		const onChange = vi.fn();
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			onChange,
			createPciHost: () => host,
		});
		await waitForReady(host);

		host.reportResponse('module-answer');
		await settle();

		expect(mounted.instance.response).toBe('module-answer');
		expect(onChange).toHaveBeenCalledWith('module-answer');
		// The player-owned host owns publishing; the renderer stays silent on the event.
		expect(mounted.events).toHaveLength(0);
	});

	test('the session value is offered to the host before the module reports, and echoes are skipped', async () => {
		const host = fakeHost();
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			response: 'restored-value',
			createPciHost: () => host,
		});
		await waitForReady(host);

		expect(host.calls.offerResponse).toContain('restored-value');

		// The module reports a new value…
		host.reportResponse('module-answer');
		await settle();
		// …and its own echo of that value must not be offered back into the module.
		expect(host.calls.offerResponse).not.toContain('module-answer');
	});

	test('read-only state: a fresh disabled mount disables the host, an enabled one enables it', async () => {
		const disabledHost = fakeHost();
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			disabled: true,
			createPciHost: () => disabledHost,
		});
		await waitForReady(disabledHost);
		expect(disabledHost.calls.disable).toBeGreaterThanOrEqual(1);
		expect(disabledHost.calls.enable).toBe(0);
		expect(q(mounted, '.pci-mount')).not.toBeNull();

		const enabledHost = fakeHost();
		mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData({ responseId: 'OTHER', responseIdentifier: 'OTHER' }),
			createPciHost: () => enabledHost,
		});
		await waitForReady(enabledHost);
		expect(enabledHost.calls.enable).toBeGreaterThanOrEqual(1);
		expect(enabledHost.calls.disable).toBe(0);
	});

	test('toggling the disabled prop after ready re-forwards the state to the module host', async () => {
		// A candidate finishing the section (read-only review) must reach the module the
		// same way a fresh disabled mount does, and un-readonly must restore operability.
		const host = fakeHost();
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			createPciHost: () => host,
		});
		await waitForReady(host);
		const initialEnables = host.calls.enable;
		expect(initialEnables).toBeGreaterThanOrEqual(1);

		mounted.instance.disabled = true;
		await settle();
		expect(host.calls.disable).toBeGreaterThanOrEqual(1);

		mounted.instance.disabled = false;
		await settle();
		expect(host.calls.enable).toBeGreaterThan(initialEnables);
	});

	test('unmounting destroys the host exactly once', async () => {
		const host = fakeHost();
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			createPciHost: () => host,
		});
		await waitForReady(host);

		cleanupInteraction(mounted);
		expect(host.calls.destroy).toBe(1);
	});

	test('the mount scaffold is reachable by script only and never by Tab', async () => {
		const host = fakeHost({ holdLoad: true });
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			createPciHost: () => host,
		});

		// While loading, exactly one status region announces progress.
		await settle();
		expect(q(mounted, '.pci-mount')?.getAttribute('tabindex')).toBe('-1');
		expect(qa(mounted, '[role="status"]')).toHaveLength(1);

		host.releaseLoad();
		await waitForReady(host);
		expect(qa(mounted, '[role="status"]')).toHaveLength(0);
	});

	test('an authoritative restore rebuilds the scaffold through onRemountRequest', async () => {
		const host = fakeHost();
		const mounted = mountInteraction(PortableCustomInteraction, {
			i18n,
			interaction: pciData(),
			createPciHost: () => host,
		});
		await waitForReady(host);
		expect(q(mounted, '.pci-mount')?.querySelector('.pci-container')).not.toBeNull();

		host.requestRemount();
		await settle();

		// The scaffold was reset and the module re-mounted into the fresh one.
		expect(q(mounted, '.pci-mount')?.querySelector('.pci-container')).not.toBeNull();
		expect(host.calls.remount).toBe(1);
	});

	test('a PCI without any host wiring still renders and announces the secure-default load error', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(PortableCustomInteraction, { interaction: pciData(), i18n });

		const start = Date.now();
		while (!q(mounted, '[role="alert"]')) {
			if (Date.now() - start > 2000) throw new Error('load error was never announced');
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		await settle();

		// The secure-default explanation names the response and the authored path.
		const alert = q(mounted, '[role="alert"]')!.textContent ?? '';
		expect(alert).toContain('RESPONSE');
		expect(alert).toContain('https://cdn.example.com/pci/echo.js');
	});
});
