---
'@pie-qti/item-player': patch
---

Match delivery drops the never-rendered `firstColumnHeader` (QTI 3.0 `data-first-column-header`).

The extractor read the attribute under a name no QTI version defines (`data-qti-first-column-header`), delivered it on `MatchInteractionData`, and nothing rendered it: this player's match interaction is not tabular, so the optional presentation attribute was dead delivery data. It is no longer extracted. A custom match component that wants the attribute can read it from the item XML the same way as any other presentation hint.
