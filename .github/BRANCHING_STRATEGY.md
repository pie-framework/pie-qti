# Branching Strategy & Release Process

This document describes the git workflow and release process for pie-qti.

## Branch Structure

```
main (production)
  ↑
  └── develop (integration)
        ↑
        ├── feature/add-new-interaction
        ├── feature/improve-accessibility
        ├── fix/timing-bug
        └── docs/update-readme
```

### Branch Descriptions

- **`main`** - Production branch
  - Always stable and deployable
  - Protected branch (requires PR approval)
  - Merges to main trigger automatic releases to NPM
  - Tagged with semantic versions (v1.0.0, v1.1.0, etc.)

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
  - Created from main (only exception!)
  - Merge to both main and develop
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

When develop is ready for release:

```bash
# Switch to develop
git checkout develop
git pull origin develop

# Create changeset (if not already done)
bun run changeset

# Follow prompts:
# 1. Select packages to version
# 2. Choose bump type (major/minor/patch)
# 3. Write summary of changes

# Commit changeset
git add .changeset
git commit -m "chore: add changeset for v1.2.0"
git push origin develop
```

### 5. Releasing to Production

```bash
# Create PR from develop to main
# Title: "Release v1.2.0" or "chore: prepare release v1.2.0"
# Body: List of changes included in this release

# After PR approval and merge to main:
# 1. Release workflow automatically runs
# 2. Versions are bumped based on changesets
# 3. CHANGELOG.md files are updated
# 4. Git tags are created
# 5. Packages are published to NPM
# 6. GitHub release is created
```

## Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

- **Major (1.0.0 → 2.0.0)** - Breaking changes
  - API changes that break existing code
  - Removed features
  - Changed behavior that breaks compatibility

- **Minor (1.0.0 → 1.1.0)** - New features (backwards compatible)
  - New interactions or components
  - New configuration options
  - Enhanced functionality

- **Patch (1.0.0 → 1.0.1)** - Bug fixes (backwards compatible)
  - Bug fixes
  - Performance improvements
  - Documentation updates

### Choosing Version Bump

When creating a changeset:

```bash
bun run changeset

# Prompt: What kind of change is this?
# - patch: Bug fixes, docs, small improvements
# - minor: New features, enhancements
# - major: Breaking changes
```

## CI/CD Behavior

### On Feature Branches

- No automated workflows (push to GitHub to trigger PR checks)

### On Pull Requests to Develop

✅ Runs full CI pipeline:
- Linting and formatting checks
- Unit tests (459 tests)
- E2E tests (174 tests)
- Accessibility tests (199 tests)
- Build on all platforms

### On Push to Develop

✅ Same as PR checks
- Ensures develop stays stable
- Catches integration issues early

### On Push to Main

✅ Full CI pipeline PLUS:
- Runs tests one more time
- Bumps versions based on changesets
- Updates CHANGELOG.md files
- Creates git tags
- Publishes to NPM
- Creates GitHub releases

## Hotfix Process (Emergency Only)

For critical production bugs that can't wait for normal release cycle:

```bash
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# Fix the issue and test thoroughly
git commit -m "fix: critical security vulnerability"

# Create changeset (usually patch)
bun run changeset
# Select "patch" for version bump

# Push and create PR to main
git push origin hotfix/critical-security-fix

# After PR is merged to main:
# 1. Release happens automatically
# 2. Manually merge hotfix to develop:
git checkout develop
git merge main
git push origin develop
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

### Main Branch
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
develop (with changesets) → PR → main → auto-release
```

### Scenario 3: Critical Hotfix

```bash
main → hotfix/critical → PR → main → auto-release
                                 ↓
                              develop (manual merge)
```

### Scenario 4: Multiple Developers

```bash
Developer A: develop → feature/feature-a → PR → develop
Developer B: develop → feature/feature-b → PR → develop
Developer C: develop → fix/bug-fix → PR → develop

Later: develop → PR → main → release v1.2.0
```

## Troubleshooting

### "Changeset not detected in release"

- Make sure changeset files are in `.changeset/` directory
- Ensure changeset files are committed and pushed
- Check that changeset files have correct format

### "Release workflow didn't run"

- Check that you merged to main (not develop)
- Verify workflows are enabled in repository settings
- Check Actions tab for any error messages

### "NPM publish failed"

- Verify NPM_TOKEN secret is set
- Check token hasn't expired
- Ensure you have publish permissions for @pie-qti packages
- Check if package version already exists on NPM

### "Merge conflicts between develop and main"

```bash
# Update develop with main
git checkout develop
git pull origin main
# Resolve conflicts
git add .
git commit -m "chore: merge main into develop"
git push origin develop
```

## Summary

1. **Daily work**: Feature branches → develop
2. **Release prep**: Add changesets to develop
3. **Release**: develop → main (triggers auto-release)
4. **Emergency**: hotfix from main → main → develop

This workflow ensures:
- Stable production branch (main)
- Safe integration branch (develop)
- Automated releases with proper versioning
- Clear history and release notes
