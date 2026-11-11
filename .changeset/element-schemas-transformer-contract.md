---
'@pie-qti/element-schemas': minor
---

The two schemas that the QTI-to-PIE transformers feed now accept that output. `multiple-choice.json` required seven `*Enabled` booleans the transformer never emits and forbade the `correctResponse`/`shuffle` properties it always emits (`additionalProperties: false`), so 100% of `transformMultipleChoice` output failed validation; `required` now lists exactly the always-emitted fields (`choices`, `choiceMode`, `correctResponse`, `element`, `id`, `partialScoring`, `prompt`, `shuffle`) and the two missing properties are declared. `match.json` required `rationale` (plus six other never-emitted fields) which `transformMatch` never emits; `required` is now the transformer's always-emitted set (`choiceMode`, `element`, `headers`, `id`, `layout`, `lockChoiceOrder`, `partialScoring`, `prompt`, `rows`). Optional upstream-mirrored properties are unchanged.

New `tests/transformer-output.test.ts` runs the real to-pie transformers on to-pie's QTI fixtures (read-only relative wiring, no package dependency) and validates their models against these schemas, so the contract can no longer drift silently. README documents the alignment, the overwrite risk on upstream re-sync, and the known gap that `categorize`, `number-line`, `charting` and `graphing` (all emitted by the transformers) have no schema yet.
