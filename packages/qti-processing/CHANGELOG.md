# @pie-qti/qti-processing

## 1.0.0-beta.5

### Patch Changes

- 99341e5: QTI specification fixes in the scoring engine and item player, plus QTI Results Reporting output.
  
  - **Durations are seconds, as QTI defines them.** `@pie-qti/qti-processing` reads duration values as seconds: the specified `xsd:double` form (`<baseValue baseType="duration">30</baseValue>`, previously rejected as invalid) and, as a leniency, ISO 8601 (`PT30S`). `durationLT`/`durationGTE` normalize both operands, so a malformed duration is invalid instead of silently comparing false, and `match`/`equal` compare durations by their seconds. In `@pie-qti/item-player` the built-in `duration` variable now holds seconds, so response processing compares it with seconds. **Behavior change:** the QTI variable value seen in `ScoringResult.outcomeValues.duration`, `SerializedItemSessionState.contextVariables.duration` and `ItemSessionView.context.duration` is now seconds (it was milliseconds). The host-facing `duration` fields — `SerializedItemSessionState.duration`, `ItemSessionActionResult.duration`, `ItemSessionView.duration` — stay in milliseconds, and sessions saved before this change restore correctly. New helpers: `parseDurationSeconds`, `durationSeconds`, `durationSecondsFromMilliseconds`.
  - **Unsupported response-processing templates fail explicitly.** An item whose `responseProcessing` only references a template the player does not implement now fails compilation with `UnsupportedResponseProcessingTemplateError` (exported), instead of logging a warning and scoring its outcome defaults. The predefined `no_response_processing` template is supported (the standard empty program: outcomes keep their defaults); strict QTI compliance no longer rejects QTI 3.0 items.
  - **`strictQtiCompliance` validates the item.** Compilation checks the item's QTI namespace, its element names against the XSD-verified QTI 2.2/3.0 vocabulary (unknown QTI-namespace elements and unknown `qti-` elements), interactions whose `responseIdentifier` has no `responseDeclaration`, QTI interactions without a `responseIdentifier`, and response-bound elements no registered extractor renders (previously skipped silently). Findings are listed on the new `AssessmentItemDefinition.diagnostics` and logged: warnings by default, errors in strict mode, where versions other than QTI 2.2 and 3.0 are findings too. Strict mode with `rejectUnknownExtensions` throws a `QtiComplianceError` carrying them. **Behavior change:** strict mode no longer rejects QTI 3.0 items for not being QTI 2.2.
  - **matchGroup is enforced in response validation.** `validateResponses` reports pairs that `matchGroup` forbids in associate, match, gap match, graphic gap match and graphic associate responses (`match_group` errors, which block submission), so restored or programmatic responses cannot bypass the renderers' restriction.
  - **Version detection says when it guessed.** `@pie-qti/qti-common` adds `detectQtiVersionDetailed`, which returns the version `detectQtiVersion` returns together with its basis, a confidence and warnings — for example when an unversioned `assessmentItem` is assumed to be QTI 2.2. It also exports the QTI element vocabularies (`isQtiVocabularyElement`, `QTI2_ELEMENTS`, `QTI2_XHTML_ELEMENTS`, `QTI3_ELEMENTS`).
  - **QTI Results Reporting.** `@pie-qti/assessment-player` adds `toAssessmentResultXml(results, { version: '2.2' | '3.0' })`, which writes the assessment's results as a QTI Results Reporting `assessmentResult` document (context, test result with outcomes and durations, an item result per item with its status, response and outcome variables), and `serializeAssessmentResult` for hand-built reports.
  
  Deliberate deviations from the specification (Unicode folding in string comparison, duration lexical forms, the matchGroup reading) are documented in `docs/QTI_techguide.md` §7.4.
- 9cd2772: QTI 3.0 items using these processing operators with nested expressions now compile: `integerModulus` (both operands), `integerToFloat`, `roundTo` (value), `substring` (optional length) and `record` (fieldValue member value) handed their build options — which carry the QTI 3 kebab-case name mapping — to nested expression builds, so a `qti-variable` or `qti-base-value` nested inside them no longer fails with "Unknown processing expression tag". `record` now also recognizes its `qti-field-value` members spelled for QTI 3, so constructed records keep their fields instead of silently compiling empty. The item-player validation golden was regenerated for the three conformance fixtures this unblocks.
- 410fe38: Spec-compliance fixes for template rules and container mapping (QTI ASI §5.1, §10.3, §15.3).
  
  **Scoring changes, stated plainly:**
  
  - `mapResponse` and `mapOutcome` no longer count duplicate container values twice. Per §15.3, each distinct value counts once: a multiple-cardinality response `{B,B,C}` maps to 1.5, not 2.5. Pair values dedupe on their order-normalized key; directedPair keeps direction significant. Items whose authors relied on duplicates adding extra credit will now score lower.
  - `setDefaultValue` is now the template rule the spec defines: it evaluates its contained expression, changes the variable's default value, and later resets (attempt starts, outcome resets at response-processing start, `templateConstraint` restarts) use the new default. It is only compiled inside `templateProcessing`; occurrences inside `responseProcessing` are ignored, matching the §10.3 rule vocabulary.
  - Restored item sessions keep their template-rule effects: the snapshot now records each response variable's `correctResponse` (including one computed by `setCorrectResponse`) and the declaration's `defaultValue`, so a resumed or re-scored session scores identically to the session that was saved.
  
  **Snapshot format:** `SerializedItemSessionVariable` gains an optional `correctResponse` field on response variables. Snapshots saved by older builds (without the field) still restore unchanged.
  
  Hosts that re-score browser-provided snapshots with `@pie-qti/item-player` should add `correctResponse` and `defaultValue` to the declaration checks they already run on untrusted save data.
