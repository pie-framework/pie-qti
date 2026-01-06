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
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/pie-qti' : ''
		},
		prerender: {
			handleMissingId: 'warn',
			handleUnseenRoutes: 'ignore' // Ignore dynamic routes like /a11y-components/[fixture]
		}
	}
};

export default config;
