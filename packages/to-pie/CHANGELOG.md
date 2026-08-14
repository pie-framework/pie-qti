# @pie-qti/to-pie

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
