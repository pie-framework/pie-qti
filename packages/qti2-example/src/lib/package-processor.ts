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

// In-memory cache for package instances (preserves binary files)
// This is necessary because binary files are not persisted to storage
const packageCache = new Map<string, PackageStructure>();

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

	const packageStructure = convertToPackageStructure(pkg);
	
	// Cache the package structure in memory (preserves binary files)
	packageCache.set(pkg.packageId, packageStructure);
	
	return packageStructure;
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

		// First, check if we have the package in memory cache (preserves binary files)
		const cached = packageCache.get(packageId);
		if (cached) {
			console.log('Loaded package from memory cache (preserves binary files)');
			return cached;
		}

		// Fallback: Load from storage (binary files will be missing)
		console.warn('Loading package from storage - binary files (images) will not be available');
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
			// Clear from memory cache
			packageCache.delete(packageId);
			
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

/**
 * Resolve image references in QTI XML and replace with data URLs from package
 * 
 * Finds all <object data="..."> and <img src="..."> tags in the XML and replaces
 * their image paths with data URLs from the package.
 * 
 * @param itemXml The QTI item XML string
 * @param pkg PackageStructure instance containing the images
 * @param itemHref The href path of the item file (used for resolving relative paths)
 * @returns Modified XML string with image references replaced with data URLs
 */
