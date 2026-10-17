import type { PciResolutionConfig } from './resolutionConfig.js';

/**
 * A minimal AMD loader for PCI modules.
 *
 * QTI 3.0 specifies AMD as PCI's default module resolution: modules call
 * `define([deps], factory)` and dependencies are wired by module id through a
 * resolution config's `paths` map. The loader installs `define`/`require`
 * globals so an evaluated module's `define` lands here, resolves each
 * dependency id to a URL, and hands the URL to the host resolver — the trust
 * gate stays the resolver's; the loader only decides how dependencies wire up.
 *
 * Evaluation goes through the resolver, whose dynamic `import()` executes the
 * file with the loader's `define` visible on the global scope. `define`-style
 * files register exactly as they do under RequireJS; plain scripts contribute
 * nothing unless the resolution config's `shim` names a global to read.
 */

type Factory = ((...args: unknown[]) => unknown) | Record<string, unknown>;

export interface AmdLoaderOptions {
	baseUrl: string;
	config: PciResolutionConfig;
	/**
	 * Evaluate one module URL through the host resolver. The module registers
	 * against `qtiCustomInteractionContext` (or defines itself) as a side effect.
	 */
	evaluate(resolvedUrl: string, authoredPath: string): Promise<unknown>;
	/** Resolve a package-relative path to a loadable URL. */
	resolveUrl(path: string): string;
}

export interface AmdLoader {
	/** Swap the page's `define`/`require` for the loader's. */
	install(): void;
	/** Restore whatever `define`/`require` the page had. */
	dispose(): void;
	/** Evaluate the given module ids and their dependency trees. */
	load(entryIds: string[]): Promise<void>;
	/** Feed an already-known id → path binding, as authored `qti-interaction-module` entries do. */
	addPaths(paths: Record<string, string>): void;
}

interface NormalizedDefine {
	id?: string;
	deps: string[];
	factory?: Factory;
}

const SPECIAL_DEPENDENCIES = new Set(['require', 'module', 'exports']);

