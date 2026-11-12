# GitHub Actions Workflows

This directory contains the CI/CD automation workflows for the pie-qti project.

## Workflows

### Dependency Submission (`dependency-submission.yml`)

Snapshots the dependency graph to GitHub on pushes to `master`, feeding Dependabot alerting.

### PR Notifications (`pr-notifications.yml`)

Sends Slack notifications for pull requests (skipping dependabot PRs).

### CI (`ci.yml`)

Runs on every push to `master` and `develop`, and on pull requests targeting those branches.

**Jobs:**

1. **Lint & Typecheck** - Runs Biome linting, Svelte checks, and TypeScript type checking
2. **Translation Coverage** - Verifies locale coverage and fails on hard-coded learner-visible strings (`bun run check:i18n`)
3. **Doc Links** - Verifies every relative link and heading anchor across all markdown resolves (`bun run check:doc-links`)
4. **Unit Tests** - Runs package test suites through `bun run test`, plus the repository script
   guards in `scripts/*.test.mjs` (release-workflow and certification-runner invariants) via
   `bun run test:scripts`
5. **End-to-End Tests** - Runs the Playwright E2E suites against the demo app (`bun run test:e2e`)
6. **QTI Public Certification Gate** - Runs clean-room public certification coverage
7. **Accessibility Verification** - Runs `bun run verify:a11y` with Playwright Chromium, then the
   `@cross-browser` subset (accessibility regressions plus a core smoke set) on WebKit and Firefox;
   see [docs/development/accessibility-testing.md](../../docs/development/accessibility-testing.md)
8. **Deployability (Apps)** - Builds deployable demo/docs apps and smoke-checks outputs
9. **Publish Readiness** - Builds packages and runs package publishing readiness checks
10. **All Checks** - Summary job that ensures required checks pass

**Artifacts:**
- Package build outputs from the publish-readiness job
- Playwright reports from the end-to-end job (`playwright-report`) and the accessibility job
  (`playwright-report-accessibility`)

### Release (`release.yml`)

Automatically creates release PRs and publishes packages to NPM using Changesets.

**Triggers:**
- Push to `master` branch with changes in `.changeset/`, `packages/`, `tools/`, `package.json`,
  `bun.lock`, `turbo.json`, `tsconfig*.json`, or the release workflow itself
- Manual dispatch with an explicit release intent

**Features:**
- Creates version bump PRs when changesets are detected
- Publishes to NPM when version bump PR is merged
- Opens a `master` -> `develop` back-merge PR after every publish, so `develop` picks up the bumped
  versions and drops the changesets the release consumed. `GITHUB_TOKEN` opens it, so a maintainer
  approves its workflow runs; merge it with a merge commit before the next promotion to `master`
- Marks the GitHub release as a prerelease when the published version is a prerelease
  (e.g. `1.0.0-beta.N`)
- Sends Slack notifications on publish success/failure (when the Slack secrets are configured)

**Required Secrets:**
- None. Publishing authenticates through npm OIDC trusted publishing (no stored token).
  See [docs/development/trusted-publishing.md](../../docs/development/trusted-publishing.md).
  A legacy `NPM_TOKEN` secret is still honored as a classic-token fallback if present, but it is
  not required.

### Deploy to GitHub Pages (`deploy-pages.yml`)

Builds the docs site and the examples app and publishes them as one static site.

**Triggers:**
- Push to `master` branch
- Manual dispatch

**Behavior:**
- Builds all workspace packages, then builds `apps/docs` and `apps/demo` with `NODE_ENV=production`
- Assembles one Pages artifact: docs at `/`, examples app at `/examples`, plus `.nojekyll`
- Deploys to the custom domain `qti.pie-framework.org` (CNAME in `apps/docs/static/CNAME`);
  see [GITHUB_PAGES_SETUP.md](../GITHUB_PAGES_SETUP.md)
