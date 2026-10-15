---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/section-player': patch
---

Shared vocabulary classes, authored interaction aria and richer catalogs. `qti-shared-vocabulary.css` and the interactions honour the QTI 3 shared classes: choice labels and suffixes, writing orientation, `qti-choices-*` placement and `qti-unselected-hidden`. Every interaction takes its authored `aria-label`, `aria-labelledby` and `aria-describedby` through `interactionAria`, resolved to text at extraction (`BaseInteractionData.accessibility`). Catalog entries render multi-part content and media; object replacement keeps aria, role and `lang`. The section player's read-aloud takes native `qti-catalog-info` and APIP spoken cards and docks the SSML of passages.
