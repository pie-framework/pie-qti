---
'@pie-qti/player-elements': patch
---

The published element contracts now declare what the elements already dispatch and implement. The contracts had been hand-restated next to the runtime elements and drifted from them; the runtime declarations are the single source now, and every fix only grows the surface (nothing existing changed):

- **`pie-qti-assessment-player`**: the `autosave-change` and `autosave-failed` events are in the published event map (with their `QtiAssessmentAutosaveChangeDetail` and `QtiAssessmentAutosaveFailedDetail` detail types), and the element contract exposes the `autosave` and `autosaveIntervalMs` properties it has always implemented.
- **`pie-qti-section-player-splitpane` / `pie-qti-section-player-vertical`**: the published event map carried only `qti-section-response-delta`; it now also carries `qti-section-framework-error`, `qti-section-display-settings` and `qti-section-item-pane-ready` (with the `QtiSectionDisplaySettingsEvent`, `QtiSectionFrameworkError` and `QtiSectionItemPaneReadyDetail` detail types exported), and the element contract gains `displaySettings` and `focusActiveItem()`.
- **`pie-qti-item-player`**: the element contract gains `stringComparison`; the event map and details are re-exported from the element's implementation instead of hand mirrors.
- The results aliases (`QtiAssessmentResults`, `QtiAssessmentItemResult`, `QtiAssessmentEndReason`) now alias the assessment player's own types, so an `outcomeProcessingError` no longer goes missing from a published result.

A drift-pin test walks each element's runtime source for the events it dispatches and pins the published maps to exactly those events.
