---
'@pie-qti/assessment-player': patch
---

Accept a deterministic clock in the assessment player config (`now`), so hosts and tests can drive time-limit tracking from their own timeline. Timing behavior is unchanged when the option is unset.
