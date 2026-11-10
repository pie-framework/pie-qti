---
'@pie-qti/assessment-player': patch
---

Assessment player fixes:

- **Next is offered at a simultaneous part's end when the crossing flush decides.** `canNext` and `getForwardTransitionInfo()` used the delivery rules' result from before the part's responses were submitted, so when those pre-flush rules found nothing after the part (for example a following part whose preCondition reads the part's item outcomes) the shell showed Submit instead of Next, although the flush in `next()` would branch on, open the next part or take an `EXIT_TEST` decision. While the part still has responses to submit, the step now reports like a submitting Next: it is offered when an open item follows, as a step out of the part (`leavesTestPart: true`, the adjacent open item standing for the flush's decision).
- **Test-level outcomes are persisted with the session state.** `AssessmentSessionState.testOutcomes` now carries the values the backend last returned from its outcome processing, so a restored session's branch and preCondition rules evaluate on them and navigate identically to the live one. Session-format addition: backends that never store the field just lose the values across a resume, and the restored rules evaluate on missing outcomes.
- **`timeWarningThreshold: 0` turns the default warning off.** It used to fall back to 60 seconds (an `||` fallback); `0` now means no default warning, while `timeWarningThresholds` still fire. Unset keeps the 60-second default.
- **A hint keeps a reopened item's session open.** An uncounted (hint) submission after a counted check could close the item session — response processing may mark the item completed (a hint on a correct answer) — leaving the candidate with no way to answer. After a hint the session is as open as it was before it, and the hint's accepted response set stands as the item's last submitted set: moving on unchanged still follows the counted decision on record instead of re-submitting the hint response.
