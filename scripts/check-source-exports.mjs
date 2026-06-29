#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = join(
	dirname(fileURLToPath(import.meta.url)),
	"check-publish-surface.mjs",
);

const result = spawnSync(process.execPath, [scriptPath], {
	stdio: "inherit",
});

process.exit(result.status ?? 1);
