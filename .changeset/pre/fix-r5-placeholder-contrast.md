---
'@pie-qti/item-player': patch
---

The render-failed interaction placeholder (`qti-interaction-error`) strokes its border with the error *text* token (`--pie-qti-error-text`, ≈ 5.9:1 on white) instead of the error *fill* token (`--pie-qti-error`, ≈ 2.9:1 on white, below the 3:1 non-text contrast minimum of WCAG 1.4.11). The border is the only visual mark of where an interactive element is missing inside a live exam question, and the repo's own convention (documented on `ShadowBaseStyles`'s correctness indicators) reserves `*-text` tokens for non-text indicator strokes with fills as tinted backgrounds — the 8% error fill tint on the placeholder is unchanged. The mirrored player/baseline alert borders that share this weakness are untouched here and remain a follow-up.
