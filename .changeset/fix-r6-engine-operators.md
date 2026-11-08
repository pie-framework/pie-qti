---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

Spec-compliance fixes for the container operators, NULL operands, `round`/`truncate` and graphicGapMatch response validation (QTI ASI §5 and §15.3, graphicGapMatchInteraction).

**Scoring changes, stated plainly (items whose response processing uses these operators can score differently):**

- `contains(container1, container2)` now tests whether the first container contains the second: for multiple containers every value of the second, counted, must be in the first (`[A,B,C]` contains `[C,A]` but not `[B,B]`); for ordered containers the second must be a contiguous sub-sequence of the first (`[A,B,C]` contains `[B,C]` but not `[C,A]` or `[A,C]`). Before, the second operand was read as one value to look for, so `contains(RESPONSE, multiple(A, B))` was always false. A single value as the second operand still asks whether that value is in the container. Two containers of different cardinality are now invalid.
- `delete` now reads its operands in QTI order: the value to remove first, the container second (`delete(A, {B,A,C,A})` is `{B,C}`). Before, the engine read the first child as the container, so content written in QTI order got NULL; content written in the old engine order (`<delete><variable/><baseValue/></delete>`) must swap its two children. Removing every value now gives NULL (the empty container), and values compare as `member` compares them (a `pair` ignores the order of its two identifiers).
- NULL operands now propagate: `match`, `member`, `contains`, `stringMatch`, `patternMatch`, `lt`, `lte`, `gt`, `gte` and `not` result in NULL when an operand is NULL. Before, they returned false and `not(NULL)` returned true. `and` is false when any operand is false and otherwise NULL when any is NULL; `or` is true when any operand is true and otherwise NULL when any is NULL. A NULL condition is not true, so `responseIf(not(match(RESPONSE, correct)))` no longer takes its branch for an unanswered item: response processing continues with the `responseElseIf`/`responseElse` branches. An empty container or empty string is NULL, as QTI defines, in these operators and in `isNull`/`isNotNull`, `equal`, `equalRounded`, `durationLT`/`durationGTE` and `inside`; before, `isNull` was false for a cleared multiple response. `lt`/`lte`/`gt`/`gte` with a non-numeric operand, and `and`/`or`/`not` with an invalid operand, are now invalid instead of false or true.
- `round` and `truncate` now result in an integer, as QTI defines (before: float). `match(round(x), <integer>)` is now true when the values agree and `match(round(x), <float>)` is now false; a `sum` or `product` of their results and integers is an integer. A float outcome still receives the value as a float. `roundTo` is unchanged.
- `multiple` and `ordered` now ignore NULL sub-expressions and are NULL when every sub-expression is NULL. Before, each NULL sub-expression added a null value, which `containerSize` counted, which made `match` fail on length, and which made `statsOperator` NULL.

**Validation change:**

- Response validation now enforces a graphicGapMatchInteraction's `maxAssociations` and the `matchMax` of each gap choice (`gapText`, `gapImg`) and each hotspot (0 means no restriction). A response over a limit is invalid with an `invalid_shape` issue, as an extended-text response over `maxStrings` is: `endAttempt({ validateResponses: true })` rejects it and the session cannot submit it until it is corrected.
