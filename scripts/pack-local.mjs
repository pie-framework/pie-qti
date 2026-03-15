import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Local pack script.
 *
 * Produces installable tarballs for all publishable @pie-qti packages
 * in ./local-builds. Designed for fast local iteration without publishing.
 *
 * Usage:
 *   bun run pack:local
 *
 * Install example (from a consumer repo):
 *   npm i file:/path/to/pie-qti/local-builds/pie-qti-player-elements-x.y.z.tgz ...
 */

const repoRoot = process.cwd();
const outDir = join(repoRoot, "local-builds");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const packagesToPack = readdirSync(join(repoRoot, "packages"))
	.map((name) => `packages/${name}`)
	.filter((rel) => {
		const pkgJsonPath = join(repoRoot, rel, "package.json");
		if (!existsSync(pkgJsonPath)) return false;
		try {
			const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
			return !pkg.private && pkg.name?.startsWith("@pie-qti/");
		} catch {
			return false;
		}
	})
	.sort();

for (const rel of packagesToPack) {
	const pkgDir = join(repoRoot, rel);
	try {
		execSync(`bun pm pack --ignore-scripts --destination "${outDir}" --quiet`, {
			cwd: pkgDir,
			stdio: "inherit",
		});
	} catch (e) {
		console.error(`[pack-local] Failed to pack ${rel}`);
		throw e;
	}
}

const tgzs = readdirSync(outDir)
	.filter((f) => f.endsWith(".tgz"))
	.sort();

console.log("\nLocal packages written to:", outDir);
console.log("\nTarballs:");
for (const f of tgzs) console.log("  -", f);

if (tgzs.length > 0) {
	console.log("\nInstall example:");
	console.log("  npm i " + tgzs.map((f) => `file:${join(outDir, f)}`).join(" "));
}
