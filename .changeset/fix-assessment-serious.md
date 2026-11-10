---
'@pie-qti/assessment-player': patch
---

Assessment player fixes:

- **Next is offered at a simultaneous part's end when the crossing flush decides.** `canNext` and `getForwardTransitionInfo()` used the delivery rules' result from before the part's responses were submitted, so when those pre-flush rules found nothing after the part (for example a following part whose preCondition reads the part's item outcomes) the shell showed Submit instead of Next, although the flush in `next()` would branch on, open the next part or take an `EXIT_TEST` decision. While the part still has responses to submit, the step now reports like a submitting Next: it is offered when an open item follows, as a step out of the part (`leavesTestPart: true`, the adjacent open item standing for the flush's decision).
- **`timeWarningThreshold: 0` turns the default warning off.** It used to fall back to 60 seconds (an `||` fallback); `0` now means no default warning, while `timeWarningThresholds` still fire. Unset keeps the 60-second default.
