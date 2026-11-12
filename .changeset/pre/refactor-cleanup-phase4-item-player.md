---
'@pie-qti/item-player': patch
'@pie-qti/qti-processing': patch
'@pie-qti/default-components': patch
---

Phase 4 (item-player) of the player cleanup: remove duplication with no QTI-observable change.

- `@pie-qti/item-player`: one `escapeHtmlAttribute` (exported from the `security` subpath), one clone/freeze family (`cloneValue`, `deepFreezeInPlace`, `frozenSnapshot`), one `mergeDeliveryFields`, one name-mapper resolution (`resolveNameMappers`, `elementNameMapperForVersion`, `attributeNameMapperForVersion`, `defaultExtractionMappers`), shared PCI `resolvePciModuleUrl`/`pciEntryModule`, one `readResponseIdentifier` response-binding lookup behind interaction detection, slot hiding and diagnostics, and root exports for `patternExcludesMinus`/`classExcludesMinus`. All additions; no export moved or disappeared.
- `@pie-qti/qti-processing`: adds `parseMatchTableDeclaration`/`parseInterpolationTableDeclaration` (the outcome-declaration lookup-table parser with a required name mapper; values stay lexical, `lookupOutcomeValue` still coerces).
- `@pie-qti/default-components`: the extended-text keyboard now imports `patternExcludesMinus` from `@pie-qti/item-player` instead of keeping its own copy.
