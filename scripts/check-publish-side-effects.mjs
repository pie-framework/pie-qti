#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, 'scripts', 'publish-policy.json');

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const policy = existsSync(POLICY_PATH) ? readJson(POLICY_PATH) : {};
const requiredSideEffects = policy.requiredPackageSideEffects ?? {};
const workspaceRoots = Array.isArray(policy.workspaceRoots) ? policy.workspaceRoots : ['packages'];

const toPosix = (value) => value.replaceAll(path.sep, '/');

const getWorkspaceDirs = () => {
	const dirs = new Set();
	for (const rootDir of workspaceRoots) {
		const absRoot = path.join(ROOT, rootDir);
		if (!existsSync(absRoot)) continue;
		for (const entry of readdirSync(absRoot, { withFileTypes: true })) {
			if (entry.isDirectory()) dirs.add(path.join(absRoot, entry.name));
		}
	}
	return [...dirs].filter((dir) => existsSync(path.join(dir, 'package.json')));
};

const sideEffectsIncludes = (sideEffects, requiredEntry) => {
	if (sideEffects === true) return true;
	if (!Array.isArray(sideEffects)) return false;
	return sideEffects.includes(requiredEntry);
};

const parsePackJson = (rawOutput) => {
	const start = rawOutput.indexOf('[');
	const end = rawOutput.lastIndexOf(']');
	if (start < 0 || end < 0 || end < start) {
		throw new Error('npm pack output did not include JSON payload');
	}
	return JSON.parse(rawOutput.slice(start, end + 1));
};

const globToRegex = (entry) => {
	const normalized = entry.replace(/^\.\//, '');
	const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
	return new RegExp(`^${escaped}$`);
};

const sideEffectEntryResolves = (entry, packedFiles) => {
	const normalized = entry.replace(/^\.\//, '');
	if (!entry.startsWith('./dist/')) return false;
	if (!entry.includes('*')) return packedFiles.has(normalized);
	const matcher = globToRegex(entry);
	return [...packedFiles].some((filePath) => matcher.test(filePath));
};

const failures = [];

for (const [packageName, requiredEntries] of Object.entries(requiredSideEffects)) {
	if (!Array.isArray(requiredEntries)) continue;
	const packagePath = path.join(ROOT, 'packages', packageName.replace(/^@pie-qti\//, ''), 'package.json');
	if (!existsSync(packagePath)) {
		failures.push(`${packageName}: package.json not found at ${path.relative(ROOT, packagePath)}`);
		continue;
	}
	const pkg = readJson(packagePath);
	for (const requiredEntry of requiredEntries) {
		if (!sideEffectsIncludes(pkg.sideEffects, requiredEntry)) {
			failures.push(
				`${packageName}: sideEffects must include ${requiredEntry} or be true because this entrypoint mutates runtime registries/customElements`,
			);
		}
	}
}

for (const packageDir of getWorkspaceDirs()) {
	const pkg = readJson(path.join(packageDir, 'package.json'));
	if (pkg.private) continue;
	if (pkg.sideEffects === true || pkg.sideEffects === false || pkg.sideEffects == null) continue;
	if (!Array.isArray(pkg.sideEffects)) {
		failures.push(`${pkg.name}: sideEffects must be a boolean or an array`);
		continue;
	}

	let packedFiles;
	try {
		const rawOutput = execSync('npm pack --dry-run --json', {
			cwd: packageDir,
			stdio: ['ignore', 'pipe', 'pipe'],
		}).toString();
		const packData = parsePackJson(rawOutput);
		packedFiles = new Set((packData?.[0]?.files ?? []).map((entry) => toPosix(entry.path)));
	} catch (error) {
		failures.push(
			`${pkg.name}: failed to inspect packed sideEffects entries: ${
				error.stderr?.toString()?.trim() || error.message
			}`,
		);
		continue;
	}

	for (const entry of pkg.sideEffects) {
		if (typeof entry !== 'string') {
			failures.push(`${pkg.name}: sideEffects entry must be a string: ${String(entry)}`);
			continue;
		}
		if (!sideEffectEntryResolves(entry, packedFiles)) {
			failures.push(`${pkg.name}: sideEffects entry must resolve to packed dist file(s): ${entry}`);
		}
	}
}

if (failures.length > 0) {
	console.error(`[check-publish-side-effects] Found ${failures.length} publish side-effect issue(s)`);
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`[check-publish-side-effects] OK: validated ${Object.keys(requiredSideEffects).length} package side-effect contract(s)`,
);
