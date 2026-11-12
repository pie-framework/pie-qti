---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

Spec-compliance fixes for template rules and container mapping (QTI ASI §5.1, §10.3, §15.3).

**Scoring changes, stated plainly:**

- `mapResponse` and `mapOutcome` no longer count duplicate container values twice. Per §15.3, each distinct value counts once: a multiple-cardinality response `{B,B,C}` maps to 1.5, not 2.5. Pair values dedupe on their order-normalized key; directedPair keeps direction significant. Items whose authors relied on duplicates adding extra credit will now score lower.
- `setDefaultValue` is now the template rule the spec defines: it evaluates its contained expression, changes the variable's default value, and later resets (attempt starts, outcome resets at response-processing start, `templateConstraint` restarts) use the new default. It is only compiled inside `templateProcessing`; occurrences inside `responseProcessing` are ignored, matching the §10.3 rule vocabulary.
- Restored item sessions keep their template-rule effects: the snapshot now records each response variable's `correctResponse` (including one computed by `setCorrectResponse`) and the declaration's `defaultValue`, so a resumed or re-scored session scores identically to the session that was saved.

**Snapshot format:** `SerializedItemSessionVariable` gains an optional `correctResponse` field on response variables. Snapshots saved by older builds (without the field) still restore unchanged.

Hosts that re-score browser-provided snapshots with `@pie-qti/item-player` should add `correctResponse` and `defaultValue` to the declaration checks they already run on untrusted save data.
