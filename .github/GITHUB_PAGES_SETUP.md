# GitHub Pages Setup Guide

This guide explains how the GitHub Pages deployment is configured for pie-qti.

## What Gets Deployed

The **docs-site** SvelteKit app is deployed to GitHub Pages as a static site at:
**https://pie-framework.github.io/pie-qti/**

This provides:
- Project documentation and architecture overview
- Links to the GitHub repository for detailed package READMEs

## Configuration

### 1. SvelteKit Static Adapter

The example app uses `@sveltejs/adapter-static` to generate a static site.

**File:** `packages/docs-site/svelte.config.js`
```javascript
import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: false // Allow non-prerenderable API routes (they won't be available on GitHub Pages)
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/pie-qti' : ''
    },
    prerender: {
      handleMissingId: 'warn',
      handleUnseenRoutes: 'ignore' // Ignore dynamic routes like /a11y-components/[fixture]
    }
  }
};
```

**Key settings:**
- `paths.base`: Sets `/pie-qti` base path for production (GitHub Pages subdirectory)
- `fallback: undefined`: No SPA fallback (all routes prerendered)
- `strict: false`: Allows API routes that can't be prerendered (they won't work on GitHub Pages but won't block the build)
- `handleUnseenRoutes: 'ignore'`: Ignores dynamic routes used for testing that aren't linked in the app

### 2. Prerendering

**File:** `packages/docs-site/src/routes/+layout.ts`
```typescript
export const prerender = true;
export const ssr = false;
```

This enables:
- Static site generation for all routes
- Client-side only rendering (no server needed)

### 3. GitHub Actions Workflow

**File:** `.github/workflows/deploy-pages.yml`

Triggers on:
- Push to `main` branch
- Manual workflow dispatch

Steps:
1. Checkout code
2. Setup Bun
3. Install dependencies
4. Build docs site with `NODE_ENV=production`
6. Upload build artifact
7. Deploy to GitHub Pages

## Repository Setup

### Initial Setup

1. **Enable GitHub Pages** in repository settings:
   - Go to Settings → Pages
   - Source: GitHub Actions
   - (Don't use "Deploy from branch" - we use Actions)

2. **Push to master branch**:
   ```bash
   git push origin master
   ```

3. **Check Actions tab**:
   - Workflow will run automatically
   - Look for "Deploy to GitHub Pages" workflow
   - Check for any errors

4. **Access deployed site**:
   - Wait 2-3 minutes for deployment
   - Visit: https://pie-framework.github.io/pie-qti/
   - Or check the URL in the workflow output

### Branch Protection (Optional)

To prevent accidental deployments:
- Only allow deployment from `master` branch
- Require pull request reviews before merging to `master`

## Local Testing

Test the production build locally before deploying:

```bash
# Build the docs site for production
cd packages/docs-site
NODE_ENV=production bun run build

# Preview the build
bun run preview

# Open http://localhost:4173/pie-qti/
```

**Note:** The base path `/pie-qti` is only applied in production, so local dev uses `/`.

## Updating the Site

The site automatically updates when you push to `master`:

```bash
# Make changes to the docs site
cd packages/docs-site
# ... edit files ...

# Commit and push
git add .
git commit -m "docs: update docs site"
git push origin master

# Deployment happens automatically!
```

## Troubleshooting

### Build Fails: "Could not prerender page"

**Cause:** Some routes use dynamic server-side features

**Fix:** Ensure all routes can be statically generated:
- No `load` functions that fetch from external APIs
- No server-side logic in `+page.server.ts` files
- Use `export const prerender = true` in `+layout.ts`

### 404 Errors After Deployment

**Cause:** Missing base path in links

**Fix:** Use SvelteKit's `base` import:
```typescript
import { base } from '$app/paths';

// Good:
<a href="{base}/item-demo">Demo</a>

// Bad:
<a href="/item-demo">Demo</a>
```

### Assets Not Loading

**Cause:** Asset paths don't include base path

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
4. Check `build/` directory was created correctly

## Custom Domain (Optional)

To use a custom domain like `qti.pie-framework.org`:

1. **Add CNAME record** in DNS:
   ```
   CNAME qti.pie-framework.org -> pie-framework.github.io
   ```

2. **Update repository settings**:
   - Go to Settings → Pages
   - Custom domain: `qti.pie-framework.org`
   - Save (this creates CNAME file in repo)

3. **Update svelte.config.js**:
   ```javascript
   paths: {
     base: '' // Remove /pie-qti for custom domain
   }
   ```

4. **Wait for DNS propagation** (up to 24 hours)

## Performance Tips

### Enable Precompression

Update `svelte.config.js`:
```javascript
adapter: adapter({
  precompress: true, // Generates .gz and .br files
  // ... other options
})
```

### Add Service Worker (Optional)

For offline support, add a service worker:
```bash
cd packages/qti2-example
bun add -D @sveltejs/service-worker
```

Then create `src/service-worker.ts` to cache assets.

## Monitoring

Check deployment status:
- **Actions tab**: See all workflow runs
- **Environments**: See deployment history (Settings → Environments → github-pages)
- **Analytics**: Enable in Settings → Pages → Insights (if needed)

## Cost

**GitHub Pages is free for public repositories!**
- Soft limit: 100 GB bandwidth/month
- 100 GB storage
- 10 builds/hour

For private repos, you need a paid plan.

## Related Documentation

- [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) - Deployment workflow
- [packages/qti2-example/svelte.config.js](../packages/qti2-example/svelte.config.js) - SvelteKit config
- [SvelteKit Static Adapter](https://kit.svelte.dev/docs/adapter-static) - Official docs
- [GitHub Pages](https://docs.github.com/en/pages) - Official docs
