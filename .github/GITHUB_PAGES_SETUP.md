# GitHub Pages Deployment

This guide explains how the GitHub Pages deployment is configured for pie-qti.

## What Gets Deployed

`.github/workflows/deploy-pages.yml` builds **two** apps and publishes them as one static site on
the custom domain **https://qti.pie-framework.org/**:

- **Docs site** (`apps/docs`, SvelteKit static build) served at `/`
- **Examples/demo app** (`apps/demo`, SvelteKit static build) assembled at `/examples`

The assembly step copies `apps/docs/build/*` to the artifact root, `apps/demo/build/*` to
`examples/`, and adds a `.nojekyll` file so GitHub serves paths starting with underscore.

## Configuration

### 1. SvelteKit Static Adapter

Both apps use `@sveltejs/adapter-static` to generate static sites.

**File:** `apps/docs/vite.config.ts`

```javascript
export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({
        pages: 'build',
        assets: 'build',
        fallback: undefined,
        precompress: false,
        strict: false
      }),
      paths: {
        // No base path needed for custom domain (qti.pie-framework.org).
        // Set GITHUB_PAGES_SUBPATH=true when deploying to the github.io URL instead.
        base: process.env.GITHUB_PAGES_SUBPATH === 'true' && process.env.NODE_ENV === 'production'
          ? '/pie-qti'
          : ''
      },
      prerender: {
        entries: ['*'],
        handleMissingId: 'warn',
        handleHttpError: ({ status, path }) => {
          // Ignore 404s for /examples path - it's served by a separate app
          if (status === 404 && path.startsWith('/examples')) {
            return;
          }
          throw new Error(`${status} ${path}`);
        }
      }
    })
  ]
});
```

**Key settings:**

- `paths.base`: empty for the custom domain; `/pie-qti` only when `GITHUB_PAGES_SUBPATH=true` and
  `NODE_ENV=production` (deploying under the `github.io` subdirectory URL)
- `prerender.entries: ['*']`: prerender every route
- `handleHttpError`: ignores 404s under `/examples`, which the docs prerender never serves itself —
  the examples app supplies those paths after assembly
- `strict: false`: allows routes that can't be prerendered without failing the build

### 2. Prerendering

**File:** `apps/docs/src/routes/+layout.ts`

```typescript
export const prerender = true;
export const ssr = false;
```

This enables static generation for all routes with client-side-only rendering.

### 3. GitHub Actions Workflow

**File:** `.github/workflows/deploy-pages.yml`

Triggers on:

- Push to `master` branch
- Manual workflow dispatch

Steps:

1. Checkout code
2. Setup Node.js (`.nvmrc`) and Bun
3. Install dependencies (`bun install --frozen-lockfile`)
4. Build workspace packages (required for the examples build)
5. Build the docs site (`apps/docs`)
6. Build the examples app (`apps/demo`)
7. Assemble the Pages artifact (docs at `/`, examples at `/examples`, `.nojekyll`)
8. Upload artifact and deploy to GitHub Pages

## Repository Setup

### Initial Setup

1. **Enable GitHub Pages** in repository settings:
   - Go to Settings → Pages
   - Source: GitHub Actions
   - (Don't use "Deploy from branch" — we use Actions)

2. **Custom domain** (already configured for this repo):
   - `qti.pie-framework.org` is a CNAME to `pie-framework.github.io`
   - Set as the custom domain under Settings → Pages
   - Because the domain is custom, the apps build with an empty base path

3. **Push to master branch**:
   ```bash
   git push origin master
   ```

4. **Check Actions tab**:
   - The "Deploy to GitHub Pages" workflow runs automatically
   - The deployment URL appears in the workflow output

## Local Testing

Test the production builds locally before deploying:

```bash
# Build everything, then preview the pages output
bun run verify:apps:deploy
bun run docs:preview

# Preview the examples app if needed
bun run preview:pages
```

**Note:** The `/pie-qti` base path is only applied when `GITHUB_PAGES_SUBPATH=true` in production;
local dev and the custom-domain build use `/`.

## Updating the Site

The site automatically updates when you push to `master`:

```bash
# Make changes to the docs site or demo app
# ... edit files ...

git add .
git commit -m "docs: update docs site"
git push origin master

# Deployment happens automatically!
```

## Troubleshooting

### Build Fails: "Could not prerender page"

**Cause:** Some routes use dynamic server-side features

**Fix:** Ensure all routes can be statically generated:
- No `load` functions that fetch from external APIs at build time
- No server-side logic in `+page.server.ts` files
- Use `export const prerender = true` in `+layout.ts`

### 404 Errors After Deployment

**Cause:** Missing base path in links (only relevant when deploying under a subpath)

**Fix:** Use SvelteKit's `base` import:
```typescript
import { base } from '$app/paths';

// Good:
<a href="{base}/item-demo">Demo</a>

// Bad:
<a href="/item-demo">Demo</a>
```

### Assets Not Loading

**Cause:** Asset paths don't include base path (subpath deployments only)

**Fix:** SvelteKit handles this automatically for:
- `<img src="..." />` in components
- `import` statements in JS/TS
- CSS background images

If you need absolute URLs:
```typescript
import { base } from '$app/paths';
const imageUrl = `${base}/images/logo.png`;
```

### Deployment Doesn't Update

**Solutions:**
1. Check Actions tab for errors
2. Clear GitHub Pages cache (Settings → Pages → clear cache)
3. Manually trigger deployment (Actions → Deploy to GitHub Pages → Run workflow)
4. Check the `build/` directories were created correctly

## Monitoring

Check deployment status:
- **Actions tab**: See all workflow runs
- **Environments**: See deployment history (Settings → Environments → github-pages)

## Related Documentation

- [deploy-pages.yml](./workflows/deploy-pages.yml) - Deployment workflow
- [apps/demo/vite.config.ts](../apps/demo/vite.config.ts) - Examples app config
- [SvelteKit Static Adapter](https://kit.svelte.dev/docs/adapter-static) - Official docs
- [GitHub Pages](https://docs.github.com/en/pages) - Official docs
