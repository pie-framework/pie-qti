# Publish verification

This monorepo mirrors the [pie-players](https://github.com/pie-framework/pie-players) style of **npm-realistic** checks before release. CI aligns the Bun version with the root [`package.json`](../../package.json) `packageManager` field (via `bun-version-file` in GitHub Actions).

## Commands

| Command | Purpose |
|--------|---------|
| `bun run verify:publish` | Full gate: `turbo build`, then all checks below (use before a release). |
| `bun run verify:publish:quick` | Same checks as `verify:publish` **without** an extra leading build (used in CI after the build job). |
| `bun run check:package-metadata` | Enforces [`scripts/publish-policy.json`](../../scripts/publish-policy.json) on publishable workspaces under `packages/*` and `tools/*`. |
| `bun run check:publint` | Runs [publint](https://github.com/publint/publint) per package; includes a static runtime import-closure pass over published `.js` entrypoints. |
| `bun run check:types-publish` | Runs [@arethetypeswrong/cli](https://github.com/arethetypeswrong/arethetypeswrong.github.io) (`attw --pack`) for publishable `@pie-qti/*` packages. |
| `bun run check:pack-exports` | Ensures `npm pack --dry-run` includes every file referenced by `exports` / `main` / `types` / `svelte`. |
| `bun run check:pack-smoke` | Creates a real tarball per package and asserts declared files are present. |
| `bun run check:deps` | Flags undeclared imports and hoist-reliant `node_modules/.bin` script paths. |
| `bun run check:source-exports` | Ensures `./src/...` export paths only appear in packages allowlisted in `publish-policy.json`. |
| `bun run check:fixed-versioning` | Lockstep workspace versions, Changesets `fixed` group, `workspace:*` internal deps (npm patch check **skipped**; see below). |
| `bun run check:fixed-versioning:full` | Same as above **and** validates npm patch sequence against the registry when packages are published. |

## Versioning notes

- **`verify:publish`** uses `check:fixed-versioning` (with `SKIP_NPM_VERSION_SEQUENCE_CHECK`) so local and CI verification do not require a perfectly aligned npm registry when some packages are new or registry versions temporarily diverge.
- **`release:with-version`** runs `check:fixed-versioning:full` before `verify:publish`, so maintainers still get a strict npm check at release time when the registry is authoritative.

## Policy

Edit [`scripts/publish-policy.json`](../../scripts/publish-policy.json) for:

- Required `package.json` fields and `repository.directory`
- `allowedSourceExportPackages` (packages that legitimately export `./src/...`)
- `allowedUndeclaredRuntimeImports` (escape hatch for publint’s import-closure check)
- `attwSuppressInternalResolutionPackages` (packages where ATTW has known declaration-graph limitations)
