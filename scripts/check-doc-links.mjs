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
	const content = fs.readFileSync(file, "utf8");
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
				broken.push(`${path.relative(ROOT, file)} -> ${target}`);
				continue;
			}
		}
		if (fragment && !anchorsFor(targetFile).has(fragment)) {
			broken.push(`${path.relative(ROOT, file)} -> ${target} (missing anchor)`);
		}
	}
}

if (broken.length > 0) {
	console.error(`check-doc-links: ${broken.length} broken link(s):`);
	for (const entry of broken) {
		console.error(`  ${entry}`);
	}
	process.exitCode = 1;
} else {
	console.log("check-doc-links: OK - all markdown relative links and anchors resolve.");
}
