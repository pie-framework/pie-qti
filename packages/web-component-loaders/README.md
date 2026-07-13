# `@pie-qti/web-component-loaders`

Shared, **idempotent client-side loaders** for PIE QTI web components, intended to be reused across apps.

This package provides small helper functions that:

- **Only run in the browser** (no-op during SSR / Node)
- **Dedupe** loads across multiple calls (the underlying dynamic `import()` runs once per page)
- Optionally **wait until custom elements are defined** before continuing

## Install

The loader installs its complete browser runtime through `@pie-qti/player-elements`; applications
do not install or import Svelte or `@pie-qti/default-components` themselves:

```bash
npm install @pie-qti/web-component-loaders
```

## CSS

Import the default browser runtime stylesheet once from your host app:

```ts
import '@pie-qti/web-component-loaders/default-runtime.css';
```

This self-contained export composes the QTI DaisyUI theme bridge and QTI shared vocabulary
stylesheet; no CSS peer package is required.

## Usage

### Load PIE QTI player elements once (safe to call multiple times)

```ts
import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';
import '@pie-qti/web-component-loaders/default-runtime.css';

await loadPieQtiPlayerElements();
// At this point the register module was imported and we waited for:
// - <pie-qti-item-player>
// - <pie-qti-assessment-player>
// - <pie-qti-section-player-splitpane>
// - <pie-qti-section-player-vertical>
// - the bundled default QTI interaction elements, including
//   <pie-qti-portable-custom> for QTI Portable Custom Interactions
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
- **Runtime ownership**: `@pie-qti/player-elements/register` owns both player and default interaction
  registration; the loader does not import implementation packages separately.
