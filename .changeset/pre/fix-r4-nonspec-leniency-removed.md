---
'@pie-qti/qti-processing': patch
---

Non-spec leniency removed from the processing engine and malformed rules fail loudly:

- **patternMatch**: the engine read a `caseSensitive` attribute and compiled the author's XSD
  pattern with the `i` regex flag when it was `"false"`. No QTI version defines that attribute —
  QTI 2.1/2.2 list exactly one attribute (`pattern`), and the 3.0 `PatternMatchDType` has only
  `pattern` — so per the project's no-non-spec-leniency rule it is no longer read. XSD regular
  expressions are case-sensitive by nature, which is what the default already did; only content
  that authored the extension changes behavior. **Breaking:** `patternMatch caseSensitive="false"`
  content (invalid QTI) now matches case-sensitively; rewrite such items to fold case in the
  pattern itself (e.g. `[aA][bB]`) or switch to `stringMatch caseSensitive="false"`.
- **matchTable**: the lookup source must be an integer, per the spec (QTI 2.1: matchTable
  "transforms a source integer", `matchTableEntry@sourceValue [1]: integer`; QTI 3.0
  lookupOutcomeValue: "Integer type is required when the associated table is a matchTable"). The
  engine once fell back to a string comparison for other base types; a string, float or boolean
  source now evaluates to invalid instead of matching by its literal text. **Breaking:** only for
  content with a non-integer matchTable source (invalid QTI); conforming integer-keyed tables are
  unaffected.
- **Malformed rules**: `setOutcomeValue`, `setTemplateValue`, `setCorrectResponse`,
  `setDefaultValue` and `lookupOutcomeValue` missing their required identifier or child expression
  now throw at build time, matching the module's fail-loud convention for unhandled tags.
  Previously they were silently dropped, so a truncated rule left the outcome at its default and
  changed scoring with no signal. **Breaking:** only for malformed content, which is invalid QTI.
