import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * The plugins web-component bundle imports every interaction component in one module graph
 * (`src/plugins/index.ts`). Svelte compiles each component's `<style>` into an
 * `append_styles()` effect in the component's own module; the effects close over that module's
 * bindings. If the graph contains an import cycle that re-enters a component module before its
 * module has finished evaluating, a later component's style effect can throw on an
 * uninitialized binding and abort the whole micro-task queue — every component mounted after
 * it then misses its styles (observed in the browser as a `position: static` overlay and
 * "Cannot read properties of undefined (reading 'split')" from the style-injection helper).
 *
 * This pins the shared layer acyclic: a plugin may import `shared/`, but `shared/` must never
 * (transitively) import a plugin.
 */

const ROOT = join(__dirname, '..', '..', 'src');

/** Relative import specifiers written in `file`. */
function importsOf(file: string): string[] {
	return [...readFileSync(file, 'utf8').matchAll(/(?:import|export)[^'"]*from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
}

/** Resolve a relative specifier to an existing .svelte/.ts file (extension-less first). */
function resolveImport(from: string, spec: string): string | null {
	const base = join(dirname(from), spec);
	for (const candidate of [base, `${base}.ts`, `${base}.js`, `${base}.svelte`, join(base, 'index.ts')]) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

/** The first import cycle reachable from `entry`, as the file path sequence, or null. */
function findCycle(entry: string): string[] | null {
	const seen = new Set<string>();
	const stack: string[] = [];
	const visit = (file: string): string[] | null => {
		if (file === entry && stack.length > 0) return [...stack, file];
		if (seen.has(file)) return null;
		seen.add(file);
		stack.push(file);
		for (const spec of importsOf(file)) {
			const next = resolveImport(file, spec);
			if (!next) continue;
			const cycle = visit(next);
			if (cycle) return cycle;
		}
		stack.pop();
		return null;
	};
	return visit(entry);
}

describe('the plugins bundle module graph is acyclic around the shared layer', () => {
	// Every component in the bundle whose shadow styles the browser test depends on.
	for (const [dir, component] of [
		['hotspot', 'HotspotInteraction'],
		['graphic-order', 'GraphicOrderInteraction'],
		['graphic-associate', 'GraphicAssociateInteraction'],
		['graphic-gap-match', 'GraphicGapMatchInteraction'],
		['select-point', 'SelectPointInteraction'],
		['position-object', 'PositionObjectInteraction'],
	] as const) {
		test(`${component} has no import cycle`, () => {
			const entry = join(ROOT, 'plugins', dir, `${component}.svelte`);
			expect(findCycle(entry), `${component} is in an import cycle`).toBeNull();
		});
	}

	test('shared/utils/graphicRegions imports nothing under plugins/', () => {
		const file = join(ROOT, 'shared', 'utils', 'graphicRegions.ts');
		expect(importsOf(file), 'graphicRegions is leaf-only').toEqual([]);
	});
});
