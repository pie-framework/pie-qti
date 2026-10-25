# @pie-qti/assessment-player

## 1.0.0-beta.2

### Patch Changes

- d8f9b4d: Accessible names, live-region announcements and visible interaction text now come from the catalog in every locale, built from whole-phrase keys, and a plain-language count uses CLDR plural rules. Escape handlers in the math editor and glossary popups ignore keys an input method editor is composing, and text-entry and extended-text inputs take `dir="auto"`. `@pie-qti/i18n` exports `translate`, `translatePlural`, `joinSentences`, `formatList` and `isImeComposing`, and `@pie-qti/default-components` now depends on `@pie-qti/i18n` directly.
- 5dbabcc: Content and interface direction are now separate: player chrome takes `lang` and `dir` from the interface locale, while the item body, passages, rubrics and modal feedback take them from the content's `xml:lang`, and content that declares no language inherits the chrome's. Nested `xml:lang` spans get a `dir` where their direction differs from the surrounding text. `@pie-qti/i18n` exports `languageDirection`, `canonicalLanguageTag`, `contentLanguageAttributes` and `interfaceLocaleAttributes`, and `@pie-qti/section-player` now depends on `@pie-qti/i18n` directly.
- d0e249b: Locales negotiate by language to catalogs keyed `en`, `ar`, `es`, `fr`, `nl`, `ro`, `th` and `zh-Hans` (the old regional codes stay valid inputs, the `./locales/*` file names follow the new keys), and both players default to an English provider. The package no longer reads a stored locale: hosts relying on the provider restoring its stored locale and reloading the page must now opt in with `persistLocale` and `reloadOnLocaleChange` and read the key at startup.
- e874155: Number and date formatting pins digits to a CLDR 48 table and the Gregorian calendar, and interpolated counts and the assessment timer follow it. A `-u-nu-` or `-u-ca-` extension on the locale overrides either.
- 572c3d3: Add `pseudoLocalize` with the `en-XA` and `ar-XB` pseudo-locales, and a physical-direction CSS check in `check:i18n`. Interaction and chrome markup that still used `ml-*`, `mr-*` and `right-*` utilities now uses their logical forms, so it mirrors under right-to-left locales.
- 67d94ee: Player chrome and interaction layout use logical CSS properties, so they mirror under `dir="rtl"`, and horizontal order lists move items with the arrow keys in the inline direction. `AssessmentTimer` accepts `top-end`/`top-start`/`bottom-end`/`bottom-start` and defaults to `top-end`; the physical values keep working.
- Updated dependencies [d8f9b4d]
- Updated dependencies [5dbabcc]
- Updated dependencies [d0e249b]
- Updated dependencies [e874155]
- Updated dependencies [a202037]
- Updated dependencies [572c3d3]
- Updated dependencies [67d94ee]
- Updated dependencies [cf99206]
- Updated dependencies [dba1477]
  - @pie-qti/i18n@1.0.0-beta.2
  - @pie-qti/default-components@1.0.0-beta.2
  - @pie-qti/item-player@1.0.0-beta.2
  - @pie-qti/qti-common@1.0.0-beta.2
  - @pie-qti/section-player@1.0.0-beta.2
  - @pie-qti/qti-processing@1.0.0-beta.2
  - @pie-qti/assessment-toolkit@1.0.0-beta.2
  - @pie-qti/ims-cp-core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [66f5281]
  - @pie-qti/default-components@1.0.0-beta.1
  - @pie-qti/section-player@1.0.0-beta.1
  - @pie-qti/assessment-toolkit@1.0.0-beta.1
  - @pie-qti/i18n@1.0.0-beta.1
  - @pie-qti/ims-cp-core@1.0.0-beta.1
  - @pie-qti/item-player@1.0.0-beta.1
  - @pie-qti/qti-common@1.0.0-beta.1
  - @pie-qti/qti-processing@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- eca64c2: Accept a deterministic clock in the assessment player config (`now`), so hosts and tests can drive time-limit tracking from their own timeline. Timing behavior is unchanged when the option is unset.
