import { describe, it, expect, mock } from 'bun:test';
import { PciHost } from '../pci/PciHost.js';
import { PciLoadError, PciModuleResolverRequiredError } from '../pci/types.js';
import type { ExtractedPci, PciModule, PciModuleResolver } from '../pci/types.js';
import { portableCustomExtractor } from '../interactions/portable-custom/extractor.js';
import { createExtractionUtils } from '../extraction/index.js';
import { Qti3AttributeNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { parse } from 'node-html-parser';
import { Player } from '../core/Player.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeData(overrides: Partial<ExtractedPci> = {}): ExtractedPci {
	return {
		responseIdentifier: 'RESPONSE',
		customInteractionTypeIdentifier: 'urn:test:echo-pci',
		primaryPath: 'https://cdn.example.com/pci/echo.js',
		fallbackPath: 'https://cdn.example.com/pci/echo-fallback.js',
		markup: '<div class="pci-container"></div>',
		config: { color: 'blue', maxLength: '200' },
		...overrides,
	};
}

function makeModule(overrides: Partial<PciModule> = {}): PciModule {
	return {
		initialize: mock(() => {}),
		getResponse: mock(() => 'test-response'),
		setResponse: mock(() => {}),
		disable: mock(() => {}),
		enable: mock(() => {}),
		destroy: mock(() => {}),
		...overrides,
	};
}

function resolverReturning(module: PciModule): PciModuleResolver {
	return mock(async () => ({ default: module }));
}

/** Fake DOM node (minimal — just needs appendChild) */
function makeDomNode() {
	return {
		appendChild: mock((_el: any) => {}),
	} as any as HTMLElement;
}

// ---------------------------------------------------------------------------
// PciHost — constructor
// ---------------------------------------------------------------------------

