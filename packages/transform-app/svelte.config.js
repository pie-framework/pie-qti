import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Enable compiling Svelte components that declare `<svelte:options customElement="...">`.
		// This is required for `@pie-qti/default-components/plugins` to register custom elements.
		customElement: true
	},
	kit: {
		adapter: adapter({
			out: 'build'
		}),
		alias: {
			// Ensure workspace source resolves even if Bun doesn't create a node-resolvable entry.
			'@pie-qti/web-component-loaders': fileURLToPath(
				new URL('../web-component-loaders/src/index.ts', import.meta.url)
			)
		}
	}
};

export default config;
