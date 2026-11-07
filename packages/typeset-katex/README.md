## `@pie-qti/typeset-katex`

Shared **KaTeX-based** math typesetting adapter for PIE QTI players.

### Why this package exists

`@pie-qti/item-player` (and the assessment player) intentionally **do not bundle a math engine** (KaTeX/MathJax).  
Instead, they accept a host-provided `typeset(element)` function and apply it consistently to item content.

This package provides a ready-to-use **KaTeX implementation** of that `typeset` function, so host apps don’t need to copy/paste it.

### What it does

- **Typesets LaTeX delimiters** in text using KaTeX auto-render:
  - Inline: `\\( ... \\)`
  - Display: `\\[ ... \\]` and `$$ ... $$`
- Optionally supports single-dollar inline math `$...$` (off by default).
- **Leaves authored MathML native.** `<math>` content is never converted to LaTeX: browsers render
  MathML Core natively, and the authored structure and `alttext` reach sighted and
  assistive-technology users unchanged. LaTeX-looking text inside `<math>` is never typeset.
- Applies two lossless normalisations so authored MathML renders natively:
  - Prefixed MathML that the HTML parser cannot recognise (for example QTI 2.x
    `<m:math xmlns:m="…">`) is re-created as real MathML elements, keeping its attributes
    (including `alttext` and `display`).
  - `<mfenced>`, which MathML Core (and therefore Chromium) does not render, is expanded into
    its MathML 3 equivalent: an `<mrow>` with fence and separator `<mo>` elements.
- Avoids mutating editable content (`contenteditable="true"`) to prevent breaking editors.

Typesetting is idempotent, so it is safe to call repeatedly as content updates.

MathML Core does not cover every MathML 3 feature (for example `menclose` notations or most
`mathvariant` values); such content renders as the browser supports it rather than being
rewritten.

### Install (workspace)

In this monorepo you can depend on it as:

```json
{
  "dependencies": {
    "@pie-qti/typeset-katex": "workspace:*"
  }
}
```

### Usage with `@pie-qti/item-player`

1) Make sure KaTeX CSS is included in your app (required for proper rendering):

```ts
import '@pie-qti/typeset-katex/css';
```

2) Provide the typesetter to the player:

```ts
import { typesetMathInElement } from '@pie-qti/typeset-katex';

const typeset = (el: HTMLElement) => typesetMathInElement(el);
```

Then pass it into `ItemPlayer` / `AssessmentPlayer` (or any place that accepts the `typeset` hook).

### Configuration

`typesetMathInElement(root, options)` supports:

- **`enableSingleDollar`**: set to `true` to also render `$...$` inline math.  
  This is off by default because `$` is common in non-math text.

Example:

```ts
const typeset = (el: HTMLElement) =>
  typesetMathInElement(el, { enableSingleDollar: true });
```

### Should the player include this “by default”?

Usually **no**:

- Bundling KaTeX into the player would **increase bundle size** for host apps that:
  - don’t need math, or
  - prefer a different renderer (MathJax, MathLive, server-side render, etc.)

The low-friction approach is:

- keep the player’s contract: **`typeset?: (el) => void`**
- let host apps choose a renderer
- use this package as the default adapter in demos and host apps that want KaTeX


