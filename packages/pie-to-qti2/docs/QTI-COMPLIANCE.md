# QTI Compliance Documentation

## Overview

`@pie-qti/pie-to-qti2` generates QTI 2.2.2 items that validate against the official XSD, and QTI 3.0
items with `targetVersion: '3.0'` (see [QTI 3.0](#qti-30)). The PIE item
each QTI item came from travels beside it in a sidecar file, so the item document carries no vendor
elements. This document covers the conformance gate, scoring, content normalization and the round-trip
mechanism.

## Conformance Status

Every generator's output, composed multi-interaction items, inline passages, rubrics and standalone
passage files pass `validateQti(xml, { xsdSeverity: 'error' })` in
[`schema-gate.test.ts`](../tests/integration/schema-gate.test.ts). The gate runs with the package
tests, and an export that fails it is a defect.

Known approximations, each valid QTI:

- **Partial-credit mapping.** QTI's `mapping` cannot express each PIE element's penalty rule, so
  partial credit maps each correct value to 1/n and any other value to -1/n, bounded to [0, 1]. Scores
  can differ from PIE on some over-selections. Multiple choice, EBSR and inline dropdown are scored by
  their PIE rule exactly.
- **Externally scored elements.** Extended response, `customInteraction` and rubric-scored items
  declare `SCORE` and `MAXSCORE` and leave `SCORE` to a human scorer or the PIE runtime.
- **Metadata.** `baseId` and `searchMetaData` travel in the sidecar and, for a QTI consumer that
  ignores it, as IEEE LOM on the item's `<resource>` in the package manifest (see
  [Manifest Generation](./MANIFEST-GENERATION.md#resource-metadata)). A bare item transform has no
  manifest, so only the sidecar carries them.

## QTI 3.0

`new PieToQtiPlugin({ targetVersion: '3.0' })` writes QTI 3.0. The generators write QTI 2.2 and
`convertQti2ToQti3` from `@pie-qti/qti-common` renames the finished document: the `imsqtiasi_v3p0`
namespace and ASI schema location, `qti-` kebab-case element names, kebab-case attributes and the
3.0 response-processing template URIs. HTML, MathML and SVG keep their names. Three structures
differ from the QTI 2.2 export:

- **Passages.** An external passage is a `qti-assessment-stimulus` file under `passages/`, and the
  item references it with `qti-assessment-stimulus-ref`, carrying the PIE passage id as
  `data-pie-passage-id`.
- **Rubrics.** Rubric block content sits in `qti-content-body`, and `use` is `scoring` for a scorer
  view, else `instructions`.
- **Catalogs.** Item and passage catalogs are written natively as `qti-catalog-info`, one `qti-card`
  per card, so none of the APIP losses apply. QTI 3.0 types `data-catalog-idref` as an IDREF, so an
  idref no exported catalog declares is dropped and named in a warning. Assessment catalogs keep
  their warning.

Packages use the QTI 3 content packaging profile with resource types `imsqti_item_xmlv3p0`,
`imsqti_stimulus_xmlv3p0` and `imsqti_test_xmlv3p0`. The plugin reports `qti30`. An embedded QTI
source is re-emitted only to a target of its version family; otherwise the item is generated and a
warning says so.

[`schema-gate-qti3.test.ts`](../tests/integration/schema-gate-qti3.test.ts) validates every
generator's QTI 3.0 output, stimuli, tests and manifests against the 1EdTech schemas vendored in
`@pie-qti/qti-common`, requires to-pie to import each item as it imports the QTI 2.2 twin, and scores
through the item player.

## Item Structure

```xml
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="item-id" title="..." adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="..." baseType="...">
    <correctResponse>...</correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">...</outcomeDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">...</outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>...</prompt>
      ...
    </choiceInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>
```

`prompt` is the interaction's first child. Generators are looked up by the model's package, resolved
through `config.elements`, so tag-named models (`pie-multiple-choice`) reach their native generator;
only elements with no generator become `customInteraction`.

## Scoring

Every item declares `SCORE` and `MAXSCORE`. Partial credit follows PIE: it is on unless the model sets
`partialScoring: false`.

| Case | Response processing |
|------|---------------------|
| One response, one correct value, or partial credit off | `match_correct` template |
| One response, several correct values, partial credit on | `map_response` template with a `mapping` |
| Multiple choice, EBSR, inline dropdown | Explicit processing implementing the PIE rule |
| Several interactions in one item | Each part scores into `SCORE_<n>`; `SCORE` is their sum |
| Extended response, custom interaction | None; `MAXSCORE` only |

In a composed item, response declarations are renamed per part (`RESPONSE1`, `RESPONSE2`, …) and every
identifier a part's body declares is prefixed with `P<n>_`, since QTI requires choice identifiers to be
unique within the item.

## Content Normalization

PIE content is HTML; an item body is XML in the QTI namespace. Every item body and passage is
re-serialized as XML before it is written:

- Entities are decoded and text re-escaped, so `&nbsp;` and `&mdash;` become characters.
- Childless elements are self-closed, so `<br>` no longer swallows the content after it.
- All-uppercase tags are lowercased.
- `img` gains the `alt=""` the schema requires.
- `u`, `s` and `strike`, absent from QTI's XHTML profile, become spans with `text-decoration`.

`data-*`, `role`, `aria-*`, `class` and `style` attributes and MathML pass through unchanged.

## Passages

An inline passage is a `div` in the item body:

```xml
<itemBody>
  <div class="stimulus" data-pie-passage-id="passage-1">
    <h2>Photosynthesis</h2>
    <p>Plants convert sunlight into energy through photosynthesis.</p>
  </div>
  <choiceInteraction responseIdentifier="RESPONSE">
    <prompt>Based on the passage, what do plants produce?</prompt>
    ...
  </choiceInteraction>
</itemBody>
```

An external passage is a standalone `assessmentItem` with no interaction, identified by the passage's
`baseId` when it has one, and referenced from the item with `<object>`.

## Rubrics

Rubric models (`rubric`, `multi-trait-rubric`, `complex-rubric`) become a `<rubricBlock view="scorer">`
at the end of the interaction item's body: a table of score points for a simple rubric, one table per
scale for a multi-trait rubric, and the maximum points with any instruction for a rubricless one. The
rubric's highest score sets the item's `MAXSCORE`. A rubric exported on its own becomes an item with no
interaction holding the block.

## Round-Trip Sidecar

The PIE item is written beside the QTI item as `<item>.pie.json` and listed as a `<file>` under the
item's `<resource>` in the content package. A bare item transform returns it as the output item's
`sidecar`. The contract is `PieSourceSidecar` in `@pie-qti/transform-types`:

```json
{
  "format": "pie-qti/pie-source",
  "version": 1,
  "qtiDigest": "sha256:…",
  "sourceModel": { "id": "item-123", "baseId": "…", "searchMetaData": { … }, "config": { … } },
  "generator": { "package": "@pie-qti/pie-to-qti2", "version": "…" },
  "elementType": "@pie-element/multiple-choice",
  "generatedAt": "2026-10-09T12:00:00.000Z"
}
```

`@pie-qti/to-pie` uses the sidecar only while the QTI item still has the recorded `qtiDigest`: an item
edited after export is transformed from its QTI with a `PIE_SOURCE_STALE` warning. A QTI item imported
by to-pie and exported unchanged is written back as the original document, in its original QTI version;
once its PIE config changes, the QTI is generated from the config.

Releases before the sidecar embedded the PIE item as `<pie:sourceModel>` inside `assessmentItem`.
to-pie no longer reads it, since it carries no digest, and warns `PIE_SOURCE_STALE`.

## Validation

```bash
xmllint --schema /path/to/imsqti_v2p2p2.xsd generated-item.xml
```

`validateQti` from `@pie-qti/to-pie` runs the same check without a local schema copy.

## Interoperability

- **QTI 2.2 players and LMS imports** load, render and score generated items, within the scoring
  approximations above.
- **QTI 3.0 players** receive the same items and scoring in the QTI 3.0 vocabulary.
- **PIE players** use the sidecar's source model.

## References

- **QTI 2.2.2 Specification:** https://www.imsglobal.org/question/qtiv2p2p2/imsqti_v2p2p2.html
- **QTI 3.0 Specification:** https://www.imsglobal.org/spec/qti/v3p0/impl
- **IMS Content Packaging 1.2:** https://www.imsglobal.org/content/packaging/
- **PIE Framework:** https://github.com/pie-framework/pie-elements
