#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const policy = existsSync(POLICY_PATH) ? readJson(POLICY_PATH) : {};
const allowedSourceExportPackages = new Set(policy.allowedSourceExportPackages ?? []);

const getWorkspaceDirs = () => {
	const rootPkg = readJson(ROOT_PACKAGE_JSON);
	const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
	const dirs = new Set();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string") continue;
		if (workspace.endsWith("/*")) {
			const parent = path.join(ROOT, workspace.slice(0, -2));
			if (!existsSync(parent)) continue;
			for (const entry of readdirSync(parent, { withFileTypes: true })) {
				if (entry.isDirectory()) {
					dirs.add(path.join(parent, entry.name));
				}
			}
		} else {
			dirs.add(path.join(ROOT, workspace));
		}
	}

	return [...dirs].filter((dir) => existsSync(path.join(dir, "package.json")));
};

const collectTargets = (value, out) => {
	if (!value) return;
	if (typeof value === "string") {
		out.add(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectTargets(entry, out);
		return;
	}
	if (typeof value === "object") {
		for (const entry of Object.values(value)) collectTargets(entry, out);
	}
};

const violations = [];
let checked = 0;

for (const dir of getWorkspaceDirs()) {
	const pkg = readJson(path.join(dir, "package.json"));
	if (pkg.private) continue;

	checked += 1;
	const name = pkg.name || path.basename(dir);
	const targets = new Set();
	collectTargets(pkg.exports, targets);

	const sourceTargets = [...targets]
		.filter((target) => typeof target === "string" && target.startsWith("./src/"))
		.sort();

	if (sourceTargets.length === 0) continue;
	if (allowedSourceExportPackages.has(name)) continue;

	violations.push({
		name,
		dir,
		sourceTargets,
	});
}

if (violations.length > 0) {
	console.error(
		`[check-source-exports] Found ${violations.length} package(s) with unexpected source exports`,
	);
	for (const violation of violations) {
		console.error(`\n- ${violation.name} (${violation.dir})`);
		for (const target of violation.sourceTargets) {
			console.error(`  - ${target}`);
		}
	}
	process.exit(1);
}

console.log(
	`[check-source-exports] OK: validated ${checked} publishable package(s)`,
);
