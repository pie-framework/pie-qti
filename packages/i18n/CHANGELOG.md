# @pie-qti/i18n

## 0.1.24

### Patch Changes

- 080f254: Render readable assessment labels before host translations finish loading, and adopt a later context provider without restarting the attempt. Explicitly configured providers continue to take precedence.
- e532f4f: Provide visible move controls for ordering and select-then-place actions for matching, gap matching, and graphic gap matching, with instructions in all supported locales. Preserve keyboard and drag interaction paths.

## 0.1.23

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

## 0.1.21

## 0.1.20

## 0.1.19

## 0.1.18

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

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