export async function resolveImagesInXml(
	itemXml: string,
	pkg: PackageStructure,
	itemHref: string
): Promise<string> {
	// Create a DOMParser to parse and modify the XML
	const parser = new DOMParser();
	const doc = parser.parseFromString(itemXml, 'text/xml');
	
	// Check for parse errors
	const parseError = doc.querySelector('parsererror');
	if (parseError) {
		console.warn('XML parse error in resolveImagesInXml:', parseError.textContent);
		return itemXml; // Return original if parsing fails
	}
	
	// Debug: Log available images in package
	console.log(`[Image Resolution] Item href: ${itemHref}`);
	console.log(`[Image Resolution] Available images (${pkg.assets.images.length}):`, pkg.assets.images);
	
	// Debug: Log actual files in package (first 10)
	const allFiles = Array.from(pkg._pkg.files.keys());
	const imageFiles = allFiles.filter(f => {
		const ext = f.split('.').pop()?.toLowerCase() || '';
		return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext);
	});
	console.log(`[Image Resolution] Actual image files in package (${imageFiles.length}):`, imageFiles.slice(0, 10));
	
	// Get the directory containing the item file for resolving relative paths
	const itemDir = itemHref.substring(0, itemHref.lastIndexOf('/') + 1);
	console.log(`[Image Resolution] Item directory: ${itemDir}`);
	
	// Helper function to get MIME type from file path
	const getMimeType = (path: string): string => {
		const ext = path.split('.').pop()?.toLowerCase() || '';
		const mimeTypes: Record<string, string> = {
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'png': 'image/png',
			'gif': 'image/gif',
			'svg': 'image/svg+xml',
			'webp': 'image/webp',
		};
		return mimeTypes[ext] || 'image/jpeg'; // Default to jpeg if unknown
	};

	// Helper function to convert blob to data URL (base64) with correct MIME type
	const blobToDataUrl = async (blob: Blob, filePath: string): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				let dataUrl = reader.result as string;
				// Ensure we have the correct MIME type
				const correctMimeType = getMimeType(filePath);
				// Replace the MIME type if it's wrong (e.g., application/octet-stream)
				if (dataUrl.startsWith('data:application/octet-stream') || 
				    dataUrl.startsWith('data:application/octet-stream;')) {
					dataUrl = dataUrl.replace(/^data:[^;]+/, `data:${correctMimeType}`);
				} else if (!dataUrl.startsWith(`data:${correctMimeType}`)) {
					// If MIME type is different, replace it
					dataUrl = dataUrl.replace(/^data:[^;]+/, `data:${correctMimeType}`);
				}
				// Ensure no spaces in the data URL format
				dataUrl = dataUrl.replace(/; /g, ';').replace(/; /g, ';');
				resolve(dataUrl);
			};
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	};

	// Helper function to resolve a single image reference
	const resolveImageReference = async (imagePath: string): Promise<string | null> => {
		// Try multiple path resolution strategies
		const resolvedPaths = tryResolveImagePath(imagePath, itemDir, itemHref);
		
		for (const path of resolvedPaths) {
			// Check if file exists in the package first
			const file = pkg._pkg.getFile(path);
			if (file && file.type === 'binary') {
				const blob = file.content as Blob;
				try {
					const dataUrl = await blobToDataUrl(blob, path);
					console.log(`✓ Resolved image: ${imagePath} -> ${path} -> data URL (${dataUrl.substring(0, 50)}...)`);
					return dataUrl;
				} catch (err) {
					console.warn(`  Failed to convert blob to data URL for: ${path}`, err);
				}
			}
		}
		
		// Fallback: Try to find image by filename in all available images
		const filename = imagePath.split('/').pop() || imagePath.split('\\').pop() || imagePath;
		if (filename) {
			const lowerFilename = filename.toLowerCase();
			
				// Try exact filename match first (case-insensitive)
			for (const availableImage of pkg.assets.images) {
				const lowerAvailable = availableImage.toLowerCase();
				// Check if the available image ends with the filename (case-insensitive)
				if (lowerAvailable.endsWith('/' + lowerFilename) || lowerAvailable.endsWith('\\' + lowerFilename) || lowerAvailable === lowerFilename) {
					const file = pkg._pkg.getFile(availableImage);
					if (file && file.type === 'binary') {
						const blob = file.content as Blob;
						try {
							const dataUrl = await blobToDataUrl(blob, availableImage);
							console.log(`✓ Resolved image by filename match: ${imagePath} -> ${availableImage} -> data URL`);
							return dataUrl;
						} catch (err) {
							console.warn(`  Failed to convert blob to data URL for: ${availableImage}`, err);
						}
					}
				}
			}
			
			// Try matching by image number (e.g., "img11" in "qtiv2p2_G6_Form-dA-img11.jpg")
			// This handles cases where form variants differ (Form-dA vs Form-dB)
			const imgNumberMatch = lowerFilename.match(/img(\d+)/i);
			if (imgNumberMatch) {
				const imgNumber = imgNumberMatch[1]; // e.g., "11"
				for (const availableImage of pkg.assets.images) {
					const availableFilename = availableImage.split('/').pop() || availableImage.split('\\').pop() || availableImage;
					const lowerAvailableFilename = availableFilename.toLowerCase();
					// Check if this image has the same number (e.g., also has "img11")
					if (lowerAvailableFilename.includes('img' + imgNumber) && 
					    lowerAvailableFilename.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
						const file = pkg._pkg.getFile(availableImage);
						if (file && file.type === 'binary') {
							const blob = file.content as Blob;
							try {
								const dataUrl = await blobToDataUrl(blob, availableImage);
								console.log(`✓ Resolved image by number match (img${imgNumber}): ${imagePath} -> ${availableImage} -> data URL`);
								return dataUrl;
							} catch (err) {
								console.warn(`  Failed to convert blob to data URL for: ${availableImage}`, err);
							}
						}
					}
				}
			}
			
			// Try partial match (filename appears anywhere in path)
			for (const availableImage of pkg.assets.images) {
				if (availableImage.toLowerCase().includes(lowerFilename)) {
					const file = pkg._pkg.getFile(availableImage);
					if (file && file.type === 'binary') {
						const blob = file.content as Blob;
						try {
							const dataUrl = await blobToDataUrl(blob, availableImage);
							console.log(`✓ Resolved image by partial match: ${imagePath} -> ${availableImage} -> data URL`);
							return dataUrl;
						} catch (err) {
							console.warn(`  Failed to convert blob to data URL for: ${availableImage}`, err);
						}
					}
				}
			}
			
			// Last resort: Match by filename only, ignoring directory structure
			for (const availableImage of pkg.assets.images) {
				const availableFilename = availableImage.split('/').pop() || availableImage.split('\\').pop() || availableImage;
				if (availableFilename.toLowerCase() === lowerFilename) {
					const file = pkg._pkg.getFile(availableImage);
					if (file && file.type === 'binary') {
						const blob = file.content as Blob;
						try {
							const dataUrl = await blobToDataUrl(blob, availableImage);
							console.log(`✓ Resolved image by filename-only match: ${imagePath} -> ${availableImage} -> data URL`);
							return dataUrl;
						} catch (err) {
							console.warn(`  Failed to convert blob to data URL for: ${availableImage}`, err);
						}
					} else if (file) {
						console.warn(`  Found matching filename but file is not binary: ${availableImage} (type: ${file.type})`);
					} else {
						console.warn(`  Found matching filename but file not found in package: ${availableImage}`);
					}
				}
			}
		}
		
		console.warn(`✗ Could not resolve image: ${imagePath}`);
		console.warn(`  Tried paths: ${resolvedPaths.join(', ')}`);
		console.warn(`  Available images: ${pkg.assets.images.slice(0, 5).join(', ')}${pkg.assets.images.length > 5 ? '...' : ''}`);
		return null;
	};
	
	// Find all <object> tags with data attributes (image references)
	// Use getElementsByTagName to avoid namespace issues
	const objectElements = doc.getElementsByTagName('object');
	for (const obj of Array.from(objectElements)) {
		const dataAttr = obj.getAttribute('data');
		if (!dataAttr) continue;
		
		// Skip if it's already a data URL or blob URL
		if (dataAttr.startsWith('data:') || dataAttr.startsWith('blob:')) {
			// If it's a blob URL, try to resolve it to a data URL
			if (dataAttr.startsWith('blob:')) {
				// Extract the original path if possible, or skip
				continue;
			}
			continue;
		}
		
		const dataUrl = await resolveImageReference(dataAttr);
		if (dataUrl) {
			// Replace the data attribute with the data URL
			obj.setAttribute('data', dataUrl);
		}
	}
	
	// Find all <img> tags with src attributes
	const imgElements = doc.getElementsByTagName('img');
	for (const img of Array.from(imgElements)) {
		const srcAttr = img.getAttribute('src');
		if (!srcAttr) continue;
		
		// Skip if it's already a data URL
		if (srcAttr.startsWith('data:')) {
			continue;
		}
		
		// If it's a blob URL, we need to resolve it
		if (srcAttr.startsWith('blob:')) {
			// Try to find the original path from the blob URL or skip
			// For now, we'll skip blob URLs and let them fail gracefully
			continue;
		}
		
		const dataUrl = await resolveImageReference(srcAttr);
		if (dataUrl) {
			// Replace the src attribute with the data URL
			img.setAttribute('src', dataUrl);
		}
	}
	
	// Serialize back to XML string
	return new XMLSerializer().serializeToString(doc);
}

