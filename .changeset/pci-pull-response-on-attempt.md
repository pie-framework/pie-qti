---
'@pie-qti/item-player': patch
---

Ending, suspending or submitting an attempt now asks each mounted PCI for its current response first, so a module that answers through `getResponse()` without calling `ondone` after every change is scored and saved with the candidate's answer instead of null.
