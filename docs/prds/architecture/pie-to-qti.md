# PRD: PIE to QTI 2.2 Transform

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/pie-to-qti2
  Last reviewed: 2026-04-27
-->

**Status:** draft
**Type:** architecture
**Packages:** `@pie-qti/pie-to-qti2`
**Last reviewed:** 2026-04-27

---

## Summary

`@pie-qti/pie-to-qti2` transforms PIE (Platform for Interactive Education) assessment items and assessments into QTI 2.2 XML. It implements the `TransformPlugin` interface from `@pie-qti/transform-types` and integrates with the transform engine in `@pie-qti/core`. The package supports the full PIE item model: single interactions, multi-model items (passage + interaction + rubric), and full `assessmentTest` documents with sections, branch rules, and scoring logic. Every forward transformation embeds the original PIE source in a `<pie:sourceModel>` extension, enabling a lossless round-trip back to PIE via `@pie-qti/to-pie`.

---

## Background and rationale

### Why a registry rather than subclassing

PIE has 17+ element types (`@pie-element/multiple-choice`, `@pie-element/hotspot`, etc.), each mapping to a different QTI interaction element. The obvious OO pattern — a base class with one subclass per element type — would lock callers into the same class hierarchy as the library and make adding a custom element type require shipping a fork or a patch.

The `GeneratorRegistry` solves this differently: generators are value objects that satisfy the `PieToQtiGenerator` interface and are registered by element type string. The plugin calls `registry.findGenerator(model)` at transform time. Callers can `register({ generator, override: true })` to replace a built-in generator without touching anything else.

The `BaseGenerator` abstract class exists purely as a convenience (shared helpers for logging and result building). Implementing `PieToQtiGenerator` directly is equally valid.

### Why lossless round-trip embeds source XML in the PIE side, not in QTI

Both directions of the round-trip use the same strategy: when transforming A → B, embed the full original A source in B so that B → A can reconstruct A exactly.

For PIE → QTI, the full PIE item JSON is serialised as a CDATA block in `<pie:sourceModel>` at the bottom of the `<assessmentItem>`. The reverse transform (`@pie-qti/to-pie`) reads `pie:sourceModel` first; if found, it skips QTI parsing entirely and returns the embedded JSON as-is.

For QTI → PIE (not this package), the QTI source XML is stored in `pieItem.metadata.qtiSource.xml`. When this package encounters a PIE item with that field, it reconstructs QTI by returning the stored XML verbatim instead of running a generator (see `reconstructFromQtiSource`).

Embedding in the destination rather than keeping a side-channel reference avoids the need to manage external state or a separate storage layer during round-trips.

### What is lossy

When a PIE item is transformed without a prior QTI origin (i.e., no `metadata.qtiSource.xml`), the generator produces QTI from the PIE model. PIE features that have no QTI equivalent are preserved with `data-pie-*` attributes on the interaction element (e.g., `data-pie-feedback`, `data-pie-ui-settings`). These survive the round-trip because they live in the embedded `pie:sourceModel`, not because QTI can represent them natively.

What is truly lossy is the QTI itself after a fresh PIE → QTI transformation: the generated QTI reflects the generator's mapping choices, not any original QTI. If a QTI consumer strips `<pie:sourceModel>` (as a security or compliance measure), the PIE source is gone.

Lossy information examples:
- PIE rubric models: detected and logged, but QTI `<rubricBlock>` generation is not yet implemented
- Multi-interaction items: only the first interaction in `config.models[]` is mapped to QTI; additional interactions produce a warning
- Complex PIE-specific scoring logic not expressible in standard QTI response processing

---

## QTI specification alignment

