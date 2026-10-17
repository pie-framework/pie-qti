import { describe, it, expect, mock } from 'bun:test';
import { PciHost } from '../pci/PciHost.js';
import {
	createAllowlistPciModuleResolver,
	PciModuleNotAllowedError,
} from '../pci/allowlistResolver.js';
import { installPciRegistry, PCI_REGISTRY_GLOBAL } from '../pci/registry.js';
import { fromQtiVariableJson, toQtiVariableJson } from '../pci/qtiVariableJson.js';
import { PciLoadError, PciModuleResolverRequiredError } from '../pci/types.js';
import type {
	ExtractedPci,
	PciModuleResolver,
	QtiCustomInteractionRegistration,
	QtiPciConfiguration,
	QtiPciInstance,
} from '../pci/types.js';
import { portableCustomExtractor } from '../interactions/portable-custom/extractor.js';
import { createExtractionUtils } from '../extraction/index.js';
import { Qti3AttributeNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { parse } from 'node-html-parser';
import { Player } from '../core/Player.js';
import { createAssessmentItemDefinition } from '../core/AssessmentItemDefinition.js';
import { getItemSessionBinding } from '../core/ItemSession.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeData(overrides: Partial<ExtractedPci> = {}): ExtractedPci {
	return {
		responseIdentifier: 'RESPONSE',
		customInteractionTypeIdentifier: 'urn:test:echo-pci',
		primaryPath: 'https://cdn.example.com/pci/echo.js',
		fallbackPath: 'https://cdn.example.com/pci/echo-fallback.js',
		modules: [],
		markup: '<div class="pci-container"></div>',
		config: { color: 'blue', maxLength: '200' },
		...overrides,
	};
}

function makeInstance(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		getResponse: mock(() => ({ base: { string: 'test-response' } })),
		getState: mock(() => undefined),
		destroy: mock(() => {}),
		...overrides,
	} as unknown as QtiPciInstance & Record<string, ReturnType<typeof mock>>;
}

interface RegistrationFixture {
	registration: QtiCustomInteractionRegistration;
	getInstance: ReturnType<typeof mock>;
	instances: QtiPciInstance[];
	configurations: QtiPciConfiguration[];
	states: unknown[];
}

/** A spec-shaped registration whose getInstance returns a fresh mock instance. */
function makeRegistration(instanceOverrides: Partial<Record<string, unknown>> = {}): RegistrationFixture {
	const instances: QtiPciInstance[] = [];
	const configurations: QtiPciConfiguration[] = [];
	const states: unknown[] = [];
	const getInstance = mock((_dom: HTMLElement, configuration: QtiPciConfiguration, state?: unknown) => {
		configurations.push(configuration);
		states.push(state);
		const instance = makeInstance(instanceOverrides);
		instances.push(instance);
		return instance;
	});
	return {
		registration: { typeIdentifier: 'urn:test:echo-pci', getInstance },
		getInstance,
		instances,
		configurations,
		states,
	};
}

interface RegistryFixture {
	context: { register: (registration: QtiCustomInteractionRegistration) => void };
	observation: ReturnType<typeof installPciRegistry>;
}

/** An isolated registry: the resolver "evaluates" module code that registers into it. */
function makeRegistry(): RegistryFixture {
	const target: Record<string, unknown> = {};
	const observation = installPciRegistry(target);
	return { context: target[PCI_REGISTRY_GLOBAL] as never, observation };
}

/** A resolver standing in for a module evaluation that registers as a side effect. */
function resolverRegistering(
	fixture: RegistryFixture,
	registration: QtiCustomInteractionRegistration
): PciModuleResolver {
	return mock(async () => {
		fixture.context.register(registration);
		return { default: registration };
	});
}

/** Fake DOM node (minimal — just needs appendChild) */
function makeDomNode() {
	return {
		appendChild: mock((_el: any) => {}),
	} as any as HTMLElement;
}

// ---------------------------------------------------------------------------
// PciHost — constructor and load
// ---------------------------------------------------------------------------

