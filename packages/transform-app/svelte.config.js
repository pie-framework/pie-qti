import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			// Ensure workspace source resolves even if Bun doesn't create a node-resolvable entry.
			'@pie-qti/web-component-loaders': fileURLToPath(
				new URL('../web-component-loaders/src/index.ts', import.meta.url)
			)
		}
	}
};

export default config;
