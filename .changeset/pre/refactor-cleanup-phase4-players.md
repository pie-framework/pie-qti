---
'@pie-qti/assessment-player': patch
'@pie-qti/section-player': patch
---

Player cleanup, phase 4 (assessment-player and section-player): three internal deduplications with no intended behavior change.

**Shared section layout.** `SectionPlayerVertical` and `SectionPlayerSplitPane` move their duplicated section body — the role/security/PNP/display-settings state, the runtime-host notifications, the response and framework-error handlers, and the passage, rubric+item and display-settings fragments — into a shared `SectionLayout` module that both render through a layout-provided frame. Role and view filtering stays in `resolveQtiSectionComposition`. The rendered DOM, landmarks, headings and focus order are unchanged (pinned by new component tests); `focusActiveItem`, the props and the `onItemPaneReady`/`onResponseChange`/`onFrameworkError`/`onDisplaySettingsChange` callbacks keep their shapes.

**One attempt-relative feedback helper.** New (internal) `resolveMaxAttempts(settings, adaptive)` and `attemptFeedbackVisible({ showFeedback, maxAttempts, attempts, adaptive })` in assessment-player carry the player's feedback semantics that `AssessmentPlayer.feedbackVisible` and the check-answer state used to inline; the private `resolvedMaxAttempts` is gone. `getItemSessionInfo().showFeedback` keeps its current semantics — it stays false before the item's first submission even when `itemSessionControl@showFeedback` is on, reads the live recorded attempt count rather than the projected one, and treats an adaptive item as unlimited only through its resolved settings — and now shares the attempt-relative arithmetic with the presentation rule.

**`TimeManager.formatTime` moved.** The clock readout is now a standalone `formatTime` util (still not re-exported from the package root, like `TimeManager` itself); `TimeManager.formatTime` is removed with it. Nothing outside the package could call it, and the rendering is byte-identical.
