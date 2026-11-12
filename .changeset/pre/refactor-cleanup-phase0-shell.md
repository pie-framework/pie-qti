---
'@pie-qti/assessment-player': patch
'@pie-qti/section-player': patch
'@pie-qti/player-elements': patch
---

Dead-code removal in the assessment and section players (cleanup phase 1). Delivery is unchanged: navigation, submission gating, attempts, timing, scoring and the reference backend behave exactly as before.

**Breaking: removed APIs** (beta prerelease; migrate before upgrading):

- `@pie-qti/assessment-player`: the `rng` option of `AssessmentPlayer.create()` (`BackendAssessmentPlayerConfig.rng`) is gone. It has been ignored since the backend started drawing selection and ordering at session start. Pass the seed to the reference backend instead: `new ReferenceBackendAdapter({ rng })`.
- `@pie-qti/assessment-player`: `AssessmentPlayer.getItemSessionInfo()` no longer takes an item identifier. The argument was ignored: the method always reported the current item, and still does. Drop the argument.
- `@pie-qti/assessment-player` no longer exports `shortSupportCode`, `isSubmissionBlockedError`, or the types `ItemRef` and `NavigationMode`. Nothing outside the package used them and no documentation named them. For a support code, read `assessmentErrorDisplay(error).supportCode`. To recognize a refusal that names unanswered questions, check `isAssessmentPlayerError(error)` and its `code` (`finalizeResponseRequired`, `finalizeResponseInvalid`, `leavePartResponseRequired` or `leavePartResponseInvalid`). No API took or returned `ItemRef` or `NavigationMode`.
- `@pie-qti/section-player` no longer exports `hasDisplaySettingsChanged`. To test whether a candidate changed the display settings, compare them with `DEFAULT_DISPLAY_SETTINGS` (a different `textSize` step, or `highContrast` or `textSpacing` on).

**`@pie-qti/section-player` dependencies:** `@pie-players/pie-calculator-desmos` and `@pie-players/tts-client-server` are no longer direct dependencies. The section player never imported them; `@pie-players/pie-default-tool-loaders`, which loads the calculator and read-aloud tools, declares and imports them itself, so they are still installed, at the same version. An app that imported either package without declaring it should add it to its own dependencies.

Also removed, internal to `@pie-qti/assessment-player` and never reachable from its entry points: the navigation-gating `ItemSessionController.canNavigateAway()` and `validateItem()` (with the coordinator's wrapper), `ItemSessionController.resetItem()` and `clear()`, the reference session store's `removeSession()`, and the never-set `currentSectionStartTime` timing field. QTI gates submission, not navigation: `allowSkipping` and `validateResponses` stay enforced where they were, by the submission gate and the item player's response validation.

`@pie-qti/player-elements`: the documentation of `QtiAssessmentPlayerConfig.rng`, which still seeds the element's built-in reference backend, no longer points at the removed headless option.
