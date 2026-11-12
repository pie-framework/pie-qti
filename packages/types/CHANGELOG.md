# @pie-qti/transform-types

## 1.0.0-beta.5

### Major Changes

- 684738a: Breaking: removed the storage types with no consumer or implementation anywhere in the repo — `Transaction`, `ZipExtractor`, `SessionStorage`, `Session`, `StreamOptions`, and the `ExtractionResult` used only by `ZipExtractor`. Alongside them, the `StorageBackend` members that existed only to reference those types are gone: `beginTransaction?()` (no backend implemented it, nothing called it) and the `options?: StreamOptions` parameter on `createReadStream`/`createWriteStream` (no caller ever passed options; the only implementation, `MockStorageBackend`, already ignored them).
  
  `ResourceMetadata` stays: it looked unused, but `StorageBackend.getMetadata?()` returns it and core's read-content activity consumes that hook. `MockStorageBackend` and the engine/storage plumbing are unchanged.

### Patch Changes

- af63915: PIE items and passages take optional `curriculumStandards` and `skillLevels`, where `[]` states that none applies. A QTI 3 package carries an item's standards as Curriculum Standards Metadata 1.1 and both fields as LOM classifications, so to-pie reads them back unchanged without the sidecar and reads standards and skill levels from foreign QTI 3 packages; QTI 2.2 packages carry them in the sidecar only. A standard without `providerId` means Academic Benchmarks and keeps the attribute absent through the round trip.
- 88f849c: The transformation packages join the 1.0 beta line: every publishable `@pie-qti/*` package now releases at one version, so these move from `0.2.x` to `1.0.0-beta.5` and publish under the `beta` dist-tag with the players. Hosts that pin them exactly need the new version; a `^0.2` range does not pick it up.
- 93df941: Packaging and back-compat shim removal (legacy audit PR 5, `docs/plans/legacy-audit-2026-11.md` rows A5, A6, A7). No QTI-observable behaviour changes for current-format content.
  
  **Breaking: removed deprecated image-path helper** (beta prerelease; migrate before upgrading):
  
  - `@pie-qti/ims-cp-browser` no longer exports `tryResolveImagePath`. It had been `@deprecated` since path resolution moved to `@pie-qti/ims-cp-core` and had no callers in the repo. Resolve package image references with `buildPackageFileIndex` and `resolvePackageReference` from `@pie-qti/ims-cp-core` (as `resolveImagesInXml` already does); the documented lenient path-resolution heuristics are unchanged.
  
  **Breaking: removed the historical vendor-extension type path** (beta prerelease; migrate before upgrading):
  
  - `@pie-qti/to-pie` no longer re-exports `VendorInfo`, `VendorDetector`, `VendorTransformer`, `ResolvedAsset`, `AssetResolver`, `VendorClasses`, `CssClassExtractor`, `MetadataExtractor`, `CustomAttributes` or `VendorExtensionHooks`; the `src/types/vendor-extensions.ts` shim that preserved the pre-move import path is gone. Import these types from `@pie-qti/transform-types`, where they live.
  
  **Breaking: pre-rename extensions metadata is no longer read** (beta prerelease; migrate before upgrading):
  
  - Packages exported while the PIE metadata bag was still named `searchMetaData` no longer import their extensions metadata: the `?? sourceModel.searchMetaData` fallbacks in `@pie-qti/ims-cp-core`'s `extractExtensionsFromQtiXml` and `@pie-qti/to-pie`'s `extractExtensions`, and the `pie:searchMetaData:` LOM source prefix in `@pie-qti/to-pie`'s `readPieResourceLom`, are gone; only `extensions` and the `pie:extension:` prefix are read. `@pie-qti/transform-types` no longer exports `PIE_LOM_LEGACY_EXTENSION_SOURCE`. The QTI package writer (`@pie-qti/pie-to-qti2`) only ever wrote the current forms, so content written by any current release is unaffected.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [1f1d8f0]
- Updated dependencies
  - @pie-qti/logger@1.0.0-beta.5

## 0.2.1

### Patch Changes

- 29210b4: Type the extension seams that were previously `any`:
  
  - `@pie-qti/transform-types` now owns the vendor extension contracts (`VendorDetector`, `VendorTransformer`, `AssetResolver`, `CssClassExtractor`, `MetadataExtractor`, `VendorInfo`, `VendorClasses`, `CustomAttributes`, `VendorExtensionHooks`), so config-driven vendor modules are type-checked at the transform-core registry boundary instead of being cast through `any`. `@pie-qti/to-pie` re-exports the same names from its historical import path. `TransformContext.storage` is now typed as `StorageBackend` (the interface already lived in transform-types). `@pie-qti/transform-core` no longer re-exports its orchestration-internal `VendorInfo` variant, which was ambiguous next to the canonical contract.
  - `@pie-qti/item-player`'s definition config extension points are now typed: `elementNameMapper`/`attributeNameMapper` (`@pie-qti/qti-common` mapper types), `componentRegistry`/`extractionRegistry` (the publicly exported registry classes), and `i18nProvider` (`@pie-qti/i18n`). Code that passed arbitrary objects to these options will now fail typecheck; pass the documented types instead.
