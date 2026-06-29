# @pie-qti/theme-daisyui

DaisyUI bridge for `@pie-qti/theme`.

Import the bridge once in a DaisyUI host app so the active DaisyUI theme feeds
the QTI player token contract:

```ts
import '@pie-qti/theme-daisyui/bridge.css';
```

The bridge maps DaisyUI v5 `--color-*` variables to canonical
`--pie-qti-*` variables. When the host changes `data-theme`, QTI components
inherit the new token values through normal CSS cascading.

JavaScript helpers are also available for hosts that need to read or apply
resolved DaisyUI variables imperatively:

```ts
import {
  applyDaisyThemeToElement,
  readDaisyThemeTokensFromElement,
} from '@pie-qti/theme-daisyui';
```
