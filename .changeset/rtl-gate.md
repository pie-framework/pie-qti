---
'@pie-qti/i18n': patch
'@pie-qti/default-components': patch
'@pie-qti/assessment-player': patch
'@pie-qti/section-player': patch
---

Add `pseudoLocalize` with the `en-XA` and `ar-XB` pseudo-locales, and a physical-direction CSS check in `check:i18n`. Interaction and chrome markup that still used `ml-*`, `mr-*` and `right-*` utilities now uses their logical forms, so it mirrors under right-to-left locales.