- 9abdf17: Spec-compliance fixes for adaptive items, test-level weights, template constraints, validated end of attempt and PCI response JSON (QTI ASI §4, §5.2, §10.3, §15.1; PCI v1.0 Appendix A as adopted by QTI 3.0).
  
  **Scoring changes, stated plainly:**
  
  - Adaptive items keep their outcome values across attempts (§5.2). Response processing no longer resets an adaptive item's outcomes before each run, so rules that build on earlier attempts work: an item that counts tries and gives partial credit for a later correct attempt now scores the partial credit, where it previously scored full credit as if every attempt were the first. Non-adaptive items still reset outcomes before every run. Every response-processing run of an adaptive item builds on the current values, `scoreAttempt` included, so re-scoring a restored adaptive session applies its rules again; report such a session's score from its restored outcome values.
  - `<variable weightIdentifier>` in test-level outcome processing is now applied (§15.1): an item variable read as `ITEMREF.VARIABLE` is multiplied by that item reference's named weight (1.0 when the reference defines none). Weights apply to integer and float values only, and a weighted value is float. Weighted test scores previously came out unweighted.
  - A `templateConstraint` restart discards everything the rejected pass did (§10.3): a correct response set by `setCorrectResponse`, or a default changed by `setDefaultValue`, no longer carries into the accepted pass and into scoring.
  - `dispatch({ action: 'endAttempt', validateResponses: true })` now also rejects responses that miss their interaction's constraints (§4): fewer selections, associations, strings or plays than `minChoices`, `minAssociations`, `matchMin`, `minStrings` or `minPlays` require. The result reads `validation.valid === false` with an `incomplete` issue per response, the attempt is not counted, and the session stays writable. An item with no response at all is a skip, which `allowSkipping` governs at the caller, and is not rejected.
  
  **PCI contract change (PCI hosts and authors):** responses cross the PCI boundary in the PCI v1.0 Appendix A JSON binding. Seeded `getInstance` state, and the exported `toQtiVariableJson`, now write pair, directedPair and point values as two-element arrays (`{"base":{"pair":["A","B"]}}`), durations as ISO 8601 strings (`"PT90S"`), files as `{data, mime, name}`, and records as an array of `{name, base|list}` members. Previously a conformant PCI's pair response was stored as `"A,B"` and scored 0, and a spec-shaped record came back keyed by array index. `fromQtiVariableJson` returns a record in its typed form (each field `{ baseType, cardinality, value }`), takes an optional declaration for base-type names it does not know, and still accepts the earlier name-keyed record form. A PCI written against the previous shapes (pairs and points as `"A B"` strings, name-keyed records, numeric durations) must move to the spec binding. Record responses also keep list-valued fields as containers when a PCI reports them or a session restores them.
