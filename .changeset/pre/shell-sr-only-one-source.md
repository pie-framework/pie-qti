---
'@pie-qti/assessment-player': patch
---

The shell's visually hidden elements now hide through one injected `.sr-only` rule (`srOnly.ts`, once per document, after the default-components `srOnly.ts` idiom) instead of two drifted per-component copies: `AccessibilityAnnouncer`'s live regions used physical properties with `clip: rect(0, 0, 0, 0)` while `AssessmentTimer`'s announcement regions used logical properties with `clip-path: inset(50%)`. Both now carry the canonical declarations default-components inject, so the computed hidden state is unchanged (1px, absolute, clipped — screen readers still reach the regions), and a host document loads at most one copy of the rule per package. One cascade consequence for theming hosts: a host stylesheet targeting `.sr-only` now reaches the shell's announcer and timer regions too (their scoped copies used to win), matching how every default-components `.sr-only` element already behaves.
