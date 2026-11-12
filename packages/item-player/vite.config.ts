import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, normalizePath, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';

const SRC_DIR = normalizePath(resolve(__dirname, 'src'));

/**
 * src modules that only this vite build compiles: tsconfig.json excludes them
 * from tsc because they import Svelte components (element.ts, element-class.ts,
 * components/index.ts). Every other .ts module under src/ is framework-free and
 * tsc emits it to the same relative path in dist/.
 */
const VITE_ONLY_MODULES = new Set(
	(JSON.parse(readFileSync(resolve(__dirname, 'tsconfig.json'), 'utf8')).exclude as string[])
		.filter((pattern) => /^src\/[^*]+\.ts$/.test(pattern))
		.map((pattern) => pattern.slice('src/'.length)),
);

/**
 * Import item-player's own TS modules from the tsc output in dist/ instead of
 * inlining a second copy of them into the element bundle. A host that loads both
 * `@pie-qti/item-player` and `@pie-qti/item-player/element(-class)` then gets one
 * Player, ItemSession and PCI registry. The Svelte components and runtime stay
 * bundled, so the element still works without a host Svelte.
 */
function importOwnModulesFromTscOutput(): Plugin {
	return {
		name: 'item-player:own-modules-from-tsc-output',
		enforce: 'pre',
		async resolveId(source, importer, options) {
			if (!importer || !source.startsWith('.')) return null;
			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
			if (!resolved || resolved.external) return resolved;
			const id = normalizePath(resolved.id);
			if (!id.startsWith(`${SRC_DIR}/`) || !id.endsWith('.ts') || id.endsWith('.d.ts')) {
				return resolved;
			}
			const relativeId = id.slice(SRC_DIR.length + 1);
			if (VITE_ONLY_MODULES.has(relativeId)) return resolved;
			// The element chunks are emitted at the dist/ root, next to the tsc output,
			// so the import is the module's path relative to src/ (e.g. ./core/Player.js).
			// check:publint walks these relative imports from the published entries.
			return { id: `./${relativeId.replace(/\.ts$/, '.js')}`, external: true };
		},
	};
}

export default defineConfig({
	plugins: [
		importOwnModulesFromTscOutput(),
		svelte({
			compilerOptions: { customElement: false },
			emitCss: false,
		}),
		dts({
			tsconfigPath: resolve(__dirname, 'tsconfig.svelte.json'),
			outDir: 'dist',
			insertTypesEntry: false,
			include: ['src/element.ts', 'src/element-class.ts'],
		}),
	],
	build: {
		lib: {
			entry: {
				element: resolve(__dirname, 'src/element.ts'),
				'element-class': resolve(__dirname, 'src/element-class.ts'),
			},
			formats: ['es'],
			fileName: (_format, entryName) => `${entryName}.js`,
		},
		outDir: 'dist',
		emptyOutDir: true,
		target: 'es2020',
		sourcemap: true,
		rollupOptions: {
			// Bundle svelte runtime so the CE works standalone (no host Svelte needed).
			// Externalise all @pie-qti/* workspace packages — host app provides them.
			// item-player's own TS modules are externalised to its tsc output (above).
			external: [/^@pie-qti\//, 'node-html-parser'],
		},
	},
});
