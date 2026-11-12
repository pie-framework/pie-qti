---
'@pie-qti/qti-processing': patch
'@pie-qti/qti-common': patch
---

Compiled-pattern reuse on the hot path (no behavior change):

- `xsdPatternToRegExp` (qti-processing) translates and compiles an authored XSD pattern on every
  call, and `patternMatch`/`patternMask` validation runs per keystroke while authored patterns are
  static per item. Each (pattern, flags) pair is now compiled once and its `RegExp` shared
  through a bounded module-level memo (cleared past 512 entries, so a stream of distinct patterns
  cannot grow it without bound; cached `RegExp`s are stateful-free since no caller compiles with
  `g`/`y`). Failed compiles are cached too.
- Feedback rendering (qti-common `processFeedbackInline`/`feedbackInlineAttr`) built a fresh
  `RegExp` per attribute lookup per feedback element per keystroke; the matchers for an attribute
  name (both QTI spellings) are now compiled once and shared, through the same bounded-memo
  shape. `feedbackInlineAttr` is now exported from `@pie-qti/qti-common` so hosts and tests can
  use the same reader.
