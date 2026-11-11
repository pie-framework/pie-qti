import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
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
 * This pins the graph shape both ways around the shared layer: a plugin may import `shared/`,
 * but `shared/` must never — through a static, side-effect, or dynamic import, transitively —
 * reach a plugin, so the shared layer stays an acyclic leaf of every plugin that uses it.
 */

const ROOT = join(__dirname, '..', '..', 'src');
const SHARED = join(ROOT, 'shared');

/** Every module file under `src/shared/` (actions, components, extensions, styles, utils). */
function sharedModules(): string[] {
	return readdirSync(SHARED, { recursive: true })
		.map((entry) => join(SHARED, String(entry)))
		.filter((file) => /\.(?:ts|js|svelte)$/.test(file));
}

/** Whether `file` is one of the plugins' own modules. */
function isPluginModule(file: string): boolean {
	return relative(ROOT, file).split(sep)[0] === 'plugins';
}

/**
 * The relative import specifiers written in `file`, of every kind: static
 * (`import … from` and re-`export … from`), side-effect (`import './x.js'`),
 * and dynamic (`import('./x')`).
 */
function importsOf(file: string): string[] {
	const source = readFileSync(file, 'utf8');
	const statics = source.matchAll(/(?:import|export)[^'"`]*?from\s+['"](\.[^'"]+)['"]/g);
	const sideEffects = source.matchAll(/\bimport\s+['"](\.[^'"]+)['"]/g);
	const dynamics = source.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g);
	return [...statics, ...sideEffects, ...dynamics].map((m) => m[1]);
}

/** Resolve a relative specifier to an existing .svelte/.ts/.js file (extension-less first). */
function resolveImport(from: string, spec: string): string | null {
	const base = join(dirname(from), spec);
	const candidates = [base, `${base}.ts`, `${base}.js`, `${base}.svelte`, join(base, 'index.ts')];
	// A `.js` specifier may name a `.ts` module (this package writes TS-style relative
	// imports), and a `.svelte` specifier may name its `.svelte.ts` runes module.
	if (base.endsWith('.js')) candidates.push(`${base.slice(0, -3)}.ts`);
	for (const candidate of candidates) {
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

/**
 * The first chain of modules from `entry` that reaches a module under `plugins/`, as
 * file paths from `src/`, or null when no route exists. Side-effect and dynamic imports
 * carry a module across just as a static one does, so the scanner sees all three.
 */
function routeToPlugins(entry: string): string[] | null {
	const seen = new Set<string>();
	const walk = (file: string, trail: string[]): string[] | null => {
		if (seen.has(file)) return null;
		seen.add(file);
		const route = [...trail, relative(ROOT, file)];
		if (isPluginModule(file)) return route;
		for (const spec of importsOf(file)) {
			const next = resolveImport(file, spec);
			if (!next) continue;
			const found = walk(next, route);
			if (found) return found;
		}
		return null;
	};
	return walk(entry, []);
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

	test('every module under src/shared/ is enumerated', () => {
		expect(sharedModules().length).toBeGreaterThan(20);
		for (const pinned of [
			'shared/index.ts',
			join('shared', 'components', 'ImageStage.svelte'),
			join('shared', 'components', 'pickUpPlace.svelte.ts'),
			join('shared', 'styles', 'srOnly.ts'),
			join('shared', 'utils', 'announcer.svelte.ts'),
			join('shared', 'utils', 'stageImage.svelte.ts'),
		]) {
			expect(sharedModules().map((file) => relative(ROOT, file)), `missing ${pinned}`).toContain(pinned);
		}
	});

	describe('no shared module reaches plugins/ (static, side-effect, or dynamic)', () => {
		for (const file of sharedModules()) {
			test(relative(ROOT, file), () => {
				expect(routeToPlugins(file), 'reaches plugins/ via ' + routeToPlugins(file)?.join(' → ')).toBeNull();
			});
		}
	});
});
