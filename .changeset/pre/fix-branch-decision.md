---
'@pie-qti/assessment-player': patch
---

Backend branch decisions (`nextItemIdentifier`) are now honoured everywhere delivery moves, not only on the submitting move. QTI-observable navigation changes:

- **Simultaneous test parts follow branching.** Leaving a simultaneous part on Next submits the part's pending responses first and then follows the decision the backend returned for the part's last item (its testPart branchRule ran there, with every variable committed), through the same part-leave, `EXIT_TEST` and finalized guards as a submitting move. Previously the crossing precomputed its landing from the delivery rules before the flush — with no item variables committed — so a testPart branchRule was ignored and the next part's precondition was evaluated on uncommitted state; an `EXIT_TEST` rule at the crossing never fired at all. A decision target inside the part that is ending is rejected, and the end of the test's own collection (the same submit path) stores no decision — it never navigates.
- **Kept decisions cannot go stale.** Any later counted submission voids the decision kept for an earlier one, so a testPart rule in a nonlinear part re-evaluates on the moved outcomes instead of replaying a target decided on the old ones.
- **Live and restored sessions land identically.** The kept decision is persisted with the session state (`AssessmentSessionState.branchDecisions`, item identifier → target, stored with that item's last-submission record), so a save/resume follows it exactly as the live session would. Session-format addition: backends that never store the field just lose the kept decision across a resume and fall back to the delivery rules.
