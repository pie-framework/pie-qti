import { describe, it, expect, mock } from 'bun:test';
import { createAmdLoader } from '../pci/amdLoader.js';
import {
	DEFAULT_RESOLUTION_CONFIG_PATHS,
	emptyResolutionConfig,
	parseModuleResolutionConfig,
} from '../pci/resolutionConfig.js';
import { installPciRegistry, PCI_REGISTRY_GLOBAL } from '../pci/registry.js';
import { PciHost } from '../pci/PciHost.js';
import { PciLoadError } from '../pci/types.js';
import type { ExtractedPci, QtiPciConfiguration } from '../pci/types.js';
import { portableCustomExtractor } from '../interactions/portable-custom/extractor.js';
import { createExtractionUtils } from '../extraction/index.js';
import { Qti3AttributeNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { parse } from 'node-html-parser';

// ---------------------------------------------------------------------------
// Resolution config
// ---------------------------------------------------------------------------

describe('parseModuleResolutionConfig', () => {
	it('parses the RequireJS shape, taking the first of a path list', () => {
		const config = parseModuleResolutionConfig({
			waitSeconds: 60,
			urlArgs: 'v=2',
			paths: {
				jquery: 'https://code.jquery.com/jquery-2.2.2.min',
				eve: ['modules/lib/eve', 'https://cdn.example.com/eve.js'],
			},
			shim: { eve: { deps: ['jquery'] }, raphael: { exports: 'Raphael' } },
		});
		expect(config.waitSeconds).toBe(60);
		expect(config.urlArgs).toBe('v=2');
		expect(config.paths.jquery).toBe('https://code.jquery.com/jquery-2.2.2.min');
		expect(config.paths.eve).toBe('modules/lib/eve');
		expect(config.shim.eve?.deps).toEqual(['jquery']);
		expect(config.shim.raphael?.exports).toBe('Raphael');
	});

	it('parses a JSON string and tolerates garbage', () => {
		expect(parseModuleResolutionConfig('{"paths":{"a":"a.js"}}').paths.a).toBe('a.js');
		expect(parseModuleResolutionConfig('not json')).toEqual(emptyResolutionConfig());
		expect(parseModuleResolutionConfig(undefined)).toEqual(emptyResolutionConfig());
		expect(parseModuleResolutionConfig([1, 2])).toEqual(emptyResolutionConfig());
	});

	it('drops malformed path and shim entries', () => {
		const config = parseModuleResolutionConfig({
			paths: { good: 'good.js', '': 'x.js', bad: 42 },
			shim: { good: { deps: ['a', 3], exports: 'G' }, bad: 'nope' },
		});
		expect(Object.keys(config.paths)).toEqual(['good']);
		expect(config.shim.good?.deps).toEqual(['a']);
		expect(Object.keys(config.shim)).toEqual(['good']);
	});
});

// ---------------------------------------------------------------------------
// AMD loader
// ---------------------------------------------------------------------------

/** An in-memory module world: id → code, evaluated through the loader's own globals. */
function makeModuleWorld(files: Record<string, string>, config = emptyResolutionConfig()) {
	const loadedUrls: string[] = [];
	const evaluate = mock(async (resolvedUrl: string) => {
		loadedUrls.push(resolvedUrl);
		const path = resolvedUrl.replace(/^https?:\/\/pkg\.example\//, '').split('?')[0];
		const code = files[path];
		if (code === undefined) throw new Error(`module not found: ${path}`);
		// Real browsers execute an imported file against the global scope, where
		// the loader's `define`/`require` live; new Function approximates that.
		const run = new Function('define', 'require', code);
		run(
			(globalThis as Record<string, unknown>).define,
			(globalThis as Record<string, unknown>).require
		);
		return {};
	});
	const loader = createAmdLoader({
		baseUrl: 'https://pkg.example/',
		config,
		evaluate,
		resolveUrl: (path) => `https://pkg.example/${path}`,
	});
	return { loader, evaluate, loadedUrls };
}

describe('createAmdLoader', () => {
	it('installs and restores the page define/require', () => {
		const { loader } = makeModuleWorld({});
		const existing = (globalThis as Record<string, unknown>).define;
		loader.install();
		expect(typeof (globalThis as Record<string, unknown>).define).toBe('function');
		loader.dispose();
		expect((globalThis as Record<string, unknown>).define).toBe(existing);
	});

	it('wires define dependencies by id through the paths map', async () => {
		const { loader } = makeModuleWorld({
			'modules/lib/eve.js': `define('eve', [], function () { return { name: 'eve' }; });`,
			'modules/entry.js': `define('entry', ['eve'], function (eve) { globalThis.__entryDep = eve.name; return {}; });`,
		});
		loader.addPaths({ eve: 'modules/lib/eve.js', entry: 'modules/entry.js' });
		loader.install();
		try {
			await loader.load(['entry']);
			expect((globalThis as Record<string, unknown>).__entryDep).toBe('eve');
		} finally {
			loader.dispose();
			delete (globalThis as Record<string, unknown>).__entryDep;
		}
	});

	it('resolves an anonymous define to the module being loaded', async () => {
		const { loader } = makeModuleWorld({
			'anon.js': `define([], function () { return { anon: true }; });`,
			'main.js': `define('main', ['anon'], function (anon) { globalThis.__anonValue = anon; return {}; });`,
		});
		loader.addPaths({ anon: 'anon.js', main: 'main.js' });
		loader.install();
		try {
			await loader.load(['anon', 'main']);
			expect((globalThis as Record<string, unknown>).__anonValue).toEqual({ anon: true });
		} finally {
			loader.dispose();
			delete (globalThis as Record<string, unknown>).__anonValue;
		}
	});

	it('shims a plain global script and loads its shim dependencies', async () => {
		const config = emptyResolutionConfig();
		config.paths.plain = 'libs/plain.js';
		config.shim.plain = { deps: [], exports: '__PlainLib' };
		const { loader } = makeModuleWorld(
			{ 'libs/plain.js': `globalThis.__PlainLib = { version: 7 };` },
			config
		);
		loader.install();
		try {
			await loader.load(['plain']);
			const plain = await new Promise<unknown>((resolve) => {
				const requireFn = (globalThis as Record<string, unknown>).require as (
					deps: string[],
					ready: (value: unknown) => void
				) => void;
				requireFn(['plain'], resolve);
			});
			expect(plain).toEqual({ version: 7 });
		} finally {
			loader.dispose();
			delete (globalThis as Record<string, unknown>).__PlainLib;
		}
	});

	it('serves the exports object to CommonJS-style factories', async () => {
		const { loader } = makeModuleWorld({
			'cjs.js': `define('cjs', ['exports'], function (exports) { exports.value = 41; });`,
			'main.js': `define('main', ['cjs'], function (cjs) { globalThis.__cjsValue = cjs.value; return {}; });`,
		});
		loader.addPaths({ cjs: 'cjs.js', main: 'main.js' });
		loader.install();
		try {
			await loader.load(['cjs', 'main']);
			expect((globalThis as Record<string, unknown>).__cjsValue).toBe(41);
		} finally {
			loader.dispose();
			delete (globalThis as Record<string, unknown>).__cjsValue;
		}
	});

	it('propagates evaluation failures so the host can fall back', async () => {
		const { loader } = makeModuleWorld({});
		loader.addPaths({ missing: 'missing.js' });
		loader.install();
		try {
			const outcome = await loader.load(['missing']).then(
				() => 'loaded',
				(error: unknown) => (error as Error).message
			);
			expect(outcome).toContain('module not found');
		} finally {
			loader.dispose();
		}
	});

	it('applies urlArgs to resolved module URLs', async () => {
		const files = { 'm.js': `define('m', [], function () { return {}; });` };
		const loadedUrls: string[] = [];
		const loader = createAmdLoader({
			baseUrl: 'https://pkg.example/',
			config: { ...emptyResolutionConfig(), urlArgs: 'v=9' },
			evaluate: async (resolvedUrl) => {
				loadedUrls.push(resolvedUrl);
				const path = resolvedUrl.split('/').pop()!.split('?')[0];
				new Function('define', 'require', files[path] ?? '')(
					(globalThis as Record<string, unknown>).define,
					(globalThis as Record<string, unknown>).require
				);
				return {};
			},
			resolveUrl: (path) => `https://pkg.example/${path}`,
		});
		loader.addPaths({ m: 'm.js' });
		loader.install();
		try {
			await loader.load(['m']);
			expect(loadedUrls[0]).toBe('https://pkg.example/m.js?v=9');
		} finally {
			loader.dispose();
		}
	});
});

// ---------------------------------------------------------------------------
// Extraction: multi-module declarations
// ---------------------------------------------------------------------------

const MULTI_MODULE_XML = `
<qti-portable-custom-interaction
  response-identifier="PCI_RESPONSE"
  custom-interaction-type-identifier="urn:fdc:example.com:2019:pci:shading_deps">
  <qti-interaction-modules>
    <qti-interaction-module id="jquery" primary-path="https://code.jquery.com/jquery-2.2.3.min"/>
    <qti-interaction-module id="eve" primary-path="modules/lib/eve.js"/>
    <qti-interaction-module id="raphael" primary-path="modules/lib/raphael.js"/>
    <qti-interaction-module id="shading_deps" primary-path="modules/shading_deps.js" fallback-path="modules/shading_deps_fallback.js"/>
  </qti-interaction-modules>
  <qti-interaction-markup><div class="grid"></div></qti-interaction-markup>
</qti-portable-custom-interaction>`;

const CONFIGURED_XML = `
<qti-portable-custom-interaction
  response-identifier="PCI_RESPONSE"
  custom-interaction-type-identifier="urn:fdc:example.com:2019:pci:shading">
  <qti-interaction-modules primary-configuration="modules/module_resolution.js">
    <qti-interaction-module id="shading"/>
  </qti-interaction-modules>
  <qti-interaction-markup></qti-interaction-markup>
</qti-portable-custom-interaction>`;

function parseEl(xml: string) {
	const doc = parse(xml.trim(), { lowerCaseTagName: false, comment: false });
	return (doc.firstChild ?? doc) as any;
}

function makeContext(el: any) {
	const utils = createExtractionUtils(undefined, new Qti3ElementNameMapper(), new Qti3AttributeNameMapper());
	return { element: el, responseId: 'PCI_RESPONSE', dom: el, declarations: new Map(), utils, config: {} as any };
}

describe('multi-module extraction', () => {
	it('keeps every authored module entry in document order', () => {
		const data = portableCustomExtractor.extract(parseEl(MULTI_MODULE_XML), makeContext(null));
		expect(data.modules.map((module) => module.id)).toEqual(['jquery', 'eve', 'raphael', 'shading_deps']);
		expect(data.modules[3].primaryPath).toBe('modules/shading_deps.js');
		expect(data.modules[3].fallbackPath).toBe('modules/shading_deps_fallback.js');
	});

	it('picks the entry module by the type identifier tail', () => {
		const data = portableCustomExtractor.extract(parseEl(MULTI_MODULE_XML), makeContext(null));
		expect(data.primaryPath).toBe('modules/shading_deps.js');
		expect(data.fallbackPath).toBe('modules/shading_deps_fallback.js');
	});

	it('captures the authored resolution configuration reference', () => {
		const data = portableCustomExtractor.extract(parseEl(CONFIGURED_XML), makeContext(null));
		expect(data.resolutionConfigPath).toBe('modules/module_resolution.js');
		expect(data.modules[0]).toEqual({ id: 'shading', primaryPath: '' });
	});
});

// ---------------------------------------------------------------------------
// PciHost: multi-module loading end to end
// ---------------------------------------------------------------------------

const REGISTRY_TARGET: Record<string, unknown> = {};
const multiObservation = installPciRegistry(REGISTRY_TARGET);

/**
 * An AMD package in memory: `eve` is a dependency, `shading_deps` defines
 * against it and registers the PCI, as the official HMH example does.
 */
const AMD_PACKAGE: Record<string, string> = {
	'modules/lib/eve.js': `define('eve', [], function () { return { name: 'eve' }; });`,
	'modules/shading_deps.js': `
		define('shading_deps', ['eve'], function (eve) {
			globalThis.__amdRegistration = {
				typeIdentifier: 'urn:fdc:example.com:2019:pci:shading_deps',
				getInstance: function (dom, configuration, state) {
					globalThis.__amdInstance = { configuration: configuration, state: state, eve: eve.name };
					var response = { base: { string: 'amd-answer' } };
					return { getResponse: function () { return response; } };
				}
			};
			qtiCustomInteractionContextForAmd.register(globalThis.__amdRegistration);
			return {};
		});`,
	// The entry module's fallback: same module under a different path, as
	// fractions1.xml demonstrates with its deliberately wrong primary path.
	'modules/shading_deps_fb.js': `
		define('shading_deps', ['eve'], function (eve) {
			globalThis.__amdRegistration = {
				typeIdentifier: 'urn:fdc:example.com:2019:pci:shading_deps',
				getInstance: function (dom, configuration, state) {
					globalThis.__amdInstance = { configuration: configuration, state: state, eve: eve.name };
					var response = { base: { string: 'amd-answer' } };
					return { getResponse: function () { return response; } };
				}
			};
			qtiCustomInteractionContextForAmd.register(globalThis.__amdRegistration);
			return {};
		});`,
};

function amdResolver(): (url: string) => Promise<unknown> {
	return mock(async (resolvedUrl: string) => {
		const path = resolvedUrl.replace('https://pkg.example/', '');
		const code = AMD_PACKAGE[path];
		if (code === undefined) throw new Error(`module not found: ${path}`);
		new Function('define', 'require', 'qtiCustomInteractionContextForAmd', code)(
			(globalThis as Record<string, unknown>).define,
			(globalThis as Record<string, unknown>).require,
			REGISTRY_TARGET[PCI_REGISTRY_GLOBAL]
		);
		return {};
	});
}

function multiModuleData(overrides: Partial<ExtractedPci> = {}): ExtractedPci {
	return {
		responseIdentifier: 'RESPONSE',
		customInteractionTypeIdentifier: 'urn:fdc:example.com:2019:pci:shading_deps',
		primaryPath: 'modules/shading_deps.js',
		fallbackPath: 'modules/shading_deps_fallback.js',
		modules: [
			{ id: 'eve', primaryPath: 'modules/lib/eve.js' },
			{ id: 'shading_deps', primaryPath: 'modules/shading_deps.js', fallbackPath: 'modules/shading_deps_fallback.js' },
		],
		markup: '<div></div>',
		config: {},
		...overrides,
	};
}

describe('PciHost AMD loading', () => {
	it('loads a multi-module declaration through the AMD loader and adopts the registration', async () => {
		const host = new PciHost(multiModuleData(), {
			baseUrl: 'https://pkg.example/',
			moduleResolver: amdResolver() as never,
			registry: multiObservation,
			registrationTimeoutMs: 2000,
		});

		await host.load();
		const dom = { appendChild: () => {} } as never as HTMLElement;
		host.initialize(dom);

		const instanceState = (globalThis as Record<string, unknown>).__amdInstance as {
			configuration: QtiPciConfiguration;
			state?: unknown;
			eve: string;
		};
		expect(instanceState.configuration.responseIdentifier).toBe('RESPONSE');
		expect(instanceState.configuration.properties).toEqual({});
		expect(instanceState.eve).toBe('eve');
		expect(host.getResponse()).toBe('amd-answer');

		host.destroy();
		delete (globalThis as Record<string, unknown>).__amdInstance;
		delete (globalThis as Record<string, unknown>).__amdRegistration;
	});

	it('falls back to the entry module fallback path when the primary tree fails', async () => {
		const evaluated: string[] = [];
		const resolver = mock(async (resolvedUrl: string) => {
			const path = resolvedUrl.replace('https://pkg.example/', '');
			evaluated.push(path);
			if (path === 'modules/shading_deps.js') throw new Error('module not found: primary');
			const code = AMD_PACKAGE[path];
			if (code === undefined) throw new Error(`module not found: ${path}`);
			new Function('define', 'require', 'qtiCustomInteractionContextForAmd', code)(
				(globalThis as Record<string, unknown>).define,
				(globalThis as Record<string, unknown>).require,
				REGISTRY_TARGET[PCI_REGISTRY_GLOBAL]
			);
			return {};
		});
		const data = multiModuleData({
			fallbackPath: 'modules/shading_deps_fb.js',
			modules: [
				{ id: 'eve', primaryPath: 'modules/lib/eve.js' },
				{
					id: 'shading_deps',
					primaryPath: 'modules/shading_deps.js',
					fallbackPath: 'modules/shading_deps_fb.js',
				},
			],
		});
		const host = new PciHost(data, {
			baseUrl: 'https://pkg.example/',
			moduleResolver: resolver as never,
			registry: multiObservation,
			registrationTimeoutMs: 2000,
		});

		await host.load();
		expect(evaluated).toContain('modules/shading_deps_fb.js');
		host.initialize({ appendChild: () => {} } as never as HTMLElement);
		expect((globalThis as Record<string, unknown>).__amdInstance).toBeTruthy();

		host.destroy();
		delete (globalThis as Record<string, unknown>).__amdInstance;
		delete (globalThis as Record<string, unknown>).__amdRegistration;
	});

	it('surfaces PciLoadError when the whole dependency tree fails', async () => {
		const host = new PciHost(multiModuleData(), {
			baseUrl: 'https://pkg.example/',
			moduleResolver: (async () => {
				throw new Error('refused');
			}) as never,
			registry: multiObservation,
		});

		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
	});

	it('probes the defined default resolution-config locations when none is authored', async () => {
		const fetched: string[] = [];
		const files: Record<string, string> = {
			...AMD_PACKAGE,
			'modules/module_resolution.js': JSON.stringify({ paths: { eve: 'modules/lib/eve.js' } }),
		};
		const resolver = mock(async (resolvedUrl: string) => {
			fetched.push(resolvedUrl);
			const path = resolvedUrl.replace('https://pkg.example/', '');
			const source = files[path];
			if (source === undefined) throw new Error(`module not found: ${path}`);
			if (path.endsWith('module_resolution.js')) return JSON.parse(source);
			new Function('define', 'require', 'qtiCustomInteractionContextForAmd', source)(
				(globalThis as Record<string, unknown>).define,
				(globalThis as Record<string, unknown>).require,
				REGISTRY_TARGET[PCI_REGISTRY_GLOBAL]
			);
			return {};
		});
		// A declaration whose entry does not name eve explicitly, so the config must supply it.
		const data = multiModuleData({
			resolutionConfigPath: undefined,
			primaryPath: 'modules/shading_deps.js',
			fallbackPath: undefined,
		});
		// The authored entries do not include eve here: the config's paths must resolve it.
		data.modules = [
			{ id: 'shading_deps', primaryPath: 'modules/shading_deps.js' },
			{ id: 'eve', primaryPath: 'modules/lib/eve.js' },
		];
		const host = new PciHost(data, {
			baseUrl: 'https://pkg.example/',
			moduleResolver: resolver as never,
			registry: multiObservation,
			registrationTimeoutMs: 2000,
		});

		await host.load();
		expect(fetched).toContain('https://pkg.example/modules/module_resolution.js');
		expect(DEFAULT_RESOLUTION_CONFIG_PATHS).toContain('modules/fallback_module_resolution.js');

		host.destroy();
		delete (globalThis as Record<string, unknown>).__amdInstance;
		delete (globalThis as Record<string, unknown>).__amdRegistration;
	});
});
