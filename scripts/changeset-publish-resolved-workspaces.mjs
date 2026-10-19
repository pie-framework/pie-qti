import { spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createNpmAuthEnvironment } from "./npm-auth-env.mjs";

const repoRoot = process.cwd();
const workspaceRoots = ["packages", "tools", "apps"];
const depSections = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"devDependencies",
];

const localPackages = new Map();
const packageJsonPaths = [];
const { env: npmEnv, cleanup: cleanupNpmEnv } = createNpmAuthEnvironment();

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

for (const root of workspaceRoots) {
	const rootDir = join(repoRoot, root);
	for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const pkgJsonPath = join(rootDir, entry.name, "package.json");
		try {
			const pkg = readJson(pkgJsonPath);
			if (pkg?.name && pkg?.version) {
				localPackages.set(pkg.name, pkg.version);
				packageJsonPaths.push(pkgJsonPath);
			}
		} catch {
			// Ignore non-package directories.
		}
	}
}

const resolveWorkspaceRange = (workspaceSpecifier, packageName) => {
	const localVersion = localPackages.get(packageName);
	if (!localVersion) return workspaceSpecifier;

	const suffix = workspaceSpecifier.slice("workspace:".length);
	if (suffix === "*" || suffix === "") return localVersion;
	if (suffix === "^") return `^${localVersion}`;
	if (suffix === "~") return `~${localVersion}`;
	return suffix;
};

const backups = new Map();
const changedFiles = [];

const rewriteWorkspaceRanges = () => {
	for (const pkgJsonPath of packageJsonPaths) {
		const original = readFileSync(pkgJsonPath, "utf8");
		const pkg = JSON.parse(original);
		let changed = false;

		for (const section of depSections) {
			const deps = pkg[section];
			if (!deps) continue;
			for (const [name, range] of Object.entries(deps)) {
				if (typeof range === "string" && range.startsWith("workspace:")) {
					const next = resolveWorkspaceRange(range, name);
					if (next !== range) {
						deps[name] = next;
						changed = true;
					}
				}
			}
		}

		if (changed) {
			backups.set(pkgJsonPath, original);
			writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf8");
			changedFiles.push(pkgJsonPath);
		}
	}
};

const restoreWorkspaceRanges = () => {
	for (const [path, contents] of backups.entries()) {
		writeFileSync(path, contents, "utf8");
	}
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runChangesetPublishOnce = () =>
	new Promise((resolve, reject) => {
		const child = spawn("bunx", ["changeset", "publish"], {
			cwd: repoRoot,
			stdio: "inherit",
			env: npmEnv,
		});

		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`changeset publish exited with code ${code}`));
		});
		child.on("error", reject);
	});

const runChangesetPublish = async () => {
	// Retry once to recover from transient npm issues or partial publishes.
	// On retry, Changesets skips versions that are already published.
	const maxAttempts = 2;
	let lastError;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			console.log(`[release] Running changeset publish (attempt ${attempt}/${maxAttempts})`);
			await runChangesetPublishOnce();
			return;
		} catch (error) {
			lastError = error;
			if (attempt === maxAttempts) break;
			console.warn(
				`[release] changeset publish failed on attempt ${attempt}; retrying once in 5s...`,
			);
			await sleep(5000);
		}
	}

	throw lastError;
};

const runDistTagFixup = () =>
	new Promise((resolve, reject) => {
		// In changesets pre mode, `changeset publish` applies the pre tag to every
		// package it publishes (see getReleaseTag in @changesets/cli), which would
		// strand `latest` for groups that release plain versions — the
		// transformation line during the 1.0.0-beta. A plain release always owns
		// `latest` and a prerelease never does, so after publishing, re-point
		// `latest` at each plain-version package whose npm dist-tag differs.
		const plainPackages = [...localPackages.entries()].filter(([, version]) =>
			/^\d+\.\d+\.\d+$/.test(version),
		);
		if (plainPackages.length === 0) {
			resolve();
			return;
		}

		const tasks = plainPackages.map(
			([name, version]) =>
				new Promise((done, failTask) => {
					const view = spawn(
						"npm",
						["view", name, "dist-tags", "--json"],
						{ cwd: repoRoot, env: npmEnv },
					);
					let out = "";
					view.stdout.on("data", (chunk) => {
						out += chunk;
					});
					view.on("close", (code) => {
						if (code !== 0) {
							// Not on npm yet (first publish raced registry indexing) or a
							// transient error: the publish above owns the failure surface.
							done();
							return;
						}
						try {
							const tags = JSON.parse(out);
							if (tags?.latest === version) {
								done();
								return;
							}
							const add = spawn(
								"npm",
								["dist-tag", "add", `${name}@${version}`, "latest"],
								{ cwd: repoRoot, env: npmEnv, stdio: "inherit" },
							);
							add.on("close", (addCode) => {
								if (addCode === 0) {
									console.log(`[release] dist-tag latest -> ${name}@${version}`);
									done();
								} else {
									failTask(
										new Error(`npm dist-tag add ${name}@${version} latest exited with ${addCode}`),
									);
								}
							});
							add.on("error", failTask);
						} catch (error) {
							failTask(error);
						}
					});
					view.on("error", failTask);
				}),
		);

		Promise.all(tasks).then(resolve, reject);
	});

try {
	rewriteWorkspaceRanges();
	if (changedFiles.length > 0) {
		console.log(
			`[release] Rewrote workspace ranges in ${changedFiles.length} package.json file(s) for publish`,
		);
	}
	await runChangesetPublish();
	await runDistTagFixup();
} finally {
	restoreWorkspaceRanges();
	cleanupNpmEnv();
	if (changedFiles.length > 0) {
		console.log("[release] Restored workspace ranges after publish");
	}
}
