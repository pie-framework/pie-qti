---
'@pie-qti/item-player': patch
'@pie-qti/assessment-player': patch
---

Fix `endAttemptInteraction` delivery inside assessments and honor `countAttempt` on every item:

- **Assessment delivery decides the end-attempt submission.** The item player auto-submits only a session it owns (standalone). With an injected session (assessment delivery), the `AssessmentPlayer` recognizes the end-attempt response on the normal response path from the item's `endAttemptInteraction` metadata: in `individual` submission mode it submits the item through the normal per-item path (branching ignored — the candidate stays on the item); in `simultaneous` mode the response is recorded like any response and response processing stays deferred to the end of the testPart, so the final submission always succeeds. A locally closed session no longer makes a later submission throw.
- **`countAttempt="false"` works on non-adaptive items.** Response processing runs (hint outcomes and feedback compute), but `numAttempts` is unchanged, `completionStatus` is not forced to `completed`, and the session stays open so the candidate continues. Only a counted attempt finalizes a non-adaptive item. Works for QTI 2.2 `countAttempt` and QTI 3.0 `count-attempt`.
- **`SubmitResponsesRequest.countAttempt`** (default true) lets the client mark a hint submission; the reference backend honors it by skipping the maxAttempts rejection, not recording a result, and leaving the attempt count unchanged.
- **Test-level outcome processing reads the built-in scope durations.** `duration` (test), `TESTPART_ID.duration` and `SECTION_ID.duration` are declared from the persisted timing clocks in QTI seconds (clocks stay in milliseconds), alongside the item-level `ITEM_ID.duration`.
