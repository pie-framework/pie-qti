#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");
const MAX_DETAILS_PER_PACKAGE = 20;
const FORBIDDEN_EXPORT_CONDITIONS = new Set(["development", "svelte"]);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const toPosix = (value) => value.replaceAll(path.sep, "/");
const policy = existsSync(POLICY_PATH) ? readJson(POLICY_PATH) : {};
const forbiddenPublicExports = new Map(
	Object.entries(policy.forbiddenPublicExports || {}),
);

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
				if (entry.isDirectory()) dirs.add(path.join(parent, entry.name));
			}
			continue;
		}
		dirs.add(path.join(ROOT, workspace));
	}

	return [...dirs].filter((dir) => existsSync(path.join(dir, "package.json")));
};

const normalizeTarget = (value) => {
	if (typeof value !== "string" || !value.startsWith("./")) return null;
	return value.slice(2);
};

const collectTargets = (value, out) => {
	const normalized = normalizeTarget(value);
	if (normalized) {
		out.add(normalized);
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectTargets(entry, out);
		return;
	}
	if (value && typeof value === "object") {
		for (const entry of Object.values(value)) collectTargets(entry, out);
	}
};

const collectExportKeyViolations = (pkg, violations) => {
	const exportKeys = new Set();
	const walk = (value, keys = []) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) return;
		for (const [key, child] of Object.entries(value)) {
			const nextKeys = [...keys, key];
			if (keys.length === 0 && key.startsWith(".")) {
				exportKeys.add(key);
			}
			if (FORBIDDEN_EXPORT_CONDITIONS.has(key)) {
				violations.push(`export condition "${key}" is not allowed`);
			}
			walk(child, nextKeys);
		}
	};

	walk(pkg.exports);

	const forbiddenForPackage = forbiddenPublicExports.get(pkg.name) || [];
	for (const exportKey of forbiddenForPackage) {
		const matches = exportKey.endsWith("*")
			? [...exportKeys].some((key) => key.startsWith(exportKey.slice(0, -1)))
			: exportKeys.has(exportKey);
		if (matches) {
			violations.push(`forbidden public export is present: ${exportKey}`);
		}
	}
};

const parsePackJson = (rawOutput) => {
	const start = rawOutput.indexOf("[");
	const end = rawOutput.lastIndexOf("]");
	if (start < 0 || end < 0 || end < start) {
		throw new Error("npm pack output did not include JSON payload");
	}
	return JSON.parse(rawOutput.slice(start, end + 1));
};

const isMetadataFile = (filePath) =>
	/^(?:package\.json|README(?:\.[a-z]+)?|LICENSE(?:\.[a-z]+)?|CHANGELOG(?:\.[a-z]+)?)$/i.test(
		filePath,
	);

const isRawSourceFile = (filePath) =>
	filePath.startsWith("src/") ||
	/\.svelte(?:\.ts)?$/.test(filePath) ||
	(/\.tsx?$/.test(filePath) && !filePath.endsWith(".d.ts"));

