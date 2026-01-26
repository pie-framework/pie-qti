import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
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
			handleMissingId: 'warn'
		}
	}
};

export default config;
