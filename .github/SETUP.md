# GitHub Actions Setup Guide

This guide will help you activate and configure the CI/CD workflows for pie-qti.

## Quick Start

The workflows are now committed and will automatically run when you push to GitHub. However, to enable NPM publishing, you need to add a secret.

## Enable NPM Publishing (Required for Release Workflow)

### 1. Generate NPM Token

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Go to your account settings → [Access Tokens](https://www.npmjs.com/settings/YOUR_USERNAME/tokens)
3. Click "Generate New Token" → "Classic Token"
4. Select **"Automation"** token type (allows publishing without 2FA prompts)
5. Copy the token (starts with `npm_`)

### 2. Add Token to GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your NPM token
6. Click "Add secret"

### 3. Verify Organization/Package Names

Make sure your NPM organization exists and you have publish permissions:

```bash
# Check package names in each package.json
grep '"name"' packages/*/package.json

# Expected format: @pie-qti/package-name
```

If publishing to a scoped package (@pie-qti/*), ensure:
- The organization exists on NPM
- You're a member with publish permissions
- Or remove the scope to publish as unscoped packages

## First Release

Once the NPM_TOKEN is configured:

```bash
# 1. Create a changeset for your first release
bun run changeset

# Follow the prompts:
# - Select packages to version (press space, then enter)
# - Choose bump type: major (1.0.0 for first release)
# - Write summary: "Initial release"

# 2. Commit and push
git add .changeset
git commit -m "chore: prepare initial release"
git push origin main

# 3. The Release workflow will create a PR with version bumps
# 4. Review and merge the PR
# 5. Packages will be published to NPM automatically!
```

## Workflow Status

After pushing to GitHub, check:
- **Actions tab**: See all workflow runs
- **Commit checks**: Green checkmarks on commits
- **PR checks**: Workflows run on every PR

## Testing Before Push

Run the same checks locally that CI will run:

```bash
# Linting
bun run lint

# Type checking
bun run typecheck

# Tests
bun run test
bun run test:e2e
bun run test:a11y

# Build
bun run build
```

## Troubleshooting

### "NPM_TOKEN not found" Error
- Verify the secret is named exactly `NPM_TOKEN` (case-sensitive)
- Check you added it to the correct repository
- Secret must be in "Actions" secrets, not "Dependabot" or "Codespaces"

### Package Not Found on NPM
- If publishing scoped packages (@pie-qti/*), verify the org exists
- Check you have publish permissions for the organization
- Consider publishing to npm public registry first

### Permissions Error
- Ensure NPM token is "Automation" type
- Check token hasn't expired
- Verify you have publish permissions for all packages

### CI Failing
- Check the Actions tab for detailed logs
- Download artifacts (test reports) for debugging
- Run checks locally to reproduce issues

## Branching Strategy

This project uses a **develop → main** workflow:

- **`develop`** - Active development branch (default)
- **`main`** - Production branch (triggers releases)
- **`feature/*`** - Feature branches (merge to develop)

**Key Points:**

- Daily work happens on `develop` branch
- PRs go to `develop` for review
- When ready to release: create PR from `develop` → `main`
- Merging to `main` triggers automatic NPM publishing

For full details, see [BRANCHING_STRATEGY.md](.github/BRANCHING_STRATEGY.md)

## What Happens Now

1. **On push to develop**: CI runs (lint, test, build)
2. **On PR to develop**: CI runs + status checks
3. **On push to main**: CI + version bump + NPM publish + GitHub release
4. **On PR to main**: CI runs (validate release)

## Next Steps

1. **Add `NPM_TOKEN` secret** (required for publishing)
2. **Create develop branch**: `git checkout -b develop && git push -u origin develop`
3. **Set develop as default branch** in GitHub repo settings
4. **Push to GitHub** to activate workflows
5. **Set up branch protection** (see BRANCHING_STRATEGY.md)

For more details, see:

- [BRANCHING_STRATEGY.md](.github/BRANCHING_STRATEGY.md) - Complete workflow guide
- [workflows/README.md](.github/workflows/README.md) - Technical CI/CD docs
