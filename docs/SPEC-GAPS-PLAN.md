# PIE-QTI Specification Gaps — Implementation Plan

**Status**: Living document
**Last reviewed**: 2026-07-13
**Source analysis**: Comparison of `docs/QTI_techguide.md` against the codebase

This document is the authoritative meta-plan for closing gaps between the QTI specification and the
PIE-QTI implementation. Each section maps to one or more concrete sub-tasks that can be handed to an
AI agent or a human engineer. Sections are ordered by priority tier.

---

## How to use this document

Each gap item follows this schema so it can be turned directly into a sub-task brief:

```
### <ID>: <Title>
Scope       — which packages are touched
Status      — Open | In-progress | Done | Deferred
Effort      — S (< 1 day) | M (1-3 days) | L (> 3 days)
Spec ref    — section in QTI_techguide.md
Context     — what the spec requires
Current     — what the code does today
Action      — concrete steps for an agent/engineer
Test signal — how to verify the work is done
```

When creating a sub-task from an item, copy the **Context**, **Current**, and **Action** fields
verbatim into the task brief. The agent should also read the **Spec ref** section in
`docs/QTI_techguide.md` before starting.

---

## Tier 1 — Cross-version interaction and assessment gaps

These gaps were identified from QTI 2.x-authored content, but several affect the shared delivery
path used for QTI content after name mapping. QTI 3.0-specific work is tracked separately in Tier 2
and Tier 3 below.

---

### G-01: `matchGroup` attribute not extracted for associable-choice interactions

Scope       — `packages/item-player/src/interactions/associate/extractor.ts`,
              `matchExtractor.ts`, `gapMatchExtractor.ts`, `graphicGapMatchExtractor.ts`;
              corresponding default-components UI components
Status      — Done (commit e2660fb, 2026-04-29)
Effort      — M
Spec ref    — §3.1.3 (associateInteraction), §3.1.4 (matchInteraction), §3.1.5 (gapMatchInteraction),
              §3.3.5 (graphicGapMatchInteraction)

Context
The `matchGroup` attribute on `simpleAssociableChoice`, `gapText`, `gapImg`, and `associableHotspot`
is a space-separated list of identifiers. It restricts which choices may be paired with each other.
For example, setting `matchGroup="set-a"` on several choices means they can only be matched with
other choices that also list `"set-a"` in their `matchGroup`. This is used in real item banks to
prevent nonsensical pairings in large matching pools.

Current
None of the four affected extractors read or expose `matchGroup`. The UI components therefore have
no information to enforce pairing constraints.

Action
1. Add `matchGroup?: string[]` to the choice type in each affected extractor's data interface.
2. In each extractor's `extract()` method, read `matchGroup` via `utils.getAttribute(choice, 'matchGroup', '')`, split on whitespace, filter empty strings, and include it on the choice object only when non-empty.
3. In each corresponding default-components UI, use `matchGroup` to filter the list of valid targets shown to the candidate when a source is selected: only offer targets whose `matchGroup` array is empty (unrestricted) OR shares at least one value with the selected source's `matchGroup`.
4. Add unit tests in each extractor's test file covering: attribute present, attribute absent, multiple values.
5. Add eval cases in `docs/evals/default-components/` for the affected interactions.

Test signal
- Extractor tests parse XML with `matchGroup` and produce the correct `string[]`.
- UI eval: when a choice with `matchGroup="animal"` is selected, only targets listing `"animal"` (or no matchGroup) are activatable.

---

### G-02: `label` element on `inlineChoiceInteraction` not extracted

Scope       — `packages/item-player/src/interactions/inline-choice/extractor.ts`;
              `packages/default-components/src/plugins/inline-choice/`
Status      — Done (already implemented; no code change needed)
Effort      — S
Spec ref    — §3.2.1

Context
QTI 2.2 added an optional `<label>` child element to `inlineChoiceInteraction`. Its text content is
displayed in the dropdown before the candidate makes a selection (a placeholder/prompt). Without it,
dropdown UIs typically show a blank or the first choice, which can confuse candidates.

Current
`InlineChoiceData.label: string | null` exists in `inlineChoiceExtractor.ts`; the extractor reads
the `<label>` child element; `ItemBody.svelte:290` uses it as the placeholder `<option>` with i18n
fallback to `'Select...'`.

