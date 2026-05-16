# PRD: Vendor Transform Extensions

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/to-pie (hooks), @pie-qti/item-player (plugin side)
  Last reviewed: 2026-04-27
-->

**Status:** draft  
**Type:** architecture  
**Packages:** `@pie-qti/to-pie` (transform-side hooks), `@pie-qti/item-player` (player-side plugin API)  
**Last reviewed:** 2026-04-27

---

## Summary

The vendor extension system lets external packages customise the QTI-to-PIE transform pipeline and the item-player extraction pipeline without forking or modifying framework code. On the transform side (`@pie-qti/to-pie`), five typed hook interfaces — `VendorDetector`, `VendorTransformer`, `AssetResolver`, `CssClassExtractor`, and `MetadataExtractor` — are composed into a `VendorExtensionHooks` bag and injected at plugin-construction time. On the player side (`@pie-qti/item-player`), vendor-supplied `ElementExtractor` implementations with a priority above 500 can intercept extraction of any element type before the built-in extractors run. The ACME demo (`@pie-qti/demo-vendor-extensions`, `@acme/likert-scale-plugin`) provides a working reference for both surfaces.

> **Note (PIE-569):** For package-aware QTI → PIE imports — source detection, sidecars, standards candidates, item handlers, decorators, fallback policy, and conversion traces — prefer the **source-profile** mechanism documented in [`docs/SOURCE-PROFILES.md`](../../SOURCE-PROFILES.md). The five vendor hooks described in this PRD remain the right tool for whole-pipeline replacement, asset URL rewriting, and player-side extractor priority overrides; they do not duplicate the source-profile pipeline.

---

## Background and rationale

### Why hooks, not subclassing

The framework's two main extension surfaces (the QTI→PIE transform and the item-player extraction pass) both use composition rather than inheritance. A vendor that needs custom behaviour only needs to provide the specific hook it cares about; it does not inherit a class that carries state or invariants unrelated to its concern. Hook objects are plain implementations of narrow interfaces; they have no base class and make no assumptions about the framework's internal state. This also makes it trivial to combine extensions from multiple vendors in the same process.

### Why five separate hook types

Each of the five hook types has a different call site and a different ownership model:

1. **`VendorDetector`** is called once per document, early, to label the content. Multiple detectors can run in sequence; the highest-confidence result wins. Kept separate from `VendorTransformer` so a detector can be reused across multiple transformer implementations.
2. **`VendorTransformer`** takes full ownership of the transform for a specific vendor's content. It receives the already-detected `VendorInfo` so it can branch on sub-types without re-detecting.
3. **`AssetResolver`** is called per-asset, not per-document. Keeping it separate allows the same resolver to serve both the transform pipeline (when building PIE models) and any future runtime asset-loading path, without bundling transform logic.
4. **`CssClassExtractor`** is called per-element during the extraction traversal. Keeping class parsing separate from transformation allows the base extractor to call into vendor-specific class knowledge without triggering a full vendor transform path.
5. **`MetadataExtractor`** is called once per document, after the transform, to annotate the output. Metadata does not affect the PIE model structure; it is a pure read of vendor-specific fields. Separating it prevents metadata concerns from contaminating the transform logic.

### Why silent fallthrough when a transformer throws

If a registered `VendorTransformer.transform()` throws, the pipeline treats it as "this transformer cannot handle this document" and falls through to the next transformer in priority order (or the base transform). Propagating the exception would break all transforms for the document, even though the failure may be limited to one vendor path. Vendor code quality is outside the framework's control. The error is logged at warning level so it is visible without being fatal.

### Why confidence scoring for vendor detection

A single QTI document can match multiple heuristic signals (namespace, attribute, generator tag, CSS class prefix). Summing fractional confidence scores lets a detector distinguish between a strong signal (namespace match alone: 0.5) and a weak one (CSS class prefix: 0.1), and report the aggregate. Callers can reject results below a configurable threshold (default: 0.3). Without scoring, detectors would need to either require all signals (fragile) or accept any signal (noisy). The `AcmeVendorDetector` demonstrates the pattern: each pattern increments the confidence, and the detector returns `null` if the total stays below 0.3.