- 0d99546: Consolidate the assessment discovery pre-scan with the backend model's scan primitives.
  
  `@pie-qti/assessment-player` now exports `toCanonicalQtiName` and `@pie-qti/ims-cp-core` exports `hasUnsafeEncodedPathToken`, and the player-elements discovery parser reuses both instead of private copies, so QTI 2.x/3.0 name mapping and encoded-path safety cannot drift between the element pre-pass and the authoritative parse. The discovery parser's role (bounded pre-fetch, early depth rejection) and its item-map keying contract with the backend are documented in code. `@pie-qti/player-elements` also moves `@pie-qti/assessment-player` to runtime dependencies to match its existing runtime import of `ReferenceBackendAdapter`.
- 6c209e2: AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
- 30b045d: Test-level outcome processing sees every delivered item with its typed variables, section path, categories, weights, declared normal bounds and presented/responded/correct/incorrect/selected flags, so `numberResponded`, `numberSelected`, `numberCorrect` without `MAXSCORE`, section and category filters and weighted `testVariables` evaluate as authored. Item scoring reports `correct`; `outcomeMinimum`/`outcomeMaximum` read `normalMinimum`/`normalMaximum`.
- 0edef83: Resolve external QTI processing fragments during packaged assessment delivery.
  
  `xi:include` fragments referenced by an item's `responseProcessing`, `templateProcessing`, or `outcomeProcessing` are now preloaded from the content package during reference-mode assessment parsing and executed through a package-contained resolver, so packaged fragments work without host wiring. Nested includes resolve relative to the fragment that references them, and authored `xi:fallback` content runs when a fragment file is missing. The processing engine now requires the XInclude namespace for `include` and `fallback` elements and fails loudly when another vocabulary uses those local names. Test-scope (`scope: 'test'`) fragments still require a host-supplied resolver and fail closed, unchanged.
- 953e5d1: Shared catalog files from the content package manifest (G-15, QTI 3.0 §6.3): `loadResolvedManifest` surfaces resources of type `imsqti_catalog_xmlv3p0` as `sharedCatalogs`; `createResolvedItemDeliveryContext` accepts `packageCatalogSources` and the reference backend adapter threads a host-supplied list (`parseAssessmentTestXml({ sharedCatalogs })`, exposed as `QtiAssessmentPlayerConfig.sharedCatalogs`) into every item's delivery context. The item player merges package-scope entries at the bottom, so an item-level `qti-catalog-info` wins a shared identifier and a shared file backs items that declare none.
- c785703: Show `testFeedback` at test and test-part level by typed outcome values, single or multiple, with `access="during"` during the test and `atEnd` at the end of the test or its part. The backend contract returns `outcomes` from `submitResponses`, a resumed `initSession` and `finalizeAssessment`; `sum` and `product` accept multiple and ordered containers; QTI 3 items score under their own identifier.
- 8063850: Test structure semantics: the backend draws selection (with replacement clones) and ordering (with `keepTogether`) at session start and stores the draw; preconditions and item, section and test part branch rules decide `nextItemIdentifier`; item session control cascades per item and the backend enforces `maxAttempts` and `allowComment`; an expired test part, section or item limit locks that scope. A backend must now return the drawn assessment and the first eligible item as `InitSessionResponse.currentItemIdentifier`. The player's `rng` option is ignored; pass it to `new ReferenceBackendAdapter({ rng })`.
- Updated dependencies [65e62f6]
- Updated dependencies [0d99546]
- Updated dependencies [063229c]
- Updated dependencies [32c08b7]
- Updated dependencies [6c209e2]
- Updated dependencies [0f93a03]
- Updated dependencies [1521a74]
- Updated dependencies [a7c714e]
- Updated dependencies [5be190e]
- Updated dependencies [7f68a35]
- Updated dependencies [bac1158]
- Updated dependencies [a4353af]
- Updated dependencies [8063850]
- Updated dependencies [f20a87e]
- Updated dependencies [3c70cc3]
- Updated dependencies [30b045d]
- Updated dependencies [bbaab53]
- Updated dependencies [0ca867a]
- Updated dependencies [833ddad]
- Updated dependencies [33b1a1a]
- Updated dependencies [765423c]
- Updated dependencies [0edef83]
- Updated dependencies [70ee7a8]
- Updated dependencies [953e5d1]
- Updated dependencies [c785703]
  - @pie-qti/qti-processing@1.0.0-beta.0
  - @pie-qti/ims-cp-core@1.0.0-beta.0
  - @pie-qti/default-components@1.0.0-beta.0
  - @pie-qti/qti-common@1.0.0-beta.0
  - @pie-qti/item-player@1.0.0-beta.0
  - @pie-qti/section-player@1.0.0-beta.0
  - @pie-qti/i18n@1.0.0-beta.0
  - @pie-qti/assessment-toolkit@1.0.0-beta.0

