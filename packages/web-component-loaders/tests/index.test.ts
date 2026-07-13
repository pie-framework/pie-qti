import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_INTERACTION_TAGS, loadPieQtiPlayerElements } from '../src/index.js';

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

	test('waits for the portable custom interaction renderer', () => {
		expect(DEFAULT_INTERACTION_TAGS).toContain('pie-qti-portable-custom');
	});

	test('ships local CSS imports for the complete default stylesheet', () => {
		const css = readFileSync(new URL('../src/default-runtime.css', import.meta.url), 'utf8');
		expect(css).toContain("@import './theme-bridge.css'");
		expect(css).toContain("@import './qti-shared-vocabulary.css'");
		expect(css).not.toContain('@pie-qti/');
	});
});
