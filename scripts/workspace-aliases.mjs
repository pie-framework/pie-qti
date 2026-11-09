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
 * Vite, Vitest and SvelteKit, and `scripts/check-deps.mjs` validates it: every name must be a
 * subpath its package is forbidden to publish, and every target must exist.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
	const paths = map.compilerOptions?.paths ?? {};
	return Object.entries(paths).map(([name, targets]) => {
		if (targets.length !== 1) {
			throw new Error(`${WORKSPACE_ALIAS_MAP_PATH}: "${name}" must map to exactly one target.`);
		}
		return { name, target: resolve(dirname(WORKSPACE_ALIAS_MAP_PATH), targets[0]) };
	});
}

/** @param {string} value */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The map as Vite `resolve.alias` entries. Each matches its name exactly (or, for a `/*`
 * name, a module under it), so a name never captures a published subpath of its package.
 * @returns {{ find: RegExp, replacement: string }[]}
 */
export function workspaceViteAliases() {
	return workspaceAliasEntries().map(({ name, target }) =>
		name.endsWith('/*')
			? { find: new RegExp(`^${escapeRegExp(name.slice(0, -2))}/(.+)$`), replacement: `${target.slice(0, -2)}/$1` }
			: { find: new RegExp(`^${escapeRegExp(name)}$`), replacement: target },
	);
}

/**
 * The map in SvelteKit's `alias` form, from which SvelteKit derives both the Vite aliases
 * and the `paths` of the app's generated tsconfig.
 * @returns {Record<string, string>}
 */
export function workspaceKitAliases() {
	return Object.fromEntries(workspaceAliasEntries().map(({ name, target }) => [name, target]));
}
