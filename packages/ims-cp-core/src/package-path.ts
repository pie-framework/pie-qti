export interface PackagePathResolutionOptions {
	rejectRootEscape?: boolean;
}

export function joinPackagePath(...parts: Array<string | undefined>): string {
	return parts.filter(Boolean).join('/');
}

export function dirnamePackagePath(path: string): string {
	const normalized = path.replaceAll('\\', '/');
	const index = normalized.lastIndexOf('/');
	return index === -1 ? '' : normalized.slice(0, index);
}

export function resolvePackagePath(basePath: string | undefined, href: string): string {
	return resolvePackagePathInternal(basePath, href).path;
}

export function resolvePackagePathFromFile(baseHref: string, href: string): string {
	return resolvePackagePath(dirnamePackagePath(baseHref), href);
}

export function resolveCheckedPackagePath(basePath: string | undefined, href: string): string | null {
	if (!isPackageRelativeHref(href)) return null;
	if (hasUnsafeEncodedPathToken(href)) return null;
	if (!isSafePackageBasePath(basePath)) return null;
	const result = resolvePackagePathInternal(basePath, href, { rejectRootEscape: true });
	return result.escapedRoot ? null : result.path;
}

export function resolveCheckedPackagePathFromFile(baseHref: string, href: string): string | null {
	return resolveCheckedPackagePath(dirnamePackagePath(baseHref), href);
}

export function isPackageRelativeHref(href: string): boolean {
	const value = href.trim();
	return Boolean(value) && !value.startsWith('/') && !value.startsWith('//') && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

export function isExternalPackageHref(href: string): boolean {
	return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href);
}

function isSafePackageBasePath(basePath: string | undefined): boolean {
	if (!basePath) return true;
	if (!isPackageRelativeHref(basePath)) return false;
	if (hasUnsafeEncodedPathToken(basePath)) return false;
	return !resolvePackagePathInternal(undefined, basePath, { rejectRootEscape: true }).escapedRoot;
}

function resolvePackagePathInternal(
	basePath: string | undefined,
	href: string,
	options: PackagePathResolutionOptions = {}
): { path: string; escapedRoot: boolean } {
	const raw = href.replaceAll('\\', '/');
	const combined = raw.startsWith('/') ? raw.slice(1) : joinPackagePath(basePath, raw);
	const normalized: string[] = [];
	let escapedRoot = false;

	for (const part of combined.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (normalized.length === 0) {
				escapedRoot = true;
				if (options.rejectRootEscape) continue;
			} else {
				normalized.pop();
			}
			continue;
		}
		normalized.push(part);
	}

	return { path: normalized.join('/'), escapedRoot };
}

function hasUnsafeEncodedPathToken(href: string): boolean {
	let current = href;
	for (let i = 0; i < 3; i += 1) {
		if (/%(?:2e|2f|5c)/i.test(current)) {
			return true;
		}
		const decoded = safeDecodeURIComponent(current);
		if (decoded === current) {
			return false;
		}
		current = decoded;
	}
	return /%(?:2e|2f|5c)/i.test(current);
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