Action
1. Add `label?: string` to `InlineChoiceData`.
2. In `extract()`, after extracting choices, look for a `<label>` child: `utils.getChildrenByTag(element, 'label')`. If found, set `label` to `utils.getTextContent(labelEl)`.
3. In the inline-choice UI component, use `label` as the `<option value="" disabled>` placeholder when present; fall back to the current behaviour (empty or i18n string) when absent.
4. Add unit test: XML with `<label>Select one</label>` produces `label: 'Select one'`.

Test signal
- Extractor test passes.
- Demo item with `<label>` shows the placeholder text in the dropdown before selection.

---

### G-03: `format` attribute on `textEntryInteraction` not extracted

Scope       — `packages/item-player/src/interactions/text-entry/extractor.ts`;
              `packages/default-components/src/plugins/text-entry/`
Status      — Done (commit e2660fb, 2026-04-29)
Effort      — S
Spec ref    — §3.2.2

Context
QTI 2.2 added a `format` attribute to `textEntryInteraction` as a display-format hint. Delivery
engines may use this to, for example, display a wider input for numeric formats or add units labels.
The attribute is specified as a plain string hint with no fixed vocabulary.

Current
`TextEntryData` does not include `format`. The extractor reads `expectedLength`, `patternMask`,
`placeholderText` but not `format`.

Action
1. Add `format?: string` to `TextEntryData`.
2. In `extract()`, read `utils.getAttribute(element, 'format', '')` and include it when non-empty.
3. In the text-entry UI component, pass `format` as a `data-format` attribute on the `<input>` so host stylesheets and screen readers can act on it, and optionally map a small set of well-known values (e.g. `"plain"`, `"preFormatted"`) to CSS classes.
4. Add extractor unit test.

Test signal
- `TextEntryData.format` is populated from the XML attribute.
- `data-format` attribute appears on the rendered `<input>`.

---

### G-04: `patternMask` not enforced as live input constraint

Scope       — `packages/default-components/src/plugins/text-entry/`
Status      — Done (commit e2660fb, 2026-04-29)
Effort      — S
Spec ref    — §3.2.2, §3.2.3

Context
The spec says `patternMask` on `textEntryInteraction` and `extendedTextInteraction` provides
client-side input validation (regular expression). The extractor already reads and exposes it, but
the spec intent is to prevent invalid characters from being entered or submitted.

Current
`patternMask` is extracted and present in `TextEntryData`. It is not clear the default UI component
applies it to the `<input>` element as a live constraint.

Action
1. Check the text-entry Svelte component. If `patternMask` is not wired to `pattern` on the `<input>`, add `pattern={patternMask}` (or equivalent live validation).
2. Ensure the component does NOT block blur/submit silently — instead surface an accessible validation message (ARIA `aria-describedby` with an error span, visible on invalid state).
3. Check `extendedTextInteraction` component for the same gap; apply if needed.
4. Add eval case: item with `patternMask="[0-9]+"`, entering letters should show a validation error.

Test signal
- Entering a value that doesn't match `patternMask` activates `:invalid` CSS state and shows an accessible error message.
- Entering a valid value clears the error.

---

### G-05: `testFeedback` visibility only handles boolean outcomes

Scope       — `packages/assessment-player/src/core/AssessmentPlayer.ts`
Status      — Done (already implemented; no code change needed)
Effort      — S
Spec ref    — §2.1 (Assessment Architecture — testFeedback)

Context
The QTI spec says `testFeedback` has `outcomeIdentifier` + `identifier` + `showHide`. The element
is shown when the outcome variable named by `outcomeIdentifier` equals `identifier` (for
`showHide="show"`) or does not equal `identifier` (for `showHide="hide"`). The outcome variable
can be any type, not just boolean.

Current
`AssessmentPlayer.ts:574-576` already performs `String(outcomes[fb.outcomeIdentifier] ?? '') ===
fb.identifier` — string equality for all outcome types. Boolean outcomes still work because
`true`/`false` are coerced to `"true"`/`"false"` before comparison.

Action
Done. `AssessmentPlayer.getVisibleFeedback()` uses string equality for the named outcome variable; keep regression coverage for boolean outcomes, string outcomes, and `showHide="hide"`.

Test signal
- Assessment with `outcomeIdentifier="GRADE"` and three feedback blocks for `identifier="A"`, `"B"`, `"C"` shows only the correct block after scoring.

