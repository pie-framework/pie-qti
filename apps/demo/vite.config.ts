import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { workspaceKitAliases, workspaceViteAliases } from '../../scripts/workspace-aliases.mjs';

// The demo runs item-player from source, so its published entry points resolve to their
// source files here. The unpublished component entry points (`@pie-qti/*/components`) come
// from the workspace alias map, tsconfig.workspace-aliases.json, listed first so the
// `@pie-qti/item-player` entry below never captures `@pie-qti/item-player/components`.
const itemPlayerSource = {
	'@pie-qti/item-player/security': '../../packages/item-player/src/security/index.ts',
	'@pie-qti/item-player/element': '../../packages/item-player/src/element.ts',
	'@pie-qti/item-player/web-components': '../../packages/item-player/src/web-components/index.ts',
	'@pie-qti/item-player/iframe': '../../packages/item-player/src/iframe/index.ts',
	'@pie-qti/item-player/server': '../../packages/item-player/src/server.ts',
	'@pie-qti/item-player/pci': '../../packages/item-player/src/pci/index.ts',
	'@pie-qti/item-player': '../../packages/item-player/src/index.ts',
};

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
			alias: {
				...workspaceKitAliases(),
				...itemPlayerSource,
			},
			prerender: {
				handleMissingId: 'warn',
				handleUnseenRoutes: 'ignore' // Ignore dynamic routes like /a11y-components/[fixture]
			}
		}),
	],
	resolve: {
		alias: [
			...workspaceViteAliases(),
			...Object.entries(itemPlayerSource).map(([find, path]) => ({
				find,
				replacement: fileURLToPath(new URL(path, import.meta.url)),
			})),
		],
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
