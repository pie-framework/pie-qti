import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

// The runner ships as two fixed-name static files — `pci-runner.html` and
// `pci-runner.js` — because deployment targets pin their URL. No hashing.
export default defineConfig({
	// Relative asset URLs, so the page works from any path on the runner origin.
	base: './',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'es2022',
		rollupOptions: {
			input: { 'pci-runner': resolve(packageRoot, 'index.html') },
			output: {
				entryFileNames: 'pci-runner.js',
				chunkFileNames: 'pci-runner.js',
				assetFileNames: '[name][extname]',
			},
		},
	},
});