- Sends Slack notifications on success/failure (when the Slack secrets are configured)

**Base-path note:** `GITHUB_PAGES_SUBPATH` (read by both apps' Vite configs for a `github.io/pie-qti`
subpath deployment) is **not set by any workflow**. CI always deploys the custom-domain layout
(empty base path). The subpath variant remains a manual build option documented in
[GITHUB_PAGES_SETUP.md](../GITHUB_PAGES_SETUP.md); the "set in workflow" comments in the apps'
`vite.config.ts` files are stale on this point.

**Required Secrets:**
- `SLACK_WEBHOOK_URL` (optional) — enables the Slack deploy notifications

## Setup Instructions

### 1. NPM Publishing

Publishing uses npm OIDC trusted publishing — no `NPM_TOKEN` secret is needed. New packages must
have a trusted-publisher record claimed on npmjs.com before their first release; see
[docs/development/trusted-publishing.md](../../docs/development/trusted-publishing.md) and the
`bun run trusted-publishers` helper.

### 2. Changesets Workflow

To create a new release:

```bash
# 1. Make your changes and commit them
git add .
git commit -m "feat: add new feature"

# 2. Create a changeset describing the change
bun run changeset

# 3. Select which packages to bump and change type (patch/minor/major)
# 4. Write a summary of the changes
# 5. Commit the changeset
git add .changeset
git commit -m "chore: add changeset"

# 6. Push to master
git push origin master

# 7. The Release workflow will create a PR with version bumps
# 8. Review and merge the PR to publish to NPM
```

## Testing Workflows Locally

### Act (GitHub Actions locally)

You can test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or download from https://github.com/nektos/act/releases

# Run CI workflow
act pull_request

# Run specific job
act -j lint
act -j test-unit
```

### Manual Testing

Test individual commands that workflows use:

```bash
# Linting
bun run lint:biome
bun run check
bun run typecheck

# Testing
bun run test
bun run verify:a11y

# Building
bun run build
```

## Workflow Status

Check workflow status:
- On the repository's "Actions" tab
- On PRs (checks appear at the bottom)
- Via commit status badges

## Troubleshooting

### Build Failing

If build fails in CI but not locally:
1. Verify you're using the pinned Bun version from CI
2. Confirm `bun install --frozen-lockfile` succeeds locally (lockfile in sync)
3. Check for missing platform tools in the workflow (e.g. `jq`, `bc`)

### NPM Publishing Failing

If release workflow fails to publish:
1. Verify the package has a trusted-publisher record on npmjs.com for the GitHub workflow
   (see `bun run trusted-publishers` and docs/development/trusted-publishing.md)
2. If a legacy `NPM_TOKEN` secret is set, confirm it has publish permissions and has not expired
3. Verify package names in `package.json` are available on NPM
4. Check if 2FA is required (tokens must have automation-level access)

## Maintenance

### Dependabot

Dependabot is configured (`.github/dependabot.yml`) to automatically:
- Update npm dependencies weekly (Mondays)
- Update GitHub Actions weekly (Mondays)
- Group related dependencies together

Review and merge Dependabot PRs regularly to keep dependencies up to date.

### Workflow Updates

When updating workflows:
1. Test changes locally with `act` if possible
2. Create a PR to test workflows in isolation
3. Check all jobs complete successfully
4. Update this README if workflow behavior changes

### Known version drift (parked)

`slackapi/slack-github-action` is pinned at two different majors: `@v1.27.0` in `deploy-pages.yml`
and `pr-notifications.yml` (env-var style: `SLACK_WEBHOOK_URL` / `SLACK_WEBHOOK_TYPE`) versus
`@v3.0.1` in `release.yml` (`webhook:` / `webhook-type:` input style). Both invocation styles are
incompatible between majors — v1 renames v3's inputs — so aligning them is a deliberate follow-up
(parked in the 2026-11 round-3 review), not an accident to fix in passing. Do not bump one without
the other.
