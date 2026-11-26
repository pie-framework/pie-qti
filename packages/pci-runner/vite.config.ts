import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

// The runner ships as two fixed-name static files — `pci-runner.html` and
// `pci-runner.js` — because deployment targets pin their URL. No hashing.
export default defineConfig({
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'es2022',
		lib: {
			// A classic (IIFE) script, not an ES module: module scripts always fetch
			// with CORS, and the sandboxed frame's opaque origin ("null") can never
			// satisfy an origin check, so a module bundle fails to load on any static
			// host that sends no CORS headers. A classic script needs no CORS, keeping
			// the page deployable anywhere with no server configuration — the same bar
			// the runner holds PCI module loading to. `index.html` references the
			// bundle with a plain `<script src>`; the build copies it to dist verbatim.
			entry: resolve(packageRoot, 'src/main.ts'),
			// Required by Vite for the iife format; the page exports nothing, so no
			// global is ever created.
			name: 'PciRunner',
			formats: ['iife'],
			fileName: () => 'pci-runner.js',
		},
	},
});
