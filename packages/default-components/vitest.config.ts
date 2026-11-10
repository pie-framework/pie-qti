import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * A runes module (`*.svelte.ts`) is imported by its `*.svelte` name, the way the
 * components import it. From a plain test file the Svelte plugin does not take
 * the request, so resolve it here: `x.svelte` with an `x.svelte.ts` beside it and
 * no component at `x.svelte` is that module.
 */
function resolveRunesModules(): Plugin {
	return {
		name: 'resolve-runes-modules',
		enforce: 'pre',
		resolveId(source, importer) {
			if (!source.endsWith('.svelte') || source.startsWith('\0')) return null;
			const candidate = importer && source.startsWith('.')
				? join(dirname(importer), source)
				: source;
			const module = `${candidate}.ts`;
			return existsSync(module) && !existsSync(candidate) ? module : null;
		},
	};
}

// Component-behavior tests mount the real Svelte interaction components with
// Svelte's runtime and assert their behavior (rendering, input handling, the
// `qti-change` event contract). They use the `.vitest.ts` suffix so `bun test`
// (which cannot compile .svelte imports) does not pick them up; run them with
// `bun run test:component`.
export default defineConfig({
	plugins: [resolveRunesModules(), svelte({ emitCss: false })],
	// Vitest transforms modules in its SSR pipeline, which makes `svelte` resolve
	// its server entry where `mount()` is unavailable. The browser condition
	// forces the client runtime, matching the jsdom test environment.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
	test: {
		environment: 'jsdom',
		include: ['tests/component/**/*.vitest.ts'],
	},
});
