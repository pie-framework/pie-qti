import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	plugins: [
		// Tailwind v4 with DaisyUI
		// Disable optimize to avoid warnings with DaisyUI's @property rules
		tailwindcss({ optimize: false }),
		sveltekit()
	],
	server: {
		fs: {
			// Allow serving files from the monorepo root and bun's node_modules
			allow: [
				resolve(__dirname, '../../../..'),  // Monorepo root
				resolve(__dirname, '../../..'),     // examples/vendor-extensions-minimal
			]
		}
	}
});
