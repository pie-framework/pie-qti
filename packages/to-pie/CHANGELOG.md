# @pie-qti/to-pie

## 0.1.29

### Patch Changes

- 19f62bf: Fix nested-section duplication in `transformAssessmentTest`: nested `<assessmentSection>` elements appeared both at the testPart top level and inside their parent's `subsections`, and the parent collected all descendant item refs. Sections now keep only their direct item refs, with nested sections appearing solely in `subsections`. Section-level `selection`, `ordering`, `timeLimits`, and `preCondition` are likewise read from direct children only. Adds `countAssessmentItems()` and uses it for the registry transform's `itemCount`.
- Updated dependencies [0d99546]
- Updated dependencies [32c08b7]
- Updated dependencies [0f93a03]
- Updated dependencies [a7c714e]
- Updated dependencies [0edef83]
- Updated dependencies [953e5d1]
  - @pie-qti/ims-cp-core@1.0.0-beta.0
  - @pie-qti/qti-common@1.0.0-beta.0
  - @pie-qti/ims-cp-node@1.0.0-beta.0
  - @pie-qti/transform-core@0.1.29
  - @pie-qti/transform-types@0.1.29

## 0.1.28

### Patch Changes

- 8fd28e3: Add a QTI 3.0 export: `targetVersion: '3.0'` on `PieToQtiPlugin` writes QTI 3.0 items, stimuli, tests and content packages, with catalogs as `qti-catalog-info`. `@pie-qti/qti-common` gains `convertQti2ToQti3` and `writeQtiCatalogInfo`; `@pie-qti/to-pie` reads the export back, unwrapping `qti-content-body` and resolving a stimulus reference by its PIE passage id.
- Updated dependencies [6af3354]
- Updated dependencies [8fd28e3]
  - @pie-qti/qti-common@0.1.28
  - @pie-qti/transform-core@0.1.28
  - @pie-qti/ims-cp-core@0.1.28
  - @pie-qti/ims-cp-node@0.1.28
  - @pie-qti/transform-types@0.1.28

## 0.1.27

### Patch Changes

- 498b1e2: An APIP link to an element whose `data-catalog-idref` already names that access element no longer wraps the element's content in a second idref.
- Updated dependencies [498b1e2]
  - @pie-qti/qti-common@0.1.27
  - @pie-qti/transform-core@0.1.27
  - @pie-qti/ims-cp-core@0.1.27
  - @pie-qti/ims-cp-node@0.1.27
  - @pie-qti/transform-types@0.1.27

## 0.1.26

### Patch Changes

- ff00d31: pie-to-qti2 output now validates against the QTI 2.2 XSD and is scorable: generators match tag-named models through `config.elements`, place `prompt` inside the interaction, declare `SCORE` and `MAXSCORE` with response processing, export every interaction of a multi-interaction item, write rubrics as a `rubricBlock`, and re-serialize authored HTML as XML.
  
  Breaking for pie-to-qti2: the PIE item travels in a `.pie.json` sidecar listed under the item's package resource, in place of the embedded `pie:sourceModel` and `qti-metadata`, and the `pie-extension-embedder` exports are removed.
  
  Embedded sources are used only while the content beside them is unchanged: to-pie checks the sidecar's `qtiDigest` and warns `PIE_SOURCE_STALE` on a mismatch, and pie-to-qti2 regenerates QTI once a config no longer has the `configDigest` to-pie recorded. Sources written by earlier releases carry no digest and are treated as stale.
  
  to-pie keeps both the stem before an interaction and the interaction's `<prompt>`, and EBSR Part B gets the content between its two interactions. It removes QTI feedback it does not map, which rendered inside choice labels and prompts, and reports it as `QTI_FEEDBACK_DROPPED`. `validateQti` rejects XML that is not well-formed as a fatal error, also with `xsd: false`.
  
  Item `baseId` and `searchMetaData` are also written as IEEE LOM on the item's manifest resource, which to-pie reads back when no fresh sidecar is present. The manifest's `imsmd` prefix moves from `imsmd_v1p2` to the IEEE LOM namespace the QTI 2.2 packaging profile admits, and resource metadata keys other than `title`, `description` and `language` are no longer written. ims-cp-core's `parseManifest` reads resource title, description and language from prefixed LOM, in either binding, and from `general` only.
  
  The to-pie README no longer lists QTI 3.0 input, which is rejected.
