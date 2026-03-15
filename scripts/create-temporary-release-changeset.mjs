#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_ROOT = path.join(ROOT, "packages");
const CHANGESET_DIR = path.join(ROOT, ".changeset");
const CHANGESET_FILE = path.join(CHANGESET_DIR, "temporary-release-all-packages.md");

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const fail = (message) => {
	console.error(`[create-temporary-release-changeset] ${message}`);
	process.exit(1);
};

const discoverPublishablePackages = () => {
	if (!existsSync(PACKAGE_ROOT)) return [];

	const packages = [];

	for (const entry of readdirSync(PACKAGE_ROOT, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const manifestPath = path.join(PACKAGE_ROOT, entry.name, "package.json");
		if (!existsSync(manifestPath)) continue;

		const manifest = readJson(manifestPath);
		if (manifest.private) continue;
		if (typeof manifest.name !== "string") continue;
		if (!manifest.name.startsWith("@pie-qti/")) continue;

		packages.push(manifest.name);
	}

	return packages.sort((a, b) => a.localeCompare(b));
};

if (!existsSync(CHANGESET_DIR)) {
	fail("Missing .changeset directory.");
}

const packageNames = discoverPublishablePackages();
if (packageNames.length === 0) {
	fail("No publishable @pie-qti packages discovered under packages/*.");
}

const frontmatterLines = packageNames.map((packageName) => `"${packageName}": patch`);
const contents = [
	"---",
	...frontmatterLines,
	"---",
	"",
	"Temporary release changeset: patch all publishable packages to keep lockstep versions.",
	"",
].join("\n");

writeFileSync(CHANGESET_FILE, contents, "utf8");

console.log(
	`[create-temporary-release-changeset] Wrote ${path.relative(ROOT, CHANGESET_FILE)} for ${packageNames.length} packages.`,
);
