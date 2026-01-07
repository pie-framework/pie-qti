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
		alias: {
			// Bun workspaces may not always materialize a Node-resolvable `node_modules/@pie-qti/...` entry
			// during dev. Alias the local workspace source so dev + SSR can always resolve it.
			'@pie-qti/web-component-loaders': fileURLToPath(
				new URL('../web-component-loaders/src/index.ts', import.meta.url)
			)
		}
	},
	server: {
		fs: {
			allow: ['..']
		}
	}
});