### Why metadata uses embedded CDATA (round-trip)

Vendor metadata extracted by `MetadataExtractor` is attached to the output PIE item as a plain `Record<string, any>`. When a PIE item is serialised back to QTI (via `@pie-qti/pie-to-qti2`), metadata that was present in the original QTI `<qtiMetadata>` section is round-tripped as a CDATA block inside a `<qti-metadata-field name="vendor-metadata">` element. This preserves opaque vendor data across QTI→PIE→QTI round-trips without the framework needing to understand its structure. The CDATA wrapper is necessary because the metadata values can contain arbitrary JSON, including characters that would break XML well-formedness.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, 2.2 (primary transform target); QTI 3.0 (name-mapping layer is transparent to vendor extensions)
- **Spec section(s):** The vendor extension system is a framework extension point, not a QTI-specified concept. The hooks operate on the same parsed documents and output structures that the base transform uses for §3.x interaction types.
- **Deliberately omitted:** The QTI spec has no notion of "vendor plugin". This system is an addition to the framework, not derived from the spec.

---

## Functional requirements

- **FR-1:** A vendor package must be able to register any combination of the five hook types without registering all five.
- **FR-2:** `VendorDetector.detect()` must return `null` (not throw) when the content does not match the vendor pattern.
- **FR-3:** `VendorTransformer.canHandle()` must be called before `transform()`; if `canHandle()` returns `false`, `transform()` must not be called.
- **FR-4:** When `VendorTransformer.transform()` throws, the pipeline must fall through to the next registered transformer or the base transform, and must record the error in the transform output's `warnings` array.
- **FR-5:** `AssetResolver.canResolve()` is called for every asset URL encountered during transformation; the first resolver whose `canResolve()` returns `true` handles the asset exclusively.
- **FR-6:** `CssClassExtractor.extract()` must return a `VendorClasses` with all four buckets (`behavioral`, `styling`, `semantic`, `unknown`) populated; buckets with no matches must be empty arrays, not `undefined`.
- **FR-7:** `MetadataExtractor.extract()` must not mutate `parsedDoc` or `vendorInfo`.
- **FR-8:** On the player side, an `ElementExtractor` registered with `priority >= 500` takes precedence over all built-in extractors for its declared `elementTypes`.
- **FR-9:** The `VendorExtensionHooks` bag accepted by `QtiToPiePlugin` constructor must accept empty arrays for any hook type not provided by the vendor.

---

## Non-functional requirements

- **Performance:** Hook dispatch happens synchronously for `canHandle`/`detect`/`canResolve`/`extract` and asynchronously for `transform`/`resolve`. Detectors and `canHandle` implementations must complete in under 10 ms for a typical 50 KB QTI document (no network calls, minimal DOM traversal).
- **Security:** Vendor hook implementations run in the same process as the framework. A malicious vendor package has the same trust level as any other npm dependency. The framework does not sandbox hook execution. This is a build-time trust boundary, not a runtime one.
- **Bundle size:** The five hook interfaces are pure TypeScript types exported from `@pie-qti/to-pie`. They have zero runtime footprint when no vendor implementations are registered.
- **Accessibility:** Not applicable — the vendor extension system operates at the transform layer, not the rendering layer. Accessibility obligations belong to the individual vendor-supplied components.
- **i18n:** Not applicable at the transform layer. Vendor extractors may read locale metadata but the framework does not localise hook output.

---

## Design decisions

### Hooks are injected at construction time, not registered to a global registry

**Decision:** `VendorExtensionHooks` is passed to the `QtiToPiePlugin` constructor, not registered via a global `engine.use()` style API.  
**Rationale:** Global registries create hidden shared state; two independent transform pipelines in the same process would interfere with each other. Constructor injection is explicit, testable, and makes the dependency visible in the call site.  
**Alternatives considered:** A global `VendorRegistry.register()` singleton was evaluated and rejected for the above reason. The `TransformEngine.use()` plugin API (used for whole-plugin registration) exists at a coarser granularity and is not appropriate for the fine-grained hook types.  
**Consequences:** Vendors must construct a `QtiToPiePlugin` with their hooks if they want to customise the transform. They cannot add hooks to an already-constructed plugin instance.

