# Interchange Defect Remediation Plan

**Status**: In progress — D1 through E8 merged in #269 (662e5a9, 2026-10-10); P1 on
`fix/graphing-solution-set-partial-scoring` and P2 on `fix/likert-is-complete` are fixed and unmerged
**Last reviewed**: 2026-10-14
**Scope**: `packages/to-pie/src/`, `packages/to-pie/README.md`, `packages/pie-to-qti2/src/`,
`packages/pie-to-qti2/docs/QTI-COMPLIANCE.md`; in pie-elements-ng,
`packages/elements-react/graphing-solution-set/src/controller/` and
`packages/elements-react/likert/src/delivery/`

Fixes the defects found in the October 2026 interchange assessment: wrong behavior in QTI import
(`to-pie`), QTI 2.2 export (`pie-to-qti2`) and two pie-elements-ng controllers. QTI 3.0 import,
stimulus references and catalogs landed through
[`qti3-accessibility-passages-2026-10.md`](qti3-accessibility-passages-2026-10.md). Partner custom
interactions, a QTI 3.0 writer and PCI wrapping are missing features, tracked in
[`../SPEC-GAPS-PLAN.md`](../SPEC-GAPS-PLAN.md) (G-08, G-25) and
[`pci-runtime-and-sandbox-2026-08.md`](pci-runtime-and-sandbox-2026-08.md). Copies of these defects
in the legacy `pie-elements` and `pie-lib` repositories take no work.

---

## Exposure

- **Concrete**: an existing consumer or reader is misled or misbehaves today.
- **Latent**: the code is wrong and no production path exercises it yet.

`pie-to-qti2` has no production consumer, so every export defect is latent and turns concrete with
the first adopter. Import defects were sized against a third-party QTI corpus
(935,929 items in 16,881 packages), sampling equally from each of the 13 sources holding more than
1,000 items.

| ID | Defect | Package | Exposure | Evidence |
|---|---|---|---|---|
| D1 | README claims QTI 3.0 import | to-pie | Concrete; fixed, merged | QTI 3.0 input is rejected |
| D2 | Compliance doc claims XSD conformance | pie-to-qti2 | Concrete; fixed, merged | every probed export fails the QTI 2.2 XSD |
| I1 | A broken PIE extension aborts the package | to-pie | Latent; fixed, merged | only pie-to-qti2 output carries the extension |
| I2 | Embedded `sourceModel` overrides an edited QTI body | to-pie | Latent; fixed, merged | as I1 |
| I3 | Feedback markup leaks into labels or drops silently | to-pie | Latent; fixed, merged | 0 of 5,200 sampled items carry feedback markup |
| I4 | Validator reports non-well-formed XML as valid | to-pie | Latent; fixed, merged | 3 of 1,950 sampled items fail a strict parse |
| I5 | Stem or prompt dropped when an item has both | to-pie | Concrete; fixed, merged | 42 of 1,840 transformed sampled items |
| E1 | Generators never match real PIE items | pie-to-qti2 | Latent; fixed, merged | no consumer |
| E2 | No response processing or `SCORE` | pie-to-qti2 | Latent; fixed, merged | no consumer |
| E3 | Output violates the QTI 2.2 schema | pie-to-qti2 | Latent; fixed, merged | no consumer |
| E4 | `]]>` in model content breaks well-formedness | pie-to-qti2 | Latent; fixed, merged | no consumer |
| E5 | Only the first interaction is exported | pie-to-qti2 | Latent; fixed, merged | no consumer |
| E6 | Rubric models are dropped | pie-to-qti2 | Latent; fixed, merged | no consumer |
| E7 | Embedded QTI source discards PIE edits | pie-to-qti2 | Latent; fixed, merged | no consumer |
| E8 | Authored HTML written raw into XML | pie-to-qti2 | Latent; fixed, merged | of 1,829 production prompts: `&nbsp;` 70, `<br>` 139, `<img>` without `alt` 299 |
| P1 | graphing-solution-set ignores partial scoring | pie-elements-ng | Latent; fixed, unmerged | setting absent from 100 of 100 production models sampled |
| P2 | likert never reports a complete session | pie-elements-ng | Fixed, unmerged | — |

