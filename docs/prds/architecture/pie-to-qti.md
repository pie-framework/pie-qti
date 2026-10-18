# PRD: PIE to QTI 2.2 Transform

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/pie-to-qti2
  Last reviewed: 2026-10-18
-->

**Status:** draft
**Type:** architecture
**Packages:** `@pie-qti/pie-to-qti2`
**Last reviewed:** 2026-10-18

---

## Summary

`@pie-qti/pie-to-qti2` transforms PIE (Platform for Interactive Education) assessment items and assessments into QTI 2.2 XML (namespace `imsqti_v2p2`), or into QTI 3.0 (namespace `imsqtiasi_v3p0`) with `targetVersion: '3.0'`. It implements the `TransformPlugin` interface from `@pie-qti/transform-types` and integrates with the transform engine in `@pie-qti/transform-core`. The package supports the full PIE item model: single interactions, multi-model items (passage + interaction + rubric), and full `assessmentTest` documents with sections, branch rules, and scoring logic. The original PIE source travels as a digested sidecar (`<item>.pie.json`, `qtiDigest`; see `packages/pie-to-qti2/src/utils/pie-source-sidecar.ts`), enabling a lossless round-trip back to PIE via `@pie-qti/to-pie`.

---

## Background and rationale

### Why a registry rather than subclassing

PIE has 17+ element types (`@pie-element/multiple-choice`, `@pie-element/hotspot`, etc.), each mapping to a different QTI interaction element. The obvious OO pattern — a base class with one subclass per element type — would lock callers into the same class hierarchy as the library and make adding a custom element type require shipping a fork or a patch.

The `GeneratorRegistry` solves this differently: generators are value objects that satisfy the `PieToQtiGenerator` interface and are registered by element type string. The plugin calls `registry.findGenerator(model)` at transform time. Callers can `register({ generator, override: true })` to replace a built-in generator without touching anything else.

The `BaseGenerator` abstract class exists purely as a convenience (shared helpers for logging and result building). Implementing `PieToQtiGenerator` directly is equally valid.

### Why the round-trip source travels beside the QTI, not inside it

Both directions of the round-trip use the same strategy: when transforming A → B, the original A source travels alongside B so that B → A can reconstruct A exactly.

For PIE → QTI, the original PIE source is serialised as the digested sidecar `<item>.pie.json` (`qtiDigest`) written next to the QTI item and referenced from its `<resource>` (see `packages/pie-to-qti2/src/utils/pie-source-sidecar.ts`). The reverse transform (`@pie-qti/to-pie`) looks for the sidecar first; while the accompanying QTI still matches the recorded `qtiDigest`, it skips QTI parsing entirely and returns the sidecar's `sourceModel` as-is, falling back to the body when the sidecar is missing or stale.

For QTI → PIE (not this package), the QTI source XML is stored in `pieItem.metadata.qtiSource.xml`. When this package encounters a PIE item with that field, it reconstructs QTI by returning the stored XML verbatim instead of running a generator (see `reconstructFromQtiSource`).

Carrying the source beside the document rather than inside it keeps the QTI free of foreign elements — QTI 2.2 admits no extension elements in `assessmentItem`, so neither the source model nor its `baseId` and `searchMetaData` can be embedded — while the `<resource>` reference keeps the package self-describing.

### What is lossy

When a PIE item is transformed without a prior QTI origin (i.e., no `metadata.qtiSource.xml`), the generator produces QTI from the PIE model. PIE features that have no QTI equivalent are preserved with `data-pie-*` attributes on the interaction element (e.g., `data-pie-feedback`, `data-pie-ui-settings`). These survive the round-trip because they live in the sidecar's `sourceModel`, not because QTI can represent them natively.

What is truly lossy is the QTI itself after a fresh PIE → QTI transformation: the generated QTI reflects the generator's mapping choices, not any original QTI. If a QTI consumer drops the `<item>.pie.json` sidecar (as a security or compliance measure), the PIE source is gone.

