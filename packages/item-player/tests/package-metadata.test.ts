import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';

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

	test('publishes a narrowed DOM-free definition/session declaration', () => {
		const serverDeclaration = readFileSync(new URL('../dist/server.d.ts', import.meta.url), 'utf8');
		expect(serverDeclaration).toContain('interface ServerAssessmentItemDefinitionConfig');
		expect(serverDeclaration).toContain('createAssessmentItemDefinition');
		expect(serverDeclaration).not.toContain("from './core/Player.js'");
		expect(serverDeclaration).not.toContain('class Player');
		expect(serverDeclaration).not.toContain('HTMLElement');
	});

	test('does not publish refactor compatibility wrappers or standard extractors', () => {
		const rootDeclaration = readFileSync(new URL('../dist/index.d.ts', import.meta.url), 'utf8');
		const securityDeclaration = readFileSync(
			new URL('../dist/security/index.d.ts', import.meta.url),
			'utf8',
		);

		expect(rootDeclaration).not.toContain('standardChoiceExtractor');
		expect(rootDeclaration).not.toContain("./interactions/index.js");
		expect(securityDeclaration).not.toContain('applyInteractionSecurity');
	});

	test('element bundles import the tsc-emitted modules instead of inlining a second copy', () => {
		// A host loading both the root entry and ./element(-class) must get one
		// Player, ItemSession and PCI registry, so the vite-built element chunks may
		// inline only the Svelte components and the element entries themselves.
		const distDir = new URL('../dist/', import.meta.url);
		const elementMaps = readdirSync(distDir).filter((name) => /^element.*\.js\.map$/.test(name));
		expect(elementMaps.length).toBeGreaterThan(0);

		const inlinedOwnModules = elementMaps.flatMap((name) => {
			const map = JSON.parse(readFileSync(new URL(name, distDir), 'utf8')) as { sources: string[] };
			return map.sources.filter(
				(source) =>
					/^\.\.\/src\/.*\.ts$/.test(source) && !/^\.\.\/src\/element(-class)?\.ts$/.test(source),
			);
		});
		expect(inlinedOwnModules).toEqual([]);
	});
});
