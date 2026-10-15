# QTI 3 Native Delivery and Accessibility Plan

**Status**: Planned
**Last reviewed**: 2026-10-14
**Scope**: `packages/item-player/`, `packages/assessment-player/`, `packages/qti-processing/`,
`packages/qti-common/`, `packages/section-player/`, `packages/default-components/`,
`packages/web-component-loaders/`, `packages/player-elements/`, `packages/to-pie/`,
`packages/pie-to-qti2/`

Brings native delivery, the item and assessment players rendering QTI directly, up to what QTI
2.2 and 3.0 Advanced Delivery and 3.0 Elevated Accessibility certification exercise. The
[QTI 3, accessibility content and passages plan](qti3-accessibility-passages-2026-10.md) made
conversion to PIE complete; this plan covers the constructs the players parse but do not
evaluate, the accessibility markup that only conversion understands, and a QTI 3.0 writer for
the PIE→QTI export. Slices run in certification-impact order. The conversion deferrals recorded there (companion materials →
`requiredTools`, `passageVId`, APIP `inclusionOrder`, PCI in to-pie) stay out.

---

## Slices

| #   | Slice                                          | Branch                                | PR  | State   |
| --- | ---------------------------------------------- | ------------------------------------- | --- | ------- |
| 0   | This plan                                      | `docs/qti3-native-delivery-plan`      | #300 | merged  |
| 1   | Item-body pass and printed variables           | `feat/item-body-printed-variables`    | #307 | merged  |
| 2   | Inline feedback                                | `fix/feedback-inline-native`          | #309 | merged  |
| 3   | Feedback and template blocks; modal feedback   | `feat/feedback-template-blocks`       | #311 | merged  |
| 4   | Test feedback outcomes                         | `fix/test-feedback-outcomes`          | #315 | merged  |
| 5   | Outcome-processing inputs                      | `fix/outcome-processing-inputs`       | #317 | merged  |
| 6   | Lookup tables                                  | `fix/lookup-table-semantics`          | #318 | merged  |
| 7   | Test structure and item session control        | `feat/test-structure-session-control` | #321 | merged  |
| 8   | TTS and SSML in delivery                       | `feat/delivery-tts-ssml`              | #323 | merged  |
| 9   | Content language                               | `feat/delivery-content-language`      | #325 | open    |
| 10  | PNP in delivery                                | `feat/delivery-pnp`                   | #326 | open    |
| 11  | Shared vocabulary, catalogs and sanitizer      | `feat/delivery-vocabulary-catalogs`   |     | pending |
| 12  | Element map completion                         | `fix/qti3-element-map`                | #301 | merged  |
| 13  | QTI 3.0 writer                                 | `feat/pie-to-qti2-qti3-writer`        | #302 | merged  |

States: `pending`, `in progress`, `open` (PR up, merge agent running), `merged`, `blocked`
(with a one-line reason under the slice).

---

## Position

Measured on 2026-10-14 against `develop` at `709a13f`. The private runner was green on all four
QTI 2.2 and 3.0 Basic and Advanced Delivery suites at 0.1.21 with every gap below present, so
those suites do not exercise these constructs and are not evidence for them.

**Native rendering.** The item player never normalizes QTI 3 to 2.x. `Qti3ElementNameMapper`
locates structural elements; the item body is serialized raw, and the sanitizer keeps `qti-*`
elements as inert unknown elements. Every item-body construct below is therefore handled by
regex over serialized HTML, mostly in its 2.x camelCase spelling only.

**Printed variables.** `renderPrintedVariables` matches `<printedVariable>` only and reads
`identifier` only. `format`, `base`, `index`, `powerForm`, `field`, `delimiter` and
`mappingIndicator` are ignored; NULL prints empty, containers join with `, `, a record prints
`[object Object]`. It runs for the item body and direct rubric blocks; modal feedback never
substitutes, in either version.