- **Spec version(s):** QTI 2.2.2
- **Spec section(s):** §4 assessmentItem, §6 assessmentTest, §8 IMS Content Packaging
- **Supported output elements:** `<assessmentItem>`, `<assessmentTest>`, `<testPart>`, `<assessmentSection>`, `<assessmentItemRef>`, `<choiceInteraction>`, `<extendedTextInteraction>`, `<textEntryInteraction>`, `<inlineChoiceInteraction>`, `<orderInteraction>`, `<matchInteraction>`, `<hotspotInteraction>`, `<hottextInteraction>`, `<gapMatchInteraction>`, `<graphicGapMatchInteraction>`, `<associateInteraction>`, `<customInteraction>`, `<outcomeProcessing>`, `<branchRule>`, `<preCondition>`, `<timeLimits>`, `<weight>`
- **Deliberately omitted:** `<rubricBlock>` (known gap; see open questions), multiple interactions per item body (phase 2 work), `<organizations>` in IMS manifest (not used for QTI item packages)
- **Known divergences:** `<pie:sourceModel>` and `<pie:metadata>` use a vendor namespace (`xmlns:pie="https://github.com/pie-framework/pie-elements"`). This is a valid QTI extension mechanism but will cause validation failures against schemas that do not allow extension elements.

---

## Functional requirements

- **FR-1:** Given a PIE item with `config.models[]`, the plugin SHALL produce a valid QTI 2.2 `<assessmentItem>` with the correct interaction element for the primary model's element type.
- **FR-2:** The output item SHALL contain a `<pie:sourceModel>` CDATA block containing the full original PIE item JSON.
- **FR-3:** Given a PIE item with `metadata.qtiSource.xml` set, the plugin SHALL return that embedded XML as-is without invoking any generator (lossless reconstruction).
- **FR-4:** Given a PIE item with `@pie-element/passage` models in `config.models[]`, the plugin SHALL embed passage HTML inside `<itemBody>` as `<div class="stimulus">` before the interaction element (inline strategy).
- **FR-5:** Given a PIE item with a `passage` string property and a configured `passageResolver`, the plugin SHALL call the resolver, generate a separate passage file, and reference it in the item XML via `<object data="passages/...">` (external strategy).
- **FR-6:** When `generatePackage: true` is set, the plugin SHALL produce an IMS CP v1.1 `imsmanifest.xml` declaring all items, passages, and their dependencies in dependency order (passages first, then items, then assessments).
- **FR-7:** A `GeneratorRegistry` SHALL allow a caller to register a custom generator with `override: true` to replace any built-in generator for a given element type.
- **FR-8:** A registered wildcard generator SHALL be tried as a last resort when no typed generator matches.
- **FR-9:** PIE `searchMetaData` fields SHALL be serialised as `<qti-metadata-field>` elements inside a `<qti-metadata>` block in the item XML.
- **FR-10:** PIE `baseId` SHALL be preserved as `externalId` metadata and `sourceSystemId="pie"` in the QTI item, enabling the reverse transform to restore the original identifier.
- **FR-11:** A PIE object with a top-level `sections` array SHALL be treated as an assessment and transformed to `<assessmentTest>` rather than `<assessmentItem>`.
- **FR-12:** `outcomeProcessingXml`, `branchRule`, and `preCondition` on assessment items SHALL be inserted verbatim into the generated QTI without re-parsing or re-serialisation.
- **FR-13:** `deduplicatePassageFiles` SHALL return each passage only once when called on results from batch item transformations sharing the same passage ID.

---

## Non-functional requirements

- **Performance:** Single-item transformation should complete in under 100 ms for typical K-12 items (< 50 KB PIE JSON). Batch transformations should be parallelisable by callers.
- **Security:** The plugin does not sanitise HTML content from PIE models. Callers are responsible for sanitising any HTML before embedding in QTI destined for browser rendering.
- **Cross-platform:** Runs in Node.js (server-side batch conversion and CLI). Not intended for direct browser execution.
- **i18n:** No user-facing strings in the transform output. Generator warnings are in English; this is acceptable for a developer-facing package.
- **Accessibility:** Not applicable (server-side transform, no UI).

---

## Design decisions

### Composition via registry, not inheritance

