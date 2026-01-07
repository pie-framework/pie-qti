import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		svelte({
			// Use `svelte.config.js` for Svelte compiler warning filtering.
			// Keep this config minimal and Vite-specific.
		}),
	],
	build: {
		lib: {
			entry: {
				index: './src/index.ts',
				register: './src/register.ts',
			},
			formats: ['es'],
		},
		outDir: 'dist',
		sourcemap: true,
		emptyOutDir: true,
	},
});