---

### G-06: `matchMin` usage constraint not validated at submission time

Scope       — `packages/item-player/src/utils/responseUtils.ts` or `Player.ts`
Status      — Done (commit e2660fb + followup, 2026-04-29 — matchMin extracted and validated at runtime)
Effort      — S
Spec ref    — §3.1.3, §3.1.4, §3.1.5, §3.3.4, §3.3.5

Context
`matchMin` on `simpleAssociableChoice`, `gapText`, `gapImg`, and `associableHotspot` declares the
minimum number of times each choice must appear in the response. When `matchMin > 0` for any
choice, the response is incomplete unless that choice has been used at least `matchMin` times. This
is a hard constraint on response completeness analogous to `minChoices` on `choiceInteraction`.

Current
`matchMin` is extracted and present in the data models. It is validated in extractor `validate()`
methods only as a structural check (`matchMin >= 0`). There is no check at response-submission time
that the candidate has satisfied `matchMin` for every choice.

Action
1. In `Player.validateResponse()` (or wherever `isResponseValid()` is computed), for interactions that carry `matchMin` on choices, iterate each choice and count how many times its identifier appears in the current response. Return invalid if any choice has a count below its `matchMin`.
2. Expose the specific shortfall through the validation result so UIs can indicate which choices still need to be used.
3. Add unit tests.

Test signal
- `player.validateResponse()` returns invalid when a required choice (`matchMin=1`) has not been used.
- Returns valid once all `matchMin` constraints are satisfied.

---

### G-07: STATUS.md and README.md are inconsistent about QTI 3.0 scope

Scope       — `STATUS.md`, `README.md`
Status      — Done (commit e2660fb, 2026-04-29)
Effort      — S
Spec ref    — N/A

Context
`STATUS.md` line 52 lists "QTI 3.0 features" as an intentional non-goal. `README.md` says "QTI 3.0
infrastructure complete, player enhancements in progress" and the badges show
"QTI 2.x & 3.0 Supported". This contradiction creates incorrect expectations for consumers and
AI agents working from the repo.

Current
Both files exist with conflicting statements. `docs/QTI-3-MIGRATION-GUIDE.md` correctly describes
the version-agnostic name-mapping layer but does not distinguish between what is done and what is
planned.

Action
1. In `STATUS.md`, replace the non-goal line with a more precise statement: name-mapping/version-detection is complete; PCI, PNP, and Catalog are tracked in this plan under Tier 2/3.
2. In `README.md`, change the QTI 3.0 description to "QTI 3.0 name-mapping complete; PCI/PNP/Catalog in progress" and update the badge to `QTI 2.x & 3.0 (partial)` until the Tier 2 work below is done.
3. Add a one-line pointer from `STATUS.md` to this document.

Test signal
- A reader of `STATUS.md` and `README.md` reaches the same understanding of QTI 3.0 scope.

---

### G-16: Lossless `assessmentTest` XML ingestion and one authoritative test model

Scope       — `packages/assessment-player/`; `packages/player-elements/src/qti/`
Status      — Open
Effort      — L
Spec ref    — QTI assessment-test information model

Context
Valid test XML can carry per-part navigation/submission modes, nested sections, selection,
ordering, fixed flags, preconditions, branch rules, item-session controls, time limits, weights,
outcome declarations/processing, and test feedback. Delivery must preserve these semantics through
XML ingestion rather than require hosts to preconstruct an internal model.

Current
There are multiple assessment parsers. The player-elements parser represents only a small subset,
flattens nested sections, and adopts modes from the first part. The richer reference adapter still
drops selection/ordering and several branching/feedback constructs. Runtime tests often construct
`SecureAssessment` directly, bypassing both XML paths.

Action
1. Define one lossless, ordered assessment-test model owned by `@pie-qti/assessment-player`.
2. Parse all test/part/section/item-ref control constructs into that model and preserve per-part
   modes and hierarchy.
3. Make the web component and reference adapter consume that parser instead of maintaining copies.
4. Add schema-valid XML-to-delivery tests for selection, ordering, fixed items, nested sections,
   preconditions, branching, weights, feedback, and multiple test parts.

Test signal
- Tests start from raw QTI 2.1, 2.2, and 3.0 assessment XML and assert the selected/ordered item
  sequence and navigation/branch outcomes, not merely construction without an exception.

