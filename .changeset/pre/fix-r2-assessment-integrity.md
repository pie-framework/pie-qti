---
'@pie-qti/assessment-player': patch
'@pie-qti/player-elements': patch
'@pie-qti/i18n': patch
---

Round-2 assessment-integrity fixes across the assessment player and its shell:

- **End-of-test collection (S1):** finalize now collects every visited individual-mode item the
  backend has not accepted yet — an answer left behind a nonlinear jump (`navigateTo`/`previous`
  submit nothing) is scored instead of finalized from NULL. Unchanged responses never re-submit,
  so moved-on practice items spend no extra attempt; linear submit-on-move semantics are
  unchanged. Finalization also persists the final snapshot before `finalizeAssessment`, so
  outcome processing reads the end-of-test duration clocks.
- **Nested section clocks (S2):** every enclosing section now runs its own clock. An outer
  section's `maxTime` expires and locks its whole subtree, its `minTime` gates leaving it, and
  `SECTION_ID.duration` accumulates for outcome processing and Results Reporting; innermost
  behavior is unchanged. Player-side literal `EXIT_SECTION` resolves over the full enclosing
  chain (S3), so an outer-section exit lands outside the whole outer section.
- **Restored proctor pause (UX1):** a snapshot saved during a pause reopens paused with the
  overlay visible — the shell syncs from the core at creation, announces assertively, holds focus
  on the overlay (Tab and stray focus are contained there), suppresses the resume prompt while
  paused and returns it after resume. Opening a pause now closes every shell dialog (A11y7), and
  the whole chrome goes inert through one wrapper with the overlay operable outside it (A11y1).
- **Finalized sessions (UX3):** `InitSessionResponse.finalized` (+ `finalResults`) marks a
  resumed session terminal: the shell renders the already-submitted completion view, never offers
  a resume, and `submit()` returns the stored results instead of failing.
- **Attempt memory across resume (S4):** the submitted-response memory is seeded from the
  snapshot's recorded results, so a resumed session does not re-spend an attempt on identical
  responses.
- **Shell resilience and a11y:** failed item entries (first item, expiry hop) route to the typed
  failure screen with Retry instead of an eternal loading state (UX5); the crash boundary's
  fallback takes focus (A11y6); the announcer splits into persistent polite and assertive regions
  (A11y3); timer and section-menu toggles no longer carry dangling `aria-controls` (A11y5); the
  expiry dialog stays open and busy on a busy-rejected submit (UX7); malformed item XML can no
  longer crash review-state helpers.
- **Autosave backoff (UX6):** a failed save retries with a bounded backoff (2s/8s/30s), stopping
  on success or finalization, instead of waiting for the next candidate change.
- New localized string `assessment.complete.alreadySubmitted` in all 8 locales.
