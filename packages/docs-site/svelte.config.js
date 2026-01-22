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
			base: process.env.NODE_ENV === 'production' ? '/pie-qti' : ''
		},
		trailingSlash: 'always', // Ensure URLs end with `/` so GitHub Pages serves directories correctly
		prerender: {
			entries: ['*'],
			handleMissingId: 'warn'
		}
	}
};

export default config;
