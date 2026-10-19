---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

`interpolationTable` is a step lookup per QTI: the first entry in document order whose `sourceValue` the source exceeds, or equals unless `includeBoundary="false"`, else `defaultValue`, else NULL. Lookup results and `defaultValue` take the outcome's base type, `interpolationMethod` is gone, and `qti-match-table` and `qti-interpolation-table` build.
