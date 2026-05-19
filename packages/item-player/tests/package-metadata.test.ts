import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
	exports?: Record<string, unknown>;
	files?: string[];
	sideEffects?: unknown;
};

describe('item-player package metadata', () => {
	test('keeps the item-player custom element entrypoint side-effectful', () => {
		expect(packageJson.sideEffects).toContain('./dist/element.js');
	});

	test('keeps Svelte source components out of the public package contract', () => {
		expect(packageJson.exports?.['./components']).toBeUndefined();
		expect(JSON.stringify(packageJson.exports)).not.toContain('./src/');
		expect(packageJson.files).not.toContain('src');
	});
});
