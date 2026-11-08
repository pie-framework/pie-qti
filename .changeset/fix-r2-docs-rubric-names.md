---
'@pie-qti/section-player': patch
---

Name each passage's collapse toggle for its own passage (WCAG 2.4.6/4.1.2). The icon-only
expand/collapse control previously announced "Expand passage"/"Collapse passage" for every
passage, so with several passages on screen a screen-reader user could not tell which passage a
toggle belonged to. The accessible name is now composed from the passage's heading (authored
title, or the neutral "Passage"/"Passage 2" label) plus the translated verb, e.g. "The Water
Cycle — Collapse passage"; the visible icon, `aria-expanded` and the existing i18n keys are
unchanged.
