#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

const parsePackJson = (rawOutput) => {
	const start = rawOutput.indexOf("[");
	const end = rawOutput.lastIndexOf("]");
	if (start < 0 || end < 0 || end < start) {
		throw new Error("npm pack output did not include JSON payload");
	}
	const jsonText = rawOutput.slice(start, end + 1);
	return JSON.parse(jsonText);
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

const run = () => {
	const packageDirs = getWorkspaceDirs();
	const failures = [];
	let checked = 0;

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;
		checked += 1;
		const declaredTargets = new Set();
		["main", "module", "types", "unpkg", "jsdelivr", "svelte"].forEach((field) => {
			const normalized = normalizeDeclaredPath(pkg[field]);
			if (normalized) declaredTargets.add(normalized);
		});
		collectExportTargets(pkg.exports, declaredTargets);

		let tarballPath = null;
		try {
			const rawOutput = execSync("npm pack --json", {
				cwd: dir,
				stdio: "pipe",
			}).toString();
			const packData = parsePackJson(rawOutput);
			const tarballName = packData?.[0]?.filename;
			if (!tarballName) {
				throw new Error("npm pack did not return tarball filename");
			}
			tarballPath = path.join(dir, tarballName);
			if (!existsSync(tarballPath)) {
				throw new Error(`tarball was not created: ${tarballName}`);
			}
			const packedFiles = new Set(
				(packData?.[0]?.files ?? []).map((entry) => entry.path),
			);
			for (const target of declaredTargets) {
				if (!isPackedMatch(target, packedFiles)) {
					throw new Error(`missing packed target in tarball: ${target}`);
				}
			}
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: path.relative(ROOT, dir),
				error: error.stderr?.toString()?.trim() || error.message,
			});
		} finally {
			if (tarballPath) rmSync(tarballPath, { force: true });
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-pack-smoke] Found ${failures.length} package(s) with tarball smoke test issues`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			console.error(failure.error);
		}
		process.exit(1);
	}

	console.log(
		`[check-pack-smoke] OK: validated ${checked} publishable package(s) via npm pack tarball smoke tests`,
	);
};

run();
