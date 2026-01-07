import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		// Tailwind v4 optimizes CSS using @tailwindcss/node (LightningCSS). DaisyUI uses the
		// standards-track `@property` at-rule, which currently produces a noisy warning during
		// optimization. Disable Tailwind's optimization pass here; Vite will still minify CSS.
		tailwindcss({ optimize: false }),
	]
});