### Detector confidence threshold is caller-configurable

**Decision:** The pipeline accepts detections above a configurable minimum confidence (default 0.3).  
**Rationale:** Some content banks have very sparse vendor signals (e.g., a single generator metadata field but no namespace). The threshold lets the calling application trade off false positives against false negatives based on the content it expects to process.  
**Alternatives considered:** Hard-coding a threshold of 0.5 would miss legitimate vendor content from minimal signalers. Requiring all signals would be too brittle.  
**Consequences:** Calling code must understand that a `VendorInfo` with confidence 0.3 is a weak detection and should be logged or surfaced to operators.

### `ElementExtractor` priority 500 as the player-side vendor boundary

**Decision:** Built-in player extractors use priorities 1–499; vendor extractors should use 500 or above.  
**Rationale:** The ACME Likert extractor (`priority: 500`) demonstrates the pattern. The gap between 499 and 500 is a documented convention, not enforced by the registry. This mirrors the `TransformPlugin` priority range documented in the developer guide (500-999 for vendor overrides).  
**Alternatives considered:** A separate "vendor registry" distinct from the main `ExtractionRegistry` was considered but would require the player to maintain two registries and merge them, adding complexity for no practical benefit.  
**Consequences:** A vendor that accidentally uses a priority below 500 will still work but may be pre-empted by a built-in extractor that also handles the same element type.

### Transformer fallthrough is silent from the caller's perspective

**Decision:** When a `VendorTransformer` throws, the pipeline records the error in `warnings` and continues. Callers receive a valid `TransformOutput` in all cases.  
**Rationale:** Transform pipelines are batch operations; a single-item failure in a hundred-item package should not abort the entire run. The `warnings` array in `TransformOutput` gives callers a structured way to inspect per-item failures without try/catch.  
**Alternatives considered:** Re-throwing the error from the pipeline was considered. It was rejected because it would make batch transforms fragile and would force every caller to wrap transforms in try/catch.  
**Consequences:** Callers must actively inspect `output.warnings` to detect transformer failures. Silent success-with-warning is the observable outcome.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| Vendor detection | `VendorDetector` | Implement `detect(qtiXml, parsedDoc): VendorInfo \| null`; pass instance in `VendorExtensionHooks.detectors[]` | `AcmeVendorDetector` in `packages/demo-vendor-extensions/src/acme-vendor-detector.ts` |
| Vendor transformation | `VendorTransformer` | Implement `canHandle()` and `transform()`; pass instance in `VendorExtensionHooks.transformers[]` | `AcmeSliderTransformer` in `packages/demo-vendor-extensions/src/acme-slider-transformer.ts` |
| Asset resolution | `AssetResolver` | Implement `canResolve(type, url)` and `resolve(type, url, baseDir)`; pass instance in `VendorExtensionHooks.assetResolvers[]` | `AcmeAssetResolver` in `packages/demo-vendor-extensions/src/acme-asset-resolver.ts` |
| CSS class parsing | `CssClassExtractor` | Implement `extract(element): VendorClasses`; pass instance in `VendorExtensionHooks.cssClassExtractors[]` | `AcmeCssClassExtractor` in `packages/demo-vendor-extensions/src/acme-css-extractor.ts` |
| Metadata extraction | `MetadataExtractor` | Implement `extract(qtiXml, parsedDoc, vendorInfo): Record<string, any>`; pass instance in `VendorExtensionHooks.metadataExtractors[]` | `AcmeMetadataExtractor` in `packages/demo-vendor-extensions/src/acme-metadata-extractor.ts` |
| Player-side element extraction | `ElementExtractor<T>` | Implement with `priority >= 500`; register via `plugin.registerExtractors(registry)` | `likertChoiceExtractor` in `packages/acme-likert-plugin/src/extractors/likertChoiceExtractor.ts` |

