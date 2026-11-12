---
'@pie-qti/item-player': patch
---

Responses beyond the pattern subject cap skip `patternMask` validation instead of running authored regular expressions over huge subjects (the same divergence guard `@pie-qti/qti-processing` documents for `patternMatch`). A capped response passes unmasked; subjects at or under the cap are unchanged.
