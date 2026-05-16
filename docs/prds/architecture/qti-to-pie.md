# PRD: QTI → PIE Transform

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/to-pie
  Last reviewed: 2026-05-15
-->

**Status:** draft
**Type:** architecture
**Packages:** `@pie-qti/to-pie`
**Last reviewed:** 2026-05-15

---

## Summary

`@pie-qti/to-pie` contains `QtiToPiePlugin`, the standard transform plugin that converts QTI 2.2 assessment items and assessment tests into the PIE model format. The plugin implements two distinct paths: a **lossless path** for QTI that originated from PIE (detected by the presence of a `pie:sourceModel` namespace extension) and a **best-effort path** for arbitrary third-party QTI (which embeds the original QTI XML in the output for future round-trip use).

Two complementary extension surfaces sit on the best-effort path:

- The original five-hook **vendor extension** system — detectors, transformers, asset resolvers, CSS extractors, and metadata extractors — for whole-pipeline replacement and asset/CSS/metadata interception.
- The **source-profile** mechanism (`@pie-qti/source-profiles`, `QtiToPieRegistry`, item handlers, decorators, fallback diagnostics, conversion trace, package sidecars) for real-world QTI imports that are mostly standards-shaped but carry source-specific package conventions, metadata, proprietary interactions, sidecars, or repair needs. Source profiles are the preferred extension model for QTI imports; the five vendor hooks remain for the cases they were designed for. See `docs/SOURCE-PROFILES.md` for the source-profile authoring reference.

Package-level transforms (whole IMS Content Package in, PIE items + sidecars + diagnostics out) are handled by `transformQtiPackageToPie`, which composes `@pie-qti/ims-cp-core`'s package graph analysis with the plugin's item-level transform and source-profile runtime.

---

## Background and rationale

### Why the lossless check happens before any parsing

When PIE content is exported to QTI via `@pie-qti/pie-to-qti2`, the original PIE model is serialized as JSON inside a `<pie:sourceModel><![CDATA[…]]></pie:sourceModel>` element under the QTI root. If this extension is present, the QTI XML was machine-generated and the PIE model is intact — no transformation is needed or desirable. Transforming it anyway would risk losing PIE-specific fields that have no QTI equivalent.

The check (`hasPieExtension`) tests for two string markers in the raw XML before invoking the HTML parser: the `xmlns:pie` namespace declaration and the opening `<pie:sourceModel>` tag. Using raw string search before DOM parsing avoids the cost of parsing XML that will not be transformed, and it is safe because both strings together are unique enough to avoid false positives in normal QTI content.

**The lossless check must happen before format detection, vendor detection, and all other processing.** Any reordering would silently discard PIE-originated content and fall into the lossy best-effort path.

### Why original QTI XML is embedded in best-effort output

When QTI arrives from a third-party system (not from PIE), the plugin transforms it to PIE as faithfully as possible but cannot guarantee perfect round-trips. Rather than discarding the source, the plugin calls `embedQtiSourceInPie`, which stores the original XML string in `pieItem.metadata.qtiSource.xml`. This gives the PIE→QTI path (`@pie-qti/pie-to-qti2`) the option to regenerate the original QTI rather than re-synthesizing XML from the PIE model — a much higher-fidelity export path for content that will be distributed back to QTI consumers.

This is distinct from the lossless PIE extension: the PIE extension carries the original *PIE* model inside QTI XML (enabling PIE→QTI→PIE round-trips); the embedded QTI source carries the original *QTI* XML inside the PIE model (enabling QTI→PIE→QTI round-trips for third-party content).

### Why vendor hooks are on the plugin, not the engine

The `TransformEngine` is format-agnostic. It knows nothing about QTI namespaces, vendor CSS classes, or asset URL schemes. Vendor customization for QTI→PIE transformations is inherently QTI-specific knowledge, so it belongs in the QTI plugin rather than the generic engine. Placing vendor hooks on the plugin also means a vendor package can depend only on `@pie-qti/to-pie` (a focused dependency) rather than on `@pie-qti/transform-core` (the entire engine infrastructure).

An alternative considered was a global vendor registry on the engine, queryable by any plugin. This was rejected because it would create implicit coupling between plugins that share a vendor namespace, and would make it impossible to run two independent instances of the same engine with different vendor configurations.

