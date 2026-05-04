#!/usr/bin/env bun

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

type RunOptions = {
	cwd?: string;
	env?: Record<string, string | undefined>;
};

type AppConfig = {
	appDir: string;
	logPrefix: string;
	watchFilters: string[];
};

const appConfigs: Record<string, AppConfig> = {
	demo: {
		appDir: "apps/demo",
		logPrefix: "dev:demo",
		watchFilters: [
			"@pie-qti/i18n",
			"@pie-qti/item-player",
			"@pie-qti/default-components",
			"@pie-qti/assessment-player",
			"@pie-qti/player-elements",
			"@pie-qti/web-component-loaders",
			"@pie-qti/typeset-katex",
			"@pie-qti/qti-common",
			"@pie-qti/ims-cp-core",
			"@pie-qti/ims-cp-browser",
			"@pie-qti/logger",
			"@pie-qti/pie-to-qti2",
			"@acme/likert-scale-plugin",
		],
	},
};

function usageAndExit(message?: string): never {
	if (message) {
		console.error(message);
	}
	console.error("Usage: bun scripts/dev-app.ts <demo> [vite args...]");
	process.exit(1);
}

function buildTurboFilterArgs(filters: string[]) {
	return filters.flatMap((filter) => ["--filter", filter]);
}

async function runCommand(cmd: string[], options: RunOptions = {}) {
	const proc = Bun.spawn(cmd, {
		cwd: options.cwd,
		stdio: ["inherit", "inherit", "inherit"],
		env: { ...process.env, ...options.env },
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
}

function spawnCommand(cmd: string[], options: RunOptions = {}) {
	return Bun.spawn(cmd, {
		cwd: options.cwd,
		stdio: ["inherit", "inherit", "inherit"],
		env: { ...process.env, ...options.env },
	});
}

function removeDirIfExists(path: string) {
	if (!existsSync(path)) return;
	rmSync(path, { recursive: true, force: true });
}

const cliArgs = process.argv.slice(2);
const appName = cliArgs.shift();
if (!appName) {
	usageAndExit();
}

const config = appConfigs[appName];
if (!config) {
	usageAndExit(`Unknown app "${appName}".`);
}

const args = cliArgs;
const rebuildIndex = args.indexOf("--rebuild");
const shouldRebuild = rebuildIndex !== -1;
const noWatchIndex = args.indexOf("--no-watch");
const shouldWatch = noWatchIndex === -1;

if (shouldRebuild) {
	args.splice(rebuildIndex, 1);
}
if (noWatchIndex !== -1) {
	args.splice(noWatchIndex, 1);
}

const appDir = resolve(process.cwd(), config.appDir);
const svelteKitTsconfigPath = resolve(appDir, ".svelte-kit/tsconfig.json");

if (shouldRebuild) {
	console.log(`[${config.logPrefix}] --rebuild enabled`);
	console.log(`[${config.logPrefix}] Cleaning app caches...`);

	removeDirIfExists(resolve(appDir, ".svelte-kit"));
	removeDirIfExists(resolve(appDir, ".vite"));
	removeDirIfExists(resolve(appDir, "node_modules/.vite"));
	removeDirIfExists(resolve(process.cwd(), "node_modules/.vite"));

	console.log(`[${config.logPrefix}] Rebuilding workspace packages...`);
	await runCommand(["bun", "run", "build"]);

	// Ensure Vite does a fresh dependency optimization after cache cleanup.
	if (!args.includes("--force")) {
		args.push("--force");
	}
}

if (!existsSync(svelteKitTsconfigPath)) {
	console.log(`[${config.logPrefix}] Syncing SvelteKit generated files...`);
	await runCommand(["bun", "x", "svelte-kit", "sync"], {
		cwd: appDir,
	});
}

const childProcs: Array<ReturnType<typeof spawnCommand>> = [];
const devFastBuildEnv = { PIE_QTI_DEV_FAST_BUILD: "1" };

console.log(`[${config.logPrefix}] Running initial dependency build...`);
await runCommand(
	[
		"bun",
		"x",
		"turbo",
		"build",
		"--force",
		...buildTurboFilterArgs(config.watchFilters),
	],
	{ env: devFastBuildEnv },
);

if (shouldWatch) {
	const watchCommand = [
		"bun",
		"x",
		"turbo",
		"watch",
		"build",
		...buildTurboFilterArgs(config.watchFilters),
	];
	console.log(`[${config.logPrefix}] Starting dependency watch build...`);
	childProcs.push(spawnCommand(watchCommand, { env: devFastBuildEnv }));
}

console.log(`[${config.logPrefix}] Starting app dev server...`);
const appProc = spawnCommand(["bun", "run", "--cwd", config.appDir, "dev", ...args]);
childProcs.push(appProc);

for (const proc of childProcs) {
	if (proc === appProc) continue;
	proc.exited.then((code) => {
		if (code === 0) return;
		console.error(`[${config.logPrefix}] Dependency watcher exited with code ${code}`);
		appProc.kill();
		process.exit(code);
	});
}

const shutdown = () => {
	for (const proc of childProcs) {
		proc.kill();
	}
};

process.on("SIGINT", () => {
	shutdown();
	process.exit(130);
});
process.on("SIGTERM", () => {
	shutdown();
	process.exit(143);
});

const appExitCode = await appProc.exited;
shutdown();
process.exit(appExitCode);