**Conditional content.** `feedbackInline` is a non-greedy regex reading camelCase attributes, so
QTI 3 spellings and nested feedback fail. `feedbackBlock`, `templateBlock` and `templateInline`
are never evaluated in either version. Modal feedback compares `outcomeValue === identifier`, so
membership in a multiple-cardinality outcome never matches, and nested `feedbackInline` inside it
is not processed. Choice-level `templateIdentifier`/`showHide` is ignored, and template variables
are not substituted into MathML. `contextDeclaration` and `QTI_CONTEXT` are not read.

**Test feedback.** `finalizeAssessment` computes test outcomes, uses them for `totalScore`, and
returns none, so `atEnd` feedback sees an empty outcome map. Visible feedback is computed only on
submit and shown only once complete, so `access="during"` never shows. Only root `testFeedback`
is parsed; `testPart` feedback has no field.

**Outcome-processing inputs.** The reference backend passes each scored item as
`{identifier, variables}`, numbers as float and everything else stringified. Response variables,
built-ins, section identifiers, categories, weights and the presented/responded/selected flags are
absent, so `numberResponded` and `numberSelected` are always 0, `numberCorrect` works only when
`MAXSCORE` is declared, section and category filters match nothing, and weights have no effect.
Weights are parsed as an array where `TestItemState` expects a record. `outcomeMinimum` and
`outcomeMaximum` read current values instead of declared `normalMinimum`/`normalMaximum`.

**Lookup tables.** `interpolationTable` interpolates linearly through a non-QTI
`interpolationMethod`, clamps to the end entries, ignores `includeBoundary`, returns float only,
and uses `defaultValue` only for an empty table. `matchTable` parses `defaultValue` with
`Number()` and does not coerce the target to the outcome's base type. The AST builder compares
the lowercased local name against `matchtable` and `interpolationtable`, so `qti-match-table`
and `qti-interpolation-table` throw and the item fails to load.

**Test structure.** The backend parser normalizes names, so 2.x and 3 behave alike. On item refs,
`itemSessionControl`, `category`, `variableMapping` and `templateDefault` are not parsed, and
`weight` is parsed and unused. Section `keepTogether` and `branchRule`, and `testPart`
`branchRule` and `preCondition`, are not parsed; G-16 tracks the dynamic rules. Effective
`itemSessionControl` merges the test part with the innermost section only, from the first test
part only; when neither carries settings the previous item's settings persist, and undefined
values overwrite inherited ones. `maxAttempts` defaults to unlimited against the spec's 1 and is
not enforced; `showFeedback` and `showSolution` never reach the item player; `allowReview` checks
the current section instead of the target item's; `validateResponses` is skipped in simultaneous
mode; `allowComment` is unimplemented. The backend's `nextItemIdentifier` follows source order,
and individual mode follows it, so selected or shuffled delivery steps to the next source item.
The drawn order is not persisted and is redrawn on resume. `api-contract.ts` documents
server-side selection and ordering that the reference backend does not perform.

**TTS and SSML.** `data-qti-suppress-tts`, `data-ssml` and inline SSML are understood by to-pie
only. The section player's readable projection keeps the text of `ssml:*` and drops its
semantics, matches QTI 2 names only (a QTI 3 item projects nothing), covers prompts and choices
but not stem text, and ignores suppression.

**Language.** Item and `itemBody` `xml:lang` are never read; the item body takes `lang` from the
i18n locale, and none without a provider. Inner `xml:lang` passes through unmapped. The section
toolbar hardcodes `language="en-US"` and voice `Joanna`. Glossary-on-screen and illustrated
glossary look up catalog cards with no language, so a card holding only language-tagged entries
returns nothing and the button is inert.

**PNP.** `parsePnpXml` keeps the whole AfA record; `pnpProfileFromAfa` projects colour theme,
magnification, glossary, keyword translation, the illustration extension, thirteen catalog
supports and extended time. `answer-masking` maps to the elimination tool, a semantic mismatch:
masking hides options. Language of interface, invert polarity, single-column layout, line reader,
masking, calculator, text appearance beyond colour theme, `spoken` as TTS activation, fixed-minute
extra time, dictionary and highlighter are dropped. `applyPnp` sets `data-qti-colorscheme`,
`data-qti-magnification` and `--qti-magnification`; no CSS consumes them. Companion materials
appear only in the element map; the calculator comes from host configuration.

