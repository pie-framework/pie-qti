---
'@pie-qti/qti-processing': patch
---

Fix `mapResponsePoint` container scoring: each mapped area now contributes its value at most once when a multiple-cardinality point response contains several points inside the same area, per QTI §2.11.1.6 ("each area can be mapped once only"). Overlapping areas keep first-listed priority (§5.5.4), which is unchanged.
