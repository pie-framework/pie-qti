#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHANGESET_CONFIG_PATH = path.join(ROOT, ".changeset", "config.json");
const WORKSPACE_ROOTS = ["packages", "tools"];
const DEP_SECTIONS = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"devDependencies",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const discoverPublishablePackages = () => {
	const packages = [];

	for (const workspaceRoot of WORKSPACE_ROOTS) {
		const absRoot = path.join(ROOT, workspaceRoot);
		if (!existsSync(absRoot)) continue;

		for (const dirent of readdirSync(absRoot, { withFileTypes: true })) {
			if (!dirent.isDirectory()) continue;
			const packageDir = path.join(absRoot, dirent.name);
			const manifestPath = path.join(packageDir, "package.json");
			if (!existsSync(manifestPath)) continue;

			const manifest = readJson(manifestPath);
			if (manifest.private) continue;
			if (typeof manifest.name !== "string") continue;
			if (!manifest.name.startsWith("@pie-qti/")) continue;
			if (typeof manifest.version !== "string") continue;

			packages.push({
				name: manifest.name,
				version: manifest.version,
				manifestPath,
				manifest,
			});
		}
	}

	return packages.sort((a, b) => a.name.localeCompare(b.name));
};

const fail = (message) => {
	console.error(`[check-fixed-versioning] ${message}`);
	process.exit(1);
};

const publishablePackages = discoverPublishablePackages();
if (publishablePackages.length === 0) {
	fail("No publishable @pie-qti packages found in packages/* or tools/*.");
}

if (!existsSync(CHANGESET_CONFIG_PATH)) {
	fail("Missing .changeset/config.json");
}

const changesetConfig = readJson(CHANGESET_CONFIG_PATH);
const fixedGroups = Array.isArray(changesetConfig.fixed) ? changesetConfig.fixed : [];
const fixedSet = new Set(
	fixedGroups.flatMap((group) => (Array.isArray(group) ? group : [])),
);
const publishableSet = new Set(publishablePackages.map((pkg) => pkg.name));

const missingFromFixed = [...publishableSet].filter((name) => !fixedSet.has(name));
const extraInFixed = [...fixedSet].filter((name) => !publishableSet.has(name));

if (missingFromFixed.length > 0 || extraInFixed.length > 0) {
	const missingText =
		missingFromFixed.length > 0
			? `Missing from fixed group:\n${missingFromFixed.map((p) => `- ${p}`).join("\n")}`
			: "";
	const extraText =
		extraInFixed.length > 0
			? `Unexpected in fixed group:\n${extraInFixed.map((p) => `- ${p}`).join("\n")}`
			: "";
	fail(`Changesets fixed group does not match publishable package set.\n${missingText}\n${extraText}`.trim());
}

const versions = new Set(publishablePackages.map((pkg) => pkg.version));
if (versions.size !== 1) {
	const byVersion = new Map();
	for (const pkg of publishablePackages) {
		const list = byVersion.get(pkg.version) || [];
		list.push(pkg.name);
		byVersion.set(pkg.version, list);
	}

	const details = [...byVersion.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([version, names]) => `- ${version}: ${names.join(", ")}`)
		.join("\n");

	fail(`Expected one lockstep version across publishable packages, found ${versions.size}:\n${details}`);
}

const violations = [];
for (const pkg of publishablePackages) {
	for (const section of DEP_SECTIONS) {
		const deps = pkg.manifest[section];
		if (!deps || typeof deps !== "object") continue;

		for (const [depName, depRange] of Object.entries(deps)) {
			if (!depName.startsWith("@pie-qti/")) continue;
			if (!publishableSet.has(depName)) continue;
			if (depName === pkg.name) continue;
			if (typeof depRange !== "string") continue;
			if (!depRange.startsWith("workspace:")) {
				violations.push(
					`${pkg.name} (${path.relative(ROOT, pkg.manifestPath)}): ${section}.${depName} must use workspace:* style, found "${depRange}"`,
				);
			}
		}
	}
}

if (violations.length > 0) {
	fail(`Found ${violations.length} internal dependency invariant violation(s):\n${violations.join("\n")}`);
}

console.log(
	`[check-fixed-versioning] OK: ${publishablePackages.length} publishable packages in one fixed group at version ${publishablePackages[0].version}`,
);