**Decision:** `GeneratorRegistry` stores generators by element-type string; `PieToQtiPlugin` delegates to the registry at runtime.
**Rationale:** Callers can add or replace generators without subclassing the plugin. The built-in generators auto-register by importing `./generators/index.js`, which is a side-effectful import. A custom registry can be passed to `PieToQtiPlugin({ registry })` to start from scratch or to isolate test scenarios.
**Alternatives considered:** Plugin inheritance (one subclass per element type); method overrides on a single class. Both bind callers to the library's internal structure.
**Consequences:** Generator resolution order is: exact element-type match → priority-sorted scan of all generators → wildcard generators. Priority ties within the sorted scan are resolved by insertion order (Map iteration order in V8).

### Lossless path via embedded CDATA

**Decision:** The full PIE JSON is embedded as `<pie:sourceModel><![CDATA[...]]></pie:sourceModel>` inside the QTI root element.
**Rationale:** A CDATA section survives all standard XML serialisers and parsers without escaping concerns. Storing the JSON as a side-channel file (e.g., `item.json` alongside `item.xml`) would require callers to manage file pairs, breaking the "one file = one item" assumption of QTI packages.
**Alternatives considered:** Separate sidecar file; base64-encoded attribute; JSON stored as escaped XML attribute text.
**Consequences:** The QTI file grows by the size of the PIE JSON. A typical PIE item adds 2–20 KB. The `<pie:sourceModel>` element is placed at the end of the document so it does not interfere with QTI parsers that stop after `</itemBody>`.

### outcomeProcessingXml stored as raw string

**Decision:** Assessment-level outcome processing, branch rules, and preconditions are stored in PIE as raw QTI XML strings (e.g., `outcomeProcessingXml`, `branchRule[].xml`) and inserted verbatim.
**Rationale:** Modelling QTI's expression language as a PIE object graph would require maintaining a parallel AST that diverges from the spec every time QTI adds operators. Storing the QTI XML directly makes the round-trip trivially lossless for these constructs and keeps PIE's schema stable.
**Alternatives considered:** PIE-native scoring DSL; structured outcome processing model.
**Consequences:** Callers who write assessment branch rules must know QTI XML syntax. Validation is deferred to the QTI consumer.

### Auto-registration side effect on import

**Decision:** `packages/pie-to-qti2/src/generators/index.ts` calls `registerBuiltInGenerators()` at module load time as a side effect.
**Rationale:** The `defaultRegistry` singleton is module-scoped. Importing the index registers all built-ins automatically, so callers using the default registry do not need an explicit setup call. The `plugin.ts` imports `./generators/index.js` to trigger this.
**Alternatives considered:** Explicit `registerBuiltInGenerators()` call required from callers.
**Consequences:** Tests that want an empty registry must pass `new GeneratorRegistry()` explicitly rather than the exported `defaultRegistry`.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| Custom element generator | `PieToQtiGenerator` | Implement the interface, call `plugin.registerGenerator(gen, priority, override)` or `registry.register({generator, override: true})` | Replace the built-in multiple-choice generator with one that uses `<qti3:choiceInteraction>` |
| Wildcard fallback generator | `PieToQtiGenerator` | Call `registry.registerWildcard(gen, priority)` | Catch-all for proprietary element types not in the built-in set |
| Custom registry | `GeneratorRegistry` | Pass `registry` option to `PieToQtiPlugin` constructor | Isolated test environment; pre-loaded registry for a deployment |
| Passage resolver | `PassageResolver = (id: string) => Promise<ResolvedPassage>` | Pass `passageResolver` option to `PieToQtiPlugin` | Load passage content from a database or CMS at transform time |
| Passage strategy override | `'inline' \| 'external'` | Pass `passageStrategy` option | Force external strategy even when PIE item uses inline model |
| Package generation | `generatePackage: boolean` | Pass `generatePackage: true` option | Enable `imsmanifest.xml` generation in transform output |

---

## Data model / contracts

### `PieToQtiGenerator` interface

