---
'@pie-qti/transform-cli': patch
'@pie-qti/item-player': patch
---

Breaking: `batch-transform` no longer accepts the no-op `--load-passage-content` flag; drop it from scripts. The item player no longer warns when the `role` attribute carries a QTI role, so hosts select the view with `qti-role`.
