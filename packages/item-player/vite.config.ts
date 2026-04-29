import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: { customElement: false },
			emitCss: false,
		}),
		dts({
			tsconfigPath: resolve(__dirname, 'tsconfig.svelte.json'),
			outDir: 'dist',
			insertTypesEntry: false,
			include: ['src/element.ts'],
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, 'src/element.ts'),
			formats: ['es'],
			fileName: () => 'element.js',
		},
		outDir: 'dist',
		emptyOutDir: false, // don't wipe the tsc output
		target: 'es2020',
		sourcemap: true,
		rollupOptions: {
			// Bundle svelte runtime so the CE works standalone (no host Svelte needed).
			// Externalise all @pie-qti/* workspace packages — host app provides them.
			external: [/^@pie-qti\//, 'node-html-parser', '@xmldom/xmldom'],
		},
	},
});
