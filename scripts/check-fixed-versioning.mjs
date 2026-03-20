#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHANGESET_CONFIG_PATH = path.join(ROOT, ".changeset", "config.json");
const WORKSPACE_ROOTS = ["packages"];
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

const parseSemver = (value) => {
	if (typeof value !== "string") return null;
	const normalized = value.trim().replace(/^v/, "");
	const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/);
	if (!match) return null;
	return {
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10),
		raw: normalized,
	};
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

if (process.env.SKIP_NPM_VERSION_SEQUENCE_CHECK !== "1") {
	const localVersion = publishablePackages[0].version;
	const localSemver = parseSemver(localVersion);
	if (!localSemver) {
		fail(`Local version "${localVersion}" is not a valid semver.`);
	}

	const publishedVersionMap = new Map();
	for (const pkg of publishablePackages) {
		const published = fetchPublishedVersion(pkg.name);
		if (published) {
			publishedVersionMap.set(pkg.name, published);
		}
	}

	if (publishedVersionMap.size === 0) {
		console.log(
			"[check-fixed-versioning] No packages found on npm; skipping npm patch sequence check.",
		);
	} else if (publishedVersionMap.size < publishablePackages.length) {
		const unpublished = publishablePackages
			.filter((p) => !publishedVersionMap.has(p.name))
			.map((p) => p.name);
		console.log(
			`[check-fixed-versioning] Unpublished on npm (skipped for patch sequence): ${unpublished.join(", ")}`,
		);
	}

	if (publishedVersionMap.size === 0) {
		// First-time monorepo publish or offline; workspace invariants already checked above.
	} else {
		const parsedPublished = [...publishedVersionMap.entries()].map(([name, version]) => ({
			name,
			version,
			semver: parseSemver(version),
		}));
		const invalidPublished = parsedPublished.filter((entry) => !entry.semver);
		if (invalidPublished.length > 0) {
			fail(
				`Found invalid published semver(s):\n${invalidPublished
					.map((entry) => `- ${entry.name}: ${entry.version}`)
					.join("\n")}`,
			);
		}

		const publishedVersions = new Set(parsedPublished.map((entry) => entry.version));
		const convergenceMode = publishedVersions.size > 1;
		const publishedMajorMinor = new Set(
			parsedPublished.map((entry) => `${entry.semver.major}.${entry.semver.minor}`),
		);
		if (publishedMajorMinor.size !== 1) {
			const details = parsedPublished
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((entry) => `- ${entry.name}: ${entry.version}`)
				.join("\n");
			fail(
				`Expected one published major/minor across fixed packages during patch-only releases, found ${publishedMajorMinor.size}:\n${details}`,
			);
		}

		const highestPublished = parsedPublished.reduce((max, current) =>
			current.semver.patch > max.semver.patch ? current : max,
		);
		const referencePublishedVersion = highestPublished.version;

		if (
			localSemver.major !== highestPublished.semver.major ||
			localSemver.minor !== highestPublished.semver.minor
		) {
			fail(
				`Local version ${localVersion} must keep major/minor aligned with highest published ${referencePublishedVersion} for patch lockstep releases.`,
			);
		}

		const delta = localSemver.patch - highestPublished.semver.patch;
		if (convergenceMode) {
			if (delta <= 0) {
				fail(
					`Local version ${localVersion} must be ahead of highest published ${referencePublishedVersion} while converging mixed published patch versions.`,
				);
			}
			console.log(
				`[check-fixed-versioning] Convergence mode: allowing local ${localVersion} to advance from mixed published baseline (highest ${referencePublishedVersion}).`,
			);
		} else if (delta !== 1) {
			if (delta <= 0) {
				fail(
					`Local version ${localVersion} must be exactly one patch ahead of highest published ${referencePublishedVersion}. Did you run changeset version?`,
				);
			}
			fail(
				`Local version ${localVersion} skips patch versions from highest published ${referencePublishedVersion}. Reset version/changelog files and rerun release once.`,
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

console.log(
	`[check-fixed-versioning] OK: ${publishablePackages.length} publishable packages in one fixed group at version ${publishablePackages[0].version}`,
);