describe('PciHost', () => {
	it('instantiates without throwing', () => {
		const registry = makeRegistry();
		expect(
			() =>
				new PciHost(makeData(), {
					baseUrl: 'https://host.example.com',
					moduleResolver: resolverRegistering(registry, makeRegistration().registration),
					registry: registry.observation,
				})
		).not.toThrow();
	});

	it('load() adopts the module registration made as a side effect of evaluation', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const resolver = resolverRegistering(registry, fixture.registration);
		const host = new PciHost(makeData({ primaryPath: 'https://cdn.example.com/good.js' }), {
			moduleResolver: resolver,
			registry: registry.observation,
		});

		await host.load();
		expect(resolver).toHaveBeenCalledWith(
			'https://cdn.example.com/good.js',
			expect.objectContaining({ kind: 'primary', responseIdentifier: 'RESPONSE' })
		);
	});

	it('load() falls back to fallbackPath when primary evaluation throws', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		let callCount = 0;
		const resolver = mock(async (_url: string) => {
			callCount++;
			if (callCount === 1) throw new Error('primary failed');
			registry.context.register(fixture.registration);
			return {};
		});
		const host = new PciHost(makeData(), {
			moduleResolver: resolver,
			registry: registry.observation,
		});

		await host.load();
		expect(callCount).toBe(2);
		expect((resolver as any).mock.calls[1][1].kind).toBe('fallback');
	});

	it('load() throws PciLoadError when both primary and fallback fail', async () => {
		const registry = makeRegistry();
		const host = new PciHost(makeData(), {
			moduleResolver: async () => {
				throw new Error('not found');
			},
			registry: registry.observation,
		});

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
	});

	it('load() throws PciLoadError when only primary fails and no fallback', async () => {
		const registry = makeRegistry();
		const host = new PciHost(makeData({ fallbackPath: undefined }), {
			moduleResolver: async () => {
				throw new Error('not found');
			},
			registry: registry.observation,
		});

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
	});

	it('PciLoadError includes primaryPath and fallbackPath', async () => {
		const registry = makeRegistry();
		const data = makeData();
		const host = new PciHost(data, {
			moduleResolver: async () => {
				throw new Error('not found');
			},
			registry: registry.observation,
		});

		let err: PciLoadError | null = null;
		try {
			await host.load();
		} catch (e) {
			err = e as PciLoadError;
		}

		expect(err).toBeInstanceOf(PciLoadError);
		expect(err!.primaryPath).toBe(data.primaryPath);
		expect(err!.fallbackPath).toBe(data.fallbackPath);
	});

	it('load() refuses authored code when no host resolver is configured', async () => {
		const registry = makeRegistry();
		const host = new PciHost(makeData(), {
			baseUrl: 'https://host.example.com/items/',
			registry: registry.observation,
		});
		await expect(host.load()).rejects.toBeInstanceOf(PciModuleResolverRequiredError);
		await expect(host.load()).rejects.toThrow('moduleResolver');
	});

	it('load() fails when the module evaluates but never registers', async () => {
		const registry = makeRegistry();
		const host = new PciHost(makeData(), {
			moduleResolver: async () => ({}),
			registry: registry.observation,
			registrationTimeoutMs: 10,
		});

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
		await expect(host.load()).rejects.toThrow(/failed to load/);
	});

	it('destroys an in-flight load when the host is destroyed first', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		let resolveModule: (() => void) | undefined;
		const deferred = new Promise<unknown>((resolve) => {
			resolveModule = () => {
				registry.context.register(fixture.registration);
				resolve({});
			};
		});
		const host = new PciHost(makeData(), {
			moduleResolver: () => deferred,
			registry: registry.observation,
		});

		const loading = host.load();
		host.destroy();
		resolveModule?.();

		await expect(loading).rejects.toThrow('destroyed before its module finished loading');
	});

	// ---------------------------------------------------------------------------
	// PciHost.initialize() — the getInstance contract
	// ---------------------------------------------------------------------------

	it('initialize() instantiates through getInstance(dom, configuration, state)', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		await host.load();

		const dom = makeDomNode();
		host.initialize(dom);

		expect(fixture.getInstance).toHaveBeenCalledTimes(1);
		const [calledDom, configuration, state] = fixture.getInstance.mock.calls[0];
		expect(calledDom).toBe(dom);
		expect(configuration.responseIdentifier).toBe('RESPONSE');
		expect(configuration.status).toBe('interacting');
		expect(configuration.properties).toEqual({ color: 'blue', maxLength: '200' });
		expect(typeof configuration.onready).toBe('function');
		expect(typeof configuration.ondone).toBe('function');
		expect(state).toBeUndefined();
	});

	it('initialize() is a no-op when no registration has been loaded', () => {
		const registry = makeRegistry();
		const host = new PciHost(makeData(), { registry: registry.observation });
		expect(() => host.initialize(makeDomNode())).not.toThrow();
	});

	it('instantiates with the status its options derive at instantiation time', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		let status = 'interacting' as const;
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
			status: () => status,
		});
		await host.load();
		host.initialize(makeDomNode());
		expect(fixture.configurations[0].status).toBe('interacting');

		status = 'review';
		await host.remount(makeDomNode());
		expect(fixture.configurations[1].status).toBe('review');
	});

	it('seeds the held response as QTI variable JSON state at getInstance', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
			responseDeclaration: { baseType: 'identifier', cardinality: 'single' },
		});
		host.offerResponse('A');
		await host.load();
		host.initialize(makeDomNode());

		expect(fixture.states[0]).toEqual({ base: { identifier: 'A' } });
	});

	// ---------------------------------------------------------------------------
	// PciHost response handling — QTI variable JSON at the boundary
	// ---------------------------------------------------------------------------

	it('getResponse() converts the module\u2019s QTI variable JSON to the runtime value', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		await host.load();
		host.initialize(makeDomNode());

		expect(host.getResponse()).toBe('test-response');
	});

	it('a response reported through onready becomes the module\u2019s own', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		const received: Array<[string, unknown]> = [];
		host.onResponseChange((id, value) => received.push([id, value]));
		await host.load();
		host.initialize(makeDomNode());

		const configuration = fixture.configurations[0];
		configuration.onready(fixture.instances[0], { seed: 1 });

		expect(received).toEqual([['RESPONSE', 'test-response']]);
		expect(host.offerResponse('anything')).toBe(false);
		expect(host.getState()).toEqual({ seed: 1 });
	});

	it('ondone publishes the final response and captures the module state', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		const received: Array<[string, unknown]> = [];
		host.onResponseChange((id, value) => received.push([id, value]));
		await host.load();
		host.initialize(makeDomNode());

		fixture.configurations[0].ondone(fixture.instances[0], { done: true });

		expect(received).toEqual([['RESPONSE', 'test-response']]);
		expect(host.getState()).toEqual({ done: true });
	});

	it('offerResponse() is declined once the module owns its response', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		await host.load();
		host.initialize(makeDomNode());

		fixture.configurations[0].onready(fixture.instances[0]);

		expect(host.offerResponse('candidate-typed-this')).toBe(false);
		expect(host.offerResponse('something-else')).toBe(false);
		expect(host.getResponse()).toBe('test-response');
	});

	it('restore() rebuilds a mounted module through the remount request, not a setter', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
			responseDeclaration: { baseType: 'string', cardinality: 'single' },
		});
		await host.load();
		host.initialize(makeDomNode());
		fixture.configurations[0].onready(fixture.instances[0]);

		let remountRequests = 0;
		host.onRemountRequest(() => remountRequests++);
		host.restore('authoritative');

		expect(remountRequests).toBe(1);
		expect(fixture.getInstance).toHaveBeenCalledTimes(1);
		expect(host.getResponse()).toBe('authoritative');

		await host.remount(makeDomNode());
		expect(fixture.getInstance).toHaveBeenCalledTimes(2);
		expect(fixture.states[1]).toEqual({ base: { string: 'authoritative' } });
		expect(fixture.instances[0].destroy).toHaveBeenCalledTimes(1);
	});

	it('restore() without a renderer re-instantiates the module on the last mount node', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
			responseDeclaration: { baseType: 'string', cardinality: 'single' },
		});
		await host.load();
		const dom = makeDomNode();
		host.initialize(dom);
		fixture.configurations[0].onready(fixture.instances[0]);

		host.restore('from-session');

		expect(fixture.getInstance).toHaveBeenCalledTimes(2);
		expect(fixture.states[1]).toEqual({ base: { string: 'from-session' } });
		expect(fixture.instances[0].destroy).toHaveBeenCalledTimes(1);
	});

	it('restore() before mount holds the value for instantiation and requests no rebuild', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
			responseDeclaration: { baseType: 'string', cardinality: 'single' },
		});
		let remountRequests = 0;
		host.onRemountRequest(() => remountRequests++);

		host.restore('from-session');
		expect(remountRequests).toBe(0);

		await host.load();
		host.initialize(makeDomNode());
		expect(fixture.states[0]).toEqual({ base: { string: 'from-session' } });
	});

	it('remount() discards the old instance and resolves the registration again', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});

		await host.load();
		host.initialize(makeDomNode());
		await host.remount(makeDomNode());

		expect(fixture.getInstance).toHaveBeenCalledTimes(2);
		expect(fixture.instances[0].destroy).toHaveBeenCalledTimes(1);
	});

	it('remount() refuses a destroyed host', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		await host.load();
		host.destroy();
		await expect(host.remount(makeDomNode())).rejects.toThrow('destroyed');
	});

	it('getState() answers the live module state, then the last captured state', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration({
			getState: mock(() => ({ position: 3 })),
		});
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		await host.load();

		expect(host.getState()).toBeUndefined();
		host.initialize(makeDomNode());
		expect(host.getState()).toEqual({ position: 3 });

		host.destroy();
		expect(host.getState()).toEqual({ position: 3 });
	});

	// ---------------------------------------------------------------------------
	// PciHost lifecycle
	// ---------------------------------------------------------------------------

	it('disable/enable reach the instance only when it exposes them', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		await host.load();
		host.initialize(makeDomNode());

		expect(() => {
			host.disable();
			host.enable();
		}).not.toThrow();
	});

	it('destroy() calls the instance destroy and clears listeners', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData(), {
			moduleResolver: resolverRegistering(registry, fixture.registration),
			registry: registry.observation,
		});
		await host.load();
		host.initialize(makeDomNode());

		host.destroy();
		expect(fixture.instances[0].destroy).toHaveBeenCalledTimes(1);
		expect(() => host.destroy()).not.toThrow();
	});

	it('disable/enable/destroy are no-ops before load()', () => {
		const registry = makeRegistry();
		const host = new PciHost(makeData(), { registry: registry.observation });
		expect(() => {
			host.disable();
			host.enable();
			host.destroy();
		}).not.toThrow();
	});

	// ---------------------------------------------------------------------------
	// URL resolution
	// ---------------------------------------------------------------------------

	it('resolveUrl returns absolute URLs unchanged', () => {
		const registry = makeRegistry();
		const host = new PciHost(makeData(), 'https://base.example.com/items/');
		expect((host as any).resolveUrl('https://cdn.example.com/pci.js')).toBe('https://cdn.example.com/pci.js');
		expect((host as any).resolveUrl('/absolute/path.js')).toBe('/absolute/path.js');
	});

	it('resolveUrl prepends baseUrl for relative paths', () => {
		const host = new PciHost(makeData(), 'https://base.example.com/items/');
		expect((host as any).resolveUrl('pci/echo.js')).toBe('https://base.example.com/items/pci/echo.js');
	});

	it('resolveUrl adds trailing slash to baseUrl if missing', () => {
		const host = new PciHost(makeData(), 'https://base.example.com/items');
		expect((host as any).resolveUrl('pci/echo.js')).toBe('https://base.example.com/items/pci/echo.js');
	});
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('installPciRegistry', () => {
	it('delivers registrations to whenRegistered observers', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const pending = registry.observation.whenRegistered('urn:test:echo-pci');
		registry.context.register(fixture.registration);
		await expect(pending).resolves.toBe(fixture.registration);
		expect(registry.observation.registeredTypes()).toEqual(['urn:test:echo-pci']);
	});

	it('resolves immediately for an already-registered type', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		registry.context.register(fixture.registration);
		await expect(registry.observation.whenRegistered('urn:test:echo-pci')).resolves.toBe(
			fixture.registration
		);
	});

	it('ignores registrations that are not spec-shaped', () => {
		const registry = makeRegistry();
		registry.context.register({} as QtiCustomInteractionRegistration);
		registry.context.register({ typeIdentifier: '', getInstance: () => {} });
		expect(registry.observation.registeredTypes()).toEqual([]);
	});

	it('preserves a context the page already had', async () => {
		const previousRegistrations: string[] = [];
		const target: Record<string, unknown> = {
			[PCI_REGISTRY_GLOBAL]: {
				register: (registration: QtiCustomInteractionRegistration) => {
					previousRegistrations.push(registration.typeIdentifier);
				},
			},
		};
		const observation = installPciRegistry(target);
		const fixture = makeRegistration();
		const context = target[PCI_REGISTRY_GLOBAL] as { register: (r: QtiCustomInteractionRegistration) => void };
		context.register(fixture.registration);

		expect(previousRegistrations).toEqual(['urn:test:echo-pci']);
		await expect(observation.whenRegistered('urn:test:echo-pci')).resolves.toBe(fixture.registration);
	});
});

