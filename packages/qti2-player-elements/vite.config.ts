import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		svelte({
			// Ensure we also compile workspace package components
			include: ['**/*.svelte'],
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


