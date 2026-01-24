/**
 * Cross-platform path utilities for handling Windows and Unix absolute paths
 */

import type { StorageBackend } from '@pie-qti/storage';

/**
 * Check if a path is absolute (Windows or Unix)
 */
export function isAbsolutePath(p: string): boolean {
	// Windows absolute path (C:\, D:\, etc.)
	if (/^[A-Za-z]:[\\/]/.test(p)) {
		return true;
	}
	// Unix absolute path
	return p.startsWith('/');
}

/**
 * Convert absolute path to storage-relative path
 * Handles both Windows (C:\...) and Unix (/) absolute paths
 */
export function convertAbsoluteToStorageRelative(
	absolutePath: string,
	storage: StorageBackend
): string | null {
	// Normalize Windows backslashes to forward slashes
	const normalized = absolutePath.replace(/\\/g, '/');

	// Try to extract the storage-relative part
	// Look for /uploads/sessions/ pattern
	const uploadsMatch = normalized.match(/\/uploads\/(sessions\/.+)/);
	if (uploadsMatch) {
		return uploadsMatch[1];
	}

	// Try to extract just sessions/... part
	const sessionsMatch = normalized.match(/(sessions\/.+)/);
	if (sessionsMatch) {
		return sessionsMatch[1];
	}

	// If path contains the storage root, extract relative part
	const storageRoot = (storage as any).rootDir || process.cwd() + '/uploads';
	const normalizedRoot = storageRoot.replace(/\\/g, '/');
	if (normalized.startsWith(normalizedRoot + '/')) {
		return normalized.substring(normalizedRoot.length + 1);
	}

	return null;
}

/**
 * Read XML file from session storage with path resolution fallbacks
 * Tries multiple candidate paths to handle both absolute and relative paths
 */
export async function readSessionXml(
	samplePath: string,
	storage: StorageBackend,
	extractedPath: string,
	uploadsPath: string
): Promise<string> {
	const candidates: string[] = [];

	if (isAbsolutePath(samplePath)) {
		// Absolute path - convert to storage-relative path
		const storageRelative = convertAbsoluteToStorageRelative(samplePath, storage);
		if (storageRelative) {
			candidates.push(storageRelative);
		}

		// Also try extracting just the filename
		const fileName = samplePath.split(/[\\/]/).pop();
		if (fileName) {
			candidates.push(`${extractedPath}/${fileName}`);
			candidates.push(`${uploadsPath}/${fileName}`);
		}
	} else {
		candidates.push(`${extractedPath}/${samplePath}`);
		candidates.push(`${uploadsPath}/${samplePath}`);
		const baseName = samplePath.split('/').pop();
		if (baseName && baseName !== samplePath) {
			candidates.push(`${uploadsPath}/${baseName}`);
			candidates.push(`${extractedPath}/${baseName}`);
		}
	}

	for (const candidate of candidates) {
		try {
			if (await storage.exists(candidate)) {
				return await storage.readText(candidate);
			}
		} catch {
			continue;
		}
	}

	throw new Error(`ENOENT: no such file or directory, open '${candidates[0] || samplePath}'`);
}
