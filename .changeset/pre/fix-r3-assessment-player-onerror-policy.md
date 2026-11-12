---
'@pie-qti/assessment-player': patch
---

Documented and implemented the `config.onError` reach policy for candidate-initiated failures.

- **Hard backend failures of an end of the test now reach `config.onError`.** The hook documented itself as the host surface for core and backend failures, but a candidate's submit or finalize that the backend refused surfaced only as inline shell state. The built-in shell (`AssessmentShell`) owns the config and now calls the host's `config.onError` at those sites, once, with the typed error: `submitFailed` and `finalizeFailed` reach both the host hook and the shell's inline submit-failure alert (with Retry). Validation refusals stay inline-only: the coded warnings naming questions still needing an answer (`finalizeResponseRequired` and friends) and `attemptValidationFailed` are candidate-facing state, never failures, and never call the hook. The `onError` JSDoc documents this policy, together with the failures the core already reports (failed item entries, `outcomeProcessingFailed`, `testConditionFailed`, `itemScoringFailed`, a failed expiry auto-finalization, autosave rejections).
- New stable error codes in the `AssessmentPlayerError` taxonomy: `testConditionFailed` (a test-scope branch rule or preCondition that could not be evaluated) and `itemScoringFailed` (an item whose response processing failed). Additive; existing codes unchanged.
- New `ItemScoringError` type and optional `scoringError` field on `AssessmentScoringResult` (see the core fixes changeset). Additive.
- The delivery-rules helpers `evaluateTestCondition`, `nextItemIdentifier` and `firstEligibleItem` (re-exported from `@pie-qti/assessment-player/integration`) accept an optional trailing reporter `(expressionXml, error) => void` for condition evaluation failures. Additive, optional parameter.
- `saveSession` (reference session store) now returns `boolean` instead of `void`, reporting whether the write landed. Callers that ignored the result are unaffected.
