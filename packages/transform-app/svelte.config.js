import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Enable compiling Svelte components that declare `<svelte:options customElement="...">`.
		// This is required for `@pie-qti/qti2-default-components/plugins` to register custom elements.
		customElement: true
	},
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
