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
			// GitHub Pages does not serve `index.html` for directory routes unless the URL ends with `/`.
			// Emit an SPA fallback so deep links like `/examples/item-demo/inline-choice` still work.
			// (GitHub Pages serves `404.html` for unknown paths; SvelteKit will then route client-side.)
			fallback: '404.html',
			precompress: false,
			strict: true // Fail build if API routes or non-prerenderable pages are added (not supported on GitHub Pages)
		}),
		paths: {
			// When using custom domain (qti.pie-framework.org), examples are at /examples
			// When using GitHub Pages URL (pie-framework.github.io/pie-qti), examples are at /pie-qti/examples
			// Use GITHUB_PAGES_SUBPATH env var to control this (set in workflow for GitHub Pages URL)
			base: process.env.GITHUB_PAGES_SUBPATH === 'true' && process.env.NODE_ENV === 'production'
				? '/pie-qti/examples'
				: process.env.NODE_ENV === 'production'
					? '/examples'
					: ''
		},
		alias: {
			'@pie-qti/item-player/components': '../../packages/item-player/src/components/index.ts',
			'@pie-qti/assessment-player/components': '../../packages/assessment-player/src/components/index.ts',
			'@pie-qti/default-components/shared/components': '../../packages/default-components/src/shared/components/index.ts',
			'@pie-qti/i18n/components': '../../packages/i18n/src/components/index.ts'
		},
		prerender: {
			handleMissingId: 'warn',
			handleUnseenRoutes: 'ignore' // Ignore dynamic routes like /a11y-components/[fixture]
		}
	}
};

export default config;