### Why confidence scoring for vendor detection

Multiple vendor plugins may analyze the same QTI document. Each detector independently assigns a confidence score (0.0–1.0) based on how many vendor signals it finds (namespace declarations, `data-vendor` attributes, generator metadata, CSS class prefixes). The plugin uses the highest-confidence result and only treats it as a definitive detection if `confidence >= 0.6`. This threshold prevents single weak signals (e.g., a coincidental class name that matches a vendor prefix) from triggering a vendor-specific transformation path.

Detectors that throw are swallowed with a `console.warn` so that a broken detector does not block all transformations. The fallback is the standard QTI→PIE path, which handles the broadest range of content.

### Why associateInteraction is experimental

QTI `associateInteraction` models arbitrary many-to-many pairings: any source concept can be associated with any target concept, and the number of associations is bounded by `maxAssociations`. PIE's `categorize` element models one-to-many categorization: items are placed into buckets. The mapping is structurally approximate — a two-category `associateInteraction` with two choices per category looks like categorize, but the semantics differ for three or more categories with cross-associations. The transformation is provided because it handles common real-world authoring patterns, but it emits a `logger.warn` on every call to ensure maintainers are aware that the semantic mapping is not exact.

---

## QTI specification alignment

- **Spec versions:** QTI 2.2
- **Spec sections:** §4.1 assessmentItem; §4.x individual interaction types; §6 assessmentTest structure
- **Supported interaction types:**
  - `choiceInteraction` → PIE `multiple-choice`
  - `extendedTextInteraction` → PIE `extended-response`
  - `orderInteraction` → PIE `placement-ordering`
  - `matchInteraction` (two `simpleMatchSet` elements) → PIE `match-list`
  - `matchInteraction` (single pairing) → PIE `match`
  - `textEntryInteraction` → PIE `explicit-constructed-response`
  - `selectPointInteraction` → PIE `select-text` (best effort)
  - `hottextInteraction` → PIE `select-text`
  - `inlineChoiceInteraction` → PIE `inline-dropdown`
  - `gapMatchInteraction` → PIE `drag-in-the-blank`
  - `hotspotInteraction` → PIE `hotspot`
  - `graphicGapMatchInteraction` → PIE `image-cloze-association`
  - Two `choiceInteraction` elements → PIE `ebsr` (Evidence-Based Selected Response)
  - `associateInteraction` → PIE `categorize` (experimental, see rationale above)
  - `assessmentPassage` / `assessmentStimulus` (top-level) → PIE `passage`
  - `assessmentTest` → PIE assessment structure
- **Deliberately omitted:** `sliderInteraction` (no standard PIE element; `AcmeSliderTransformer` in `demo-vendor-extensions` is a placeholder demonstrating the vendor hook path). `drawingInteraction`, `uploadInteraction`, `mediaInteraction`, `endAttemptInteraction`, `positionObjectInteraction`, `graphicOrderInteraction`, `graphicAssociateInteraction` — not yet implemented; throws `Unsupported interaction type`.
- **Known divergences:**
  - Inline `<stimulus>` elements inside `itemBody` are treated as inline content, not standalone passages. Only top-level `<assessmentPassage>` or `<assessmentStimulus>` root elements produce a PIE `passage` item.
  - EBSR detection is heuristic: exactly two `<choiceInteraction>` elements in a single `assessmentItem` are assumed to be EBSR. Items with two choice interactions for other reasons will be misdetected.
  - `selectPointInteraction` is mapped to `select-text` (a text-selection interaction); the PIE framework has no standard point-on-image interaction that maps cleanly. The transformation is approximate.

---

## Functional requirements