- @pie-qti/logger@1.0.0-beta.4

## 0.2.0

### Minor Changes

- c408053: The host-owned metadata bag on PIE items and passages is renamed from `searchMetaData` to `extensions` (typed `ContentExtensions`), and transformers and `MetadataExtractor` results write `extensions`. Package manifests carry it as LOM classifications with source `pie:extension:<key>` and no `purpose`; `PIE_LOM_SEARCH_METADATA_SOURCE` is replaced by `PIE_LOM_EXTENSION_SOURCE`. Import still reads the `pie:searchMetaData:` source and a legacy item's `searchMetaData`. In `@pie-qti/ims-cp-core`, `extractSearchMetadataFromQtiXml` is renamed `extractExtensionsFromQtiXml` and `QtiItemMetadata.searchMetadata` becomes `extensions`.

### Patch Changes

- @pie-qti/logger@1.0.0-beta.3

## 0.1.31

### Patch Changes

- @pie-qti/logger@1.0.0-beta.2

## 0.1.30

### Patch Changes

- @pie-qti/logger@1.0.0-beta.1

## 0.1.29

### Patch Changes

- @pie-qti/logger@1.0.0-beta.0

## 0.1.28

### Patch Changes

- @pie-qti/logger@0.1.28

## 0.1.27

### Patch Changes

- @pie-qti/logger@0.1.27

## 0.1.26

### Patch Changes

- ff00d31: pie-to-qti2 output now validates against the QTI 2.2 XSD and is scorable: generators match tag-named models through `config.elements`, place `prompt` inside the interaction, declare `SCORE` and `MAXSCORE` with response processing, export every interaction of a multi-interaction item, write rubrics as a `rubricBlock`, and re-serialize authored HTML as XML.
  
  Breaking for pie-to-qti2: the PIE item travels in a `.pie.json` sidecar listed under the item's package resource, in place of the embedded `pie:sourceModel` and `qti-metadata`, and the `pie-extension-embedder` exports are removed.
  
  Embedded sources are used only while the content beside them is unchanged: to-pie checks the sidecar's `qtiDigest` and warns `PIE_SOURCE_STALE` on a mismatch, and pie-to-qti2 regenerates QTI once a config no longer has the `configDigest` to-pie recorded. Sources written by earlier releases carry no digest and are treated as stale.
  
  to-pie keeps both the stem before an interaction and the interaction's `<prompt>`, and EBSR Part B gets the content between its two interactions. It removes QTI feedback it does not map, which rendered inside choice labels and prompts, and reports it as `QTI_FEEDBACK_DROPPED`. `validateQti` rejects XML that is not well-formed as a fatal error, also with `xsd: false`.
  
  Item `baseId` and `searchMetaData` are also written as IEEE LOM on the item's manifest resource, which to-pie reads back when no fresh sidecar is present. The manifest's `imsmd` prefix moves from `imsmd_v1p2` to the IEEE LOM namespace the QTI 2.2 packaging profile admits, and resource metadata keys other than `title`, `description` and `language` are no longer written. ims-cp-core's `parseManifest` reads resource title, description and language from prefixed LOM, in either binding, and from `general` only.
  
  The to-pie README no longer lists QTI 3.0 input, which is rejected.
- @pie-qti/logger@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/logger@0.1.25

## 0.1.24

### Patch Changes

- @pie-qti/logger@0.1.24

## 0.1.23

### Patch Changes

- @pie-qti/logger@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/logger@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/logger@0.1.21

## 0.1.20

### Patch Changes

- @pie-qti/logger@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/logger@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/logger@0.1.18

## 0.1.17

### Patch Changes