- af8ee10: `QtiSectionDiagnosticSource` names diagnostics a host contributes `'host'`. Breaking: a host emitting the previous host-specific source value switches to `'host'`. The select-point rejection message now says PIE has no element for selecting a point on an image.
- cd85c07: Require `adm-zip` 0.6.1 and `image-size` 2.0.4, which fall outside their published security advisories.
- 34c0034: Read the PNP as a per-candidate AfA PNP 3.0 profile. `parsePnpXml` now parses an `access-for-all-pnp` document, `parseAfaPnpXml` returns its whole record and `pnpProfileFromAfa` maps a record onto `PnpProfile`. to-pie no longer emits `personalNeedsProfile` for an assessmentTest and warns `QTI_PNP_IN_CONTENT` instead; the `PersonalNeedsProfile` type is removed.
- 0307016: to-pie exports its QTI 3.0 normalization: `normalizeQti3ToQti2`, its three steps (`normalizeQti3Lexically`, `relocateQti3PromptIntoInteraction`, `demoteMisplacedQti3Prompts`), `isQti3Document` and `unsupportedQti3Construct`, so a caller that validates or reports on a QTI 3.0 document judges the shape the conversion consumes.
- 9e96848: to-pie recognizes an interaction under a namespace prefix and in any case. A prefixed portable custom interaction or prefixed interaction beside a standard one refuses the item, where it used to convert the standard interaction alone and drop the other without warning. A lowercase-authored QTI 2.2 interaction converts through its handler, and custom-interaction evidence reads the PCI type identifier in its QTI 2.2 and QTI 3.0 spellings.
- 5627ce1: to-pie converts QTI 3.0 items, stimuli and tests: `normalizeQti3ToQti2` renames them into the QTI 2.2 vocabulary at the entry point, a vendor transformer still sees the authored document, and a portable custom interaction stays rejected. QTI 3.0 catalogs, APIP access elements and inline SSML become PIE accessibility catalogs keyed by `data-catalog-idref`, companion materials land in `metadata.companionMaterials`, and anything not carried warns `QTI_ACCESSIBILITY_NOT_CARRIED`. Passages convert once per stimulus document through `convertQtiPassageDocument` and come out of the package transform beside the items, prompts keep only the stem, and an unresolvable passage reference warns `QTI_PASSAGE_UNRESOLVED`. `PieAssessment` drops `accessibilityCatalogs` and `stimulusRefs` along with the `StimulusRef` type, and its sections carry `rubricBlocks` in the PIE players' `RubricBlock` shape in place of `rubricRefs`. qti-common exports `QTI3_ATTRIBUTE_TO_QTI2` and `QTI2_PROMPT_BEARING_INTERACTIONS`.
- Updated dependencies [ff00d31]
- Updated dependencies [5627ce1]
  - @pie-qti/transform-types@0.1.26
  - @pie-qti/ims-cp-core@0.1.26
  - @pie-qti/qti-common@0.1.26
  - @pie-qti/transform-core@0.1.26
  - @pie-qti/ims-cp-node@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/transform-core@0.1.25
  - @pie-qti/ims-cp-core@0.1.25
  - @pie-qti/ims-cp-node@0.1.25
  - @pie-qti/transform-types@0.1.25

## 0.1.24

### Patch Changes

- @pie-qti/transform-core@0.1.24
  - @pie-qti/ims-cp-core@0.1.24
  - @pie-qti/ims-cp-node@0.1.24
  - @pie-qti/transform-types@0.1.24

## 0.1.23

### Patch Changes