- **FR-1:** When QTI XML contains both `xmlns:pie="https://github.com/pie-framework/pie-elements"` and `<pie:sourceModel>`, the plugin MUST extract the CDATA-wrapped JSON from `pie:sourceModel` and return it verbatim as the PIE item, without any QTI→PIE transformation. This path MUST be taken before XML parsing or vendor detection.
- **FR-2:** When QTI XML does not contain a PIE extension, the plugin MUST embed the original QTI XML string in the output PIE item at `metadata.qtiSource.xml`.
- **FR-3:** Interaction type detection MUST use the ordered check list: `assessmentTest` first, then `assessmentPassage`/`assessmentStimulus`, then EBSR (two `choiceInteraction`), then the standard interaction element names in order.
- **FR-4:** When vendor detectors are registered, the plugin MUST run all detectors against `(qtiXml, parsedDoc)` and select the one with the highest confidence score. If the best score is below 0.6, no vendor is detected.
- **FR-5:** When a vendor is detected and a matching `VendorTransformer` is registered for that vendor, the plugin MUST delegate to the vendor transformer. If the vendor transformer throws, the plugin MUST log a warning and fall through to the standard transformation path.
- **FR-6:** Metadata extraction MUST prefer a vendor-specific `MetadataExtractor` (matched by `extractor.vendor === vendorInfo.vendor`) over the standard extractor (`extractor.vendor === 'standard'`). The standard extractor is registered by default in the constructor.
- **FR-7:** `baseId` MUST be extracted from `<qti-metadata-field name="externalId">` only when `<qti-metadata-field name="sourceSystemId">` has value `"pie"`, confirming the item originated in PIE.
- **FR-8:** For `assessmentTest` input, the plugin MUST return an assessment object (not a single item) that includes `testParts`, `sections`, `itemRefs`, `timeLimits`, and `outcomeProcessingXml`.
- **FR-9:** Vendor hooks registered via constructor options (`vendorDetectors`, `vendorTransformers`, `assetResolvers`, `cssClassExtractors`, `metadataExtractors`) MUST behave identically to hooks registered via `registerVendorDetector(...)` et al. after construction.

---

## Non-functional requirements

- **Accessibility:** Not applicable — this is a server-side transformation package.
- **Performance:** XML is parsed once via `node-html-parser` and the parsed `doc` is shared across interaction detection, vendor detection, and transformation. Avoid re-parsing in vendor hooks that receive `parsedDoc`.
- **Cross-platform:** Runs in Node.js 20.19+ and Bun. `node-html-parser` is a pure-JS parser; no native bindings.
- **Security:** QTI XML from third-party sources may contain malicious content (script injection in CDATA sections, entity expansion). The plugin does not sanitize HTML in stimulus or itemBody content — sanitization is the consumer's responsibility before rendering in a browser. The plugin must not execute embedded scripts.
- **i18n:** The plugin passes through QTI `<div xml:lang="...">` and similar locale attributes without modification. No locale-specific transformation logic exists in the current implementation.

---

## Design decisions

### XML is parsed once; the parsed doc is threaded through

**Decision:** `transform()` calls `parse(qtiXml)` once, producing a `doc` object, and passes it to `detectVendor`, vendor transformers, metadata extractors, and individual interaction transformers wherever they accept it.
**Rationale:** Parsing XML with `node-html-parser` is the dominant cost in a single-item transformation. Parsing the same XML multiple times in the same pipeline pass wastes CPU and creates consistency risks (if the XML were mutable, which it is not).
**Alternatives considered:** Passing raw XML to every function and letting each parse internally — rejected for performance.
**Consequences:** The `parsedDoc` parameter in `VendorDetector.detect`, `VendorTransformer.canHandle`, `VendorTransformer.transform`, and `MetadataExtractor.extract` is not optional. Vendor implementations must not mutate the doc object, as mutations would affect downstream functions in the same call.

---

### Vendor hooks are arrays, not a single registered handler

**Decision:** `VendorExtensionHooks` holds arrays of detectors, transformers, etc. The plugin iterates all registered detectors on every transform call.
**Rationale:** Multiple vendor packages may need to register side-by-side (e.g., an org-wide base vendor package and an item-set-specific vendor package). A single-slot design would require the second registrant to wrap the first.
**Alternatives considered:** A registry-with-key pattern (one handler per vendor ID) — rejected because two packages from the same vendor might legitimately need to coexist during a migration.
**Consequences:** If many detectors are registered (tens), detection becomes O(n) per transform call. This is acceptable for current use cases (typically 1–3 vendor packages). If this becomes a bottleneck, add a short-circuit exit when confidence reaches 1.0.

---

### The standard MetadataExtractor is registered in the constructor

