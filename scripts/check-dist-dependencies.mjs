#!/usr/bin/env node
/**
 * Validates package.json dependency declarations against what shipped dist
 * code actually imports. Complements check-deps.mjs (source-level) and
 * check-publint.mjs (closure walk over entry points) with a complete
 * per-package inventory:
 *
 *  1. every bare specifier imported by dist/*.js must be declared in
 *     dependencies / optionalDependencies / peerDependencies (or the
 *     allowedUndeclaredRuntimeImports allowlist in publish-policy.json);
 *  2. every bare specifier imported by dist/*.d.ts must be declared in one
 *     of those buckets too (type-only deps still break consumer typechecks);
 *  3. every declared dependency must be referenced by dist — dependencies
 *     that are bundled by vite instead of imported, or consumed only by
 *     Svelte sources compiled elsewhere, must be listed in the
 *     dependenciesUnreferencedByDist allowlist in publish-policy.json with
 *     a reason.
 *
 * Exit code 1 lists all violations.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const policy = JSON.parse(readFileSync(path.join(ROOT, 'scripts/publish-policy.json'), 'utf8'));

const PREFIX = policy.publishablePackageNamePrefix;
const ALLOWED_UNDECLARED = policy.allowedUndeclaredRuntimeImports ?? {};
const ALLOWED_UNREFERENCED = policy.dependenciesUnreferencedByDist ?? {};

// Node builtins may be imported without the `node:` prefix.
const NODE_BUILTINS = new Set([
	'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
	'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
	'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
	'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'trace_events',
	'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
]);

const DTS_SPECIFIER_PATTERN = /(?:from\s*|import\s+)["']([^"']+)["']/g;

const stripComments = (src) =>
	src
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');

function isBare(specifier) {
	return (
		!specifier.startsWith('.') &&
		!specifier.startsWith('/') &&
		!specifier.startsWith('#') &&
		!specifier.startsWith('node:') &&
		!specifier.startsWith('data:') &&
		!specifier.startsWith('file:')
	);
}

function toPackageName(specifier) {
	if (!isBare(specifier)) return null;
	if (NODE_BUILTINS.has(specifier.split('/')[0])) return null;
	if (specifier.startsWith('@')) {
		const [scope, name] = specifier.split('/');
		if (!scope || !name) return null; // @scope-only is malformed; let other checks handle it
		return `${scope}/${name}`;
	}
	return specifier.split('/')[0];
}

function collectFiles(dir, extensions, out = []) {
	for (const entry of readdirSync(dir)) {
		const abs = path.join(dir, entry);
		const stat = statSync(abs);
		if (stat.isDirectory()) collectFiles(abs, extensions, out);
		else if (extensions.some((ext) => entry.endsWith(ext))) out.push(abs);
	}
	return out;
}

/**
 * Runtime specifiers via Bun's real parser (handles minified bundles and
 * ignores specifiers inside strings/comments). Type specifiers via
 * comment-stripped regex — Bun's scanner skips `import type`, but type-only
 * dependencies still break consumer typechecks, so d.ts must include them.
 */
function collectSpecifiers(files, { types = false } = {}) {
	const specifiers = new Set();
	const parseFailures = [];

	for (const file of files) {
		const content = readFileSync(file, 'utf8');
		let matches;
		if (types) {
			matches = [...stripComments(content).matchAll(DTS_SPECIFIER_PATTERN)].map((m) => m[1]);
		} else {
			try {
				matches = new Bun.Transpiler({ loader: 'js' }).scanImports(content).map((imp) => imp.path);
			} catch (error) {
				parseFailures.push(`${path.relative(ROOT, file)}: ${error.message}`);
				continue;
			}
		}
		for (const specifier of matches) {
			const name = toPackageName(specifier);
			if (name) specifiers.add(name);
		}
	}

	return { specifiers, parseFailures };
}

