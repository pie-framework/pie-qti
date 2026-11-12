---
'@pie-qti/ims-cp-core': patch
'@pie-qti/to-pie': patch
---

One passage-reusability module instead of two drifted copies: `packages/to-pie`'s `src/utils/passage-reusability.ts` is deleted and `@pie-qti/to-pie` now consumes `@pie-qti/ims-cp-core`. The shared ID strategy can be generated synchronously: `createStablePassageIdGenerator(hashContent)` builds a sync generator from an injected content hash (to-pie uses Node's `createHash('sha256')`), while `generateStablePassageId` stays async on the shared Web Crypto/Node `sha256`. The ID values are unchanged for every strategy.

**Breaking: `parseObjectReference` is sync and strict about untyped objects** (beta prerelease). It is no longer `async`, and an `<object>` without a `type` attribute is a passage only when its `data` file looks like a markup document (`.html`, `.xhtml`, `.xml`); other untyped objects — figures, media, any asset — are no longer reported as passages. Hosts that relied on ims-cp-core's previous any-untyped-object reading, or on awaiting `parseObjectReference`, must adapt; `await` on the sync return value keeps working for the call itself.
