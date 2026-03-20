#!/usr/bin/env node
/**
 * Release script: build + publish via changeset-publish-resolved-workspaces.
 *
 * - Resolves workspace:* ranges to real version numbers before publishing
 *   (required by npm; without this, changeset publish produces broken packages)
 * - Passes NPM_TOKEN via a temp .npmrc so CI can publish without touching
 *   the global npmrc (see npm-auth-env.mjs)
 * - Retries once on transient npm failures
 * - Restores workspace:* ranges after publish regardless of outcome
 *
 * For local publish with OTP (2FA), set NPM_CONFIG_OTP=<otp> before running,
 * or use an npm automation token (no OTP required).
 *
 * Flags passed to this script are forwarded to `changeset publish`
 * (e.g. --tag next, --dry-run).
 */

import { spawn } from "node:child_process";
import process from "node:process";

function run(cmd, args, { env } = {}) {
	return new Promise((resolve) => {
		const child = spawn(cmd, args, {
			env: { ...process.env, ...(env ?? {}) },
			stdio: "inherit",
		});
		child.on("close", (code) => resolve(code ?? 0));
	});
}

async function main() {
	// Enforce lockstep/fixed-versioning invariants before release.
	const fixedCode = await run("node", ["scripts/check-fixed-versioning.mjs"]);
	if (fixedCode !== 0) process.exit(fixedCode);

	// Build all packages.
	const buildCode = await run("bun", ["run", "build"]);
	if (buildCode !== 0) process.exit(buildCode);

	// Publish: resolves workspace ranges, handles auth env, retries once.
	// Flags (e.g. --tag next) are forwarded via CHANGESET_PUBLISH_ARGS env var
	// so the subprocess script can pick them up if needed. For now we just
	// run the script directly since it always calls `changeset publish`.
	const publishCode = await run("node", [
		"scripts/changeset-publish-resolved-workspaces.mjs",
		...process.argv.slice(2),
	]);
	process.exit(publishCode);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
