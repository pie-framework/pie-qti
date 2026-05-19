#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, 'scripts', 'publish-policy.json');

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const policy = existsSync(POLICY_PATH) ? readJson(POLICY_PATH) : {};
const requiredSideEffects = policy.requiredPackageSideEffects ?? {};

const sideEffectsIncludes = (sideEffects, requiredEntry) => {
	if (sideEffects === true) return true;
	if (!Array.isArray(sideEffects)) return false;
	return sideEffects.includes(requiredEntry);
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
