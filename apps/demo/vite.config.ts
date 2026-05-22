import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
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
			'@pie-qti/item-player/components': fileURLToPath(
				new URL('../../packages/item-player/src/components/index.ts', import.meta.url),
			),
			'@pie-qti/assessment-player/components': fileURLToPath(
				new URL('../../packages/assessment-player/src/components/index.ts', import.meta.url),
			),
			'@pie-qti/default-components/shared/components': fileURLToPath(
				new URL('../../packages/default-components/src/shared/components/index.ts', import.meta.url),
			),
			'@pie-qti/i18n/components': fileURLToPath(
				new URL('../../packages/i18n/src/components/index.ts', import.meta.url),
			),
		},
	},
	server: {
		port: 5200,
		fs: {
			allow: ['..', '../..']
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
