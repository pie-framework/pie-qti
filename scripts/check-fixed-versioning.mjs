#!/usr/bin/env node

/**
 * Validates the fixed-versioning invariants across the two release groups:
 *
 * - the player/platform group versions in lockstep and cuts the 1.0 line;
 * - the transformation group (pie-to-qti2, to-pie, the transform packages and
 *   source-profiles), still pre-alpha, stays on its own 0.1.x lockstep.
 *
 * Invariants checked:
 * 1. Every publishable @pie-qti package is a member of exactly one fixed group.
 * 2. Each fixed group is internally aligned on one version.
 * 3. (Full mode) No package's local version regresses behind its published npm
 *    version. A local version equal to the published one is fine (the package
 *    simply is not part of the pending release); greater is the release.
 *
 * Internal dependencies must keep workspace:* style ranges.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHANGESET_CONFIG_PATH = path.join(ROOT, ".changeset", "config.json");
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");
const DEP_SECTIONS = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"devDependencies",
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const getWorkspaceRoots = () => {
	if (!existsSync(POLICY_PATH)) return ["packages"];
	const policy = readJson(POLICY_PATH);
	return policy.workspaceRoots ?? ["packages"];
};

const discoverPublishablePackages = () => {
	const packages = [];

	for (const workspaceRoot of getWorkspaceRoots()) {
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

const parseSemver = (value) => {
	if (typeof value !== "string") return null;
	const normalized = value.trim().replace(/^v/, "");
	const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
	if (!match) return null;
	const prerelease = match[4]
		? match[4].split(".").map((id) => (/^\d+$/.test(id) ? Number.parseInt(id, 10) : id))
		: undefined;
	return {
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10),
		prerelease,
		raw: normalized,
	};
};

/** Semver precedence, including prerelease identifier rules. */
const compareSemver = (a, b) => {
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	if (a.patch !== b.patch) return a.patch - b.patch;
	const aPre = a.prerelease;
	const bPre = b.prerelease;
	if (aPre === bPre) return 0;
	if (aPre === undefined) return 1; // a release outranks its prereleases
	if (bPre === undefined) return -1;
	const length = Math.max(aPre.length, bPre.length);
	for (let i = 0; i < length; i += 1) {
		const aId = aPre[i];
		const bId = bPre[i];
		if (aId === undefined) return -1;
		if (bId === undefined) return 1;
		if (aId === bId) continue;
		if (typeof aId === "number" && typeof bId === "number") return aId - bId;
		return String(aId) < String(bId) ? -1 : 1;
	}
	return 0;
};

const fetchPublishedVersion = (pkgName) => {
	try {
		const out = execSync(`npm view "${pkgName}" version --json`, {
			cwd: ROOT,
			stdio: "pipe",
		})
			.toString("utf8")
			.trim();
		const parsed = JSON.parse(out);
		if (typeof parsed === "string") return parsed;
		if (Array.isArray(parsed) && parsed.length > 0) {
			return String(parsed[parsed.length - 1]);
		}
		return null;
	} catch (error) {
		const stderr = error.stderr?.toString?.() ?? "";
		const msg = `${stderr} ${error.message ?? ""}`;
		if (/404|ENOTFOUND|E404|Not found|could not be found/i.test(msg)) {
			return null;
		}
		fail(
			`Failed to read published version for ${pkgName} from npm: ${stderr.trim() || error.message}`,
		);
	}
};

const publishablePackages = discoverPublishablePackages();
if (publishablePackages.length === 0) {
	fail("No publishable @pie-qti packages found in packages/*.");
}

if (!existsSync(CHANGESET_CONFIG_PATH)) {
	fail("Missing .changeset/config.json");
}

const changesetConfig = readJson(CHANGESET_CONFIG_PATH);
const fixedGroups = Array.isArray(changesetConfig.fixed)
	? changesetConfig.fixed.filter(Array.isArray)
	: [];
if (fixedGroups.length === 0) {
	fail("Changeset config declares no fixed groups.");
}

const publishableSet = new Set(publishablePackages.map((pkg) => pkg.name));

// 1. Membership: every publishable package in exactly one fixed group.
const membership = new Map();
for (const [index, group] of fixedGroups.entries()) {
	for (const name of group) {
		if (!publishableSet.has(name)) {
			fail(`Fixed group ${index + 1} names '${name}', which is not a publishable package.`);
		}
		if (membership.has(name)) {
			fail(`'${name}' is a member of more than one fixed group.`);
		}
		membership.set(name, index);
	}
}
const missingFromFixed = [...publishableSet].filter((name) => !membership.has(name));
if (missingFromFixed.length > 0) {
	fail(
		`Publishable packages missing from every fixed group:\n${missingFromFixed
			.map((p) => `- ${p}`)
			.join("\n")}`,
	);
}

// 2. Alignment: each group internally agrees on one version.
const groupSummaries = [];
for (const [index, group] of fixedGroups.entries()) {
	const names = [...group].sort((a, b) => a.localeCompare(b));
	const versions = new Map();
	for (const name of names) {
		const pkg = publishablePackages.find((entry) => entry.name === name);
		const list = versions.get(pkg.version) ?? [];
		list.push(name);
		versions.set(pkg.version, list);
	}
	if (versions.size !== 1) {
		const details = [...versions.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([version, namesInVersion]) => `- ${version}: ${namesInVersion.join(", ")}`)
			.join("\n");
		fail(`Fixed group ${index + 1} is not version-aligned:\n${details}`);
	}
	const version = [...versions.keys()][0];
	groupSummaries.push({ index: index + 1, names, version });
}

// 3. (Full mode) No package regresses behind its published version.
if (process.env.SKIP_NPM_VERSION_SEQUENCE_CHECK !== "1") {
	for (const summary of groupSummaries) {
		const localSemver = parseSemver(summary.version);
		if (!localSemver) {
			fail(`Group ${summary.index} version "${summary.version}" is not a valid semver.`);
		}
		let compared = 0;
		for (const name of summary.names) {
			const published = fetchPublishedVersion(name);
			if (!published) continue;
			compared += 1;
			const publishedSemver = parseSemver(published);
			if (!publishedSemver) {
				fail(`Invalid published semver for ${name}: '${published}'`);
			}
			if (compareSemver(localSemver, publishedSemver) < 0) {
				fail(
					`${name} would regress: local ${summary.version} is behind published ${published}.`,
				);
			}
		}
		if (compared === 0) {
			console.log(
				`[check-fixed-versioning] Group ${summary.index}: nothing on npm yet; skipping sequence check.`,
			);
		}
	}
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

for (const summary of groupSummaries) {
	console.log(
		`[check-fixed-versioning] OK: fixed group ${summary.index} (${summary.names.length} packages) at version ${summary.version}`,
	);
}
