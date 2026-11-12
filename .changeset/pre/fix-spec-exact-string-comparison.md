---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
'@pie-qti/assessment-player': patch
'@pie-qti/player-elements': patch
---

String answers now compare as QTI defines them. `match`, `member`, `contains`, `delete`, `stringMatch` and `mapResponse` entry lookup compare `string` values for equality: `match` is true "if the two expressions represent the same value" (QTI 3.0 §6.9.21). Case folds only where the item asks for it, through `stringMatch` with `caseSensitive="false"` or a `mapEntry` whose `caseSensitive` is false (its default). Both values are composed to Unicode NFC first. QTI is silent on normalization, and canonically equivalent text must not be treated as distinct (Unicode conformance clause C6), so `é` typed with a combining accent still matches `é`.

The new delivery option `stringComparison` lets a host opt in to more folding. You can set it on `createAssessmentItemDefinition` (client and server entry points), on the `ItemPlayer` component and the `<pie-qti-item-player>` element, on `AssessmentPlayer.create` (or the `config` of the assessment shell and of `<pie-qti-assessment-player>`), on `ReferenceBackendAdapter` and on `scoreAssessmentItem`:

- `foldScriptInput: true` removes bidi controls (ALM, LRM, RLM, embeddings, overrides, isolates) and tatweel. It folds Arabic presentation forms to their base letters, every script's decimal digits to 0–9, and the Arabic decimal and thousands separators to the content language's marks.
- `foldLetterVariants: true` folds Arabic spelling variants: hamza and madda alef forms become bare alef, tashkeel is removed, ة becomes ه and ى becomes ي.

Give the player and the scoring backend the same value. Numbers typed into `integer` and `float` responses read digits in any script and the Arabic separators either way. `patternMatch` and `patternMask` always test the text as entered.

Breaking: before this change, string comparisons always folded script input. A string answer that matched only because of that fold now scores as non-matching. Examples are an answer typed with tatweel, a bidi mark or Arabic presentation forms, or a string answer typed with Arabic-Indic digits. To restore the earlier scoring, set `stringComparison: { foldScriptInput: true }` on the player and on the scorer. For example, use `createAssessmentItemDefinition({ itemXml, stringComparison: { foldScriptInput: true } })` and `new ReferenceBackendAdapter({ stringComparison: { foldScriptInput: true } })`.

Breaking: `normalizeResponse` from `@pie-qti/qti-processing` now folds script input only when called with `foldScriptInput: true`. Without it, the function returns the text composed to NFC, and case-folded when `ignoreCase` is set. `foldLetterVariants` is now independent of `foldScriptInput`. It was documented as "an authoring choice per response", but no authored attribute or element ever set it. It is now the host option `stringComparison.foldLetterVariants`.

When `mapResponse` maps a container, a string value that no `mapEntry` matches now keeps its case: `{London, LONDON}` counts as two values, each with the mapping's `defaultValue`. Values that a case-insensitive entry matches still count once.

A `graphicGapMatchInteraction` with `minAssociations` (QTI 2.2; `min-associations` in QTI 3.0) now needs at least that many associations before its response counts as complete. Response validation (`canSubmit`, and `endAttempt` with `validateResponses`) reports a response with fewer associations as incomplete. The interaction data carries the value as `minAssociations`. An absent attribute or `0` sets no minimum.
