/**
 * Client-side QTI package processing utilities
 * Handles ZIP extraction, parsing, and storage in the browser
 */

import JSZip from 'jszip';
import { parseString } from 'xml2js';

// Security: Maximum file size (50MB) to prevent browser memory issues
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Security: Maximum number of files in a package
const MAX_FILES_IN_PACKAGE = 1000;

// Storage keys
const STORAGE_KEY_PACKAGE_DATA = 'qti-package-data';
const STORAGE_KEY_PACKAGE_FILES = 'qti-package-files';

export interface PackageItem {
	identifier: string;
	href: string;
	title?: string;
}

export interface PackageTest {
	identifier: string;
	href: string;
	title?: string;
}

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
}

/**
 * Parse XML string to JavaScript object
 */
function parseXml(xmlString: string): Promise<any> {
	return new Promise((resolve, reject) => {
		parseString(xmlString, (err, result) => {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
}

/**
 * Extract title from resource metadata
 */
function extractTitleFromMetadata(resource: any): string | undefined {
	const metadata = resource.metadata?.[0];
	if (metadata) {
		const lom = metadata.lom?.[0];
		if (lom) {
			const general = lom.general?.[0];
			if (general) {
				const title = general.title?.[0]?.string?.[0]?._ || general.title?.[0]?.string?.[0];
				if (title) return title;
			}
		}
	}
	return undefined;
}

/**
 * Extract title from QTI item/test XML content
 * Handles both attribute-style (title="...") and element-style (<title>...</title>) titles
 */
function extractTitleFromQtiXml(xmlContent: string): string | undefined {
	if (!xmlContent) return undefined;

	// Try attribute-style title first: <assessmentItem title="...">
	const attributeMatch = xmlContent.match(/<assessmentItem[^>]*\s+title=["']([^"']+)["']/i);
	if (attributeMatch && attributeMatch[1]) {
		return attributeMatch[1].trim();
	}

	// Try test attribute-style: <assessmentTest title="...">
	const testAttributeMatch = xmlContent.match(/<assessmentTest[^>]*\s+title=["']([^"']+)["']/i);
	if (testAttributeMatch && testAttributeMatch[1]) {
		return testAttributeMatch[1].trim();
	}

	// Try element-style title: <title>...</title>
	// Look for title element that's a direct child of assessmentItem or assessmentTest
	const elementMatch = xmlContent.match(/<(?:assessmentItem|assessmentTest)[^>]*>[\s\S]*?<title[^>]*>([^<]+)<\/title>/i);
	if (elementMatch && elementMatch[1]) {
		return elementMatch[1].trim();
	}

	// Fallback: look for any <title> element (less specific but might catch some cases)
	const fallbackMatch = xmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
	if (fallbackMatch && fallbackMatch[1]) {
		return fallbackMatch[1].trim();
	}

	return undefined;
}

/**
 * Process a QTI package ZIP file client-side
 */
export async function processPackage(file: File): Promise<PackageStructure> {
	// Security: Validate file size
	if (file.size > MAX_FILE_SIZE) {
		throw new Error(
			`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
		);
	}

	// Load ZIP file
	const zip = await JSZip.loadAsync(file);

	// Security: Validate file count
	const fileCount = Object.keys(zip.files).length;
	if (fileCount > MAX_FILES_IN_PACKAGE) {
		throw new Error(
			`Package contains ${fileCount} files, exceeds maximum of ${MAX_FILES_IN_PACKAGE}`
		);
	}

	// Extract all files into memory
	const files: Record<string, string> = {};
	const binaryFiles: Record<string, Blob> = {};

	for (const [path, zipEntry] of Object.entries(zip.files)) {
		if (!zipEntry.dir) {
			// Security: Basic path validation (no absolute paths)
			if (path.startsWith('/') || path.includes('..')) {
				console.warn(`Skipping potentially unsafe path: ${path}`);
				continue;
			}

			// Determine if file is text or binary based on extension
			const isText =
				path.endsWith('.xml') ||
				path.endsWith('.txt') ||
				path.endsWith('.json') ||
				path.endsWith('.css') ||
				path.endsWith('.html');

			if (isText) {
				files[path] = await zipEntry.async('text');
			} else {
				binaryFiles[path] = await zipEntry.async('blob');
			}
		}
	}

	// Parse imsmanifest.xml
	let manifest: any = null;
	let manifestPath = 'imsmanifest.xml';

	if (files[manifestPath]) {
		manifest = await parseXml(files[manifestPath]);
	} else {
		// Try to find manifest in subdirectories
		const manifestFile = Object.keys(files).find((path) => path.endsWith('imsmanifest.xml'));
		if (manifestFile) {
			manifestPath = manifestFile;
			manifest = await parseXml(files[manifestFile]);
		}
	}

	if (!manifest) {
		throw new Error('No imsmanifest.xml found in ZIP file');
	}

	// Extract all resources from manifest
	const resources = manifest.manifest?.resources?.[0]?.resource || [];

	// Extract items (QTI items)
	const items: PackageItem[] = resources
		.filter((r: any) => {
			if (!r.$) return false;
			const type = r.$?.type || '';
			return (
				type.includes('imsqti_item') ||
				type.includes('imsqti_assessmentitem') ||
				(r.dependency && r.dependency.some((d: any) => d.$?.identifierref?.startsWith('ITEM-')))
			);
		})
		.map((r: any) => ({
			identifier: r.$?.identifier || '',
			href: r.$?.href || '',
			title: r.$?.title || extractTitleFromMetadata(r)
		}))
		.filter((item: PackageItem) => item.identifier && item.href);

	// Also scan items directory for actual item files and update titles
	// This ensures we get titles from the actual QTI XML files, not just the manifest
	const itemFiles = Object.keys(files).filter(
		(path) => path.startsWith('items/') && path.endsWith('.xml')
	);
	for (const itemPath of itemFiles) {
		const itemContent = files[itemPath];
		const identifierMatch = itemContent.match(/identifier=["']([^"']+)["']/);

		if (identifierMatch) {
			const identifier = identifierMatch[1];
			const extractedTitle = extractTitleFromQtiXml(itemContent);
			
			// Try to find existing item and update its title
			const existingItem = items.find((i) => i.identifier === identifier);
			if (existingItem) {
				// Always prefer title from XML file if available (it's more accurate)
				if (extractedTitle) {
					existingItem.title = extractedTitle;
				}
			} else {
				// Add new item if not found
				items.push({
					identifier,
					href: itemPath,
					title: extractedTitle
				});
			}
		}
	}
	
	// Also check items found in manifest - try to extract titles from their XML files
	for (const item of items) {
		if (!item.title && item.href && files[item.href]) {
			const extractedTitle = extractTitleFromQtiXml(files[item.href]);
			if (extractedTitle) {
				item.title = extractedTitle;
			}
		}
	}

	// Extract tests (QTI assessments)
	const tests: PackageTest[] = resources
		.filter((r: any) => {
			if (!r.$) return false;
			const type = r.$?.type || '';
			return type.includes('imsqti_test') || type.includes('imsqti_assessmenttest');
		})
		.map((r: any) => ({
			identifier: r.$?.identifier || '',
			href: r.$?.href || '',
			title: r.$?.title || extractTitleFromMetadata(r)
		}))
		.filter((test: PackageTest) => test.identifier && test.href);

	// Also scan tests directory and update titles
	// This ensures we get titles from the actual QTI XML files, not just the manifest
	const testFiles = Object.keys(files).filter(
		(path) => path.startsWith('tests/') && path.endsWith('.xml')
	);
	for (const testPath of testFiles) {
		const testContent = files[testPath];
		const identifierMatch = testContent.match(/identifier=["']([^"']+)["']/);

		if (identifierMatch) {
			const identifier = identifierMatch[1];
			const extractedTitle = extractTitleFromQtiXml(testContent);
			
			// Try to find existing test and update its title
			const existingTest = tests.find((t) => t.identifier === identifier);
			if (existingTest) {
				// Always prefer title from XML file if available (it's more accurate)
				if (extractedTitle) {
					existingTest.title = extractedTitle;
				}
			} else {
				// Add new test if not found
				tests.push({
					identifier,
					href: testPath,
					title: extractedTitle
				});
			}
		}
	}
	
	// Also check tests found in manifest - try to extract titles from their XML files
	for (const test of tests) {
		if (!test.title && test.href && files[test.href]) {
			const extractedTitle = extractTitleFromQtiXml(files[test.href]);
			if (extractedTitle) {
				test.title = extractedTitle;
			}
		}
	}

	// Find assets
	const allPaths = [...Object.keys(files), ...Object.keys(binaryFiles)];

	const images = allPaths.filter(
		(p) => p.startsWith('images/') && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(p)
	);

	const styles = allPaths.filter((p) => p.startsWith('styles/') && p.endsWith('.css'));

	const audio = allPaths.filter(
		(p) => p.startsWith('audio/') && /\.(mp3|wav|ogg|m4a)$/i.test(p)
	);

	const video = allPaths.filter(
		(p) => p.startsWith('video/') && /\.(mp4|webm|ogg|mov)$/i.test(p)
	);

	const passages = allPaths.filter((p) => p.startsWith('passages/') && p.endsWith('.xml'));

	const packageId = `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

	const packageStructure: PackageStructure = {
		packageId,
		items,
		tests,
		assets: {
			images,
			styles,
			audio,
			video,
			passages
		},
		manifest
	};

	// Store package data and files in localStorage/sessionStorage
	storePackageData(packageStructure, files, binaryFiles);

	return packageStructure;
}

/**
 * Store package data in browser storage
 * Uses localStorage for metadata, sessionStorage for file content (to avoid size limits)
 */
function storePackageData(
	packageData: PackageStructure,
	files: Record<string, string>,
	binaryFiles: Record<string, Blob>
): void {
	try {
		// Store package metadata in localStorage
		localStorage.setItem(STORAGE_KEY_PACKAGE_DATA, JSON.stringify(packageData));

		// Store text files in sessionStorage (cleared on tab close)
		sessionStorage.setItem(STORAGE_KEY_PACKAGE_FILES, JSON.stringify(files));

		// Binary files are handled differently - we'll convert to data URLs for storage
		// Note: This has size limitations, but works for demo purposes
		const binaryFilePromises = Object.entries(binaryFiles).map(async ([path, blob]) => {
			const reader = new FileReader();
			return new Promise<[string, string]>((resolve) => {
				reader.onload = () => {
					resolve([path, reader.result as string]);
				};
				reader.readAsDataURL(blob);
			});
		});

		Promise.all(binaryFilePromises).then((binaryData) => {
			const binaryFilesData = Object.fromEntries(binaryData);
			sessionStorage.setItem('qti-package-binary-files', JSON.stringify(binaryFilesData));
		});

		console.log('Package data stored in browser storage');
	} catch (err) {
		console.error('Failed to store package data:', err);
		throw new Error(
			'Failed to store package data. Package may be too large for browser storage.'
		);
	}
}

/**
 * Load package data from browser storage
 */
export function loadPackageData(): PackageStructure | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY_PACKAGE_DATA);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (err) {
		console.error('Failed to load package data:', err);
	}
	return null;
}

/**
 * Get item XML content by identifier
 */
export function getItemXml(itemId: string): string | null {
	try {
		const filesJson = sessionStorage.getItem(STORAGE_KEY_PACKAGE_FILES);
		if (!filesJson) return null;

		const files: Record<string, string> = JSON.parse(filesJson);
		const packageData = loadPackageData();
		if (!packageData) return null;

		// Find the item
		const item = packageData.items.find((i) => i.identifier === itemId);
		if (!item) return null;

		// Return the XML content
		return files[item.href] || null;
	} catch (err) {
		console.error('Failed to get item XML:', err);
		return null;
	}
}

/**
 * Get test XML content by identifier
 */
export function getTestXml(testId: string): string | null {
	try {
		const filesJson = sessionStorage.getItem(STORAGE_KEY_PACKAGE_FILES);
		if (!filesJson) return null;

		const files: Record<string, string> = JSON.parse(filesJson);
		const packageData = loadPackageData();
		if (!packageData) return null;

		// Find the test
		const test = packageData.tests.find((t) => t.identifier === testId);
		if (!test) return null;

		// Return the XML content
		return files[test.href] || null;
	} catch (err) {
		console.error('Failed to get test XML:', err);
		return null;
	}
}

/**
 * Clear all package data from storage
 */
export function clearPackageData(): void {
	localStorage.removeItem(STORAGE_KEY_PACKAGE_DATA);
	sessionStorage.removeItem(STORAGE_KEY_PACKAGE_FILES);
	sessionStorage.removeItem('qti-package-binary-files');
}

/**
 * Get asset data URL (for images, etc.)
 */
export function getAssetDataUrl(assetPath: string): string | null {
	try {
		const binaryFilesJson = sessionStorage.getItem('qti-package-binary-files');
		if (!binaryFilesJson) return null;

		const binaryFiles: Record<string, string> = JSON.parse(binaryFilesJson);
		return binaryFiles[assetPath] || null;
	} catch (err) {
		console.error('Failed to get asset:', err);
		return null;
	}
}
