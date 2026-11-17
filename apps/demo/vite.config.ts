import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { tsconfigOwnPathEntries, viteAliases } from '../../scripts/workspace-aliases.mjs';

// The demo's module aliases are the `paths` of its tsconfig: the workspace alias map plus
// item-player's published entry points, which the demo runs from source.
const tsconfigPath = fileURLToPath(new URL('./tsconfig.json', import.meta.url));

export default defineConfig({
	plugins: [
		// Tailwind v4 optimization currently warns on daisyUI's standards-track `@property` rule.
		// Disable Tailwind's optimize pass (Vite will still minify CSS).
		tailwindcss({ optimize: false }),
		sveltekit({
			compilerOptions: {
				customElement: true
			},
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
			prerender: {
				handleMissingId: 'warn',
				handleUnseenRoutes: 'ignore' // Ignore dynamic routes like /a11y-components/[fixture]
			}
		}),
	],
	resolve: {
		alias: viteAliases(tsconfigOwnPathEntries(tsconfigPath) ?? []),
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
