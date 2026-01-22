/**
 * Browser-compatible POSIX path utilities
 * Avoids dependency on Node.js path module
 */

/**
 * Convert Windows-style paths to POSIX paths
 */
export function toPosixPath(p: string): string {
	return p.replace(/\\/g, '/');
}

/**
 * Normalize a POSIX path (resolve . and .. segments)
 */
export function normalizePosix(p: string): string {
	// Remove leading slashes
	const trimmed = p.replace(/^\/+/, '');

	// Resolve . and .. segments
	const segments: string[] = [];
	for (const segment of trimmed.split('/')) {
		if (segment === '.' || segment === '') continue;
		if (segment === '..') {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}

	const normalized = segments.join('/');

	// Security check - prevent path traversal
	if (normalized.startsWith('../')) {
		throw new Error(`Path escapes package root: ${p}`);
	}

	return normalized;
}

/**
 * Join POSIX path segments
 */
export function joinPosix(...parts: string[]): string {
	const filtered = parts.filter((p) => p && p.length > 0);
	return normalizePosix(filtered.join('/'));
}

/**
 * Get directory name from POSIX path
 */
export function dirname(posixPath: string): string {
	const parts = posixPath.split('/');
	parts.pop();
	return parts.join('/') || '.';
}

/**
 * Apply xml:base to a parent base path
 */
export function applyXmlBase(parentBase: string, xmlBase?: string): string {
	if (!xmlBase) return parentBase;
	// xml:base can be absolute URI; we treat it as a path-like base
	return joinPosix(parentBase, xmlBase);
}