**Decision:** `createStandardMetadataExtractor()` is called in the constructor and registered with `vendor: 'standard'`. It runs when no vendor-specific extractor matches.
**Rationale:** Every PIE item needs `searchMetaData` populated from QTI metadata fields (subject, grade level, DOK, etc.). Making this automatic prevents callers from forgetting to register it. Callers who want to override metadata extraction for a specific vendor register an extractor with `vendor: 'acme'`; the standard extractor continues to handle all other vendors.
**Alternatives considered:** Requiring callers to register all extractors explicitly — rejected because it creates a footgun (forgetting searchMetaData extraction produces items that are invisible to search systems).
**Consequences:** Vendor packages that want to completely replace standard metadata extraction for their content must register an extractor with `vendor` matching the detected vendor ID. They cannot prevent the standard extractor from running for non-vendor content.

---

### Source profiles are the preferred path for real-world QTI imports

**Decision:** Source-specific behaviour for QTI → PIE imports is expressed as `QtiSourceProfile` entries (with optional item handlers, decorators, and fallback policy) registered into `QtiToPiePlugin` and `transformQtiPackageToPie` via `sourceProfiles`. Built-in interaction transforms live behind a `QtiToPieRegistry` so handlers can delegate to them via `delegate.continue()`.

**Rationale:** Real-world QTI packages from external content sources mix generic spec-compliant content with proprietary interactions, package conventions, identity markers, and metadata schemas. Modeling that as scored profile detection plus composable handlers / decorators keeps the generic path intact for spec-compliant content, allows multiple profiles to apply to the same package (e.g. `common-cartridge-csm` plus a publisher-specific profile), records every match and decision in `ConversionTrace`, and lets proprietary items fail closed with structured diagnostics instead of silently producing lossy conversions.

**Alternatives considered:** Use the five-hook `VendorExtensionHooks` API for everything — still supported and the right tool for whole-pipeline replacement and asset/CSS/metadata interception, but doesn't carry package-level analysis, sidecars, conversion trace, or fallback policy, and forces wide vendor branches instead of scored evidence. Inline source-specific code in the plugin — rejected because it doesn't compose, hides which behaviour fired for which item, and pollutes the open-source package with proprietary handling.

**Consequences:** Item handlers can replace, decorate, delegate to, or block the built-in transforms. `fallbackPolicy: 'block-generic'` causes a `QtiSourceProfileTransformError` carrying structured `SourceProfileDiagnostic`s and the `ConversionTrace` when matched content has no successful handler. `transformQtiPackageToPie` rejects ambiguous composition of a `plugin` instance together with `sourceProfiles` so the matching path is unambiguous. Host applications consume `result.metadata.sourceProfiles`, `result.metadata.sourceDiagnostics`, and `result.metadata.conversionTrace` to surface which extension fired and why. Authoring guidance and the architecture diagram live in `docs/SOURCE-PROFILES.md`.

---

### assessmentTest path returns early without QTI source embedding

**Decision:** The `assessmentTest` branch returns a `TransformOutput` immediately after building the PIE assessment object, bypassing the `embedQtiSourceInPie` call that all other paths go through.
**Rationale:** Assessment tests are structural containers — they reference items by `href`, not by embedding item XML. The source XML of the test structure itself is less useful to embed than individual item sources, and the assessment output shape does not include a `metadata` bag in the same location as single-item outputs.
**Alternatives considered:** Embedding the source in the assessment's metadata — not implemented; no known consumer requires it.
**Consequences:** QTI→PIE→QTI round-trips for `assessmentTest` depend on the PIE assessment model faithfully preserving all structural information rather than falling back to the embedded source. If `outcomeProcessingXml` or branch rules are not preserved correctly, the round-trip will lose data. See `architecture/pie-to-qti.md` for what is and is not preserved.

---

## Extension points

