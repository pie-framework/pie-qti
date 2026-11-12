---
'@pie-qti/transform-types': major
---

Breaking: removed the storage types with no consumer or implementation anywhere in the repo — `Transaction`, `ZipExtractor`, `SessionStorage`, `Session`, `StreamOptions`, and the `ExtractionResult` used only by `ZipExtractor`. Alongside them, the `StorageBackend` members that existed only to reference those types are gone: `beginTransaction?()` (no backend implemented it, nothing called it) and the `options?: StreamOptions` parameter on `createReadStream`/`createWriteStream` (no caller ever passed options; the only implementation, `MockStorageBackend`, already ignored them).

`ResourceMetadata` stays: it looked unused, but `StorageBackend.getMetadata?()` returns it and core's read-content activity consumes that hook. `MockStorageBackend` and the engine/storage plumbing are unchanged.
