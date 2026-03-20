import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REGISTRY = "https://registry.npmjs.org/";

export const createNpmAuthEnvironment = (baseEnv = process.env) => {
	const token = String(baseEnv.NPM_TOKEN || "").trim();
	if (!token) {
		return {
			env: baseEnv,
			cleanup: () => {},
		};
	}

	const tempDir = mkdtempSync(join(tmpdir(), "pie-qti-npm-auth-"));
	const npmrcPath = join(tempDir, ".npmrc");
	writeFileSync(
		npmrcPath,
		`registry=${REGISTRY}\n//registry.npmjs.org/:_authToken=${token}\n`,
		"utf8",
	);

	return {
		env: {
			...baseEnv,
			NPM_CONFIG_USERCONFIG: npmrcPath,
			NODE_AUTH_TOKEN: String(baseEnv.NODE_AUTH_TOKEN || "").trim() || token,
		},
		cleanup: () => {
			rmSync(tempDir, { recursive: true, force: true });
		},
	};
};
