---
'@pie-qti/assessment-player': patch
'@pie-qti/ims-cp-core': patch
'@pie-qti/player-elements': patch
---

Consolidate the assessment discovery pre-scan with the backend model's scan primitives.

`@pie-qti/assessment-player` now exports `toCanonicalQtiName` and `@pie-qti/ims-cp-core` exports `hasUnsafeEncodedPathToken`, and the player-elements discovery parser reuses both instead of private copies, so QTI 2.x/3.0 name mapping and encoded-path safety cannot drift between the element pre-pass and the authoritative parse. The discovery parser's role (bounded pre-fetch, early depth rejection) and its item-map keying contract with the backend are documented in code. `@pie-qti/player-elements` also moves `@pie-qti/assessment-player` to runtime dependencies to match its existing runtime import of `ReferenceBackendAdapter`.
