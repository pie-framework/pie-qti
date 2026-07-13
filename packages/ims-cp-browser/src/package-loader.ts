/**
 * Browser-based ZIP package extraction and manifest resolution
 */

import JSZip from 'jszip';
import { parseManifest } from '@pie-qti/ims-cp-core/manifest-parser';
import type { ParsedManifest } from '@pie-qti/ims-cp-core/manifest-parser';
import { resolveCheckedPackagePath } from '@pie-qti/ims-cp-core';
import { toPosixPath, dirname } from './path-utils.js';
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
	options: ExtractOptions = {},
): Promise<{ files: Map<string, VirtualFile>; manifestXml: string; manifestPath: string }> {
	const maxFileSize = resolveLimit(options.maxFileSize, 50 * 1024 * 1024, 'maxFileSize');
	const maxCompressedSize = resolveLimit(
		options.maxCompressedSize,
		100 * 1024 * 1024,
		'maxCompressedSize',
	);
	const maxTotalUncompressedSize = resolveLimit(
		options.maxTotalUncompressedSize,
		250 * 1024 * 1024,
		'maxTotalUncompressedSize',
	);
	const maxEntries = resolveLimit(options.maxEntries, 1000, 'maxEntries', true);
	const maxFiles = resolveLimit(options.maxFiles, 1000, 'maxFiles', true);
	const maxCompressionRatio = resolveLimit(
		options.maxCompressionRatio,
		200,
		'maxCompressionRatio',
	);
	const compressedInputSize = getInputSize(file);
	if (compressedInputSize !== null && compressedInputSize > maxCompressedSize) {
		throw new Error(`Package exceeds maximum compressed size (${maxCompressedSize} bytes)`);
	}

	const zip = await JSZip.loadAsync(file);
	const files = new Map<string, VirtualFile>();

	let entryCount = 0;
	let fileCount = 0;
	let advertisedTotalSize = 0;
	let actualTotalSize = 0;

	// Reject from central-directory metadata before inflating any entry. Actual
	// output is checked again below because metadata must not be trusted alone.
	for (const zipEntry of Object.values(zip.files)) {
		entryCount++;
		if (entryCount > maxEntries) {
			throw new Error(`Package exceeds maximum entry count (${maxEntries})`);
		}
		if (zipEntry.dir) continue;

		const sizes = getZipEntrySizes(zipEntry);
		if (
			(sizes.uncompressed !== null &&
				(!Number.isSafeInteger(sizes.uncompressed) || sizes.uncompressed < 0)) ||
			(sizes.compressed !== null &&
				(!Number.isSafeInteger(sizes.compressed) || sizes.compressed < 0))
		) {
			throw new Error(`Zip entry has invalid size metadata: ${toPosixPath(zipEntry.name)}`);
		}
		if (sizes.uncompressed !== null) {
			if (sizes.uncompressed > maxFileSize) {
				throw new Error(`File ${toPosixPath(zipEntry.name)} exceeds maximum file size (${maxFileSize} bytes)`);
			}
			advertisedTotalSize += sizes.uncompressed;
			if (advertisedTotalSize > maxTotalUncompressedSize) {
				throw new Error(
					`Package exceeds maximum total uncompressed size (${maxTotalUncompressedSize} bytes)`,
				);
			}
		}
		if (
			sizes.uncompressed !== null &&
			sizes.compressed !== null &&
			exceedsCompressionRatio(sizes.uncompressed, sizes.compressed, maxCompressionRatio)
		) {
			throw new Error(`File ${toPosixPath(zipEntry.name)} exceeds maximum compression ratio (${maxCompressionRatio})`);
		}
	}

	// Extract all files
	for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
		if (zipEntry.dir) continue;

		const posixPath = toPosixPath(relativePath);
		if (!resolveCheckedPackagePath(undefined, posixPath)) {
			continue;
		}

		fileCount++;
		if (fileCount > maxFiles) {
			throw new Error(`Package exceeds maximum file count (${maxFiles})`);
		}

		const advertisedSize = getZipEntrySizes(zipEntry).uncompressed;
		if (advertisedSize !== null && advertisedSize > maxFileSize) {
			throw new Error(`File ${posixPath} exceeds maximum file size (${maxFileSize} bytes)`);
		}

		const isText = isTextFile(posixPath);

		if (isText) {
			const content = await zipEntry.async('string');
			const size = new TextEncoder().encode(content).byteLength;
			if (size > maxFileSize) {
				throw new Error(`File ${posixPath} exceeds maximum file size (${maxFileSize} bytes)`);
			}
			actualTotalSize += size;
			if (actualTotalSize > maxTotalUncompressedSize) {
				throw new Error(
					`Package exceeds maximum total uncompressed size (${maxTotalUncompressedSize} bytes)`,
				);
			}
			files.set(posixPath, {
				path: posixPath,
				content,
				type: 'text',
				size,
			});
		} else {
			const blob = await zipEntry.async('blob');
			if (blob.size > maxFileSize) {
				throw new Error(`File ${posixPath} exceeds maximum file size (${maxFileSize} bytes)`);
			}
			actualTotalSize += blob.size;
			if (actualTotalSize > maxTotalUncompressedSize) {
				throw new Error(
					`Package exceeds maximum total uncompressed size (${maxTotalUncompressedSize} bytes)`,
				);
			}
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

function getInputSize(input: unknown): number | null {
	if (typeof (input as { size?: unknown })?.size === 'number') {
		return (input as { size: number }).size;
	}
	if (typeof (input as { byteLength?: unknown })?.byteLength === 'number') {
		return (input as { byteLength: number }).byteLength;
	}
	return null;
}

function resolveLimit(
	value: number | undefined,
	fallback: number,
	name: string,
	requireInteger = false,
): number {
	const resolved = value ?? fallback;
	if (
		resolved !== Number.POSITIVE_INFINITY &&
		(!Number.isFinite(resolved) || resolved < 0 || (requireInteger && !Number.isInteger(resolved)))
	) {
		throw new Error(`${name} must be a non-negative ${requireInteger ? 'integer' : 'number'}`);
	}
	return resolved;
}

function getZipEntrySizes(zipEntry: JSZip.JSZipObject): {
	compressed: number | null;
	uncompressed: number | null;
} {
	const data = (zipEntry as unknown as {
		_data?: { compressedSize?: unknown; uncompressedSize?: unknown };
	})._data;
	return {
		compressed: typeof data?.compressedSize === 'number' ? data.compressedSize : null,
		uncompressed: typeof data?.uncompressedSize === 'number' ? data.uncompressedSize : null,
	};
}

function exceedsCompressionRatio(uncompressed: number, compressed: number, maximum: number): boolean {
	if (uncompressed === 0 || maximum === Number.POSITIVE_INFINITY) return false;
	if (compressed <= 0) return true;
	return uncompressed / compressed > maximum;
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
	const manifestBase = manifestRelDir === '.' ? '' : manifestRelDir;
	const baseManifest = checkedBase(manifestBase, parsed.xmlBase);

	// Resolve resource paths
	const resolveResource = (r: any): ResolvedManifestResource => {
		const baseResource = baseManifest === null ? null : checkedBase(baseManifest, r.xmlBase);
		const hrefResolved = checkedJoin(baseResource, r.href);
		const filesResolved = (r.files ?? []).flatMap((filePath: string) => {
			const resolved = checkedJoin(baseResource, filePath);
			return resolved ? [resolved] : [];
		});

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

function checkedBase(basePath: string, href: string | undefined): string | null {
	if (!basePath) return href ? checkedJoin('', href) ?? null : '';
	if (!href) return basePath;
	return checkedJoin(basePath, href) ?? null;
}

function checkedJoin(basePath: string | null, href: string | undefined): string | undefined {
	if (basePath === null) return undefined;
	if (!href) return undefined;
	return resolveCheckedPackagePath(basePath, href) ?? undefined;
}
