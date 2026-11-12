---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

Remove the processing elements no QTI version defines from the expression/rule builder. All were
checked against the three in-repo XSDs (QTI 2.1, 2.2, 3.0 ASI): none is an `xs:element` in any of
them, and none is used by official fixtures or third-party content in the repo. The builder cases,
AST node types and evaluator branches are gone, so the elements fail like any unknown element.
`xi:include` stays: it is spec-defined (XInclude, referenced by `ResponseProcessing.Type`) and is
only accepted in the XInclude namespace.

**Breaking:** items using these elements no longer compile (they were invalid QTI before). The
spec-defined replacements:

- `isNotNull` — write `not(isNull(...))`.
- `notEqual` — write `not(equal(...))`.
- `allN` — write `anyN` with `min="0"` and the same `max`.
- `mean`, `sampleVariance`, `sampleSD`, `popVariance`, `popSD` — write `statsOperator name="..."`,
  the only spelling any QTI version defines.
- `mod` — write `integerModulus`.
- `isTypeOf` — no replacement: QTI has no runtime type-inspection operator.
- `mapOutcome` — no replacement: mappings exist on response declarations only (`mapResponse`); the
  item player also stops reading `<mapping>` inside outcome declarations, which no QTI version
  defines.
- `setResponseValue` — no replacement: response rules never write response variables; keep derived
  values in outcome variables via `setOutcomeValue`.
- `lookupTable` (the expression wrapping an inline table) — write the `lookupOutcomeValue` rule and
  put the `matchTable`/`interpolationTable` on the outcome declaration, as the spec paths it.
- `record` (the constructor) — no replacement: records are a declaration cardinality; deliver the
  record value with the session and read its fields with `fieldValue`.
- `preCondition` (as an expression) — no replacement: no QTI version defines it outside test
  structure (`assessmentItemRef`/`sectionPart` conditions, which the assessment player owns); the
  fixture that exercised it is deleted. A test pins that every removed name now throws.

The conformance fixtures that exercised the removed elements are rewritten to the spec spellings
with unchanged cases and outcomes (three renamed: `isNull_not`,
`responseProcessing_not_equal_basic`, `responseProcessing_anyN_bounds`;
`responseProcessing_lookupOutcomeValue_interpolationTable` replaces the lookupTable-expression
fixture), and the fixtures that existed only for a removed element are deleted
(`responseProcessing_setResponseValue`, `responseProcessing_mapOutcome_basic`,
`responseProcessing_lookupTable_matchTable` — matchTable coverage stays on the existing
`responseProcessing_random_lookupOutcomeValue` fixture, which gained a no-matching-entry case).
All rewritten fixtures now compile as QTI 3.0 as well.
