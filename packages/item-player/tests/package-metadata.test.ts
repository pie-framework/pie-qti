import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
	exports?: Record<string, unknown>;
	sideEffects?: unknown;
};

describe('item-player package metadata', () => {
	test('keeps the item-player custom element entrypoint side-effectful', () => {
		expect(packageJson.sideEffects).toContain('./dist/element.js');
	});

	test('exposes component exports with non-Svelte fallback conditions', () => {
		expect(packageJson.exports?.['./components']).toMatchObject({
			types: './src/components/index.ts',
			import: './src/components/index.ts',
			default: './src/components/index.ts',
			svelte: './src/components/index.ts',
		});
	});
});