---

## Data model / contracts

All five hook interfaces are defined in `packages/to-pie/src/types/vendor-extensions.ts`. Key invariants beyond what the types express:

**`VendorDetector`**
- `detect()` must be synchronous. It receives the raw XML string and the already-parsed `HTMLElement` root. It must not re-parse the document.
- Return `null`, not `{ confidence: 0 }`, when the vendor is not detected. The pipeline skips `null` results.

**`VendorInfo`**
- `confidence` is in `[0.0, 1.0]`. Values above 1.0 are clamped. The pipeline selects the highest-confidence detection when multiple detectors match.
- `metadata` is untyped (`Record<string, any>`). Downstream hooks receive the full `VendorInfo` including `metadata`; they may use it for sub-type detection.

**`VendorTransformer`**
- `canHandle()` is synchronous. `transform()` is async. Both receive the same `parsedDoc` root element; implementations must not mutate it.
- The `TransformOutput` returned by `transform()` must have `format: 'pie'` and a valid `metadata.pluginId` string.
- If the transformer cannot produce a valid output, it should throw rather than return an output with `items: []`; the pipeline treats a thrown exception as "cannot handle" and falls through.

**`AssetResolver`**
- `canResolve()` is synchronous. `resolve()` is async and must return a `ResolvedAsset` with at least `url`, `mimeType`, and either `content` or `buffer` populated.
- `baseDir` passed to `resolve()` is an absolute filesystem path (Node.js transform context) or a package-relative POSIX path (browser context). Resolvers that only handle remote URLs may ignore it.

**`CssClassExtractor`**
- `extract()` must only examine the passed element, not traverse the document. The framework calls it per-element during the extraction walk.
- All four `VendorClasses` buckets must always be present; never `undefined`.

**`MetadataExtractor`**
- Return value is merged shallowly onto the PIE item's `vendorMetadata` object. Keys from different extractors do not collide as long as each vendor uses its own prefixed keys (e.g., `acme:difficulty`).

**`ElementExtractor<T>` (player-side)**
- `elementTypes: string[]` declares which QTI element names this extractor handles.
- `canHandle(element, context): boolean` is called first; return `false` to pass to the next extractor in priority order.
- `extract()` must return a complete, valid data object of type `T`; partial objects will cause rendering failures downstream.
- `validate(data): ValidationResult` is optional but strongly recommended; the player calls it after extraction and surfaces errors to the host.

---

## Acceptance criteria

### Functional

```
AC-1: Vendor detector result routes to transformer
  Given: A QtiToPiePlugin constructed with AcmeVendorDetector and AcmeSliderTransformer
  When: A QTI document containing xmlns:acme="http://acme.com/qti" is transformed
  Then: AcmeVendorDetector.detect() returns VendorInfo with vendor="acme" and confidence >= 0.5
        AND AcmeSliderTransformer.canHandle() is called with that VendorInfo
        AND (if canHandle returns true) AcmeSliderTransformer.transform() is called
  Notes: The detector and transformer are decoupled — canHandle can still return false even when the detector fires.
```

```
AC-2: Confidence threshold filters weak detections
  Given: A QtiToPiePlugin with a threshold of 0.5 and a detector that returns confidence=0.3
  When: A document is transformed
  Then: The VendorTransformer for that vendor is NOT invoked
        AND the base transform is used instead
```

```
AC-3: Transformer exception causes fallthrough, not abort
  Given: A VendorTransformer whose transform() always throws
         AND a base QtiToPiePlugin as fallback
  When: A document that canHandle() returns true for is transformed
  Then: output.items is populated by the base transform (not empty)
        AND output.warnings contains one entry describing the transformer error
        AND no exception propagates to the caller
```

```
AC-4: Asset resolver intercepts vendor URLs
  Given: A QtiToPiePlugin with AcmeAssetResolver registered
  When: A QTI document contains an image with src="acme://assets/diagram.png"
  Then: AcmeAssetResolver.canResolve("image", "acme://assets/diagram.png") returns true
        AND AcmeAssetResolver.resolve() is called for that URL
        AND the resolved URL (not the original acme:// URL) appears in the PIE output
```

