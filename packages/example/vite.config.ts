import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		// Tailwind v4 optimization currently warns on daisyUI's standards-track `@property` rule.
		// Disable Tailwind's optimize pass (Vite will still minify CSS).
		tailwindcss({ optimize: false }),
		sveltekit(),
	],
	resolve: {
		alias: [
			// Bun workspaces may not always materialize a Node-resolvable `node_modules/@pie-qti/...` entry
			// during dev. Alias the local workspace source so dev + SSR can always resolve it.
			// This also enables HMR for TypeScript changes in these packages
			{
				find: '@pie-qti/web-component-loaders',
				replacement: fileURLToPath(new URL('../web-component-loaders/src/index.ts', import.meta.url)),
			},
			// IMPORTANT: keep these subpath aliases BEFORE the package root alias, and ensure the
			// root alias only matches the exact specifier (regex), so `/server` doesn't get rewritten.
			{
				find: '@pie-qti/item-player/server',
				replacement: fileURLToPath(new URL('../item-player/src/server.ts', import.meta.url)),
			},
			{
				find: '@pie-qti/item-player/web-components',
				replacement: fileURLToPath(new URL('../item-player/src/web-components/index.ts', import.meta.url)),
			},
			{
				find: '@pie-qti/item-player/iframe',
				replacement: fileURLToPath(new URL('../item-player/src/iframe/index.ts', import.meta.url)),
			},
			{
				find: /^@pie-qti\/item-player$/,
				replacement: fileURLToPath(new URL('../item-player/src/index.ts', import.meta.url)),
			},
			{
				// Exact match only; otherwise `/components/...` gets rewritten to `index.ts/components/...`.
				find: /^@pie-qti\/assessment-player$/,
				replacement: fileURLToPath(
					new URL('../assessment-player/src/index.ts', import.meta.url)
				),
			},
			// Allow deep imports used by fixtures/tests (e.g. `@pie-qti/default-components/plugins/...`)
			// IMPORTANT: keep this BEFORE the package root alias.
			{
				// Match all deep imports under `/plugins/...`
				find: /^@pie-qti\/default-components\/plugins/,
				replacement: fileURLToPath(new URL('../default-components/src/plugins', import.meta.url)),
			},
			{
				// Exact match only; otherwise `/plugins/...` would get rewritten incorrectly.
				find: /^@pie-qti\/default-components$/,
				replacement: fileURLToPath(
					new URL('../default-components/src/index.ts', import.meta.url)
				),
			},
			{
				// Exact match only; otherwise `/register` gets rewritten to `index.ts/register`.
				find: /^@pie-qti\/player-elements$/,
				replacement: fileURLToPath(new URL('../player-elements/src/index.ts', import.meta.url)),
			},
			{
				// Allow i18n locales to be loaded from source during development
				find: /^@pie-qti\/i18n$/,
				replacement: fileURLToPath(new URL('../i18n/src/index.ts', import.meta.url)),
			},
		],
	},
	server: {
		port: 5200,
		fs: {
			allow: ['..']
		},
		hmr: {
			// Reduce HMR update frequency to prevent overwhelming the browser
			overlay: true
		}
	},
	preview: {
		// Use the same base path as production for consistent testing
		// This way preview matches GitHub Pages behavior exactly
		host: true,
		port: 4173
	}
});
