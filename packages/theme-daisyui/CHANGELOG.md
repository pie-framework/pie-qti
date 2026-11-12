# @pie-qti/theme-daisyui

## 1.0.0-beta.5

### Patch Changes

- 2f43e0e: Follow-ups to the media, extended text and theme fixes: typable negative answers on phones, inline video on iOS, a PNP spell-check grant, validated PNP colours, and state text contrast on tinted DaisyUI themes.
  
  **Text entry and extended text (numeric keyboards)**
  
  - A numeric virtual keyboard (`inputmode="numeric"`/`"decimal"`) is now requested only when the authored `patternMask` provably excludes `-` (for example `^[0-9]+$`): phone number pads have no minus key (nor an exponent), so a candidate with a negative answer could not have typed it. Every other numeric response keeps the default text keyboard, in both the inline text entry and the extended text interaction.
  - The candidate's PNP spell-check grant (AfA PNP 3.0 `spell-checker-on-screen`, parsed into `cognitive.spellChecker`) now enables spell check and autocorrect in the extended text interaction, like the `spellcheck` prop does; the item body passes the profile to every interaction as the `pnp` prop.
  
  **Media (`pie-qti-media`)**
  
  - Video is always rendered `playsinline` (plus `webkit-playsinline` for pre-iOS-10 WebViews), so iOS playback stays in the page instead of taking over the display in fullscreen and hiding the question. Under a play limit the component still offers no fullscreen control; without a limit the native controls may offer one, which cannot break `maxPlays` enforcement (play events still fire in the page).
  
  **PNP application**
  
  - Colours in the JSON PNP profile (`display.invertPolarity` foreground/background, `display.textAppearance` `fontColor`/`backgroundColor`) are validated with `CSS.supports('color', …)` before being applied; an invalid colour is ignored with a console warning instead of wiping what the custom property styles (focus outlines, control borders). Environments without a CSS engine apply every value as before.
  
  **DaisyUI bridge (`@pie-qti/theme-daisyui`)**
  
  - Message/state text tokens (`--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text`) now clear 4.5:1 against the base surfaces of every stock DaisyUI theme in current browsers: in the relative-colour tier each fixed value is darkened (light themes) or lightened (dark themes) in linear light just far enough, and values that already pass (the amber warning text) are kept. Engines without relative colour syntax keep the fixed values, which hold on neutral surfaces only. The JavaScript mapping mirrors the tier.
  
  **i18n**
  
  - Removed the unused `interactions.extendedText` math-dialog keys left behind by the MathLive rework (`insertMath`, `enterMathExpression`, `latexSource`, `keyboard`, `update`, `insert`) and the unused `interactions.media.remaining`, in all eight locales.
- 643ae6c: Keep focus indicators and text on fills readable in every stock DaisyUI theme, and keep PNP custom colours readable.
  
  **DaisyUI bridge, focus indicator**: `--pie-qti-focus` was DaisyUI's primary, which is below 3:1 against the page in 12 of the 35 stock themes (cupcake: 1.25:1), leaving focus rings invisible. In engines with relative colour syntax and `light-dark()`, the bridge now keeps the primary wherever it is already distinguishable and otherwise darkens (light themes) or lightens (dark themes) it in linear light just far enough: luminance at most 0.175 in light themes, at least 0.25 in dark themes, which clears 3:1 on every stock theme's `base-100` and `base-200` (lowest 3.10:1). Engines with only `color-mix()` get 45% primary mixed with `base-content` (lowest 3.09:1). Hosts can still set `--pie-qti-focus` themselves.
  
  **DaisyUI bridge, text on fills**: every `--pie-qti-*-content` is now black or white, whichever contrasts more with its fill (at least 4.58:1 for any colour; lowest stock pair 4.66:1), instead of DaisyUI's `*-content`, which falls below 4.5:1 in 40 of the 280 stock fill pairs (light theme `secondary-content`: 3.04:1). Engines without relative colour syntax keep DaisyUI's colours. `applyDaisyThemeToElement` and the mapping helpers choose the same tier with `CSS.supports()` and accept `{ supports }` to choose one explicitly.
  
  **PNP custom colours**: with a candidate's own text or background colour (text appearance), the message/state text, `--pie-qti-border-strong`, and `--pie-qti-focus` tokens now draw in the text colour (the candidate's, or the theme's when only a background is set) instead of theme colours that were only checked against the theme's surfaces, and the background colour also covers `--pie-qti-base-200` surfaces.
