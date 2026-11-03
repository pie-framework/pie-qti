---
'@pie-qti/assessment-player': patch
'@pie-qti/core': patch
'@pie-qti/item-player': patch
---

Close the remaining `any`-typed public seams (type-only changes, no runtime behavior change):

- `@pie-qti/item-player`: the player config's `i18nProvider` and `getI18nProvider()` are now typed as `I18nProvider` instead of `any`, so consumers get real checking on the provider contract.
- `@pie-qti/assessment-player`: `AssessmentRubricBlock.view` models QTI's `view` attribute as `string[]` (it is an arbitrary token list; role semantics live in the toolkit/section-player filtering layer). This removes the `as any[]` casts at both parse sites.
- `@pie-qti/core`: vendor-extension plugin hooks (`registerVendorDetector`, `registerVendorTransformer`, `registerAssetResolver`, `registerCssClassExtractor`, `registerMetadataExtractor`) take `unknown` instead of `any` — the registry is generic plumbing and can no longer silently widen host plugin objects; the five `as any` call-site casts are gone.