---

### G-17: `positionObjectStage` hierarchy is reversed

Scope       — `packages/item-player/src/interactions/position-object/`; fixtures and renderer
Status      — Open
Effort      — M
Spec ref    — QTI positionObjectStage / positionObjectInteraction content model

Context
QTI 2.2 and 3.0 define `positionObjectStage` as the parent containing the background object and one
or more `positionObjectInteraction` children. Each interaction owns its draggable object.

Current
The extractor expects a stage child inside each interaction, and internal fixtures encode that
invalid structure. Schema-valid QTI 2.2 and 3.0 examples therefore extract no interaction.

Action
Make extraction parent-stage-aware, share stage/background data across child interactions, update
the renderer model, replace invalid fixtures, and add XSD-valid QTI 2.2/3.0 browser tests.

Test signal
- A stage with one background and multiple child interactions renders each draggable object and
  collects/scorers the declared point responses.

---

### G-18: QTI 3 mapper prefixes HTML/MathML/foreign vocabulary

Scope       — `packages/qti-common/src/element-mapper/`; graphical/media extractors and fixtures
Status      — Open
Effort      — M
Spec ref    — QTI 3.0 naming convention and ASI content model

Context
QTI-defined elements use `qti-` kebab-case names in 3.0. Embedded HTML (`object`, `img`, `audio`,
`video`, `source`, and similar), MathML, SVG, and other foreign-vocabulary elements do not gain a
`qti-` prefix.

Current
The fallback mapper prefixes every canonical name and the mapping table includes non-standard
`qti-object`/`qti-param` entries. Several tests use those invalid names. Schema-valid QTI 3
graphical interactions can extract with missing image/media data.

Action
Separate authoritative QTI mappings from pass-through HTML/MathML/SVG vocabularies, remove invalid
entries, replace fixtures, and audit every extractor that asks the mapper for an embedded-content
element.

Test signal
- Valid QTI 3 hotspot, media, drawing, select-point, graphic-* and position-object examples using
  unprefixed HTML resources retain their source/object data.

---

### G-19: Standard response-template aliases do not match canonical XML semantics

Scope       — `packages/item-player/src/core/Player.ts`; response-processing fixtures
Status      — Open
Effort      — M
Spec ref    — QTI 2.x standard response-processing templates; Common Cartridge 2 aliases

Context
Template URIs identify canonical processing programs. Their named variables, constants, mappings,
and feedback outcomes must behave exactly like the official XML templates.

Current
Filename switches implement invented aggregate behavior: `match_correct` can inspect every response
and award `MAXSCORE`, mapping templates sum declarations, required Common Cartridge feedback is
omitted, and `CC2_match_basic.xml` is unsupported.

Action
Prefer resolving/compiling the official template programs through the existing AST. If kept as
built-ins, implement the exact canonical programs and add one regression fixture per supported URI,
including output values and feedback.

Test signal
- Canonical and built-in execution produce identical declaration values for correct, incorrect,
  null, mapped, and feedback cases.

---

### G-20: Linear navigation and modes must be test-part scoped

Scope       — `packages/assessment-player/src/core/`; integration model and XML parser
Status      — Open
Effort      — L
Spec ref    — QTI testPart navigationMode and submissionMode

Context
After advancing in a linear test part, a candidate cannot return to an earlier item. Navigation and
submission modes belong to each test part, not to the assessment globally.

Current
`NavigationManager` explicitly permits earlier targets and `canPrevious()` ignores linear mode.
The secure assessment model collapses navigation/submission modes to one global pair.

Action
Preserve modes per test part, track the active part and irreversible linear transitions, and apply
submission rules at part boundaries. Add candidate-facing control and imperative API tests.

Test signal
- Previous/back navigation is unavailable after advancing in a linear part, while nonlinear parts
  remain freely navigable within their permitted scope.

---

### G-21: Record is a cardinality, not a base type

Scope       — `packages/qti-processing/src/runtime/`; declaration parsing and text interactions
Status      — Open
Effort      — L
Spec ref    — QTI variable declarations and record fieldValue semantics

Context
`record` is a declaration cardinality whose value is a set of named fields, each with its own base
type. A record declaration does not use one declaration-level base type.