/**
 * Try multiple strategies to resolve an image path
 * Returns an array of possible paths to try in order
 * 
 * @param imagePath The image path from the XML (may be relative or absolute)
 * @param itemDir The directory containing the item file
 * @param itemHref The full href path of the item file
 * @returns Array of resolved paths to try
 */
function tryResolveImagePath(imagePath: string, itemDir: string, itemHref: string): string[] {
	// Remove query strings and fragments
	const cleanPath = imagePath.split('?')[0].split('#')[0];
	
	// If it's a data URL, return as-is (no resolution needed)
	if (cleanPath.startsWith('data:')) {
		return [cleanPath];
	}
	
	const pathsToTry: string[] = [];
	
	// Strategy 1: If it's already an absolute path (starts with /), use it as-is
	if (cleanPath.startsWith('/')) {
		pathsToTry.push(cleanPath.substring(1)); // Remove leading slash for package paths
		pathsToTry.push(cleanPath); // Also try with leading slash
	}
	
	// Strategy 2: Resolve relative to item directory
	const parts = cleanPath.split('/');
	const dirParts = itemDir.split('/').filter(p => p);
	
	for (const part of parts) {
		if (part === '..') {
			if (dirParts.length > 0) {
				dirParts.pop();
			}
		} else if (part !== '.' && part !== '') {
			dirParts.push(part);
		}
	}
	
	const relativePath = dirParts.join('/');
	pathsToTry.push(relativePath);
	
	// Strategy 3: Try with just the filename in the same directory as item
	const filename = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
	if (filename && filename !== cleanPath) {
		const filenamePath = itemDir + filename;
		pathsToTry.push(filenamePath);
	}
	
	// Strategy 4: Try in an 'images' subdirectory relative to item
	if (filename && filename !== cleanPath) {
		const imagesPath = itemDir + 'images/' + filename;
		pathsToTry.push(imagesPath);
	}
	
	// Strategy 5: Try root-level images directory
	if (filename && filename !== cleanPath) {
		pathsToTry.push('images/' + filename);
	}
	
	// Strategy 6: Try just the filename at root
	if (filename && filename !== cleanPath) {
		pathsToTry.push(filename);
	}
	
	// Remove duplicates and return
	return [...new Set(pathsToTry)];
}