Lossy information examples:
- PIE rubric models: transformed to scorer-view QTI `<rubricBlock>` elements (`packages/pie-to-qti2/src/utils/rubric-block.ts`, `generators/rubric.ts`) — the former "detected and logged only" gap is closed
- Multi-interaction items: only the first interaction in `config.models[]` is mapped to QTI; additional interactions produce a warning
- Complex PIE-specific scoring logic not expressible in standard QTI response processing
- Accessibility catalogs (`accessibilityCatalogs` on a model, the item root, a passage or an assessment, and `extractedCatalogs`): an item's or passage's catalogs are written as `apip:apipAccessibility`, each access element linked to the elements whose `data-catalog-idref` names it; an element without an `id` gets one, and the idrefs stay in the markup, since QTI 2.2 admits `data-*`. A warning names what APIP cannot carry: supports APIP has no element for (`glossary-on-screen`, among others), catalogs no exported element refers to, idrefs no exported catalog declares, and a second declaration of one identifier. Assessments carry no APIP, so each assessment catalog is named in a warning. A QTI 3.0 export writes item and passage catalogs natively as `qti-catalog-info`; because QTI 3.0 types `data-catalog-idref` as an IDREF, an idref no exported catalog declares is dropped from the markup and named in the warning

---

## QTI specification alignment

- **Spec version(s):** QTI 2.2.2; QTI 3.0 with `targetVersion: '3.0'`
- **Spec section(s):** §4 assessmentItem, §6 assessmentTest, §8 IMS Content Packaging
- **Supported output elements:** `<assessmentItem>`, `<assessmentTest>`, `<testPart>`, `<assessmentSection>`, `<assessmentItemRef>`, `<choiceInteraction>`, `<extendedTextInteraction>`, `<textEntryInteraction>`, `<inlineChoiceInteraction>`, `<orderInteraction>`, `<matchInteraction>`, `<hotspotInteraction>`, `<hottextInteraction>`, `<gapMatchInteraction>`, `<graphicGapMatchInteraction>`, `<associateInteraction>`, `<customInteraction>`, `<outcomeProcessing>`, `<branchRule>`, `<preCondition>`, `<timeLimits>`, `<weight>`
- **Deliberately omitted:** `<organizations>` in IMS manifest (not used for QTI item packages). Formerly omitted, now implemented: `<rubricBlock>` generation (`utils/rubric-block.ts`, `generators/rubric.ts`) and multiple interactions per item body (`utils/item-composer.ts`)
- **Known divergences:** former only — the export once embedded `<pie:sourceModel>` and `<pie:metadata>` under a vendor namespace (`xmlns:pie="https://github.com/pie-framework/pie-elements"`), a valid QTI extension mechanism that failed validation against schemas that do not allow extension elements. The PIE source now travels in the `<item>.pie.json` sidecar, so a fresh export declares no vendor namespace.

---

## Functional requirements

- **FR-1:** Given a PIE item with `config.models[]`, the plugin SHALL produce a valid QTI 2.2 `<assessmentItem>` with the correct interaction element for the primary model's element type.
- **FR-2:** The plugin SHALL write the original PIE item JSON as a `<item>.pie.json` source sidecar (`PieSourceSidecar`, `format: 'pie-qti/pie-source'`) recording the `qtiDigest` of the generated QTI document, return it on `output.items[].sidecar`, and list it under the item's `<resource>` when generating a package. The reverse transform SHALL use the sidecar for a lossless round-trip only while the QTI item is unchanged — its digest still matches `qtiDigest`.
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
- **FR-14:** A generated export of an item, a resolved passage or an assessment that carries accessibility catalogs SHALL add one warning per exported object to `output.metadata.warnings`, naming every catalog it declares or its markup references through `data-catalog-idref`. Lossless reconstruction from `metadata.qtiSource.xml` adds none.

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

### Lossless path via the PIE source sidecar