Current
Runtime types model `record` as a base type and omit it from cardinality. Missing declaration base
types default to string, and evaluator paths construct `qtiValue('record', 'single', ...)`, losing
valid field structure.

Action
Correct the value type model, declaration parser, field access, serialization, equality/null
semantics, and interaction bindings. Add record response/outcome/template tests across versions.

Test signal
- A valid record declaration round-trips named typed fields and works with `fieldValue` and
  response processing without scalar coercion.

---

### G-22: Time limits require independent scope clocks and `minTime` enforcement

Scope       — `packages/assessment-player/src/core/TimeManager.ts`; assessment delivery model
Status      — Open
Effort      — L
Spec ref    — QTI timeLimits and duration variables

Context
Item, section, test-part, and test time limits/durations are independent scopes. Aggregate scopes
include navigation time, and minimum limits constrain when the candidate may advance/submit.

Current
The player collapses maximums to one shortest assessment timer, does not accumulate section/part
evidence, and does not enforce `minTime`.

Action
Create independent nested clocks and evidence, preserve all XML scopes, enforce minimum and maximum
transitions, and specify behavior when multiple scopes expire together.

Test signal
- Deterministic-clock tests independently exercise item, section, part, and test min/max limits and
  verify recorded durations and navigation/submission behavior.

---

### G-23: Optional-response and extended-text cardinality semantics

Scope       — `packages/item-player/src/core/Player.ts`;
              `packages/item-player/src/interactions/extended-text/`;
              `packages/default-components/src/plugins/extended-text/`
Status      — Open
Effort      — M
Spec ref    — Interaction response validity; extendedTextInteraction

Context
An interaction is not automatically required merely because it binds a response declaration.
Defaults such as omitted `minChoices` permit an empty response. Extended text also supports
multiple response cardinalities and string-count/format constraints.

Current
Validation treats every response-bearing interaction as required. Extended text is bound to one
string and omits `base`, `stringIdentifier`, `minStrings`, and `maxStrings` behavior.

Action
Derive response completeness from each interaction's actual constraints/defaults, implement the
complete extended-text response model, and add empty/partial/multiple/record browser and scoring
tests.

Test signal
- Optional interactions submit empty successfully; required constraints fail accessibly; all valid
  extended-text cardinalities preserve their declared response shape.

---

### G-24: Resolve external processing fragments

Scope       — package/resource resolution; `packages/qti-processing/src/ast/build.ts`
Status      — Open
Effort      — M
Spec ref    — QTI responseProcessingFragment / outcomeProcessingFragment and XInclude

Context
QTI permits reusable external processing fragments referenced with `xi:include`. A package-aware
delivery engine must resolve and parse those resources before executing the program.

Current
The AST builder deliberately rejects `xi:include`, and the conformance fixture is marked expected
failure.

Action
Resolve fragments through a host/package resource resolver with URL and size limits, detect cycles,
then parse the resolved content with the same mapper and scope rules as inline processing.

Test signal
- Valid local fragments produce the same outcomes as equivalent inline programs; missing, cyclic,
  oversized, or disallowed references fail safely with actionable errors.

---

## Tier 2 — QTI 3.0 features we are committing to support

These are features listed in `docs/QTI-3-MIGRATION-GUIDE.md` and implied by the README as being on
the roadmap. The name-mapping infrastructure (element and attribute mappers, version detection) is
already in place. What follows is the application-level work.

---

### G-08: PCI — Portable Custom Interaction module lifecycle

Scope       — `packages/item-player/src/interactions/portable-custom/extractor.ts`;
              `packages/item-player/src/pci/`;
              `packages/item-player/src/core/Player.ts`;
              default interaction rendering
Status      — In-progress (runtime primitives exist; delivery path is disconnected)
Effort      — L
Spec ref    — §6.1

Context
In QTI 3.0, `<qti-portable-custom-interaction>` carries:
- `response-identifier` and `custom-interaction-type-identifier` attributes
- A `<qti-interaction-markup>` child with the initial DOM scaffold
- A `<qti-interaction-modules>` child listing ES module paths (`primary-path`, `fallback-path`)
- A `<qti-pci-properties>` child with static key/value configuration

