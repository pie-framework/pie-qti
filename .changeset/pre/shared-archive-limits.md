---
'@pie-qti/ims-cp-browser': patch
'@pie-qti/ims-cp-core': patch
'@pie-qti/ims-cp-node': patch
---

Converge the zip-extraction safety policy into `@pie-qti/ims-cp-core` (new `./archive-limits` subpath and root exports: `ArchiveExtractionLimits`, `DEFAULT_ARCHIVE_EXTRACTION_LIMITS`, `resolveArchiveLimit`, `exceedsCompressionRatio`). The identical guardrail constants (100 MB compressed / 250 MB uncompressed / 1000 entries / compression-ratio 200), limit validation, and ratio math were copy-pasted across the jszip (browser), unzipper (node), and adm-zip (storage) engines and could drift independently; all three now share the one authority. Engine-specific checks (per-entry size sanity, symlink guards, per-file size limits) remain with each engine. `@pie-qti/storage` gains a dependency on `@pie-qti/ims-cp-core` for the shared policy.
