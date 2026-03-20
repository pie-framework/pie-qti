import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		// Tailwind v4 optimization currently warns on daisyUI's standards-track `@property` rule.
		// Disable Tailwind's optimize pass (Vite will still minify CSS).
		tailwindcss({ optimize: false }),
		sveltekit(),
	],
	server: {
		port: 5202,
		fs: {
			allow: ['..', '../..']
		}
	}
});
