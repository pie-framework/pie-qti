---
'@pie-qti/player-elements': minor
---

**Breaking: the facade's section contract types renamed to their `@pie-qti/section-player` contract names** (beta prerelease). The facade hand-copied several section-player contract types under different names while sibling types in the same contract files were published 1:1, so a host composing through both packages learned two names per concept. Renames (old → new):

- `QtiSectionRuntimeHost` → `QtiSectionRuntimeHostContract` (the same object the headless player's `config.sectionHost` takes)
- `QtiSectionResponseDeltaDetail` → `QtiSectionResponseDeltaEvent` (the `detail` type of the `qti-section-response-delta` event; the event name itself is unchanged)
- `QtiSectionComposition` → `ResolvedQtiSectionComposition`
- `QtiSectionSharedContext` → `QtiSharedContext`
- `QtiSectionResolvedStylesheetRef` → `QtiResolvedStylesheetRef`
- `QtiSectionResolvedCatalogSource` → `QtiResolvedCatalogSource`

The renamed types are now type aliases to the section-player contract types instead of hand copies, so they can no longer drift members or names; the facade's data-model drift test asserts name parity against the contract sources. Because the copies were field-identical, hosts' structural usage keeps compiling — the renames are nominal only. Also:

- `QtiSectionToolConfig.toolId` carries the contract's literal union again (`'textToSpeech' | 'calculator' | 'ruler' | 'protractor' | (string & {})`); the hand copy had silently narrowed it to `string`. Assigning an arbitrary string still compiles; autocomplete literals are restored.
- **Removed three dead facade types** that nothing produced or consumed (`QtiResolvedAssessmentStimulus`, and the pipeline-shaped `QtiResolvedStylesheetRef` / `QtiResolvedCatalogSource` it referenced). They are a different shape from the section-player contract types that now rightly own those names; a stimulus-resolution pipeline typeset does not exist in this package's runtime.