| Extension point | Interface | How to register | When it runs |
|----------------|-----------|----------------|-------------|
| Source profile | `QtiSourceProfile` | `sourceProfiles` option on `QtiToPiePlugin` or `transformQtiPackageToPie`; defaults from `@pie-qti/source-profiles` | Scored detection at package and item level; matches flow into the rest of the source-profile runtime |
| Item handler | `QtiItemHandler` (on a profile) | Declared on a matched `QtiSourceProfile` | Before built-in interaction transforms; may return PIE content, return `null` with a diagnostic, or call `delegate.continue()` to run the built-in handler |
| Item decorator | `QtiItemDecorator` (on a profile) | Declared on a matched `QtiSourceProfile` | After the generic PIE model is produced, at `afterModel` / `beforeFinalize` / `afterFinalize` phases |
| Built-in transform | `QtiBuiltInTransformHandler` | Registered into `QtiToPieRegistry` (default registry seeded by `createDefaultQtiToPieRegistry`) | Selected by interaction kind; reachable from item handlers via `delegate.continue('built-in-name')` |
| Fallback policy | `SourceProfileFallbackPolicy` (`allow-generic` / `block-generic`) | Declared on a `QtiItemHandler` or `QtiSourceProfile` | When a matched handler returns `null`; `block-generic` raises `QtiSourceProfileTransformError` instead of falling through to generic transforms |
| Vendor detector | `VendorDetector` | `plugin.registerVendorDetector(detector)` or constructor `vendorDetectors` option | Before every non-lossless transform; all detectors run, highest confidence wins |
| Vendor transformer | `VendorTransformer` | `plugin.registerVendorTransformer(transformer)` or constructor option | After vendor detection, if detected vendor matches `transformer.vendor` and `canHandle` returns true |
| Asset resolver | `AssetResolver` | `plugin.registerAssetResolver(resolver)` or constructor option | Called by vendor transformers via `plugin.getAssetResolvers()`; not invoked by the plugin itself |
| CSS class extractor | `CssClassExtractor` | `plugin.registerCssClassExtractor(extractor)` or constructor option | Called by vendor transformers via `plugin.getCssClassExtractors()`; not invoked by the plugin itself |
| Metadata extractor | `MetadataExtractor` | `plugin.registerMetadataExtractor(extractor)` or constructor option | After successful item transformation; vendor-specific extractor takes priority over standard |

**Note on asset resolvers and CSS class extractors:** The plugin stores them and exposes them via `getAssetResolvers()` / `getCssClassExtractors()` so that vendor transformers can retrieve them by calling back into the plugin instance. The plugin itself does not invoke these hooks — it is the vendor transformer's responsibility to call them.

**Note on choosing an extension point:** Prefer source profiles + item handlers + decorators for QTI import work — they carry detection evidence, conversion trace, fallback policy, package sidecars, and structured diagnostics. Use the five vendor hooks for whole-pipeline replacement, asset URL rewriting, CSS-class interception, or vendor-keyed metadata extraction that doesn't fit the source-profile model.

---

## Data model / contracts

Key source files:
- `packages/to-pie/src/plugin.ts` — `QtiToPiePlugin`, `QtiToPiePluginOptions`, `QtiSourceProfileTransformError`
- `packages/to-pie/src/registry/qti-to-pie-registry.ts` — `QtiToPieRegistry`, `createDefaultQtiToPieRegistry`, `QtiBuiltInTransformHandler`, `BuiltInTransformDelegate`
- `packages/to-pie/src/source-profile-runtime.ts` — `runItemHandlers`, `applyItemDecorators`, `ItemHandlerRuntimeResult`, source-profile diagnostic aggregation
- `packages/to-pie/src/package-transformer.ts` — `transformQtiPackageToPie`, sidecar emission, package-level diagnostic rollup, MIME inference
- `packages/types/src/source-profile.ts` — `QtiSourceProfile`, `QtiItemHandler`, `QtiItemDecorator`, `SourceProfileMatch`, `SourceProfileDiagnostic`, `SourceProfileFallbackPolicy`, `ConversionTrace`, `TransformTraceEvent`
- `packages/source-profiles/src/` — default `QtiSourceProfile` implementations (`common-cartridge-csm`, `savvas.myperspectives.examview.qti21`, `partner.gca`)
- `packages/to-pie/src/types/vendor-extensions.ts` — `VendorDetector`, `VendorTransformer`, `VendorInfo`, `AssetResolver`, `CssClassExtractor`, `MetadataExtractor`, `VendorClasses`, `ResolvedAsset`, `VendorExtensionHooks`
- `packages/to-pie/src/utils/pie-extension.ts` — `hasPieExtension`, `extractPieExtension`, `PieExtensionData`, `PIE_NAMESPACE`, `PIE_PREFIX`
- `packages/to-pie/src/utils/qti-extension-embedder.ts` — `embedQtiSourceInPie`, `extractQtiSourceFromPie`, `hasQtiSource`
- `packages/to-pie/src/extractors/standard-metadata-extractor.ts` — standard metadata extraction from QTI metadata fields