```
AC-5: CSS class extractor categorises classes
  Given: An HTMLElement with class="acme-input-medium acme-theme-blue foo-bar"
         AND AcmeCssClassExtractor registered
  When: extract(element) is called
  Then: result.behavioral contains "acme-input-medium"
        AND result.styling contains "acme-theme-blue"
        AND result.unknown contains "foo-bar" (not an acme- prefixed class)
        AND result.semantic is an empty array
```

```
AC-6: Metadata extractor output is merged onto PIE item
  Given: AcmeMetadataExtractor registered and a QTI document with data-acme-difficulty="hard"
  When: The document is transformed
  Then: The PIE item has vendorMetadata.difficulty === "hard"
        AND vendorMetadata._vendorInfo.vendor === "acme"
```

```
AC-7: Player-side Likert extractor overrides built-in choice extractor
  Given: @acme/likert-scale-plugin registered with an item-player Player
         AND a QTI document containing a choiceInteraction with <likertChoice> children
  When: The item is parsed
  Then: The extracted interaction data has metadata.isLikert === true
        AND metadata.scalePoints equals the number of likertChoice elements
        AND shuffle === false (Likert scales must not shuffle)
```

```
AC-8: createAcmeExtensions() returns all five hooks
  Given: import { createAcmeExtensions } from '@pie-qti/demo-vendor-extensions'
  When: createAcmeExtensions() is called
  Then: The returned object has properties: detector, transformer, assetResolver, cssExtractor, metadataExtractor
        AND each is an instance of the corresponding Acme class
```

### Edge cases

```
AC-E1: No vendor detected — base transform runs unchanged
  Given: A QtiToPiePlugin with all five Acme hooks registered
  When: A standard QTI document with no acme markers is transformed
  Then: AcmeVendorDetector.detect() returns null
        AND none of the other Acme hooks are called
        AND output is identical to a transform with no hooks registered
```

```
AC-E2: Multiple detectors, highest confidence wins
  Given: Two VendorDetectors registered: DetectorA returns confidence=0.4, DetectorB returns confidence=0.8
         AND both match the same document
  When: The document is transformed
  Then: VendorInfo with vendor from DetectorB (confidence=0.8) is passed to transformers
        AND DetectorA's VendorInfo is not used for transformer dispatch
```

```
AC-E3: canHandle returns false — next transformer tried
  Given: VendorTransformerA.canHandle() returns false
         AND VendorTransformerB.canHandle() returns true
  When: A document is transformed
  Then: VendorTransformerA.transform() is never called
        AND VendorTransformerB.transform() is called
```

```
AC-E4: Likert extractor validate catches scale too small
  Given: A choiceInteraction with only one <likertChoice> child
  When: likertChoiceExtractor.validate() is called on the extracted data
  Then: result.valid === false
        AND result.errors contains a message about minimum 2 choices
```

---

## Open questions

- [ ] Should `VendorDetector` be allowed to return multiple `VendorInfo` entries (ordered by confidence) so the pipeline can fall back from one vendor label to another? Currently the pipeline picks the single highest-confidence result.
- [ ] Is there a need for a `VendorTransformer` cleanup hook (analogous to `TransformPlugin.dispose()`) for transformers that hold external connections or caches?
- [ ] The `createAcmeExtensions()` factory uses `require()` (CommonJS) internally but the package is declared as `"type": "module"`. This is a latent bug in the demo package; it should use dynamic `import()`.

---

## Related

- Hook type definitions: `packages/to-pie/src/types/vendor-extensions.ts`
- Demo implementations: `packages/demo-vendor-extensions/src/`
- Player-side Likert plugin: `packages/acme-likert-plugin/src/`
- Developer guide: `docs/VENDOR-TRANSFORM-PLUGIN-GUIDE.md`
- Transform plugin system (coarser granularity): `docs/prds/architecture/transform-engine.md` (planned)
- Item player plugin system: `docs/prds/architecture/item-player-plugin-system.md` (planned)