## 0.1.28

### Patch Changes

- Updated dependencies [6af3354]
- Updated dependencies [8fd28e3]
  - @pie-qti/qti-common@0.1.28
  - @pie-qti/default-components@0.1.28
  - @pie-qti/item-player@0.1.28
  - @pie-qti/qti-processing@0.1.28
  - @pie-qti/section-player@0.1.28
  - @pie-qti/assessment-toolkit@0.1.28
  - @pie-qti/i18n@0.1.28
  - @pie-qti/ims-cp-core@0.1.28

## 0.1.27

### Patch Changes

- Updated dependencies [498b1e2]
- Updated dependencies [498b1e2]
  - @pie-qti/item-player@0.1.27
  - @pie-qti/qti-common@0.1.27
  - @pie-qti/default-components@0.1.27
  - @pie-qti/section-player@0.1.27
  - @pie-qti/qti-processing@0.1.27
  - @pie-qti/assessment-toolkit@0.1.27
  - @pie-qti/i18n@0.1.27
  - @pie-qti/ims-cp-core@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [ff00d31]
- Updated dependencies [af8ee10]
- Updated dependencies [34c0034]
- Updated dependencies [6deb125]
- Updated dependencies [5627ce1]
  - @pie-qti/ims-cp-core@0.1.26
  - @pie-qti/section-player@0.1.26
  - @pie-qti/item-player@0.1.26
  - @pie-qti/default-components@0.1.26
  - @pie-qti/qti-common@0.1.26
  - @pie-qti/assessment-toolkit@0.1.26
  - @pie-qti/qti-processing@0.1.26
  - @pie-qti/i18n@0.1.26

## 0.1.25

### Patch Changes

- Updated dependencies
- Updated dependencies [0bb51e3]
  - @pie-qti/section-player@0.1.25
  - @pie-qti/qti-processing@0.1.25
  - @pie-qti/assessment-toolkit@0.1.25
  - @pie-qti/item-player@0.1.25
  - @pie-qti/default-components@0.1.25
  - @pie-qti/i18n@0.1.25
  - @pie-qti/ims-cp-core@0.1.25
  - @pie-qti/qti-common@0.1.25

## 0.1.24

### Patch Changes

- 080f254: Render readable assessment labels before host translations finish loading, and adopt a later context provider without restarting the attempt. Explicitly configured providers continue to take precedence.
- 10eba70: Keep assessment answers visible after a failed submission, provide a focused retry action, and prevent duplicate submission while a request is pending.
- 3c00b98: Preserve the latest answer when saving and restoring an assessment with rich item sessions, including edits made after revisiting an item. Taking a snapshot leaves the live attempt active.
- 04f33a1: Respect each test part's submission mode when leaving a part and finalizing an assessment, so mixed individual/simultaneous tests submit every applicable answer. Keep failed part transitions retryable without resubmitting previously accepted items.
- Updated dependencies
- Updated dependencies
- Updated dependencies [5c8a8e8]
- Updated dependencies [080f254]
- Updated dependencies [e532f4f]
- Updated dependencies [67e4c23]
  - @pie-qti/section-player@0.1.24
  - @pie-qti/default-components@0.1.24
  - @pie-qti/qti-common@0.1.24
  - @pie-qti/i18n@0.1.24
  - @pie-qti/item-player@0.1.24
  - @pie-qti/assessment-toolkit@0.1.24
  - @pie-qti/qti-processing@0.1.24
  - @pie-qti/ims-cp-core@0.1.24

## 0.1.23

### Patch Changes