const failures = [];
const checked = [];
const globalAllowedUndeclared = new Set(
	Object.keys(ALLOWED_UNDECLARED).length > 0 && Array.isArray(ALLOWED_UNDECLARED['*'])
		? ALLOWED_UNDECLARED['*']
		: [],
);

for (const workspaceRoot of policy.workspaceRoots) {
	const rootDir = path.join(ROOT, workspaceRoot);
	if (!existsSync(rootDir)) continue;

	for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const packageDir = path.join(rootDir, entry.name);
		const manifestPath = path.join(packageDir, 'package.json');
		if (!existsSync(manifestPath)) continue;

		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		const name = manifest.name;
		if (!name?.startsWith(PREFIX) || manifest.private) continue;

		const distDir = path.join(packageDir, 'dist');
		if (!existsSync(distDir)) continue; // built on demand by check-publint

		const jsFiles = collectFiles(distDir, ['.js', '.mjs']);
		const dtsFiles = collectFiles(distDir, ['.d.ts']);
		const { specifiers: runtimeSpecifiers, parseFailures } = collectSpecifiers(jsFiles);
		const { specifiers: typeSpecifiers } = collectSpecifiers(dtsFiles, { types: true });

		for (const failure of parseFailures) {
			failures.push(`[unparseable-dist] ${name}: ${failure}`);
		}

		const declared = new Set([
			...Object.keys(manifest.dependencies ?? {}),
			...Object.keys(manifest.optionalDependencies ?? {}),
			...Object.keys(manifest.peerDependencies ?? {}),
		]);
		const runtimeDeps = new Set([
			...Object.keys(manifest.dependencies ?? {}),
			...Object.keys(manifest.optionalDependencies ?? {}),
		]);
		const packageUndeclaredAllowed = new Set(ALLOWED_UNDECLARED[name] ?? []);
		const unreferencedAllowed = ALLOWED_UNREFERENCED[name] ?? {};

		checked.push(name);

		for (const specifier of runtimeSpecifiers) {
			if (specifier === name) continue; // self-import
			if (runtimeDeps.has(specifier)) continue;
			if (globalAllowedUndeclared.has(specifier) || packageUndeclaredAllowed.has(specifier)) continue;
			failures.push(
				`[undeclared-runtime-import] ${name}: dist imports "${specifier}" but it is not in dependencies/optionalDependencies (peerDependencies do not install runtime code)`,
			);
		}

		for (const specifier of typeSpecifiers) {
			if (specifier === name) continue;
			if (declared.has(specifier)) continue;
			if (globalAllowedUndeclared.has(specifier) || packageUndeclaredAllowed.has(specifier)) continue;
			failures.push(
				`[undeclared-type-import] ${name}: dist *.d.ts import "${specifier}" but it is not declared in any dependency bucket`,
			);
		}

		for (const dependency of runtimeDeps) {
			if (runtimeSpecifiers.has(dependency) || typeSpecifiers.has(dependency)) continue;
			if (unreferencedAllowed[dependency]) continue;
			failures.push(
				`[unreferenced-dependency] ${name}: "${dependency}" is declared in dependencies but never imported by dist — move it to devDependencies, remove it, or allowlist it in publish-policy.json dependenciesUnreferencedByDist with a reason`,
			);
		}

		for (const dependency of Object.keys(unreferencedAllowed)) {
			if (!runtimeDeps.has(dependency)) {
				failures.push(
					`[stale-allowlist-entry] ${name}: dependenciesUnreferencedByDist lists "${dependency}" which is not a declared dependency — remove the allowlist entry`,
				);
			}
		}
	}
}

if (failures.length > 0) {
	console.error(`[check-dist-dependencies] ${failures.length} issue(s) found:`);
	for (const failure of failures) console.error(`  - ${failure}`);
	process.exit(1);
}

console.log(
	`[check-dist-dependencies] OK — validated dist/imports for ${checked.length} publishable package(s)`,
);