Defined in `src/generators/types.ts`. Key invariants:

- `id` must match the PIE element type string (e.g., `'@pie-element/multiple-choice'`). The registry uses this as the map key.
- `canHandle(model)` is called by the registry even after an exact key match, so it must return `true` for the model it is keyed to. A generator may return `false` to yield to lower-priority generators.
- `generate(context)` returns `GeneratorResult` synchronously or as a `Promise`. The `qti` field must be a complete, valid `<assessmentItem>` XML string. PIE extension embedding (`<pie:sourceModel>`) is added by `PieToQtiPlugin` after the generator returns; generators must not add it themselves.

### `TransformOutput` shape (extended)

Standard fields: `items[].content` (QTI XML string), `format: 'qti22'`, `metadata`.

Extended fields added by this plugin (not in the `TransformOutput` type; cast via `as any` at call sites):

- `output.passageFiles`: `GeneratedPassageFile[]` — present when external passage strategy produced files
- `output.manifest`: `string` — IMS CP manifest XML, present when `generatePackage: true`

### `GeneratorContext` multi-model fields

Beyond the base `{ pieItem, model, logger }`, the plugin passes:

- `allModels`: all models in `config.models[]`
- `passages`: models filtered to `@pie-element/passage`
- `rubrics`: models filtered to `@pie-element/rubric` and `@pie-element/complex-rubric`
- `interactions`: remaining models (the primary interaction pool)

Generators receive these for context but are only responsible for their own model.

### IMS manifest resource ordering

Passages are declared before items; items before assessments. This is a hard requirement of the IMS CP dependency model: a resource must be declared before any resource that depends on it.

---

## Acceptance criteria

### Functional

```
AC-1: Basic item transformation
  Given: A PIE item with a single @pie-element/multiple-choice model with two choices
  When: PieToQtiPlugin.transform() is called
  Then: output.items[0].content is a string starting with <?xml and containing <choiceInteraction>
        AND output.items[0].content contains <pie:sourceModel> with the original PIE JSON
        AND output.metadata.generatorId equals '@pie-element/multiple-choice'

AC-2: Lossless reconstruction from embedded QTI source
  Given: A PIE item where metadata.qtiSource.xml is set to a known QTI XML string
  When: PieToQtiPlugin.transform() is called
  Then: output.items[0].content equals the value of metadata.qtiSource.xml exactly
        AND output.metadata.losslessReconstruction === true
        AND no generator is invoked

AC-3: Custom generator override
  Given: A GeneratorRegistry with a custom generator registered for '@pie-element/multiple-choice' with override: true
         AND the custom generator produces '<assessmentItem id="custom"/>'
         AND PieToQtiPlugin is constructed with that registry
  When: transform() is called with a multiple-choice PIE item
  Then: output.items[0].content contains '<assessmentItem id="custom"/>'
        AND the built-in MultipleChoiceGenerator is not called

AC-4: Unknown element type falls through to customInteraction wildcard
  Given: A PIE item with element type '@pie-element/unknown-proprietary'
  When: transform() is called using the default registry
  Then: output.items[0].content contains <customInteraction>
        AND no error is thrown

AC-5: External passage strategy with resolver
  Given: A PIE item with passage: 'passage-abc' (string reference)
         AND a passageResolver that returns { id: 'passage-abc', content: '<p>Text</p>' }
  When: transform() is called with passageStrategy: 'external'
  Then: output.passageFiles has length 1 with id 'passage-abc'
        AND output.items[0].content contains <object data="passages/passage-abc.xml">

AC-6: External passage without resolver throws
  Given: A PIE item with passage: 'passage-abc' (string reference)
         AND no passageResolver configured
  When: transform() is called
  Then: An error is thrown with message containing 'passageResolver'

AC-7: IMS manifest generation
  Given: A PIE item with an external passage and generatePackage: true
  When: transform() is called
  Then: output.manifest is a string containing <manifest> with xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
        AND the manifest contains a resource for the item and a resource for the passage
        AND the item resource contains a <dependency identifierref="passage-abc"/>

AC-8: PIE assessment to assessmentTest
  Given: A PIE object with a sections array containing one section and two item refs
  When: transform() is called
  Then: output.items[0].content contains <assessmentTest>
        AND the testPart contains two <assessmentItemRef> elements
        AND outcomeProcessingXml (if set on the input) appears verbatim inside <outcomeProcessing>

AC-9: searchMetaData preservation
  Given: A PIE item with searchMetaData: { subject: 'Math', gradeLevel: ['5', '6'] }
  When: transform() is called
  Then: output.items[0].content contains <qti-metadata-field name="subject" value="Math"/>
        AND <qti-metadata-field name="gradeLevel" value="5,6" data-type="array"/>

AC-10: baseId round-trip
  Given: A PIE item with baseId: 'stable-id-001'
  When: transform() is called
  Then: output.items[0].content contains <qti-metadata-field name="externalId" value="stable-id-001"/>
        AND <qti-metadata-field name="sourceSystemId" value="pie"/>

AC-11: Inline passage strategy
  Given: A PIE item with config.models containing an @pie-element/passage model followed by a choice model
  When: transform() is called (default inline strategy)
  Then: output.items[0].content contains a <div class="stimulus"> before the <choiceInteraction>
        AND both are inside <itemBody>
```

