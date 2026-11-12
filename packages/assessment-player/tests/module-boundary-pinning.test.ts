/**
 * Module boundary pinning: the core never imports the integration layer at runtime.
 *
 * The decided architecture (docs/plans/player-cleanup-2026-11.md) keeps the client's
 * navigation legality and presented-items record separate from the backend branch
 * evaluation: the pure delivery-rules walk (branch rules, preconditions, eligibility)
 * lives in the shared `core/testStructure.ts`, and `integration/test-navigation.ts`
 * re-exports it for the reference backend. Nothing under `src/core/` may import the
 * integration module again — not even a type — and nothing may import it at runtime.
 */

import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_DIR = fileURLToPath(new URL('../src/core', import.meta.url));

function coreFiles(): string[] {
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else if (entry.name.endsWith('.ts')) files.push(path);
		}
	};
	walk(CORE_DIR);
	return files;
}

const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * Every `from '<path>'` import clause in a source, with whether its statement is
 * type-only (`import type …`). A statement never spans a semicolon, so a side-effect
 * import is not mistaken for the clause that follows it.
 */
function importClauses(source: string): Array<{ typeOnly: boolean; from: string }> {
	const clauses: Array<{ typeOnly: boolean; from: string }> = [];
	for (const match of source.matchAll(/^(?:export\s+)?import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/gm)) {
		clauses.push({ typeOnly: match[1] !== undefined, from: match[2] });
	}
	return clauses;
}

describe('core imports', () => {
	it('never imports integration/test-navigation (the backend branch evaluation)', () => {
		const offenders = coreFiles()
			.map((path) => ({ path, source: stripComments(readFileSync(path, 'utf8')) }))
			.filter(({ source }) => importClauses(source).some(({ from }) => from.includes('integration/test-navigation')));
		expect(offenders).toEqual([]);
	});

	it('imports the integration layer for types only', () => {
		const offenders = coreFiles()
			.map((path) => ({ path, source: stripComments(readFileSync(path, 'utf8')) }))
			.flatMap(({ path, source }) =>
				importClauses(source)
					.filter(({ typeOnly, from }) => !typeOnly && from.includes('integration/'))
					.map(({ from }) => ({ path, from })),
			);
		expect(offenders).toEqual([]);
	});
});
