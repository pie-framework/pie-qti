/**
 * Client-side QTI package processing utilities
 * Uses @pie-qti/ims-cp-browser for package handling
 */

import {
	openPackage,
	loadPackageFromStorage as loadPackage,
	SessionStorageBackend
} from '@pie-qti/ims-cp-browser';
import type { VirtualPackage } from '@pie-qti/ims-cp-browser';

// Storage key for the current package ID
const STORAGE_KEY_CURRENT_PACKAGE = 'qti-current-package-id';

/**
 * Legacy interface for backward compatibility with existing UI code
 */
export interface PackageStructure {
	packageId: string;
	items: Array<{
		identifier: string;
		href: string;
		title?: string;
	}>;
	tests: Array<{
		identifier: string;
		href: string;
		title?: string;
	}>;
	assets: {
		images: string[];
		styles: string[];
		audio: string[];
		video: string[];
		passages: string[];
	};
	manifest: any;
	// Internal: Store reference to VirtualPackage
	_pkg: VirtualPackage;
}

/**
 * Process a QTI package file uploaded by the user
 *
 * @param file Browser File object from file input or drag-and-drop
 * @returns PackageStructure with parsed manifest and file access
 */
export async function processPackage(file: File): Promise<PackageStructure> {
	const storage = new SessionStorageBackend();

	const pkg = await openPackage(file, {
		storage,
		maxFileSize: 50 * 1024 * 1024, // 50MB
		maxFiles: 1000
	});

	// Store current package ID for later retrieval
	localStorage.setItem(STORAGE_KEY_CURRENT_PACKAGE, pkg.packageId);

	return convertToPackageStructure(pkg);
}

/**
 * Convert VirtualPackage to legacy PackageStructure format
 */
function convertToPackageStructure(pkg: VirtualPackage): PackageStructure {
	const items = pkg.manifest.items
		.filter((item) => item.hrefResolved) // Filter out items without hrefs
		.map((item) => ({
			identifier: item.identifier,
			href: item.hrefResolved as string, // Safe after filter
			title: item.identifier // TODO: Extract title from metadata if available
		}));

	const tests = pkg.manifest.tests
		.filter((test) => test.hrefResolved) // Filter out tests without hrefs
		.map((test) => ({
			identifier: test.identifier,
			href: test.hrefResolved as string, // Safe after filter
			title: test.identifier // TODO: Extract title from metadata if available
		}));

	// Categorize assets by file extension
	const images: string[] = [];
	const styles: string[] = [];
	const audio: string[] = [];
	const video: string[] = [];
	const passages: string[] = [];

	for (const file of pkg.files.values()) {
		const path = file.path;
		const ext = path.split('.').pop()?.toLowerCase() || '';

		if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
			images.push(path);
		} else if (['css'].includes(ext)) {
			styles.push(path);
		} else if (['mp3', 'wav', 'ogg'].includes(ext)) {
			audio.push(path);
		} else if (['mp4', 'webm', 'ogv'].includes(ext)) {
			video.push(path);
		} else if (path.includes('passage') || path.includes('stimulus')) {
			passages.push(path);
		}
	}

	return {
		packageId: pkg.packageId,
		items,
		tests,
		assets: { images, styles, audio, video, passages },
		manifest: pkg.manifest,
		_pkg: pkg
	};
}

/**
 * Load package data from browser storage
 * @returns PackageStructure or null if no package is stored
 */
export function loadPackageData(): PackageStructure | null {
	try {
		const packageId = localStorage.getItem(STORAGE_KEY_CURRENT_PACKAGE);
		if (!packageId) return null;

		// NOTE: This function is synchronous but loading from storage requires async.
		// For now, we'll return null and require the UI to use async loading.
		// The UI should call loadPackageDataAsync() instead.
		console.warn(
			'loadPackageData() is deprecated and returns null. Use loadPackageDataAsync() instead.'
		);
		return null;
	} catch (err) {
		console.error('Failed to load package data:', err);
		return null;
	}
}

/**
 * Load package data from browser storage (async version)
 * @returns PackageStructure or null if no package is stored
 */
export async function loadPackageDataAsync(): Promise<PackageStructure | null> {
	try {
		const packageId = localStorage.getItem(STORAGE_KEY_CURRENT_PACKAGE);
		if (!packageId) return null;

		const storage = new SessionStorageBackend();
		const pkg = await loadPackage(packageId, storage);
		if (!pkg) return null;

		return convertToPackageStructure(pkg);
	} catch (err) {
		console.error('Failed to load package data:', err);
		return null;
	}
}

/**
 * Clear all package data from storage
 */
export async function clearPackageData(): Promise<void> {
	try {
		const packageId = localStorage.getItem(STORAGE_KEY_CURRENT_PACKAGE);
		if (packageId) {
			// Clear the stored package data
			const storage = new SessionStorageBackend();
			await storage.delete(`qti-package-${packageId}`);
		}
		localStorage.removeItem(STORAGE_KEY_CURRENT_PACKAGE);
	} catch (err) {
		console.error('Failed to clear package data:', err);
	}
}

/**
 * Get package data URL for displaying binary assets (images, videos, etc.)
 *
 * @param pkg PackageStructure instance
 * @param path Package-relative path to the asset
 * @returns Data URL or blob URL for the asset
 */
export function getAssetUrl(pkg: PackageStructure, path: string): string | null {
	return pkg._pkg.getDataUrl(path);
}

/**
 * Read text file content from package
 *
 * @param pkg PackageStructure instance
 * @param path Package-relative path to the text file
 * @returns File content as string
 */
export function readTextFile(pkg: PackageStructure, path: string): string | null {
	return pkg._pkg.readText(path);
}

/**
 * List all files in a directory within the package
 *
 * @param pkg PackageStructure instance
 * @param directory Optional directory path (defaults to root)
 * @returns Array of files in the directory
 */
export function listFiles(pkg: PackageStructure, directory?: string) {
	return pkg._pkg.listFiles(directory);
}

/**
 * Get item XML content by identifier
 *
 * @param pkg PackageStructure instance
 * @param itemId Item identifier
 * @returns Item XML content or null
 */
export function getItemXml(pkg: PackageStructure, itemId: string): string | null {
	const item = pkg.items.find((i) => i.identifier === itemId);
	if (!item) return null;
	return pkg._pkg.readText(item.href);
}

/**
 * Get test XML content by identifier
 *
 * @param pkg PackageStructure instance
 * @param testId Test identifier
 * @returns Test XML content or null
 */
export function getTestXml(pkg: PackageStructure, testId: string): string | null {
	const test = pkg.tests.find((t) => t.identifier === testId);
	if (!test) return null;
	return pkg._pkg.readText(test.href);
}