- 20bcefa: Clear all 32 Dependabot advisories on the default branch.
  
  Thirty of them were stale nested lockfile resolutions. Every affected range already
  admitted its fix, but `bun update` refuses to move a nested entry that still satisfies
  its parent's range, so the lockfile was regenerated: `minimatch` 5.1.6 to 5.1.9 and
  9.0.5 (dropped, now shares the hoisted 10.2.6), `picomatch` 2.3.1 to 2.3.2 and 4.0.3 to
  4.0.5, `brace-expansion` 2.0.2 to 2.1.4 and 5.0.5 (dropped), `js-yaml` 3.14.2 to 3.15.1
  and 4.1.1 to 4.3.1, `fast-uri` 3.1.0 to 3.1.5. The regeneration also collapses seven
  duplicate subtrees, which is most of the 519-line lockfile reduction.
  
  `cookie` needed a root `overrides` entry. `@sveltejs/kit` declares `^0.6.0` and still
  does at 2.70.2, its latest, so no upgrade reaches 0.7.0. Kit imports only `parse` and
  `serialize`, both signature-compatible, and the override is pinned to 0.7.2. Bun ignores
  nested `resolutions`, so a flat override is the only mechanism available; it is safe here
  because `cookie` has exactly one copy in the tree.
  
  `image-size` has no upstream fix — 2.0.2 is current and both advisories name it. They are
  reachable: `to-pie` measures images out of ingested QTI packages, so a crafted `.icns` or
  `.heic` in a package hangs the converter's event loop. The first measurement in a process
  applies `disableTypes(['heif', 'icns', 'jxl', 'jxl-stream'])`, which rejects those formats
  during detection before the looping `calculate()` runs; the `validate()` functions still
  reached are loop-free. That call mutates image-size's own module state, so it is deferred to
  first use rather than run at import: importing `@pie-qti/to-pie` must not silently change
  what an unrelated image-size caller in the same process can measure. Detection failures for
  a disabled or unrecognised format no longer log as errors, since callers already treat an
  unmeasured image as having no dimensions. The two alerts stay open until upstream patches,
  and the disabled list is the thing to shorten when it does.
- @pie-qti/transform-core@0.1.23
  - @pie-qti/ims-cp-core@0.1.23
  - @pie-qti/ims-cp-node@0.1.23
  - @pie-qti/transform-types@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/ims-cp-core@0.1.22
- @pie-qti/ims-cp-node@0.1.22
- @pie-qti/transform-core@0.1.22
- @pie-qti/transform-types@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/ims-cp-core@0.1.21
- @pie-qti/ims-cp-node@0.1.21
- @pie-qti/transform-core@0.1.21
- @pie-qti/transform-types@0.1.21

## 0.1.20

### Patch Changes

- @pie-qti/ims-cp-core@0.1.20
- @pie-qti/ims-cp-node@0.1.20
- @pie-qti/transform-core@0.1.20
- @pie-qti/transform-types@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/ims-cp-core@0.1.19
- @pie-qti/ims-cp-node@0.1.19
- @pie-qti/transform-core@0.1.19
- @pie-qti/transform-types@0.1.19

## 0.1.18

### Patch Changes

- Updated dependencies [bd51a94]
  - @pie-qti/ims-cp-node@0.1.18
  - @pie-qti/ims-cp-core@0.1.18
  - @pie-qti/transform-core@0.1.18
  - @pie-qti/transform-types@0.1.18

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

- 76311bb: Update the third-party runtime dependencies that ship to consumers.

  **`node-html-parser` moves from `^6.1.13`/`^7.0.x` to `^9.0.1`.** This affects
  `transform-core`, `to-pie`, `item-player`, `test-utils`, `demo-vendor-extensions`,
  `assessment-player`, `ims-cp-core`, `pie-to-qti2` and `transform-cli`.

  Worth knowing if you resolve `node-html-parser` yourself: five of those packages name it in
  their published type declarations rather than wrapping it — `transform-core`, `to-pie`,
  `item-player`, `test-utils` and `demo-vendor-extensions` all emit
  `import type { HTMLElement } from 'node-html-parser'` into their `.d.ts`, so the parser's
  own types are part of their public surface and this jump crosses three majors.

  If you exchange parsed elements with those packages, move to `9.x`. Pinning an older major
  leaves two copies of `HTMLElement` in the type graph, and structurally incompatible ones
  will not assign to each other. Consumers that only pass QTI strings in and take converted
  output back out are unaffected.

  **`katex` moves from `^0.16.27` to `^0.18.1`** in `typeset-katex`, **`mathlive` from
  `^0.108.2` to `^0.110.0`** in `item-player` and `default-components`, and
  **`@tiptap/core` from `^3.15.3` to `^3.29.2`** in `default-components`. None of these
  appear in published declarations. Applications that load their own copy of KaTeX or
  MathLive alongside ours should still check the pairing, since both ship stylesheets and
  fonts.

  All publishable packages release as one fixed-version set, so the whole set moves together.

- Updated dependencies [9b1e118]
- Updated dependencies [76311bb]
  - @pie-qti/transform-types@0.1.17
  - @pie-qti/transform-core@0.1.17
  - @pie-qti/ims-cp-core@0.1.17
  - @pie-qti/ims-cp-node@0.1.17

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

