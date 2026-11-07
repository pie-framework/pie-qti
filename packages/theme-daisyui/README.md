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
| Fills, `base-100/200/300`, `base-content` | DaisyUI `--color-*` of the active theme |
| `*-content` (text on a fill) | Black or white, whichever contrasts more with the fill; DaisyUI's `*-content` in engines without relative colour syntax |
| `--pie-qti-focus` | DaisyUI `--color-primary`, darkened or lightened only as far as 3:1 needs (see [Focus indicator](#focus-indicator)) |
| `--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text` | `@pie-qti/theme` defaults via `light-dark()`, **not** DaisyUI colours |
| `--pie-qti-border-strong` | `@pie-qti/theme` defaults via `light-dark()` |
| `--pie-qti-radius`, `--pie-qti-radius-sm` | DaisyUI `--radius-box`, `--radius-field` |

Message/state text is deliberately not mapped to DaisyUI's
info/success/warning/error colours: those are fills, and as text on white they
reach only 1.8:1 to 2.9:1 in DaisyUI's light theme. The bridge keeps the
accessible `@pie-qti/theme` defaults and picks the light or dark value from the
`color-scheme` that every DaisyUI theme declares. DaisyUI has no typography or
spacing equivalents, so those tokens keep their `@pie-qti/theme` defaults.

## Focus indicator

DaisyUI primaries are brand colours, not focus colours: in 12 of the 35 stock
themes the primary is below 3:1 against the page (cupcake: 1.25:1), so a focus
ring drawn in it would be invisible (WCAG 2.4.7, 1.4.11). The bridge derives
`--pie-qti-focus` from the primary in tiers, chosen with `@supports`:

1. **Relative colour syntax and `light-dark()`** (current Chrome, Edge,
   Firefox, and Safari): the primary itself wherever it already clears the
   bounds below, otherwise the same colour darkened (light themes) or
   lightened (dark themes) in linear light just far enough. Light themes cap
   its relative luminance at 0.175, which clears 3:1 on any surface of
   luminance 0.625 or more (about `#cfcfcf` or lighter); dark themes raise it
   to at least 0.25, which clears 3:1 on any surface of luminance 0.05 or less
   (about `#3f3f3f` or darker). 17 of the 35 stock primaries are kept as they
   are, including the stock `light` theme's and the demo's PIE orange in dark
   mode; the others become a darker or lighter shade of the same hue.
2. **`color-mix()` only** (for example Chrome 111–122, Firefox 113–127 and
   Safari 16.2–17): 45% primary mixed with the theme's `base-content`. This
   passes every stock theme too, but darkens or pales the brand colour in all
   of them.
3. **Neither**: the raw primary, without a guarantee.

The trade-off is brand fidelity for visibility: in themes whose primary is as
light as the page, the focus ring is a darker shade of the brand colour rather
than the brand colour itself. A host that prefers its own focus colour can set
`--pie-qti-focus` explicitly, on the player container or after the bridge, and
then owns its contrast:

```css
.my-player {
  --pie-qti-focus: #0b5cad; /* verified >= 3:1 on this host's surfaces */
}
```

## Contrast guarantees

`tests/bridge-contrast.test.ts` reads every stock theme from the installed
`daisyui` package and verifies, for all of them:

- `--pie-qti-focus`: ≥ 3:1 on `--pie-qti-base-100` and `--pie-qti-base-200`,
  in both the relative-colour and the `color-mix()` tier, also with the demo's
  PIE-branded primaries (lowest: 3.10:1 and 3.09:1);
- every `*-content` token: ≥ 4.5:1 on its fill in engines with relative colour
  syntax (lowest: 4.66:1). DaisyUI's own `*-content` colours fall below 4.5:1
  in 40 of the 280 stock fill pairs (light theme `secondary-content`: 3.04:1);
  hosts that prefer them can set the `*-content` tokens explicitly.

For DaisyUI's built-in `light` and `dark` themes it also verifies:

- message/state text tokens and `--pie-qti-base-content`: ≥ 4.5:1 on
  `--pie-qti-base-100` and `--pie-qti-base-200`;
- `--pie-qti-border-strong`: ≥ 3:1 on the same surfaces.

The message/state text colours are fixed light and dark values, so on tinted
surfaces of other stock themes they can fall short: `--pie-qti-success-text`
is below 4.5:1 in 15 tinted light themes (lowest: garden `base-200`, 3.33:1),
and `--pie-qti-error-text` and `--pie-qti-info-text` on aqua's `base-100` and
garden's `base-200`. Check those themes, or set the `*-text` tokens for them,
before offering them to candidates.

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
the accessible message/state text and border tokens. It picks the focus and
text-on-fill tier with `CSS.supports()`, using the stylesheet's own `@supports`
conditions; pass `{ supports }` to choose a tier explicitly.
