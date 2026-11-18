---
'@pie-qti/to-pie': patch
'@pie-qti/ims-cp-core': patch
---

Breaking: QTI from pie-to-qti2 releases before the source sidecar no longer round-trips its PIE data. The inline `pie:sourceModel` and the item's `qti-metadata` fields are not read, so such items convert from their QTI body like any other QTI, and `baseId` and `extensions` come from manifest LOM only. `hasPieExtension`, `extractPieExtension`, `PIE_NAMESPACE` and `PIE_PREFIX` are removed from `@pie-qti/to-pie`; `extractExtensionsFromQtiXml` and the `extensions` field of `QtiItemMetadata` are removed from `@pie-qti/ims-cp-core`.
