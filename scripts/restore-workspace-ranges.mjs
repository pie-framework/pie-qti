#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const workspaceRoots = ["packages", "tools", "apps"];
const depSections = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"devDependencies",
];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const packageJsonPaths = [];
const localPackageNames = new Set();

for (const root of workspaceRoots) {
	const rootDir = join(repoRoot, root);
	if (!existsSync(rootDir)) continue;
	for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const pkgJsonPath = join(rootDir, entry.name, "package.json");
		if (!existsSync(pkgJsonPath)) continue;
		try {
			const pkg = readJson(pkgJsonPath);
			if (pkg?.name) {
				localPackageNames.add(pkg.name);
			}
			packageJsonPaths.push(pkgJsonPath);
		} catch {
			// Ignore non-package directories.
		}
	}
}

let changedFiles = 0;
let changedRanges = 0;

for (const pkgJsonPath of packageJsonPaths) {
	const original = readFileSync(pkgJsonPath, "utf8");
	const pkg = JSON.parse(original);
	let changed = false;

	for (const section of depSections) {
		const deps = pkg[section];
		if (!deps) continue;
		for (const [name, range] of Object.entries(deps)) {
			if (!localPackageNames.has(name)) continue;
			if (name === pkg.name) continue;
			if (typeof range !== "string") continue;
			if (range.startsWith("workspace:")) continue;
			deps[name] = "workspace:*";
			changed = true;
			changedRanges++;
		}
	}

	if (changed) {
		writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf8");
		changedFiles++;
	}
}

if (changedFiles === 0) {
	console.log("[restore-workspace-ranges] OK: no changes needed");
} else {
	console.log(
		`[restore-workspace-ranges] Restored workspace:* for ${changedRanges} internal range(s) across ${changedFiles} package.json file(s)`,
	);
}