The player must: (a) load the module at `primary-path` (falling back to `fallback-path`);
(b) call `module.initialize(domScaffold, config, boundTo)` once the DOM is ready;
(c) call `module.getResponse()` when collecting the response;
(d) call `module.setResponse(value)` when restoring state;
(e) call `module.disable()` / `module.enable()` on role/state changes;
(f) call `module.destroy()` on unmount.

Current
`portableCustomExtractor` and `PciHost` implement parsing and lifecycle primitives, and
`Player.createPciHost()` can construct a host. However, the portable extractor is not included in
`getStandardInteractionExtractors()`, no production renderer calls `createPciHost()`, and the
default custom-interaction fallback reports unsupported content. A valid QTI 3.0 PCI therefore
does not initialize, collect a response, or participate in the player lifecycle.

Action
1. Register `portableCustomExtractor` in the production extraction path with the intended priority.
2. Add a renderer/host integration that creates `PciHost` after its markup is mounted and wires
   `getResponse`, `setResponse`, enable/disable, and destroy into the normal response lifecycle.
3. Require explicit host opt-in and a module-origin/URL policy. PCI executes third-party code and
   must be treated as a stronger trust boundary than declarative QTI markup.
4. Add a packed-browser integration test with a minimal PCI module; asserting extractor or host
   classes in isolation is insufficient.

Test signal
- Loading a QTI 3.0 item with a `qti-portable-custom-interaction` calls `initialize()` on the module.
- `player.getResponse('RESPONSE')` delegates to the module's `getResponse()`.
- `player.setResponse('RESPONSE', value)` calls the module's `setResponse()`.
- `disable()` is called when the player switches to a non-candidate role.
- `destroy()` is called when the player is torn down.

---

### G-09: PNP — Personal Needs and Preferences profile support

Scope       — `packages/item-player/src/core/Player.ts`;
              new `packages/item-player/src/pnp/` module;
              `packages/default-components/src/` (individual component changes);
              `packages/assessment-player/src/core/AssessmentPlayer.ts`
Status      — Done (commit fa8fa97, 2026-04-28)
Effort      — L
Spec ref    — §6.2

Context
A PNP profile is a structured object (see §6.2 for schema) that is passed to the player at session
initialisation. It controls:
- **Color schemes** — 6 named schemes (`default`, `blackwhite`, `whitenav`, `blackcream`,
  `yellowblue`, `medgray`) applied via CSS custom properties on the root element
- **Elimination tool** — adds a dismiss button per choice in `choiceInteraction` (and similar)
- **Extended time** — multiplies all `timeLimits` values by a `multiplier` factor
- **Glossary on screen** — triggers tooltip/popup rendering for terms linked via `data-catalog-idref`
  (depends on G-10 for catalog content, but tooltip trigger UI is independent)
- **Keyword translation** — surfaces `keyword-translation` catalog entries for linked terms
- **Structured label support** — adds supplementary ARIA markup to interaction prompts

Current
PNP support is implemented for the current delivery scope: `PlayerConfig.pnp`, `player.updatePnp()`, color schemes, elimination tool, extended time, and glossary/keyword-translation trigger UI are shipped. Specialist features such as structured labels, braille routing, and sign-language video remain deferred under G-13/G-14.

Action
Done for G-09. Future PNP work is tracked under G-13/G-14 and package-level catalog discovery under G-15.

Test signal
- Player constructed with `pnp: { display: { colorScheme: 'blackwhite' } }` applies the correct CSS custom properties.
- `player.updatePnp({ display: { colorScheme: 'yellowblue' } })` changes the scheme without re-parsing the item.
- Elimination tool buttons appear in `choiceInteraction` when `pnp.cognitive.eliminationTool` is true.
- A 60-second time limit becomes 90 seconds when `extendedTime.multiplier` is 1.5.

---

### G-10: Catalog system — `qti-catalog` parsing and glossary rendering

Scope       — `packages/item-player/src/catalog/`;
              `packages/item-player/src/core/Player.ts`;
              `packages/default-components/src/` (new `CatalogPopup` component);
              `packages/item-player/src/pnp/` (integration with G-09)
Status      — Done (commit fa8fa97, 2026-04-28)
Effort      — L
Spec ref    — §6.3
Depends on  — G-09 (glossary trigger UI is part of PNP; catalog provides the content)

