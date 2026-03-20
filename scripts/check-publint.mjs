#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const POLICY_PATH = path.join(ROOT, "scripts", "publish-policy.json");
const BUNDLED_IMPORT_PROTOCOLS = ["node:", "bun:", "virtual:", "vite/"];
const BUILTIN_SPECIFIERS = new Set(
	builtinModules
		.flatMap((mod) => [
			mod,
			mod.replace(/^node:/, ""),
			`node:${mod.replace(/^node:/, "")}`,
		])
		.filter(Boolean),
);
const policy = existsSync(POLICY_PATH)
	? JSON.parse(readFileSync(POLICY_PATH, "utf8"))
	: {};
const allowedUndeclaredRuntimeImportsByPackage = new Map(
	Object.entries(policy.allowedUndeclaredRuntimeImports || {}).map(
		([packageName, imports]) => [
			packageName,
			new Set(Array.isArray(imports) ? imports : []),
		],
	),
);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

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

const collectTargets = (value, out) => {
	if (!value) return;
	if (typeof value === "string") {
		out.add(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectTargets(entry, out);
		return;
	}
	if (typeof value === "object") {
		for (const entry of Object.values(value)) collectTargets(entry, out);
	}
};

const toPackageName = (specifier) => {
	if (specifier.startsWith("@")) {
		const [scope, name] = specifier.split("/");
		return scope && name ? `${scope}/${name}` : specifier;
	}
	return specifier.split("/")[0];
};

const isExternalSpecifier = (specifier) =>
	typeof specifier === "string" &&
	specifier.length > 0 &&
	!specifier.startsWith(".") &&
	!specifier.startsWith("/");

const isIgnoredSpecifier = (specifier) => {
	if (BUILTIN_SPECIFIERS.has(specifier)) return true;
	return BUNDLED_IMPORT_PROTOCOLS.some(
		(prefix) => specifier === prefix || specifier.startsWith(prefix),
	);
};

const collectRuntimeImportSpecifiers = (content) => {
	const out = new Set();
	const patterns = [
		/import\s+[^'"`]*?\sfrom\s*['"]([^'"]+)['"]/g,
		/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
		/export\s+[^'"`]*?\sfrom\s*['"]([^'"]+)['"]/g,
		/require\(\s*['"]([^'"]+)['"]\s*\)/g,
	];
	for (const pattern of patterns) {
		let match;
		while ((match = pattern.exec(content))) {
			out.add(match[1]);
		}
	}
	return out;
};

const resolveRelativeImport = (fromFile, specifier) => {
	const fromDir = path.dirname(fromFile);
	const base = path.resolve(fromDir, specifier);
	const candidates = [base, `${base}.js`, path.join(base, "index.js")];
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
};

const getPublishedRuntimeEntryTargets = (pkg) => {
	const targets = new Set();
	collectTargets(pkg.exports, targets);
	collectTargets(pkg.main, targets);
	collectTargets(pkg.module, targets);
	collectTargets(pkg.unpkg, targets);
	collectTargets(pkg.jsdelivr, targets);
	return [...targets]
		.filter((target) => typeof target === "string" && target.startsWith("./"))
		.filter((target) => !target.includes("*"))
		.filter((target) => target.endsWith(".js"));
};

const validateRuntimeImportClosure = (dir, pkg) => {
	const entryTargets = getPublishedRuntimeEntryTargets(pkg);
	const startFiles = entryTargets
		.map((target) => path.join(dir, target))
		.filter((target) => existsSync(target));
	if (startFiles.length === 0) return [];

	const declaredRuntimePackages = new Set([
		...Object.keys(pkg.dependencies || {}),
		...Object.keys(pkg.peerDependencies || {}),
		...Object.keys(pkg.optionalDependencies || {}),
	]);
	const allowedUndeclaredImports =
		allowedUndeclaredRuntimeImportsByPackage.get(pkg.name) || new Set();
	const visited = new Set();
	const queue = [...startFiles];
	const failures = [];
	while (queue.length > 0) {
		const jsFile = queue.shift();
		if (!jsFile || visited.has(jsFile)) continue;
		visited.add(jsFile);

		const content = readFileSync(jsFile, "utf8");
		const specifiers = collectRuntimeImportSpecifiers(content);
		for (const specifier of specifiers) {
			if (!isExternalSpecifier(specifier)) {
				const relativeTarget = resolveRelativeImport(jsFile, specifier);
				if (relativeTarget && !visited.has(relativeTarget)) {
					queue.push(relativeTarget);
				}
				continue;
			}
			if (isIgnoredSpecifier(specifier)) continue;
			const packageName = toPackageName(specifier);
			if (packageName === pkg.name) continue;
			if (declaredRuntimePackages.has(packageName)) continue;
			if (allowedUndeclaredImports.has(packageName)) continue;
			failures.push(
				`${path.relative(ROOT, jsFile)} imports "${specifier}" but "${packageName}" is not declared in dependencies/peerDependencies/optionalDependencies`,
			);
		}
	}
	return failures;
};

const getPublishedEntryTargets = (pkg) => {
	const targets = new Set();
	collectTargets(pkg.exports, targets);
	collectTargets(pkg.main, targets);
	collectTargets(pkg.module, targets);
	collectTargets(pkg.types, targets);
	return [...targets]
		.filter((target) => typeof target === "string" && target.startsWith("./"))
		.filter((target) => !target.includes("*"));
};

const run = () => {
	const packageDirs = getWorkspaceDirs();
	const failures = [];
	let checked = 0;
	const targets = [];

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;
		const relativeDir = path.relative(ROOT, dir);
		const isToolWorkspace = relativeDir.startsWith("tools/");
		const publishedTargets = getPublishedEntryTargets(pkg);
		const missingTargets = publishedTargets.filter(
			(target) => !existsSync(path.join(dir, target)),
		);
		targets.push({
			dir,
			relativeDir,
			pkg,
			isToolWorkspace,
			publishedTargets,
			missingTargets,
		});
	}

	const needsRootBuild = targets.some(
		(target) => !target.isToolWorkspace && target.missingTargets.length > 0,
	);
	if (needsRootBuild) {
		execSync("bun run build", {
			cwd: ROOT,
			stdio: "pipe",
		});
	}

	for (const target of targets) {
		const { dir, relativeDir, isToolWorkspace, pkg } = target;
		checked += 1;
		try {
			const publishedTargets = getPublishedEntryTargets(pkg);
			const missingTargets = publishedTargets.filter(
				(t) => !existsSync(path.join(dir, t)),
			);
			if ((missingTargets.length > 0 || isToolWorkspace) && pkg.scripts?.build) {
				execSync("rm -rf dist tsconfig.tsbuildinfo && bun run build", {
					cwd: dir,
					stdio: "pipe",
				});
			}

			const runtimeImportFailures = validateRuntimeImportClosure(dir, pkg);
			if (runtimeImportFailures.length > 0) {
				throw new Error(
					`Runtime import closure check failed:\n${runtimeImportFailures
						.map((entry) => `- ${entry}`)
						.join("\n")}`,
				);
			}

			execSync("bunx publint .", {
				cwd: dir,
				stdio: "pipe",
			});
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: path.relative(ROOT, dir),
				error: [error.stdout?.toString(), error.stderr?.toString(), error.message]
					.filter(Boolean)
					.join("\n"),
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-publint] Found ${failures.length} package(s) with publint issues`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			console.error(failure.error.trim());
		}
		process.exit(1);
	}

	console.log(`[check-publint] OK: validated ${checked} publishable package(s)`);
};

run();
