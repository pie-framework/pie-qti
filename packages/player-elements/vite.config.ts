import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { workspaceViteAliases } from '../../scripts/workspace-aliases.mjs';

export default defineConfig({
	plugins: [
		svelte({
			// Use `svelte.config.js` for Svelte compiler warning filtering.
			// Keep this config minimal and Vite-specific.
		}),
	],
	resolve: {
		// The section and assessment player components ship as source only; they are
		// compiled here under their workspace-only names (tsconfig.workspace-aliases.json).
		alias: workspaceViteAliases(),
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

