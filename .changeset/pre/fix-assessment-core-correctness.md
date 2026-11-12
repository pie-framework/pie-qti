---
'@pie-qti/assessment-player': patch
'@pie-qti/player-elements': patch
---

Assessment delivery correctness fixes in the assessment core:

- **EXIT_* branching finalizes the test.** QTI `branchRule` targets `EXIT_TEST` / `EXIT_TESTPART` / `EXIT_SECTION` now terminate delivery through the same finalization path as `submit()`: pending simultaneous-mode responses are submitted, outcome processing runs, results are produced, `complete` fires, and navigation is closed afterwards (typed `testFinalized` rejection). Previously `EXIT_TEST` only fired the completion callback with no submit, no outcomes and no results, and `next()` kept presenting the remaining items.
- **Navigation transitions are serialized.** While a navigation/submission round trip is in flight, further navigation or submit calls reject with a typed `navigationInFlight` error instead of racing the backend (which could discard a response). `getNavigationState().isLoading` now carries the real in-flight flag, with `onBusyChange`/`isBusy()` for hosts; the shell disables Previous/Next/Submit and sets `aria-busy` while busy. A failed submit keeps the candidate on the same item with the response intact and retryable.
- **`ItemSessionController` QTI defaults fixed.** `maxAttempts` now defaults to 1 (the QTI default; 0 remains unlimited for adaptive items) instead of unlimited.
- **Outcome-processing failures surface.** `ReferenceBackendAdapter` no longer swallows test-level outcome-processing errors: submit/finalize responses, the persisted session and `AssessmentResults` carry a typed `OutcomeProcessingError` (stable code `OUTCOME_PROCESSING_FAILED`), hosts receive it via the new `config.onError` callback and the assessment element's `player-error` event, and candidate responses stay accepted and persisted.
- **Coded, localizable errors.** The core throws `AssessmentPlayerError` (stable `code` + `params`) for every candidate-visible failure; the shell renders localized messages from `assessment.errors.codes.*` (new keys in all 8 locales) plus a short support code, so backend/raw error strings are never shown to candidates.
- **Invisible sections are truly invisible.** Sections with `visible="false"` (or under an invisible ancestor) are omitted from candidate-facing section data, their titles never surface, and items still deliver in order under the outermost visible ancestor. `getAllSections()` now returns `CandidateSectionView` entries with a `navigable` flag (legal targets for the current navigationMode) and `navigateToSection()` rejects illegal jumps with typed errors.
