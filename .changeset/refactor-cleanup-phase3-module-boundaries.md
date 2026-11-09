---
'@pie-qti/assessment-player': patch
'@pie-qti/assessment-toolkit': patch
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/player-elements': patch
'@pie-qti/section-player': patch
---

Module boundaries (cleanup phase 3), with one fix.

**Fix: a coded error keeps its code across copies of the package.** `isAssessmentPlayerError` (and `assessmentErrorDisplay`, which builds on it) used `instanceof`, which fails for an `AssessmentPlayerError` created by another copy of `@pie-qti/assessment-player`. The `<pie-qti-assessment-player>` bundle carries two copies — it compiles the shell and core from source and also imports the package's built entry — so a coded error reached the `player-error` event without its `code`. A host that loads `@pie-qti/assessment-player` beside the self-contained player-elements bundle met the same split. Every `AssessmentPlayerError` now carries a `Symbol.for('pie-qti.AssessmentPlayerError')` brand, which the guard checks; recognize coded errors with `isAssessmentPlayerError`, not `instanceof`.

Without behavior changes:

- `@pie-qti/section-player` exports `filterToolsForRole`, the tool filter its composition applies. `@pie-qti/assessment-toolkit`'s `normalizeQtiToolConfig` is now that filter without PNP supports: the same result, still an array.
- `@pie-qti/item-player` exports `DEFAULT_COMPONENT_TAGS_BY_TYPE`, its default custom-element tag per interaction type (plus `catalogPopup`), and `@pie-qti/default-components` derives `registerDefaultComponents` from it. Tag names are unchanged; the registrations' debugging `description` is now generic (`Default Svelte-based component for <type>`).
- Internal: unpublished component source is imported through one workspace alias map instead of `../../../<pkg>/src` paths; item-player's presentation code no longer imports from its Svelte component helpers; the reference backend's session key prefix (`qti_session_`) is defined once, so saved sessions resume as before.
