/**
 * Workspace-only module names for unpublished source.
 *
 * The packages ship their Svelte components as source only — `scripts/publish-policy.json`
 * (`forbiddenPublicExports`) keeps every `components` subpath out of the published exports —
 * and the bundles that compile them (player-elements, the demo app) import them by these
 * names instead of reaching into another package with `../../../<pkg>/src/...`.
 *
 * The one map is `tsconfig.workspace-aliases.json` at the repository root: a tsconfig base
 * holding only `compilerOptions.paths`, because tsc, svelte-check and Bun read a tsconfig
 * natively (a package's tsconfig lists it in `extends`). This module hands the same map to
 * Vite and Vitest, and `scripts/check-deps.mjs` validates it: every name must be a subpath its
 * package is forbidden to publish, and every target must exist.
 *
 * A tsconfig that declares its own `paths` replaces the extended map instead of adding to it,
 * so it lists the whole map itself; check-deps verifies that copy. The demo app does this to add
 * its item-player source entries, and its Vite config reads its aliases from that tsconfig.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Absolute path of the map file. */
export const WORKSPACE_ALIAS_MAP_PATH = fileURLToPath(new URL('../tsconfig.workspace-aliases.json', import.meta.url));

/**
 * One map entry. A name ending in `/*` maps every module under its target directory (the
 * target ends in `/*` too); any other name maps exactly one file.
 * @typedef {{ name: string, target: string }} WorkspaceAlias
 */

/**
 * The map's entries, with targets resolved to absolute paths.
 * @returns {WorkspaceAlias[]}
 */
export function workspaceAliasEntries() {
	/** @type {{ compilerOptions?: { paths?: Record<string, string[]> } }} */
	const map = JSON.parse(readFileSync(WORKSPACE_ALIAS_MAP_PATH, 'utf8'));
	return pathEntries(WORKSPACE_ALIAS_MAP_PATH, map.compilerOptions?.paths ?? {});
}

/**
 * The `compilerOptions.paths` a tsconfig declares itself, not through `extends`, with targets
 * resolved to absolute paths; undefined when it declares none.
 * @param {string} tsconfigPath
 * @returns {WorkspaceAlias[] | undefined}
 */
export function tsconfigOwnPathEntries(tsconfigPath) {
	const { config, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
	if (error) throw new Error(`${tsconfigPath}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
	const paths = config?.compilerOptions?.paths;
	return paths ? pathEntries(tsconfigPath, paths) : undefined;
}

/**
 * @param {string} file
 * @param {Record<string, string[]>} paths
 * @returns {WorkspaceAlias[]}
 */
function pathEntries(file, paths) {
	return Object.entries(paths).map(([name, targets]) => {
		if (targets.length !== 1) {
			throw new Error(`${file}: "${name}" must map to exactly one target.`);
		}
		return { name, target: resolve(dirname(file), targets[0]) };
	});
}

/** @param {string} value */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The map as Vite `resolve.alias` entries.
 * @returns {{ find: RegExp, replacement: string }[]}
 */
export function workspaceViteAliases() {
	return viteAliases(workspaceAliasEntries());
}

/**
 * Entries as Vite `resolve.alias` entries. Each matches its name exactly (or, for a `/*` name, a
 * module under it), so a name never captures another subpath of its package.
 * @param {WorkspaceAlias[]} entries
 * @returns {{ find: RegExp, replacement: string }[]}
 */
export function viteAliases(entries) {
	return entries.map(({ name, target }) =>
		name.endsWith('/*')
			? { find: new RegExp(`^${escapeRegExp(name.slice(0, -2))}/(.+)$`), replacement: `${target.slice(0, -2)}/$1` }
			: { find: new RegExp(`^${escapeRegExp(name)}$`), replacement: target },
	);
}
