# GitHub Actions Workflows

This directory contains the CI/CD automation workflows for the pie-qti project.

## Workflows

### CI (`ci.yml`)

Runs on every push to `main` and on all pull requests.

**Jobs:**

1. **Lint & Format** - Runs Biome linting, Svelte checks, and TypeScript type checking
2. **Unit Tests** - Runs all unit tests (459 tests across packages)
3. **E2E Tests** - Runs Playwright end-to-end tests (174 tests)
4. **Accessibility Tests** - Runs dedicated accessibility test suite (199 tests, WCAG 2.2 AA)
5. **Build** - Builds all packages on Ubuntu, macOS, and Windows
6. **All Checks** - Summary job that ensures all checks pass

**Artifacts:**
- Playwright reports (retained for 30 days)
- Accessibility reports (retained for 30 days)

### Release (`release.yml`)

Automatically creates release PRs and publishes packages to NPM using Changesets.

**Triggers:**
- Push to `main` branch with changes in `.changeset/`, `packages/`, or `package.json`

**Features:**
- Creates version bump PRs when changesets are detected
- Publishes to NPM when version bump PR is merged
- Publishes canary pre-release versions for testing

**Required Secrets:**
- `NPM_TOKEN` - NPM authentication token with publish permissions

## Setup Instructions

### 1. NPM Publishing

To enable NPM publishing, add the `NPM_TOKEN` secret:

1. Generate an NPM access token at https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Go to GitHub repository Settings → Secrets and variables → Actions
3. Add a new secret named `NPM_TOKEN` with your token value

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

# 6. Push to main
git push origin main

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
bun run test:e2e
bun run test:a11y

# Building
bun run build
```

## Workflow Status

Check workflow status:
- On the repository's "Actions" tab
- On PRs (checks appear at the bottom)
- Via commit status badges

## Troubleshooting

### E2E Tests Failing

If Playwright tests fail:
1. Check the uploaded Playwright report artifact
2. Tests may need browser installation: `bunx playwright install --with-deps`
3. Check for timing issues or flaky tests

### Build Failing on Specific OS

If builds fail on macOS or Windows but not Ubuntu:
1. Check for path separator issues (`/` vs `\`)
2. Check for case-sensitive file system differences
3. Check for shell-specific command differences

### NPM Publishing Failing

If release workflow fails to publish:
1. Verify `NPM_TOKEN` secret is set correctly
2. Check NPM token has publish permissions
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
3. Check all matrix builds complete successfully
4. Update this README if workflow behavior changes