// ---------------------------------------------------------------------------
// QTI variable JSON
// ---------------------------------------------------------------------------

describe('qtiVariableJson', () => {
	it('converts single, multiple and record runtime values to variable JSON', () => {
		expect(toQtiVariableJson('A', 'identifier', 'single')).toEqual({ base: { identifier: 'A' } });
		expect(toQtiVariableJson(['A', 'B'], 'identifier', 'multiple')).toEqual({
			list: { identifier: ['A', 'B'] },
		});
		expect(toQtiVariableJson(['A', 'B'], 'identifier', 'ordered')).toEqual({
			list: { identifier: ['A', 'B'] },
		});
		expect(toQtiVariableJson({ score: 1, text: 'why' }, undefined, 'record')).toEqual({
			record: { score: { base: { integer: 1 } }, text: { base: { string: 'why' } } },
		});
		expect(toQtiVariableJson(null, 'string', 'single')).toBeNull();
	});

	it('converts variable JSON back to runtime values and round-trips', () => {
		expect(fromQtiVariableJson({ base: { identifier: 'A' } })).toBe('A');
		expect(fromQtiVariableJson({ list: { identifier: ['A', 'B'] } })).toEqual(['A', 'B']);
		expect(
			fromQtiVariableJson({ record: { a: { base: { integer: 1 } }, b: { base: { string: 'x' } } } })
		).toEqual({ a: 1, b: 'x' });
		expect(fromQtiVariableJson(null)).toBeNull();
		expect(fromQtiVariableJson('plain')).toBe('plain');

		const value = ['A', 'B'];
		expect(fromQtiVariableJson(toQtiVariableJson(value, 'identifier', 'multiple'))).toEqual(value);
	});
});

