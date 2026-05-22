#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const MAX_DETAILS_PER_PACKAGE = 12;

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const toPosix = (value) => value.replaceAll(path.sep, "/");

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
	return JSON.parse(rawOutput.slice(start, end + 1));
};

const isVirtualSource = (sourcePath) =>
	/^(?:dep:|browser-external:|virtual:|data:)|\0/.test(sourcePath);

const isExternalSource = (sourcePath) =>
	path.posix.isAbsolute(sourcePath) || /^[a-z][a-z0-9+.-]*:/i.test(sourcePath);

const hasSourceContent = (sourcesContent, index) =>
	Array.isArray(sourcesContent) && sourcesContent[index] != null;

const resolvePackedSource = (mapFile, sourceMap, sourcePath) => {
	if (isVirtualSource(sourcePath)) return null;
	if (isExternalSource(sourcePath)) return { packedPath: null, reason: "external" };

	const sourceRoot =
		typeof sourceMap.sourceRoot === "string" ? sourceMap.sourceRoot : "";
	if (sourceRoot && isExternalSource(sourceRoot)) {
		return { packedPath: null, reason: "external sourceRoot" };
	}

	const packedPath = path.posix.normalize(
		path.posix.join(path.posix.dirname(mapFile), sourceRoot, sourcePath),
	);
	if (packedPath === ".." || packedPath.startsWith("../")) {
		return { packedPath, reason: "outside package" };
	}
	return { packedPath, reason: "missing" };
};

const getPackedSourcemapFiles = (packedFiles) =>
	[...packedFiles]
		.filter((file) => file.endsWith(".js.map") || file.endsWith(".d.ts.map"))
		.sort();

const collectMissingSources = (dir, packedFiles) => {
	const missingSources = [];
	for (const mapFile of getPackedSourcemapFiles(packedFiles)) {
		const mapPath = path.join(dir, ...mapFile.split("/"));
		if (!existsSync(mapPath)) {
			missingSources.push(`${mapFile} is listed by npm pack but missing on disk`);
			continue;
		}

		const sourceMap = readJson(mapPath);
		const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
		for (let index = 0; index < sources.length; index += 1) {
			const sourcePath = sources[index];
			if (!sourcePath || hasSourceContent(sourceMap.sourcesContent, index)) {
				continue;
			}

			const resolved = resolvePackedSource(mapFile, sourceMap, sourcePath);
			if (!resolved) continue;
			if (!resolved.packedPath || !packedFiles.has(resolved.packedPath)) {
				const target = resolved.packedPath
					? `${sourcePath} (${resolved.reason}: ${resolved.packedPath})`
					: `${sourcePath} (${resolved.reason})`;
				missingSources.push(`${mapFile} -> ${target}`);
			}
		}
	}
	return missingSources;
};

const run = () => {
	const packageDirs = getWorkspaceDirs();
	const failures = [];
	let checked = 0;

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;
		checked += 1;

		try {
			const rawOutput = execSync("npm pack --dry-run --json", {
				cwd: dir,
				stdio: ["ignore", "pipe", "pipe"],
			}).toString();
			const packData = parsePackJson(rawOutput);
			const packedFiles = new Set(
				(packData?.[0]?.files ?? []).map((entry) => toPosix(entry.path)),
			);
			const missingSources = collectMissingSources(dir, packedFiles);
			if (missingSources.length > 0) {
				failures.push({
					name: pkg.name || path.basename(dir),
					dir: path.relative(ROOT, dir),
					missingSources,
				});
			}
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: path.relative(ROOT, dir),
				missingSources: [
					error.stderr?.toString()?.trim() ||
						error.message ||
						"<failed to inspect packed sourcemaps>",
				],
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-sourcemap-sources] Found ${failures.length} package(s) with sourcemaps that reference unpacked sources`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			for (const missing of failure.missingSources.slice(
				0,
				MAX_DETAILS_PER_PACKAGE,
			)) {
				console.error(`  - ${missing}`);
			}
			const omitted = failure.missingSources.length - MAX_DETAILS_PER_PACKAGE;
			if (omitted > 0) {
				console.error(`  - ... ${omitted} more`);
			}
		}
		process.exit(1);
	}

	console.log(
		`[check-sourcemap-sources] OK: validated ${checked} publishable package(s)`,
	);
};

run();