/**
 * Load all items referenced in a QTI assessment test XML
 * 
 * Parses the test XML to find item references, loads each item's XML,
 * resolves images in each item, and returns a map of item identifiers/hrefs to resolved XML.
 * 
 * @param testXml The QTI assessment test XML string
 * @param pkg PackageStructure instance containing the items
 * @param testHref The href path of the test file (used for resolving relative item paths)
 * @returns Promise resolving to a map of item identifiers/hrefs to resolved XML strings
 */
export async function loadTestItems(
	testXml: string,
	pkg: PackageStructure,
	testHref: string
): Promise<Record<string, string>> {
	const parser = new DOMParser();
	const doc = parser.parseFromString(testXml, 'text/xml');
	
	// Check for parse errors
	const parseError = doc.querySelector('parsererror');
	if (parseError) {
		console.warn('XML parse error in loadTestItems:', parseError.textContent);
		return {};
	}
	
	// Get the directory containing the test file for resolving relative paths
	const testDir = testHref.includes('/') ? testHref.substring(0, testHref.lastIndexOf('/') + 1) : '';
	
	// Find all assessmentItemRef elements
	const itemRefs = doc.getElementsByTagName('assessmentItemRef');
	const items: Record<string, string> = {};
	
	for (const ref of Array.from(itemRefs)) {
		const href = ref.getAttribute('href');
		const identifier = ref.getAttribute('identifier');
		
		if (!href) {
			console.warn('assessmentItemRef missing href attribute');
			continue;
		}
		
		// Resolve item path relative to test file
		let itemPath = href;
		if (!href.startsWith('/') && testDir) {
			// Resolve relative to test directory
			itemPath = testDir + href;
			// Normalize path (remove ./ and ../)
			const parts = itemPath.split('/');
			const resolved: string[] = [];
			for (const part of parts) {
				if (part === '.' || part === '') continue;
				if (part === '..') {
					resolved.pop();
				} else {
					resolved.push(part);
				}
			}
			itemPath = resolved.join('/');
		} else if (href.startsWith('/')) {
			itemPath = href.substring(1); // Remove leading /
		}
		
		// Try to find the item by href
		const item = pkg.items.find((i) => i.href === itemPath || i.href === href);
		if (!item) {
			console.warn(`Item not found for href: ${href} (resolved: ${itemPath})`);
			continue;
		}
		
		// Load item XML
		const rawItemXml = pkg._pkg.readText(item.href);
		if (!rawItemXml) {
			console.warn(`Could not read item XML for href: ${item.href}`);
			continue;
		}
		
		// Resolve images in item XML
		const resolvedXml = await resolveImagesInXml(rawItemXml, pkg, item.href);
		
		// Verify resolved XML contains itemBody (basic sanity check)
		if (!resolvedXml.includes('<itemBody')) {
			console.error(`[loadTestItems] WARNING: Resolved XML for item "${identifier || href}" does not contain <itemBody> tag!`);
			console.error(`[loadTestItems] Original XML length: ${rawItemXml.length}, Resolved XML length: ${resolvedXml.length}`);
		}
		
		// Store by multiple keys for flexible lookup
		// Store original href as-is (may include path variations)
		items[href] = resolvedXml;
		
		// Store by identifier if available
		if (identifier) {
			items[identifier] = resolvedXml;
		}
		
		// Store by resolved path
		items[itemPath] = resolvedXml;
		
		// Store by item's actual href from package
		items[item.href] = resolvedXml;
		
		// Store by item's identifier from package
		if (item.identifier) {
			items[item.identifier] = resolvedXml;
		}
		
		// Also try storing by filename only (for cases where href is just filename)
		const filename = href.split('/').pop() || href.split('\\').pop() || href;
		if (filename && filename !== href) {
			items[filename] = resolvedXml;
		}
		
		// Debug: Log what keys we're storing for this item
		console.log(`[loadTestItems] Stored item "${identifier || href}" with keys:`, {
			href,
			identifier,
			itemPath,
			itemHref: item.href,
			itemIdentifier: item.identifier,
			filename,
			hasItemBody: resolvedXml.includes('<itemBody'),
			hasImages: resolvedXml.includes('<img') || resolvedXml.includes('<object'),
		});
	}
	
	return items;
}
