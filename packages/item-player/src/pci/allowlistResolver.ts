import type { PciModuleResolutionContext, PciModuleResolver } from './types.js';

/**
 * Raised when an authored PCI module path falls outside the configured allow-list.
 */
export class PciModuleNotAllowedError extends Error {
	constructor(
		public readonly resolvedUrl: string,
		public readonly reason: string
	) {
		super(`PCI module '${resolvedUrl}' is not allowed: ${reason}`);
		this.name = 'PciModuleNotAllowedError';
	}
}

export interface AllowlistPciResolverOptions {
	/**
	 * Origins permitted to serve PCI modules, compared against `URL.origin`
	 * (for example `https://cdn.example.com`).
	 */
	allowedOrigins?: readonly string[];
	/**
	 * Absolute URL prefixes permitted. Checked against the normalized href, so a
	 * traversal such as `/pci/../../evil.js` cannot escape its prefix.
	 */
	allowedPathPrefixes?: readonly string[];
	/**
	 * Module import hook. Defaults to a dynamic `import()`. Supply a different
	 * loader to import through a package reader, a cache, or a test double.
	 */
	importModule?: (resolvedUrl: string, context: PciModuleResolutionContext) => Promise<unknown>;
}

function normalizePrefix(prefix: string): string {
	let url: URL;
	try {
		url = new URL(prefix);
	} catch {
		throw new Error(`PCI allow-list path prefix must be an absolute URL: '${prefix}'`);
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error(`PCI allow-list path prefix must be http(s): '${prefix}'`);
	}
	return url.href;
}

function normalizeOrigin(origin: string): string {
	let url: URL;
	try {
		url = new URL(origin);
	} catch {
		throw new Error(`PCI allow-list origin must be an absolute URL: '${origin}'`);
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error(`PCI allow-list origin must be http(s): '${origin}'`);
	}
	return url.origin;
}

/**
 * Build a `moduleResolver` that imports PCI modules only from an explicit
 * allow-list.
 *
 * PCI code executes with the authority of the realm that imports it, so the
 * player never resolves an authored path on its own. This factory does not
 * remove that gate: a host still has to pass the returned resolver as
 * `PciConfiguration.moduleResolver`, and doing so remains a trust decision. It
 * exists so hosts opt into a reviewed check rather than writing the
 * security-critical part themselves.
 *
 * At least one of `allowedOrigins` or `allowedPathPrefixes` must be non-empty;
 * an empty allow-list would deny everything and is treated as a configuration
 * error rather than silently disabling PCI. When both are given, both must match.
 *
 * Non-http(s) URLs are always refused, which rules out `data:`, `blob:` and
 * `javascript:` module paths regardless of configuration.
 */
export function createAllowlistPciModuleResolver(
	options: AllowlistPciResolverOptions
): PciModuleResolver {
	const origins = (options.allowedOrigins ?? []).map(normalizeOrigin);
	const prefixes = (options.allowedPathPrefixes ?? []).map(normalizePrefix);
	if (origins.length === 0 && prefixes.length === 0) {
		throw new Error(
			'createAllowlistPciModuleResolver requires allowedOrigins or allowedPathPrefixes; ' +
				'an empty allow-list would refuse every module'
		);
	}
	const importModule =
		options.importModule ?? ((resolvedUrl: string) => import(/* @vite-ignore */ resolvedUrl));

	return async (resolvedUrl: string, context: PciModuleResolutionContext) => {
		let url: URL;
		try {
			url = new URL(resolvedUrl);
		} catch {
			throw new PciModuleNotAllowedError(
				resolvedUrl,
				'the authored path did not resolve to an absolute URL; set PciConfiguration.baseUrl'
			);
		}
		if (url.protocol !== 'https:' && url.protocol !== 'http:') {
			throw new PciModuleNotAllowedError(resolvedUrl, `scheme '${url.protocol}' is not http(s)`);
		}
		if (origins.length > 0 && !origins.includes(url.origin)) {
			throw new PciModuleNotAllowedError(resolvedUrl, `origin '${url.origin}' is not allow-listed`);
		}
		if (prefixes.length > 0 && !prefixes.some((prefix) => url.href.startsWith(prefix))) {
			throw new PciModuleNotAllowedError(resolvedUrl, 'no allow-listed path prefix matches');
		}
		return importModule(url.href, context);
	};
}
