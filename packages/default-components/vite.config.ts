import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true,
			},
			emitCss: false,
		}),
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
			treeshake: false,
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: 'chunks/[name]-[hash].js',
				assetFileNames: 'assets/[name][extname]',
			},
		},
	},
});
