/**
 * Client-side QTI package processing utilities
 * Uses @pie-qti/ims-cp-browser for package handling
 */

import {
	openPackage,
	loadPackageFromStorage as loadPackage,
	SessionStorageBackend,
	resolveImagesInXml as resolveImagesInXmlCore,
} from '@pie-qti/ims-cp-browser';
import type { VirtualPackage } from '@pie-qti/ims-cp-browser';
import {
	buildPackageFileIndex,
	createResolvedItemDeliveryContext,
	extractAssessmentStimulusRefs,
	extractQtiItemMetadata,
	resolvePackageReference,
	type AssessmentStimulusRef,
	type QtiItemMetadata,
	type ResolvedItemDeliveryContext
} from '@pie-qti/ims-cp-core';
import { createLogger } from '@pie-qti/logger/browser';

// Storage key for the current package ID
const STORAGE_KEY_CURRENT_PACKAGE = 'qti-current-package-id';

// In-memory cache for package instances (preserves binary files)
// This is necessary because binary files are not persisted to storage
// Implements LRU eviction: maximum 5 packages, or approximately 250MB
const MAX_CACHE_SIZE = 5;
const packageCache = new Map<string, PackageStructure>();

// Logger for package processing operations
const logger = createLogger('PackageProcessor');

/**
 * Package item with comprehensive metadata
 */
export interface PackageItem {
	identifier: string;
	href: string;
	title?: string;
	/** Full QTI metadata extracted from XML */
	metadata?: QtiItemMetadata;
}

/**
 * Package test with comprehensive metadata
 */
export interface PackageTest {
	identifier: string;
	href: string;
	title?: string;
	/** Full QTI metadata extracted from XML */
	metadata?: QtiItemMetadata;
}

/**
 * Evict oldest package from cache if we exceed the maximum size
 * Uses LRU (Least Recently Used) strategy
 */
function evictOldestPackageIfNeeded(): void {
	if (packageCache.size >= MAX_CACHE_SIZE) {
		// Map maintains insertion order, so first key is oldest
		const oldestKey = packageCache.keys().next().value;
		if (oldestKey) {
			logger.debug(`Evicting package from cache: ${oldestKey}`);
			packageCache.delete(oldestKey);
		}
	}
}

/**
 * Package structure with comprehensive item and asset metadata
 */
export interface PackageStructure {
	packageId: string;
	items: PackageItem[];
	tests: PackageTest[];
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
	// Evict oldest package if cache is full
	evictOldestPackageIfNeeded();
	packageCache.set(pkg.packageId, packageStructure);

	return packageStructure;
}

/**
 * Load a conformance package ZIP from a URL and process it.
 *
 * Fetches the ZIP, wraps it in a File, and passes it through the standard
 * processPackage() pipeline — identical to user-uploaded packages.
 *
 * @param zipUrl Absolute URL to a .zip IMS Content Package
 */