**Invariants not obvious from the types:**

- `hasPieExtension` uses raw string search (not DOM query). It checks for both `xmlns:pie="https://github.com/pie-framework/pie-elements"` AND `<pie:sourceModel>`. Both must be present for the lossless path to activate.
- `extractPieExtension` returns `{ hasExtension: false, sourceModel: null }` on any parse failure — it never throws. Callers must check `hasExtension` before using `sourceModel`.
- `VendorInfo.confidence` is a float 0.0–1.0. The minimum threshold for vendor dispatch is 0.6 (hardcoded in `detectVendor`). A detector's internal threshold to return a result is independent — the `AcmeVendorDetector` has a separate threshold of 0.3 before returning a result at all.
- `VendorTransformer.transform` receives the pre-parsed `parsedDoc` (a `node-html-parser` `HTMLElement`). The doc is re-used from the plugin's parse call. Vendor transformers must not use it after the transform call returns, as the reference is not guaranteed to remain valid.
- `embedQtiSourceInPie` returns a new object (spread) — it does not mutate the input `pieItem`.
- Metadata extraction result is merged onto `pieItem.searchMetaData` with transformer-generated metadata winning on key conflict (`{ ...extractedMetadata, ...(pieItem.metadata?.searchMetaData || {}) }`).
- The plugin's `id` is `'qti22-to-pie'`, `sourceFormat` is `'qti22'`, `targetFormat` is `'pie'`. These values are used as keys by the engine's `PluginRegistry` — changing them is a breaking API change.

---

## Acceptance criteria

### Functional

```
AC-1: Lossless round-trip via PIE extension
  Given: QTI XML produced by @pie-qti/pie-to-qti2 (contains xmlns:pie namespace and pie:sourceModel)
  When: QtiToPiePlugin.transform is called
  Then: The returned PIE item is deeply equal to the original PIE item that was exported to QTI
        and metadata.losslessRoundTrip === true in the TransformOutput metadata
  Notes: Verify with a real PIE item containing vendor-specific fields. The lossless path
         must return the model even if the QTI XML contains a valid (but irrelevant) interaction type.

AC-2: Best-effort transform embeds original QTI XML
  Given: Standard third-party QTI XML (no PIE extension) for a choiceInteraction
  When: QtiToPiePlugin.transform is called
  Then: result.items[0].content.metadata.qtiSource.xml equals the input QTI XML string

AC-3: Vendor transformer invoked on high-confidence detection
  Given: A plugin with a registered VendorDetector (returns confidence 0.8 for 'acme')
         and a VendorTransformer (vendor='acme', canHandle returns true)
  When: transform is called with QTI XML the detector matches
  Then: VendorTransformer.transform is invoked and its output is returned

AC-4: Vendor transformer fallback on error
  Given: A plugin with a VendorTransformer that throws during transform
  When: transform is called with vendor-matched QTI XML
  Then: A warning is logged; the standard QTI→PIE path produces the output instead

AC-5: Confidence threshold blocks weak detection
  Given: A detector that returns confidence=0.5 for some content
  When: transform is called
  Then: No vendor is detected (detectVendor returns null); standard path is used

AC-6: EBSR detection by two choiceInteraction elements
  Given: QTI XML containing exactly two <choiceInteraction> elements in one assessmentItem
  When: detectInteractionType is called
  Then: Returns 'ebsr'

AC-7: associateInteraction emits a warning
  Given: QTI XML with associateInteraction
  When: transform is called
  Then: A warning message containing 'experimental' and the item ID is emitted via context.logger.warn

AC-8: assessmentTest returns assessment structure
  Given: QTI XML with <assessmentTest> root element containing testParts and sections
  When: transform is called
  Then: result.items[0].content has testParts array; result.metadata.itemCount equals the
        total number of itemRefs across all sections and testParts

AC-9: baseId extracted from PIE-originated QTI
  Given: QTI XML with <qti-metadata-field name="sourceSystemId" value="pie"/> and
         <qti-metadata-field name="externalId" value="item-stable-123"/>
  When: transform is called (no PIE extension present — testing the metadata extraction path)
  Then: The resulting PIE item's id is 'item-stable-123'

AC-10: Standard metadata extractor runs by default
  Given: QTI XML with <qti-metadata-field name="subject" value="Mathematics"/>
         and no vendor-specific MetadataExtractor registered
  When: transform is called
  Then: result.items[0].content.searchMetaData.subject equals 'Mathematics'

AC-11: Vendor metadata extractor takes priority over standard
  Given: A registered MetadataExtractor with vendor='acme' returning { subject: 'Science' }
         and QTI XML that the AcmeVendorDetector detects with confidence >= 0.6
  When: transform is called
  Then: result.items[0].content.searchMetaData.subject equals 'Science' (from vendor extractor)
        not 'Mathematics' (from standard extractor)
```

