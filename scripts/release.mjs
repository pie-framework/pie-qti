#!/usr/bin/env node
/**
 * Local-friendly release script:
 * - runs build
 * - runs `changeset publish`
 * - if publish fails due to OTP/2FA, prompts for OTP (TTY only) and retries
 *
 * CI should use an npm automation token (no OTP). In non-interactive shells this
 * script will NOT prompt; it will fail with guidance.
 */

import { spawn } from "node:child_process";
import process from "node:process";
import { createInterface } from "node:readline/promises";

function run(cmd, args, { env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...(env ?? {}) },
      stdio: ["inherit", "pipe", "pipe"],
    });

    let combined = "";

    child.stdout.on("data", (buf) => {
      const s = buf.toString();
      combined += s;
      process.stdout.write(s);
    });

    child.stderr.on("data", (buf) => {
      const s = buf.toString();
      combined += s;
      process.stderr.write(s);
    });

    child.on("close", (code) => resolve({ code: code ?? 0, output: combined }));
  });
}

function looksLikeOtpError(output) {
  // npm commonly uses EOTP; other tooling prints "one-time password" messages.
  return /EOTP\b|one[- ]time password|otp\b/i.test(output);
}

function looksLikeAuthError(output) {
  return /ENEEDAUTH\b|npm ERR!\s+need auth|not authorized|auth token/i.test(output);
}

async function promptOtp() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const otp = (await rl.question("NPM OTP required. Enter OTP: ")).trim();
    return otp;
  } finally {
    rl.close();
  }
}

async function main() {
  // Allow passing flags through to `changeset publish` (e.g. --tag next, --dry-run).
  const publishArgs = process.argv.slice(2);

  // Build first (same behavior as old `bun run build && changeset publish`).
  const build = await run("bun", ["run", "build"]);
  if (build.code !== 0) process.exit(build.code);

  // First publish attempt.
  const first = await run("bunx", ["changeset", "publish", ...publishArgs]);
  if (first.code === 0) return;

  // If it's an auth/token issue, fail fast with a helpful message.
  if (looksLikeAuthError(first.output)) {
    console.error(
      "\nPublish failed due to npm auth. Ensure you're logged in (npm login) or set NPM_TOKEN.\n"
    );
    process.exit(first.code);
  }

  // OTP flow: only prompt in interactive terminals and if OTP isn't already set.
  const alreadyHasOtp = !!process.env.NPM_CONFIG_OTP;
  const canPrompt = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (!alreadyHasOtp && canPrompt && looksLikeOtpError(first.output)) {
    const otp = await promptOtp();
    if (!otp) {
      console.error("No OTP entered; aborting publish.");
      process.exit(first.code);
    }

    const retry = await run(
      "bunx",
      ["changeset", "publish", ...publishArgs],
      { env: { NPM_CONFIG_OTP: otp } }
    );
    process.exit(retry.code);
  }

  if (looksLikeOtpError(first.output) && !canPrompt) {
    console.error(
      "\nPublish failed because npm requires an OTP, but this is a non-interactive shell.\n" +
        'Re-run locally in a TTY, or set NPM_CONFIG_OTP=123456, or use an npm automation token in CI.\n'
    );
  }

  process.exit(first.code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


