---
'@pie-qti/player-elements': patch
---

Breaking: `QtiAssessmentPlayerElement` now validates its JSON attributes instead of silently tolerating garbage. Setting `items-json`, `config-json` or `security-json` to a malformed JSON document or to JSON that is not an object (a string, number, boolean, array or `null`) previously kept whatever value the attribute held before, with no signal; it now resets the field to its removal value (`items` and `security` cleared, `config` reset to `{}`) and dispatches `load-error` with a message naming the attribute. Removing one of these attributes now also clears the field — it previously kept the stale value, unlike the element's other attributes (`assessment-test-xml`, `assessment-id`, `item-base-url`), which always follow removal. Valid JSON objects parse exactly as before.
