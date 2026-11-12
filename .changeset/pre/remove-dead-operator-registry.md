---
'@pie-qti/qti-processing': patch
'@pie-qti/assessment-player': patch
'@pie-qti/item-player': patch
---

**Breaking: `OperatorRegistry` is removed from `@pie-qti/qti-processing`, and `EvalEnv` loses its `ops` field** (beta prerelease). The evaluator never read it: every built-in operator is an inline `switch` case in the evaluator, `<customOperator>` dispatch uses the separate `EvalEnv.customOperators` record, and nothing could ever be registered that had an effect — so every caller just constructed an empty registry to satisfy the type. Hosts that build an `EvalEnv` drop the `ops: new OperatorRegistry()` entry; hosts that import `OperatorRegistry` remove the import. Nothing else migrates: the fields that matter (`ctx`, `rng`, `language`, `stringComparison`, `customOperators`, `test`) are unchanged, and scoring is identical. The players' internal environments (`processingEnv`, the test-level expression evaluator, the adapter's outcome-processing run) already dropped the field with it.

Also deduplicates the point-in-shape geometry (rect, circle, ellipse, poly hit tests) that `<inside>` and `mapResponsePoint` each carried as their own verbatim ~55-line copies in the evaluator: both operators now share one module-scope implementation, pinned by tests covering every shape on both operators (boundary inclusivity, zero radii, malformed polygon coords), so the two can no longer drift apart.
