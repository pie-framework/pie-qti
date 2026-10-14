---
'@pie-qti/qti-common': patch
'@pie-qti/pie-to-qti2': patch
'@pie-qti/to-pie': patch
---

Add a QTI 3.0 export: `targetVersion: '3.0'` on `PieToQtiPlugin` writes QTI 3.0 items, stimuli, tests and content packages, with catalogs as `qti-catalog-info`. `@pie-qti/qti-common` gains `convertQti2ToQti3` and `writeQtiCatalogInfo`; `@pie-qti/to-pie` reads the export back, unwrapping `qti-content-body` and resolving a stimulus reference by its PIE passage id.