**Decision:** The full PIE item is serialised into a sidecar file, `<item>.pie.json` (`PieSourceSidecar`, `format: 'pie-qti/pie-source'`), written beside the QTI item and referenced from the item's `<resource>` in a content package. The sidecar records the `qtiDigest` of the generated QTI document.
**Rationale:** QTI 2.2 admits no foreign elements in `assessmentItem`, so the document cannot carry the source model, its `baseId`, or its `searchMetaData` without breaking schema validation. A digested sidecar keeps the XML clean and lets the reverse transform trust it only while the document is unchanged — `qtiDigest` still matches — falling back to the body when the sidecar is missing or stale.
**Alternatives considered:** embedding the JSON as `<pie:sourceModel>` CDATA inside the QTI root (the original design; rejected because schemas that disallow extension elements fail the document); base64-encoded attribute; JSON stored as escaped XML attribute text.
**Consequences:** The transform output is a file pair (item XML plus sidecar) rather than a single file; `TransformOutput.items[].sidecar` carries the sidecar for callers that do not build a package. A consumer that drops the sidecar loses the lossless round-trip but keeps valid, renderable QTI.

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
- `generate(context)` returns `GeneratorResult` synchronously or as a `Promise`. The `qti` field must be a complete, valid `<assessmentItem>` XML string. PIE source sidecar emission is handled by `PieToQtiPlugin` after the generator returns; generators must not embed the PIE source themselves.

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
        AND output.items[0].sidecar is a 'pie-qti/pie-source' sidecar whose sourceModel equals the
        original PIE item and whose qtiDigest matches the generated QTI document
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

AC-E3a: Accessibility catalogs written as APIP
  Given: A PIE item whose multiple-choice model declares a spoken catalog 'term-water' and whose
         prompt holds <span data-catalog-idref="term-water">
  When: transform() is called
  Then: the QTI output ends with apip:apipAccessibility holding access element 'term-water',
        linked by contentLinkInfo to the span, which gains id="apip-target-1"
        AND the output validates against the QTI 2.2 schema with its APIP extension
        AND output.metadata.warnings names no catalog

AC-E3b: Catalogs APIP cannot carry reported
  Given: The item of AC-E3a, whose 'term-water' catalog also holds a glossary-on-screen card
  When: transform() is called
  Then: output.metadata.warnings contains 'Item "<id>" carries accessibility catalogs the QTI 2.2
        export does not write in full: "term-water" (glossary-on-screen)'

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

- [x] Rubric generation: `@pie-element/rubric` and `@pie-element/complex-rubric` are detected and logged but not yet transformed to `<rubricBlock>`. What is the target QTI structure?
  Resolved: rubric models transform to scorer-view `<rubricBlock>` blocks at the end of the item body (`packages/pie-to-qti2/src/utils/rubric-block.ts`, `generators/rubric.ts`).
- [x] Multiple interactions per item body: the spec allows multiple interactions in one `<assessmentItem>`. The current single-primary-model approach is a known Phase 1 limitation. When is this needed, and what is the target architecture?
  Resolved: every interaction model is generated as its own item and the parts are composed into one item with prefixed identifiers and summed scores (`packages/pie-to-qti2/src/utils/item-composer.ts`).
- [x] QTI 3.0 output: a flag. `targetVersion: '2.2' | '3.0'` on this plugin, defaulting to `'2.2'`, since both versions share every generator. A QTI 3.0 export renames the finished QTI 2.2 document into the `imsqtiasi_v3p0` vocabulary, writes external passages as `qti-assessment-stimulus` files referenced by `qti-assessment-stimulus-ref`, wraps rubric content in `qti-content-body`, writes catalogs as `qti-catalog-info`, and packages under the QTI 3 content packaging profile.

---

## Related

- QTI spec: IMS QTI 2.2.2, §4 assessmentItem; §6 assessmentTest; §8 IMS Content Packaging
- Implementation: `packages/pie-to-qti2/src/`
- Adjacent PRDs: `architecture/qti-to-pie.md`, `architecture/transform-engine.md`, `architecture/ims-content-packages.md`
- Existing docs: `packages/pie-to-qti2/README.md`, `packages/pie-to-qti2/docs/CUSTOM-GENERATORS.md`, `packages/pie-to-qti2/docs/ASSESSMENT-TRANSFORMATIONS.md`, `packages/pie-to-qti2/docs/EXTERNAL-PASSAGES.md`, `packages/pie-to-qti2/docs/MANIFEST-GENERATION.md`, `packages/pie-to-qti2/docs/PASSAGE-DEDUPLICATION.md`
