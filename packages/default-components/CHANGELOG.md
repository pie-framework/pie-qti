# @pie-qti/default-components

## 0.1.20

### Patch Changes

- 1cd0aff: Introduce immutable assessment-item definitions and one authoritative live `ItemSession` across
  assessment, section, custom-element, and standalone rendering. Finalize item-body and interaction
  content at their delivery boundaries, seal definition-time extension registries, and expose typed,
  immutable presentation and session contracts.

  This intentionally changes the assessment-to-section composition API, the player-element session
  property, and item-player plugin/presentation contracts. Obsolete snapshot-driven assessment
  rendering component exports are removed. Direct `Player` and managed lifecycle compatibility
  entries are removed; consumers migrate to the definition/session interface. Server scoring uses the
  DOM-free `createAssessmentItemDefinition()` export from
  `@pie-qti/item-player/server` and dispatches item-session commands. Item-player custom elements now
  publish notifications only through typed DOM events, and standard extractor implementations and
  refactor-era interaction compatibility barrels are no longer part of the package interface.

- Updated dependencies [1cd0aff]
  - @pie-qti/item-player@0.1.20
  - @pie-qti/qti-common@0.1.20
  - @pie-qti/i18n@0.1.20

## 0.1.19

### Patch Changes

- Updated dependencies [ffe996d]
  - @pie-qti/item-player@0.1.19
  - @pie-qti/i18n@0.1.19
  - @pie-qti/qti-common@0.1.19

## 0.1.18

### Patch Changes

- Updated dependencies [2ebee31]
  - @pie-qti/item-player@0.1.18
  - @pie-qti/i18n@0.1.18
  - @pie-qti/qti-common@0.1.18

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
  - @pie-qti/i18n@0.1.17
  - @pie-qti/item-player@0.1.17
  - @pie-qti/qti-common@0.1.17

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

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.
- f4655e6: Apply the QTI `shuffle` attribute with a session-seeded Fisher-Yates shuffle.

  `shuffle` was parsed for `choiceInteraction`, `orderInteraction`, `matchInteraction`,
  `associateInteraction`, `gapMatchInteraction` and `inlineChoiceInteraction`, but only
  `orderInteraction` acted on it — and that implementation was effectively a no-op. It
  seeded a non-iterated LCG from a sum of the `responseIdentifier`'s character codes; a
  ±1 seed change moved the generator's output by less than one bucket width, so across
  600 realistic identifiers it produced 3 distinct permutations out of 720, one of them
  83% of the time. The character-code sum also collided on anagrams (`"AB"`/`"BA"`).

  Shuffling now happens once at extraction time for all six interactions, using
  `createSeededRng` (mulberry32) seeded from an FNV-1a hash of the item session GUID and
  the `responseIdentifier`:

  - Different candidates and different attempts get different orders, so `shuffle` again
    serves its purpose of reducing position bias and answer copying. Previously every
    candidate saw the same order for a given item.
  - The order is stable for the whole session, including across re-renders and reloads,
    because `Player` already persists and restores the session GUID — no new session
    field was required.
  - `fixed="true"` choices keep their authored index and only the remaining choices are
    permuted around them. This was previously extracted but ignored.
  - `matchInteraction`'s two sets are shuffled independently.

  `OrderInteraction.svelte` no longer shuffles: doing so on top of the extraction-time
  shuffle would re-order on every re-render.

  Interaction PRDs have been corrected — several claimed "✅ Full … shuffles at
  extraction time" when no shuffling occurred, and claimed `fixed` was not extracted when
  it was.

- Updated dependencies [3c56bd9]
- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
- Updated dependencies [f4655e6]
  - @pie-qti/item-player@0.1.16
  - @pie-qti/i18n@0.1.16
  - @pie-qti/qti-common@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15

## 0.1.14

### Patch Changes

- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
  - @pie-qti/item-player@0.1.14
  - @pie-qti/i18n@0.1.14
  - @pie-qti/qti-common@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.13
  - @pie-qti/item-player@0.1.13
  - @pie-qti/qti-common@0.1.13

## 0.1.12

### Patch Changes

- abe0be5: Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

  `loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

  `@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.

- Updated dependencies [abe0be5]
  - @pie-qti/item-player@0.1.12
  - @pie-qti/i18n@0.1.12
  - @pie-qti/qti-common@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.11
  - @pie-qti/item-player@0.1.11
  - @pie-qti/qti-common@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.10
  - @pie-qti/item-player@0.1.10
  - @pie-qti/qti-common@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.9
  - @pie-qti/item-player@0.1.9
  - @pie-qti/qti-common@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.8
  - @pie-qti/item-player@0.1.8
  - @pie-qti/qti-common@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.7
  - @pie-qti/item-player@0.1.7
  - @pie-qti/qti-common@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.6
  - @pie-qti/item-player@0.1.6
  - @pie-qti/qti-common@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.5
  - @pie-qti/item-player@0.1.5
  - @pie-qti/qti-common@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.4
  - @pie-qti/item-player@0.1.4
  - @pie-qti/qti-common@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.3
  - @pie-qti/item-player@0.1.3
  - @pie-qti/qti-common@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.2
  - @pie-qti/item-player@0.1.2
  - @pie-qti/qti-common@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/item-player@0.1.1
