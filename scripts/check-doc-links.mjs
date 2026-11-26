#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const IGNORED_DIRS = new Set([
	".git",
	".turbo",
	".svelte-kit",
	"build",
	"coverage",
	"dist",
	"node_modules",
]);

const MD_LINK = /\[[^\]]*\]\(([^)]+)\)/g;

// Inline-code spans that name a repo path get an existence check. Only root-relative paths
// under these prefixes are considered; anything with placeholders, globs or whitespace is
// prose, not a path claim.
const PATH_PREFIXES = [
	"packages/",
	"apps/",
	"tools/",
	"docs/",
	"scripts/",
	".github/",
	".agents/",
	".claude/",
	".changeset/",
];
// Spans known to be non-paths despite matching a prefix: `docs/specs/` is a deliberate
// negative statement ("do not assume this exists"), `docs/short-description` is a branch-name
// example, and `packages/...` is a placeholder.
const PATH_ALLOWLIST = new Set(["docs/specs/", "docs/short-description"]);

function codeSpansOutsideFences(content) {
	const spans = [];
	let inFence = false;
	for (const line of content.split("\n")) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		for (const match of line.matchAll(/`([^`]+)`/g)) {
			spans.push(match[1]);
		}
	}
	return spans;
}

function checkRepoPathSpan(span, broken, file, relativeFile) {
	if (PATH_ALLOWLIST.has(span)) return;
	if (!PATH_PREFIXES.some((prefix) => span === prefix || span.startsWith(prefix))) return;
	if (/[\s<*?()…]/.test(span) || span.includes("...")) return;
	// `path/file.ts:42` (or `:42-44`) is a path with a line reference.
	const cleaned = span.replace(/:\d+(-\d+)?$/, "");
	// Package docs use package-relative spans (`scripts/x.ts` inside packages/i18n); repo
	// docs use root-relative ones. Accept either: resolve against the nearest enclosing
	// package roots and the repo root.
	for (const root of packageRootsFor(file)) {
		if (fs.existsSync(path.normalize(path.join(root, cleaned)))) return;
	}
	broken.push(`${relativeFile} -> \`${span}\` (code-span path does not exist)`);
}

const packageRootCache = new Map();
function packageRootsFor(file) {
	if (packageRootCache.has(file)) return packageRootCache.get(file);
	const roots = [ROOT];
	let dir = path.dirname(file);
	while (dir.startsWith(ROOT) && dir !== ROOT) {
		if (fs.existsSync(path.join(dir, "package.json"))) roots.unshift(dir);
		dir = path.dirname(dir);
	}
	packageRootCache.set(file, roots);
	return roots;
}

function* walkMarkdown(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (IGNORED_DIRS.has(entry.name)) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walkMarkdown(full);
		} else if (entry.name.endsWith(".md")) {
			yield full;
		}
	}
}

// GitHub-style heading slug: lowercase, drop backticks and punctuation
// (word characters, whitespace, and hyphens survive), spaces become hyphens.
function headingSlug(heading) {
	return heading
		.trim()
		.toLowerCase()
		.replaceAll("`", "")
		.replace(/[^\w\s-]/g, "")
		.replaceAll(/\s+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function headingAnchors(filePath) {
	const anchors = new Set();
	for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
		const match = /^#{1,6}\s+(.*)/.exec(line);
		if (match) anchors.add(headingSlug(match[1]));
	}
	return anchors;
}

const broken = [];
const anchorCache = new Map();

// Heading anchor sets are only computed when a fragment link needs them.
function anchorsFor(targetFile) {
	if (!anchorCache.has(targetFile)) {
		anchorCache.set(targetFile, targetFile.endsWith(".md") ? headingAnchors(targetFile) : new Set());
	}
	return anchorCache.get(targetFile);
}

	for (const file of walkMarkdown(ROOT)) {
	// Published release history is immutable; stale paths inside it stay as written.
	if (file.includes(`${path.sep}CHANGELOG.md`) || file.includes(`.changeset${path.sep}pre${path.sep}`)) {
		continue;
	}
	const content = fs.readFileSync(file, "utf8");
	const relativeFile = path.relative(ROOT, file);
	for (const match of content.matchAll(MD_LINK)) {
		const target = match[1].trim();
		if (/^(https?:|mailto:)/.test(target)) continue;

		const [rawPath, rawFragment] = target.split("#");
		const fragment = rawFragment ? decodeURIComponent(rawFragment).toLowerCase() : "";
		const relative = rawPath ? decodeURIComponent(rawPath) : "";

		let targetFile = file;
		if (relative) {
			targetFile = path.normalize(path.join(path.dirname(file), relative));
			// Directory links (e.g. `../packages/to-pie`) are valid on GitHub.
			if (!fs.existsSync(targetFile)) {
				broken.push(`${relativeFile} -> ${target}`);
				continue;
			}
		}
		if (fragment && !anchorsFor(targetFile).has(fragment)) {
			broken.push(`${relativeFile} -> ${target} (missing anchor)`);
		}
	}
	for (const span of codeSpansOutsideFences(content)) {
		checkRepoPathSpan(span, broken, file, relativeFile);
	}
}

if (broken.length > 0) {
	console.error(`check-doc-links: ${broken.length} broken link(s) or path(s):`);
	for (const entry of broken) {
		console.error(`  ${entry}`);
	}
	process.exitCode = 1;
} else {
	console.log("check-doc-links: OK - links, anchors, and code-span repo paths all resolve.");
}
