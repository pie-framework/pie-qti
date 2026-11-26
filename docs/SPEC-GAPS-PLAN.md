# PIE-QTI Specification Gaps — Record and Decision Ledger

**Status**: Living document
**Last reviewed**: 2026-11-26
**Source analysis**: Comparison of `docs/QTI_techguide.md` against the codebase

All 27 tracked gaps are closed. This document keeps what still guides decisions: the policy and
decision ledgers below, the outcome of each closed gap, the Delivery backlog of accepted limits, and
the gap–file index. It remains the 1.0 completeness gate: every entry must be Done before 1.0 is cut
(see [`plans/version-1-0-2026-10.md`](plans/version-1-0-2026-10.md)). The original gap write-ups
(spec context, action lists and test signals) are in git history, at the commit that condensed this
file.

> **Policy (2026-11-09):** follow the QTI spec wherever it is clear, per version; no legacy code.
> The project is pre-1.0, so there is no backwards-compatibility surface: no shims, deprecated
> aliases, ignored parameters or migration paths for the project's own past behavior, and no
> non-spec leniency in parsing. Supporting an older QTI version's defined behavior is compliance,
> not legacy. See "Spec Compliance and No Legacy Code" in `AGENTS.md`.

> **Deliberate extensions (2026-11-10):** attributes the player reads that no QTI version
> defines, each a PRD-sanctioned product decision rather than an oversight. This ledger keeps
> them visible so a future spec-conformance pass reviews them deliberately instead of by
> accident.
>
> - `title` on `textEntryInteraction` and `inlineChoiceInteraction`
>   (`interactions/text-entry/extractor.ts`, `interactions/inline-choice/extractor.ts`): read
>   as an accessible-name fallback, after `aria-labelledby`/`aria-label` and before the
>   localized positional name. No QTI version defines `title` on those elements or on any
>   base type, but inline controls carry no visible label element to name them, and authors
>   label them with `title` in practice; without it the only fallback is a positional name.

> **Deliberate keeps and closed decisions (2026-11-10, no-legacy audit close):** leniencies that
> survive the no-legacy policy, each with its recorded reason. The audit itself is deleted; the
> full classification lives in git history.
>
> - PCI variable-JSON ISO-8601 durations (`packages/item-player/src/pci/qtiVariableJson.ts`):
>   required by the PCI v1.0 Appendix A binding — an external spec, not project history. Only
>   the XML-lexical ISO-duration tolerance was removed; XML durations are seconds floats.
> - The official IMS rptemplates (`match_correct`, `map_response`, …, `CC2_*`, `match_nothing`,
>   `packages/item-player/src/core/responseProcessingTemplates.ts`): official 1EdTech template
>   files sourced from `purl.imsglobal.org`; removing them would break real converted/official
>   content.
> - IMS-CP lenient path-resolution heuristics (`packages/ims-cp-core/src/qti-heuristics.ts`):
>   documented, configurable, diagnosed features for real-world third-party packages — a product
>   decision, not legacy. Revisit only with evidence of misuse.
> - `SecureItemRef.itemXml` beside `deliveryContext`
>   (`packages/assessment-player/src/integration/api-contract.ts`): dual shape with two live
>   producers (the reference adapter and the QTI test parser) — layering, not back-compat.
> - `@pie-qti/element-schemas` was **deleted** (player-cleanup round 7): zero importers repo-wide
>   and only 2 of its 13 schemas matched what the transformers actually emit, so a
>   published-but-unwired validator gave false confidence. Re-sync from upstream pie-elements
>   only if a real consumer appears; `packages/to-pie/schemas/` XSDs are unrelated vendored
>   official schemas and stay.
>   PRD: `docs/prds/interactions/inline-interactions.md` §Accessibility, "Current approach".

> **Goal (2026-10-17):** feature completeness against the QTI 2.2 and 3.0 specifications and a
> proper 1.0 release. Every item in this plan is committed work on that path — including the PCI
> spec contract (G-08, phases 1–3 landed), structured labels and braille support (G-13, landed),
> and shared catalog files (G-15, landed), which earlier deferrals had set aside. Sequencing
> and 1.0 acceptance criteria live in
> [`plans/version-1-0-2026-10.md`](plans/version-1-0-2026-10.md).

