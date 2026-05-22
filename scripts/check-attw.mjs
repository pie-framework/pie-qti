#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const policy = existsSync(POLICY_PATH) ? readJson(POLICY_PATH) : {};
const attwSuppressInternalResolutionPackages = new Set(
	policy.attwSuppressInternalResolutionPackages ?? [],
);
const WORKSPACE_ROOTS = Array.isArray(policy.workspaceRoots)
	? policy.workspaceRoots
	: ["packages"];
const PUBLISHABLE_PREFIX =
	typeof policy.publishablePackageNamePrefix === "string"
		? policy.publishablePackageNamePrefix
		: "@pie-qti/";

const getWorkspaceDirs = () => {
	const dirs = new Set();

	for (const rootDir of WORKSPACE_ROOTS) {
		const absRoot = path.join(ROOT, rootDir);
		if (!existsSync(absRoot)) continue;
		for (const entry of readdirSync(absRoot, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				dirs.add(path.join(absRoot, entry.name));
			}
		}
	}

	return [...dirs].filter((dir) => existsSync(path.join(dir, "package.json")));
};

const runAttw = (dir) => {
	const cmd = "bunx attw --pack --ignore-rules cjs-resolves-to-esm --format json -- .";
	try {
		return execSync(cmd, {
			cwd: dir,
			stdio: "pipe",
			encoding: "utf8",
			maxBuffer: 256 * 1024 * 1024,
		});
	} catch (error) {
		const stdout = error.stdout?.toString?.() ?? "";
		if (!stdout.trim()) {
			const stderr = error.stderr?.toString?.() ?? "";
			throw new Error([stderr, error.message].filter(Boolean).join("\n"));
		}
		return stdout;
	}
};

const flattenProblems = (problemsByKind) => {
	const all = [];
	for (const [kind, problems] of Object.entries(problemsByKind || {})) {
		if (!Array.isArray(problems)) continue;
		for (const problem of problems) {
			all.push({ kind, ...problem });
		}
	}
	return all;
};

const shouldSuppressProblem = (problem, packageName) => {
	const entrypoint = typeof problem.entrypoint === "string" ? problem.entrypoint : "";
	const resolutionKind =
		typeof problem.resolutionKind === "string" ? problem.resolutionKind : "";
	const moduleSpecifier =
		typeof problem.moduleSpecifier === "string" ? problem.moduleSpecifier : "";

	if (problem.kind === "CJSResolvesToESM") return true;

	if (problem.kind === "NoResolution") {
		if (resolutionKind === "node10") return true;
		if (entrypoint.endsWith(".css")) return true;
		if (entrypoint === "./css") return true;
	}

	if (problem.kind === "InternalResolutionError") {
		if (
			typeof packageName === "string" &&
			attwSuppressInternalResolutionPackages.has(packageName)
		) {
			return true;
		}
	}

	return false;
};

const run = () => {
	const packageDirs = getWorkspaceDirs();
	const failures = [];
	let checked = 0;
	const suppressedCounts = new Map();

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;
		if (
			typeof pkg.name !== "string" ||
			!pkg.name.startsWith(PUBLISHABLE_PREFIX)
		) {
			continue;
		}
		checked += 1;
		try {
			const raw = runAttw(dir);
			const report = JSON.parse(raw);
			const problems = flattenProblems(report.problems);
			const actionable = problems.filter(
				(problem) => !shouldSuppressProblem(problem, pkg.name),
			);

			for (const problem of problems) {
				if (!shouldSuppressProblem(problem, pkg.name)) continue;
				const key = `${problem.kind}:${problem.entrypoint || problem.moduleSpecifier || "n/a"}:${problem.resolutionKind || problem.resolutionOption || "n/a"}`;
				suppressedCounts.set(key, (suppressedCounts.get(key) || 0) + 1);
			}

			if (actionable.length > 0) {
				failures.push({
					name: pkg.name || path.basename(dir),
					dir: path.relative(ROOT, dir),
					error: actionable
						.map((problem) =>
							`${problem.kind} entrypoint=${problem.entrypoint || "n/a"} resolution=${problem.resolutionKind || problem.resolutionOption || "n/a"} module=${problem.moduleSpecifier || "n/a"}`,
						)
						.join("\n"),
				});
			}
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: path.relative(ROOT, dir),
				error: [error.message].filter(Boolean).join("\n"),
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-attw] Found ${failures.length} package(s) with declaration issues`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			console.error(failure.error.trim());
		}
		process.exit(1);
	}

	console.log(`[check-attw] OK: validated ${checked} publishable package(s)`);
	if (suppressedCounts.size > 0) {
		console.log(
			`[check-attw] Suppressed ${[...suppressedCounts.values()].reduce((a, b) => a + b, 0)} known non-actionable ATTW diagnostic(s)`,
		);
	}
};

run();
