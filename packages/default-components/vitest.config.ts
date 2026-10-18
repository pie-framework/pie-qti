import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Component-behavior tests mount the real Svelte interaction components with
// Svelte's runtime and assert their behavior (rendering, input handling, the
// `qti-change` event contract). They use the `.vitest.ts` suffix so `bun test`
// (which cannot compile .svelte imports) does not pick them up; run them with
// `bun run test:component`.
export default defineConfig({
	plugins: [svelte({ emitCss: false })],
	// Vitest transforms modules in its SSR pipeline, which makes `svelte` resolve
	// its server entry where `mount()` is unavailable. The browser condition
	// forces the client runtime, matching the jsdom test environment.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
	test: {
		environment: 'jsdom',
		include: ['tests/component/**/*.vitest.ts'],
	},
});
