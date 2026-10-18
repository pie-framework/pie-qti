/**
 * The module resolution config format the QTI 3.0 PCI specification borrows from
 * RequireJS: a `paths` map of module id to path (or list of paths, of which the
 * first is primary), optional `shim` declarations for scripts that are not AMD,
 * `waitSeconds` and `urlArgs`. The spec's default locations under the package base
 * URL are `modules/module_resolution.js`, with `modules/fallback_module_resolution.js`
 * as the defined fallback-resolution path — both are JSON despite the `.js` names.
 */

export interface PciResolutionShim {
	deps?: string[];
	exports?: string;
}

export interface PciResolutionConfig {
	waitSeconds?: number;
	urlArgs?: string;
	paths: Record<string, string>;
	shim: Record<string, PciResolutionShim>;
}

/** The defined default config locations, in order, relative to the package base URL. */
export const DEFAULT_RESOLUTION_CONFIG_PATHS: readonly string[] = [
	'modules/module_resolution.js',
	'modules/fallback_module_resolution.js',
];

export function emptyResolutionConfig(): PciResolutionConfig {
	return { paths: {}, shim: {} };
}

/** A resolution config object from fetched content; anything unparseable is empty. */
export function parseModuleResolutionConfig(source: unknown): PciResolutionConfig {
	if (typeof source === 'string') {
		try {
			return parseModuleResolutionConfig(JSON.parse(source));
		} catch {
			return emptyResolutionConfig();
		}
	}
	if (typeof source !== 'object' || source === null || Array.isArray(source)) {
		return emptyResolutionConfig();
	}
	const raw = source as Record<string, unknown>;
	const config = emptyResolutionConfig();
	if (typeof raw.waitSeconds === 'number' && Number.isFinite(raw.waitSeconds)) {
		config.waitSeconds = raw.waitSeconds;
	}
	if (typeof raw.urlArgs === 'string' && raw.urlArgs) config.urlArgs = raw.urlArgs;
	if (typeof raw.paths === 'object' && raw.paths !== null && !Array.isArray(raw.paths)) {
		for (const [id, path] of Object.entries(raw.paths as Record<string, unknown>)) {
			const primary = Array.isArray(path) ? path[0] : path;
			if (typeof id === 'string' && id && typeof primary === 'string' && primary) {
				config.paths[id] = primary;
			}
		}
	}
	if (typeof raw.shim === 'object' && raw.shim !== null && !Array.isArray(raw.shim)) {
		for (const [id, shim] of Object.entries(raw.shim as Record<string, unknown>)) {
			if (typeof id !== 'string' || !id || typeof shim !== 'object' || shim === null) continue;
			const entry = shim as Record<string, unknown>;
			const resolved: PciResolutionShim = {};
			if (Array.isArray(entry.deps)) {
				const deps = entry.deps.filter((dep): dep is string => typeof dep === 'string');
				if (deps.length > 0) resolved.deps = deps;
			}
			if (typeof entry.exports === 'string' && entry.exports) resolved.exports = entry.exports;
			config.shim[id] = resolved;
		}
	}
	return config;
}
