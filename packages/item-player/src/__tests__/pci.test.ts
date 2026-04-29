import { describe, it, expect, mock } from 'bun:test';
import { PciHost } from '../pci/PciHost.js';
import { PciLoadError } from '../pci/types.js';
import type { ExtractedPci, PciModule } from '../pci/types.js';
import { portableCustomExtractor } from '../extraction/extractors/portableCustomExtractor.js';
import { createExtractionUtils } from '../extraction/index.js';
import { Qti3AttributeNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { parse } from 'node-html-parser';

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
		expect(() => new PciHost(makeData(), 'https://host.example.com')).not.toThrow();
	});

	// ---------------------------------------------------------------------------
	// PciHost.load()
	// ---------------------------------------------------------------------------

	it('load() resolves when dynamic import succeeds with default export', async () => {
		const module = makeModule();
		const host = new PciHost(makeData({ primaryPath: 'https://cdn.example.com/good.js' }), '');

		// Patch import to resolve with default export
		(host as any).resolveUrl = () => 'mocked';
		(host as any).dynamicImport = mock(async (_url: string) => ({ default: module }));

		await host.load();
		// Should not throw — module is loaded
	});

	it('load() falls back to fallbackPath when primary import throws', async () => {
		const module = makeModule();
		const host = new PciHost(makeData(), '');

		let callCount = 0;
		(host as any).dynamicImport = mock(async (_url: string) => {
			callCount++;
			if (callCount === 1) throw new Error('primary failed');
			return { default: module };
		});

		await host.load();
		expect(callCount).toBe(2);
	});

	it('load() throws PciLoadError when both primary and fallback fail', async () => {
		const host = new PciHost(makeData(), '');

		(host as any).dynamicImport = mock(async () => {
			throw new Error('not found');
		});

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
	});

	it('load() throws PciLoadError when only primary fails and no fallback', async () => {
		const host = new PciHost(makeData({ fallbackPath: undefined }), '');

		(host as any).dynamicImport = mock(async () => {
			throw new Error('not found');
		});

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
	});

	it('PciLoadError includes primaryPath and fallbackPath', async () => {
		const data = makeData();
		const host = new PciHost(data, '');

		(host as any).dynamicImport = mock(async () => {
			throw new Error('not found');
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
});