- Updated dependencies [4df35b3]
- Updated dependencies [4341302]
- Updated dependencies [d476546]
- Updated dependencies [2fd7a31]
  - @pie-qti/section-player@0.1.23
  - @pie-qti/default-components@0.1.23
  - @pie-qti/item-player@0.1.23
  - @pie-qti/assessment-toolkit@0.1.23
  - @pie-qti/i18n@0.1.23
  - @pie-qti/ims-cp-core@0.1.23
  - @pie-qti/qti-common@0.1.23
  - @pie-qti/qti-processing@0.1.23

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

- Updated dependencies [3aec4b3]
- Updated dependencies [ba84656]
  - @pie-qti/i18n@0.1.22
  - @pie-qti/item-player@0.1.22
  - @pie-qti/default-components@0.1.22
  - @pie-qti/section-player@0.1.22
  - @pie-qti/assessment-toolkit@0.1.22
  - @pie-qti/ims-cp-core@0.1.22
  - @pie-qti/qti-common@0.1.22
  - @pie-qti/qti-processing@0.1.22

## 0.1.21

### Patch Changes

- Updated dependencies [8836ebf]
- Updated dependencies [2c00bd1]
  - @pie-qti/qti-processing@0.1.21
  - @pie-qti/item-player@0.1.21
  - @pie-qti/default-components@0.1.21
  - @pie-qti/section-player@0.1.21
  - @pie-qti/assessment-toolkit@0.1.21
  - @pie-qti/i18n@0.1.21
  - @pie-qti/ims-cp-core@0.1.21
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
  - @pie-qti/default-components@0.1.20
  - @pie-qti/item-player@0.1.20
  - @pie-qti/qti-common@0.1.20
  - @pie-qti/section-player@0.1.20
  - @pie-qti/qti-processing@0.1.20
  - @pie-qti/assessment-toolkit@0.1.20
  - @pie-qti/i18n@0.1.20
  - @pie-qti/ims-cp-core@0.1.20

## 0.1.19

### Patch Changes

- Updated dependencies [ffe996d]
  - @pie-qti/item-player@0.1.19
  - @pie-qti/default-components@0.1.19
  - @pie-qti/section-player@0.1.19
  - @pie-qti/assessment-toolkit@0.1.19
  - @pie-qti/i18n@0.1.19
  - @pie-qti/ims-cp-core@0.1.19
  - @pie-qti/qti-common@0.1.19
  - @pie-qti/qti-processing@0.1.19

## 0.1.18

### Patch Changes

- Updated dependencies [2ebee31]
  - @pie-qti/item-player@0.1.18
  - @pie-qti/default-components@0.1.18
  - @pie-qti/section-player@0.1.18
  - @pie-qti/assessment-toolkit@0.1.18
  - @pie-qti/i18n@0.1.18
  - @pie-qti/ims-cp-core@0.1.18
  - @pie-qti/qti-common@0.1.18
  - @pie-qti/qti-processing@0.1.18

## 0.1.17

### Patch Changes

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
  - @pie-qti/default-components@0.1.17
  - @pie-qti/i18n@0.1.17
  - @pie-qti/item-player@0.1.17
  - @pie-qti/ims-cp-core@0.1.17
  - @pie-qti/section-player@0.1.17
  - @pie-qti/assessment-toolkit@0.1.17
  - @pie-qti/qti-common@0.1.17
  - @pie-qti/qti-processing@0.1.17

## 0.1.16

### Patch Changes

