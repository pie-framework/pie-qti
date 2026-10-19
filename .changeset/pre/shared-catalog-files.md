---
'@pie-qti/ims-cp-browser': patch
'@pie-qti/ims-cp-core': patch
'@pie-qti/item-player': patch
'@pie-qti/assessment-player': patch
'@pie-qti/player-elements': patch
---

Shared catalog files from the content package manifest (G-15, QTI 3.0 §6.3): `loadResolvedManifest` surfaces resources of type `imsqti_catalog_xmlv3p0` as `sharedCatalogs`; `createResolvedItemDeliveryContext` accepts `packageCatalogSources` and the reference backend adapter threads a host-supplied list (`parseAssessmentTestXml({ sharedCatalogs })`, exposed as `QtiAssessmentPlayerConfig.sharedCatalogs`) into every item's delivery context. The item player merges package-scope entries at the bottom, so an item-level `qti-catalog-info` wins a shared identifier and a shared file backs items that declare none.
