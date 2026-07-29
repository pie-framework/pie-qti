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
		// Bare side-effect import: `import "pkg";` with no binding and no `from`. The
		// patterns above all require a binding or `from`, so registration-style imports
		// (the dominant pattern for custom-element and plugin registration, e.g.
		// player-elements/src/register.ts) were invisible to this check.
		//
		// Anchored to a whole line on purpose: an unanchored version also matches the word
		// "import" inside string literals, which several tests contain when asserting on
		// bundle output.
		/^\s*import\s*['"]([^'"]+)['"]\s*;?\s*$/gm,
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

/**
 * Locate the `node_modules` entry a workspace would resolve `packageName` through.
 *
 * Returns `{ state, linkPath }` where state is:
 *   "ok"       - entry exists and its target exists
 *   "dangling" - a symlink is present but its target is gone (stale link, typically
 *                left behind when a package was renamed or removed)
 *   "missing"  - no entry at all
 */
function resolveWorkspaceLink(workspaceDir, packageName) {
	const candidates = [
		path.join(workspaceDir, "node_modules", packageName),
		path.join(ROOT, "node_modules", packageName),
	];
	for (const linkPath of candidates) {
		let stat;
		try {
			stat = fs.lstatSync(linkPath);
		} catch {
			continue;
		}
		// existsSync follows symlinks, so a dangling link reports false here.
		if (fs.existsSync(linkPath)) return { state: "ok", linkPath };
		if (stat.isSymbolicLink()) return { state: "dangling", linkPath };
	}
	return { state: "missing", linkPath: candidates[0] };
}

/** Stale `@scope/*` symlinks under any workspace, regardless of whether anything imports them. */
function collectDanglingLinks(workspaceEntries) {
	const dangling = [];
	for (const workspace of workspaceEntries) {
		const nodeModules = path.join(workspace.dir, "node_modules");
		if (!fs.existsSync(nodeModules)) continue;
		for (const entry of fs.readdirSync(nodeModules, { withFileTypes: true })) {
			// Walk one level into scope directories (@pie-qti/foo), skip .bin and friends.
			const scopeDirs = entry.name.startsWith("@")
				? [path.join(nodeModules, entry.name)]
				: [];
			for (const scopeDir of scopeDirs) {
				let children = [];
				try {
					children = fs.readdirSync(scopeDir, { withFileTypes: true });
				} catch {
					continue;
				}
				for (const child of children) {
					const linkPath = path.join(scopeDir, child.name);
					if (!child.isSymbolicLink()) continue;
					if (fs.existsSync(linkPath)) continue;
					dangling.push({
						workspace: workspace.name,
						packageName: `${entry.name}/${child.name}`,
						linkPath: path.relative(ROOT, linkPath),
					});
				}
			}
		}
	}
	return dangling;
}

function main() {
	const warnOnly = process.argv.includes("--warn-only");

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

				if (isSelfImport) continue;

				// Cross-workspace imports were previously skipped outright, which hid a
				// whole class of breakage: a stale or missing workspace symlink still
				// resolves for `bun test` (which reads source) but fails the bundler with
				// an opaque "failed to resolve import" naming the specifier, not the
				// broken link.
				if (workspacePackageNames.has(packageName)) {
					const { state, linkPath } = resolveWorkspaceLink(workspace.dir, packageName);

					if (state !== "ok") {
						violations.push({
							type: "unresolvable-workspace-import",
							workspace: workspace.name,
							file: path.relative(ROOT, filePath),
							specifier,
							packageName,
							state,
							linkPath: path.relative(ROOT, linkPath),
						});
					}
					// Deliberately no export-map check on the subpath here. Several
					// specifiers (e.g. "@pie-qti/item-player/components") are resolved by
					// bundler aliases in vite.config.ts / svelte.config.js rather than by
					// the exports map, so validating against exports reports false
					// positives. The published export surface is already covered properly
					// by check-pack-exports, check-publint and check-attw.
					continue;
				}

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

	// Stale links are reported even when nothing imports them: they are the fingerprint of
	// a node_modules tree carried across a package rename, and they are what turns the next
	// unrelated build failure into a confusing hunt.
	const dangling = collectDanglingLinks(workspaceEntries);
	if (dangling.length > 0) {
		const shown = dangling.slice(0, 15);
		console.warn(
			`check-deps: ${dangling.length} stale workspace symlink(s) point at packages that no longer exist.`,
		);
		for (const entry of shown) {
			console.warn(`  [stale-link] ${entry.workspace}: ${entry.linkPath} -> (missing)`);
		}
		if (dangling.length > shown.length) {
			console.warn(`  ... and ${dangling.length - shown.length} more.`);
		}
		console.warn("  These are harmless but indicate a stale tree; 'rm -rf node_modules && bun install' clears them.");
	}

	if (violations.length === 0) {
		console.log("check-deps: OK - no undeclared imports or hoist-reliant script usage found.");
		return;
	}

	const logger = warnOnly ? console.warn : console.error;
	logger(`check-deps: found ${violations.length} violation(s).`);
	for (const violation of violations) {
		if (violation.type === "missing-dependency") {
			logger(
				`  [missing-dependency] ${violation.workspace}: ${violation.file} imports "${violation.specifier}" but "${violation.packageName}" is not declared.`,
			);
		} else if (violation.type === "unresolvable-workspace-import") {
			const cause =
				violation.state === "dangling"
					? "the workspace symlink is stale (its target no longer exists)"
					: "there is no workspace symlink for it";
			logger(
				`  [unresolvable-workspace-import] ${violation.workspace}: ${violation.file} imports "${violation.specifier}" but ${cause}.\n` +
					`      expected link: ${violation.linkPath}\n` +
					`      fix: run 'bun install' (or 'rm -rf node_modules && bun install' if that does not restore it).\n` +
					`      left unfixed, the bundler fails with an opaque "failed to resolve import ${violation.specifier}".`,
			);
		} else if (violation.type === "hoist-reliant-script") {
			logger(
				`  [hoist-reliant-script] ${violation.workspace}#${violation.scriptName}: ${violation.reason} -> ${violation.command}`,
			);
		} else if (violation.type === "undeclared-script-binary") {
			logger(
				`  [undeclared-script-binary] ${violation.workspace}#${violation.scriptName}: "${violation.executable}" used but "${violation.expectedPackage}" is not declared locally.`,
			);
		}
	}

	// --warn-only is used from postinstall: surfacing a broken tree at install time is the
	// earliest useful signal, but a non-zero exit there would fail `bun install` itself and
	// make the situation harder to recover from rather than easier.
	if (warnOnly) {
		console.warn("check-deps: continuing despite the above (--warn-only).");
		return;
	}

	process.exit(1);
}

main();
