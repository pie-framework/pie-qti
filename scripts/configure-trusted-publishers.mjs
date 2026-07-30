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
 * - Both reading and writing trusted publisher config are 2FA-protected, and npm does
 *   not reuse the authentication between invocations, so expect an OTP prompt per
 *   package. Per npm's 2026-07-08 changelog, tokens that bypass 2FA lose the ability to
 *   change trusted publishing configuration from early August 2026, so this is
 *   necessarily interactive rather than token-driven.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW = "release.yml";

const mode = process.argv.includes("--apply")
	? "apply"
	: process.argv.includes("--verify")
		? "verify"
		: "dry-run";

/**
 * --only <pkg> limits the run to a single package.
 *
 * This exists because `--dry-run` is not the rehearsal it appears to be: `npm trust
 * github --dry-run` exits 0 even for a package that does not exist, so a clean dry run
 * across every package proves the command lines are well-formed and nothing more. It
 * does not prove the packages exist, that you hold permission on them, or that npm will
 * accept the configuration.
 *
 * Configuration, unlike publishing, can be done incrementally — so the real rehearsal is
 * to apply to one package and read it back:
 *
 *   node scripts/configure-trusted-publishers.mjs --apply  --only @pie-qti/logger
 *   node scripts/configure-trusted-publishers.mjs --verify --only @pie-qti/logger
 */
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex !== -1 ? process.argv[onlyIndex + 1] : null;
if (onlyIndex !== -1 && !only) fail("--only requires a package name, e.g. --only @pie-qti/logger");

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

/**
 * Resolve an npm >= 12 without touching the globally installed npm.
 *
 * `npm trust` needs npm 12, but npm 12 also changes install-time defaults (dependency
 * lifecycle scripts, git deps and remote tarballs are all off by default). Forcing a
 * global upgrade just to run a one-off configuration task would push that change onto
 * everything else on the machine, so npm 12 is bootstrapped into a temp prefix and
 * invoked directly instead.
 */
function resolveNpm12() {
	const local = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
	if (Number(local.split(".")[0]) >= 12) return { argv: ["npm"], version: local };

	const prefix = path.join(os.tmpdir(), "pie-qti-npm12");
	const cli = path.join(prefix, "node_modules", "npm", "bin", "npm-cli.js");
	if (!existsSync(cli)) {
		console.log(`bootstrapping npm@^12 into ${prefix} (global npm ${local} left untouched) ...`);
		mkdirSync(prefix, { recursive: true });
		const res = spawnSync("npm", ["install", "npm@^12", "--silent", "--no-audit", "--no-fund"], {
			cwd: prefix,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		if (res.status !== 0 || !existsSync(cli)) {
			fail("failed to bootstrap npm@^12.", `${res.stdout ?? ""}${res.stderr ?? ""}`);
		}
	}
	const version = execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" }).trim();
	return { argv: [process.execPath, cli], version };
}

const { argv: NPM, version: npmVersion } = resolveNpm12();
if (Number(npmVersion.split(".")[0]) < 12) {
	fail(`resolved npm ${npmVersion}, which does not provide \`npm trust\`; npm >= 12 is required.`);
}

/**
 * Run the resolved npm 12.
 *
 * `interactive: true` inherits all three streams. This is required for anything
 * 2FA-protected: npm prints the OTP prompt (and, for web auth, a URL to open) on stdout
 * and waits for input. Capturing stdout swallows the prompt, so the user sees nothing to
 * respond to and the command fails having appeared to just print its banner.
 */
function npm(args, { interactive = false } = {}) {
	return spawnSync(NPM[0], [...NPM.slice(1), ...args], {
		encoding: "utf8",
		stdio: interactive ? "inherit" : ["inherit", "pipe", "pipe"],
	});
}

const whoami = npm(["whoami"]);
if (whoami.status !== 0) {
	fail(
		"not authenticated to npm. Run `npm login` first (this script does not handle credentials).",
		`${whoami.stdout ?? ""}${whoami.stderr ?? ""}`.trim(),
	);
}
const user = (whoami.stdout ?? "").trim();

const slug = repositorySlug();
const allPackages = publishablePackages();
if (allPackages.length === 0) fail("no publishable packages found.");

let packages = allPackages;
if (only) {
	if (!allPackages.includes(only)) {
		fail(
			`--only ${only} is not a publishable package in this workspace.`,
			`Known packages:\n${allPackages.map((p) => `  ${p}`).join("\n")}`,
		);
	}
	packages = [only];
}

console.log(`node: ${process.version}   npm: ${npmVersion}   user: ${user}`);
console.log(`repo: ${slug}   workflow: ${WORKFLOW}`);
console.log(`mode: ${mode}   packages: ${packages.length}${only ? ` (--only ${only})` : ""}`);

if (mode === "dry-run") {
	console.log(
		"\n  note: `npm trust github --dry-run` exits 0 even for a nonexistent package, so a\n" +
			"  clean dry run confirms the arguments are well-formed, not that the configuration\n" +
			"  would be accepted. Rehearse with: --apply --only <pkg>, then --verify --only <pkg>.",
	);
}
if (mode === "apply") {
	console.log(
		"\n  note: trusted publishing means anyone who can write to " +
			`${slug} and trigger\n  ${WORKFLOW} can publish these packages. Consider gating the release job behind a\n` +
			"  protected GitHub Environment (npm trust github --environment <name>) if that is\n" +
			"  broader than you want.",
	);
}
console.log("");

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

	// Both `trust github` and `trust list` are 2FA-protected, and npm does not carry the
	// authentication across invocations — an apply and a list seven minutes apart each
	// demanded their own OTP. So both modes must run interactively: npm's prompt (and web
	// auth URL) has to reach the terminal, which means its output cannot be captured and
	// success comes from the exit status. npm prints the stored configuration itself, so
	// --verify shows you the authoritative record rather than a parsed summary.
	if (mode === "apply" || mode === "verify") {
		console.log(`\n  --- ${pkg}`);
		const res = npm(args, { interactive: true });
		if (res.status === 0) {
			console.log(`  ${pkg.padEnd(40)} ${mode === "apply" ? "configured" : "read ok (see above)"}`);
			ok++;
		} else {
			console.log(`  ${pkg.padEnd(40)} FAILED (exit ${res.status})`);
			problems.push([pkg, "see npm output above"]);
		}
		continue;
	}

	const res = npm(args);
	const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
	if (res.status === 0) {
		console.log(`  ${pkg.padEnd(40)} dry-run ok`);
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