### Edge cases

```
AC-E1: hasPieExtension is a no-parse string check
  Given: QTI XML containing xmlns:pie namespace but no pie:sourceModel element
  When: hasPieExtension is called
  Then: Returns false (both markers must be present)

AC-E2: extractPieExtension returns safe result on malformed CDATA
  Given: QTI XML with pie:sourceModel containing invalid JSON in CDATA
  When: extractPieExtension is called
  Then: Returns { hasExtension: false, sourceModel: null } without throwing

AC-E3: Detector that throws is skipped
  Given: Two detectors: first throws Error, second returns confidence=0.8
  When: transform is called
  Then: A console.warn is emitted for the first detector; second detector's result is used

AC-E4: Unsupported interaction type throws
  Given: QTI XML with a <sliderInteraction> and no vendor transformer registered for it
  When: transform is called with standard QtiToPiePlugin (no vendor extensions)
  Then: transform throws with 'Unsupported interaction type: sliderInteraction'
  Notes: This is by design — unsupported types should be handled by vendor extensions, not silently dropped.

AC-E5: Inline stimulus is not treated as standalone passage
  Given: QTI XML with <assessmentItem> containing <stimulus> inside <itemBody>
         (not a top-level <assessmentPassage> or <assessmentStimulus>)
  When: detectInteractionType is called
  Then: Does not return 'passage'; proceeds to check for interaction elements
```

---

## Open questions

- [ ] `selectPointInteraction` is mapped to `select-text`, which is a text-selection element in PIE. For actual coordinate-on-image interactions, there is no matching PIE element. Should this mapping emit a warning? Should it throw for non-text QTI content?
- [ ] The plugin's `version` field is hardcoded as `'1.0.0'`. It should be derived from `package.json` at build time to ensure the version embedded in `qtiSource.metadata.generator.version` stays accurate.
- [ ] `AcmeSliderTransformer` in `demo-vendor-extensions` references an undefined variable `baseId` (line 96 of the file), producing a runtime reference to the module-level `const baseId = undefined`. This is a bug in the demo code; it should reference the extracted item ID.
- [ ] Confidence threshold (0.6) is hardcoded in `detectVendor`. Should it be configurable per plugin instance? Low-threshold vendor plugins that intentionally match on weak signals cannot currently lower this floor.
- [ ] Asset resolvers and CSS class extractors are stored on the plugin but never invoked by the plugin itself — only by vendor transformers that call back via `plugin.getAssetResolvers()`. This means vendor transformers must receive a reference to the plugin instance to use these hooks. Consider making these hooks part of `TransformContext` instead so vendor transformers receive them through the standard context parameter.

---

## Related

- QTI spec: http://www.imsglobal.org/question/qtiv2p2/imsqti_v2p2.html §4 (assessment items), §6 (assessment test structure)
- Implementation: `packages/to-pie/src/`
- Adjacent PRDs: `architecture/transform-engine.md`, `architecture/pie-to-qti.md`, `architecture/vendor-extensions.md`, `architecture/ims-content-packages.md`
- Existing docs: `docs/PIE-QTI-TRANSFORMATION-GUIDE.md`, `docs/VENDOR-TRANSFORM-PLUGIN-GUIDE.md`, `docs/SOURCE-PROFILES.md`
- Demo vendor extensions: `packages/demo-vendor-extensions/src/`
