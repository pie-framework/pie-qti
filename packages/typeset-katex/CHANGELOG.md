# @pie-qti/typeset-katex

## 1.0.0-beta.5

### Patch Changes

- 1f1d8f0: Two robustness fixes in `typesetMathInElement`. A failed KaTeX chunk load no longer poisons the page: the rejected import promise is dropped and the next typeset pass retries, instead of every later call failing with no recovery. And the `katex-ignore-editor` exclusion class is now removed in a `finally` block — previously a `renderMathInElement` throw (possible on unexpected DOM shapes despite `throwOnError: false`) left the class on every editable region, permanently excluding all editors from future typesetting and silently stopping math rendering for the rest of the session.
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

### Patch Changes

- bb30306: Declare the `./css` entry as a side effect. The `@pie-qti/typeset-katex/css` export exists solely to pull in `katex/dist/katex.min.css`, but the package previously declared `"sideEffects": false`, licensing bundlers to tree-shake away the very module the export provides. CSS imported through `@pie-qti/typeset-katex/css` is now preserved.

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

### Patch Changes

- 76311bb: Update the third-party runtime dependencies that ship to consumers.

  **`node-html-parser` moves from `^6.1.13`/`^7.0.x` to `^9.0.1`.** This affects
  `transform-core`, `to-pie`, `item-player`, `test-utils`, `demo-vendor-extensions`,
  `assessment-player`, `ims-cp-core`, `pie-to-qti2` and `transform-cli`.

  Worth knowing if you resolve `node-html-parser` yourself: five of those packages name it in
  their published type declarations rather than wrapping it — `transform-core`, `to-pie`,
  `item-player`, `test-utils` and `demo-vendor-extensions` all emit
  `import type { HTMLElement } from 'node-html-parser'` into their `.d.ts`, so the parser's
  own types are part of their public surface and this jump crosses three majors.

  If you exchange parsed elements with those packages, move to `9.x`. Pinning an older major
  leaves two copies of `HTMLElement` in the type graph, and structurally incompatible ones
  will not assign to each other. Consumers that only pass QTI strings in and take converted
  output back out are unaffected.

  **`katex` moves from `^0.16.27` to `^0.18.1`** in `typeset-katex`, **`mathlive` from
  `^0.108.2` to `^0.110.0`** in `item-player` and `default-components`, and
  **`@tiptap/core` from `^3.15.3` to `^3.29.2`** in `default-components`. None of these
  appear in published declarations. Applications that load their own copy of KaTeX or
  MathLive alongside ours should still check the pairing, since both ship stylesheets and
  fonts.

  All publishable packages release as one fixed-version set, so the whole set moves together.

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

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
