#!/usr/bin/env node

import { execSync } from "node:child_process";

const readArgValue = (name) => {
	const idx = process.argv.indexOf(name);
	if (idx === -1) return undefined;
	return process.argv[idx + 1];
};

const rawPublished =
	readArgValue("--published-json") || process.env.PUBLISHED_PACKAGES_JSON || "";

if (!rawPublished) {
	console.log("[check-published-closure] No published package payload provided, skipping.");
	process.exit(0);
}

let publishedPackages;
try {
	publishedPackages = JSON.parse(rawPublished);
} catch (error) {
	console.error("[check-published-closure] Failed to parse published package JSON payload.");
	console.error(String(error));
	process.exit(1);
}

if (!Array.isArray(publishedPackages) || publishedPackages.length === 0) {
	console.log("[check-published-closure] No published packages in payload, skipping.");
	process.exit(0);
}

const runNpmView = (specifier, field) => {
	const cmd = field
		? `npm view "${specifier}" "${field}" --json`
		: `npm view "${specifier}" --json`;
	try {
		const out = execSync(cmd, { stdio: "pipe" }).toString("utf8").trim();
		if (!out) return null;
		return JSON.parse(out);
	} catch (error) {
		throw new Error(
			`npm view failed for ${specifier}${field ? ` ${field}` : ""}: ${error.stderr?.toString()?.trim() || error.message}`,
		);
	}
};

const failures = [];

for (const pkg of publishedPackages) {
	const name = pkg?.name;
	const version = pkg?.version;
	if (!name || !version) {
		failures.push(`Invalid published package entry: ${JSON.stringify(pkg)}`);
		continue;
	}

	let deps;
	try {
		deps = runNpmView(`${name}@${version}`, "dependencies");
	} catch (error) {
		failures.push(String(error.message));
		continue;
	}

	if (!deps || typeof deps !== "object") continue;

	for (const [depName, depRange] of Object.entries(deps)) {
		if (!depName.startsWith("@pie-qti/")) continue;
		if (typeof depRange !== "string" || depRange.length === 0) {
			failures.push(`${name}@${version} has invalid dependency range for ${depName}: ${String(depRange)}`);
			continue;
		}
		if (depRange.startsWith("workspace:")) {
			failures.push(`${name}@${version} leaked workspace range for ${depName}: ${depRange}`);
			continue;
		}

		try {
			const resolved = runNpmView(`${depName}@${depRange}`, "version");
			if (!resolved || typeof resolved !== "string") {
				failures.push(`${name}@${version} -> ${depName}@${depRange} did not resolve to a concrete version`);
			}
		} catch (error) {
			failures.push(
				`${name}@${version} has unresolved internal dependency ${depName}@${depRange}: ${error.message}`,
			);
		}
	}
}

if (failures.length > 0) {
	console.error(
		`[check-published-closure] Found ${failures.length} publish-closure issue(s):`,
	);
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`[check-published-closure] OK: validated internal dependency closure for ${publishedPackages.length} published package(s)`,
);
