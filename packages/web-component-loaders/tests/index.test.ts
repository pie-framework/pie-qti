import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { cachedImport } from '../src/cachedImport.js';
import { loadPieQtiPlayerElements } from '../src/index.js';

const packageJson = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
	dependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
};

describe('web component loader', () => {
	test('is a no-op during SSR', async () => {
		const before = globalThis.__pieQtiWebComponentLoaders__;
		const result = await loadPieQtiPlayerElements();

		expect(result).toBeUndefined();
		expect(globalThis.__pieQtiWebComponentLoaders__).toBe(before);
	});

	test('owns its runtime dependency instead of exposing optional runtime peers', () => {
		expect(packageJson.dependencies?.['@pie-qti/player-elements']).toBe('workspace:*');
		expect(packageJson.peerDependencies).toBeUndefined();
	});

	// The loader once awaited `customElements.whenDefined` for a hand-copied
	// list of 21 interaction tags that duplicated what the register module
	// defines. A drifted entry never settles and the loader hangs forever. The
	// register module registers everything synchronously during its import, so
	// no second inventory may exist here.
	test('keeps no separate tag inventory next to the register module', () => {
		const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
		// No quoted element tag names (the `@pie-qti/...` package specifier is
		// not a tag) and no definition wait to hang on.
		expect(source).not.toMatch(/['"`]pie-qti-/);
		expect(source).not.toContain('whenDefined(');
	});

	test('ships local CSS imports for the complete default stylesheet', () => {
		const css = readFileSync(new URL('../src/default-runtime.css', import.meta.url), 'utf8');
		expect(css).toContain("@import './theme-bridge.css'");
		expect(css).toContain("@import './qti-shared-vocabulary.css'");
		expect(css).toContain("@import './qti-pnp.css'");
		expect(css).not.toContain('@pie-qti/');
	});
});

describe('cachedImport', () => {
	test('single-flights concurrent calls and reuses the settled promise', async () => {
		let loads = 0;
		const store: Record<string, Promise<void>> = {};
		const load = () => {
			loads++;
			return Promise.resolve();
		};

		const first = cachedImport(store, 'chunk', load);
		const second = cachedImport(store, 'chunk', load);
		// The pending promise is shared, and it is the store's entry.
		expect(second).toBe(first);
		expect(store.chunk).toBe(first);
		await Promise.all([first, second]);
		expect(loads).toBe(1);

		await cachedImport(store, 'chunk', load);
		expect(loads).toBe(1);
	});

	test('a rejected import clears its store entry so a later call retries', async () => {
		let loads = 0;
		const store: Record<string, Promise<void>> = {};
		const load = () => {
			loads++;
			return loads === 1
				? Promise.reject(new Error('chunk 404'))
				: Promise.resolve();
		};

		const first = cachedImport(store, 'chunk', load);
		expect(store.chunk).toBe(first);
		await expect(first).rejects.toThrow('chunk 404');
		// The failure is not cached: the entry is gone and the next call loads anew.
		expect(store.chunk).toBeUndefined();

		await cachedImport(store, 'chunk', load);
		expect(loads).toBe(2);
		expect(store.chunk).toBeDefined();
	});

	test('every caller sharing a failed import sees the rejection', async () => {
		const store: Record<string, Promise<void>> = {};
		const load = () => Promise.reject(new Error('network down'));

		const first = cachedImport(store, 'chunk', load);
		const second = cachedImport(store, 'chunk', load);
		await expect(first).rejects.toThrow('network down');
		await expect(second).rejects.toThrow('network down');
		expect(store.chunk).toBeUndefined();
	});
});
