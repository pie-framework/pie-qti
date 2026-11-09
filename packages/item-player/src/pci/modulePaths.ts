import type { ExtractedPci, PciModuleEntry } from './types.js';

/**
 * Resolve one authored PCI module path against the package base URL. Absolute,
 * protocol-relative, scheme-qualified and root-relative paths are kept as
 * authored; anything else is resolved against the base, falling back to string
 * concatenation when the base is not a valid URL.
 *
 * Shared by the page-realm and sandboxed engines; the policy gate and the
 * timeouts around loading stay per engine.
 */
export function resolvePciModuleUrl(path: string, baseUrl: string): string {
	if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || path.startsWith('/')) {
		return path;
	}
	if (!baseUrl) return path;
	// Relative path: resolve against baseUrl
	const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
	try {
		return new URL(path, base).href;
	} catch {
		return base + path;
	}
}

/**
 * The entry module of an extracted PCI: the authored module whose primary path
 * is the interaction's primary reference, else the last authored module.
 */
export function pciEntryModule(data: ExtractedPci): PciModuleEntry | undefined {
	return (
		data.modules.find((module) => module.primaryPath === data.primaryPath) ??
		data.modules[data.modules.length - 1]
	);
}