Context
A `<qti-catalog>` element lives at item level, parallel to `<qti-item-body>`. It contains
`<qti-card>` elements identified by `identifier`. Each card has one or more `<qti-card-entry>`
children with a `usage` attribute (`glossary-on-screen`, `keyword-translation`, `tts-pronunciation`,
`illustrated-glossary`, `signing-definition`, `braille-text`) and an `xml:lang` attribute for
translations. In the item body, `<span data-catalog-idref="cat-id">term</span>` links text to a
catalog card.

Current
Catalog parsing, `player.getCatalogEntry()`, inline glossary/keyword-translation popup support, and platform-level catalog lookup events are implemented. Manifest-level shared catalog discovery remains deferred under G-15.

Action
Done for G-10. Keep G-15 open for manifest-level shared catalog discovery.

Test signal
- `player.getCatalogEntry('cat-photosynthesis', 'glossary-on-screen')` returns the correct HTML.
- `player.getCatalogEntry('cat-photo', 'keyword-translation', 'es')` returns the Spanish translation.
- With `glossaryOnScreen: true`, clicking the indicator on a linked term opens the popup with correct content.
- With `glossaryOnScreen: false`, no indicators appear.

---

## Tier 3 — QTI 3.0 features deferred but planned

These are not committed to any near-term milestone. They are documented here so the repo has a
clear record of what remains and so sub-tasks can be created when priorities shift.

---

### G-11: Full QTI `<outcomeProcessing>` XML interpreter at assessment level

Scope       — `packages/assessment-player/`; `packages/qti-processing/`
Status      — In-progress (core adapter wired; public custom-element ingestion drops the XML)
Effort      — L
Spec ref    — §2.1 (Assessment Architecture), §4.3

Context
The assessment delivery path must preserve outcome declarations and interpret
`<outcomeProcessing>` from the `assessmentTest`. The same AST builder and executor used for item
processing support test-level expressions (`testVariables`, `numberCorrect`, and related
operators).

Current
`ReferenceBackendAdapter` parses outcome declarations and XML and executes it with a test context;
the core path has regression coverage. `QtiAssessmentPlayerElement`, however, uses a second parser
in `@pie-qti/player-elements` that omits those nodes and converts the result to a reduced
`SecureAssessment`. The public NPM custom-element path therefore still ignores valid assessment
outcome processing.

Action
1. Remove or consolidate the duplicate parser in `@pie-qti/player-elements`; route custom-element XML
   ingestion through the assessment package's complete parser/resolver.
2. Preserve outcome declarations, outcome-processing XML, and test feedback in the secure
   assessment representation used by the element.
3. Add packed-browser tests that submit an assessment whose score can only be produced by custom
   `<outcomeProcessing>`.

Test signal
- An assessmentTest XML with `<setOutcomeValue>` using `<testVariables>` produces the correct `SCORE`.
- The four existing template scenarios still pass.

---

### G-12: Composite items (terminology correction)

Scope       — Documentation; multi-interaction item regression coverage
Status      — Done (the original gap was based on a non-standard element)
Effort      — S
Spec ref    — QTI assessment-item information model

Context
In QTI terminology, a composite item is an `assessmentItem` containing more than one interaction.
It is not a distinct interaction type. QTI 3.0 does not define a
`<qti-composite-interaction>` element.

Current
The player already extracts and renders multiple standard interactions from one item. A stray
`qti-composite-interaction` entry in the QTI 3 element mapping table is non-standard and should be
removed as cleanup; it is not a feature to implement.

Action
Do not add an extractor or component for `qti-composite-interaction`. Keep regression coverage for
items with multiple independent interactions and remove the non-standard name-map entry when
runtime cleanup is scheduled.

Test signal
- A QTI 2.x and a QTI 3.0 item containing multiple interactions render and collect each declared
  response independently.

---

### G-13: PNP — structural label and braille support

Scope       — `packages/item-player/src/pnp/`;
              `packages/default-components/src/`
Status      — Deferred
Effort      — M
Spec ref    — §6.2

Context
`structuredLabelSupport` in the PNP profile adds additional ARIA markup to interaction prompts
(supplementary `role="group"` wrappers, visible sub-labels for complex interactions). The
`braille-text` catalog entry usage serves refreshable braille display devices. Both require
specialist accessibility knowledge to implement correctly.

Current
Not implemented (G-09 covers the core PNP surface; this covers the two most specialist features).