> **Verification boundary:** statuses below describe the current source tree and its public,
> clean-room tests. The private official-suite runner intentionally consumes published
> `@pie-qti/*` packages only, never workspace source or local tarballs, so official-package
> evidence always attaches to a published version rather than to this tree.
>
> The remediation reviewed on 2026-07-13 was released as `0.1.21`. The private runner originally
> reported all four QTI 2.2 and QTI 3.0 Basic and Advanced DELIVERY suites green for that candidate,
> but those runners only asserted structure and rendering: items constructed and rendered, test
> structure parsed. They did not exercise scoring discrimination or end-to-end delivery outcomes,
> and the browser harness rendered no block interactions for packaged candidates. Re-run in
> 2026-11 with runners that assert scoring and delivery semantics (and a synthetic self-test that
> proves they can fail), `0.1.21` still shows two defects on the fixture content:
>
> - test-level `sum(testVariables(SCORE))` evaluates INVALID, so a test-level `SCORE` is never
>   computed and finalize returns no outcomes;
> - QTI 3.0 item results are attributed to the identifier `"unknown"`.
>
> Both are fixed in this tree (`c7857034`, `30b045d3`) and first shipped in `1.0.0-beta.0`; they
> carry no official-package evidence until the runner is re-pinned to a published version that
> contains them and re-run. Changes released after `0.1.21`, and anything unreleased, carry no
> official-package evidence. None of these statuses is a conformance or certification claim.

---

## How to use this document

- To learn why the player behaves as it does in a spec area, find the gap below and read its
  outcome. The living description of each interaction is in its PRD
  ([`prds/INVENTORY.md`](prds/INVENTORY.md)).
- To record a new spec gap, add an entry in the tier that fits and open its status. An open entry
  carries these fields so it can be turned directly into a task brief:

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

- When a gap is resolved, replace its entry with the outcome form used below: the status line with
  its date and commit reference, then what shipped, anything that remains open, and the tests that
  stand as evidence.
- To record a deliberate divergence or a kept leniency, add it to the matching ledger at the top of
  this file, with its evidence. That ledger is where a future spec-conformance pass looks first.

---

## Closed gaps

### Tier 1 — Cross-version interaction and assessment gaps

These gaps were identified from QTI 2.x-authored content, but several affect the shared delivery
path used for QTI content after name mapping.

#### G-01: `matchGroup` attribute not extracted for associable-choice interactions

Done (commit e2660fb, 2026-04-29) · Spec ref §3.1.3, §3.1.4, §3.1.5, §3.3.5

The associate, match, gap-match, graphic-gap-match and graphic-associate extractors read `matchGroup`
into the choice data, and the default components filter every pairing through
`isMatchGroupCompatible` (`packages/item-player/src/core/matchGroups.ts`), so the delivered UI offers
exactly the pairs validation accepts. The specification defines `matchGroup` as the identifiers a
choice may be matched with, while the published example and the default components read the tokens
as group labels; validation refuses a pair only when neither reading allows it (see
`docs/QTI_techguide.md` §7.4). Since 2026-11-07 `validateResponses` reports each pair of a restored
or programmatic response that `matchGroup` forbids as a `match_group` error, reading the authored
`matchGroup` of both sides, gaps and associable hotspots included.

#### G-02: `label` element on `inlineChoiceInteraction` not extracted

Done (already implemented; no code change needed) · Spec ref §3.2.1

`InlineChoiceData.label` carries the optional `<label>` child
(`packages/item-player/src/interactions/inline-choice/extractor.ts`). `InlineChoice.svelte` in the
same folder uses it as the placeholder `<option>`, falling back to the data prompt and then to the
localized `Select...` string when the item has none.

#### G-03: `format` attribute on `textEntryInteraction` not extracted

Done (commit e2660fb, 2026-04-29) · Spec ref §3.2.2

The text-entry extractor reads `format` into `TextEntryData.format`
(`packages/item-player/src/interactions/text-entry/extractor.ts`).

#### G-04: `patternMask` not enforced as live input constraint

Done (commit e2660fb, 2026-04-29; XSD pattern semantics and response validation for text entry and extended text, 2026-11-09) · Spec ref §3.2.2, §3.2.3

`patternMask` is enforced with XSD pattern semantics by response validation
(`packages/item-player/src/core/processing/responseValidation.ts`) and is honoured by the inline
text-entry and extended-text renderers.

#### G-05: `testFeedback` visibility only handles boolean outcomes

Done (2026-10-14) · Spec ref §2.1 (Assessment Architecture — testFeedback)

Visibility uses the shared `isShownByIdentifier` rule: equality for a single outcome, membership for
a multiple or ordered one, and a NULL outcome matches nothing. `submitResponses`, a resumed
`initSession` and `finalizeAssessment` return the test-level outcome values as typed
`TestOutcomeValues`, and the player recomputes feedback on each. Test-level `during` feedback shows
once outcome processing has run and `atEnd` once the test is finalized; `testPart` feedback is
parsed onto `SecureTestPart` and follows the same timings against the part. QTI 3 content is
unwrapped from `qti-content-body`. Evidence:
`packages/assessment-player/tests/test-feedback-outcomes.test.ts`.