- 9c6d374: Update `adm-zip` and `uuid` to versions without published advisories.

  - `@pie-qti/storage`: `adm-zip` `^0.5.16` → `^0.6.0` (CVE-2026-39244, high — a crafted
    ZIP can trigger a 4 GB memory allocation). This is the one with real exposure here:
    `storage/src/zip-extractor.ts` extracts untrusted QTI content packages. Its
    pre-extraction limits (100 MB compressed, 250 MB uncompressed, 1000 entries, ratio 200)
    check sizes advertised in the central directory, so they reduce but do not necessarily
    prevent an allocation made while the archive itself is parsed.
  - `@pie-qti/to-pie`, `@pie-qti/pie-to-qti2`: `uuid` `^10.0.0` → `^11.1.1`
    (CVE-2026-41907, moderate).
  - `@pie-qti/demo-vendor-extensions`: `uuid` `^11.0.5` → `^11.1.1`. This resolved to
    `uuid@11.1.0`, which is also below the patched version, and was not covered by an
    advisory alert.

  The `uuid` advisory concerns a missing buffer bounds check in `v3`/`v5`/`v6` when a `buf`
  argument is supplied. Every call site in this repository uses `v4()` with no arguments,
  so it was not reachable; these bumps clear the advisory rather than fix an exploitable
  path.

  Also drops `@types/uuid` from `to-pie` and `pie-to-qti2`. It is a deprecated stub
  ("uuid provides its own type definitions, so you do not need this installed") and was
  pinned at `^10.0.0`, one major behind the runtime package whose bundled types it shadowed.

  Both dependencies are external to the published bundles — consumers resolve them from
  their own `node_modules` — so the updated ranges reach consumers directly.

- Updated dependencies [3c56bd9]
- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
  - @pie-qti/ims-cp-node@0.1.16
  - @pie-qti/ims-cp-core@0.1.16
  - @pie-qti/transform-core@0.1.16
  - @pie-qti/transform-types@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/ims-cp-node@0.1.15
  - @pie-qti/transform-core@0.1.15
  - @pie-qti/transform-types@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/ims-cp-core@0.1.14
- @pie-qti/ims-cp-node@0.1.14
- @pie-qti/transform-core@0.1.14
- @pie-qti/transform-types@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.13
  - @pie-qti/ims-cp-node@0.1.13
  - @pie-qti/transform-core@0.1.13
  - @pie-qti/transform-types@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/ims-cp-core@0.1.12
- @pie-qti/ims-cp-node@0.1.12
- @pie-qti/transform-core@0.1.12
- @pie-qti/transform-types@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.11
  - @pie-qti/ims-cp-node@0.1.11
  - @pie-qti/transform-core@0.1.11
  - @pie-qti/transform-types@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.10
  - @pie-qti/ims-cp-node@0.1.10
  - @pie-qti/transform-core@0.1.10
  - @pie-qti/transform-types@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.9
  - @pie-qti/ims-cp-node@0.1.9
  - @pie-qti/transform-core@0.1.9
  - @pie-qti/transform-types@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.8
  - @pie-qti/ims-cp-node@0.1.8
  - @pie-qti/transform-core@0.1.8
  - @pie-qti/transform-types@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.7
  - @pie-qti/ims-cp-node@0.1.7
  - @pie-qti/transform-core@0.1.7
  - @pie-qti/transform-types@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.6
  - @pie-qti/ims-cp-node@0.1.6
  - @pie-qti/transform-core@0.1.6
  - @pie-qti/transform-types@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.5
  - @pie-qti/ims-cp-node@0.1.5
  - @pie-qti/transform-core@0.1.5
  - @pie-qti/transform-types@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.4
  - @pie-qti/ims-cp-node@0.1.4
  - @pie-qti/transform-core@0.1.4
  - @pie-qti/transform-types@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.3
  - @pie-qti/ims-cp-node@0.1.3
  - @pie-qti/transform-core@0.1.3
  - @pie-qti/transform-types@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.2
  - @pie-qti/ims-cp-node@0.1.2
  - @pie-qti/transform-core@0.1.2
  - @pie-qti/transform-types@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/transform-core@0.1.1
  - @pie-qti/transform-types@0.1.1