**Shared vocabulary.** `qti-shared-vocabulary.css` covers underline, bordered, alignment
(without justify), vertical alignment, well, layout grid, hidden, visually-hidden, italic and the
display/margin/padding/width utilities. Missing: `qti-writing-orientation-*`,
`qti-text-orientation-*`, `qti-list-style-type-*`, `qti-labels-*`, `qti-labels-suffix-*`,
`qti-choices-left|right|top|bottom` (emitted as classes with no rules), `qti-unselected-hidden`,
`qti-fullwidth` and `qti-heading`.

**Catalogs and sanitizer.** The catalog extractor takes the first `qti-html-content` or
`qti-file-href` per card, HTML first, and a file href becomes a bare URL. The sanitizer preserves
`aria-*`, `alt`, `role` and `lang`, except where `<object type="image/*">` becomes `<img>` and
drops them. Interaction-level `aria-*` is not carried to the rendered controls.

**Element map.** `qti3-element-mappings.ts` lacks 37 of the ASI schema's `qti-*` elements,
among them `qti-assessment-section-ref`, `qti-assessment-stimulus`, `qti-stimulus-body`,
`qti-item-session-control`, `qti-time-limits`, `qti-selection`, `qti-ordering`,
`qti-branch-rule`, `qti-pre-condition`, `qti-test-feedback`, `qti-template-default`,
`qti-variable-mapping`, `qti-weight` and `qti-integer-to-float`, and lists six the schema does
not declare. The `toCanonical` fallback strips prefix and hyphens, which equals the canonical
name, so the gaps break `toNative` and `isQti3Element` only.

**QTI 3 export.** `pie-to-qti2` writes `imsqti_v2p2` throughout: sixteen item and passage generators build
QTI 2.2 by string template, passages are interaction-less `assessmentItem`s, catalogs are written
as APIP access elements with a warning for what APIP cannot carry, and manifest resource types are
`imsqti_*_xmlv2p2`. The only QTI 3 output is the lossless re-emit of an unedited QTI 3 source.
G-25 and the open question in [`pie-to-qti.md`](../prds/architecture/pie-to-qti.md) record it.

---

## Decisions

**One item-body pass by canonical name.** The item player parses the item body once and walks it
by canonical element name, resolving `printedVariable`, `feedbackInline`, `feedbackBlock`,
`templateInline` and `templateBlock` in place, because regex over serialized HTML cannot match
nested elements or both spellings. Rubric blocks and modal feedback go through the same pass, so
substitution and conditional display behave identically wherever content appears.

**Shared visibility rule.** Feedback and template visibility use one function in `qti-common`:
`identifier` matches a single value by equality and a container by membership, and `showHide`
inverts it. Item feedback, modal feedback and test feedback all call it.

**Typed outcomes from finalize.** `finalizeAssessment` returns outcome values with base type and
cardinality, because a stringified map cannot express membership. The contract change ships as a
patch: pre-1.0, and the field was never populated.

**Backend owns order.** The reference backend draws selection and ordering at session start,
persists the drawn order in session state, and returns `nextItemIdentifier` from it; the client
stops drawing. This makes the `api-contract.ts` claim true and survives resume.

**G-16 is extended, not duplicated.** Slice 7 parses the remaining test-structure attributes and
fixes session-control enforcement; dynamic `preCondition`, section and test-part `branchRule`,
and `withReplacement` stay in G-16 and slice 7 lands them there. G-22 keeps time-limit scope
clocks; slice 7 adds the lock on expiry only.

**One accessibility-markup mapping.** to-pie's suppress-TTS and SSML handling moves into
`qti-common` beside the APIP mapping, and the section player's projection uses it, so conversion
and delivery read the same markup the same way.

