# Asset Loading Evaluation Suite

This evaluation suite tests asset URL resolution and loading with the configurable `assetBaseUrl` security policy.

## Overview

The asset loading system provides:
- **Configurable base URL**: `assetBaseUrl` for resolving asset paths
- **Relative path resolution**: `./image.png` resolves against base URL
- **Absolute path resolution**: `/assets/image.png` uses base URL prefix
- **GitHub Pages support**: Handles subpath deployments like `/pie-qti/examples/`
- **Media asset support**: Audio, video, images in QTI content

## Test Coverage

### Asset URL Resolution (`asset-url-resolution/`)
**3 eval cases**

Tests various asset loading scenarios:
- **Audio relative paths**: Media interaction with relative audio source
- **Image paths**: SVG/PNG images in item content
- **Canvas images**: Background and draggable images in graphic interactions

Asset types tested:
- Audio files (`.mp3`, `.wav`)
- Image files (`.png`, `.jpg`, `.svg`)
- Background images (graphic-gap-match, hotspot)
- Draggable item images

## Running the Tests

### Run all asset loading evals
```bash
cd packages/qti2-example
bun run test:e2e -- docs/evals/qti2-asset-loading
```

### Run with UI mode (for debugging)
```bash
bun run test:e2e:ui -- docs/evals/qti2-asset-loading
```

## Implementation Details

### Security Configuration
**File**: `packages/qti2-example/src/lib/player-config.ts`

```typescript
export function getSecurityConfig(): NonNullable<PlayerConfig['security']> {
  return {
    urlPolicy: {
      assetBaseUrl: getAssetBaseUrl(),
    },
  };
}
```

### Asset Base URL Calculation
```typescript
function getAssetBaseUrl(): string {
  if (browser) {
    // Uses window.location.origin + SvelteKit base path
    return `${window.location.origin}${base}`;
  }
  return '';
}
```

### URL Resolution Logic
**File**: `packages/qti2-item-player/src/core/urlPolicy.ts`

- **Relative paths** (`./image.png`): Resolved against `assetBaseUrl`
- **Absolute paths** (`/assets/image.png`): Prepended with `assetBaseUrl`
- **Full URLs** (`https://example.com/image.png`): Passed through unchanged
- **Data URLs** (`data:image/png;base64,...`): Passed through unchanged

### GitHub Pages Deployment
For subpath deployments like `https://example.github.io/pie-qti/examples/`:
- `base` is set to `/pie-qti/examples`
- `assetBaseUrl` becomes `https://example.github.io/pie-qti/examples`
- Assets resolve correctly with subpath prefix

## Spirit Checks

All evals include spirit checks to validate:
- **No 404 errors**: All assets load successfully
- **Visual fidelity**: Images display correctly without broken icons
- **Media playback**: Audio/video controls work smoothly
- **Consistent behavior**: Asset loading works across all deployment contexts

## Related Documentation

- **URL policy**: `packages/qti2-item-player/src/core/urlPolicy.ts`
- **Player config**: `packages/qti2-example/src/lib/player-config.ts`
- **Security config**: `packages/qti2-item-player/README.md`

## Notes for Test Runners

### Network Request Validation
Evals should validate:
- No 404 errors in browser console
- Media elements have valid `src` attributes
- Images render without broken icon placeholders

### Playwright Network API
Consider using:
```typescript
page.on('response', response => {
  if (response.status() === 404) {
    throw new Error(`Asset not found: ${response.url()}`);
  }
});
```

### Potential Flakiness
- **Network timing**: Assets may load asynchronously
- **CDN delays**: External assets may have variable load times
- **Cache behavior**: Cached assets may load faster

## Success Criteria

- ✅ Relative asset paths resolve correctly
- ✅ Absolute asset paths use configured base URL
- ✅ No 404 errors for any assets
- ✅ Media assets (audio/video) load and play
- ✅ Images in graphic interactions render correctly
- ✅ GitHub Pages subpath deployment works
- ✅ Security policy is consistently applied
