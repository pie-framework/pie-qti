---
'@pie-qti/ims-cp-browser': patch
'@pie-qti/ims-cp-core': patch
'@pie-qti/pie-to-qti2': patch
'@pie-qti/to-pie': patch
'@pie-qti/transform-types': patch
---

Packaging and back-compat shim removal (legacy audit PR 5, `docs/plans/legacy-audit-2026-11.md` rows A5, A6, A7). No QTI-observable behaviour changes for current-format content.

**Breaking: removed deprecated image-path helper** (beta prerelease; migrate before upgrading):

- `@pie-qti/ims-cp-browser` no longer exports `tryResolveImagePath`. It had been `@deprecated` since path resolution moved to `@pie-qti/ims-cp-core` and had no callers in the repo. Resolve package image references with `buildPackageFileIndex` and `resolvePackageReference` from `@pie-qti/ims-cp-core` (as `resolveImagesInXml` already does); the documented lenient path-resolution heuristics are unchanged.

**Breaking: removed the historical vendor-extension type path** (beta prerelease; migrate before upgrading):

- `@pie-qti/to-pie` no longer re-exports `VendorInfo`, `VendorDetector`, `VendorTransformer`, `ResolvedAsset`, `AssetResolver`, `VendorClasses`, `CssClassExtractor`, `MetadataExtractor`, `CustomAttributes` or `VendorExtensionHooks`; the `src/types/vendor-extensions.ts` shim that preserved the pre-move import path is gone. Import these types from `@pie-qti/transform-types`, where they live.

**Breaking: pre-rename extensions metadata is no longer read** (beta prerelease; migrate before upgrading):

- Packages exported while the PIE metadata bag was still named `searchMetaData` no longer import their extensions metadata: the `?? sourceModel.searchMetaData` fallbacks in `@pie-qti/ims-cp-core`'s `extractExtensionsFromQtiXml` and `@pie-qti/to-pie`'s `extractExtensions`, and the `pie:searchMetaData:` LOM source prefix in `@pie-qti/to-pie`'s `readPieResourceLom`, are gone; only `extensions` and the `pie:extension:` prefix are read. `@pie-qti/transform-types` no longer exports `PIE_LOM_LEGACY_EXTENSION_SOURCE`. The QTI package writer (`@pie-qti/pie-to-qti2`) only ever wrote the current forms, so content written by any current release is unaffected.
