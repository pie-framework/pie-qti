#!/usr/bin/env node
/**
 * Configure npm trusted publishers (OIDC) for every publishable package in this repo.
 *
 * The npm docs for trusted publishers present the npm website as the only way to set
 * this up. That is out of date: npm 12 ships `npm trust`, so it is scriptable.
 *
 *   npm trust github <pkg> --file release.yml --repository <owner/repo> \
 *                          --allow-publish --allow-stage-publish
 *   npm trust list <pkg>
 *   npm trust revoke <pkg> --id=<trust-id>
 *
 * The package list is derived from the workspace rather than hardcoded. Versioning here
 * is "fixed" (see .changeset/config.json), so every release publishes all publishable
 * packages together — a package missing a trusted publisher means a partial release, and
 * a stale hardcoded list is exactly how that would happen unnoticed.
 *
 * Usage (from the repo root):
 *   node scripts/configure-trusted-publishers.mjs             # dry run, changes nothing
 *   node scripts/configure-trusted-publishers.mjs --apply     # configure
 *   node scripts/configure-trusted-publishers.mjs --verify    # read current config back
 *
 * Requirements:
 * - npm >= 12, which itself requires Node ^22.22.2 || ^24.15.0 || >=26.0.0. npm only
 *   warns on older Node, but this writes security configuration to a production account,
 *   so an unsupported runtime is treated as an error.
 * - An authenticated npm session (`npm login`). This script never handles credentials.
 * - Changing trusted publishing configuration is 2FA-protected, and per npm's
 *   2026-07-08 changelog, tokens that bypass 2FA lose that privilege from early August
 *   2026 — so run it interactively, not with an automation token.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW = "release.yml";

const mode = process.argv.includes("--apply")
	? "apply"
	: process.argv.includes("--verify")
		? "verify"
		: "dry-run";

function fail(msg, extra) {
	console.error(`\n[trusted-publishers] ${msg}`);
	if (extra) console.error(extra);
	process.exit(1);
}

const rootManifestPath = path.join(ROOT, "package.json");
if (!existsSync(rootManifestPath)) fail("run from the repository root (package.json not found).");
const rootManifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));

/** owner/repo, taken from repository.url so it cannot drift from what npm validates. */
function repositorySlug() {
	const url = rootManifest.repository?.url ?? "";
	const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
	if (!m) fail(`could not parse owner/repo from repository.url: ${JSON.stringify(url)}`);
	return `${m[1]}/${m[2]}`;
}

/** Publishable workspace packages, i.e. everything that a release actually publishes. */
function publishablePackages() {
	const globs = rootManifest.workspaces ?? [];
	const names = [];
	for (const entry of globs) {
		if (!entry.endsWith("/*")) continue;
		const base = path.join(ROOT, entry.slice(0, -2));
		if (!existsSync(base)) continue;
		for (const dir of readdirSync(base, { withFileTypes: true })) {
			if (!dir.isDirectory()) continue;
			const manifestPath = path.join(base, dir.name, "package.json");
			if (!existsSync(manifestPath)) continue;
			const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
			if (pkg.private || !pkg.name) continue;
			names.push(pkg.name);
		}
	}
	return names.sort();
}

function nodeSupportsNpm12(version) {
	const [maj, min] = version.replace(/^v/, "").split(".").map(Number);
	return (maj === 22 && min >= 22) || (maj === 24 && min >= 15) || maj >= 26;
}

if (!nodeSupportsNpm12(process.version)) {
	fail(
		`this script needs a Node that npm 12 supports (^22.22.2 || ^24.15.0 || >=26.0.0); running ${process.version}.`,
		"Install one (e.g. `nvm install 24.15.0`) and re-run with it.",
	);
}

const npmVersion = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
if (Number(npmVersion.split(".")[0]) < 12) {
	fail(
		`npm ${npmVersion} does not provide \`npm trust\`; npm >= 12 is required.`,
		"Upgrade with `npm install -g npm@^12`.",
	);
}

let user;
try {
	user = execFileSync("npm", ["whoami"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
} catch {
	fail("not authenticated to npm. Run `npm login` first (this script does not handle credentials).");
}

const slug = repositorySlug();
const packages = publishablePackages();
if (packages.length === 0) fail("no publishable packages found.");

console.log(`node: ${process.version}   npm: ${npmVersion}   user: ${user}`);
console.log(`repo: ${slug}   workflow: ${WORKFLOW}`);
console.log(`mode: ${mode}   packages: ${packages.length}\n`);

let ok = 0;
const problems = [];

for (const pkg of packages) {
	const args =
		mode === "verify"
			? ["trust", "list", pkg, "--json"]
			: [
					"trust",
					"github",
					pkg,
					"--file",
					WORKFLOW,
					"--repository",
					slug,
					"--allow-publish",
					"--allow-stage-publish",
					"--yes",
					...(mode === "dry-run" ? ["--dry-run"] : []),
				];

	// stdio inherit for stdin so an interactive 2FA prompt still reaches the user.
	const res = spawnSync("npm", args, { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
	const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;

	if (mode === "verify") {
		const configured = out.includes(slug) && out.includes(WORKFLOW);
		console.log(`  ${pkg.padEnd(40)} ${configured ? "configured" : "NOT CONFIGURED"}`);
		configured ? ok++ : problems.push([pkg, "no trusted publisher for this repo/workflow"]);
		continue;
	}

	if (res.status === 0) {
		console.log(`  ${pkg.padEnd(40)} ${mode === "dry-run" ? "dry-run ok" : "configured"}`);
		ok++;
	} else {
		console.log(`  ${pkg.padEnd(40)} FAILED`);
		problems.push([pkg, out.trim().split("\n").slice(0, 3).join(" | ")]);
	}
}

console.log(`\n  ok: ${ok}/${packages.length}   problems: ${problems.length}`);
for (const [pkg, why] of problems) console.log(`    ${pkg}: ${why}`);

if (mode === "apply" && problems.length === 0) {
	console.log("\n  next: re-run with --verify, then delete the NPM_TOKEN repo secret so the");
	console.log("  release workflow's `auto` auth mode resolves to oidc instead of token.");
}

process.exit(problems.length === 0 ? 0 : 1);
