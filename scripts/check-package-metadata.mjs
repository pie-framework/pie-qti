#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const hasTruthy = (value) => {
	if (Array.isArray(value)) return value.length > 0;
	if (value && typeof value === "object") return Object.keys(value).length > 0;
	return value !== undefined && value !== null && value !== "";
};

const isValidBugs = (bugs) => {
	if (typeof bugs === "string") return bugs.startsWith("http");
	if (!bugs || typeof bugs !== "object") return false;
	return typeof bugs.url === "string" && bugs.url.startsWith("http");
};

const getWorkspaceDirs = (rootPackage, workspaceRoots) => {
	const workspaces = Array.isArray(rootPackage.workspaces)
		? rootPackage.workspaces
		: [];
	const dirs = new Set();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string") continue;
		const root = workspace.endsWith("/*") ? workspace.slice(0, -2) : workspace;
		if (!workspaceRoots.includes(root)) continue;

		if (workspace.endsWith("/*")) {
			const parent = path.join(ROOT, root);
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

const run = () => {
	if (!existsSync(POLICY_PATH)) {
		throw new Error(`Policy file missing: ${POLICY_PATH}`);
	}
	const policy = readJson(POLICY_PATH);
	const rootPackage = readJson(ROOT_PACKAGE_JSON);
	const workspaceDirs = getWorkspaceDirs(
		rootPackage,
		policy.workspaceRoots ?? ["packages"],
	);

	const failures = [];
	let checked = 0;

	for (const dir of workspaceDirs) {
		const packageJsonPath = path.join(dir, "package.json");
		const pkg = readJson(packageJsonPath);
		if (pkg.private) continue;
		checked += 1;

		const relDir = path.relative(ROOT, dir).replaceAll("\\", "/");
		const missing = [];

		for (const field of policy.requiredFields ?? []) {
			if (!hasTruthy(pkg[field])) {
				missing.push(`missing required field "${field}"`);
			}
		}

		if (policy.requireRepositoryDirectory) {
			if (
				!pkg.repository ||
				typeof pkg.repository !== "object" ||
				typeof pkg.repository.directory !== "string" ||
				pkg.repository.directory !== relDir
			) {
				missing.push(
					`repository.directory must be "${relDir}" for publishable packages`,
				);
			}
		}

		if (
			policy.requiredPublishConfigAccess &&
			pkg?.publishConfig?.access !== policy.requiredPublishConfigAccess
		) {
			missing.push(
				`publishConfig.access must be "${policy.requiredPublishConfigAccess}"`,
			);
		}

		if (policy.requireExportsOrMainTypes) {
			const hasExports = hasTruthy(pkg.exports);
			const hasMainAndTypes = hasTruthy(pkg.main) && hasTruthy(pkg.types);
			if (!hasExports && !hasMainAndTypes) {
				missing.push('must define "exports" or both "main" and "types"');
			}
		}

		if (!isValidBugs(pkg.bugs)) {
			missing.push('"bugs" must be a URL string or an object with URL');
		}

		if (policy.requireNodeEngine) {
			if (
				!pkg.engines ||
				typeof pkg.engines !== "object" ||
				typeof pkg.engines.node !== "string"
			) {
				missing.push('missing required "engines.node"');
			}
		}

		if (missing.length > 0) {
			failures.push({
				name: pkg.name || relDir,
				path: path.relative(ROOT, packageJsonPath),
				missing,
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-package-metadata] Found ${failures.length} package(s) with metadata policy violations`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.path})`);
			for (const issue of failure.missing) {
				console.error(`  - ${issue}`);
			}
		}
		process.exit(1);
	}

	console.log(
		`[check-package-metadata] OK: validated ${checked} publishable package(s)`,
	);
};

run();
