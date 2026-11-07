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

## What the bridge maps

| `--pie-qti-*` token | Source |
| ------------------- | ------ |
| Fills and their `*-content` colours, `base-100/200/300`, `base-content` | DaisyUI `--color-*` of the active theme |
| `--pie-qti-focus` | DaisyUI `--color-primary` |
| `--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text` | `@pie-qti/theme` defaults via `light-dark()`, **not** DaisyUI colours |
| `--pie-qti-border-strong` | `@pie-qti/theme` defaults via `light-dark()` |
| `--pie-qti-radius`, `--pie-qti-radius-sm` | DaisyUI `--radius-box`, `--radius-field` |

Message/state text is deliberately not mapped to DaisyUI's
info/success/warning/error colours: those are fills, and as text on white they
reach only 1.8:1 to 2.9:1 in DaisyUI's light theme. The bridge keeps the
accessible `@pie-qti/theme` defaults and picks the light or dark value from the
`color-scheme` that every DaisyUI theme declares. DaisyUI has no typography or
spacing equivalents, so those tokens keep their `@pie-qti/theme` defaults.

## Contrast guarantees

For DaisyUI's built-in `light` and `dark` themes (the demo's default themes),
`tests/bridge-contrast.test.ts` verifies:

- message/state text tokens and `--pie-qti-base-content`: ≥ 4.5:1 on
  `--pie-qti-base-100` and `--pie-qti-base-200`;
- `--pie-qti-border-strong` and `--pie-qti-focus` (with DaisyUI's primary and
  with the demo's PIE-branded primary): ≥ 3:1 on the same surfaces.

Fill and `*-content` pairs come from the DaisyUI theme unchanged and are only
as accessible as that theme. Other DaisyUI themes are not guaranteed: check
them before offering them to candidates.

## JavaScript helpers

JavaScript helpers are also available for hosts that need to read or apply
resolved DaisyUI variables imperatively:

```ts
import {
  applyDaisyThemeToElement,
  readDaisyThemeTokensFromElement,
} from '@pie-qti/theme-daisyui';
```

`applyDaisyThemeToElement` sets the same variables as `bridge.css`, including
the accessible message/state text and border tokens.