export async function loadConformancePackageFromUrl(zipUrl: string): Promise<PackageStructure> {
	const response = await fetch(zipUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch conformance package: ${response.status} ${zipUrl}`);
	}
	const blob = await response.blob();
	const filename = zipUrl.split('/').pop() ?? 'package.zip';
	const file = new File([blob], filename, { type: 'application/zip' });
	return processPackage(file);
}

/**
 * Convert VirtualPackage to PackageStructure format
 */
function convertToPackageStructure(pkg: VirtualPackage): PackageStructure {
	const items = pkg.manifest.items
		.filter((item) => item.hrefResolved) // Filter out items without hrefs
		.map((item) => {
			// Extract comprehensive metadata from XML content
			let metadata: QtiItemMetadata | undefined;
			if (item.hrefResolved) {
				const xmlContent = pkg.readText(item.hrefResolved);
				if (xmlContent) {
					metadata = extractQtiItemMetadata(xmlContent);
				}
			}

			// Use metadata title or fallback to identifier
			const title = metadata?.title || item.identifier;

			return {
				identifier: item.identifier,
				href: item.hrefResolved as string, // Safe after filter
				title,
				metadata
			};
		});

	const tests = pkg.manifest.tests
		.filter((test) => test.hrefResolved) // Filter out tests without hrefs
		.map((test) => {
			// Extract comprehensive metadata from XML content
			let metadata: QtiItemMetadata | undefined;
			if (test.hrefResolved) {
				const xmlContent = pkg.readText(test.hrefResolved);
				if (xmlContent) {
					metadata = extractQtiItemMetadata(xmlContent);
				}
			}

			// Use metadata title or fallback to identifier
			const title = metadata?.title || test.identifier;

			return {
				identifier: test.identifier,
				href: test.hrefResolved as string, // Safe after filter
				title,
				metadata
			};
		});

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
export async function loadPackageDataAsync(): Promise<PackageStructure | null> {
	try {
		const packageId = localStorage.getItem(STORAGE_KEY_CURRENT_PACKAGE);
		if (!packageId) return null;

		// First, check if we have the package in memory cache (preserves binary files)
		const cached = packageCache.get(packageId);
		if (cached) {
			logger.debug('Loaded package from memory cache (preserves binary files)');
			return cached;
		}

		// Fallback: Load from storage (binary files will be missing)
		logger.warn('Loading package from storage - binary files (images) will not be available');
		const storage = new SessionStorageBackend();
		const pkg = await loadPackage(packageId, storage);
		if (!pkg) return null;

		return convertToPackageStructure(pkg);
	} catch (err) {
		logger.error('Failed to load package data:', err);
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
		logger.error('Failed to clear package data:', err);
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
 * This is a wrapper around the core implementation from @pie-qti/ims-cp-browser
 * that provides compatibility with the PackageStructure interface.
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
	// Use the core implementation from ims-cp-browser with our logger
	const resolvedImages = await resolveImagesInXmlCore(itemXml, pkg._pkg, itemHref, { logger });
	return resolveMediaReferencesInXml(resolvedImages, pkg, itemHref);
}

function resolveMediaReferencesInXml(xml: string, pkg: PackageStructure, itemHref: string): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'text/xml');
	if (doc.querySelector('parsererror') || doc.documentElement.nodeName === 'parsererror') {
		return xml;
	}

	const fileIndex = buildPackageFileIndex([...pkg._pkg.files.keys()]);
	for (const el of Array.from(doc.querySelectorAll('video[src], audio[src], source[src], track[src], embed[src], object[data]'))) {
		const attr = el.hasAttribute('data') ? 'data' : 'src';
		const raw = el.getAttribute(attr);
		if (!raw) {
			continue;
		}
		if (raw.startsWith('data:') || raw.startsWith('blob:') || /^https?:\/\//i.test(raw)) {
			continue;
		}
		if (el.tagName.toLowerCase() === 'object' && !isResolvableMediaObject(el.getAttribute('type'))) {
			continue;
		}

		const resolved = resolvePackageReference({
			fileIndex,
			sourcePath: itemHref,
			rawHref: raw,
			referenceKind: 'media-asset',
		});
		const resolvedUrl = resolved.status === 'resolved' ? pkg._pkg.getDataUrl(resolved.resolvedPath) : null;
		if (resolvedUrl) {
			el.setAttribute(attr, resolvedUrl);
		} else {
			el.removeAttribute(attr);
		}
	}

	return new XMLSerializer().serializeToString(doc);
}

function isResolvableMediaObject(type: string | null): boolean {
	return !type || /^(?:image|audio|video)\//i.test(type);
}

export type StimulusRef = AssessmentStimulusRef;

/**
 * Extract qti-assessment-stimulus-ref elements from QTI 3.0 item XML.
 * Returns an array of stimulus references found in the item.
 */
export function extractStimulusRefsFromItemXml(xml: string): StimulusRef[] {
	return extractAssessmentStimulusRefs(xml);
}

/**
 * Load stimulus HTML content for a set of stimulus references.
 * Reads each stimulus file from the package, extracts the qti-stimulus-body content,
 * and resolves embedded image paths to data URLs.
 *
 * @param pkg PackageStructure containing the stimulus files
 * @param itemHref The href path of the item file (for resolving relative stimulus paths)
 * @param refs Array of stimulus references from the item XML
 * @returns Record mapping stimulus identifier → rendered HTML string
 */
export async function loadStimulusContent(
	pkg: PackageStructure,
	itemHref: string,
	refs: StimulusRef[]
): Promise<Record<string, string>> {
	const itemXml = pkg._pkg.readText(itemHref) ?? '';
	const deliveryContext = await loadItemDeliveryContext(pkg, itemHref, itemXml);
	return Object.fromEntries(
		refs
			.map((ref) => [ref.identifier, deliveryContext.stimuli[ref.identifier]?.bodyHtml] as const)
			.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
	);
}

export async function loadItemDeliveryContext(
	pkg: PackageStructure,
	itemHref: string,
	itemXml: string
): Promise<ResolvedItemDeliveryContext> {
	const filePaths = [...pkg._pkg.files.keys()];
	const context = createResolvedItemDeliveryContext({
		itemXml,
		itemHref,
		fileIndex: buildPackageFileIndex(filePaths),
		manifestEvidencePaths: manifestEvidencePaths(pkg),
		readText: (path) => pkg._pkg.readText(path),
		resolveAssetUrl: (path) => pkg._pkg.getDataUrl(path),
	});

	for (const message of context.validationMessages) {
		logger.warn(message);
	}

	return context;
}

function manifestEvidencePaths(pkg: PackageStructure): Set<string> {
	const paths = new Set<string>();
	for (const resource of pkg._pkg.manifest.resources.values()) {
		if (resource.hrefResolved) {
			paths.add(resource.hrefResolved);
		}
		for (const filePath of resource.filesResolved) {
			paths.add(filePath);
		}
	}
	return paths;
}