- 9b1e118: Derive the answer key, partial credit, item weight and choice layout from the QTI source
  instead of dropping them.

  Five conversion defects, each of which produced a PIE item that renders correctly and is
  therefore silently wrong. They were found by comparing `to-pie` against a batch loader
  that has been run over far more real publisher content than our conversion path has.

  **The answer key can live in `mapping`, and nine transformers did not look there.**
  `mapEntry` was consulted only in `drag-in-the-blank`, `ebsr` and `match-list`. This is
  plain QTI, not a vendor quirk: an item scored by the `map_response` template need not
  declare a `correctResponse` at all. Such an item converted with an _empty answer key_ —
  it rendered, but was unscorable and showed reviewers no key. A new
  `utils/response-scoring.ts` now supplies the fallback to `multiple-choice`,
  `inline-dropdown`, `placement-ordering`, `select-text`, `match`, `hotspot`,
  `explicit-constructed-response`, `image-cloze-association` and
  `associate-to-categorize`.

  Two rules keep the fallback safe and both are load-bearing:

  - **`correctResponse` always wins.** The mapping is read only when the declared key
    produced nothing, so a declared key is never overwritten.
  - **Only a strictly positive `mappedValue` marks a key correct.** Real Savvas content
    ships `<mapping defaultValue="-0" lowerBound="0" upperBound="0">` with _every_
    `mapEntry` at `mappedValue="0"` while the real key sits in `correctResponse`. An
    unsigned reading of those marks every listed choice correct. `drag-in-the-blank` only
    skipped negatives, so it admitted the zero-scoring case; `match-list` had no sign check
    at all.

  **`partialScoring` and item weight are now derived, not asked for.** `partialScoring` was
  a caller-supplied option that no caller in `registry/`, `plugin.ts`,
  `package-transformer.ts` or `source-profile-runtime.ts` ever set, so every converted item
  was all-or-nothing even when its source declared graded credit. `mapping/@upperBound` was
  read nowhere. A mapping's presence now implies partial scoring, and the weight resolves
  from `mapping/@upperBound`, then the `MAXSCORE` outcome declaration, then the summed
  positive `mapEntry` values, landing on `searchMetaData.maxScore`. The option remains as an
  explicit override.

  `@upperBound` is validated rather than handed to `Number()`. Observed values in the
  Region 10 / TEKSbank delivery include `"Max:3"` (`Number()` → `NaN`), `"0"` (parses, but
  is not a usable weight) and `"2 "` (must still parse as 2). Non-numeric and non-positive
  values are rejected and the next fallback is used.

  **Choice cardinality no longer trusts `maxChoices` alone.** It was
  `maxChoices === 1 ? 'radio' : 'checkbox'` with the attribute defaulted to `1` when
  absent, so a multi-answer item with a missing or wrong `maxChoices` became a single-select
  radio group that could not express its own answer key. `multiple-choice` and each `ebsr`
  part now switch to checkbox when more than one correct answer was found, independently of
  `maxChoices`. The `MC`/`MCA` `itemType` follows the resulting mode rather than repeating
  the same assumption. Cardinality is derived _after_ the answer key so a mapping-derived
  multi-answer key also triggers it.

  **`choiceInteraction/@orientation` is carried into the PIE choice layout.** It was read
  for `orderInteraction` and `sliderInteraction` but not `choiceInteraction`, so authored
  layout was silently dropped. `horizontal` and `vertical` pass through to `choicesLayout`;
  `grid` and `stacked` have no PIE equivalent and collapse onto a two-column grid
  (`choicesLayout: 'grid'`, `gridColumns: 2`). An absent orientation emits nothing, leaving
  the element's own default rather than pinning it to a guess. `pie-to-qti2` carries
  `choicesLayout` back out to `orientation` so the round trip is symmetric.

  **The hotspot player no longer guesses an image size.** `HotspotInteraction.svelte` fell
  back to `viewBox="0 0 800 600"` when the image's intrinsic dimensions were unknown.
  `hotspotChoice` coords are in the source image's pixel space, so that fallback does not
  degrade gracefully — it misplaces _every_ region, which reads as a content defect rather
  than the missing metadata it is. The overlay is now gated on known dimensions and an
  explanatory diagnostic is rendered instead (new
  `interactions.hotspot.unknownImageDimensions` message). The `to-pie` hotspot transform
  already failed loudly here; the player now agrees with it.

  27 conformance fixtures were added under
  `packages/to-pie/tests/fixtures/conversion-fidelity/` covering a mapping-only key per
  affected interaction type, mixed `mappedValue` signs, the all-zero-mapping precedence
  case, all three weight fallbacks plus both malformed `@upperBound` forms, both broken
  cardinality shapes, and every `orientation` value. The mapping-only shapes are
  synthesized: across 89,836 TEKSbank items every mapping-bearing response also declares a
  `correctResponse`, so no real item exercises the fallback.

  - @pie-qti/logger@0.1.17

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

- Updated dependencies [5a4e39a]
  - @pie-qti/logger@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/logger@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/logger@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
