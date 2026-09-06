# @pie-qti/default-components

## 0.1.24

### Patch Changes

- Update the rich text editor and its Tiptap extensions together to 3.31.0, preserving a single compatible editor core and command registry.
- e532f4f: Provide visible move controls for ordering and select-then-place actions for matching, gap matching, and graphic gap matching, with instructions in all supported locales. Preserve keyboard and drag interaction paths.
- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.
- Updated dependencies [5c8a8e8]
- Updated dependencies [080f254]
- Updated dependencies [e532f4f]
- Updated dependencies [67e4c23]
  - @pie-qti/qti-common@0.1.24
  - @pie-qti/i18n@0.1.24
  - @pie-qti/item-player@0.1.24

## 0.1.23

### Patch Changes

- d476546: Make PCI deliverable, and rebuild a module on authoritative restore.
  
  `createAllowlistPciModuleResolver({ allowedOrigins, allowedPathPrefixes })` is a
  new export from `@pie-qti/item-player`. PCI execution previously required every
  host to write the security-critical resolver itself, so in practice no deployment
  ran a PCI at all. The secure default is unchanged — a host must still pass a
  resolver, and doing so is still a trust decision — but the origin and prefix check
  now ships reviewed. Prefixes match the normalized URL so traversal cannot escape
  them, non-http(s) schemes are refused outright, and an empty allow-list is a
  construction error rather than a silent deny-all. Note that `PciConfiguration.baseUrl`
  is where authored relative paths resolve, so it has to fall inside the allow-list
  itself.
  
  `PciHost.restore()` no longer calls `module.setResponse` on a mounted module that
  has a rebuild path. It fires the new `onRemountRequest` signal; the renderer resets
  the sanitized scaffold, calls `remount(dom)` — which discards the previous
  instance, resolves a fresh one, and seeds the restored value — and returns focus
  into the rebuilt scaffold, since replacing the scaffold destroys whatever the
  candidate had focused. Discarding in-progress candidate state is what
  re-instantiation means, and it is the only form the QTI 3.0 PCI contract offers,
  since state is injected at `getInstance` and there is no setter.
  
  Two consequences of that being asynchronous and renderer-driven. `getResponse()`
  reports the restored value for as long as a requested rebuild has not landed,
  because until it does the mounted module still holds the superseded one. And a host
  that drives `PciHost` directly, with nothing subscribed to `onRemountRequest`, gets
  the value pushed into the module instead — mutation rather than a discard, which is
  the most a caller owning no scaffold can do, and it keeps reset-to-default and
  session restore effective there. Before mount, `restore()` still just holds the
  value for `initialize()`.
  
  `PciHostController` gains `onRemountRequest` and `remount`.
- 2fd7a31: Give a mounted PCI module ownership of its own response.
  
  Every candidate change reaches `Player.setResponses`, a PCI module's own reports
  included, and that pushed straight back into the module with no dirty check — so
  each reported response was immediately handed back, rebuilding whatever internal
  state the module derived from it. The renderer's reactive `response` prop carried
  a second copy of the same loop.
  
  `PciHost.setResponse` is replaced by `offerResponse(value)`, which offers a value
  and returns `false` once the module has reported a response of its own, and
  `restore(value)`, which replaces the response authoritatively and returns
  ownership to the player. Session deserialization and reset-to-default use
  `restore()`; ordinary traffic uses `offerResponse()`. `offerResponse` is named for
  what it does — the value may be declined — and avoids colliding with Svelte's
  sense of "hydrate".
  
  `Player.setPciResponse` is likewise replaced by `offerPciResponse` and
  `restorePciResponse`, and `PciHostController` gains `offerResponse`/`restore` in
  place of `setResponse`. `Player.setResponses` keeps its single-argument signature;
  callers needing the authoritative path use the new `Player.restoreResponses`
  rather than an options flag. PCI execution still requires a host-supplied
  `moduleResolver`, so no delivery that runs today changes behavior.
- Updated dependencies [d476546]
- Updated dependencies [2fd7a31]
  - @pie-qti/item-player@0.1.23
  - @pie-qti/i18n@0.1.23
  - @pie-qti/qti-common@0.1.23

