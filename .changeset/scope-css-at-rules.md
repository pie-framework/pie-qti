---
'@pie-qti/item-player': patch
---

Scope QTI stylesheets with an at-rule-aware walker, so `@media` conditions are no longer dropped.

`scopeCssRules` matched rules with `([^{}@]+)\{([^{}]*)\}`. Excluding `@` from the selector
pattern kept the scope from being glued onto an at-rule, but it did not make the walker
understand at-rules, and the failure that remained is worse than a visibly broken selector.

An `@media` block never matched as a unit, so its inner rules matched on their own and were
emitted **without the condition**. A `@media print` rule therefore applied on screen as well,
and a narrow-viewport rule applied at every width — valid CSS that silently renders in the
wrong places, which is harder to notice than a rule that fails outright. `@supports` behaved
the same way. `@keyframes spin { 0% { … } }` had its percentage selectors scoped into
`[scope] 0%` and lost the animation name, so the animation could not run, and `@font-face`
became `[scope] font-face`.

Scoping now walks the stylesheet brace-by-brace:

- `@media`, `@supports`, `@container`, `@layer` and `@scope` keep their prelude and have
  their inner rules scoped, recursively.
- `@font-face`, `@keyframes` (including vendor-prefixed), `@page`, `@property` and
  `@counter-style` pass through untouched, as do at-rules the walker does not recognise.
- Parsing is string- and paren-aware, so a `{` inside `content: "{"` does not end a block and
  a `,` inside `:is(a, b)` does not split a selector list. Comment stripping is string-aware
  too, so a literal `content: "/*"` survives where the previous regex strip corrupted it.
- Style-rule blocks are emitted verbatim, which is what native CSS nesting needs: nested
  selectors are relative to a parent that has already been scoped.

`:root`, `html` and `body` are still replaced by the scope selector rather than prefixed, and
now preserve whatever followed them — `html.dark .a` becomes `[scope].dark .a` instead of
discarding the `.dark` compound.

One deliberate behaviour change beyond at-rules: **a leading pseudo is now scoped as a
descendant rather than attached.** `:is(.a, .b) .c` becomes `[scope] :is(.a, .b) .c`, not
`[scope]:is(.a, .b) .c`. The authored selector means "some element matching `.a` or `.b`", so
attaching it required the item body itself to carry the authored class, which it does not.
The same applies to `:hover` and `::selection`.

**This both adds and removes rendering.** At-rules have never applied correctly, so some
styles start applying — but `@media` rules that currently apply unconditionally will now
apply only behind their real condition, so styles that render today may stop. That is the
fix, and it is worth eyeballing against real content: a print stylesheet that appeared to
work on screen was never meant to.

Flat selector rules scope exactly as before, and `isBlockedStylesheetCss` still rejects any
stylesheet containing `url(` or `@import` before scoping runs, so `@font-face` with a real
`src` never reaches this path in practice.
