# `@pie-qti/web-component-loaders`

Shared, **idempotent client-side loaders** for PIE QTI web components, intended to be reused across apps.

This package provides small helper functions that:

- **Only run in the browser** (no-op during SSR / Node)
- **Dedupe** loads across multiple calls (the underlying dynamic `import()` runs once per page)
- Optionally **wait until custom elements are defined** before continuing

## Install / dependency expectations

It declares `@pie-qti/player-elements` and `@pie-qti/default-components` as optional peer dependencies, because the loader imports their browser registration modules at runtime.
It also declares `@pie-qti/theme-daisyui` as an optional peer dependency for the default runtime stylesheet.

## CSS

Import the default browser runtime stylesheet once from your host app:

```ts
import '@pie-qti/web-component-loaders/default-runtime.css';
```

This composes the QTI DaisyUI theme bridge and QTI shared vocabulary stylesheet.

## Usage

### Load PIE QTI player elements once (safe to call multiple times)

```ts
import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';
import '@pie-qti/web-component-loaders/default-runtime.css';

await loadPieQtiPlayerElements();
// At this point the register module was imported and we waited for:
// - <pie-qti-item-player>
// - <pie-qti-assessment-player>
// - the bundled default QTI interaction elements
```

### Using in React (example)

```ts
import { useEffect } from 'react';
import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';
import '@pie-qti/web-component-loaders/default-runtime.css';

export function QtiPlayerBoot() {
  useEffect(() => {
    void loadPieQtiPlayerElements();
  }, []);

  return null;
}
```

## Notes

- **SSR**: `loadPieQtiPlayerElements()` returns immediately when `window` is not available.
- **Idempotency**: load promises are stored on `globalThis.__pieQtiWebComponentLoaders__` to prevent duplicate imports.