## 0.1.22

### Patch Changes

- 3aec4b3: Make the published i18n package loadable outside Vite. `DefaultI18nProvider` resolved locale
  catalogs through `import.meta.glob`, a compile-time Vite macro, but the package builds with plain
  `tsc` — so the macro shipped verbatim to npm and any consumer on webpack, esbuild, Rollup, Node or
  plain browser ESM threw `TypeError: import.meta.glob is not a function` merely importing the
  provider. Locales now resolve through an explicit map of dynamic `import()` calls, one entry per
  locale, which `tsc` emits untouched and bundlers still code-split per locale. en-US is a static
  import, since it backs every fallback and must be resolvable synchronously in the constructor. The
  bare `process.env.NODE_ENV` on the missing-key path is guarded too; it raised
  `ReferenceError: process is not defined` in a plain browser.

  Select plural forms with `Intl.PluralRules` instead of a hardcoded `one`/`other` split. Arabic
  defines zero/one/two/few/many/other for every plural key and none but `one` and `other` were
  reachable, so Arabic counts of 2, of 3–10 and of 11–99 all rendered the wrong grammatical form. The
  category now comes from the active locale, with a fallback to `.other` for locales whose catalog
  does not define it, and a fallback to the `one`/`other` split for a locale tag `Intl.PluralRules`
  rejects.

  Convert the ICU MessageFormat strings in the `transform.*` namespace to the package's plural-key
  convention across all eight locales. The runtime interpolates `{name}` only and never parsed ICU, so
  strings like `'{count, plural, one {# item} other {# items}}'` would have rendered their own source
  text to users. `transform.transformed.summary` interleaved two independent counts and is now
  `summary`/`summaryWithAssessments` plus `summaryItems`/`summaryAssessments`, composed by the caller;
  the participle moved inside the pluralized phrase in es-ES, fr-FR and ro-RO, where it agrees with
  the item count. Singular forms in those three locales previously carried a plural participle from
  the ICU suffix and are now correct. `check-translations` recognises plural-category leaves anywhere
  a plural sub-object lives rather than only under `plurals.*`, gated on en-US defining the same
  parent.

  Stop `t()` returning a catalog object. A key landing on a namespace branch (`t('common')`) or a
  plural sub-object resolved to the object itself, which reached callers where a string was expected
  and threw from `String.prototype.replace` as soon as interpolation values were passed. Such a key is
  now a miss and returns the key or the supplied default.

  Test `DefaultI18nProvider` itself. The suite previously defined its own provider to avoid the
  `import.meta.glob` load failure, so the shipped class was never instantiated: the fallback chain,
  custom-message priority, `addCustomMessages` deep merge, `loadLocale` caching and rejection,
  `localStorage` restore-on-construct and `plural()` had no coverage, and the mock diverged from
  production by dropping unmatched interpolation placeholders. 59 tests now bind to the real class,
  including every `plurals.*` key across all eight locales and an assertion that no catalog contains
  an ICU argument.

  Fix the `LocaleSwitcher` reference component, which the PRD invites hosts to copy but `tsconfig.json`
  excluded from compilation, so none of its defects surfaced: `I18nProvider` was imported from
  `core/types`, which does not export it; the `availableLocales` prop default referenced a `const`
  declared below it, a temporal-dead-zone `ReferenceError` whenever the prop was omitted; and the
  usage docblock named a `createI18n` export and a `@pie-qti/i18n/components` subpath that do not
  exist. A `check` script now runs `svelte-check` over the component so the reference stays valid, and
  zh-CN joins the default locale list.

  Add right-to-left support, which blocked ar-SA independently of the plural bug — nothing in the
  source wrote `dir` anywhere. `getDirection()` returns the writing direction of the active locale from
  `Intl.Locale.prototype.textInfo`, falling back to a primary-subtag list for engines that lack it, and
  the item body root now reflects it as `dir` alongside `lang`. `direction` is an inherited CSS
  property, so that one attribute reaches interaction components inside shadow roots with no
  per-component wiring; the host page's own chrome is untouched, since the player publishes direction
  for its own subtree only. Both evals in `docs/evals/i18n/rtl-support/evals.yaml` finally have an
  implementation to run against.

  Let a host set the locale declaratively: `<pie-qti-item-player locale="ar-SA">`. `observedAttributes`
  carried no locale, so locale was reachable only as a JS property — impossible to express in markup or
  in a server-rendered page. The attribute resolves through a new `I18nProvider.withLocale()`, which
  returns a view sharing catalogs and loaded-locale bookkeeping by reference, rather than through
  `setLocale()`, which would mutate a provider shared with the rest of the page and, on
  `SvelteI18nProvider`, reload the document. Two players on one page can now render different locales
  from one provider, and a second locale is still parsed only once. The reload path stays as the
  default for a host-driven switch.

  Declare `@pie-qti/i18n` as an optional `peerDependency` rather than a `dependency` of
  default-components, item-player, section-player and assessment-player. Every import of it in those
  packages is `import type` and none of their built JavaScript references it, so a host that never
  constructs a provider should not be made to install it. It stays a `devDependency` so the workspace
  resolves the types locally.