const normalizeManifestPath = (value) =>
	typeof value === "string" ? value.replace(/^\.\//, "") : "";

const getDeclaredBinFiles = (pkg) => {
	if (typeof pkg.bin === "string") return new Set([normalizeManifestPath(pkg.bin)]);
	if (!pkg.bin || typeof pkg.bin !== "object") return new Set();
	return new Set(Object.values(pkg.bin).map(normalizeManifestPath).filter(Boolean));
};

const isAllowedPackedFile = (filePath, pkg) => {
	if (filePath.startsWith("dist/")) return true;
	if (getDeclaredBinFiles(pkg).has(filePath)) return true;
	if (isMetadataFile(filePath)) return true;
	if (filePath === "oclif.manifest.json" && pkg.oclif) return true;
	if (/\.(?:css|json|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|eot)$/.test(filePath)) {
		return true;
	}
	return false;
};

const collectManifestViolations = (pkg) => {
	const violations = [];
	if (Array.isArray(pkg.files)) {
		for (const entry of pkg.files) {
			const normalized = String(entry).replace(/^\.\//, "");
			if (normalized === "src" || normalized.startsWith("src/")) {
				violations.push(`files[] includes source path: ${entry}`);
			}
			if (/\.svelte(?:\.ts)?$/.test(normalized)) {
				violations.push(`files[] includes raw Svelte source: ${entry}`);
			}
			if (/\.tsx?$/.test(normalized) && !normalized.endsWith(".d.ts")) {
				violations.push(`files[] includes raw TypeScript source: ${entry}`);
			}
		}
	}

	if (pkg.svelte) {
		violations.push("package-level svelte field is not allowed");
	}
	for (const dependencyBucket of ["optionalDependencies", "peerDependencies"]) {
		if (pkg[dependencyBucket]?.svelte) {
			violations.push(`${dependencyBucket}.svelte is not allowed`);
		}
	}
	if (pkg.peerDependenciesMeta?.svelte) {
		violations.push("peerDependenciesMeta.svelte is not allowed");
	}

	collectExportKeyViolations(pkg, violations);

	const targets = new Set();
	for (const field of ["main", "module", "types", "unpkg", "jsdelivr"]) {
		collectTargets(pkg[field], targets);
	}
	collectTargets(pkg.exports, targets);

	for (const target of [...targets].sort()) {
		if (target.startsWith("src/")) {
			violations.push(`export target points at src: ./${target}`);
			continue;
		}
		if (/\.svelte(?:\.ts)?$/.test(target)) {
			violations.push(`export target exposes raw Svelte source: ./${target}`);
			continue;
		}
		if (/\.tsx?$/.test(target) && !target.endsWith(".d.ts")) {
			violations.push(`export target exposes raw TypeScript source: ./${target}`);
			continue;
		}
		if (!target.startsWith("dist/") && !isMetadataFile(target)) {
			violations.push(`export target is outside dist: ./${target}`);
		}
	}

	return violations;
};

const collectPackViolations = (dir, pkg) => {
	const rawOutput = execSync("npm pack --dry-run --json", {
		cwd: dir,
		stdio: ["ignore", "pipe", "pipe"],
	}).toString();
	const packData = parsePackJson(rawOutput);
	const packedFiles = (packData?.[0]?.files ?? []).map((entry) =>
		toPosix(entry.path),
	);
	return packedFiles
		.filter(
			(filePath) => isRawSourceFile(filePath) || !isAllowedPackedFile(filePath, pkg),
		)
		.map((filePath) => `packed file is outside dist/metadata/assets: ${filePath}`)
		.sort();
};

const failures = [];
let checked = 0;

for (const dir of getWorkspaceDirs()) {
	const pkg = readJson(path.join(dir, "package.json"));
	if (pkg.private) continue;
	checked += 1;

	const violations = collectManifestViolations(pkg);
	try {
		violations.push(...collectPackViolations(dir, pkg));
	} catch (error) {
		violations.push(
			error.stderr?.toString()?.trim() ||
				error.message ||
				"failed to inspect npm pack contents",
		);
	}

	if (violations.length > 0) {
		failures.push({
			name: pkg.name || path.basename(dir),
			dir: path.relative(ROOT, dir),
			violations,
		});
	}
}

if (failures.length > 0) {
	console.error(
		`[check-publish-surface] Found ${failures.length} package(s) with non-dist publish surface`,
	);
	for (const failure of failures) {
		console.error(`\n- ${failure.name} (${failure.dir})`);
		for (const violation of failure.violations.slice(0, MAX_DETAILS_PER_PACKAGE)) {
			console.error(`  - ${violation}`);
		}
		const omitted = failure.violations.length - MAX_DETAILS_PER_PACKAGE;
		if (omitted > 0) console.error(`  - ... ${omitted} more`);
	}
	process.exit(1);
}

console.log(
	`[check-publish-surface] OK: validated ${checked} publishable package(s)`,
);
