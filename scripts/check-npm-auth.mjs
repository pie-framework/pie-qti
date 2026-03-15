import { execFileSync, spawnSync } from "node:child_process";
import { createNpmAuthEnvironment } from "./npm-auth-env.mjs";

const REGISTRY = "https://registry.npmjs.org/";
const SCOPE = "pie-qti";
const INTERACTIVE_TTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const TOKEN_FROM_ENV = String(process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN || "").trim();
const HAS_TOKEN_FROM_ENV = TOKEN_FROM_ENV.length > 0;
const AUTO_LOGIN_ENABLED =
	INTERACTIVE_TTY &&
	!HAS_TOKEN_FROM_ENV &&
	process.env.CI !== "true" &&
	process.env.PIE_SKIP_AUTO_NPM_LOGIN !== "1";

const { env: npmEnv, cleanup: cleanupNpmEnv } = createNpmAuthEnvironment();

const run = (cmd, args) =>
	execFileSync(cmd, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		env: npmEnv,
	}).trim();

const fail = (message, details) => {
	console.error(`\n[publish-auth] ${message}`);
	if (details) {
		console.error(details);
	}
	console.error("\n[publish-auth] Fix:");
	console.error("- Run `npm config set registry https://registry.npmjs.org/`");
	console.error("- Run `npm login --registry=https://registry.npmjs.org/`");
	console.error("- Verify auth with `npm whoami --registry=https://registry.npmjs.org/`");
	console.error(
		"- Verify org access with `npm org ls pie-qti --registry=https://registry.npmjs.org/`",
	);
	process.exit(1);
};

const getErrorDetails = (error) =>
	error?.stderr?.toString?.() || error?.message || String(error);
const isAuthError = (details) =>
	/E401|Unable to authenticate|authentication token .* invalid|need auth|not logged in/i.test(
		details,
	);

const tryInteractiveLogin = () => {
	if (!AUTO_LOGIN_ENABLED) return false;
	console.log(
		`[publish-auth] npm auth missing; starting interactive login for ${REGISTRY}`,
	);
	const result = spawnSync("npm", ["login", "--registry", REGISTRY], {
		stdio: "inherit",
		env: npmEnv,
	});
	return result.status === 0;
};

const runWithAuthRecovery = (runner, failureMessage) => {
	try {
		return runner();
	} catch (error) {
		const details = getErrorDetails(error);
		if (HAS_TOKEN_FROM_ENV && isAuthError(details)) {
			fail(
				`${failureMessage} (NPM_TOKEN/NODE_AUTH_TOKEN was provided but rejected by npm).`,
				details,
			);
		}
		if (AUTO_LOGIN_ENABLED && isAuthError(details)) {
			const loginWorked = tryInteractiveLogin();
			if (loginWorked) {
				try {
					return runner();
				} catch (retryError) {
					fail(
						`${failureMessage} (after interactive login).`,
						getErrorDetails(retryError),
					);
				}
			}
		}
		fail(failureMessage, details);
	}
};

try {
	const username = runWithAuthRecovery(
		() => run("npm", ["whoami", "--registry", REGISTRY]),
		"npm authentication failed (token missing, expired, or revoked).",
	);

	let registry;
	try {
		registry = run("npm", ["config", "get", "registry"]);
	} catch (error) {
		fail("Failed to read npm registry configuration.", getErrorDetails(error));
	}

	if (registry !== REGISTRY && registry !== REGISTRY.slice(0, -1)) {
		fail(
			`npm registry is "${registry}", expected "${REGISTRY}".`,
			"Set the correct registry before publishing.",
		);
	}

	try {
		run("npm", ["org", "ls", SCOPE, "--registry", REGISTRY]);
	} catch (error) {
		fail(
			`npm auth user "${username}" cannot verify access to @${SCOPE}.`,
			getErrorDetails(error),
		);
	}

	console.log(
		`[publish-auth] npm auth OK as "${username}" with registry "${REGISTRY}" and @${SCOPE} org access`,
	);
} finally {
	cleanupNpmEnv();
}
