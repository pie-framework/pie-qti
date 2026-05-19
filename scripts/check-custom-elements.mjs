#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, 'packages');
const SOURCE_EXTENSIONS = new Set(['.svelte', '.ts']);

const readText = (filePath) => readFileSync(filePath, 'utf8');
const readJson = (filePath) => JSON.parse(readText(filePath));
const rel = (filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/');

function walk(dir, visitor) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (['node_modules', 'dist', '.svelte-kit', 'coverage', '.turbo', 'build', 'tests'].includes(entry.name)) {
			continue;
		}
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(fullPath, visitor);
			continue;
		}
		if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
			visitor(fullPath);
		}
	}
}

const collectExportTargets = (value, out) => {
	if (!value) return;
	if (typeof value === 'string') {
		out.add(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectExportTargets(entry, out);
		return;
	}
	if (typeof value === 'object') {
		for (const entry of Object.values(value)) collectExportTargets(entry, out);
	}
};

const getCustomElementTags = (source) => {
	const tags = [];
	const constants = new Map();
	for (const match of source.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*["']([^"']+)["']/g)) {
		constants.set(match[1], match[2]);
	}
	for (const match of source.matchAll(/<svelte:options\s+customElement=["']([^"']+)["']/g)) {
		tags.push(match[1]);
	}
	for (const match of source.matchAll(/customElements\.define\s*\(\s*([A-Z0-9_]+|["']([^"']+)["'])/g)) {
		tags.push(match[2] ?? constants.get(match[1]) ?? '');
	}
	return tags.filter(Boolean);
};

const packageInfos = [];
for (const packageDirName of readdirSync(PACKAGES_DIR)) {
	const packageDir = path.join(PACKAGES_DIR, packageDirName);
	const packageJsonPath = path.join(packageDir, 'package.json');
	if (!existsSync(packageJsonPath)) continue;

	const customElementFiles = [];
	walk(packageDir, (filePath) => {
		const source = readText(filePath);
		if (
			source.includes('<svelte:options customElement=') ||
			source.includes('customElements.define(')
		) {
			customElementFiles.push(filePath);
		}
	});
	if (customElementFiles.length === 0) continue;

	packageInfos.push({
		packageDir,
		packageJsonPath,
		customElementFiles,
		tags: [...new Set(customElementFiles.flatMap((filePath) => getCustomElementTags(readText(filePath))))],
	});
}

const failures = [];
for (const info of packageInfos) {
	const pkg = readJson(info.packageJsonPath);
	const name = pkg.name ?? rel(info.packageDir);
	const exportsTargets = new Set();
	collectExportTargets(pkg.exports, exportsTargets);

	if (!pkg.scripts?.build) {
		failures.push(`${name}: custom element packages must define scripts.build`);
	}
	if (!Array.isArray(pkg.files) || !pkg.files.includes('dist')) {
		failures.push(`${name}: custom element packages must publish dist artifacts`);
	}
	if (pkg.sideEffects === false || pkg.sideEffects === undefined) {
		failures.push(`${name}: custom element packages must not declare sideEffects: false`);
	}

	for (const filePath of info.customElementFiles) {
		if (!filePath.endsWith('.svelte')) continue;
		const tags = getCustomElementTags(readText(filePath));
		if (tags.length === 0) {
			failures.push(`${rel(filePath)}: custom element source did not expose a parseable tag`);
		}
	}

	if (name === '@pie-qti/default-components') {
		const pluginsTarget = pkg.exports?.['./plugins'];
		const pluginImportTarget =
			typeof pluginsTarget === 'object' && pluginsTarget ? pluginsTarget.import : null;
		if (pluginImportTarget !== './dist/plugins.js') {
			failures.push(`${name}: ./plugins must publish the compiled ./dist/plugins.js entrypoint`);
		}
		if (![...exportsTargets].includes('./dist/plugins.js')) {
			failures.push(`${name}: ./dist/plugins.js must be part of package exports`);
		}
	}
}

if (failures.length > 0) {
	console.error(`[check-custom-elements] Found ${failures.length} custom element packaging issue(s)`);
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`[check-custom-elements] OK: validated ${packageInfos.length} custom element package(s)`,
);
