#!/usr/bin/env node

/**
 * Keeps every fixed group except the prerelease line on plain versions while
 * changesets pre mode is active.
 *
 * `changeset version` in pre mode appends the pre tag to every package it
 * versions — including the transformation group, whose line must stay plain
 * 0.1.x (publishing `0.1.29-beta.0` would put it under the `beta` dist-tag and
 * strand `latest` on 0.1.28). Run right after `changeset version`, this script
 * strips the `<tag>.N` suffix changesets just wrote:
 *
 * - package.json `version`: `0.1.29-beta.0` -> `0.1.29`
 * - the package's own CHANGELOG heading and `<name>@<version>` dependency
 *   references in any changelog: `@pie-qti/to-pie@0.1.29-beta.0` -> `...@0.1.29`
 *
 * Idempotent: at rest the group is plain, so the next version run produces a
 * fresh `-beta.0` to flatten. When pre mode ends, every group versions plain
 * and this script becomes a no-op. The group that owns the prerelease line is
 * `prereleaseVersionGroup` in scripts/publish-policy.json.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PRE_STATE_PATH = path.join(ROOT, ".changeset", "pre.json");
const CONFIG_PATH = path.join(ROOT, ".changeset", "config.json");
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");
const DEP_SECTIONS = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"devDependencies",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

if (!existsSync(PRE_STATE_PATH)) {
	process.exit(0);
}
const preState = readJson(PRE_STATE_PATH);
if (preState.mode !== "pre" || typeof preState.tag !== "string") {
	process.exit(0);
}

const config = readJson(CONFIG_PATH);
const policy = readJson(POLICY_PATH);
const groups = (Array.isArray(config.fixed) ? config.fixed : []).filter(Array.isArray);
if (groups.length === 0) {
	console.error("[flatten-nonprerelease-groups] No fixed groups in .changeset/config.json");
	process.exit(1);
}

const prereleaseGroupName = policy.prereleaseVersionGroup;
if (!prereleaseGroupName) {
	console.error(
		"[flatten-nonprerelease-groups] scripts/publish-policy.json is missing 'prereleaseVersionGroup'; refusing to guess which group keeps prerelease versions.",
	);
	process.exit(1);
}

const prereleaseGroup = groups.find((group) => group.includes(prereleaseGroupName));
if (!prereleaseGroup) {
	console.error(
		`[flatten-nonprerelease-groups] '${prereleaseGroupName}' is not in any fixed group.`,
	);
	process.exit(1);
}
const keepPrerelease = new Set(prereleaseGroup);

// Publishable workspace packages, with the manifest paths to flatten.
const workspaceRoots = policy.workspaceRoots ?? ["packages"];
const packages = [];
for (const workspaceRoot of workspaceRoots) {
	const absRoot = path.join(ROOT, workspaceRoot);
	if (!existsSync(absRoot)) continue;
	for (const dirent of readdirSync(absRoot, { withFileTypes: true })) {
		if (!dirent.isDirectory()) continue;
		const manifestPath = path.join(absRoot, dirent.name, "package.json");
		if (!existsSync(manifestPath)) continue;
		const manifest = readJson(manifestPath);
		if (manifest.private || typeof manifest.version !== "string") continue;
		if (!manifest.name.startsWith(policy.publishablePackageNamePrefix ?? "@pie-qti/")) continue;
		packages.push({ name: manifest.name, version: manifest.version, manifestPath });
	}
}

const prereleasePattern = new RegExp(`^(\\d+\\.\\d+\\.\\d+)-${preState.tag}\\.(\\d+)$`);

let flattened = 0;
const changelogEdits = [];

for (const pkg of packages) {
	if (keepPrerelease.has(pkg.name)) continue;
	const match = prereleasePattern.exec(pkg.version);
	if (!match) continue;
	const plainVersion = match[1];

	const manifest = readJson(pkg.manifestPath);
	manifest.version = plainVersion;
	writeFileSync(pkg.manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`, "utf8");
	flattened += 1;
	console.log(
		`[flatten-nonprerelease-groups] ${pkg.name}: ${pkg.version} -> ${plainVersion}`,
	);

	const suffixed = pkg.version;
	const token = `${pkg.name}@${suffixed}`;
	const plainToken = `${pkg.name}@${plainVersion}`;
	changelogEdits.push({ token, plainToken, ownChangelog: pkg.name });

	// The package's own fresh CHANGELOG entry is headed `## <version>` under the
	// `# <name>` title line.
	const changelogPath = path.join(path.dirname(pkg.manifestPath), "CHANGELOG.md");
	if (existsSync(changelogPath)) {
		const changelog = readFileSync(changelogPath, "utf8");
		const heading = `\n## ${suffixed}\n`;
		const at = changelog.indexOf(heading);
		if (at !== -1) {
			writeFileSync(
				changelogPath,
				`${changelog.slice(0, at)}\n## ${plainVersion}\n${changelog.slice(at + heading.length)}`,
				"utf8",
			);
		}
	}
}

// Dependency references in any changelog (own entries and dependents'
// "Updated dependencies" lists) name the package, so rewrite those tokens.
if (changelogEdits.length > 0) {
	const rewriteChangelogs = (dir) => {
		for (const dirent of readdirSync(dir, { withFileTypes: true })) {
			if (dirent.name === "node_modules" || dirent.name.startsWith(".")) continue;
			const abs = path.join(dir, dirent.name);
			if (dirent.isDirectory()) {
				rewriteChangelogs(abs);
			} else if (dirent.name === "CHANGELOG.md") {
				let contents = readFileSync(abs, "utf8");
				let changed = false;
				for (const { token, plainToken } of changelogEdits) {
					if (contents.includes(token)) {
						contents = contents.split(token).join(plainToken);
						changed = true;
					}
				}
				if (changed) writeFileSync(abs, contents, "utf8");
			}
		}
	};
	rewriteChangelogs(ROOT);
}

// Dependency ranges must not name the flattened packages' prerelease either:
// workspace ranges are resolved from the local versions at publish time, so a
// version bump above is all that is needed there. Verify nothing non-workspace
// still pins a suffixed version we just flattened.
for (const pkg of packages) {
	const manifest = readJson(pkg.manifestPath);
	for (const section of DEP_SECTIONS) {
		const deps = manifest[section];
		if (!deps || typeof deps !== "object") continue;
		for (const [depName, range] of Object.entries(deps)) {
			const flat = changelogEdits.find((edit) => edit.token.startsWith(`${depName}@`));
			if (!flat) continue;
			if (typeof range === "string" && range === flat.token.slice(depName.length + 1)) {
				console.error(
					`[flatten-nonprerelease-groups] ${pkg.name} ${section}.${depName} pins flattened version "${range}" instead of a workspace range.`,
				);
				process.exit(1);
			}
		}
	}
}

if (flattened === 0) {
	console.log("[flatten-nonprerelease-groups] No non-prerelease versions to flatten.");
}
