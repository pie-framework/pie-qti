import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * The bundle carries one copy of every workspace module.
 *
 * The players' Svelte components are compiled here from source (the workspace
 * aliases), while a bare `@pie-qti/assessment-player` or `@pie-qti/section-player`
 * import resolves to that package's tsc-built `dist`. Left alone, a module both
 * paths reach is bundled twice — once from `dist/`, once from `src/` — which is how
 * seven assessment- and section-player modules once shipped double. The build pins
 * the bare names to the source entries (vite.config.ts); this test reads the built
 * sourcemaps and fails if a second copy returns.
 */

const DIST = new URL('../dist/', import.meta.url).pathname;

/** A sourcemap source inside a workspace package: `../../<package>/<dist|src>/<module>`. */
const WORKSPACE_SOURCE = /^(?:\.\.\/)+([a-z][a-z0-9-]*)\/(dist|src)\/(.+)$/;

/** `core/errors.js` (built) and `core/errors.ts` (source) are the same module. */
function moduleKey(packageName: string, modulePath: string): string {
	return `${packageName}/${modulePath.replace(/\.(?:svelte\.)?[cm]?[jt]s$/, '').replace(/\/index$/, '')}`;
}

/** Every workspace module in the bundle, with the trees (`dist`, `src`) it was bundled from. */
function bundledWorkspaceModules(): Map<string, Set<string>> {
	const modules = new Map<string, Set<string>>();
	const maps = readdirSync(DIST).filter((file) => file.endsWith('.js.map'));
	// An unbuilt or map-less dist would pass vacuously.
	expect(maps.length).toBeGreaterThan(0);
	for (const file of maps) {
		const map = JSON.parse(readFileSync(`${DIST}${file}`, 'utf8')) as { sources?: string[] };
		for (const source of map.sources ?? []) {
			const match = WORKSPACE_SOURCE.exec(source);
			if (!match) continue;
			const key = moduleKey(match[1]!, match[3]!);
			const trees = modules.get(key) ?? new Set<string>();
			trees.add(match[2]!);
			modules.set(key, trees);
		}
	}
	return modules;
}

describe('the bundle ships one copy of every workspace module', () => {
	test('no module is bundled from both a package dist and its source', () => {
		const modules = bundledWorkspaceModules();
		// The measurement sees the players at all (their source is what this bundle compiles).
		expect(modules.get('assessment-player/core/errors')).toBeDefined();
		expect(modules.get('section-player/tools/display-settings')).toBeDefined();

		const twice = [...modules].filter(([, trees]) => trees.size > 1).map(([key]) => key);
		expect(twice).toEqual([]);
	});

	test('the players are bundled from source only', () => {
		const fromDist = [...bundledWorkspaceModules()]
			.filter(([key, trees]) => /^(?:assessment|section)-player\//.test(key) && trees.has('dist'))
			.map(([key]) => key);
		expect(fromDist).toEqual([]);
	});

	test('the coded-error brand is registered once, under its cross-copy key', () => {
		// `isAssessmentPlayerError` recognizes an error from another copy of the package (a
		// host may load `@pie-qti/assessment-player` beside this bundle) through
		// `Symbol.for('pie-qti.AssessmentPlayerError')`. One occurrence: the key survives,
		// and no second copy of the errors module came back with it.
		const occurrences = readdirSync(DIST)
			.filter((file) => file.endsWith('.js'))
			.reduce(
				(count, file) =>
					count + readFileSync(`${DIST}${file}`, 'utf8').split('pie-qti.AssessmentPlayerError').length - 1,
				0,
			);
		expect(occurrences).toBe(1);
	});
});
