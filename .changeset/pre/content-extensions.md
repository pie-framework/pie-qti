---
"@pie-qti/transform-types": minor
"@pie-qti/pie-to-qti2": minor
"@pie-qti/to-pie": minor
"@pie-qti/ims-cp-core": patch
---

The host-owned metadata bag on PIE items and passages is renamed from `searchMetaData` to `extensions` (typed `ContentExtensions`), and transformers and `MetadataExtractor` results write `extensions`. Package manifests carry it as LOM classifications with source `pie:extension:<key>` and no `purpose`; `PIE_LOM_SEARCH_METADATA_SOURCE` is replaced by `PIE_LOM_EXTENSION_SOURCE`. Import still reads the `pie:searchMetaData:` source and a legacy item's `searchMetaData`. In `@pie-qti/ims-cp-core`, `extractSearchMetadataFromQtiXml` is renamed `extractExtensionsFromQtiXml` and `QtiItemMetadata.searchMetadata` becomes `extensions`.
