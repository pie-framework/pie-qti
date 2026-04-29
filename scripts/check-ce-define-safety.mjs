#!/usr/bin/env node
/**
 * Validates that every customElements.define() call in source files is guarded
 * by a customElements.get() check to prevent duplicate-registration errors.
 *
 * Allowed pattern:
 *   if (!customElements.get(TAG)) customElements.define(TAG, Cls);
 *
 * Also detects duplicate literal tag names across files.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEARCH_ROOT = path.join(ROOT, 'packages');
const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.svelte']);

// Matches any customElements.define() call.
const DEFINE_PATTERN = /customElements\.define\s*\(/g;
// Matches a guard: customElements.get(...) anywhere before a customElements.define(
// on the same or adjacent lines (covers both same-line and if-block patterns).
const GUARDED_PATTERN = /customElements\.get\s*\([\s\S]{0,200}?customElements\.define\s*\(/;

const LITERAL_TAG_PATTERN = /customElements\.define\s*\(\s*["']([^"']+)["']/g;

const stripComments = (src) =>
	src
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');

const shouldSkipDir = (name) =>
	name === 'node_modules' || name === 'dist' || name === '.svelte-kit' ||
	name === 'coverage' || name === '.turbo' || name === 'build' ||
	name === '__tests__' || name === 'tests';

function collectSourceFiles(dir, out) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const absPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!shouldSkipDir(entry.name)) collectSourceFiles(absPath, out);
			continue;
		}
		if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) out.push(absPath);
	}
}

const relPath = (absPath) => path.relative(ROOT, absPath).replace(/\\/g, '/');

const files = [];
if (existsSync(SEARCH_ROOT)) collectSourceFiles(SEARCH_ROOT, files);

const failures = [];
const literalTagOwners = new Map();

for (const file of files) {
	const relative = relPath(file);
	const raw = readFileSync(file, 'utf8');
	const content = stripComments(raw);

	DEFINE_PATTERN.lastIndex = 0;
	if (DEFINE_PATTERN.test(content) && !GUARDED_PATTERN.test(content)) {
		failures.push(
			`[unguarded-define] ${relative}: customElements.define() must be guarded with if (!customElements.get(...))`,
		);
	}

	LITERAL_TAG_PATTERN.lastIndex = 0;
	for (const match of content.matchAll(LITERAL_TAG_PATTERN)) {
		const tag = match[1];
		if (!tag) continue;
		if (!literalTagOwners.has(tag)) literalTagOwners.set(tag, new Set());
		literalTagOwners.get(tag).add(relative);
	}
}

for (const [tag, owners] of literalTagOwners.entries()) {
	if (owners.size > 1) {
		failures.push(
			`[duplicate-tag] "${tag}" is defined in multiple files: ${[...owners].sort().join(', ')}`,
		);
	}
}

if (failures.length > 0) {
	console.error(`[check-ce-define-safety] ${failures.length} issue(s) found:`);
	for (const f of failures) console.error(`  - ${f}`);
	process.exit(1);
}

console.log(`[check-ce-define-safety] OK — ${files.length} source files checked`);