#### G-06: `matchMin` usage constraint not validated at submission time

Done (commit e2660fb and a follow-up, 2026-04-29) · Spec ref §3.1.3, §3.1.4, §3.1.5, §3.3.4, §3.3.5

`Player.validateResponses()` counts each choice's appearances in the response — across choices, gap
texts, gap images, match sets and associable hotspots — and reports the response incomplete while
any choice is below its `matchMin`.

#### G-07: STATUS.md and README.md are inconsistent about QTI 3.0 scope

Done (commit e2660fb, 2026-04-29) · Spec ref N/A

`STATUS.md` and `README.md` were aligned on QTI 3.0 scope. Keeping every status surface honest is a
standing 1.0 acceptance criterion rather than a one-off fix: see "Honest status surfaces" in
[`plans/version-1-0-2026-10.md`](plans/version-1-0-2026-10.md).

#### G-16: Lossless `assessmentTest` XML ingestion and one authoritative test model

Done (dynamic structure semantics 2026-10-15; discovery-parser consolidation 2026-10-17, PR #333) · Spec ref QTI assessment-test information model

`ReferenceBackendAdapter.parseAssessmentTestXml()` preserves ordered nested sections and external
section references, per-testPart navigation and submission modes, selection, ordering, `required` and
`fixed`, item-ref weights and branch rules, serialized section and item-ref preconditions, time
limits, outcome processing and test feedback. The raw-XML custom-element reference mode uses that
parser instead of converting through a flattened `SecureAssessment` copy.

The backend draws selection and ordering once at session start and stores the drawn assessment, so
a resume returns the same draw. `withReplacement` repeats are cloned with suffixed identifiers
(`.2`, `.3`), each with its own item session and result, and an invisible `keepTogether="false"`
section is mixed into its parent's shuffle. Branch rules run on item refs, sections and test parts
(item and section rules in linear parts only), with `EXIT_SECTION`, `EXIT_TESTPART` and
`EXIT_TEST`. Preconditions are evaluated on entering each test part, section and item ref against
typed test outcomes and the submitted items' variables after `variableMapping`. `itemSessionControl`
cascades from the test part through every enclosing section to the item ref over the QTI defaults;
the backend enforces `maxAttempts` and `allowComment`, and the player applies `showFeedback`,
`showSolution` and `validateResponses` per item and evaluates `templateDefault` before template
processing. External `assessmentSectionRef` recursion rejects cycles and enforces a configurable
depth limit (32 by default).

A small discovery parser remains in `player-elements` as the bounded pre-fetch surface and a public
standalone utility: it resolves referenced resources before the authoritative parse. The
canonical-name and encoded-path scan primitives are single-sourced, and the
discovery/authoritative boundary and the element's `itemXmlMap` keying contract are documented in
code.

#### G-17: `positionObjectStage` hierarchy is reversed

Done (schema-valid QTI 2.2/3.0 parent-stage extraction, 2026-07-13) · Spec ref QTI positionObjectStage / positionObjectInteraction content model

The extraction pipeline discovers each `positionObjectInteraction` below its parent
`positionObjectStage`, reading the shared background from the parent and the draggable `object` from
the child interaction; QTI 2.2 and 3.0 fixtures cover multiple interactions under one stage.
Candidate operability, mobile, keyboard and accessibility verification stay in the interaction PRD
and eval work; they are not implied by extraction coverage.

#### G-18: QTI 3 mapper prefixes HTML/MathML/foreign vocabulary

Done (authoritative QTI map plus foreign-vocabulary pass-through, 2026-07-13) · Spec ref QTI 3.0 naming convention and ASI content model

`Qti3ElementNameMapper` converts only known QTI vocabulary names; unprefixed HTML, MathML, SVG and
extension names pass through unchanged, and the non-standard `qti-object`, `qti-param` and
`qti-composite-interaction` mappings were removed. Add new QTI names explicitly when the supported
information model expands; do not restore a pattern fallback that invents `qti-` names for foreign
vocabularies.

#### G-19: Standard response-template aliases do not match canonical XML semantics

Done for the supported fixed-template URI set (2026-07-13) · Spec ref QTI 2.x standard response-processing templates; Common Cartridge 2 aliases

Fixed-template execution follows the canonical `RESPONSE` program rather than aggregating all
response declarations. `match_correct`, `CC2_match`, `CC2_match_basic`, `map_response`,
`map_response_point` and `CC2_map_response` are regression-tested against the corresponding XML
programs, including `MAXSCORE`, null handling and Common Cartridge feedback outcomes. Since
2026-11-07 a `responseProcessing` that only references any other template fails compilation with
`UnsupportedResponseProcessingTemplateError` instead of warning and scoring the outcome defaults;
inline rules still take precedence over a template reference. A newly accepted template URI is added
together with an XML-program oracle test; URI filename similarity alone does not alias behavior.

#### G-20: Linear navigation and modes must be test-part scoped

Done for current assessment delivery (2026-07-13) · Spec ref QTI testPart navigationMode and submissionMode

The secure model preserves navigation and submission modes on every test part. Linear delivery
permits only the current item or the immediate next item and does not expose previous navigation;
nonlinear parts retain free in-part navigation. Test parts are entered sequentially and cannot be
re-entered after advancing, and individual submission is selected from the active test part.
Preconditions and section and test-part branch rules (G-16) change the next eligible target without
weakening the irreversible linear rule.

#### G-21: Record is a cardinality, not a base type

Done (typed record fields and round-trip coverage, 2026-07-13) · Spec ref QTI variable declarations and record fieldValue semantics

Runtime types model `record` as a cardinality with no declaration-level base type. Declaration
parsing retains each value's `fieldIdentifier` and field-level `baseType`, and public response
coercion, default and correct values, evaluator `fieldValue` over a record variable, equality, and
ItemSession serialization and restoration preserve the typed fields across QTI 2.2 and 3.0. The
evaluator's authored `<record>` constructor was non-QTI and has been removed; a record value reaches
expressions through its variable. Never introduce a synthetic `record` BaseType; add record-shaped
operator fixtures as more processing operators are exercised.

#### G-22: Time limits require independent scope clocks and `minTime` enforcement

Done (deterministic edge coverage, 2026-10-16; min-time UI affordances remain host work) · Spec ref QTI timeLimits and duration variables

The player tracks assessment, testPart, section and item clocks independently, persists them across
save and resume, uses the shortest active hard maximum, and enforces each applicable `minTime` when
leaving or submitting a scope. A test-part, section or item limit without late submission closes
that scope's items when it expires and moves delivery to the next item outside it; only the
assessment limit ends delivery. The player config accepts a deterministic `now` clock.

QTI duration variables are seconds (2026-11-07): the item's built-in `duration` variable and
`ITEM.duration` as a test-level expression hold seconds, and Results Reporting writes the test,
test-part and section durations in seconds. Clocks and the host-facing `duration` and `timing`
fields stay in milliseconds. Test-level outcome processing declares the built-in `duration`,
`TESTPART_ID.duration` and `SECTION_ID.duration` variables from the timing state
(`durationSecondsFromMilliseconds` in `@pie-qti/qti-processing`).

Candidate-facing minimum-time affordances (a countdown UI for `minTime`) remain host work; the
effective-limit getters are the intended data source. Evidence:
`packages/assessment-player/tests/time-limit-edges.test.ts` and
`packages/assessment-player/tests/outcome-processing-durations.test.ts`.

#### G-23: Optional-response and extended-text cardinality semantics

Done (QTI 2.2/3.0 response and rendering coverage, 2026-07-13) · Spec ref Interaction response validity; extendedTextInteraction

Response completeness derives from authored minimum constraints rather than the mere presence of a
ResponseDeclaration, so an optional interaction submits empty successfully. Extended text supports
`single`, `multiple`, `ordered` and `record`, honors `base`, `stringIdentifier`, `minStrings`,
`maxStrings` and format, and preserves the exact numeric record fields (`stringValue`, `floatValue`,
`integerValue`, `leftDigits`, `rightDigits`, `ndp`, `nsf`, `exponent`); its lexical companion
response is restored to the editor across remounts. Browser accessibility and mobile verification of
the dynamic multi-string editor count as release evidence only when run; they are not inferred from
unit tests.

#### G-24: Resolve external processing fragments

Done (package-contained resolver through assessment delivery and XInclude namespace gate, 2026-10-16) · Spec ref QTI responseProcessingFragment / outcomeProcessingFragment and XInclude

The processing AST and ItemPlayer accept an explicit host-owned resolver for response, template and
outcome fragments. They support XInclude fallback and reject missing resolvers, wrong fragment
modes, cycles, excessive depth and excessive cumulative XML size; the engine performs no implicit
network or filesystem reads. Reference-mode assessment parsing preloads each item's external
fragments, recursively and relative to the referencing document, into the delivery context, and
`createAssessmentItemDefinition` derives a package-contained resolver from it, so assessment and
section delivery execute packaged fragments without host wiring and an authored `xi:fallback` runs
when a fragment file is missing. The builder requires the XInclude namespace for `include` and
`fallback` and fails loudly on foreign vocabulary.

Test-scope (`scope: 'test'`) fragments still require a host-supplied resolver and fail closed;
revisit only if packaged test-level fragments become a real content requirement. Evidence:
`packages/assessment-player/tests/processing-fragment-resolver.test.ts` and
`packages/qti-processing/tests/processing-fragments.test.ts`.

#### G-26: QTI Results Reporting output

Done (2026-11-07) · Spec ref QTI 2.2 Results Reporting (`imsqti_result_v2p2`); QTI 3.0 Results Reporting (`imsqti_result_v3p0`)

`toAssessmentResultXml(results, { version: '2.2' | '3.0' })` writes the assessment player's results
data — delivered test, session state and finalize response — as an `assessmentResult`: context
`sourcedId` and session identifiers; test outcomes typed by the test's declarations and the test,
test-part and section durations in seconds; and an item result per recorded item with
`sequenceIndex`, `datestamp`, a derived `sessionStatus`, response, outcome, template and (3.0)
context variables, the built-in `numAttempts` and `duration` response variables, and the candidate
comment. `serializeAssessmentResult` writes a hand-built report; values are XML-escaped and
identifiers are validated against the target schema's NCName type.

Not covered: `choiceSequence` (the player does not record presentation order), QTI 3.0 `support`
elements and `scoreStatus` / `answeredStatus`. An in-tree xmllint schema gate
(`packages/assessment-player/tests/assessment-result-xsd.test.ts`, on the shared results fixture)
validates both versions' output when the official result schemas are vendored under its
`tests/schemas/results/`; they ship with the 1EdTech spec packages rather than this public repo, so
until they are dropped in the XSD dimension is validated by hand or in the private runner.
Evidence: `packages/assessment-player/tests/assessment-result-xml.test.ts`.

#### G-27: Compliance checks without an XSD engine

Done (2026-11-07) · Spec ref QTI 2.2 / 3.0 ASI XSD element vocabulary; interaction–responseDeclaration binding

Item compilation checks the root's QTI namespace (`detectQtiVersionDetailed` reports basis,
confidence and warnings), element names against the XSD-verified QTI 2.2 and 3.0 vocabulary
(`isQtiVocabularyElement`, tested equal to the vendored schemas' element sets), unbound
`responseIdentifier`s, QTI interactions without one, and response-bound elements no registered
extractor renders. Findings are warnings by default and errors in strict mode, listed on
`AssessmentItemDefinition.diagnostics`; strict mode with `rejectUnknownExtensions` throws a
`QtiComplianceError`. Attributes, content models and value spaces still need an XSD validator outside
the browser player. Evidence: `packages/item-player/tests/core/compliance.test.ts`,
`packages/item-player/tests/extraction/interaction-coverage.test.ts` and
`packages/qti-common/src/version-detection/__tests__/`.

### Tier 2 — QTI 3.0 features we committed to support

These are the QTI 3.0 features listed in `docs/QTI-3-MIGRATION-GUIDE.md`. The name-mapping
infrastructure (element and attribute mappers, version detection) was already in place; the gaps
below were the application-level work.

#### G-08: PCI — Portable Custom Interaction module lifecycle

Done (phases 1–3 in-repo, 2026-10-16; phase 4 sandboxed realm is opt-in hardening on the same track) · Spec ref §6.1

The production extraction registry recognizes both the QTI 3.0 portable elements and QTI 2.x
`customInteraction` wrappers containing a namespaced PCI payload. The default portable renderer
mounts sanitized scaffold markup and drives the full `PciHost` lifecycle; item, section and
assessment custom-element delivery propagates a JS-only `pci` configuration to the renderer.
Execution is disabled unless the embedding host supplies a module resolver — the player never
imports an authored URL itself — and the host resolver stays responsible for package-manifest,
URL/origin and integrity validation. The resolver is a trust-decision boundary, not a JavaScript
sandbox: accepted PCI code runs with the page's authority. Ordinary non-PCI `customInteraction`
content keeps its generic fallback renderer.

The bespoke `PciModule` interface was replaced outright (phase 1, 2026-10-16) with the contract QTI
3.0 specifies: modules register against the page's `qtiCustomInteractionContext`, the host
instantiates through `getInstance(dom, configuration, state)` with `configuration.onready` /
`ondone` and a `status` of `interacting`, `closed`, `solution` or `review`, responses cross the
boundary as QTI variable JSON, and restore re-seeds `getInstance` with `getState()` output — there
is no setter, so an authoritative response change re-instantiates the module. The variable JSON
follows the PCI v1.0 Appendix A binding that QTI 3.0 adopts (`qtiVariableJson.ts`, corrected
2026-11-08): pair, directedPair and point values are two-element arrays, a duration is an ISO 8601
string, a file is `{data, mime, name}`, and a record is an array of `{name, base | list}` members.
Input outside the binding reads as NULL.

Phase 2 landed the AMD loader (`amdLoader.ts`), the RequireJS-shaped resolution config
(`resolutionConfig.ts`, probing `modules/module_resolution.js` and
`modules/fallback_module_resolution.js`), multi-module extraction with per-entry ids, and entry
selection by the `customInteractionTypeIdentifier` tail. Phase 3 landed the clean-room conformance
fixtures in `packages/item-player/tests/conformance/pci/`, which drive registration, state restore,
`ondone` and fallback resolution over real module files. Phase 4, the opt-in sandboxed realm
(`PciConfiguration.sandbox`, `@pie-qti/pci-runner`), landed as opt-in hardening on 2026-10-16; the
PIE-projection reconsideration was re-closed on 2026-10-18 with its record in
[`plans/pci-runtime-and-sandbox-2026-08.md`](plans/pci-runtime-and-sandbox-2026-08.md).

Outstanding: official-candidate browser evidence in the private runner (it waits for a published
candidate) and a genuinely third-party-authored PCI as the same-reading check. The demo's
clean-room tally-counter modules (`apps/demo/static/pci/`) stand in for that check with browser e2e
coverage in both realms — the page realm through the host resolver, and the sandboxed realm through
a locally served runner page (`?pciSandbox=1`), including a submitted-session restore that
re-instantiates the module with its saved state. The 2026-08-17 intake measurement (zero
`portableCustomInteraction` content, no QTI 3.0 packages) stands as data; the completeness goal
supersedes it as the driver.

#### G-09: PNP — Personal Needs and Preferences profile support

Done (core profile commit fa8fa97, 2026-04-28; color-scheme rulesets shipped in commit 6c209e27 as `qti-pnp.css`) · Spec ref §6.2

PNP support covers the current delivery scope: `AssessmentItemDefinitionConfig.pnp`, the
`ItemSession` `updatePnp` command, the elimination tool, extended time, and glossary and
keyword-translation trigger UI. The color scheme is written as `data-qti-colorscheme` on the player
root, and the rulesets ship as `qti-pnp.css` in `@pie-qti/default-components` (exported as
`./qti-pnp.css` and copied into the web-component loaders' `default-runtime.css`), styling every
scheme plus inverted polarity, single-column layout and text appearance, with the scheme tokens
inheriting into shadow roots. Structured labels and braille routing landed under G-13, and
package-level catalog discovery under G-15.

#### G-10: Catalog system — `qti-catalog` parsing and glossary rendering

Done (commit fa8fa97, 2026-04-28) · Spec ref §6.3

Catalog parsing, `player.getCatalogEntry()`, inline glossary and keyword-translation popups, and
platform-level catalog lookup events are implemented; manifest-level shared catalog discovery landed
as G-15.

### Tier 3 — QTI 3.0 features on the 1.0 track

These were previously deferred without a milestone. Under the completeness goal they were committed
for 1.0, sequenced after the PCI spec contract, and have landed.

#### G-11: Full QTI `<outcomeProcessing>` XML interpreter at assessment level

Done (interpreter 2026-07-13; full test context 2026-10-15) · Spec ref §2.1 (Assessment Architecture), §4.3

`ReferenceBackendAdapter` parses outcome declarations and outcome-processing XML and executes it
with a test context. The test context holds every delivered item, submitted or not: its response,
outcome, template and built-in variables with their declared base type and cardinality, the section
path, item-ref categories, weights as a record, declared `normalMinimum` and `normalMaximum`, and
the presented, responded, correct, incorrect and selected flags. Correctness comes from item scoring
(every response matches its correct response), so `numberCorrect` needs no `MAXSCORE`; unsubmitted
items carry their declared defaults. The computed outcomes drive test feedback (G-05).

Production use remains backend-authoritative: an injected backend supplies the secure
assessment/session model rather than exposing answer-bearing assessment XML in the browser. Keep
packed-artifact and browser outcome assertions in release verification, and track dynamic
assessment-structure semantics under G-16 rather than conflating them with outcome-processing
execution. Evidence: `packages/assessment-player/tests/outcome-processing-inputs.test.ts`.

#### G-12: Composite items (terminology correction)

Done (the original gap was based on a non-standard element) · Spec ref QTI assessment-item information model

A composite item is an `assessmentItem` containing more than one interaction, not a distinct
interaction type; QTI 3.0 defines no `<qti-composite-interaction>` element. The player already
extracts and renders multiple standard interactions from one item, and the stray
`qti-composite-interaction` entry was removed from the QTI 3 element mapping with the G-18 mapper
work (2026-07-13). Do not add an extractor or component for it; keep regression coverage for items
with multiple independent interactions.

#### G-13: PNP — structural label and braille support

Done · Spec ref §6.2

Research on 2026-10-16 found that neither APIP 1.0 nor AfA PNP 3.0 defines a structured-label term
(verified against the published XSDs), so `structuredLabelSupport` is a player extension anchored
in WAI-ARIA group labelling. The findings, markup contract and NVDA checklist are in
`packages/item-player/docs/PNP.md`.

`pnp.display.structuredLabelSupport` rides the presentation plan to every block interaction. With
it, `matchInteraction` announces its answer set as one `role="group"` named by the prompt (without
a prompt, an authored accessibility name, else an i18n fallback), and its columns take their visible
headings as `aria-labelledby` names. `choiceInteraction` needs no flag: its answer set is always one
`role="group"`, named by an authored accessibility name, else the prompt, else an i18n fallback. An
AfA `<braille/>` grant maps to the platform `brailleText` preference (sign language to
`signingDefinition`), and a `braille-text` lookup falls back to APIP's `braille` usage, so QTI 3 and
APIP catalogs share one routing path. `player.getCatalogEntry(idref, 'braille-text')` and the
`qti-catalog-lookup` event expose the payload; device routing stays host-side.

#### G-14: PNP — sign language and TTS pronunciation routing

Done (commit fa8fa97, 2026-04-28; through `qti-catalog-lookup`) · Spec ref §6.2, §6.3

`signing-definition` and `tts-pronunciation` need platform capabilities — a sign-language video
player, a TTS engine that accepts phonetic overrides — that are outside the player. The player
exposes the data and fires events; the host provides the capability. `getCatalogEntry()` returns
any usage, and with a platform usage active (`tts-pronunciation`, `signing-definition`,
`braille-text`, `audio-description`, `extended-description`), activating a linked term fires a
`qti-catalog-lookup` CustomEvent carrying `idref`, `usage`, the entry's content and its language,
which the host routes to its engine or player. The single event replaced the per-usage events the
original plan proposed. See `packages/item-player/docs/PNP.md`.

#### G-15: Shared / external catalog files

Done · Spec ref §6.3 (Shared Catalogs)

Large item banks share glossary terms through a standalone `qti-catalog` XML file listed as a
resource in `imsmanifest.xml`. `loadResolvedManifest` surfaces manifest resources of type
`imsqti_catalog_xmlv3p0` as `sharedCatalogs`. `createResolvedItemDeliveryContext` accepts
`packageCatalogSources` (href, xml or both) and lands them in `deliveryContext.catalogSources` with
scope `package`; the reference backend adapter threads a host-supplied list through every item, and
`QtiAssessmentPlayerConfig.sharedCatalogs` reaches it from the web component. The item Player merges
package-scope entries at the bottom, below `catalogXml` and the item's own catalogs, so an
item-level `qti-catalog-info` wins a shared identifier.

#### G-25: QTI 3.0 writer

Done (PR #302, 2026-10-14) · Spec ref §1.3 (Version Differences Reference)

QTI 3.0 import is supported end to end, so a package can enter as QTI 3.0 and leave as QTI 2.2.
Round-tripping QTI 3.0 content, or exporting to a QTI 3.0-only platform, needed a writer that emits
`imsqti_v3p0` items, stimuli, tests and manifests with the `qti-` kebab-case vocabulary. That writer
is a `targetVersion: '3.0'` option on the existing `PieToQtiPlugin` (default `'2.2'`,
`packages/pie-to-qti2/src/plugin.ts`); the generators emit through the element and attribute mappers
in `@pie-qti/qti-common`, including `qti-assessment-stimulus` resources for passages.

---

## Delivery backlog

Known, accepted delivery limits from the round-5 delivery review and the later low-level reviews
(2026-11). Each is open work, not a defect in the behaviour shipped today.

- Nested `xml:lang` on inner elements of feedback, instruction and rubric content keeps only its block-level language where content renders as given (the shell's item-feedback dialog for backend `result.feedback`, host-supplied `html`); the conversion is `prepareReadableBlock` — `packages/section-player/src/tts/spoken-catalogs.ts`, `packages/assessment-player/src/components/AssessmentShell.svelte`.
- No per-scope countdowns: the timer shows only the nearest active limit — `packages/assessment-player/src/components/AssessmentTimer.svelte`, `getTimeState()` in `packages/assessment-player/src/core/AssessmentPlayer.ts`.
- No mid-session time extension: PNP extended time is fixed when the player is created — `packages/assessment-player/src/core/TimeManager.ts`.
- PNP `line-reader` is parsed into the profile's tool supports, but no built-in line reader renders it — `packages/item-player/src/pnp/parsePnpXml.ts`.
- The section tool bar hosts only the tools the host configures; there is no built-in calculator, ruler, protractor or TTS of pie-qti's own — `packages/section-player/src/components/QtiToolButtonBar.svelte`.

Accepted limits recorded at the player-cleanup close (2026-11-10) — each is open polish work,
not a defect in the behavior shipped today:

- Object-typed element options compare by reference: rebuilding an equal `security`/`pnp` config
  object every render re-opens the element's session (`packages/player-elements`).
- A permanently removed element keeps its session until page unload.
- Section elements have no `showFeedback` pass-through.
- Persisted-display settings use fingerprints with known limits (strict CSP `style-src` reports
  the tool bar's `data:` stylesheet marker).
- `SectionLayout` does not deep-validate direct-Svelte compositions; the registered custom
  elements do.
- Graphic-associate label wrapping under narrow viewports and text-spacing overrides needs
  polish (`packages/default-components/src/plugins/graphic-associate/`).
- Non-English `item.submitError` strings lack native-speaker review
  (`packages/i18n/src/locales/`).
- Deferred internal polish: component splits beyond the shared-module extraction
  (PositionObject, GraphicGapMatch internals), section spoken-catalog parsing vs the item's,
  `TimeManager` tick restructuring, hottext's imperative DOM work.
- Documented non-implementations (deliberate, per interaction PRD): order
  `data-choices-container-width`, `mediaInteraction@coords`, tabular match
  (`data-first-column-header`).

Accepted limits recorded with the closed gaps above:

- Test-level (`scope: 'test'`) outcome-processing fragments still require a host-supplied resolver
  (G-24).
- Results Reporting omits `choiceSequence`, QTI 3.0 `support` elements and `scoreStatus` /
  `answeredStatus` (G-26); attributes, content models and value spaces still need an XSD validator
  outside the browser player (G-27).
- Candidate-facing minimum-time affordances remain host work (G-22).
- PCI official-candidate browser evidence waits for a published candidate, and a genuinely
  third-party-authored PCI remains unrun; the demo's clean-room modules cover both realms in
  browser e2e (G-08).

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
| `packages/item-player/src/interactions/text-entry/` | G-03, G-04 |
| `packages/default-components/src/plugins/extended-text/` | G-04, G-23 |
| `packages/assessment-player/src/core/` | G-05, G-09, G-11, G-16, G-20, G-22 |
| `packages/assessment-player/src/integration/ReferenceBackendAdapter.ts` | G-11, G-16 |
| `packages/player-elements/src/qti/` | G-16 |
| `packages/item-player/src/core/processing/responseValidation.ts` | G-04, G-06 |
| `STATUS.md`, `README.md` | G-07 |
| `packages/item-player/src/interactions/custom/` | G-08 |
| `packages/item-player/src/interactions/portable-custom/` | G-08 |
| `packages/item-player/src/pci/` | G-08 |
| `packages/item-player/src/pnp/` | G-09, G-13, G-14 |
| `packages/default-components/src/plugins/choice/` | G-09 |
| `packages/default-components/src/plugins/portable-custom/` | G-08 |
| `packages/item-player/src/catalog/` | G-10 |
| `packages/default-components/src/catalog/` | G-10 |
| `packages/item-player/src/interactions/position-object/` | G-17 |
| `packages/item-player/src/interactions/extended-text/` | G-23 |
| `packages/item-player/src/core/Player.ts` | G-01, G-19, G-21, G-23, G-24, G-27 |
| `packages/item-player/src/core/compliance.ts` | G-27 |
| `packages/qti-common/src/element-mapper/` | G-18 |
| `packages/qti-common/src/version-detection/` | G-27 |
| `packages/assessment-player/src/reporting/` | G-26 |
| `packages/qti-processing/` | G-11, G-19, G-21, G-24 |
| `packages/ims-cp-browser/` | G-15 |
| `packages/pie-to-qti2/` | G-25 |

---

*This document is the record for spec-gap work. When a gap is resolved, replace its entry with the
outcome form used above and add the PR or commit reference.*
