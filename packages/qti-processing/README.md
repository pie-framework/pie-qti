# @pie-qti/qti-processing

Shared QTI processing engine for QTI 2.x and 3.0: an AST builder for response
processing, an expression evaluator, a rule executor, and the runtime value and
context types used by the item and assessment players.

- **`ast`** — builds a typed AST from `responseProcessing` XML, per QTI version
  (element-name mapping between QTI 2.x camelCase and QTI 3.0 dash-case is
  handled here).
- **`eval`** — evaluates expressions (`match`, `mapResponse`, `statsOperator`,
  lookup tables, `min`/`max`, …) with QTI NULL/container semantics. No
  `eval`/`new Function`: the operator set is implemented as an AST interpreter.
- **`exec`** — executes response-processing rules (`setOutcomeValue`,
  `lookupOutcomeValue`, `exitCondition`, template invocation, …).
- **`runtime`** — QTI value types (single/multiple/ordered/record), base-value
  coercion, mapping and lookup-table semantics, and the processing context.
- **`test`** — `TestEvalContext` contracts for test-level processing.
- **`xml`** — XML reading helpers shared by the above.

Only spec-defined processing elements are accepted; unknown elements and
non-spec spellings throw (see `docs/SPEC-GAPS-PLAN.md` for the strictness
policy and its history). Standard response-processing templates
(`match_correct`, `map_response`, …) are handled by the item player, not here.

Used by `@pie-qti/item-player` (item-level response processing) and
`@pie-qti/assessment-player` (outcome processing across the test).

## Docs

- PRD (rationale and acceptance criteria): [`docs/prds/architecture/response-processing.md`](../../docs/prds/architecture/response-processing.md)
- Scoring/response tracking guide: [`docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`](../../docs/QTI-RESPONSE-TRACKING-AND-SCORING.md)
