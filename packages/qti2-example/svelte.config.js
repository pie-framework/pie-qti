import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		customElement: true
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: false // Allow non-prerenderable API routes (they won't be available on GitHub Pages)
		}),
		alias: {
			// Bun workspaces may not always materialize a Node-resolvable `node_modules/@pie-qti/...` entry.
			// Alias the local workspace source so SvelteKit's TS + SSR can always resolve it.
			'@pie-qti/web-component-loaders': fileURLToPath(
				new URL('../web-component-loaders/src/index.ts', import.meta.url)
			)
		},
		paths: {
			// Host the examples app under GitHub Pages project subpath:
			// https://pie-framework.github.io/pie-qti/examples/
			base: process.env.NODE_ENV === 'production' ? '/pie-qti/examples' : ''
		},
		prerender: {
			handleMissingId: 'warn',
			handleUnseenRoutes: 'ignore' // Ignore dynamic routes like /a11y-components/[fixture]
		}
	}
};

export default config;
