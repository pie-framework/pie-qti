#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";

const ROOT = process.cwd();
const rootManifestPath = path.join(ROOT, "package.json");

const SOURCE_EXTENSIONS = new Set([
	".js",
	".jsx",
	".mjs",
	".cjs",
	".ts",
	".tsx",
	".svelte",
]);

const IGNORED_DIRS = new Set([
	".git",
	".turbo",
	".svelte-kit",
	"build",
	"coverage",
	"dist",
	"node_modules",
]);

const SHELL_BUILTINS = new Set([
	"bash",
	"bun",
	"bunx",
	"cat",
	"cd",
	"cp",
	"docker",
	"echo",
	"env",
	"export",
	"git",
	"if",
	"mkdir",
	"mv",
	"node",
	"npm",
	"pnpm",
	"rm",
	"sed",
	"sh",
	"test",
	"true",
	"yarn",
]);

const KNOWN_BIN_TO_PACKAGE = {
	biome: "@biomejs/biome",
	changeset: "@changesets/cli",
	lefthook: "lefthook",
	oclif: "oclif",
	playwright: "@playwright/test",
	"svelte-check": "svelte-check",
	"svelte-kit": "@sveltejs/kit",
	tsc: "typescript",
	"ts-node": "ts-node",
	turbo: "turbo",
	vite: "vite",
};

const BUILTIN_SPECIFIERS = new Set(
	builtinModules
		.flatMap((mod) => [mod, mod.replace(/^node:/, ""), `node:${mod.replace(/^node:/, "")}`])
		.filter(Boolean),
);

function fail(message) {
	console.error(`check-deps: ${message}`);
	process.exit(1);
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isExternalSpecifier(specifier) {
	return (
		specifier &&
		!specifier.startsWith(".") &&
		!specifier.startsWith("/") &&
		!specifier.startsWith("http:") &&
		!specifier.startsWith("https:") &&
		!specifier.startsWith("data:")
	);
}

function isIgnoredSpecifier(specifier, aliasPrefixes) {
	return (
		specifier.startsWith("$") ||
		specifier.startsWith("bun:") ||
		specifier.startsWith("node:") ||
		specifier.startsWith("virtual:") ||
		specifier.startsWith("vite/") ||
		BUILTIN_SPECIFIERS.has(specifier) ||
		aliasPrefixes.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`))
	);
}

function toPackageName(specifier) {
	if (specifier.startsWith("@")) {
		const [scope, name] = specifier.split("/");
		return scope && name ? `${scope}/${name}` : specifier;
	}
	return specifier.split("/")[0];
}

function stripComments(content) {
	return content
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^\\:])\/\/.*$/gm, "$1");
}

function collectSpecifiers(content) {
	const out = new Set();
	const cleanContent = stripComments(content);
	const patterns = [
		/import\s+[^'"`]*?\sfrom\s*['"]([^'"]+)['"]/g,
		/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
		/export\s+[^'"`]*?\sfrom\s*['"]([^'"]+)['"]/g,
		/require\(\s*['"]([^'"]+)['"]\s*\)/g,
	];

	for (const re of patterns) {
		let match;
		while ((match = re.exec(cleanContent))) {
			out.add(match[1]);
		}
	}

	return [...out];
}

function walkFiles(startDir, result, workspaceRoot = startDir) {
	for (const entry of fs.readdirSync(startDir, { withFileTypes: true })) {
		if (IGNORED_DIRS.has(entry.name)) continue;
		const fullPath = path.join(startDir, entry.name);
		if (entry.isDirectory()) {
			const relativeDir = path.relative(workspaceRoot, fullPath);
			const topLevelSegment = relativeDir.split(path.sep)[0];
			if (["demo", "example", "examples"].includes(topLevelSegment)) continue;
			if (fullPath !== workspaceRoot && fs.existsSync(path.join(fullPath, "package.json"))) continue;
			walkFiles(fullPath, result, workspaceRoot);
			continue;
		}
		if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
			result.push(fullPath);
		}
	}
}

