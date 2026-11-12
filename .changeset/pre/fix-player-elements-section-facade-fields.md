---
'@pie-qti/player-elements': patch
---

Bring the published facade's section data-model mirrors back in sync with `@pie-qti/section-player`'s contracts, where three fields had already drifted away (the mirrors narrowed the contracts, which no assignability pin could catch):

- `QtiSectionModel` gains `assessmentId` (the assessment the section belongs to; names the tool bars' toolkit assessment).
- `QtiSectionComposition` gains `assessmentId` (keys the candidate's session display settings) and `pnp` (the candidate's PNP a layout applies when it has none of its own).
- `QtiSectionRuntimeHost` gains `onDisplaySettingsChange`, the callback for the candidate changing display settings.
- `ResolveItemsForAssessmentOptions` gains `resourceResolver`, the shared bounded resolver option the runtime has always accepted.

All added fields are optional, so no consumer code changes. The facade is now pinned against this drift: a source-walking test (like the existing event-map drift test) requires every contract member of the section data model and the parsed-assessment types to appear on its facade mirror, and compile-time key pins fail the build when a mirror drops a field a contract defines.
