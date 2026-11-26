import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { tsconfigOwnPathEntries, viteAliases } from '../../scripts/workspace-aliases.mjs';

// Serve the PCI sandbox runner page from the demo itself, so the sandboxed-runner
// handshake e2e (`?pciSandbox=1`) and the deployed examples both load it from this
// app's origin. The runner builds to two fixed-name files with relative asset URLs
// (`packages/pci-runner/vite.config.ts`), so the copies work at any base path.
// The files are generated; apps/demo/.gitignore ignores them.
function copyPciRunner(): Plugin {
	const runnerDist = fileURLToPath(new URL('../../packages/pci-runner/dist', import.meta.url));
	const staticDir = fileURLToPath(new URL('./static', import.meta.url));
	const copy = () => {
		for (const name of ['pci-runner.html', 'pci-runner.js']) {
			fs.copyFileSync(path.join(runnerDist, name), path.join(staticDir, name));
		}
	};
	return {
		name: 'pie-qti:copy-pci-runner',
		configureServer() {
			try {
				copy();
			} catch {
				console.warn(
					'[copy-pci-runner] packages/pci-runner/dist is missing; run `bun run build` once to serve the PCI sandbox runner page.',
				);
			}
		},
		buildStart() {
			copy();
		},
	};
}

// The demo's module aliases are the `paths` of its tsconfig: the workspace alias map plus
// item-player's published entry points, which the demo runs from source.
const tsconfigPath = fileURLToPath(new URL('./tsconfig.json', import.meta.url));

export default defineConfig({
	plugins: [
		copyPciRunner(),
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
