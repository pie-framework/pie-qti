#!/usr/bin/env node
/**
 * Verify that every publishable package published at a given version carries npm
 * provenance attestations.
 *
 * Trusted publishing (OIDC) generates provenance automatically, so attestations are the
 * observable proof that a release actually went out via the trusted publisher rather than
 * falling back to a token. Their absence on a published version means either the package
 * has no trusted publisher configured or something published it another way.
 *
 * This is a post-release check, and it is the only external one available: the npm
 * registry does not expose trusted-publisher configuration at all, so there is nothing to
 * inspect beforehand. Use `npm trust list <pkg>` (see configure-trusted-publishers.mjs)
 * to confirm configuration ahead of a release.
 *
 * It matters here because versioning is "fixed" (see .changeset/config.json): a release
 * publishes every publishable package together, so a single missing trusted publisher
 * shows up as a partial release. This distinguishes the two failure modes explicitly —
 * published-without-provenance versus not-published-at-all.
 *
 * Usage:
 *   node scripts/check-provenance.mjs 0.1.17
 *   node scripts/check-provenance.mjs            # defaults to the version in the workspace
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { planRetry, policyFromEnv } from "./registry-propagation.mjs";

const ROOT = process.cwd();
const REGISTRY = "https://registry.npmjs.org";

const rootManifestPath = path.join(ROOT, "package.json");
if (!existsSync(rootManifestPath)) {
	console.error("[check-provenance] run from the repository root (package.json not found).");
	process.exit(1);
}
const rootManifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));

/** Publishable workspace packages, derived rather than hardcoded so it cannot go stale. */
function publishablePackages() {
	const out = [];
	for (const entry of rootManifest.workspaces ?? []) {
		if (!entry.endsWith("/*")) continue;
		const base = path.join(ROOT, entry.slice(0, -2));
		if (!existsSync(base)) continue;
		for (const dir of readdirSync(base, { withFileTypes: true })) {
			if (!dir.isDirectory()) continue;
			const manifestPath = path.join(base, dir.name, "package.json");
			if (!existsSync(manifestPath)) continue;
			const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
			if (pkg.private || !pkg.name) continue;
			out.push({ name: pkg.name, version: pkg.version });
		}
	}
	return out.sort((a, b) => a.name.localeCompare(b.name));
}

const packages = publishablePackages();
if (packages.length === 0) {
	console.error("[check-provenance] no publishable packages found.");
	process.exit(1);
}

// Versioning is fixed, so any package's version is the release version.
const version = process.argv[2] ?? packages[0].version;
console.log(`[check-provenance] checking ${packages.length} package(s) at ${version}\n`);

let withProvenance = 0;
const noProvenance = [];
const notPublished = [];

// Run right after a release, a version missing from the registry is as likely to be replica lag
// as a partial release. Retry on the same bounded schedule as check-published-closure before
// believing "not published".
const propagationPolicy = policyFromEnv(process.env);
const startedAt = Date.now();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Throws with an E404-shaped message when the version is absent, so planRetry recognises it. */
async function fetchVersionEntry(name) {
	const res = await fetch(`${REGISTRY}/${name.replace("/", "%2F")}`, { cache: "no-store" });
	const doc = await res.json();
	const entry = doc?.versions?.[version];
	if (!entry) throw new Error(`E404 no ${version} on the registry for ${name}`);
	return entry;
}

async function fetchVersionEntryWithRetries(name) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await fetchVersionEntry(name);
		} catch (error) {
			const { retry, delayMs } = planRetry({
				attempt,
				elapsedMs: Date.now() - startedAt,
				message: error.message,
				policy: propagationPolicy,
			});
			if (!retry) throw error;
			console.log(`  ${name.padEnd(40)} not on the registry yet, retrying in ${delayMs / 1_000}s`);
			await sleep(delayMs);
		}
	}
}

for (const { name } of packages) {
	let entry;
	try {
		entry = await fetchVersionEntryWithRetries(name);
	} catch (error) {
		if (/\bE404\b/.test(error.message)) {
			notPublished.push([name, `no ${version} on the registry`]);
			console.log(`  ${name.padEnd(40)} NOT PUBLISHED at ${version}`);
		} else {
			notPublished.push([name, `registry fetch failed: ${error.message}`]);
			console.log(`  ${name.padEnd(40)} FETCH FAILED`);
		}
		continue;
	}

	if (entry.dist?.attestations) {
		console.log(`  ${name.padEnd(40)} provenance ok`);
		withProvenance++;
	} else {
		noProvenance.push([name, "published without attestations"]);
		console.log(`  ${name.padEnd(40)} NO PROVENANCE`);
	}
}

console.log(`\n  with provenance: ${withProvenance}/${packages.length}`);

if (noProvenance.length > 0) {
	console.log(`\n  ${noProvenance.length} published WITHOUT provenance:`);
	for (const [name] of noProvenance) console.log(`    ${name}`);
	console.log("  -> likely no trusted publisher configured, or published via a token.");
	console.log("     Check with: bun run trusted-publishers -- --verify --only <pkg>");
}

if (notPublished.length > 0) {
	console.log(`\n  ${notPublished.length} not published at ${version}:`);
	for (const [name, why] of notPublished) console.log(`    ${name}: ${why}`);
	console.log("  -> partial release; versioning is fixed, so all packages should move together.");
}

process.exit(noProvenance.length === 0 && notPublished.length === 0 ? 0 : 1);
