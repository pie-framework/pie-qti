#!/usr/bin/env node
/**
 * Post-build guard for customElements.define() calls emitted by the Svelte
 * compiler. `<svelte:options customElement="tag">` compiles to a bare
 * `customElements.define("tag", Class)` statement (guarded only in HMR
 * builds), which throws InvalidStateError when the same tag is registered
 * twice — e.g. when `@pie-qti/player-elements/register` (which inlines a copy
 * of `@pie-qti/default-components/plugins`) is loaded on a page that already
 * loaded the plugins entry directly.
 *
 * This script rewrites each literal-tagged define into an idempotent
 * expression:
 *
 *   customElements.get("tag") ?? customElements.define("tag", Class)
 *
 * Calls that already carry a guard are left untouched, so the script is
 * idempotent and safe to run on bundles that inlined already-guarded code.
 * It validates the syntax of every file it modifies before saving.
 *
 * Usage: node scripts/guard-custom-elements.mjs <package-dir> [...]
 * (run from the repository root, one package dir per dist to guard)
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';

// A literal-tagged define call: customElements.define("tag", ...
const DEFINE_PATTERN = /customElements\.define\s*\(\s*(["'])((?:(?!\1)[^\\])+)\1\s*,/g;

/** Recursively collect .js/.mjs files under dir. */
function collectJsFiles(dir, out) {
	for (const entry of readdirSync(dir)) {
		const abs = path.join(dir, entry);
		const stat = statSync(abs);
		if (stat.isDirectory()) collectJsFiles(abs, out);
		else if (/\.(js|mjs)$/.test(entry)) out.push(abs);
	}
	return out;
}

/** Syntax-validate content as an ES module before saving. */
function assertParses(content, label) {
	const tmp = mkdtempSync(path.join(tmpdir(), 'ce-guard-'));
	const file = path.join(tmp, 'check.mjs');
	writeFileSync(file, content);
	try {
		const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
		if (result.status !== 0) {
			throw new Error(`transform broke syntax in ${label}:\n${result.stderr}`);
		}
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

let guardedTotal = 0;

for (const packageDir of process.argv.slice(2)) {
	const distDir = path.join(packageDir, 'dist');
	if (!existsSync(distDir)) {
		console.log(`[guard-custom-elements] ${packageDir}: no dist/, skipping`);
		continue;
	}

	for (const file of collectJsFiles(distDir, [])) {
		const source = readFileSync(file, 'utf8');
		let count = 0;

		const transformed = source.replace(DEFINE_PATTERN, (match, quote, tag, offset) => {
			const guard = `customElements.get(${quote}${tag}${quote})??`;
			if (source.slice(0, offset).endsWith(guard)) return match; // already guarded
			count++;
			return `${guard}${match}`;
		});

		if (count === 0) continue;

		assertParses(transformed, path.relative(process.cwd(), file));
		writeFileSync(file, transformed);
		guardedTotal += count;
		console.log(
			`[guard-custom-elements] guarded ${count} define(s) in ${path.relative(process.cwd(), file)}`,
		);
	}
}

console.log(
	`[guard-custom-elements] OK — ${guardedTotal} define(s) guarded${guardedTotal === 0 ? ' (already safe)' : ''}`,
);
