#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const normalizeDeclaredPath = (value) => {
	if (typeof value !== "string") return null;
	if (!value.startsWith("./")) return null;
	const normalized = value.slice(2);
	return normalized.length > 0 ? normalized : null;
};

const isPackedMatch = (declaredPath, packedFiles) => {
	if (packedFiles.has(declaredPath)) return true;
	if (declaredPath.includes("*")) {
		const escaped = declaredPath
			.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
			.replace(/\*/g, ".*");
		const pattern = new RegExp(`^${escaped}$`);
		return [...packedFiles].some((file) => pattern.test(file));
	}
	return false;
};

const collectExportTargets = (value, out) => {
	if (!value) return;
	if (typeof value === "string") {
		const normalized = normalizeDeclaredPath(value);
		if (normalized) out.add(normalized);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((entry) => collectExportTargets(entry, out));
		return;
	}
	if (typeof value === "object") {
		Object.values(value).forEach((entry) => collectExportTargets(entry, out));
	}
};

const getWorkspaceDirs = () => {
	const rootPkg = readJson(ROOT_PACKAGE_JSON);
	const workspaces = Array.isArray(rootPkg.workspaces)
		? rootPkg.workspaces
		: [];
	const dirs = new Set();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string") continue;
		if (!workspace.startsWith("packages/") && !workspace.startsWith("tools/")) {
			continue;
		}
		if (workspace.endsWith("/*")) {
			const parent = path.join(ROOT, workspace.slice(0, -2));
			if (!existsSync(parent)) continue;
			for (const entry of readdirSync(parent, { withFileTypes: true })) {
				if (entry.isDirectory()) {
					dirs.add(path.join(parent, entry.name));
				}
			}
			continue;
		}
		dirs.add(path.join(ROOT, workspace));
	}

	return [...dirs].filter((dir) => existsSync(path.join(dir, "package.json")));
};

const parsePackJson = (rawOutput) => {
	const start = rawOutput.indexOf("[");
	const end = rawOutput.lastIndexOf("]");
	if (start < 0 || end < 0 || end < start) {
		throw new Error("npm pack output did not include JSON payload");
	}
	const jsonText = rawOutput.slice(start, end + 1);
	return JSON.parse(jsonText);
};

const run = () => {
	const packageDirs = getWorkspaceDirs();
	const failures = [];
	let checked = 0;

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;

		checked += 1;
		const declaredTargets = new Set();

		["main", "module", "types", "unpkg", "jsdelivr", "svelte"].forEach(
			(field) => {
				const normalized = normalizeDeclaredPath(pkg[field]);
				if (normalized) declaredTargets.add(normalized);
			},
		);

		collectExportTargets(pkg.exports, declaredTargets);

		let packedFiles;
		try {
			const rawOutput = execSync("npm pack --dry-run --json", {
				cwd: dir,
				stdio: ["ignore", "pipe", "pipe"],
			}).toString();
			const packData = parsePackJson(rawOutput);
			const fileEntries = packData?.[0]?.files ?? [];
			packedFiles = new Set(fileEntries.map((entry) => entry.path));
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir,
				missing: ["<failed to run npm pack --dry-run --json>"],
			});
			continue;
		}

		const missing = [...declaredTargets]
			.filter((target) => !isPackedMatch(target, packedFiles))
			.sort();

		if (missing.length > 0) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir,
				missing,
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-pack-exports] Found ${failures.length} package(s) with publish mismatches`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			for (const missingEntry of failure.missing) {
				console.error(`  - missing: ${missingEntry}`);
			}
		}
		process.exit(1);
	}

	console.log(
		`[check-pack-exports] OK: validated ${checked} publishable package(s)`,
	);
};

run();