**Content language flows from the item.** The nearest `xml:lang` becomes the rendered `lang`, the
toolbar language and the catalog lookup language; the i18n locale applies only where content
declares none. Voice follows language: the section player picks the Polly voice for the content
language unless the host configures one.

**Colour schemes ship with the shared vocabulary.** The `[data-qti-colorscheme]` rules live in
`default-components` next to `qti-shared-vocabulary.css` and load through `default-runtime.css`,
so a host gets them with the default runtime and can override them by custom property. They are
the theming deliverable [`pnp.md`](../prds/systems/pnp.md) names and must pass WCAG 1.4.3.
Magnification stays with browser and OS zoom, as `pnp.md` decides; `data-qti-magnification` and
`--qti-magnification` stay for hosts that style them.

**Elevated Accessibility follows Advanced.** Slices 8–11 target the QTI 3.0 Elevated
Accessibility line, which requires Advanced Delivery, so they start after slices 1–7.

**QTI 3.0 export by denormalization at the back door.** The generators keep emitting QTI 2.2,
and a `qti-common` function renames the finished document into QTI 3.0: namespace, `qti-*`
element names, kebab-case attributes, plus the structural repairs QTI 3.0 requires. A native
QTI 3 path would double the surface of sixteen generators, the same constraint that put import
normalization at the front door. The rename is the inverse of to-pie's normalization and lives
beside the element and attribute maps, so import and export share one vocabulary and a round
trip through both is testable.

**One plugin, a target version option.** `pie-to-qti2` takes `targetVersion: '2.2' | '3.0'`,
defaulting to `'2.2'`, because both versions share every generator, the identifier and passage
deduplication, and the LOM metadata. A deliberate trade: the package name stops describing its
output, at the cost of none of the breakage a rename would bring. The lossless path re-emits an
embedded source only when its version family matches the target, 2.1 and 2.2 for a 2.2 target and
3.0 for a 3.0 target; otherwise the item is generated, with a warning.

**Catalogs native in QTI 3.0.** A QTI 3.0 export writes catalogs as `qti-catalog-info` with
`data-catalog-idref` unchanged, the canonical shape the catalogs already have, so the APIP
loss warnings do not apply to it. Assessment-level catalogs still have no QTI home and keep
their warning.

**QTI 3.0 XSDs as test fixtures.** The QTI 3.0 ASI and content-packaging XSDs are vendored into
`packages/qti-common/schemas/qti3/`, outside the published files, where the element-map test and
the pie-to-qti2 export gate both read them. MathML 3 and SSML resolve to skip-content stubs,
since the copies vendored for 2.2 use IMS's 2010 namespaces. Import still validates after
normalization against 2.2, so to-pie gains no schemas.

---

## Slice Detail

Each slice carries its tests in both QTI 2.2 and 3.0 spellings, a patch changeset per touched
published package, and the doc updates its change implies, mainly the matching SPEC-GAPS entry,
`docs/certification/public-coverage-matrix.json` and the player package READMEs.

### 1. Item-body pass and printed variables

- A DOM walk over the parsed item body by canonical name replaces `renderPrintedVariables`'
  regex; later slices register their elements with it.
- `printedVariable` honours `format` (C `printf` subset per spec), `base`, `index`, `powerForm`,
  `field`, `delimiter` and `mappingIndicator`; record fields print by `field`, containers by
  `delimiter`.
- Rubric blocks and modal feedback run through the pass.

Done when a QTI 3 item printing a formatted float, an indexed ordered value and a record field
renders identically to its QTI 2.2 twin, including inside modal feedback.

### 2. Inline feedback

- `feedbackInline` moves onto the pass, reading both attribute spellings and nested feedback.
- `ChoiceInteraction` and `itemPresentationPlan` take the resolved state from the pass.
- Visibility uses the shared rule.

Done when nested inline feedback and multiple-cardinality membership show correctly in both
versions.

Landed with one change: `createItemPresentation` takes the outcome values to present as input, so
the item body and choice text resolve in presentation through `processFeedbackInline`, on the
same rule; the pass resolves rubric and modal feedback content. The rule is `isShownByIdentifier`
in `qti-common`, ready for slice 3.