describe('PciHost', () => {
	it('instantiates without throwing', () => {
		expect(() =>
			new PciHost(makeData(), {
				baseUrl: 'https://host.example.com',
				moduleResolver: resolverReturning(makeModule()),
			})
		).not.toThrow();
	});

	// ---------------------------------------------------------------------------
	// PciHost.load()
	// ---------------------------------------------------------------------------

	it('load() resolves through the host resolver with a default export', async () => {
		const module = makeModule();
		const resolver = resolverReturning(module);
		const host = new PciHost(makeData({ primaryPath: 'https://cdn.example.com/good.js' }), {
			moduleResolver: resolver,
		});

		await host.load();
		expect(resolver).toHaveBeenCalledWith(
			'https://cdn.example.com/good.js',
			expect.objectContaining({ kind: 'primary', responseIdentifier: 'RESPONSE' })
		);
	});

	it('load() falls back to fallbackPath when primary resolution throws', async () => {
		const module = makeModule();
		let callCount = 0;
		const resolver = mock(async (_url: string) => {
			callCount++;
			if (callCount === 1) throw new Error('primary failed');
			return { default: module };
		});
		const host = new PciHost(makeData(), { moduleResolver: resolver });

		await host.load();
		expect(callCount).toBe(2);
		expect((resolver as any).mock.calls[1][1].kind).toBe('fallback');
	});

	it('load() throws PciLoadError when both primary and fallback fail', async () => {
		const host = new PciHost(makeData(), {
			moduleResolver: async () => {
				throw new Error('not found');
			},
		});

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
	});

	it('load() throws PciLoadError when only primary fails and no fallback', async () => {
		const host = new PciHost(makeData({ fallbackPath: undefined }), {
			moduleResolver: async () => {
				throw new Error('not found');
			},
		});

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
	});

	it('PciLoadError includes primaryPath and fallbackPath', async () => {
		const data = makeData();
		const host = new PciHost(data, {
			moduleResolver: async () => {
				throw new Error('not found');
			},
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
		const host = new PciHost(makeData(), { baseUrl: 'https://host.example.com/items/' });
		await expect(host.load()).rejects.toBeInstanceOf(PciModuleResolverRequiredError);
		await expect(host.load()).rejects.toThrow('moduleResolver');
	});

	it('destroys a module that resolves after its host was destroyed', async () => {
		const module = makeModule();
		let resolveModule: ((value: unknown) => void) | undefined;
		const deferred = new Promise<unknown>((resolve) => {
			resolveModule = resolve;
		});
		const host = new PciHost(makeData(), { moduleResolver: () => deferred });

		const loading = host.load();
		host.destroy();
		resolveModule?.({ default: module });

		await expect(loading).rejects.toThrow('destroyed before its module finished loading');
		expect(module.destroy).toHaveBeenCalledTimes(1);
	});

	// ---------------------------------------------------------------------------
	// PciHost.initialize()
	// ---------------------------------------------------------------------------

	it('initialize() calls module.initialize with dom, config, and boundTo', () => {
		const module = makeModule();
		const host = new PciHost(makeData(), '');
		(host as any).module = module;

		const dom = makeDomNode();
		host.initialize(dom);

		expect(module.initialize).toHaveBeenCalledTimes(1);
		const [calledDom, calledConfig, calledBoundTo] = (module.initialize as any).mock.calls[0];
		expect(calledDom).toBe(dom);
		expect(calledConfig).toEqual({ color: 'blue', maxLength: '200' });
		expect(typeof calledBoundTo.onReady).toBe('function');
		expect(typeof calledBoundTo.onResponseChange).toBe('function');
	});

	it('initialize() is a no-op when module has not been loaded', () => {
		const host = new PciHost(makeData(), '');
		// Should not throw even though module is null
		expect(() => host.initialize(makeDomNode())).not.toThrow();
	});

	it('destroys a module when initialize() throws', () => {
		const module = makeModule({
			initialize: mock(() => {
				throw new Error('initialization failed');
			}),
		});
		const host = new PciHost(makeData());
		(host as any).module = module;

		expect(() => host.initialize(makeDomNode())).toThrow('initialization failed');
		expect(module.destroy).toHaveBeenCalledTimes(1);
		expect((host as any).module).toBeNull();
	});

	// ---------------------------------------------------------------------------
	// PciHost response handling
	// ---------------------------------------------------------------------------

	it('getResponse() delegates to module.getResponse()', () => {
		const module = makeModule({ getResponse: mock(() => 'hello') });
		const host = new PciHost(makeData(), '');
		(host as any).module = module;

		expect(host.getResponse()).toBe('hello');
		expect(module.getResponse).toHaveBeenCalledTimes(1);
	});

	it('setResponse() delegates to module.setResponse()', () => {
		const module = makeModule();
		const host = new PciHost(makeData(), '');
		(host as any).module = module;

		host.setResponse('world');
		expect(module.setResponse).toHaveBeenCalledWith('world');
	});

	it('onResponseChange callback fires when boundTo.onResponseChange is called', () => {
		const module = makeModule();
		const host = new PciHost(makeData(), '');
		(host as any).module = module;

		const received: Array<[string, unknown]> = [];
		host.onResponseChange((id, val) => received.push([id, val]));

		const dom = makeDomNode();
		host.initialize(dom);

		// Simulate PCI calling boundTo.onResponseChange
		const boundTo = (module.initialize as any).mock.calls[0][2];
		boundTo.onResponseChange('answer-42');

		expect(received).toEqual([['RESPONSE', 'answer-42']]);
	});

	// ---------------------------------------------------------------------------
	// PciHost lifecycle
	// ---------------------------------------------------------------------------

	it('disable() delegates to module.disable()', () => {
		const module = makeModule();
		const host = new PciHost(makeData(), '');
		(host as any).module = module;

		host.disable();
		expect(module.disable).toHaveBeenCalledTimes(1);
	});

	it('enable() delegates to module.enable()', () => {
		const module = makeModule();
		const host = new PciHost(makeData(), '');
		(host as any).module = module;

		host.enable();
		expect(module.enable).toHaveBeenCalledTimes(1);
	});

	it('destroy() calls module.destroy() and nullifies module', () => {
		const module = makeModule();
		const host = new PciHost(makeData(), '');
		(host as any).module = module;

		host.destroy();
		expect(module.destroy).toHaveBeenCalledTimes(1);
		expect((host as any).module).toBeNull();
	});

	it('disable/enable/destroy are no-ops before load()', () => {
		const host = new PciHost(makeData(), '');
		expect(() => { host.disable(); host.enable(); host.destroy(); }).not.toThrow();
	});

	// ---------------------------------------------------------------------------
	// URL resolution
	// ---------------------------------------------------------------------------

	it('resolveUrl returns absolute URLs unchanged', () => {
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
// portableCustomExtractor
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

describe('Player PCI integration', () => {
	it('threads resolver config, restores responses, queries getResponse, and tears down', async () => {
		const module = makeModule({ getResponse: mock(() => 'module-answer') });
		const resolver = resolverReturning(module);
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
		expect(module.setResponse).toHaveBeenCalledWith('restored-answer');
		expect(player.getResponses().PCI_RESPONSE).toBe('module-answer');

		player.destroy();
		expect(module.destroy).toHaveBeenCalledTimes(1);
	});
});
