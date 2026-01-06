# `@pie-qti/web-component-loaders`

Shared, **idempotent client-side loaders** for PIE QTI web components, intended to be reused across apps.

This package provides small helper functions that:

- **Only run in the browser** (no-op during SSR / Node)
- **Dedupe** loads across multiple calls (the underlying dynamic `import()` runs once per page)
- Optionally **wait until custom elements are defined** before continuing

## Install / dependency expectations

This package is currently `private` and is meant to be used from within the `pie-qti` workspace.

It declares `@pie-qti/qti2-player-elements` as an (optional) peer dependency, because the loader imports its register module at runtime.

## Usage

### Load PIE QTI 2 player elements once (safe to call multiple times)

```ts
import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';

await loadPieQtiPlayerElements();
// At this point the register module was imported and we waited for:
// - <pie-qti2-item-player>
// - <pie-qti2-assessment-player>
```

### Using in React (example)

```ts
import { useEffect } from 'react';
import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';

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