---

## Documentation Claims

D1 and D2 are text changes for readers today. I5 is the one code defect with a consumer today.

- **D1.** `packages/to-pie/README.md` lists "QTI 3.0 (items and assessments; auto-detected)" under
  supported versions. to-pie detects QTI 3.0 and rejects it. The section states QTI 2.1 and 2.2
  input, with QTI 3.0 rejected by a diagnostic, until QTI 3.0 normalization lands. QTI 3.0
  normalization landed in #285, and the README now lists QTI 3.0 items, stimuli and tests.
- **D2.** `packages/pie-to-qti2/docs/QTI-COMPLIANCE.md` states that all generated items conform to
  the official XSD. The claim is withdrawn until the validation gate below passes without exceptions.

---

## Import (to-pie)

### I1: Package Abort on a Broken Extension

`extractFromPieExtension` throws a bare `Error` when `hasPieExtension` matches and
`extractPieExtension` yields no source model. `package-transformer.ts` rethrows anything that is not
a `QtiItemTransformError`, so one malformed item aborts the whole package, contrary to FR-11 in
[`../prds/architecture/qti-to-pie.md`](../prds/architecture/qti-to-pie.md).

A broken extension falls back to transforming the QTI body and records a trace warning, because the
extension is a fidelity optimization and the body is complete QTI. Only a body that also fails to
transform raises a `QtiItemTransformError`. The warning is `PIE_EXTENSION_UNREADABLE`, and the trace
records a `fallback` event.

### I3: Feedback Leak and Silent Loss