export function createAmdLoader(options: AmdLoaderOptions): AmdLoader {
	const { config } = options;
	const modules = new Map<string, unknown>();
	const inFlight = new Map<string, Promise<void>>();
	const defineCompletions = new Map<string, Promise<void>>();
	let defining: string | undefined;
	/** Evaluations run one at a time, so an anonymous define lands on its own file. */
	let evaluationQueue: Promise<unknown> = Promise.resolve();
	let installed = false;
	let previousDefine: unknown;
	let previousRequire: unknown;
	let hadPreviousDefine = false;
	let hadPreviousRequire = false;

	// Paths from the resolution config, overlaid with authored module entries.
	const paths: Record<string, string> = { ...config.paths };

	function resolveIdPath(id: string): string {
		const mapped = paths[id];
		const path = mapped ?? id;
		const withArgs = config.urlArgs ? `${path}${path.includes('?') ? '&' : '?'}${config.urlArgs}` : path;
		return options.resolveUrl(withArgs);
	}

	function normalizeDefine(args: unknown[]): NormalizedDefine {
		let id: string | undefined;
		let deps: string[] = [];
		let rest = args;
		if (typeof rest[0] === 'string') {
			id = rest[0];
			rest = rest.slice(1);
		}
		if (Array.isArray(rest[0])) {
			deps = (rest[0] as unknown[]).filter((dep): dep is string => typeof dep === 'string');
			rest = rest.slice(1);
		}
		const factory = rest[0] as Factory | undefined;
		return { ...(id ? { id } : {}), deps, ...(factory !== undefined ? { factory } : {}) };
	}

	function define(...args: unknown[]): void {
		const normalized = normalizeDefine(args);
		const id = normalized.id ?? defining;
		if (!id) {
			throw new Error('AMD define() without a module id and no module currently loading');
		}
		if (modules.has(id) || defineCompletions.has(id)) {
			// RequireJS throws on a second definition of the same id.
			throw new Error(`AMD module '${id}' is already defined`);
		}
		const completion = (async () => {
			const exportsObject: Record<string, unknown> = {};
			const usesExports = normalized.deps.includes('exports');
			const values = await Promise.all(
				normalized.deps.map(async (dep) => {
					if (dep === 'exports') return exportsObject;
					if (dep === 'module') return { id, config: () => config };
					if (dep === 'require') return localRequire;
					return loadModule(dep);
				})
			);
			if (typeof normalized.factory === 'function') {
				const value = (normalized.factory as (...args: unknown[]) => unknown)(...values);
				if (!usesExports && value !== undefined) modules.set(id, value);
			} else if (normalized.factory !== undefined) {
				modules.set(id, normalized.factory);
			}
			if (usesExports) modules.set(id, exportsObject);
		})();
		defineCompletions.set(id, completion);
		completion.finally(() => defineCompletions.delete(id));
	}

	function applyShim(id: string): void {
		const shim = config.shim[id];
		if (!shim) return;
		if (shim.exports && typeof globalThis === 'object') {
			modules.set(id, (globalThis as Record<string, unknown>)[shim.exports]);
		}
	}

	function loadModule(id: string): Promise<unknown> {
		if (modules.has(id)) return Promise.resolve(modules.get(id));
		const pending = inFlight.get(id);
		if (pending) return pending.then(() => modules.get(id));
		const load = (async () => {
			if (!defineCompletions.has(id)) {
				// Serialize against other evaluations, and claim the anonymous-define
				// slot inside the queued task: sibling loads may have started already.
				const run = evaluationQueue.then(
					() => {
						defining = id;
						return options.evaluate(resolveIdPath(id), paths[id] ?? id);
					},
					() => {
						defining = id;
						return options.evaluate(resolveIdPath(id), paths[id] ?? id);
					}
				);
				evaluationQueue = run.then(
					() => {
						if (defining === id) defining = undefined;
					},
					() => {
						if (defining === id) defining = undefined;
					}
				);
				await run;
				// The define() call, if any, ran synchronously inside the evaluation.
				if (!defineCompletions.has(id)) {
					// Not an AMD module: a plain script, or a shimmed global.
					await Promise.all((config.shim[id]?.deps ?? []).map((dep) => loadModule(dep)));
					applyShim(id);
					if (!modules.has(id)) modules.set(id, undefined);
				}
			}
			await defineCompletions.get(id);
		})();
		// The dedupe entry is always handled, so a failed load is not an
		// unhandled rejection, and it clears once it settles.
		const settled = load.then(
			() => undefined,
			() => undefined
		);
		inFlight.set(id, settled);
		void settled.finally(() => {
			if (inFlight.get(id) === settled) inFlight.delete(id);
		});
		return load.then(() => modules.get(id));
	}

	function localRequire(...args: unknown[]): unknown {
		const first = args[0];
		if (typeof first === 'string') {
			// Synchronous require: only already-evaluated modules answer.
			if (!modules.has(first)) {
				throw new Error(`AMD require('${first}') before the module was loaded`);
			}
			return modules.get(first);
		}
		if (Array.isArray(first)) {
			const ready = typeof args[1] === 'function' ? (args[1] as (...values: unknown[]) => void) : undefined;
			const deps = (first as unknown[]).filter((dep): dep is string => typeof dep === 'string');
			const result = Promise.all(deps.map((dep) => loadModule(dep)));
			if (ready) void result.then((values) => ready(...values));
			return result;
		}
		// require.config({...}): merge runtime configuration.
		if (typeof first === 'object' && first !== null) {
			const merged = first as Partial<PciResolutionConfig>;
			Object.assign(paths, merged.paths ?? {});
			Object.assign(config.shim, merged.shim ?? {});
		}
		return localRequire;
	}

	return {
		install() {
			if (installed) return;
			installed = true;
			previousDefine = (globalThis as Record<string, unknown>).define;
			previousRequire = (globalThis as Record<string, unknown>).require;
			hadPreviousDefine = 'define' in globalThis;
			hadPreviousRequire = 'require' in globalThis;
			const amdFlag = { amd: {} };
			const defineFn = define as ((...args: unknown[]) => void) & { amd?: unknown };
			defineFn.amd = amdFlag;
			(globalThis as Record<string, unknown>).define = defineFn;
			(globalThis as Record<string, unknown>).require = localRequire;
		},

		dispose() {
			if (!installed) return;
			installed = false;
			const host = globalThis as Record<string, unknown>;
			if (hadPreviousDefine) host.define = previousDefine;
			else delete host.define;
			if (hadPreviousRequire) host.require = previousRequire;
			else delete host.require;
		},

		addPaths(authored: Record<string, string>) {
			Object.assign(paths, authored);
		},

		async load(entryIds: string[]) {
			await Promise.all(entryIds.map((id) => loadModule(id)));
		},
	};
}
