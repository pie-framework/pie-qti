# Branching Strategy & Release Process

This document describes the git workflow and release process for pie-qti.

## Branch Structure

```
master (production)
  ↑
  └── develop (integration)
        ↑
        ├── feature/add-new-interaction
        ├── feature/improve-accessibility
        ├── fix/timing-bug
        └── docs/update-readme
```

### Branch Descriptions

- **`master`** - Production branch
  - Always stable and deployable
  - Protected branch (requires PR approval)
  - Merges to master trigger the Release workflow (version-bump PR, then publish; see
    [Releasing to Production](#5-releasing-to-production))
  - Tagged per release (`v<version>`, for example `v1.0.0-beta.6`)

- **`develop`** - Integration branch
  - Active development happens here
  - All feature branches merge into develop first
  - CI runs on every push
  - Should always be in a working state

- **`feature/*`** - Feature branches
  - Created from develop
  - Merge back to develop via PR
  - Branch naming: `feature/short-description`
  - Examples: `feature/add-drag-drop`, `feature/improve-scoring`

- **`fix/*`** - Bug fix branches
  - Created from develop
  - Merge back to develop via PR
  - Branch naming: `fix/short-description`
  - Examples: `fix/navigation-bug`, `fix/memory-leak`

- **`docs/*`** - Documentation branches
  - Created from develop
  - Merge back to develop via PR
  - Branch naming: `docs/short-description`

- **`hotfix/*`** - Emergency production fixes
  - Created from master (only exception!)
  - Merge to both master and develop
  - Branch naming: `hotfix/critical-issue`
  - Use sparingly for critical production bugs

## Development Workflow

### 1. Starting New Work

```bash
# Update develop branch
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/my-new-feature

# Make changes and commit
git add .
git commit -m "feat: add my new feature"
```

### 2. Creating a Pull Request

```bash
# Push your branch
git push origin feature/my-new-feature

# Create PR on GitHub
# - Base branch: develop
# - Compare branch: feature/my-new-feature
# - Fill out PR template
# - Wait for CI checks to pass
# - Request review from team
```

### 3. Merging to Develop

- PR must have at least one approval
- All CI checks must pass (lint, tests, build)
- Squash and merge is preferred for feature branches
- Delete branch after merge

### 4. Preparing a Release

Changesets are normally added on the branch that carries the change. If a change shipped without
one, add it before promoting `develop`:

```bash
# Switch to develop
git checkout develop
git pull origin develop

# Create changeset (if not already done)
bun run changeset

# Follow prompts:
# 1. Select the packages that changed
# 2. Record the semver type that describes your change (major/minor/patch)
# 3. Write a summary of the changes

# Commit changeset
git add .changeset
git commit -m "chore: add changeset"
git push origin develop
```

The type you record describes the change for the changelog; it does not choose the published
version. See [How the published version is chosen](#how-the-published-version-is-chosen).

### 5. Releasing to Production

```bash
# Create PR from develop to master
# Title: "chore(release): promote <what changed> to master"
# Body: List of changes included in this release

# After PR approval and merge to master:
# 1. The Release workflow runs and opens a version-bump PR on master
#    (it adds a temporary patch changeset first when the merge brought none)
# 2. Merging that PR bumps every publishable package together, updates the
#    CHANGELOG.md files, publishes to NPM, and creates the git tags and the
#    GitHub release
# 3. A master -> develop back-merge PR opens; merge it before the next promotion
```

## Semantic Versioning

We use [Semantic Versioning 2.0.0](https://semver.org/) vocabulary to describe the intent of changes:

- **Major** - Breaking changes
  - API changes that break existing code
  - Removed features
  - Changed behavior that breaks compatibility

- **Minor** - New features (backwards compatible)
  - New interactions or components
  - New configuration options
  - Enhanced functionality

- **Patch** - Bug fixes (backwards compatible)
  - Bug fixes
  - Performance improvements
  - Documentation updates

### How the published version is chosen

The changeset type does **not** control the published version bump. All publishable `packages/*`
release together in lockstep and the release flow is **patch-only**: when merges to `master` have
no changeset, a temporary patch changeset is auto-generated, and `check:fixed-versioning` enforces
that the shared version line only moves through deliberate version-line preparations (such as the
1.0.0-beta prep).

Changeset files still matter — use them to document what changed, including backwards-compatibility
notes for the changelog:

```bash
bun run changeset

# Record the semver type that describes your change (patch/minor/major);
# the release machinery normalizes the published bump to a patch per release.
```

See [docs/development/publish-verification.md](../docs/development/publish-verification.md).

## CI/CD Behavior

### On Feature Branches

- No automated workflows (push to GitHub to trigger PR checks)

### On Pull Requests to Develop

✅ Runs full CI pipeline:
- Linting and formatting checks
- Unit tests across all packages
- End-to-end tests (Playwright against the demo app)
- Accessibility verification (`bun run verify:a11y`)
- QTI public certification gate (`bun run test:certification:public`)
- Publish-readiness checks (`verify:publish:quick`)
- Docs/demo deployability builds

### On Push to Develop

✅ Same as PR checks
- Ensures develop stays stable
- Catches integration issues early

### On Push to Master

✅ Full CI pipeline PLUS the Release workflow:
- Runs the publish-readiness checks and the tests
- Opens a version-bump PR when changesets are pending, or publishes when the merged
  commit is that version bump
- Updates CHANGELOG.md files, creates git tags and the GitHub release
- Opens a `master` -> `develop` back-merge PR after every publish

## Hotfix Process (Emergency Only)

For critical production bugs that can't wait for normal release cycle:

```bash
# Create hotfix branch from master
git checkout master
git pull origin master
git checkout -b hotfix/critical-security-fix

# Fix the issue and test thoroughly
git commit -m "fix: critical security vulnerability"

# Create changeset describing the fix
bun run changeset
# Record the semver type that describes the change; the published bump is normalized

# Push and create PR to master
git push origin hotfix/critical-security-fix

# After PR is merged to master:
# 1. The Release workflow opens a version-bump PR; merging it publishes
# 2. Merge the master -> develop back-merge PR the workflow opens
#    (it carries the fix, the version bump and the changesets the release consumed)
```

## Changeset Best Practices

### Writing Good Changeset Summaries

```bash
# Bad
"Fixed stuff"
"Updates"

# Good
"Fixed navigation bug where back button didn't restore scroll position"
"Added support for custom outcome processors via pluggable architecture"
```

### Multiple Changes in One PR

If your PR includes multiple changes, create separate changesets:

```bash
bun run changeset  # First change
bun run changeset  # Second change
```

### No User-Facing Changes

For internal refactors, infrastructure, or non-user-facing changes:

```bash
# Don't create a changeset
# Or create one with "patch" and mark as internal in summary
```

## Branch Protection Rules

Recommended settings on GitHub:

### Master Branch
- ✅ Require pull request reviews (at least 1)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push to this branch

### Develop Branch
- ✅ Require pull request reviews (at least 1)
- ✅ Require status checks to pass
- ✅ Allow force pushes (for admins only)

## Common Scenarios

### Scenario 1: Regular Feature Development

```bash
develop → feature/my-feature → PR → develop
```

### Scenario 2: Release to Production

```bash
develop (with changesets) → PR → master → version-bump PR → publish → back-merge PR → develop
```

### Scenario 3: Critical Hotfix

```bash
master → hotfix/critical → PR → master → version-bump PR → publish → back-merge PR → develop
```

### Scenario 4: Multiple Developers

```bash
Developer A: develop → feature/feature-a → PR → develop
Developer B: develop → feature/feature-b → PR → develop
Developer C: develop → fix/bug-fix → PR → develop

Later: develop → PR → master → version-bump PR → publish
```

## Troubleshooting

### "Changeset not detected in release"

- Make sure changeset files are in `.changeset/` directory
- Ensure changeset files are committed and pushed
- Check that changeset files have correct format

### "Release workflow didn't run"

- Check that you merged to master (not develop)
- Verify workflows are enabled in repository settings
- Check Actions tab for any error messages

### "NPM publish failed"

- Verify the package's npm trusted-publisher record matches this repo and workflow
  (`bun run trusted-publishers --verify`; see docs/development/trusted-publishing.md)
- If a legacy `NPM_TOKEN` secret is set, check it hasn't expired and has publish permissions
- Ensure you have publish permissions for @pie-qti packages
- Check if package version already exists on NPM

### "Merge conflicts between develop and master"

```bash
# Update develop with master
git checkout develop
git pull origin master
# Resolve conflicts
git add .
git commit -m "chore: merge master into develop"
git push origin develop
```

## Summary

1. **Daily work**: Feature branches → develop, with a changeset when a publishable package changes
2. **Release**: develop → master → version-bump PR → publish → back-merge PR → develop
3. **Emergency**: hotfix from master → master, then the same release path

This workflow ensures:
- Stable production branch (master)
- Safe integration branch (develop)
- Automated releases with proper versioning
- Clear history and release notes
