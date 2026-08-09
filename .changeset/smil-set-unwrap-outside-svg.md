---
'@pie-qti/item-player': patch
---

Scope SMIL element removal to `<svg>` subtrees, so item HTML using those tag names keeps its text.

`ACTIVE_SVG_ELEMENTS` — `animate`, `animateColor`, `animateMotion`, `animateTransform`,
`discard`, `set` — was matched by tag name anywhere in the document, and matches were removed
along with their children. The policy exists because SMIL can mutate `href` and other
URL-bearing attributes after the static attribute pass, which is only true inside SVG.

Outside an `<svg>` subtree these are inert unknown elements, and `<set>` reaches real content:
ExamView-style QTI 2.1 exports wrap parts of a question stem in `<set bf="">`. Removing it
discarded the wrapped text, truncating a stem mid-sentence — a myPerspectives item asking
"Which evidence from paragraph 1 of Selection 1 **best** supports the inference that the
narrator enjoys playing outdoors?" rendered as "Which evidence from paragraph 1 of Selection 1".

These elements are now unwrapped outside SVG, preserving their sanitized children, which is
what non-QTI hyphenated elements already did — both paths now share one helper. Inside an
`<svg>` subtree they are still removed outright, so a `<set attributeName="href">` animation
cannot survive.