- ba84656: Move the build toolchain to vite 8.2.1, clearing seven advisories.

  vite 8.0.10 is covered by advisories against `>=8.0.0 <=8.0.15`, and it carried
  `postcss@8.5.12` (`<=8.5.22`), `nanoid@3.3.11` (`<3.3.18`) and `rollup@4.55.1`
  (`<4.59.0`) underneath it. `bun audit` goes from 39 advisories to 32, and from 30 high to 25.

  Four packages declared a caret range that already admitted the fix and only needed the
  lockfile moved; `default-components` pinned `8.0.10` exactly, matching its house style for
  devDependencies, so that pin is now `8.2.1`.

  The last old copy was `vitest`'s own nested `vite`. vitest 4.1.10 is current and its range
  (`^6 || ^7 || ^8`) admits 8.2.1 — the lockfile was simply holding a stale nested
  resolution that neither `bun update` nor `bun install --force` re-resolves, so that entry
  was dropped and reinstalled.

  Vite is a devDependency in all three packages, so nothing about the published output
  changes; this is recorded as a patch so the advisory fix appears in the changelog.

- Updated dependencies [3aec4b3]
- Updated dependencies [ba84656]
  - @pie-qti/i18n@0.1.22
  - @pie-qti/item-player@0.1.22
  - @pie-qti/qti-common@0.1.22

## 0.1.21

### Patch Changes

- 8836ebf: Keep integer arithmetic integer-typed in processing. Per QTI 2.2 `sum`, `subtract`, `product`,
  `max` and `min` yield an integer when every sub-expression is an integer, and a variable holds
  values of its declared base-type. Both were widened to float, and because `match` is base-type
  strict, a template variable such as `ANSWER = sum(A, B)` declared `baseType="integer"` stopped
  matching an integer `RESPONSE` — a correct answer scored 0. Assignments now conform to the
  declaration's numeric base-type; a fractional value assigned to an integer declaration is left
  alone so the authoring error still surfaces.

  Hide `positionObjectStage` from the item body. The stage owns the background object and wraps its
  interactions, all of which the component renders, so matching only the interaction inside it left
  the background image drawn a second time above the interaction.

  Stop the rich-text editor reporting editability changes as content edits. Tiptap's
  `setEditable(editable, emitUpdate = true)` emits `update` with an empty transaction, so toggling
  `editable` looked like a learner edit to the host; `onUpdate` now requires `transaction.docChanged`
  and the editability sync passes `emitUpdate: false`.

  Pin the `@pie-players/*` toolkit dependencies to one version. They share a `pie-context`
  singleton, so bumping a single member installs two copies and the section player's toolbar icons
  stop resolving. Moving the set to 0.3.65 additionally needs code changes, as it no longer exports
  `createPackagedToolRegistry`.

- Updated dependencies [8836ebf]
- Updated dependencies [2c00bd1]
  - @pie-qti/item-player@0.1.21
  - @pie-qti/i18n@0.1.21
  - @pie-qti/qti-common@0.1.21

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