- 3c56bd9: Generate identifiers from a CSPRNG and fix a non-uniform shuffle.

  - `item-player`: `createSessionGuid` previously fell back to `Math.random()` when
    `crypto.randomUUID` was unavailable — which is precisely the case when the player is
    served over plain HTTP, since `randomUUID` is restricted to secure contexts. It now
    falls back to `crypto.getRandomValues`, and throws a descriptive error if no Web Crypto
    API is present at all rather than silently producing predictable session GUIDs.
  - `ims-cp-node`: temporary extraction directories are now created with `fs.mkdtemp`
    instead of a `Date.now()` + `Math.random()` name. The old name was predictable and was
    built before the directory was created, so a local attacker could pre-create the path or
    plant a symlink there. `mkdtemp` creates the directory atomically with mode `0700`
    (previously `0755`, i.e. readable by other local users).
  - `assessment-player`: `ReferenceBackendAdapter` item-bank selection used
    `sort(() => Math.random() - 0.5)`, which is not a uniform shuffle — measured over 60k
    trials it left the first element in place 21.9% of the time against an expected 16.7%.
    Replaced with the Fisher-Yates helper already used by `AssessmentPlayer`.

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
- Updated dependencies [3c56bd9]
- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
- Updated dependencies [f4655e6]
  - @pie-qti/item-player@0.1.16
  - @pie-qti/assessment-toolkit@0.1.16
  - @pie-qti/default-components@0.1.16
  - @pie-qti/i18n@0.1.16
  - @pie-qti/ims-cp-core@0.1.16
  - @pie-qti/qti-common@0.1.16
  - @pie-qti/qti-processing@0.1.16
  - @pie-qti/section-player@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-toolkit@0.1.15
  - @pie-qti/default-components@0.1.15
  - @pie-qti/i18n@0.1.15
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15
  - @pie-qti/qti-processing@0.1.15
  - @pie-qti/section-player@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
- Updated dependencies [30a4d2a]
  - @pie-qti/assessment-toolkit@0.1.14
  - @pie-qti/section-player@0.1.14
  - @pie-qti/item-player@0.1.14
  - @pie-qti/default-components@0.1.14
  - @pie-qti/i18n@0.1.14
  - @pie-qti/ims-cp-core@0.1.14
  - @pie-qti/qti-common@0.1.14
  - @pie-qti/qti-processing@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.13
  - @pie-qti/i18n@0.1.13
  - @pie-qti/ims-cp-core@0.1.13
  - @pie-qti/item-player@0.1.13
  - @pie-qti/qti-common@0.1.13
  - @pie-qti/qti-processing@0.1.13

## 0.1.12

### Patch Changes

- Updated dependencies [abe0be5]
  - @pie-qti/default-components@0.1.12
  - @pie-qti/item-player@0.1.12
  - @pie-qti/i18n@0.1.12
  - @pie-qti/ims-cp-core@0.1.12
  - @pie-qti/qti-common@0.1.12
  - @pie-qti/qti-processing@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.11
  - @pie-qti/i18n@0.1.11
  - @pie-qti/ims-cp-core@0.1.11
  - @pie-qti/item-player@0.1.11
  - @pie-qti/qti-common@0.1.11
  - @pie-qti/qti-processing@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.10
  - @pie-qti/i18n@0.1.10
  - @pie-qti/ims-cp-core@0.1.10
  - @pie-qti/item-player@0.1.10
  - @pie-qti/qti-processing@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.9
  - @pie-qti/i18n@0.1.9
  - @pie-qti/ims-cp-core@0.1.9
  - @pie-qti/item-player@0.1.9
  - @pie-qti/qti-processing@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.8
  - @pie-qti/i18n@0.1.8
  - @pie-qti/ims-cp-core@0.1.8
  - @pie-qti/item-player@0.1.8
  - @pie-qti/qti-processing@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.7
  - @pie-qti/i18n@0.1.7
  - @pie-qti/ims-cp-core@0.1.7
  - @pie-qti/item-player@0.1.7
  - @pie-qti/qti-processing@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.6
  - @pie-qti/i18n@0.1.6
  - @pie-qti/item-player@0.1.6
  - @pie-qti/qti-processing@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.5
  - @pie-qti/i18n@0.1.5
  - @pie-qti/item-player@0.1.5
  - @pie-qti/qti-processing@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.4
  - @pie-qti/i18n@0.1.4
  - @pie-qti/item-player@0.1.4
  - @pie-qti/qti-processing@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.3
  - @pie-qti/i18n@0.1.3
  - @pie-qti/item-player@0.1.3
  - @pie-qti/qti-processing@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.2
  - @pie-qti/i18n@0.1.2
  - @pie-qti/item-player@0.1.2
  - @pie-qti/qti-processing@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/qti-processing@0.1.1
  - @pie-qti/default-components@0.1.1
  - @pie-qti/item-player@0.1.1
