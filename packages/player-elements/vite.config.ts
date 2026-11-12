import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { workspaceViteAliases } from '../../scripts/workspace-aliases.mjs';

/**
 * The two players' bare names, pinned to their source entries for this bundle.
 *
 * The workspace aliases above already compile the players' Svelte components from
 * source, but a bare `@pie-qti/assessment-player` / `@pie-qti/section-player`
 * import resolves through the workspace symlink to that package's tsc-built
 * `dist` — a second module identity for code the bundle also carries as source.
 * Several modules sat on both paths, so seven assessment- and section-player
 * modules shipped twice (the coded-error class stayed one identity only through
 * its `Symbol.for` brand; `tests/bundle-single-copy.test.ts` pins the single
 * copies). Aliasing the bare names to the same source tree every other import
 * uses leaves one copy of each module in `dist`. Published consumers are
 * unaffected: the package's public types still resolve to the built `d.ts`, and
 * only this bundle changes.
 */
const playerSourceEntries = [
	{
		find: /^@pie-qti\/assessment-player$/,
		replacement: fileURLToPath(new URL('../assessment-player/src/index.ts', import.meta.url)),
	},
	{
		find: /^@pie-qti\/section-player$/,
		replacement: fileURLToPath(new URL('../section-player/src/index.ts', import.meta.url)),
	},
];

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
		alias: [...workspaceViteAliases(), ...playerSourceEntries],
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
