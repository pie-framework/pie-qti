#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
	closeSync,
	existsSync,
	mkdtempSync,
	openSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
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

// Always run the ATTW pinned in the root devDependencies. A bare `bunx attw`
// falls back to fetching the npm package literally named `attw`, which is a
// dependency-confusion placeholder rather than the real CLI; when that happens
// its banner lands on stdout and gets misread as a type-resolution report.
const ATTW_BIN = path.join(ROOT, "node_modules", ".bin", "attw");
const ATTW_BASE_ARGS = ["--pack", "--ignore-rules", "cjs-resolves-to-esm"];

// ATTW exits non-zero whenever it reports anything, and a piped stdout is
// capped at the 64KiB pipe buffer on that path, which silently truncates the
// JSON report for larger packages. Redirect stdout to a file so the report is
// always captured in full regardless of size.
const runCommand = (args, dir) => {
	const tmpDir = mkdtempSync(path.join(tmpdir(), "check-attw-"));
	const outPath = path.join(tmpDir, "attw.out");
	const outFd = openSync(outPath, "w");

	let failed = false;
	let stderr = "";
	let spawnMessage = "";

	try {
		execFileSync(ATTW_BIN, args, { cwd: dir, stdio: ["ignore", outFd, "pipe"] });
	} catch (error) {
		failed = true;
		stderr = error.stderr?.toString?.() ?? "";
		spawnMessage = error.message ?? "";
	} finally {
		closeSync(outFd);
	}

	const stdout = readFileSync(outPath, "utf8");
	rmSync(tmpDir, { recursive: true, force: true });

	if (failed && !stdout.trim()) {
		throw new Error([stderr, spawnMessage].filter(Boolean).join("\n"));
	}

	return { failed, stdout };
};

const runAttw = (dir) =>
	runCommand([...ATTW_BASE_ARGS, "--format", "json", "--", "."], dir);

const runAttwText = (dir) => runCommand([...ATTW_BASE_ARGS, "--", "."], dir);

const isCssEntrypoint = (entrypoint) =>
	entrypoint.endsWith(".css") || entrypoint.endsWith("/css");

// Wide rendering: a bordered grid with one row per entrypoint and one column
// per resolution mode. A cell is only considered clean when it is blank or
// carries the 🟢 marker, so unrecognised diagnostics stay actionable.
const parseTableFailures = (lines) => {
	let columns = null;
	const failures = [];

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line.startsWith("│")) continue;

		const cells = line
			.split("│")
			.slice(1, -1)
			.map((cell) => cell.trim());
		if (cells.length < 2) continue;

		if (columns === null) {
			if (cells.some((cell) => cell.startsWith("node10"))) columns = cells;
			continue;
		}

		const entrypoint = cells[0].replace(/^"|"$/g, "");
		if (!entrypoint) continue;

		for (let index = 1; index < cells.length; index += 1) {
			const cell = cells[index];
			if (!cell || cell.includes("🟢")) continue;
			failures.push({ entrypoint, column: columns[index] ?? `column${index}` });
		}
	}

	return { columns, failures };
};

const isSuppressedTextReport = (stdout) => {
	const lines = stdout.split(/\r?\n/);

	const table = parseTableFailures(lines);
	if (table.columns) {
		if (table.failures.length === 0) return false;
		return table.failures.every(
			({ entrypoint, column }) =>
				column.startsWith("node10") || isCssEntrypoint(entrypoint),
		);
	}

	// Narrow rendering: a quoted entrypoint followed by "<mode>: <status>" lines.
	let entrypoint = "";
	const failedRows = [];
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (line.startsWith('"') && line.endsWith('"')) {
			entrypoint = line.slice(1, -1);
			continue;
		}
		if (!/^(?:node10|node16|bundler)\b/.test(line)) continue;
		if (line.includes("💀") || line.includes("Resolution failed")) {
			failedRows.push({ entrypoint, line });
		}
	}

	if (failedRows.length === 0) {
		return false;
	}

	return failedRows.every(({ entrypoint, line }) => {
		if (line.startsWith("node10:") && line.includes("Resolution failed")) return true;
		return isCssEntrypoint(entrypoint);
	});
};

// ATTW's JSON report is the authoritative source, but stdout occasionally
// carries extra framing around it, so recover the outermost JSON object rather
// than assuming stdout is nothing but JSON.
const extractJsonReport = (stdout) => {
	const start = stdout.indexOf("{");
	const end = stdout.lastIndexOf("}");
	if (start === -1 || end <= start) return null;
	try {
		return JSON.parse(stdout.slice(start, end + 1));
	} catch {
		return null;
	}
};

const describeStdout = (stdout) => {
	const firstLine = stdout.split(/\r?\n/).find((line) => line.trim()) ?? "";
	return `${stdout.length} byte(s), first line: ${firstLine.trim().slice(0, 200) || "<empty>"}`;
};

const parseAttwReport = ({ stdout }, packageName, dir) => {
	const report = extractJsonReport(stdout);
	if (report) return report;

	const reason = `ATTW JSON report was unparseable (${describeStdout(stdout)})`;
	console.warn(`[check-attw] ${packageName}: ${reason}; retrying in text mode.`);

	const textReport = runAttwText(dir);
	if (textReport.failed) {
		if (isSuppressedTextReport(textReport.stdout)) {
			console.warn(
				`[check-attw] ${packageName}: text-mode ATTW reported only suppressed node10 resolution failures.`,
			);
			return { problems: {} };
		}
		throw new Error(textReport.stdout || reason);
	}

	console.warn(
		`[check-attw] ${packageName}: text-mode ATTW exited cleanly, treating that as authoritative.`,
	);
	return { problems: {} };
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
	if (!existsSync(ATTW_BIN)) {
		console.error(
			`[check-attw] Missing ${path.relative(ROOT, ATTW_BIN)}. Run 'bun install' so the pinned @arethetypeswrong/cli devDependency is available.`,
		);
		process.exit(1);
	}

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
			const report = parseAttwReport(runAttw(dir), pkg.name, dir);
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