// ---------------------------------------------------------------------------
// createAllowlistPciModuleResolver
// ---------------------------------------------------------------------------

const PCI_XML = `
<qti-portable-custom-interaction
  response-identifier="PCI_RESPONSE"
  custom-interaction-type-identifier="urn:example:echo-pci">
  <qti-interaction-modules>
    <qti-interaction-module
      id="echoModule"
      primary-path="pci/echo.js"
      fallback-path="pci/echo-fallback.js"/>
  </qti-interaction-modules>
  <qti-interaction-markup>
    <div class="echo-container">Enter text here</div>
  </qti-interaction-markup>
  <qti-pci-properties>
    <qti-pci-property key="theme" value="light"/>
    <qti-pci-property key="maxLength" value="500"/>
  </qti-pci-properties>
</qti-portable-custom-interaction>
`;

const QTI2_PCI_ITEM = `
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:pci="http://www.imsglobal.org/xsd/portableCustomInteraction"
  identifier="pci-2" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="PCI_RESPONSE" cardinality="single" baseType="string"/>
  <itemBody>
    <customInteraction responseIdentifier="PCI_RESPONSE" id="echo">
      <pci:portableCustomInteraction customInteractionIdentifierType="urn:example:qti2-echo">
        <pci:instance>
          <script type="text/javascript" src="pci/qti2-echo.js"></script>
          <script type="text/javascript">window.shouldNeverRun = true;</script>
          <div class="qti2-echo-container">Enter text here</div>
        </pci:instance>
      </pci:portableCustomInteraction>
    </customInteraction>
  </itemBody>
</assessmentItem>`;

