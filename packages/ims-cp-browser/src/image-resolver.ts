/**
 * Image resolution utilities for QTI packages
 *
 * Handles resolving image references in QTI XML and converting them to data URLs
 * for display in browsers. This is a core package concern since all QTI content
 * displayed in browsers needs image resolution.
 */

import type { VirtualPackage } from './virtual-package.js';

/**
 * Get MIME type from file path extension
 */
function getMimeType(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase() || '';
	const mimeTypes: Record<string, string> = {
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'svg': 'image/svg+xml',
		'webp': 'image/webp',
	};
	return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Convert Blob to data URL with correct MIME type
 */
async function blobToDataUrl(blob: Blob, filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			let dataUrl = reader.result as string;
			const correctMimeType = getMimeType(filePath);

			// Replace incorrect MIME types (e.g., application/octet-stream)
			if (dataUrl.startsWith('data:application/octet-stream') ||
			    !dataUrl.startsWith(`data:${correctMimeType}`)) {
				dataUrl = dataUrl.replace(/^data:[^;]+/, `data:${correctMimeType}`);
			}

			// Ensure no spaces in data URL format
			dataUrl = dataUrl.replace(/; /g, ';');
			resolve(dataUrl);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

/**
 * Try multiple strategies to resolve an image path
 * Returns an array of possible paths to try in order
 *
 * @param imagePath The image path from the XML (may be relative or absolute)
 * @param itemDir The directory containing the item file
 * @returns Array of resolved paths to try
 */
export function tryResolveImagePath(imagePath: string, itemDir: string): string[] {
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
		pathsToTry.push(itemDir + filename);
	}

	// Strategy 4: Try in an 'images' subdirectory relative to item
	if (filename && filename !== cleanPath) {
		pathsToTry.push(itemDir + 'images/' + filename);
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
 * Logger interface compatible with @pie-qti/browser-utils Logger
 */
export interface LoggerLike {
	debug: (message: string, ...args: any[]) => void;
	warn: (message: string, ...args: any[]) => void;
}

/**
 * QTI Heuristics Config interface (minimal subset needed here)
 */
export interface QtiHeuristicsConfig {
	enabled?: boolean;
	lenientImagePaths?: boolean;
}

/**
 * Options for image resolution
 */
export interface ResolveImagesOptions {
	/**
	 * Optional logger for debug/warning messages
	 * Compatible with @pie-qti/browser-utils Logger
	 */
	logger?: LoggerLike;

	/**
	 * Optional heuristics configuration
	 * Controls whether to use lenient image path resolution for non-standard QTI content
	 */
	heuristicsConfig?: QtiHeuristicsConfig;
}

/**
 * Resolve image references in QTI XML and replace with data URLs from package
 *
 * Finds all <object data="..."> and <img src="..."> tags in the XML and replaces
 * their image paths with data URLs from the package.
 *
 * @param itemXml The QTI item XML string
 * @param pkg VirtualPackage instance containing the images
 * @param itemHref The href path of the item file (used for resolving relative paths)
 * @param options Optional configuration
 * @returns Modified XML string with image references replaced with data URLs
 */
export async function resolveImagesInXml(
	itemXml: string,
	pkg: VirtualPackage,
	itemHref: string,
	options: ResolveImagesOptions = {}
): Promise<string> {
	const { logger, heuristicsConfig = { enabled: true, lenientImagePaths: true } } = options;

	// Check if lenient image path resolution is enabled
	const useLenientPaths = heuristicsConfig.enabled !== false && heuristicsConfig.lenientImagePaths !== false;

	if (useLenientPaths) {
		logger?.debug(
			'[QTI Heuristic] Using lenient image path resolution. ' +
			'Will try multiple path strategies for images that do not follow strict relative path conventions.'
		);
	}

	// Create a DOMParser to parse and modify the XML
	const parser = new DOMParser();
	const doc = parser.parseFromString(itemXml, 'text/xml');

	// Check for parse errors using multiple detection methods for better browser compatibility
	// Different browsers may format parse errors differently:
	// - Firefox: <parsererror xmlns="http://www.mozilla.org/newlayout/xml/parsererror.xml">
	// - Chrome/Safari: Different structure
	const parseError = doc.querySelector('parsererror');
	const isParseError = parseError !== null || doc.documentElement.nodeName === 'parsererror';

	if (isParseError) {
		const errorMessage = parseError?.textContent || 'Unknown XML parse error';
		logger?.warn('XML parse error in resolveImagesInXml:', errorMessage);
		return itemXml; // Return original if parsing fails
	}

	// Get the directory containing the item file for resolving relative paths
	const itemDir = itemHref.substring(0, itemHref.lastIndexOf('/') + 1);
	logger?.debug(`[Image Resolution] Item directory: ${itemDir}`);

	// Get list of available images in package
	const availableImages = Array.from(pkg.files.keys()).filter(path => {
		const ext = path.split('.').pop()?.toLowerCase() || '';
		return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext);
	});

	logger?.debug(`[Image Resolution] Available images (${availableImages.length})`, availableImages);

	/**
	 * Resolve a single image reference
	 */
	const resolveImageReference = async (imagePath: string): Promise<string | null> => {
		// Try multiple path resolution strategies
		const resolvedPaths = tryResolveImagePath(imagePath, itemDir);

		for (const path of resolvedPaths) {
			const file = pkg.getFile(path);
			if (!file) continue;
			if (file.type === 'binary') {
				const blob = file.content as Blob;
				try {
					const dataUrl = await blobToDataUrl(blob, path);
					logger?.debug(`✓ Resolved image: ${imagePath} -> ${path}`);
					return dataUrl;
				} catch (err) {
					logger?.warn(`Failed to convert blob to data URL for: ${path}`, err);
				}
			} else if (file.type === 'text' && path.toLowerCase().endsWith('.svg')) {
				// SVGs are stored as text strings; encode as data URL directly
				const encoded = encodeURIComponent(file.content as string);
				logger?.debug(`✓ Resolved SVG (text): ${imagePath} -> ${path}`);
				return `data:image/svg+xml,${encoded}`;
			}
		}

		// Lenient fallback (heuristic): Try to find image by filename in all available images
		// This helps with non-standard QTI content where image paths don't follow strict conventions
		if (!useLenientPaths) {
			// Strict mode: if standard resolution failed, give up
			logger?.warn(`Could not resolve image (strict mode): ${imagePath}`);
			return null;
		}

		const filename = imagePath.split('/').pop() || imagePath.split('\\').pop() || imagePath;
		if (filename) {
			const lowerFilename = filename.toLowerCase();

			// Try exact filename match (case-insensitive)
			for (const availableImage of availableImages) {
				const lowerAvailable = availableImage.toLowerCase();
				if (lowerAvailable.endsWith('/' + lowerFilename) ||
				    lowerAvailable.endsWith('\\' + lowerFilename) ||
				    lowerAvailable === lowerFilename) {
					const file = pkg.getFile(availableImage);
					if (!file) continue;
					if (file.type === 'text' && availableImage.toLowerCase().endsWith('.svg')) {
						const encoded = encodeURIComponent(file.content as string);
						logger?.debug(`✓ Resolved SVG by filename: ${imagePath} -> ${availableImage}`);
						return `data:image/svg+xml,${encoded}`;
					} else if (file.type === 'binary') {
						try {
							const dataUrl = await blobToDataUrl(file.content as Blob, availableImage);
							logger?.debug(`✓ Resolved image by filename: ${imagePath} -> ${availableImage}`);
							return dataUrl;
						} catch (err) {
							logger?.warn(`Failed to convert blob to data URL for: ${availableImage}`, err);
						}
					}
				}
			}

			// Try partial match (filename appears anywhere in path)
			for (const availableImage of availableImages) {
				if (availableImage.toLowerCase().includes(lowerFilename)) {
					const file = pkg.getFile(availableImage);
					if (!file) continue;
					if (file.type === 'text' && availableImage.toLowerCase().endsWith('.svg')) {
						const encoded = encodeURIComponent(file.content as string);
						logger?.debug(`✓ Resolved SVG by partial match: ${imagePath} -> ${availableImage}`);
						return `data:image/svg+xml,${encoded}`;
					} else if (file.type === 'binary') {
						try {
							const dataUrl = await blobToDataUrl(file.content as Blob, availableImage);
							logger?.debug(`✓ Resolved image by partial match: ${imagePath} -> ${availableImage}`);
							return dataUrl;
						} catch (err) {
							logger?.warn(`Failed to convert blob to data URL for: ${availableImage}`, err);
						}
					}
				}
			}
		}

		logger?.warn(`[QTI Heuristic] Could not resolve image even with lenient path resolution: ${imagePath}`);
		return null;
	};

	// Find all <object> tags with data attributes (image references)
	const objectElements = doc.getElementsByTagName('object');
	for (const obj of Array.from(objectElements)) {
		const dataAttr = obj.getAttribute('data');
		if (!dataAttr) continue;

		// Skip if it's already a data URL or blob URL
		if (dataAttr.startsWith('data:') || dataAttr.startsWith('blob:')) {
			continue;
		}

		const dataUrl = await resolveImageReference(dataAttr);
		if (dataUrl) {
			obj.setAttribute('data', dataUrl);
		}
	}

	// Find all <img> tags with src attributes
	const imgElements = doc.getElementsByTagName('img');
	for (const img of Array.from(imgElements)) {
		const srcAttr = img.getAttribute('src');
		if (!srcAttr) continue;

		// Skip if it's already a data URL or blob URL
		if (srcAttr.startsWith('data:') || srcAttr.startsWith('blob:')) {
			continue;
		}

		const dataUrl = await resolveImageReference(srcAttr);
		if (dataUrl) {
			img.setAttribute('src', dataUrl);
		}
	}

	// Serialize back to XML string
	return new XMLSerializer().serializeToString(doc);
}
