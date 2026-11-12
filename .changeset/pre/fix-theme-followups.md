---
'@pie-qti/theme-daisyui': patch
'@pie-qti/default-components': patch
'@pie-qti/web-component-loaders': patch
---

Keep focus indicators and text on fills readable in every stock DaisyUI theme, and keep PNP custom colours readable.

**DaisyUI bridge, focus indicator**: `--pie-qti-focus` was DaisyUI's primary, which is below 3:1 against the page in 12 of the 35 stock themes (cupcake: 1.25:1), leaving focus rings invisible. In engines with relative colour syntax and `light-dark()`, the bridge now keeps the primary wherever it is already distinguishable and otherwise darkens (light themes) or lightens (dark themes) it in linear light just far enough: luminance at most 0.175 in light themes, at least 0.25 in dark themes, which clears 3:1 on every stock theme's `base-100` and `base-200` (lowest 3.10:1). Engines with only `color-mix()` get 45% primary mixed with `base-content` (lowest 3.09:1). Hosts can still set `--pie-qti-focus` themselves.

**DaisyUI bridge, text on fills**: every `--pie-qti-*-content` is now black or white, whichever contrasts more with its fill (at least 4.58:1 for any colour; lowest stock pair 4.66:1), instead of DaisyUI's `*-content`, which falls below 4.5:1 in 40 of the 280 stock fill pairs (light theme `secondary-content`: 3.04:1). Engines without relative colour syntax keep DaisyUI's colours. `applyDaisyThemeToElement` and the mapping helpers choose the same tier with `CSS.supports()` and accept `{ supports }` to choose one explicitly.

**PNP custom colours**: with a candidate's own text or background colour (text appearance), the message/state text, `--pie-qti-border-strong`, and `--pie-qti-focus` tokens now draw in the text colour (the candidate's, or the theme's when only a background is set) instead of theme colours that were only checked against the theme's surfaces, and the background colour also covers `--pie-qti-base-200` surfaces.
