/**
 * Browser-based ZIP package extraction and manifest resolution
 */

import JSZip from 'jszip';
import { parseManifest } from '@pie-qti/ims-cp-core/manifest-parser';
import type { ParsedManifest } from '@pie-qti/ims-cp-core/manifest-parser';
import { toPosixPath, joinPosix, applyXmlBase, dirname } from './path-utils.js';
import type { VirtualFile, ExtractOptions } from './types.js';

/**
 * Check if a file path indicates a text file (should be stored as string)
 */
function isTextFile(path: string): boolean {
	const ext = path.split('.').pop()?.toLowerCase();
	return ['xml', 'html', 'htm', 'txt', 'json', 'css', 'js', 'svg', 'md'].includes(ext || '');
}

/**
 * Extract all files from a ZIP package
 */
export async function extractPackage(
	file: File,
	options: ExtractOptions
): Promise<{ files: Map<string, VirtualFile>; manifestXml: string; manifestPath: string }> {
	const zip = await JSZip.loadAsync(file);
	const files = new Map<string, VirtualFile>();

	let fileCount = 0;
	const { maxFiles } = options;
	// Note: maxFileSize check disabled - JSZip doesn't provide direct access to uncompressed size

	// Extract all files
	for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
		if (zipEntry.dir) continue;

		fileCount++;
		if (fileCount > maxFiles) {
			throw new Error(`Package exceeds maximum file count (${maxFiles})`);
		}

		// Check file size (JSZip doesn't provide direct access to uncompressed size)
		// We'll check size after extraction if needed
		// const size = zipEntry._data?.uncompressedSize ?? 0;
		// if (size > maxFileSize) {
		// 	throw new Error(`File ${relativePath} exceeds maximum size (${maxFileSize} bytes)`);
		// }

		const posixPath = toPosixPath(relativePath);
		const isText = isTextFile(posixPath);

		if (isText) {
			const content = await zipEntry.async('string');
			files.set(posixPath, {
				path: posixPath,
				content,
				type: 'text',
				size: content.length,
			});
		} else {
			const blob = await zipEntry.async('blob');
			files.set(posixPath, {
				path: posixPath,
				content: blob,
				type: 'binary',
				size: blob.size,
			});
		}
	}

	// Find and read manifest
	const manifestPath = findManifestInFiles(files);
	if (!manifestPath) {
		throw new Error('No imsmanifest.xml found in package');
	}

	const manifestFile = files.get(manifestPath);
	if (!manifestFile || manifestFile.type !== 'text') {
		throw new Error('Manifest file is not readable');
	}

	const manifestXml = manifestFile.content as string;

	return { files, manifestXml, manifestPath };
}

/**
 * Find imsmanifest.xml in the extracted files
 */
function findManifestInFiles(files: Map<string, VirtualFile>): string | null {
	// Check root first
	if (files.has('imsmanifest.xml')) {
		return 'imsmanifest.xml';
	}

	// Scan directories (breadth-first)
	const queue: string[] = [''];
	const visited = new Set<string>();

	while (queue.length > 0) {
		const dir = queue.shift()!;
		if (visited.has(dir)) continue;
		visited.add(dir);

		// Check for manifest in this directory
		const manifestPath = dir ? `${dir}/imsmanifest.xml` : 'imsmanifest.xml';
		if (files.has(manifestPath)) {
			return manifestPath;
		}

		// Find subdirectories
		const prefix = dir ? `${dir}/` : '';
		for (const filePath of files.keys()) {
			if (!filePath.startsWith(prefix)) continue;
			const remainder = filePath.slice(prefix.length);
			const slashIndex = remainder.indexOf('/');
			if (slashIndex > 0) {
				const subdir = `${prefix}${remainder.slice(0, slashIndex)}`;
				if (!visited.has(subdir)) {
					queue.push(subdir);
				}
			}
		}
	}

	return null;
}

/**
 * Resolved manifest resource with file paths
 */
export interface ResolvedManifestResource {
	identifier: string;
	type: string;
	/** Main href resolved to package-relative POSIX path */
	hrefResolved?: string;
	/** All resource files resolved to package-relative POSIX paths */
	filesResolved: string[];
	/** Original xml:base if any */
	xmlBase?: string;
	/** Locale if detected */
	locale?: string;
}

/**
 * Resolved manifest with path resolution
 */
export interface ResolvedManifest {
	identifier: string;
	xmlBase?: string;
	/** Manifest file location (package-relative POSIX path) */
	manifestPath: string;
	/** All resources by identifier */
	resources: Map<string, ResolvedManifestResource>;
	/** QTI assessment items */
	items: ResolvedManifestResource[];
	/** QTI passages */
	passages: ResolvedManifestResource[];
	/** QTI tests */
	tests: ResolvedManifestResource[];
}

/**
 * Parse manifest and resolve all resource paths
 */
export async function loadResolvedManifest(
	manifestXml: string,
	manifestPath: string
): Promise<ResolvedManifest> {
	// Parse manifest XML
	const parsed: ParsedManifest = parseManifest(manifestXml, '.');

	// Calculate base path for the manifest
	const manifestRelDir = dirname(manifestPath === 'imsmanifest.xml' ? '' : manifestPath);
	const baseManifest = applyXmlBase(manifestRelDir === '.' ? '' : manifestRelDir, parsed.xmlBase);

	// Resolve resource paths
	const resolveResource = (r: any): ResolvedManifestResource => {
		const baseResource = applyXmlBase(baseManifest, r.xmlBase);
		const hrefResolved = r.href ? joinPosix(baseResource, r.href) : undefined;
		const filesResolved = (r.files ?? []).map((f: string) => joinPosix(baseResource, f));

		return {
			identifier: r.identifier,
			type: r.type || 'unknown',
			hrefResolved,
			filesResolved,
			xmlBase: r.xmlBase,
			locale: r.locale,
		};
	};

	const resources = new Map<string, ResolvedManifestResource>();
	for (const [id, r] of parsed.resources.entries()) {
		resources.set(id, resolveResource(r));
	}

	const items = parsed.items.map(resolveResource);
	const passages = parsed.passages.map(resolveResource);
	const tests = parsed.tests.map(resolveResource);

	return {
		identifier: parsed.identifier || 'unknown',
		xmlBase: parsed.xmlBase,
		manifestPath,
		resources,
		items,
		passages,
		tests,
	};
}
