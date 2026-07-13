---
name: releases-and-changesets
description: Use when creating `.changeset/*.md`, adding a publishable `@pie-qti/*` package, choosing a release bump, running `bun run version`, `bun run release`, `bun run release:with-version`, or preparing fixed-version package publishing.
---

# Releases And Changesets

Author changesets and prepare releases under this repo's fixed-version publishing policy for publishable `@pie-qti/*` packages.

## Source Of Truth

- `.changeset/config.json` defines the fixed package group and ignored private apps.
- `scripts/publish-policy.json` defines publishable workspace roots and package metadata requirements.
- `scripts/create-temporary-release-changeset.mjs` writes a temporary patch changeset for every publishable package during `release:with-version`.
- `scripts/check-fixed-versioning.mjs` verifies that the fixed group matches the publishable package set and that publishable package versions stay aligned.
- `package.json` scripts define the canonical release commands.

## Policy

All publishable `@pie-qti/*` packages release as one fixed-version set. A release updates every publishable package in the set, even when only some packages changed. Treat that as an invariant, not drift to "clean up."

Use `patch` for ordinary pre-1.0 changes unless the maintainer explicitly asks for a different bump. If a pending changeset declares `minor` or `major`, call it out before running `bun run version` or any release command because it affects the whole fixed group.

## When To Add A Changeset

Add a changeset when a change ships in a publishable package or changes a host-facing package contract:

- source changes under publishable `packages/*` or `tools/*`,
- public exports, package metadata, generated `dist`, or runtime side effects,
- transformation, player, component, scoring, packaging, or CLI behavior that consumers receive from npm,
- a new publishable package.

Skip a changeset for docs-only changes, private app changes, tests that do not change shipped behavior, and internal cleanup with no package output change.

## Authoring A Changeset

1. Check the changed publishable packages.
2. Create or edit a `.changeset/*.md` file.
3. List only packages whose shipped behavior or public surface changed; the release script supplies the all-package lockstep bump.
4. Keep the body consumer-facing: what changed, why it matters, and any migration note.
5. Use `patch` unless the maintainer explicitly requests another bump.

## Adding A Publishable Package

When adding a package that will publish to npm:

1. Add it under a workspace root covered by `scripts/publish-policy.json`.
2. Add the package name to the fixed group in `.changeset/config.json`.
3. Ensure package metadata satisfies `bun run check:package-metadata`.
4. Ensure exports and publish surface satisfy `bun run check:publish-surface`, `bun run check:pack-exports`, and `bun run check:pack-smoke`.
5. Add a changeset for the new package.

## Commands

| Command | Use |
| --- | --- |
| `bun run changeset` | Interactive changeset authoring. |
| `bun run version` | Apply pending changesets to package versions and changelogs. |
| `bun run verify:publish` | Full build plus publish preflight. |
| `bun run verify:publish:quick` | Publish preflight without the initial build. |
| `bun run release:with-version` | Canonical local release command: temporary all-package changeset, version, restore workspace ranges, auth check, publish verification, tests, release, restore ranges. |
| `bun run release` | Lower-level publish wrapper used by `release:with-version`; do not run directly unless the maintainer asks. |

## Preflight

Before a release, confirm:

- working tree and branch are intentional,
- pending changesets have the expected bump levels,
- `.env` contains the npm token required by `bun run check:npm-auth`,
- `bun run verify:publish` passes,
- `bun run test` passes when preparing an actual publish.

Run release commands with full sandbox permissions when browser-bound tests or networked npm checks are expected.

## Do Not

- Do not remove a package from `.changeset/config.json` to unblock a release.
- Do not publish with `npm publish` directly.
- Do not leave workspace ranges rewritten after a failed version or release step; run `bun run restore:workspace-ranges` if needed.
- Do not copy the `pie-players` patch-only rule blindly if the maintainer explicitly chooses a different `pie-qti` bump policy.