const QTI3_PCI_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="pci-3" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="PCI_RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>${PCI_XML}</qti-item-body>
</qti-assessment-item>`;

const ORDINARY_CUSTOM_ITEM = `
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="custom" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CUSTOM_RESPONSE" cardinality="single" baseType="string"/>
  <itemBody>
    <customInteraction responseIdentifier="CUSTOM_RESPONSE" class="vendor-control">
      <prompt>Vendor interaction</prompt>
      <vendorControl />
    </customInteraction>
  </itemBody>
</assessmentItem>`;

function parseEl(xml: string) {
	const doc = parse(xml.trim(), { lowerCaseTagName: false, comment: false });
	return (doc.firstChild ?? doc) as any;
}

function makeContext(el: any) {
	const utils = createExtractionUtils(undefined, new Qti3ElementNameMapper(), new Qti3AttributeNameMapper());
	return { element: el, responseId: 'PCI_RESPONSE', dom: el, declarations: new Map(), utils, config: {} as any };
}

describe('createAllowlistPciModuleResolver', () => {
	function resolverWith(
		options: Partial<Parameters<typeof createAllowlistPciModuleResolver>[0]> = {}
	) {
		const importModule = mock(async () => ({}));
		return {
			importModule,
			resolver: createAllowlistPciModuleResolver({
				allowedOrigins: ['https://cdn.example.com'],
				importModule,
				...options,
			}),
		};
	}

	const context = {
		authoredPath: 'pci/echo.js',
		kind: 'primary' as const,
		responseIdentifier: 'RESPONSE',
		customInteractionTypeIdentifier: 'urn:test:echo',
	};

	it('throws when the allow-list is empty', () => {
		expect(() => createAllowlistPciModuleResolver({})).toThrow('allowedOrigins');
		expect(() =>
			createAllowlistPciModuleResolver({ allowedOrigins: [], allowedPathPrefixes: [] })
		).toThrow('allowedOrigins');
	});

	it('rejects a non-absolute origin or prefix at construction', () => {
		expect(() => createAllowlistPciModuleResolver({ allowedOrigins: ['cdn.example.com'] })).toThrow(
			'absolute URL'
		);
		expect(() =>
			createAllowlistPciModuleResolver({ allowedPathPrefixes: ['/pci/'] })
		).toThrow('absolute URL');
		expect(() =>
			createAllowlistPciModuleResolver({ allowedOrigins: ['file:///etc/'] })
		).toThrow('http(s)');
	});

	it('imports a module from an allow-listed origin', async () => {
		const { resolver, importModule } = resolverWith();
		await resolver('https://cdn.example.com/pci/echo.js', context);
		expect(importModule).toHaveBeenCalledWith('https://cdn.example.com/pci/echo.js', context);
	});

	it('refuses an origin that is not allow-listed', async () => {
		const { resolver, importModule } = resolverWith();
		await expect(resolver('https://evil.example.com/pci/echo.js', context)).rejects.toBeInstanceOf(
			PciModuleNotAllowedError
		);
		expect(importModule).not.toHaveBeenCalled();
	});

	it('refuses non-http(s) schemes regardless of configuration', async () => {
		const { resolver } = resolverWith();
		for (const url of [
			'data:text/javascript,globalThis.pwned=1',
			'javascript:globalThis.pwned=1',
			'blob:https://cdn.example.com/abc',
		]) {
			await expect(resolver(url, context)).rejects.toThrow('not http(s)');
		}
	});

	it('refuses an unresolved relative authored path and names the fix', async () => {
		const { resolver } = resolverWith();
		await expect(resolver('pci/echo.js', context)).rejects.toThrow('baseUrl');
	});

	it('enforces path prefixes against the normalized href so traversal cannot escape', async () => {
		const { resolver, importModule } = resolverWith({
			allowedPathPrefixes: ['https://cdn.example.com/pci/'],
		});

		await resolver('https://cdn.example.com/pci/echo.js', context);
		expect(importModule).toHaveBeenCalledTimes(1);

		await expect(
			resolver('https://cdn.example.com/pci/../secrets/token.js', context)
		).rejects.toBeInstanceOf(PciModuleNotAllowedError);
		expect(importModule).toHaveBeenCalledTimes(1);
	});

	it('requires both origin and prefix when both are configured', async () => {
		const { resolver } = resolverWith({
			allowedOrigins: ['https://cdn.example.com'],
			allowedPathPrefixes: ['https://other.example.com/pci/'],
		});
		await expect(resolver('https://cdn.example.com/pci/echo.js', context)).rejects.toThrow(
			'path prefix'
		);
	});

	it('drives a PciHost end to end when the module registers from an allow-listed origin', async () => {
		const registry = makeRegistry();
		const fixture = makeRegistration();
		const host = new PciHost(makeData({ fallbackPath: undefined }), {
			moduleResolver: createAllowlistPciModuleResolver({
				allowedOrigins: ['https://cdn.example.com'],
				importModule: async () => {
					registry.context.register(fixture.registration);
					return {};
				},
			}),
			registry: registry.observation,
		});

		await host.load();
		host.initialize(makeDomNode());
		expect(fixture.getInstance).toHaveBeenCalledTimes(1);
	});

	it('surfaces a refusal as PciLoadError once the fallback is also refused', async () => {
		const registry = makeRegistry();
		const host = new PciHost(
			makeData({
				primaryPath: 'https://evil.example.com/a.js',
				fallbackPath: 'https://evil.example.com/b.js',
			}),
			{
				moduleResolver: createAllowlistPciModuleResolver({
					allowedOrigins: ['https://cdn.example.com'],
					importModule: async () => ({}),
				}),
				registry: registry.observation,
			}
		);

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
	});
});

// ---------------------------------------------------------------------------
// portableCustomExtractor
// ---------------------------------------------------------------------------

describe('portableCustomExtractor', () => {
	it('canHandle returns true for qti-portable-custom-interaction', () => {
		const el = parseEl(PCI_XML);
		expect(portableCustomExtractor.canHandle(el, makeContext(el))).toBe(true);
	});

	it('canHandle returns false for qti-choice-interaction', () => {
		const el = parseEl('<qti-choice-interaction response-identifier="R" max-choices="1"/>');
		expect(portableCustomExtractor.canHandle(el, makeContext(el))).toBe(false);
	});

	it('extracts responseIdentifier', () => {
		const el = parseEl(PCI_XML);
		const data = portableCustomExtractor.extract(el, makeContext(el));
		expect(data.responseIdentifier).toBe('PCI_RESPONSE');
	});

	it('extracts customInteractionTypeIdentifier', () => {
		const el = parseEl(PCI_XML);
		const data = portableCustomExtractor.extract(el, makeContext(el));
		expect(data.customInteractionTypeIdentifier).toBe('urn:example:echo-pci');
	});

	it('extracts primaryPath from qti-interaction-module', () => {
		const el = parseEl(PCI_XML);
		const data = portableCustomExtractor.extract(el, makeContext(el));
		expect(data.primaryPath).toBe('pci/echo.js');
	});

	it('extracts fallbackPath from qti-interaction-module', () => {
		const el = parseEl(PCI_XML);
		const data = portableCustomExtractor.extract(el, makeContext(el));
		expect(data.fallbackPath).toBe('pci/echo-fallback.js');
	});

	it('extracts markup from qti-interaction-markup', () => {
		const el = parseEl(PCI_XML);
		const data = portableCustomExtractor.extract(el, makeContext(el));
		expect(data.markup).toContain('echo-container');
	});

	it('extracts config key/value pairs from qti-pci-properties', () => {
		const el = parseEl(PCI_XML);
		const data = portableCustomExtractor.extract(el, makeContext(el));
		expect(data.config.theme).toBe('light');
		expect(data.config.maxLength).toBe('500');
	});

	it('validate returns invalid when primaryPath is empty', () => {
		const result = portableCustomExtractor.validate!({
			responseIdentifier: 'R',
			customInteractionTypeIdentifier: 'urn:x',
			primaryPath: '',
			markup: '',
			config: {},
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toBeDefined();
	});

	it('validate returns valid for a well-formed ExtractedPci', () => {
		const el = parseEl(PCI_XML);
		const data = portableCustomExtractor.extract(el, makeContext(el));
		const result = portableCustomExtractor.validate!(data);
		expect(result.valid).toBe(true);
	});

	it('has higher priority than standardCustomExtractor (10)', () => {
		expect(portableCustomExtractor.priority).toBeGreaterThan(10);
	});

	it('discovers a QTI 2.x PCI nested in customInteraction', () => {
		const interaction = new Player({ itemXml: QTI2_PCI_ITEM }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('portableCustomInteraction');
		expect(interaction.responseId).toBe('PCI_RESPONSE');
		expect(interaction.responseIdentifier).toBe('PCI_RESPONSE');
		expect(interaction.customInteractionTypeIdentifier).toBe('urn:example:qti2-echo');
		expect(interaction.primaryPath).toBe('pci/qti2-echo.js');
		expect(interaction.markup).toContain('qti2-echo-container');
		expect(interaction.markup).not.toContain('<script');
		expect(interaction.markup).not.toContain('shouldNeverRun');
	});

	it('routes a native QTI 3.0 PCI through the production extraction inventory', () => {
		const interaction = new Player({ itemXml: QTI3_PCI_ITEM }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('portableCustomInteraction');
		expect(interaction.primaryPath).toBe('pci/echo.js');
		expect(interaction.fallbackPath).toBe('pci/echo-fallback.js');
	});

	it('preserves the ordinary customInteraction fallback path', () => {
		const interaction = new Player({ itemXml: ORDINARY_CUSTOM_ITEM }).getInteractionData()[0] as any;

		expect(interaction.type).toBe('customInteraction');
		expect(interaction.responseId).toBe('CUSTOM_RESPONSE');
		expect(interaction.rawAttributes.class).toBe('vendor-control');
	});
});

// ---------------------------------------------------------------------------
// Player PCI integration
// ---------------------------------------------------------------------------

describe('Player PCI integration', () => {
	/** Module "code" that registers against the page's shared registry, as authored PCIs do. */
	function playerResolver(): PciModuleResolver {
		return mock(async () => {
			const context = (globalThis as any)[PCI_REGISTRY_GLOBAL];
			context?.register({
				typeIdentifier: 'urn:example:echo-pci',
				getInstance: (_dom: HTMLElement, configuration: QtiPciConfiguration) => {
					lastConfiguration = configuration;
					return makeInstance({ getResponse: mock(() => ({ base: { string: 'module-answer' } })) });
				},
			});
			return {};
		});
	}
	let lastConfiguration: QtiPciConfiguration | undefined;

	it('threads resolver config, seeds restored responses at getInstance, and tears down', async () => {
		const resolver = playerResolver();
		const player = new Player({
			itemXml: QTI3_PCI_ITEM,
			pci: {
				baseUrl: 'https://packages.example/items/item-1/',
				moduleResolver: resolver,
			},
		});
		const interaction = player.getInteractionData()[0] as ExtractedPci;
		const host = player.createPciHost(interaction);

		player.setResponses({ PCI_RESPONSE: 'restored-answer' });
		await host.load();
		host.initialize(makeDomNode());

		expect(resolver).toHaveBeenCalledWith(
			'https://packages.example/items/item-1/pci/echo.js',
			expect.objectContaining({ kind: 'primary', responseIdentifier: 'PCI_RESPONSE' })
		);
		// The restored value reached the module as QTI variable JSON state.
		expect(lastConfiguration?.responseIdentifier).toBe('PCI_RESPONSE');
		expect(lastConfiguration?.status).toBe('interacting');
		expect(host.getResponse()).toBe('module-answer');

		player.destroy();
	});

	it('does not feed a PCI its own reported response back through setResponses', async () => {
		const resolver = playerResolver();
		const player = new Player({
			itemXml: QTI3_PCI_ITEM,
			pci: { moduleResolver: resolver },
		});
		const host = player.createPciHost(player.getInteractionData()[0] as ExtractedPci);
		await host.load();
		host.initialize(makeDomNode());

		// The module reports through onready, as conformant modules do.
		lastConfiguration?.onready(
			(host as any).instance as QtiPciInstance,
			undefined
		);

		// Every candidate change reaches the player this way, a PCI's own included.
		player.setResponses({ PCI_RESPONSE: 'module-answer' });

		expect(host.getResponse()).toBe('module-answer');
		expect(host.offerResponse('echo')).toBe(false);

		player.destroy();
	});

	it('restoreResponses() rebuilds the module from the override', async () => {
		const resolver = playerResolver();
		const player = new Player({
			itemXml: QTI3_PCI_ITEM,
			pci: { moduleResolver: resolver },
		});
		const host = player.createPciHost(player.getInteractionData()[0] as ExtractedPci);
		await host.load();
		host.initialize(makeDomNode());

		let remountRequests = 0;
		host.onRemountRequest(() => remountRequests++);
		player.restoreResponses({ PCI_RESPONSE: 'host-override' });

		expect(remountRequests).toBe(1);
		await host.remount(makeDomNode());
		expect(host.getResponse()).toBe('module-answer');

		player.destroy();
	});

	it('a session round-trip through dispatch leaves module state untouched', async () => {
		const resolver = playerResolver();
		const session = createAssessmentItemDefinition({
			itemXml: QTI3_PCI_ITEM,
			pci: { moduleResolver: resolver },
		}).openSession();
		const interactionNode = session
			.present()
			.flow.find((node) => node.kind === 'interaction');
		if (!interactionNode) throw new Error('Expected a PCI interaction mount');
		const host = getItemSessionBinding(session).createPciHost(
			interactionNode.mount.interaction as unknown as ExtractedPci,
		);

		await host.load();
		host.initialize(makeDomNode());
		const configuration = lastConfiguration;
		configuration?.onready((host as any).instance as QtiPciInstance, undefined);

		session.dispatch({
			action: 'setResponse',
			responseIdentifier: 'PCI_RESPONSE',
			value: 'module-answer',
		});

		expect(host.offerResponse('echo')).toBe(false);
		session.dispose();
	});

	it('ignores late PCI response events after the authoritative session closes', async () => {
		const resolver = playerResolver();
		const session = createAssessmentItemDefinition({
			itemXml: QTI3_PCI_ITEM,
			pci: { moduleResolver: resolver },
		}).openSession({ responses: { PCI_RESPONSE: 'submitted-answer' } });
		const interactionNode = session
			.present()
			.flow.find((node) => node.kind === 'interaction');
		if (!interactionNode) throw new Error('Expected a PCI interaction mount');
		const host = getItemSessionBinding(session).createPciHost(
			interactionNode.mount.interaction as unknown as ExtractedPci,
		);
		const revisions: number[] = [];
		session.subscribe(({ current }) => revisions.push(current.revision));

		await host.load();
		host.initialize(makeDomNode());
		session.dispatch({ action: 'endAttempt' });
		const revisionAfterClose = session.state().revision;
		const configuration = lastConfiguration;
		configuration?.onready((host as any).instance as QtiPciInstance, undefined);

		expect(session.state().responses.PCI_RESPONSE).toBe('submitted-answer');
		expect(session.state().revision).toBe(revisionAfterClose);
		expect(revisions).toEqual([revisionAfterClose]);
		session.dispose();
	});
});