### Edge cases

```
AC-E1: Empty models array
  Given: A PIE item with config.models: []
  When: transform() is called
  Then: An error is thrown with message 'PIE item has no models'

AC-E2: All models are passages, no interaction
  Given: A PIE item with config.models containing only an @pie-element/passage model
  When: transform() is called
  Then: An error is thrown with message 'PIE item has no interaction models'

AC-E3: Multiple interactions — only first processed
  Given: A PIE item with two interaction models in config.models[]
  When: transform() is called
  Then: output.metadata.warnings contains a message about multiple interactions
        AND only the first interaction appears in the QTI output

AC-E4: Passage deduplication in batch
  Given: Three PIE items that all reference passage 'shared-passage' externally
         AND deduplicatePassageFiles() is called on the three passageFiles arrays
  Then: The result has length 1 (one unique passage file)

AC-E5: Registry throws on duplicate without override
  Given: A GeneratorRegistry where '@pie-element/multiple-choice' is already registered
  When: register() is called again for the same element type without override: true
  Then: An error is thrown with message containing 'already registered'
```

---

## Open questions

- [ ] Rubric generation: `@pie-element/rubric` and `@pie-element/complex-rubric` are detected and logged but not yet transformed to `<rubricBlock>`. What is the target QTI structure?
- [ ] Multiple interactions per item body: the spec allows multiple interactions in one `<assessmentItem>`. The current single-primary-model approach is a known Phase 1 limitation. When is this needed, and what is the target architecture?
- [ ] QTI 3.0 output: the generated namespace is `imsqti_v2p2`. Is there a requirement to produce QTI 3.0 (`imsqti_v3p0`) output, and if so, should it be a separate plugin or a flag?

---

## Related

- QTI spec: IMS QTI 2.2.2, §4 assessmentItem; §6 assessmentTest; §8 IMS Content Packaging
- Implementation: `packages/pie-to-qti2/src/`
- Adjacent PRDs: `architecture/qti-to-pie.md`, `architecture/transform-engine.md`, `architecture/ims-content-packages.md`
- Existing docs: `packages/pie-to-qti2/README.md`, `packages/pie-to-qti2/docs/CUSTOM-GENERATORS.md`, `packages/pie-to-qti2/docs/ASSESSMENT-TRANSFORMATIONS.md`, `packages/pie-to-qti2/docs/EXTERNAL-PASSAGES.md`, `packages/pie-to-qti2/docs/MANIFEST-GENERATION.md`, `packages/pie-to-qti2/docs/PASSAGE-DEDUPLICATION.md`