### 3. Feedback and template blocks; modal feedback

- `feedbackBlock`, `templateBlock` and `templateInline` are evaluated on the pass.
- Choice-level `templateIdentifier`/`showHide` hides choices; template variables substitute into
  MathML (`mi`/`ci` by identifier).
- Modal feedback uses the shared rule.
- `contextDeclaration` variables and `QTI_CONTEXT` become item variables for template and
  response processing.

Done when the conformance fixtures for each construct render in both versions.

Landed with one change: interaction extraction runs on the pass with feedback left out, so template
choices, template content, `printedVariable` and MathML resolve in prompts and choices, and
interactions are extracted again when template values change. A `printedVariable` of an outcome
inside an interaction keeps its value from extraction. Body `feedbackBlock` resolves in
presentation on the slice 2 path. `contextVariables` on `openSession` sets context values.

### 4. Test feedback outcomes

- `finalizeAssessment` returns typed outcomes; `api-contract.ts` changes `outcomes` accordingly.
- Test feedback is recomputed on every outcome change and `access="during"` shows during the
  test.
- `testPart` `testFeedback` is parsed onto `SecureTestPart` and shown at the end of its part.
- G-05 is updated.

Done when `atEnd` and `during` feedback at test and test-part level show for single and
multiple outcomes.

Landed with two changes. `submitResponses` and a resumed `initSession` return outcomes too, so
`during` feedback follows each submission; part-level `atEnd` shows once the candidate moves past
the part. `sum` and `product` in `qti-processing` now take a multiple or ordered container, which
`testVariables` yields, and QTI 3 items no longer score as item `unknown`.

### 5. Outcome-processing inputs

- The backend builds `TestItemState` in full: response variables and built-ins, section
  identifiers, categories, weights as a record, presented/responded/selected/correct/incorrect,
  and base type and cardinality per variable. Unscored items are included.
- `outcomeMinimum` and `outcomeMaximum` read declared `normalMinimum`/`normalMaximum`.
- G-11 is updated.

Done when `numberResponded`, `numberSelected`, `numberCorrect` without `MAXSCORE`,
section/category filters and weighted `testVariables` match spec examples.

Landed with two changes. Item scoring reports `correct` (every declared response matches its
correct response, absent when one declares none), which the backend stores per item with its
variables, so `numberCorrect` reads it directly. `testVariables` follows the spec's base-type
rules: an omitted `baseType` matches integer and float, the result is integer only when every match
is, and a `weightIdentifier` makes it float.

### 6. Lookup tables

- `interpolationTable` is a step lookup: entries in order, `sourceValue` as lower bound,
  `includeBoundary` (default true) deciding an exact match, `defaultValue` when none matches,
  result coerced to the outcome's base type. `interpolationMethod` goes.
- `matchTable` keeps `defaultValue` in the target's base type.
- The AST builder compares canonical names, so `qti-match-table` and `qti-interpolation-table`
  build.

Done when a QTI 3 item using each table loads and maps per the spec's examples.

Landed with one change: the non-QTI `lookupTable` expression keeps working with step semantics, and
its conformance fixture now exercises `includeBoundary` and `defaultValue` instead of linear
interpolation. Without an outcome to coerce to, its values read as float when numeric.

### 7. Test structure and item session control

- Item refs parse `itemSessionControl`, `category`, `variableMapping` and `templateDefault`;
  `weight` feeds slice 5's state; sections parse `keepTogether` and `visible` and apply them in
  ordering.
- Effective session control cascades test part → every enclosing section → item ref, per test
  part, with absent attributes inheriting; no settings carry from the previous item.
- `maxAttempts` defaults to 1 and is enforced client and backend side; `showFeedback` and
  `showSolution` reach the item player; `allowReview` checks the target item; simultaneous mode
  validates responses; `allowComment` captures a candidate comment.
- The backend owns selection and ordering per the decision above; individual navigation follows
  it.
