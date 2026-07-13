import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		svelte({
			// Use `svelte.config.js` for Svelte compiler warning filtering.
			// Keep this config minimal and Vite-specific.
		}),
	],
	resolve: {
		alias: {
			'@pie-qti/item-player/components': fileURLToPath(
				new URL('../item-player/src/components/index.ts', import.meta.url),
			),
		},
	},
	build: {
		lib: {
			entry: {
				index: './src/index.ts',
				elements: './src/elements.ts',
				register: './src/register.ts',
				'register-players': './src/register-players.ts',
			},
			formats: ['es'],
		},
		outDir: 'dist',
		sourcemap: true,
		emptyOutDir: true,
	},
});

