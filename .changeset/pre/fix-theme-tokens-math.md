---
'@pie-qti/theme': patch
'@pie-qti/theme-daisyui': patch
'@pie-qti/default-components': patch
'@pie-qti/typeset-katex': patch
'@pie-qti/web-component-loaders': patch
---

Make the theme token contract meet WCAG 2.2 AA contrast, and keep authored MathML native.

**New theme tokens** (`@pie-qti/theme/tokens.css`, light and dark):

- Message/state text on base surfaces: `--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text` (at least 4.5:1 on `--pie-qti-base-100` and `--pie-qti-base-200`). Use these for feedback and status text instead of the state fills (`--pie-qti-error`, ...), which are background colours and reach only 1.8:1 to 2.9:1 as text on white.
- `--pie-qti-border-strong` for control boundaries and non-text cues (at least 3:1, WCAG 1.4.11); `--pie-qti-focus` is now guaranteed at least 3:1 as well.
- Typography, spacing, and shape tokens: `--pie-qti-font-family` (`inherit`), `--pie-qti-font-size-base`, `--pie-qti-line-height`, `--pie-qti-radius`, `--pie-qti-radius-sm`, `--pie-qti-space-1` to `--pie-qti-space-6`, and `--pie-qti-control-min-size` (2.75rem).

The light-theme `--pie-qti-error-content` and `--pie-qti-secondary-content` (2.7:1 and 3.45:1 on their fills) and the dark-theme `--pie-qti-error-content` are now dark text on those fills, so every `*-content` colour reaches 4.5:1. A contrast test now enforces these guarantees for both palettes; see the `@pie-qti/theme` README for the full token guide.

**DaisyUI bridge**: the new text and border tokens keep the accessible `@pie-qti/theme` values (chosen per `color-scheme` with `light-dark()`) rather than DaisyUI's info/success/warning/error fills, which fail as text; `--pie-qti-radius` and `--pie-qti-radius-sm` follow DaisyUI's `--radius-box` and `--radius-field`. Contrast is verified for DaisyUI's `light` and `dark` themes.

**Default components**: interaction styles draw select, textarea, and file-input borders with `--pie-qti-border-strong`, state text (`.text-success`, plus new `.text-error`, `.text-warning`, `.text-info`) and correctness outlines with the `*-text` tokens, and every shadow root gets an opaque 2px `--pie-qti-focus` outline on `:focus-visible`. `qti-well` follows the theme instead of a fixed light grey (which was unreadable in dark themes). PNP colour schemes now also redraw the new text and border tokens, and PNP text appearance feeds the new font tokens.

**KaTeX typesetter (behaviour change)**: `typesetMathInElement` no longer converts authored `<math>` to LaTeX. The converter handled only a dozen elements, fell back to bare text for the rest (`mtext`, `munderover`, `mtable`, ...), and dropped `alttext`, losing meaning for sighted and assistive-technology users. Authored MathML now stays native (MathML Core renders in evergreen browsers) with its `alttext` intact; prefixed MathML such as `<m:math>` is re-created as real MathML elements and `<mfenced>`, which MathML Core does not render, is expanded into its MathML 3 equivalent. LaTeX delimiters in text are typeset as before, never inside `<math>`.