- Time-limit expiry locks the scope it bounds.
- G-16's dynamic rules land here and G-16 is updated.

Done when the session-control and selection/ordering fixtures deliver in the drawn order, resume
in it, and enforce each attribute at every nesting level.

Landed with three changes. A new session's `InitSessionResponse` carries `currentItemIdentifier`,
the first item whose preconditions hold, and the player starts there. The player's `rng` option is
deprecated and ignored: the reference adapter takes it as `new ReferenceBackendAdapter({ rng })`.
The assessment renders no item modal feedback; `showFeedback` governs integrated feedback, and
adaptive items keep theirs during attempts.

### 8. TTS and SSML in delivery

- The suppress-TTS and SSML mapping moves from to-pie into `qti-common`; to-pie imports it.
- The readable projection reads QTI 3 names, covers stem text, skips suppressed content, and
  carries `data-ssml` and inline SSML as SSML to the TTS provider.
- Inline `ssml:*` is removed from the visible body after extraction.

Done when a QTI 3 item reads its stem, prompt and choices with SSML pronunciation and skips
suppressed nodes.

Landed with the stem read from the rendered body, which carries the docking and suppression; the
projection covers interaction content only, which renders in shadow roots. Delivery passes
`hidingStyles: false`, since the shared vocabulary stylesheet already hides `qti-hidden`. SSML
lands as `spoken` catalog cards under generated `ssml-N` idrefs, which the item player and the
section player compute alike. APIP spoken cards in the section player, and passages, are left to
slice 11.

### 9. Content language

- The nearest `xml:lang` maps to `lang` on the item body and inner elements.
- The toolbar language and TTS voice follow it; the hardcoded `en-US` and `Joanna` go.
- Glossary and illustrated-glossary lookups pass the content language, falling back to the
  untagged entry.

Done when a Spanish item reads in a Spanish voice and opens its Spanish glossary entry.

Landed with a Polly standard-engine voice table keyed by tag, then primary subtag; a language
outside it keeps the toolkit's English default. The browser TTS backend in pie-players 0.3.73
picks its voice from `navigator.language`, so it does not follow the content language. Passages
take their language from the host's `QtiSharedHtmlBlock.language`, since the section player gets
passage markup and no stimulus XML. `xml:lang` on a prompt or choice element is dropped from the
item player's interaction data, which carries their text only; `xml:lang` inside them survives.

### 10. PNP in delivery

- Colour-scheme CSS ships per the decision above, each scheme checked for WCAG 1.4.3 contrast.
- `pnpProfileFromAfa` adds language of interface, invert polarity, single-column layout, line
  reader, masking, calculator, text appearance, `spoken` as TTS activation, fixed-minute extra
  time, dictionary and highlighter, each onto its pie-players tool id or host flag.
- `answer-masking` maps to answer masking; elimination keeps its own term.
- Companion materials enable the tools they name.

Done when each AfA term either drives delivery or is listed in `pnp.md` as unsupported.

Landed with the display needs as root attributes and `--qti-*` custom properties styled by
`qti-pnp.css` in default-components, which the web-component loaders' runtime CSS imports. Tool
supports land in `PnpProfile.tools` in pie-players' ids, and the section player applies them and
the item's companion materials to the host's tools: an offered `enabled: false` tool turns on, a
prohibited one goes, and `screenReader` withholds read-aloud. Masking covers `choiceInteraction`
only. AfA has no highlighter term; dictionary, line reader and language of interface are parsed
for the host, which owns those tools and the interface locale.

### 11. Shared vocabulary, catalogs and sanitizer

- The missing shared-vocabulary classes get rules, including `qti-choices-*` placement and
  `qti-unselected-hidden`.
- The catalog extractor keeps every `qti-html-content` and `qti-file-href` per card, resolving
  file hrefs as content.
- The `object` → `img` conversion keeps `aria-*`, `role` and `lang`; interaction `aria-*` reaches
  the rendered controls.

Done when each vocabulary class has a fixture and a screen reader announces interaction labels.