- 51e70e8: Make the theme token contract meet WCAG 2.2 AA contrast, and keep authored MathML native.
  
  **New theme tokens** (`@pie-qti/theme/tokens.css`, light and dark):
  
  - Message/state text on base surfaces: `--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text` (at least 4.5:1 on `--pie-qti-base-100` and `--pie-qti-base-200`). Use these for feedback and status text instead of the state fills (`--pie-qti-error`, ...), which are background colours and reach only 1.8:1 to 2.9:1 as text on white.
  - `--pie-qti-border-strong` for control boundaries and non-text cues (at least 3:1, WCAG 1.4.11); `--pie-qti-focus` is now guaranteed at least 3:1 as well.
  - Typography, spacing, and shape tokens: `--pie-qti-font-family` (`inherit`), `--pie-qti-font-size-base`, `--pie-qti-line-height`, `--pie-qti-radius`, `--pie-qti-radius-sm`, `--pie-qti-space-1` to `--pie-qti-space-6`, and `--pie-qti-control-min-size` (2.75rem).
  
  The light-theme `--pie-qti-error-content` and `--pie-qti-secondary-content` (2.7:1 and 3.45:1 on their fills) and the dark-theme `--pie-qti-error-content` are now dark text on those fills, so every `*-content` colour reaches 4.5:1. A contrast test now enforces these guarantees for both palettes; see the `@pie-qti/theme` README for the full token guide.
  
  **DaisyUI bridge**: the new text and border tokens keep the accessible `@pie-qti/theme` values (chosen per `color-scheme` with `light-dark()`) rather than DaisyUI's info/success/warning/error fills, which fail as text; `--pie-qti-radius` and `--pie-qti-radius-sm` follow DaisyUI's `--radius-box` and `--radius-field`. Contrast is verified for DaisyUI's `light` and `dark` themes.
  
  **Default components**: interaction styles draw select, textarea, and file-input borders with `--pie-qti-border-strong`, state text (`.text-success`, plus new `.text-error`, `.text-warning`, `.text-info`) and correctness outlines with the `*-text` tokens, and every shadow root gets an opaque 2px `--pie-qti-focus` outline on `:focus-visible`. `qti-well` follows the theme instead of a fixed light grey (which was unreadable in dark themes). PNP colour schemes now also redraw the new text and border tokens, and PNP text appearance feeds the new font tokens.
  
  **KaTeX typesetter (behaviour change)**: `typesetMathInElement` no longer converts authored `<math>` to LaTeX. The converter handled only a dozen elements, fell back to bare text for the rest (`mtext`, `munderover`, `mtable`, ...), and dropped `alttext`, losing meaning for sighted and assistive-technology users. Authored MathML now stays native (MathML Core renders in evergreen browsers) with its `alttext` intact; prefixed MathML such as `<m:math>` is re-created as real MathML elements and `<mfenced>`, which MathML Core does not render, is expanded into its MathML 3 equivalent. LaTeX delimiters in text are typeset as before, never inside `<math>`.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 1.0.0-beta.4

No changes in this release.

## 1.0.0-beta.3

No changes in this release.

## 1.0.0-beta.2

No changes in this release.

## 1.0.0-beta.1

No changes in this release.

## 1.0.0-beta.0

No changes in this release.

## 0.1.28

No changes in this release.

## 0.1.27

No changes in this release.

## 0.1.26

No changes in this release.

## 0.1.25

No changes in this release.

## 0.1.24

## 0.1.23

## 0.1.22

## 0.1.21

## 0.1.20

## 0.1.19

## 0.1.18

## 0.1.17

## 0.1.16

### Patch Changes

- 5a4e39a: Normalize `repository.url` to the `git+https://` form.

  npm was rewriting this field at publish time and warning about it:

  ```
  npm warn publish "repository.url" was normalized to "git+https://github.com/pie-framework/pie-qti.git"
  ```

  Beyond silencing that warning, npm requires `repository.url` to match the GitHub
  repository exactly when generating provenance attestations, so this is a prerequisite
  for moving publishing to trusted publishing (OIDC). No runtime or API change.

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.12

### Patch Changes

- abe0be5: Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

  `loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

  `@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.
