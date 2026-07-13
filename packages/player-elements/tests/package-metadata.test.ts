import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const packageJson = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
	sideEffects?: unknown;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	exports?: Record<string, unknown>;
	types?: string;
};

describe('player-elements package metadata', () => {
	test('keeps the register entrypoint side-effectful for package consumers', () => {
		expect(packageJson.sideEffects).toContain('./dist/register.js');
		expect(packageJson.sideEffects).toContain('./dist/register-players.js');
		expect(packageJson.sideEffects).toContain('./dist/tag-names-*.js');
	});

	test('publishes explicit SSR, default-runtime, and advanced browser entrypoints', () => {
		expect(Object.hasOwn(packageJson.exports ?? {}, '.')).toBe(true);
		expect(Object.hasOwn(packageJson.exports ?? {}, './register')).toBe(true);
		expect(Object.hasOwn(packageJson.exports ?? {}, './elements')).toBe(true);
		expect(Object.hasOwn(packageJson.exports ?? {}, './register-players')).toBe(true);
		expect(packageJson.types).toBe('./dist/public/index.d.ts');
		expect(packageJson.dependencies).toBeUndefined();
		expect(packageJson.devDependencies?.['@pie-qti/default-components']).toBe('workspace:*');
	});

	test('keeps the published declaration facade framework-neutral', () => {
		const publicTypesDirectory = new URL('../dist/public', import.meta.url).pathname;
		const declarationText = readdirSync(publicTypesDirectory)
			.filter((fileName) => fileName.endsWith('.d.ts'))
			.map((fileName) => readFileSync(join(publicTypesDirectory, fileName), 'utf8'))
			.join('\n');

		for (const implementationDetail of [
			"from '@pie-qti/",
			'from "@pie-qti/',
			'svelte',
			'BaseSvelteMountElement',
			'PieQtiItemPlayerElement',
		]) {
			expect(declarationText).not.toContain(implementationDetail);
		}
	});
});