`modalFeedback`, `feedbackBlock` and `feedbackInline` reach PIE only through drag-in-the-blank (the
first `modalFeedback` becomes the rationale), inline-dropdown (every `feedbackInline` becomes the
rationale) and EBSR (each choice's first `feedbackInline` becomes its feedback).
Explicit-constructed-response drops `feedbackInline` without mapping it. Elsewhere feedback either
drops with no warning or leaks: a `feedbackInline` inside a `simpleChoice` lands in the choice label,
and EBSR put it in the label as well as the feedback. QTI shows feedback by outcome and PIE has no
outcome to drive it from, so leaked markup renders before the learner answers and can reveal the
answer.

None of 5,200 sampled partner items (400 from each source) carries any QTI 2 or QTI 3 feedback
element, which bounds each source below roughly 0.75% at 95% confidence. Mapping feedback onto PIE
`feedback` and `rationale` therefore waits for a partner package that carries it.

The generic transform path removes every feedback element its built-ins do not map before they run,
cutting by source offset so the rest of the item stays byte-identical, and reports the removal per
item as `QTI_FEEDBACK_DROPPED` with counts by element. The embedded `qtiSource`, metadata extraction
and source-profile handlers keep the original XML. EBSR labels exclude the mapped `feedbackInline`.

### I4: Well-Formedness

`validateQti` checks well-formedness with fast-xml-parser's `XMLValidator`, which accepts `]]>` in
character data, undeclared entity references such as `&nbsp;`, `<` in attribute values and control
characters. libxml2 reports all four while running the XSD pass. The default
`xsdSeverity: 'warning'` demotes those parser errors to warnings along with schema findings, and with
`xsd: false` nothing reports them at all, so a host gate that validates with `xsd: false` passes
such items as well-formed. One of 2,600 sampled items has an
undeclared entity (`&sdot;`, Savvas); in the 1,950-item prompt sample, 3 items fail a strict parse:
`&mdash;` with no DTD (TCI) and `<mfenced open="<">` (McGraw Hill, 2). All three convert today,
because the transforms parse leniently.

libxml2, run through `xmllint-wasm` with no schema, decides well-formedness after fast-xml-parser,
which keeps its tag-level messages. Failures are fatal errors with or without `xsd`, and
`xsdSeverity` governs schema findings only, since malformed documents never reach the schema pass.
The strict parse costs about 14ms per call, almost all of it instantiating the wasm module, and
about 0.3ms per document within a batch. A gate that validates per item and per step pays the 14ms
on every call; the schema compile (0.58s for QTI 2.1, 3.07s for QTI 2.2) does not apply with
`xsd: false`.

### I5: Stem and Prompt Loss

The choice, extended-response and EBSR transforms built the PIE `prompt` from either the body content
before the interaction (the stem, often a passage or a figure) or the interaction's own `<prompt>`,
and dropped the other when both were present. Body markup with nothing to render, such as an empty
`<p>`, also counted as a stem and hid the prompt. EBSR Part B lost the content between its two
interactions.

Across the 1,840 sampled items that transform, 15 lost their stem (all Baltimore County) and 27 lost
their prompt (TCI 20, Baltimore County 6, Accelerate Learning 1). Items converted from these
sources before the fix carry the loss.

The prompt is the body content before the interaction followed by the interaction's `<prompt>`, each
wrapped in a `<div>` unless it is already block content. Markup with nothing to render counts as
absent, paragraphs stay separate, and a stem that is a single `<p>` keeps the inline form it has
always been stored in. Each EBSR part takes the body content before it, starting after Part A for
Part B. The same sample transformed again loses no stem and no prompt.

---

## Export (pie-to-qti2)

Every export defect is latent. The order is forced. The validation gate comes first, because no
later fix can be verified without it. Generator lookup comes second, because until it lands no real
item reaches a native generator.

### Validation Gate

Every generator fixture, composed multi-interaction items, inline passages, rubrics and standalone
passage files run their output through `validateQti(xml, { xsdSeverity: 'error' })` and back through
to-pie with the sidecar, in `packages/pie-to-qti2/tests/integration/schema-gate.test.ts`. The gate
passes without exceptions, and D2's claim is restored in `QTI-COMPLIANCE.md` together with the
scoring approximations under E2.

### E1: Generator Lookup by Element Tag

`BaseGenerator.canHandle` compares `model.element` with the generator's package id
(`@pie-element/multiple-choice`). PIE items name models by element tag and map tags to packages in
`config.elements`, which is the shape to-pie's `makePieItemPlayerReady` produces. Every real item
therefore falls through to the `customInteraction` generator with an embedded model. The passage and
rubric filters in `plugin.ts` compare package ids too, so a tag-named passage or rubric model is
treated as an interaction and can become the item's primary interaction. The round-trip tests pass
because their fixtures name models by package id.

Each model's package is resolved once through `config.elements`, with the version stripped, before
filtering and generator lookup. Older items key `config.elements` by package id and map it to a bare
version (`'@pie-element/multiple-choice': '1.0.0'`); such an entry keeps the element as the package.
The fixtures move to tag form so that tests exercise the shape consumers send.

### E2: Response Processing

Generators emit `responseDeclaration` but no `responseProcessing` and no `SCORE` outcome, so a QTI
delivery engine cannot score an exported item. Each generator declares `SCORE` and `MAXSCORE` and
references a standard template: `match_correct` for dichotomous scoring, and `map_response` with a
`mapping` for partial credit. Partial credit follows PIE, where it is on unless the model sets
`partialScoring: false`.

A QTI mapping cannot express each element's penalty rule, so partial credit maps each correct value
to 1/n and any other value to -1/n, bounded to [0, 1]. A deliberate trade: any QTI engine can score
the item, at the cost of differing from PIE on some over-selections. Multiple choice, EBSR and inline
dropdown get explicit response processing implementing their PIE rule exactly. Extended response and
`customInteraction` declare the outcomes and leave `SCORE` to external scoring.

### E3: Schema Structure

Against the QTI 2.2 XSD, the probed exports fail in three places. `prompt` is emitted as a direct
child of `itemBody`, where the schema expects it as the interaction's first child.
`pie:sourceModel` is emitted as a child of `assessmentItem`, whose content model is a fixed sequence
with no extension slot. `addSearchMetadata` inserts a QTI 3.0 `qti-metadata` element at the start of
`assessmentItem` whenever the item has a `baseId` or search metadata, which fails for the same
reason.

Generators place `prompt` inside the interaction; 11 generators emitted it in the wrong place.
`sourceModel` and the search metadata move out of the item document into a sidecar JSON file
(`<item>.pie.json`) listed under the item's `<resource>` in the content package: QTI 2.2 admits no
foreign elements in `assessmentItem`, and an IMS CP resource admits any file. A bare item transform
returns the sidecar on the output item, and to-pie reads it from the package next to the item. Moving
to the sidecar also removes the CDATA wrapper, which closes E4. The standalone passage file carried
the same invalid `qti-metadata` and drops it too.

`baseId` and `searchMetaData` also travel as IEEE LOM on the item's manifest resource, so a QTI
consumer that ignores the sidecar keeps both: `baseId` as a `general/identifier` in catalog
`pie:baseId`, and each `searchMetaData` key as a `classification`. to-pie reads them back when no fresh
sidecar is present. The manifest's `imsmd` prefix moves to the IEEE LOM namespace the QTI 2.2 packaging
profile admits; resource metadata keys other than title, description and language were invalid there
and are no longer written.

The gate exposed further schema and scoring defects, fixed with E3:

- `generateIdentifier` replaced a leading digit with `_`, so PIE choice ids `'0'` and `'1'` both
  became `_` and collided; choice identifiers are now prefixed.
- Explicit constructed response declared every accepted answer as a correct value under `single`
  cardinality; it now declares one and scores the alternatives through a case-sensitive mapping, and
  places the prompt before the inline `textEntryInteraction`, which takes none.
- Hotspot chose `single` cardinality for a multiple-correct model with one correct shape; select-text
  derived cardinality from the correct-token count instead of `maxSelections`.

### E4: CDATA Termination

`embedPieExtension` writes the model JSON inside `<![CDATA[…]]>` without escaping, so a `]]>`
anywhere in model content ends the section and the output is no longer well-formed. E3's sidecar
removes the CDATA. If E3 is deferred, splitting the sequence as `]]]]><![CDATA[>` is the interim fix.

### E5: Multiple Interactions

`transform` exports `interactions[0]` and logs a warning. Later interactions survive only inside
`sourceModel`, so a QTI consumer sees part of the item. Each generator gains a fragment mode that
returns body markup and declarations under an item-unique response identifier (`RESPONSE1`,
`RESPONSE2`, …). The plugin composes the fragments into one `itemBody`. Standard templates score a
single `RESPONSE`, so a multi-interaction item gets explicit response processing that sums the
per-response scores into `SCORE`.

### E6: Rubrics

Rubric models in a multi-model item are left out of the exported body, and the plugin logs that
rubrics are not yet implemented. `RubricGenerator` exists but writes only a standalone rubric item.
Rubric content is emitted as a `rubricBlock` with `view="scorer"` at the end of the interaction
item's `itemBody`, which is the form to-pie's package transformer collects as a rubric candidate:
score-point tables for `rubric` and `multi-trait-rubric`, and maximum points with the instruction for
a rubricless `complex-rubric`. The rubric's highest score sets the extended response's `MAXSCORE`.
`RubricGenerator`, for a rubric exported alone, placed its block outside `itemBody` and now writes an
item with no interaction holding the block.

### E8: Authored HTML

Generators insert PIE HTML into the XML document unchanged. Named entities such as `&nbsp;` make the
export not well-formed, an unclosed `<br>` swallows the content after it, and `<img>` without `alt`
and `<u>` fail the XSD. Of 1,829 model prompts in the first 2,000 production items updated on
2026-09-01, 70 contain `&nbsp;` (and 70 another named entity), 139 a `<br>` and 299 an `<img>`
without `alt`. Each count stands alone, since overlap was not measured; choices, markup, rationales
and passages were not counted.

Every item body and passage is re-serialized as XML before it is written: entities are decoded and
text re-escaped, childless elements are self-closed, all-uppercase tags are lowercased, `img` gains
`alt=""`, and `u`, `s` and `strike` become spans with `text-decoration`. The pass is idempotent and
also runs after composition, passage and rubric insertion.

---

## Embedded-Source Freshness (I2, E7)

Each direction embeds the opposite format's source for lossless round-trips and prefers it on the
way back, with no check that it still matches the content beside it.

- **E7.** to-pie stores the original QTI in `metadata.qtiSource` on every item. pie-to-qti2 checks
  for it first and returns it verbatim. Any PIE-side edit is discarded, and the output is labelled
  `qti22` while it keeps the source's namespace (QTI 2.1 in the probe).
- **I2.** pie-to-qti2 stores the PIE model as `pie:sourceModel`, and to-pie checks for it first. An
  exported item edited in a QTI tool re-imports as the pre-edit PIE model.

Each embedded payload carries a digest of the content generated alongside it and is used only while
that digest matches. pie-to-qti2 records `qtiDigest`, the SHA-256 of the whole QTI document text with
line endings normalized, in the sidecar. to-pie records `configDigest`, the SHA-256 of the final PIE
`config` as JSON with keys sorted, in `metadata.qtiSource`, after its decorators run. On a mismatch
the reader transforms the visible content: to-pie warns `PIE_SOURCE_STALE` and records a `fallback`
trace event, pie-to-qti2 adds a warning. On a match, pie-to-qti2 labels the output with the source's
detected version (`qti21` for a QTI 2.1 source).

A payload without a digest counts as stale. That covers every `metadata.qtiSource` written by
released to-pie, which is regenerated on export, and every `pie:sourceModel` embedded by released
pie-to-qti2, which to-pie ignores with a `PIE_SOURCE_STALE` warning. A dropped edit is silent, while a lossy regeneration
reports its losses through warnings. The same reasoning accepts a byte-level digest: reformatting by
a QTI editor marks the source stale, which costs fidelity and never correctness. The step runs after
E1 through E3, because the fallback path has to produce correct QTI before the pass-through can
defer to it.

---

## Elements (pie-elements-ng)

### P1: graphing-solution-set Partial Scoring

The controller destructures `scoringType` and never reads it. It ignores `env.partialScoring` and
always scores dichotomously (`Math.floor(score / maxScore)`).

graphing-solution-set scores partially only on an explicit opt-in: the model's `scoringType` is
`'partial scoring'` or `env.partialScoring` is `true`. Either side saying dichotomous wins. The
sibling `graphing` controller's resolution is the alternative, and it would change production
scores: `partialScoring.enabled` returns true unless the model or `env` says false, and hosts on
pie-item-player leave `env.partialScoring` unset, so every graphing-solution-set item without a
`scoringType` would switch to partial scoring there.

Exposure is latent. Production holds 675 graphing-solution-set items, and kc, ar and star hold none.
`scoringType` is absent from all 100 production models sampled, and the author control is off by
default (`scoringType.settings: false`). The fix therefore changes a score only where a host sends
`env.partialScoring: true`.

### P2: likert Completeness

Fixed on `fix/likert-is-complete`, not yet merged. `isComplete` read an array length, while the
response is the selected choice's number.

---

## Sequencing

1. D1, D2: now, as text changes. Merged in #269.
2. I1, I3, I4, I5: small and independent. Merged in #269.
3. P1: independent, in pie-elements-ng; P2 merges with it or separately. Done, unmerged.
4. Validation gate, then E1, E3 (closing E4), E2, E5, E6 and E8: before pie-to-qti2's first
   consumer. Merged in #269.
5. Embedded-source freshness (I2, E7): after step 4. Merged in #269.
