# GitHub Actions Setup Guide

This guide covers activating and configuring the CI/CD workflows for pie-qti. The workflows are
committed and run automatically; publishing authenticates through npm OIDC trusted publishing, so
no `NPM_TOKEN` secret is required.

## NPM Publishing

Releases publish with npm OIDC trusted publishing:

- The GitHub workflow is registered as a trusted publisher on npmjs.com for each package.
- Before a **new** package's first release, claim its trusted-publisher record — otherwise npm
  rejects the publish. Use `bun run trusted-publishers` to prepare/verify the records, and see
  [docs/development/trusted-publishing.md](../docs/development/trusted-publishing.md) for the full
  process and provenance checks (`bun run check:provenance`).

A legacy `NPM_TOKEN` secret is still honored as a classic-token fallback if present, but it is not
required and is intentionally not set.

## First Release

```bash
# 1. Create a changeset describing the change
bun run changeset

# 2. Commit and push to a branch, then merge the PR
git add .changeset
git commit -m "chore: add changeset"

# 3. Merging to master triggers the Release workflow, which opens a version-bump PR
# 4. Review and merge that PR — packages publish to NPM automatically
```

Local full-release flow (publishes immediately, requires npm auth): `bun run release:with-version`.
See [docs/development/publish-verification.md](../docs/development/publish-verification.md) for the
publish-readiness gates.

## Workflow Status

After pushing to GitHub, check:

- **Actions tab**: See all workflow runs
- **Commit checks**: Green checkmarks on commits
- **PR checks**: Workflows run on every PR

## Testing Before Push

Run the same checks locally that CI will run:

```bash
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run verify:a11y
bun run build
```

## Troubleshooting

### Publishing Rejected by npm

- Verify the package's trusted-publisher record on npmjs.com matches the repository, workflow
  filename, and environment (see `bun run trusted-publishers --verify`)
- New packages must claim the record before their first release
- Check the workflow run logs for the resolved publish auth mode (`oidc` vs `token`)

### Package Not Found on NPM

- If publishing scoped packages (@pie-qti/*), verify the org exists
- Check you have publish permissions for the organization

### CI Failing

- Check the Actions tab for detailed logs
- Download artifacts (test reports) for debugging
- Run checks locally to reproduce issues

## Branching Strategy

This project uses a **develop → master** workflow:

- **`develop`** - Active development branch
- **`master`** - Production branch (triggers releases; the repository default)
- **`feature/*`** - Feature branches (merge to develop)

**Key Points:**

- Daily work happens on `develop` branch
- PRs go to `develop` for review
- When ready to release: create PR from `develop` → `master`
- Merging to `master` triggers the release flow (temporary patch changeset if needed, version bump
  PR, publish on merge), followed by an automatic `master` → `develop` back-merge PR

For full details, see [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md) and
[workflows/README.md](./workflows/README.md).
