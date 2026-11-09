---
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
---

Dead-code and legacy-code removal (cleanup phase 1). Spec-conformant content behaves exactly as before: response values, scoring, session lifecycle, feedback and rendering are untouched. Only input outside the QTI and PCI bindings narrows; see "Breaking: legacy API and input forms removed" below.

**Breaking: removed exports** (beta prerelease; migrate away from them before upgrading):

- `@pie-qti/item-player` root and extraction exports `isSuccessResult` / `isErrorResult` are gone. Nothing inside the repo or docs used them; narrow the `ExtractionResult` discriminated union directly (`if (result.success) …`).
- `@pie-qti/item-player` web-components entry no longer exports `QTIReadyEvent`, `QTIErrorEvent`, `QTISelectionChangeEvent` (nor `QTIErrorEventDetail` / `QTISelectionChangeEventDetail`). None of these events was ever dispatched by any component or player; listen to `qti-change` instead, which is the event the components actually emit.
- `@pie-qti/item-player` no longer exports the types `InteractionType`, `OutcomeDeclaration`, `InteractionResponse` and `InteractionContext` from its root. `InteractionType` was a `string` alias; the other three were unused engine-internal shapes. `VariableDeclaration`, `ResponseDeclaration`, `Mapping`, `MapEntry`, `AreaMapping`, `AreaMapEntry` and the session state/serialization types are unchanged.
- `@pie-qti/default-components` no longer exports `isSourcePaired` / `isTargetPaired` from its root (unused pair-predicate helpers) and no longer exports `MIN_TARGET_PX` / `parseCoords` (they remain internal to the graphic-region helpers; their behaviour, which the graphic interactions rely on, is unchanged).

Also removed from `@pie-qti/item-player` (undocumented, unused): `Player.syncPciDisabledState`, `Player.getTrustedTypesPolicyName`, `Player.getExtractionRegistry`, `AssessmentItemDocument.detectVersion`, and the `PciHost` constructor's undocumented `string` options overload — pass `PciHostOptions` (`{ baseUrl }`) instead; every in-repo caller already does. `LiveItemSession`'s constructor no longer accepts a missing `prepared` argument — sessions are constructed through `AssessmentItemDefinition.openSession()`, which always supplies it.

**Breaking: legacy API and input forms removed** (the project is pre-1.0 and keeps no compatibility paths for its own earlier APIs or formats):

- `@pie-qti/default-components` choice interaction (`pie-qti-choice`): the `structuredLabelSupport` prop is gone. It had no effect: the choice set is always one group named by its prompt (a localized generic name without one; an authored accessible name still wins). Hosts that set it on the element can drop it. `pnp.display.structuredLabelSupport` is unchanged; it still reaches every block interaction through the presentation plan and switches the match interaction's group and column labels.
- `@pie-qti/default-components` select-point interaction (`pie-qti-select-point`): the `response` prop no longer reads `{ x, y }` objects, alone or in an array; such a value places no points. Pass the QTI point form, an `"x y"` string or an array of them, which is what the item player supplies.
- `@pie-qti/item-player` PCI variable JSON input (`fromQtiVariableJson`, so every PCI `getResponse()` answer): only the PCI v1.0 Appendix A binding is read. The earlier shapes now read as NULL: name-keyed records `{"record": {"<field>": …}}` (send an array of `{name, base | list}` members); pairs, directedPairs and points as `"A B"` strings (send two-element arrays); durations as numbers or non-ISO strings (send an ISO 8601 duration such as `"PT90S"`). One such member makes a whole list NULL, and a record member in such a shape reads as NULL. A PCI module still answering in those shapes stores no response, so it scores as unanswered until it moves to the spec binding. The writer (`toQtiVariableJson`), the state seeded at `getInstance`, and the player's runtime values are unchanged.
