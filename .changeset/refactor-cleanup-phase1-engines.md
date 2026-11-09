---
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
---

Dead-code removal (cleanup phase 1). No QTI-observable behaviour changes: response values, scoring, session lifecycle, feedback and rendering are untouched.

**Breaking: removed exports** (beta prerelease; migrate away from them before upgrading):

- `@pie-qti/item-player` root and extraction exports `isSuccessResult` / `isErrorResult` are gone. Nothing inside the repo or docs used them; narrow the `ExtractionResult` discriminated union directly (`if (result.success) …`).
- `@pie-qti/item-player` web-components entry no longer exports `QTIReadyEvent`, `QTIErrorEvent`, `QTISelectionChangeEvent` (nor `QTIErrorEventDetail` / `QTISelectionChangeEventDetail`). None of these events was ever dispatched by any component or player; listen to `qti-change` instead, which is the event the components actually emit.
- `@pie-qti/item-player` no longer exports the types `InteractionType`, `OutcomeDeclaration`, `InteractionResponse` and `InteractionContext` from its root. `InteractionType` was a `string` alias; the other three were unused engine-internal shapes. `VariableDeclaration`, `ResponseDeclaration`, `Mapping`, `MapEntry`, `AreaMapping`, `AreaMapEntry` and the session state/serialization types are unchanged.
- `@pie-qti/default-components` no longer exports `isSourcePaired` / `isTargetPaired` from its root (unused pair-predicate helpers) and no longer exports `MIN_TARGET_PX` / `parseCoords` (they remain internal to the graphic-region helpers; their behaviour, which the graphic interactions rely on, is unchanged).

Also removed from `@pie-qti/item-player` (undocumented, unused): `Player.syncPciDisabledState`, `Player.getTrustedTypesPolicyName`, `Player.getExtractionRegistry`, `AssessmentItemDocument.detectVersion`, and `LiveItemSession`'s constructor no longer accepts a missing `prepared` argument — sessions are constructed through `AssessmentItemDefinition.openSession()`, which always supplies it.