- fe86d42: Non-spec leniency removed from the processing engine and malformed rules fail loudly:
  
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
- fe86d42: `substring` now implements the QTI operator. Every supported version (QTI 2.1 §4.10, 2.2
  §2.12.3.46, 3.0 §2.11.3.46) defines it as a **boolean containment test** on exactly two string
  sub-expressions — true when the first expression is a substring of the second — with
  `caseSensitive` [1]: boolean = true (required `case-sensitive` in the 3.0 XSD), and NULL when
  either operand is NULL. The engine previously implemented an invented `(string, start, length) →
  string` extraction with 1-based indexing and an optional third operand, a shape no QTI version
  defines, so a spec-authored `<substring>`/`<qti-substring>` mis-scored on every path: with the
  spec's two string children it evaluated to invalid (read as false), and case-insensitive
  containment was unsupported entirely. Both failures were silent. Case folding follows
  `caseSensitive` the way `stringMatch` applies it (the host's string-comparison folds). Building
  the extraction shape now throws (`<substring> requires exactly two child expressions`).
  
  **Breaking:** content authored against the old start/length form (e.g.
  `<substring>ABCDE, 2, 2</substring>`, which is invalid QTI) no longer compiles — rewrite it per
  spec, e.g. with `substring`/`stringMatch`/`index` as the item intends. Content authored per spec
  scores correctly for the first time.
- fff7dd7: Spec-compliance fixes for attempt counting, new template instances, numeric `base` input and mapping a NULL container (QTI ASI §5.1, §10.3, stringInteraction `base`, mapping bounds).
  
  **Timing change, stated plainly (hosts that read `numAttempts` during processing):**
  
  - `numAttempts` on a non-adaptive item is now incremented at the start of a counted attempt, before response processing, as it already was for adaptive items (§5.1). Response processing and item outcome processing now read the attempt's own number: 1 on the first attempt, 2 on the second. Before, they read the count before the attempt (0 on the first attempt) and the increment came afterwards, so a rule such as "half credit when `numAttempts > 1`" never applied. The count after the attempt is unchanged: the action result, the session view and `serialize()` (both the top-level `numAttempts` and `contextVariables.numAttempts`) report 1 after the first counted attempt. Code that reads `numAttempts` while response processing runs, such as a custom operator, now sees the incremented value. `scoreAttempt` and an uncounted attempt (`countAttempt: false`) never increment. `submitAttempt` with `countAttempt: false` on a non-adaptive item no longer counts or finalizes the attempt, matching `endAttempt`. A restored session reads the count from `contextVariables.numAttempts`; a host that reopens an item for its next attempt must restore a state that carries the attempts already counted.
  
  **Scoring changes, stated plainly:**
  
  - `newTemplate` starts the new instance from the declared defaults and correct responses (§10.3 with §5.1). A correct response set by `setCorrectResponse`, or a default set by `setDefaultValue`, in the previous instance no longer carries into a draw whose template processing skips that rule; before, such a draw scored the declared key as wrong. `assessmentItemRef` `templateDefault` values still apply to every instance.
  - An `extendedTextInteraction` with a non-decimal `base` no longer changes its numeric response when the value reaches the session again. The base now applies only to text the candidate enters; a value that already is a number (the delivered extended-text component's response, which it converts from the typed text itself, a restored session, the declared correct response or default, a value read back from the session) passes through unchanged. Before, a base-16 answer `FF` (255) arriving as a number was read again as base-16 `255` (597) on entry and on every restore, and a base-2 answer restored as NULL; restored correct responses and defaults changed the same way.
  - `textEntryInteraction` now honours its `base` attribute for an integer or float response: `101` typed into a base-2 entry is 5. Before, it was read as decimal 101. The extracted interaction data carries `base` when it is not 10.
  - `mapResponse` and `mapOutcome` map a NULL multiple or ordered variable as the empty container: 0, clamped to the mapping's `lowerBound` and `upperBound`. Before, a NULL container returned the mapping's `defaultValue` unclamped, so an unanswered canonical multi-select with `defaultValue="-2" lowerBound="0"` scored -2 instead of 0 in rules that call `mapResponse` without an `isNull` guard. A NULL single value still takes `defaultValue`, now within the bounds like any unmapped value. `mapResponsePoint` treats a NULL point the same way. The standard `map_response` templates, which guard NULL with `isNull`, are unaffected.
- fe9e624: Spec-compliance fixes for the container operators, NULL operands, `round`/`truncate` and graphicGapMatch response validation (QTI ASI §5 and §15.3, graphicGapMatchInteraction).
  
  **Scoring changes, stated plainly (items whose response processing uses these operators can score differently):**
  
  - `contains(container1, container2)` now tests whether the first container contains the second: for multiple containers every value of the second, counted, must be in the first (`[A,B,C]` contains `[C,A]` but not `[B,B]`); for ordered containers the second must be a contiguous sub-sequence of the first (`[A,B,C]` contains `[B,C]` but not `[C,A]` or `[A,C]`). Before, the second operand was read as one value to look for, so `contains(RESPONSE, multiple(A, B))` was always false. A single value as the second operand still asks whether that value is in the container. Two containers of different cardinality are now invalid.
  - `delete` now reads its operands in QTI order: the value to remove first, the container second (`delete(A, {B,A,C,A})` is `{B,C}`). Before, the engine read the first child as the container, so content written in QTI order got NULL; content written in the old engine order (`<delete><variable/><baseValue/></delete>`) must swap its two children. Removing every value now gives NULL (the empty container), and values compare as `member` compares them (a `pair` ignores the order of its two identifiers).
  - NULL operands now propagate: `match`, `member`, `contains`, `stringMatch`, `patternMatch`, `lt`, `lte`, `gt`, `gte` and `not` result in NULL when an operand is NULL. Before, they returned false and `not(NULL)` returned true. `and` is false when any operand is false and otherwise NULL when any is NULL; `or` is true when any operand is true and otherwise NULL when any is NULL. A NULL condition is not true, so `responseIf(not(match(RESPONSE, correct)))` no longer takes its branch for an unanswered item: response processing continues with the `responseElseIf`/`responseElse` branches. An empty container or empty string is NULL, as QTI defines, in these operators and in `isNull`/`isNotNull`, `equal`, `equalRounded`, `durationLT`/`durationGTE` and `inside`; before, `isNull` was false for a cleared multiple response. `lt`/`lte`/`gt`/`gte` with a non-numeric operand, and `and`/`or`/`not` with an invalid operand, are now invalid instead of false or true.
  - `round` and `truncate` now result in an integer, as QTI defines (before: float). `match(round(x), <integer>)` is now true when the values agree and `match(round(x), <float>)` is now false; a `sum` or `product` of their results and integers is an integer. A float outcome still receives the value as a float. `roundTo` is unchanged.
  - `multiple` and `ordered` now ignore NULL sub-expressions and are NULL when every sub-expression is NULL. Before, each NULL sub-expression added a null value, which `containerSize` counted, which made `match` fail on length, and which made `statsOperator` NULL.
  
  **Validation change:**
  
  - Response validation now enforces a graphicGapMatchInteraction's `maxAssociations` and the `matchMax` of each gap choice (`gapText`, `gapImg`) and each hotspot (0 means no restriction). A response over a limit is invalid with an `invalid_shape` issue, as an extended-text response over `maxStrings` is: `dispatch({ action: 'endAttempt', validateResponses: true })` rejects it and the session cannot submit it until it is corrected.
- 816c8f8: Spec-compliance fixes for operator NULL semantics and the container-taking numeric operators (QTI ASI §5, §10.2 and §15.3, carried to QTI 2.2 and 3.0).
  
  **Scoring changes, stated plainly (items whose response processing uses these operators can score differently):**
  
  - `anyN` is now three-valued: it is false when more than `max` operands are true or more than n − `min` are false, true when at least `min` are true, and otherwise NULL when the NULL operands leave the result undetermined. With `min` 3 and `max` 4, `{true,true,false,NULL}` is NULL, `{true,false,false,NULL}` is false and `{true,true,true,NULL}` is true. Before, NULL operands counted as false. A NULL `anyN` is not true, so the enclosing condition falls through like any other NULL condition. `anyN`'s `min` and `max` are `integerOrVariableRef`, so they may now name a template variable (`min="THEMIN"` or `min="{THEMIN}"`); before, a variable reference silently fell back to the defaults.
  - `max`, `min`, `gcd` and `lcm` now accept single, multiple and ordered operands and range over every value of a container: `max({1,5,3})` is 5 and `gcd({12,18})` is 6. Before, a container operand made the result NULL. An operand that is not a numerical value — including an empty container, which QTI reads as NULL — now gives NULL, as the spec defines, instead of an error.
  - `divide` by 0, `integerDivide` and `integerModulus` by 0, and a `divide` or `power` result outside the float range now result in NULL, as the spec requires, instead of an error. `integerDivide` now rounds x/y down to the greatest integer not above it (-7/2 is -4), matching `integerModulus`'s x − z·y, instead of truncating towards zero (-3).
  - An empty string is NULL in every numeric operator (`sum`, `product`, `subtract`, `divide`, `power`, `mod`, `integerDivide`, `integerModulus`, `max`, `min`, `gcd`, `lcm`, `mathOperator`, `roundTo`), as QTI reads empty strings as NULL (ASI §5). Before, it coerced to 0, so `subtract("", 3)` was -3 and `sum("")` was 0.
  - `substring` now results in NULL for a NULL string, start or length — the empty string included — instead of an error. A start past the end still gives the empty string.
  - Each `mapEntry` is now matched as case sensitively as its own `caseSensitive` attribute says: a case-sensitive entry matches only its own spelling, so a response in another case takes the mapping default. Before, the lookup also tried the response lower-cased, so a response "A" could match a case-sensitive entry "a".
  
  **Template scoring change:**
  
  - The built-in `map_response` (and `map_response_point`, `CC2_map_response`) templates now score a cleared response 0: their NULL test reads an empty container as NULL too, matching the official template programs, so a cleared multi-select no longer maps to a value that `lowerBound` can clamp above 0. Before, a cleared multi-select with `lowerBound="1"` scored 1; now it scores 0, as the official template's `isNull` branch gives. A non-empty response is still mapped within the bounds.
  
  **API:**
  
  - `@pie-qti/qti-processing` exports `isNullValue(value)`, the QTI NULL test the operators use: true for NULL, an empty container and an empty string.
- 9cb24ad: Spec-compliance fixes for mapping string matching and the integer division operators (QTI 2.2 XSD, ASI §15.3 and §17).
  
  **Scoring change, stated plainly (items that map string responses can score differently):** a mapping that authors no `caseSensitive` now matches case-insensitively, as the spec default (`mapEntry@caseSensitive` is optional with `default="false"` in the QTI 2.2 XSD; the QTI 3.0 implementation guide has mapping "by default, NOT case sensitive"). Before, the default matching was case-sensitive, so a typed "Photosynthesis" missed a `photosynthesis` entry and took the mapping default; now it matches and scores the entry's mapped value. Items relying on the old case-sensitive default matching must author `caseSensitive="true"` on the entry (or the mapping element, which the player reads as leniency) to keep matching exactly. Mapping a container also counts once the values a case-insensitive entry matches together: `{Paris, paris}` maps Paris once, not twice. Identifier and the other non-string base types always match exactly, whatever `caseSensitive` says (ASI §17).
  
  **Operator fixes:**
  
  - `integerDivide` and `integerModulus` now divide their operands as they are, without truncating them to integers first. `integerDivide(6.9, 1.9)` is 3 (the spec's floor of 6.9/1.9; before, 6), `integerDivide(-6.9, 1.9)` is -4 (before, -6), and `integerDivide(5.5, 0.9)` is 6 (before, NULL — only an actual zero divisor is NULL). The identity x = `integerDivide(x,y)`·y + `integerModulus(x,y)` now holds for float operands too. Integer operands are unchanged: -7 `integerDivide` 2 is still -4 and its `integerModulus` is still 1.
- d7d744e: - **textEntryInteraction@stringIdentifier is implemented** (QTI 2.1/2.2 ASI §5.122.3; `string-identifier` in QTI 3.0). A text entry bound to a numeric response can also capture the text as entered in a companion string response: typing "3.50" sets the float response to 3.5 and the named string response to "3.50" (with `base="2"`, "101" where the integer response is 5); an empty field gives NULL. Response processing can score that text with `stringMatch`, and a restored session shows it in the field instead of the coerced number. Completion and validation still read the main response only, and a `stringIdentifier` that repeats `responseIdentifier` or names no declared response is ignored, as extendedTextInteraction already does.
  - **`<inside shape="default">` compiles.** The `default` shape is the entire area of the image and takes no coordinates, so `coords=""` or absent no longer throws "<inside> requires coords attribute"; every point evaluates inside it. Every other shape still requires its coords.
  - **Text-entry blanks no longer force horizontal scrolling** (WCAG 2.2 SC 1.4.10 Reflow): the input gains `max-width: 100%`, so an authored `expectedLength` wider than the viewport keeps the blank inside its container at 400% zoom. Its width is otherwise unchanged.
- de1eed5: `patternMatch` and the `patternMask` input check now read patterns as XML Schema regular expressions, as QTI specifies, instead of as JavaScript ones. These patterns now behave as the XSD standard defines them:
  
  - `^` and `$` are ordinary characters, because an XSD pattern always matches the whole response. `^abc$` matches the text `^abc$`, not `abc`.
  - `.` matches any character except a newline or carriage return.
  - `\s` matches only a space, tab, newline or carriage return, so a non-breaking space no longer counts.
  - `\w` matches any character except punctuation, separators and control characters. Accented letters and symbols such as `+` now count, and `_` no longer does.
  - `\i` and `\c` (XML name characters) and their complements are supported.
  - Block escapes such as `\p{IsBasicLatin}` are supported.
  - Character class subtraction such as `[a-z-[aeiou]]` is supported.
  
  Patterns that use none of these constructs match as before.
  
  End-attempt buttons such as "Show a hint" now give response processing the values QTI specifies. When the candidate ends the attempt with one of these buttons, its response is `true` and every other end-attempt response is `false`. When the attempt ends any other way, for example by submitting, every end-attempt response is `false`. Before this change, a hint pressed in an earlier attempt still read as `true` in later attempts, so its feedback could show again. An end-attempt response that was never pressed read as `NULL` or as its declared default, which QTI says to ignore.
  
  A `gapMatchInteraction` gap marked `required="true"` must now be filled before the response counts as complete, as QTI specifies. The interaction data lists these gaps as `requiredGaps`. Response validation (`canSubmit` and the assessment player's `validateResponses` check) reports the response incomplete while a required gap is empty.
  
  Response validation now enforces `patternMask` on text entry and extended text responses, as QTI specifies: a response must match the pattern to be valid. A `string` response with any text that does not match is reported invalid, both by `canSubmit` and by the assessment player's `validateResponses` check. Numeric responses store the number rather than the typed text, so for them only the text entry field's own check applies.
  
  An `inlineChoiceInteraction` marked `required="true"` now needs a selection before its response counts as complete, as QTI specifies. The same applies to a QTI 3.0 dropdown with `min-choices` of 1 or more. The interaction data carries the requirement as `minChoices`. An unanswered dropdown that is not required stays valid, and its empty first option can still be selected.
  
  A `gapMatchInteraction` with `minAssociations` (QTI 2.2 and 3.0) now needs at least that many pairs before its response counts as complete. The interaction data carries the value as `minAssociations`.
- a1c989d: String answers now compare as QTI defines them. `match`, `member`, `contains`, `delete`, `stringMatch` and `mapResponse` entry lookup compare `string` values for equality: `match` is true "if the two expressions represent the same value" (QTI 3.0 §6.9.21). Case folds only where the item asks for it, through `stringMatch` with `caseSensitive="false"` or a `mapEntry` whose `caseSensitive` is false (its default). Both values are composed to Unicode NFC first. QTI is silent on normalization, and canonically equivalent text must not be treated as distinct (Unicode conformance clause C6), so `é` typed with a combining accent still matches `é`.
  
  The new delivery option `stringComparison` lets a host opt in to more folding. You can set it on `createAssessmentItemDefinition` (client and server entry points), on the `ItemPlayer` component and the `<pie-qti-item-player>` element, on `AssessmentPlayer.create` (or the `config` of the assessment shell and of `<pie-qti-assessment-player>`), on `ReferenceBackendAdapter` and on `scoreAssessmentItem`:
  
  - `foldScriptInput: true` removes bidi controls (ALM, LRM, RLM, embeddings, overrides, isolates) and tatweel. It folds Arabic presentation forms to their base letters, every script's decimal digits to 0–9, and the Arabic decimal and thousands separators to the content language's marks.
  - `foldLetterVariants: true` folds Arabic spelling variants: hamza and madda alef forms become bare alef, tashkeel is removed, ة becomes ه and ى becomes ي.
  
  Give the player and the scoring backend the same value. Numbers typed into `integer` and `float` responses read digits in any script and the Arabic separators either way. `patternMatch` and `patternMask` always test the text as entered.
  
  Breaking: before this change, string comparisons always folded script input. A string answer that matched only because of that fold now scores as non-matching. Examples are an answer typed with tatweel, a bidi mark or Arabic presentation forms, or a string answer typed with Arabic-Indic digits. To restore the earlier scoring, set `stringComparison: { foldScriptInput: true }` on the player and on the scorer. For example, use `createAssessmentItemDefinition({ itemXml, stringComparison: { foldScriptInput: true } })` and `new ReferenceBackendAdapter({ stringComparison: { foldScriptInput: true } })`.
  
  Breaking: `normalizeResponse` from `@pie-qti/qti-processing` now folds script input only when called with `foldScriptInput: true`. Without it, the function returns the text composed to NFC, and case-folded when `ignoreCase` is set. `foldLetterVariants` is now independent of `foldScriptInput`. It was documented as "an authoring choice per response", but no authored attribute or element ever set it. It is now the host option `stringComparison.foldLetterVariants`.
  
  When `mapResponse` maps a container, a string value that no `mapEntry` matches now keeps its case: `{London, LONDON}` counts as two values, each with the mapping's `defaultValue`. Values that a case-insensitive entry matches still count once.
  
  A `graphicGapMatchInteraction` with `minAssociations` (QTI 2.2; `min-associations` in QTI 3.0) now needs at least that many associations before its response counts as complete. Response validation (`canSubmit`, and `endAttempt` with `validateResponses`) reports a response with fewer associations as incomplete. The interaction data carries the value as `minAssociations`. An absent attribute or `0` sets no minimum.
- 30bc3bf: Authored XSD patterns (`patternMatch`) ran against candidate content with no subject-length cap, so a long response against a pattern with a nested quantifier (`(a+)+`) could take exponential time and hang the delivery tab. Subjects now skip the pattern beyond a documented cap — `MAX_PATTERN_SUBJECT_LENGTH` (10,000 UTF-16 code units), exported with the `isPatternSubjectWithinCap` predicate from the runtime (and the package root) so every site that runs an authored pattern shares one guard. The QTI spec is silent about response length; this is a divergence guard, not spec behavior: at or below the cap patterns run exactly as the XSD pattern language defines, above it `patternMatch` reads the skip as the pattern not matching (patternMask validation, which lives in the item player's response validation and calls the compiled `RegExp` itself, should read it as the text passing unmasked and can adopt the same exported predicate). A subject at the cap behaves unchanged; tests pin the cap boundary and a beyond-cap subject returning immediately under a catastrophically backtracking pattern.
- fe86d42: Compiled-pattern reuse on the hot path (no behavior change):
  
  - `xsdPatternToRegExp` (qti-processing) translates and compiles an authored XSD pattern on every
    call, and `patternMatch`/`patternMask` validation runs per keystroke while authored patterns are
    static per item. Each (pattern, flags) pair is now compiled once and its `RegExp` shared
    through a bounded module-level memo (cleared past 512 entries, so a stream of distinct patterns
    cannot grow it without bound; cached `RegExp`s are stateful-free since no caller compiles with
    `g`/`y`). Failed compiles are cached too.
  - Feedback rendering (qti-common `processFeedbackInline`/`feedbackInlineAttr`) built a fresh
    `RegExp` per attribute lookup per feedback element per keystroke; the matchers for an attribute
    name (both QTI spellings) are now compiled once and shared, through the same bounded-memo
    shape. `feedbackInlineAttr` is now exported from `@pie-qti/qti-common` so hosts and tests can
    use the same reader.
- 1449b94: Phase 4 (item-player) of the player cleanup: remove duplication with no QTI-observable change.
  
  - `@pie-qti/item-player`: one `escapeHtmlAttribute` (exported from the `security` subpath), one clone/freeze family (`cloneValue`, `deepFreezeInPlace`, `frozenSnapshot`), one `mergeDeliveryFields`, one name-mapper resolution (`resolveNameMappers`, `elementNameMapperForVersion`, `attributeNameMapperForVersion`, `defaultExtractionMappers`), shared PCI `resolvePciModuleUrl`/`pciEntryModule`, one `readResponseIdentifier` response-binding lookup behind interaction detection, slot hiding and diagnostics, and root exports for `patternExcludesMinus`/`classExcludesMinus`. All additions; no export moved or disappeared.
  - `@pie-qti/qti-processing`: adds `parseMatchTableDeclaration`/`parseInterpolationTableDeclaration` (the outcome-declaration lookup-table parser with a required name mapper; values stay lexical, `lookupOutcomeValue` still coerces).
  - `@pie-qti/default-components`: the extended-text keyboard now imports `patternExcludesMinus` from `@pie-qti/item-player` instead of keeping its own copy.
- 281d6fb: Remove the processing elements no QTI version defines from the expression/rule builder. All were
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
- 0bdb7f1: QTI parsing now follows the spec's own grammar: content that no QTI version (2.1, 2.2 or 3.0) defines is no longer silently tolerated. Per the project's pre-1.0 policy there is no compatibility surface for invalid content.
  
  Breaking: the following were accepted before but are invalid per the QTI XSDs, and now error (or stop matching) instead:
  
  - **ISO 8601 durations in item XML** (`<baseValue baseType="duration">PT1H</baseValue>`): QTI binds item-XML durations to `xsd:double` seconds, so write `3600`. ISO 8601 (`PT90S`) remains the required encoding at the PCI v1.0 Appendix A variable-JSON boundary, which is unchanged.
  - **`equalRounded` roundingMode misspellings** (`significantFigure`, `decimalplace`): the XSDs enumerate exactly `decimalPlaces` and `significantFigures` (default `significantFigures`); any other spelling now fails item compilation.
  - **Child-element `randomInteger`/`randomFloat`**: they are empty elements in every QTI version — `min`/`max`/`step` are attributes; the legacy form that passes `min`/`max` as child expressions now fails compilation (`max` is a required attribute).
  - **`<console>` in responseProcessing**: defined by no QTI version; it now fails compilation instead of being ignored as a no-op.
  - **`caseSensitive` on `<mapping>`**: `caseSensitive` exists on `mapEntry` only. A mapping-level attribute is no longer read; entries without their own `caseSensitive` match case-insensitively, which is the XSD default. Identifier values keep matching exactly.
  
  Fix: `randomInteger` and `randomFloat` now default an absent `min` to 0, as every QTI version defines (only `max` is required, and `randomInteger`'s `step` still defaults to 1). A valid `<randomInteger max="10"/>` previously failed to compile.
- 7c767d4: **Breaking: `OperatorRegistry` is removed from `@pie-qti/qti-processing`, and `EvalEnv` loses its `ops` field** (beta prerelease). The evaluator never read it: every built-in operator is an inline `switch` case in the evaluator, `<customOperator>` dispatch uses the separate `EvalEnv.customOperators` record, and nothing could ever be registered that had an effect — so every caller just constructed an empty registry to satisfy the type. Hosts that build an `EvalEnv` drop the `ops: new OperatorRegistry()` entry; hosts that import `OperatorRegistry` remove the import. Nothing else migrates: the fields that matter (`ctx`, `rng`, `language`, `stringComparison`, `customOperators`, `test`) are unchanged, and scoring is identical. The players' internal environments (`processingEnv`, the test-level expression evaluator, the adapter's outcome-processing run) already dropped the field with it.
  
  Also deduplicates the point-in-shape geometry (rect, circle, ellipse, poly hit tests) that `<inside>` and `mapResponsePoint` each carried as their own verbatim ~55-line copies in the evaluator: both operators now share one module-scope implementation, pinned by tests covering every shape on both operators (boundary inclusivity, zero radii, malformed polygon coords), so the two can no longer drift apart.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [310b975]
- Updated dependencies [30bc3bf]
- Updated dependencies [99341e5]
- Updated dependencies [fe86d42]
- Updated dependencies
  - @pie-qti/qti-common@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [a4ef12c]
- Updated dependencies [406c76c]
  - @pie-qti/qti-common@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- @pie-qti/qti-common@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- a202037: Response processing reads responses in the item's content language: string comparisons and mapping keys ignore bidi controls, tatweel and Unicode encoding differences, case-insensitive comparisons fold case in that language, and numbers accept digits in any script, the Arabic separators and the language's decimal mark. `EvalEnv` takes an optional `language`, and `coerceBaseValue` an optional third argument. Stored responses are unchanged.
- dba1477: `patternMatch` and the text-entry `patternMask` follow XML Schema pattern rules: a pattern must match the whole response, and `\d` matches decimal digits in any script. `patternMatch` reads its pattern from the `pattern` attribute, including a `{TEMPLATE}` reference, where it previously required a second child expression and failed to build otherwise. `xsdPatternToRegExp` and `xsdPatternSource` are exported from `@pie-qti/qti-processing`.
- Updated dependencies [5dbabcc]
  - @pie-qti/qti-common@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- @pie-qti/qti-common@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- 65e62f6: Fix `mapResponsePoint` container scoring: each mapped area now contributes its value at most once when a multiple-cardinality point response contains several points inside the same area, per QTI §2.11.1.6 ("each area can be mapped once only"). Overlapping areas keep first-listed priority (§5.5.4), which is unchanged.
- f20a87e: `interpolationTable` is a step lookup per QTI: the first entry in document order whose `sourceValue` the source exceeds, or equals unless `includeBoundary="false"`, else `defaultValue`, else NULL. Lookup results and `defaultValue` take the outcome's base type, `interpolationMethod` is gone, and `qti-match-table` and `qti-interpolation-table` build.
- 30b045d: Test-level outcome processing sees every delivered item with its typed variables, section path, categories, weights, declared normal bounds and presented/responded/correct/incorrect/selected flags, so `numberResponded`, `numberSelected`, `numberCorrect` without `MAXSCORE`, section and category filters and weighted `testVariables` evaluate as authored. Item scoring reports `correct`; `outcomeMinimum`/`outcomeMaximum` read `normalMinimum`/`normalMaximum`.
- 0edef83: Resolve external QTI processing fragments during packaged assessment delivery.
  
  `xi:include` fragments referenced by an item's `responseProcessing`, `templateProcessing`, or `outcomeProcessing` are now preloaded from the content package during reference-mode assessment parsing and executed through a package-contained resolver, so packaged fragments work without host wiring. Nested includes resolve relative to the fragment that references them, and authored `xi:fallback` content runs when a fragment file is missing. The processing engine now requires the XInclude namespace for `include` and `fallback` elements and fails loudly when another vocabulary uses those local names. Test-scope (`scope: 'test'`) fragments still require a host-supplied resolver and fail closed, unchanged.
- c785703: Show `testFeedback` at test and test-part level by typed outcome values, single or multiple, with `access="during"` during the test and `atEnd` at the end of the test or its part. The backend contract returns `outcomes` from `submitResponses`, a resumed `initSession` and `finalizeAssessment`; `sum` and `product` accept multiple and ordered containers; QTI 3 items score under their own identifier.
- Updated dependencies [32c08b7]
- Updated dependencies [0f93a03]
- Updated dependencies [a7c714e]
  - @pie-qti/qti-common@1.0.0-beta.0

## 0.1.28

### Patch Changes

- Updated dependencies [6af3354]
- Updated dependencies [8fd28e3]
  - @pie-qti/qti-common@0.1.28

## 0.1.27

### Patch Changes

- Updated dependencies [498b1e2]
  - @pie-qti/qti-common@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [5627ce1]
  - @pie-qti/qti-common@0.1.26

## 0.1.25

### Patch Changes

- 0bb51e3: Move the Node XML parser to `@xmldom/xmldom` 0.9. Where no native `DOMParser` exists, XML that is not well-formed — a raw `<` in an attribute value, a second XML declaration — now throws a `ParseError` instead of yielding a partial document, matching what browsers already did.
- @pie-qti/qti-common@0.1.25

## 0.1.24

### Patch Changes

- Updated dependencies [5c8a8e8]
- Updated dependencies [67e4c23]
  - @pie-qti/qti-common@0.1.24

## 0.1.23

### Patch Changes

- @pie-qti/qti-common@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/qti-common@0.1.22

## 0.1.21

### Patch Changes

- 8836ebf: Keep integer arithmetic integer-typed in processing. Per QTI 2.2 `sum`, `subtract`, `product`,
  `max` and `min` yield an integer when every sub-expression is an integer, and a variable holds
  values of its declared base-type. Both were widened to float, and because `match` is base-type
  strict, a template variable such as `ANSWER = sum(A, B)` declared `baseType="integer"` stopped
  matching an integer `RESPONSE` — a correct answer scored 0. Assignments now conform to the
  declaration's numeric base-type; a fractional value assigned to an integer declaration is left
  alone so the authoring error still surfaces.

  Hide `positionObjectStage` from the item body. The stage owns the background object and wraps its
  interactions, all of which the component renders, so matching only the interaction inside it left
  the background image drawn a second time above the interaction.

  Stop the rich-text editor reporting editability changes as content edits. Tiptap's
  `setEditable(editable, emitUpdate = true)` emits `update` with an empty transaction, so toggling
  `editable` looked like a learner edit to the host; `onUpdate` now requires `transaction.docChanged`
  and the editability sync passes `emitUpdate: false`.

  Pin the `@pie-players/*` toolkit dependencies to one version. They share a `pie-context`
  singleton, so bumping a single member installs two copies and the section player's toolbar icons
  stop resolving. Moving the set to 0.3.65 additionally needs code changes, as it no longer exports
  `createPackagedToolRegistry`.

- 2c00bd1: Initialize numeric outcome variables to 0 when no default is declared. Per QTI 2.1 §5.2, carried
  into 2.2 and 3.0, an outcome with no `<defaultValue>` initializes to NULL unless its base type is
  `integer` or `float`, where it initializes to 0. Every defaultless outcome was initialized to NULL,
  so accumulating response processing such as `SCORE = sum(SCORE, 1)` propagated NULL and the item
  never scored: 1EdTech acceptance criteria Q12-L2-D3/D4/D5 require `SCORE` of 1, 0 and 2 for the
  composite inline-choice sample, and pie-qti returned NULL for every response set. The rule is
  applied at parse time, so it also governs the reset before each response-processing run and the
  `<default>` expression. Response and template variables are unaffected — an unanswered numeric
  response must stay distinguishable from an answered zero — and an authored `<defaultValue>` still
  wins. `@pie-qti/assessment-player` already applied this rule to test-level declarations; item and
  test level now agree.

  A `MAXSCORE` declared without a default is consequently 0 rather than absent, so an item that never
  assigns it scores against a maximum of zero. Substituting 1 inside response processing would make
  this engine disagree with a conformant one, so the value stands and the player warns once per item,
  naming the item and the remedy. `ScoringResult.maxScore` still falls back to `1.0` when `MAXSCORE`
  is not declared at all, which the spec leaves open.

  `Declaration` gains `impliedNumericDefault`, marking a `defaultValue` that came from this rule
  rather than from the author.

  Remove the unused `core/declarations.js` exports (`initializeDeclarations`, `addDeclaration`,
  `addMapping`, `addAreaMapping`, `getVariableValue`, `setVariableValue`, `resetDeclarations`,
  `cloneDeclarations`, `DeclarationsContext`) and `BUILTIN_DECLARATIONS`. Nothing in the framework
  called them; they were a second declaration model that took no response/outcome kind, so they could
  not carry the numeric-outcome rule and would have kept returning NULL defaults. `BUILTIN_DECLARATIONS`
  also described built-ins the runtime does not use and typed `completionStatus` as `string` where the
  runtime seeds `identifier`. Hosts that built declaration maps by hand should use
  `createAssessmentItemDefinition()` and the session interface instead.

  - @pie-qti/qti-common@0.1.21

## 0.1.20

### Patch Changes

- Updated dependencies [1cd0aff]
  - @pie-qti/qti-common@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/qti-common@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/qti-common@0.1.18

## 0.1.17

### Patch Changes

- @pie-qti/qti-common@0.1.17

## 0.1.16

### Patch Changes

- 5a4e39a: Normalize `repository.url` to the `git+https://` form.

  npm was rewriting this field at publish time and warning about it:

  ```
  npm warn publish "repository.url" was normalized to "git+https://github.com/pie-framework/pie-qti.git"
  ```

  Beyond silencing that warning, npm requires `repository.url` to match the GitHub
  repository exactly when generating provenance attestations, so this is a prerequisite
  for moving publishing to trusted publishing (OIDC). No runtime or API change.

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.
- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
  - @pie-qti/qti-common@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/qti-common@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/qti-common@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/qti-common@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
