---
'@pie-qti/item-player': patch
'@pie-qti/transform-core': patch
'@pie-qti/transform-types': patch
'@pie-qti/to-pie': patch
---

Type the extension seams that were previously `any`:

- `@pie-qti/transform-types` now owns the vendor extension contracts (`VendorDetector`, `VendorTransformer`, `AssetResolver`, `CssClassExtractor`, `MetadataExtractor`, `VendorInfo`, `VendorClasses`, `CustomAttributes`, `VendorExtensionHooks`), so config-driven vendor modules are type-checked at the transform-core registry boundary instead of being cast through `any`. `@pie-qti/to-pie` re-exports the same names from its historical import path. `TransformContext.storage` is now typed as `StorageBackend` (the interface already lived in transform-types). `@pie-qti/transform-core` no longer re-exports its orchestration-internal `VendorInfo` variant, which was ambiguous next to the canonical contract.
- `@pie-qti/item-player`'s definition config extension points are now typed: `elementNameMapper`/`attributeNameMapper` (`@pie-qti/qti-common` mapper types), `componentRegistry`/`extractionRegistry` (the publicly exported registry classes), and `i18nProvider` (`@pie-qti/i18n`). Code that passed arbitrary objects to these options will now fail typecheck; pass the documented types instead.