Action (when prioritised)
1. Research the APIP spec section for structured labels; document the required markup in `packages/item-player/docs/PNP.md`.
2. Implement structured label injection for `choiceInteraction` and `matchInteraction` as a starting point.
3. For braille, expose `player.getCatalogEntry(idref, 'braille-text')` (already covered by G-10 catalog extractor); document that the host is responsible for routing this to a braille device driver.

Test signal
- With `structuredLabelSupport: true`, choice groups carry the correct ARIA roles.

---

### G-14: PNP — sign language and TTS pronunciation routing

Scope       — `packages/item-player/src/pnp/`;
              catalog integration (G-10)
Status      — Deferred
Effort      — M
Spec ref    — §6.2, §6.3

Context
`signing-definition` and `tts-pronunciation` catalog entry usages require platform-level
capabilities (a sign-language video player; a TTS engine that can accept phonetic overrides) that
are outside the scope of the player itself. The player's role is to expose the data and fire events;
the host provides the capability.

Current
Not implemented.

Action (when prioritised)
1. Extend `getCatalogEntry()` to support `'signing-definition'` and `'tts-pronunciation'` usages (catalog parsing covered by G-10).
2. When `data-catalog-idref` elements are encountered and a TTS engine is registered, fire a `qti-tts-override` custom event carrying the phonetic hint so the host's TTS engine can intercept it.
3. For signing, emit a `qti-signing-request` event with the video URL when the candidate activates the signing indicator.
4. Document the event contract in `packages/item-player/docs/PNP.md`.

Test signal
- `player.getCatalogEntry('cat-foo', 'tts-pronunciation')` returns the phonetic text.
- Activating a linked term fires the correct custom event with the right payload.

---

### G-15: Shared / external catalog files

Scope       — `packages/item-player/src/core/Player.ts`;
              `packages/ims-cp-browser/`
Status      — Deferred
Effort      — M
Spec ref    — §6.3 (Shared Catalogs)

Context
Large item banks share glossary terms across many items using a single external catalog file
referenced from the IMS content package manifest, rather than embedding a per-item `<qti-catalog>`.
The spec allows a standalone `qti-catalog` XML file listed as a resource in `imsmanifest.xml`.

Current
G-10 supports an inline catalog and a `catalogXml` string option. Package-level catalog discovery
from the manifest is not handled.

Action (when prioritised)
1. In `packages/ims-cp-browser/`, extend `PackageLoader` to detect catalog resources in the manifest (type `imsqti_catalog_xmlv3p0`) and expose them as `catalogXml` strings.
2. Pass these to the item player when constructing `Player` instances for items in the package.
3. Merge package-level and item-level catalogs (item-level takes precedence for the same `identifier`).

Test signal
- A content package with a shared catalog file produces the correct glossary entries for items that only have `data-catalog-idref` references, not inline `<qti-catalog>` elements.

---

## Reference: gap–file index

Quick lookup of which source files are touched by each gap item.

| File | Gap items |
|------|-----------|
| `packages/item-player/src/interactions/associate/` | G-01 |
| `packages/item-player/src/interactions/match/` | G-01 |
| `packages/item-player/src/interactions/gap-match/` | G-01 |
| `packages/item-player/src/interactions/graphic-gap-match/` | G-01 |
| `packages/item-player/src/interactions/inline-choice/` | G-02 |
| `packages/item-player/src/interactions/text-entry/` | G-03 |
| `packages/default-components/src/plugins/text-entry/` | G-04 |
| `packages/default-components/src/plugins/extended-text/` | G-04 |
| `packages/assessment-player/src/core/` | G-05, G-09, G-11 |
| `packages/item-player/src/utils/responseUtils.ts` | G-06 |
| `STATUS.md`, `README.md` | G-07 |
| `packages/item-player/src/interactions/custom/` | G-08 |
| `packages/item-player/src/pci/` | G-08 |
| `packages/item-player/src/pnp/` | G-09, G-13, G-14 |
| `packages/default-components/src/plugins/choice/` | G-09 |
| `packages/item-player/src/catalog/` | G-10 |
| `packages/default-components/src/catalog/` | G-10 |
| `packages/qti-processing/` | G-11 |
| `packages/ims-cp-browser/` | G-15 |

---

*This document is the source of truth for spec-gap work. When a gap is resolved, update its
`Status` field and add a brief note with the PR or commit reference.*
