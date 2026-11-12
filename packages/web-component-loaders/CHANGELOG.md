# @pie-qti/web-component-loaders

## 1.0.0-beta.5

### Patch Changes

- 1f1d8f0: `loadPieQtiPlayerElements` now clears its cached import promise when the dynamic import rejects, so a transient chunk failure (blocked network, stale-deploy 404) no longer breaks element loading for the rest of the page's lifetime — the next call retries, while concurrent calls still share one in-flight import.
  
  Breaking: the `DEFAULT_INTERACTION_TAGS` export is removed. It was a hand-copied list of the tags the register module defines, used only for a `customElements.whenDefined` wait — a drifted entry never settled and hung the loader forever. The register module registers every element synchronously during its import, so the loader now resolves once that import resolves and keeps no second inventory.
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
- Updated dependencies [4e5f1a8]
- Updated dependencies [080a35c]
- Updated dependencies [2fa635f]
- Updated dependencies [0a1c071]
- Updated dependencies [90bf9ab]
- Updated dependencies [0973689]
- Updated dependencies [3a17b4b]
- Updated dependencies [3a17b4b]
- Updated dependencies [3a17b4b]
- Updated dependencies [cfb78e2]
- Updated dependencies [372037e]
- Updated dependencies [9814c9b]
- Updated dependencies [333ee9a]
- Updated dependencies [c6ae98c]
- Updated dependencies [333ee9a]
- Updated dependencies [333ee9a]
- Updated dependencies [0a5cc0e]
- Updated dependencies [d6ac3bb]
- Updated dependencies [efcde5c]
- Updated dependencies [dc38e3b]
- Updated dependencies [2667df1]
- Updated dependencies [a1c989d]
- Updated dependencies [88b69c0]
- Updated dependencies [20e8e52]
- Updated dependencies [b8a2862]
- Updated dependencies [528974c]
- Updated dependencies [780653b]
- Updated dependencies [2916759]
- Updated dependencies [7cf746f]
- Updated dependencies [8d03d05]
- Updated dependencies [fa577a0]
- Updated dependencies [d3619a3]
- Updated dependencies [3b3927e]
- Updated dependencies
  - @pie-qti/player-elements@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [15ef671]
- Updated dependencies [25ae481]
- Updated dependencies [f8e4225]
  - @pie-qti/player-elements@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- @pie-qti/player-elements@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies [cf99206]
  - @pie-qti/player-elements@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- @pie-qti/player-elements@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- 6c209e2: AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
- Updated dependencies [0d99546]
- Updated dependencies [32c08b7]
- Updated dependencies [6c209e2]
- Updated dependencies [30b045d]
- Updated dependencies [833ddad]
- Updated dependencies [953e5d1]
- Updated dependencies [c785703]
- Updated dependencies [8063850]
  - @pie-qti/player-elements@1.0.0-beta.0

## 0.1.28

### Patch Changes

- @pie-qti/player-elements@0.1.28

## 0.1.27

### Patch Changes

- @pie-qti/player-elements@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [af8ee10]
  - @pie-qti/player-elements@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/player-elements@0.1.25

## 0.1.24

### Patch Changes

- Updated dependencies [080f254]
- Updated dependencies [67e4c23]
- Updated dependencies [10eba70]
  - @pie-qti/player-elements@0.1.24

## 0.1.23

### Patch Changes

- Updated dependencies [4df35b3]
  - @pie-qti/player-elements@0.1.23

## 0.1.22

### Patch Changes

- Updated dependencies [ba84656]
  - @pie-qti/player-elements@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/player-elements@0.1.21

## 0.1.20

### Patch Changes

- Updated dependencies [1cd0aff]
  - @pie-qti/player-elements@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/player-elements@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/player-elements@0.1.18

## 0.1.17

### Patch Changes

- @pie-qti/player-elements@0.1.17

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

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.
- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
  - @pie-qti/player-elements@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.15
  - @pie-qti/player-elements@0.1.15
  - @pie-qti/theme-daisyui@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
  - @pie-qti/player-elements@0.1.14
  - @pie-qti/default-components@0.1.14
  - @pie-qti/theme-daisyui@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.13
  - @pie-qti/player-elements@0.1.13
  - @pie-qti/theme-daisyui@0.1.13

## 0.1.12

### Patch Changes

- abe0be5: Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

  `loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

  `@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.

- Updated dependencies [abe0be5]
  - @pie-qti/default-components@0.1.12
  - @pie-qti/theme-daisyui@0.1.12
  - @pie-qti/player-elements@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/player-elements@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/player-elements@0.1.1