function splitScriptCommands(script) {
	return script
		.split(/&&|\|\||;/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function stripEnvAssignments(command) {
	const parts = command.split(/\s+/).filter(Boolean);
	let idx = 0;
	while (idx < parts.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[idx])) {
		idx += 1;
	}
	return parts.slice(idx);
}

function firstExecutable(command) {
	const parts = stripEnvAssignments(command);
	return parts[0] ?? "";
}

function collectTsAliasPrefixes(pkgDir) {
	const aliases = new Set();
	const candidates = ["tsconfig.json", "tsconfig.base.json", "tsconfig.build.json"];
	for (const candidate of candidates) {
		const tsconfigPath = path.join(pkgDir, candidate);
		if (!fs.existsSync(tsconfigPath)) continue;
		try {
			const tsconfig = readJson(tsconfigPath);
			const paths = tsconfig?.compilerOptions?.paths ?? {};
			for (const key of Object.keys(paths)) {
				aliases.add(key.replace(/\/\*$/, ""));
			}
		} catch {
			// Non-fatal for dependency check.
		}
	}
	return [...aliases];
}

function main() {
	if (!fs.existsSync(rootManifestPath)) {
		fail("run from repository root (package.json not found).");
	}

	const rootManifest = readJson(rootManifestPath);
	const workspaces = rootManifest.workspaces ?? [];

	/** @type {{dir:string,name:string,manifestPath:string}[]} */
	const workspaceEntries = [];

	for (const workspace of workspaces) {
		if (workspace.endsWith("/*")) {
			const baseDir = path.join(ROOT, workspace.slice(0, -2));
			if (!fs.existsSync(baseDir)) continue;
			for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				const dir = path.join(baseDir, entry.name);
				const manifestPath = path.join(dir, "package.json");
				if (!fs.existsSync(manifestPath)) continue;
				const manifest = readJson(manifestPath);
				workspaceEntries.push({
					dir,
					name: manifest.name ?? path.relative(ROOT, dir),
					manifestPath,
				});
			}
		} else {
			const dir = path.join(ROOT, workspace);
			const manifestPath = path.join(dir, "package.json");
			if (!fs.existsSync(manifestPath)) continue;
			const manifest = readJson(manifestPath);
			workspaceEntries.push({
				dir,
				name: manifest.name ?? path.relative(ROOT, dir),
				manifestPath,
			});
		}
	}

	workspaceEntries.sort((a, b) => a.dir.localeCompare(b.dir));
	const workspacePackageNames = new Set(workspaceEntries.map((w) => w.name));
	const violations = [];

	for (const workspace of workspaceEntries) {
		const manifest = readJson(workspace.manifestPath);
		const declared = new Set([
			...Object.keys(manifest.dependencies ?? {}),
			...Object.keys(manifest.devDependencies ?? {}),
			...Object.keys(manifest.peerDependencies ?? {}),
			...Object.keys(manifest.optionalDependencies ?? {}),
		]);

		const aliasPrefixes = collectTsAliasPrefixes(workspace.dir);
		const files = [];
		walkFiles(workspace.dir, files);

		for (const filePath of files) {
			let content = "";
			try {
				content = fs.readFileSync(filePath, "utf8");
			} catch {
				continue;
			}

			for (const specifier of collectSpecifiers(content)) {
				if (!isExternalSpecifier(specifier)) continue;
				if (isIgnoredSpecifier(specifier, aliasPrefixes)) continue;

				const packageName = toPackageName(specifier);
				const isSelfImport =
					manifest.name &&
					(packageName === manifest.name || specifier.startsWith(`${manifest.name}/`));

				if (isSelfImport || workspacePackageNames.has(packageName)) continue;
				if (declared.has(packageName)) continue;

				violations.push({
					type: "missing-dependency",
					workspace: workspace.name,
					file: path.relative(ROOT, filePath),
					specifier,
					packageName,
				});
			}
		}

		const scripts = manifest.scripts ?? {};
		for (const [scriptName, scriptValue] of Object.entries(scripts)) {
			if (typeof scriptValue !== "string") continue;

			if (/\.\.\/[^ ]*node_modules\/\.bin\//.test(scriptValue)) {
				violations.push({
					type: "hoist-reliant-script",
					workspace: workspace.name,
					scriptName,
					command: scriptValue,
					reason: "cross-workspace node_modules/.bin path",
				});
				continue;
			}

			for (const command of splitScriptCommands(scriptValue)) {
				const executable = firstExecutable(command);
				if (!executable || SHELL_BUILTINS.has(executable)) continue;
				if (executable.includes("/") || executable.startsWith(".")) continue;
				if (command.startsWith("bunx ") || command.startsWith("bun x ")) continue;
				if (command.startsWith("bun run ")) continue;

				const expectedPackage = KNOWN_BIN_TO_PACKAGE[executable];
				if (!expectedPackage) continue;
				if (declared.has(expectedPackage)) continue;

				violations.push({
					type: "undeclared-script-binary",
					workspace: workspace.name,
					scriptName,
					command,
					executable,
					expectedPackage,
				});
			}
		}
	}

	if (violations.length === 0) {
		console.log("check-deps: OK - no undeclared imports or hoist-reliant script usage found.");
		return;
	}

	console.error(`check-deps: found ${violations.length} violation(s).`);
	for (const violation of violations) {
		if (violation.type === "missing-dependency") {
			console.error(
				`  [missing-dependency] ${violation.workspace}: ${violation.file} imports "${violation.specifier}" but "${violation.packageName}" is not declared.`,
			);
		} else if (violation.type === "hoist-reliant-script") {
			console.error(
				`  [hoist-reliant-script] ${violation.workspace}#${violation.scriptName}: ${violation.reason} -> ${violation.command}`,
			);
		} else if (violation.type === "undeclared-script-binary") {
			console.error(
				`  [undeclared-script-binary] ${violation.workspace}#${violation.scriptName}: "${violation.executable}" used but "${violation.expectedPackage}" is not declared locally.`,
			);
		}
	}

	process.exit(1);
}

main();
