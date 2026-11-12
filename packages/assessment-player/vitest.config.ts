import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { workspaceViteAliases } from '../../scripts/workspace-aliases.mjs';

// Component-behavior tests mount the real Svelte shell components in jsdom. They
// use the `.vitest.ts` suffix so `bun test` (which cannot compile .svelte imports)
// does not pick them up; run them with `bun run test:component`.
export default defineConfig({
	plugins: [svelte({ emitCss: false })],
	resolve: {
		// The shell renders the section player's components, imported by their
		// workspace-only name (tsconfig.workspace-aliases.json).
		alias: workspaceViteAliases(),
		// Vitest transforms modules in its SSR pipeline, which makes `svelte` resolve
		// its server entry where `mount()` is unavailable. The browser condition
		// forces the client runtime, matching the jsdom test environment.
		...(process.env.VITEST ? { conditions: ['browser'] } : {}),
	},
	test: {
		environment: 'jsdom',
		include: ['tests/component/**/*.vitest.ts'],
	},
});