### 12. Element map completion

- The 37 missing entries are added by hand in their groups and the six undeclared ones removed.
  A conformance test checks the map against the vendored ASI schema in both directions, and
  that every QTI 2.2 element except the XHTML set and the removed `infoControl` maps to a
  declared QTI 3.0 name.

Done when every QTI 3 element with a 2.2 counterpart round-trips through the mapper.

### 13. QTI 3.0 writer

Runs after slice 12, whose completed element map the rename reads.

- `qti-common` gains the QTI 2.2 → 3.0 rename: namespace `imsqtiasi_v3p0` with its schema
  location, element names through `Qti3ElementNameMapper.toNative` with the generic
  camel-to-kebab rule for unmapped names, and attributes through the inverse of
  `QTI3_ATTRIBUTE_TO_QTI2`. The generator asserts the inverse is one-to-one.
- Structural repairs: rubric-block content wraps in `qti-content-body`; passages become
  `qti-assessment-stimulus` resources with `qti-stimulus-body`, and items reference them by
  `qti-assessment-stimulus-ref` instead of embedding interaction-less items.
- Catalogs are written as `qti-catalog-info` per the decision above, and the APIP warnings are
  skipped for a QTI 3.0 target.
- `AssessmentGenerator` emits `qti-assessment-test` with `qti-assessment-item-ref` and stimulus
  dependencies; the manifest declares the QTI 3.0 content-packaging profile and resource types
  `imsqti_item_xmlv3p0`, `imsqti_test_xmlv3p0` and `imsqti_stimulus_xmlv3p0`; the package
  validator checks the version-specific namespace and types.
- The plugin reports `qti30` as its target format, and the lossless path follows the decision
  above.
- `pie-to-qti.md`'s open question is closed, its namespace statements cover both versions,
  `QTI-COMPLIANCE.md` gains a QTI 3.0 section, and G-25 is marked done.

Done when every generator's fixture exports as QTI 3.0 that validates against the vendored XSDs,
to-pie imports it back to the same PIE model as its QTI 2.2 twin, and the item player renders it.

---

## Working Method

Slices run sequentially in the main checkout. There are no worktrees and no implementation
subagents; slices 1–3 share the item-body pass and slices 4, 5 and 7 share the reference backend,
so parallel branches would spend the time saved on conflict resolution.

Per slice:

1. `git fetch origin`. Branch from `origin/develop`, or from the previous slice's branch while
   its PR is still open, so the new work builds on it.
2. Implement. Run `bun run lint:fix`, `bunx tsc --noEmit` and the affected tests, and add a
   patch changeset per touched published package.
3. Update this plan's slice row in the same PR, so the table on `develop` stays the record.
4. Push and open a PR against `develop`. The title and body are brief, per the repo's
   Conventional Commits convention.
5. Spawn a background merge agent for the PR (brief below), then start the next slice at once.
6. When the agent reports a merge, rebase the current branch onto `origin/develop`, and only
   then open its PR, so every PR's diff is its own slice. When the agent reports a failure,
   switch back, fix, push, and spawn a new agent.

Merge-agent brief:

- Wait for checks with `gh pr checks <n> --watch`. `All Checks Passed` is the aggregate gate.
- Merge with `gh pr merge <n> --merge --delete-branch`. Merge commits keep a stacked branch's
  base SHAs intact; a squash would turn every rebase onto `develop` into a conflict.
- On a red check, a conflict, or a requested change, do not merge. Report the failing check
  and the tail of its log.
- Use `gh` only and never touch the local checkout, so the agent cannot collide with the slice
  in progress.
- Report the merge commit SHA.

Releases: after slices 7 and 11 merge, cut a release per the repo's release process (`develop`
→ `master`, changesets publish) and rerun the certification suites for the Advanced Delivery and
Elevated Accessibility lines respectively; after slice 13 merges, cut one for the QTI 3.0 export.
Other slices ride the next regular release.

A session resumes from this table and `gh pr list --author @me --state open`.
