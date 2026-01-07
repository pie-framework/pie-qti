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
				find: '@pie-qti/qti2-item-player/server',
				replacement: fileURLToPath(new URL('../qti2-item-player/src/server.ts', import.meta.url)),
			},
			{
				find: '@pie-qti/qti2-item-player/web-components',
				replacement: fileURLToPath(new URL('../qti2-item-player/src/web-components/index.ts', import.meta.url)),
			},
			{
				find: '@pie-qti/qti2-item-player/iframe',
				replacement: fileURLToPath(new URL('../qti2-item-player/src/iframe/index.ts', import.meta.url)),
			},
			{
				find: /^@pie-qti\/qti2-item-player$/,
				replacement: fileURLToPath(new URL('../qti2-item-player/src/index.ts', import.meta.url)),
			},
			{
				// Exact match only; otherwise `/components/...` gets rewritten to `index.ts/components/...`.
				find: /^@pie-qti\/qti2-assessment-player$/,
				replacement: fileURLToPath(
					new URL('../qti2-assessment-player/src/index.ts', import.meta.url)
				),
			},
			// Allow deep imports used by fixtures/tests (e.g. `@pie-qti/qti2-default-components/plugins/...`)
			// IMPORTANT: keep this BEFORE the package root alias.
			{
				// Match all deep imports under `/plugins/...`
				find: /^@pie-qti\/qti2-default-components\/plugins/,
				replacement: fileURLToPath(new URL('../qti2-default-components/src/plugins', import.meta.url)),
			},
			{
				// Exact match only; otherwise `/plugins/...` would get rewritten incorrectly.
				find: /^@pie-qti\/qti2-default-components$/,
				replacement: fileURLToPath(
					new URL('../qti2-default-components/src/index.ts', import.meta.url)
				),
			},
			{
				// Exact match only; otherwise `/register` gets rewritten to `index.ts/register`.
				find: /^@pie-qti\/qti2-player-elements$/,
				replacement: fileURLToPath(new URL('../qti2-player-elements/src/index.ts', import.meta.url)),
			},
		],
	},
	server: {
		fs: {
			allow: ['..']
		}
	},
	preview: {
		// Use the same base path as production for consistent testing
		// This way preview matches GitHub Pages behavior exactly
		host: true,
		port: 4173
	}
});
