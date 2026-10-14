import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: undefined,
				precompress: false,
				strict: false
			}),
			paths: {
				// No base path needed for custom domain (qti.pie-framework.org)
				// Use GITHUB_PAGES_SUBPATH env var if deploying to GitHub Pages URL
				base: process.env.GITHUB_PAGES_SUBPATH === 'true' && process.env.NODE_ENV === 'production'
					? '/pie-qti'
					: ''
			},
			prerender: {
				entries: ['*'],
				handleMissingId: 'warn',
				handleHttpError: ({ status, path }) => {
					// Ignore 404s for /examples path - it's served by a separate app
					if (status === 404 && path.startsWith('/examples')) {
						return;
					}
					throw new Error(`${status} ${path}`);
				}
			}
		}),
		// Tailwind v4 optimizes CSS using @tailwindcss/node (LightningCSS). DaisyUI uses the
		// standards-track `@property` at-rule, which currently produces a noisy warning during
		// optimization. Disable Tailwind's optimization pass here; Vite will still minify CSS.
		tailwindcss({ optimize: false }),
	],
	server: {
		port: 5201
	}
});
