/**
 * @pie-qti/ims-cp-browser
 * Browser-compatible IMS Content Package utilities
 */

import { extractPackage, loadResolvedManifest } from './package-loader.js';
import { createVirtualPackage, loadPackageFromStorage as loadFromStorage } from './virtual-package.js';
import { SessionStorageBackend } from './storage.js';
import type { OpenPackageOptions } from './types.js';
import type { VirtualPackage } from './virtual-package.js';

// Re-export types and utilities
export type { VirtualFile, OpenPackageOptions } from './types.js';
export type { VirtualPackage } from './virtual-package.js';
export type { StorageBackend } from './storage.js';
export type { ResolvedManifest, ResolvedManifestResource } from './package-loader.js';
export { SessionStorageBackend, LocalStorageBackend, MemoryStorageBackend } from './storage.js';
export * from './path-utils.js';

// Image resolution utilities
export { resolveImagesInXml, tryResolveImagePath } from './image-resolver.js';
export type { ResolveImagesOptions, LoggerLike } from './image-resolver.js';

/**
 * Open an IMS Content Package from a browser File object
 *
 * @param file Browser File object (from file input or drag-and-drop)
 * @param options Configuration options
 * @returns VirtualPackage instance with parsed manifest and file access
 *
 * @example
 * ```typescript
 * const fileInput = document.querySelector('input[type="file"]');
 * fileInput.addEventListener('change', async (e) => {
 *   const file = e.target.files[0];
 *   const pkg = await openPackage(file);
 *   console.log(pkg.manifest.items); // Array of QTI items
 *   const itemXml = pkg.readText(pkg.manifest.items[0].hrefResolved);
 * });
 * ```
 */
export async function openPackage(file: File, options: OpenPackageOptions = {}): Promise<VirtualPackage> {
	const {
		storage = new SessionStorageBackend(),
		maxFileSize = 50 * 1024 * 1024, // 50MB
		maxFiles = 1000,
	} = options;

	// Generate package ID from file name and timestamp
	const packageId = `${file.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}`;

	// Extract ZIP contents
	const { files, manifestXml, manifestPath } = await extractPackage(file, {
		maxFileSize,
		maxFiles,
	});

	// Parse and resolve manifest
	const manifest = await loadResolvedManifest(manifestXml, manifestPath);

	// Create virtual package
	const pkg = createVirtualPackage(packageId, files, manifest, storage);

	// Optionally save to storage
	if (storage) {
		await pkg.save();
	}

	return pkg;
}

/**
 * Load a previously saved package from storage
 *
 * @param packageId Package identifier (from previous openPackage call)
 * @param storage Storage backend to use (defaults to sessionStorage)
 * @returns VirtualPackage instance or null if not found
 *
 * @example
 * ```typescript
 * const pkg = await loadPackageFromStorage('my-package-123');
 * if (pkg) {
 *   console.log(pkg.manifest.items);
 * }
 * ```
 */
export async function loadPackageFromStorage(
	packageId: string,
	storage: import('./storage.js').StorageBackend = new SessionStorageBackend()
): Promise<VirtualPackage | null> {
	return await loadFromStorage(packageId, storage);
}
