import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { defineConfig, normalizePath, type Plugin } from 'vite';

const SRC_DIR = `${normalizePath(resolve(__dirname, 'src'))}/`;

/**
 * package.json `sideEffects` lists only the published dist files, but Vite also
 * applies it to this package's own src modules while building. That marks the
 * self-registering custom-element components side-effect free, so tree-shaking
 * drops every `customElements.define` and leaves an empty `plugins.js`.
 * Restore the bundler default for our own script modules (CSS keeps Vite's own
 * handling); dependencies are still tree-shaken by their own sideEffects hints.
 */
function keepOwnSourceSideEffects(): Plugin {
	return {
		name: 'default-components:own-source-side-effects',
		transform(_code, id) {
			if (id.startsWith(SRC_DIR) && /\.(?:svelte|ts)$/.test(id)) {
				return { moduleSideEffects: true };
			}
			return null;
		},
	};
}

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
			},
			emitCss: false,
		}),
		keepOwnSourceSideEffects(),
	],
	build: {
		lib: {
			entry: {
				plugins: resolve(__dirname, 'src/plugins/index.ts'),
			},
			formats: ['es'],
		},
		outDir: 'dist',
		emptyOutDir: false,
		target: 'es2020',
		sourcemap: true,
		rollupOptions: {
			// Bundle the Svelte runtime (and tiptap/KaTeX/mathlive) so the custom
			// elements work standalone. Externalise all @pie-qti/* workspace
			// packages: they are runtime dependencies the host resolves, so a page
			// loads one shared copy of the item player, i18n and qti-common instead
			// of a private copy inside this bundle.
			external: [/^@pie-qti\//],
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: 'chunks/[name]-[hash].js',
				assetFileNames: 'assets/[name][extname]',
			},
		},
	},
});
