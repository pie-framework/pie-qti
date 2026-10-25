# @pie-qti/section-player

## 1.0.0-beta.2

### Patch Changes

- 5dbabcc: Content and interface direction are now separate: player chrome takes `lang` and `dir` from the interface locale, while the item body, passages, rubrics and modal feedback take them from the content's `xml:lang`, and content that declares no language inherits the chrome's. Nested `xml:lang` spans get a `dir` where their direction differs from the surrounding text. `@pie-qti/i18n` exports `languageDirection`, `canonicalLanguageTag`, `contentLanguageAttributes` and `interfaceLocaleAttributes`, and `@pie-qti/section-player` now depends on `@pie-qti/i18n` directly.
- 572c3d3: Add `pseudoLocalize` with the `en-XA` and `ar-XB` pseudo-locales, and a physical-direction CSS check in `check:i18n`. Interaction and chrome markup that still used `ml-*`, `mr-*` and `right-*` utilities now uses their logical forms, so it mirrors under right-to-left locales.
- 67d94ee: Player chrome and interaction layout use logical CSS properties, so they mirror under `dir="rtl"`, and horizontal order lists move items with the arrow keys in the inline direction. `AssessmentTimer` accepts `top-end`/`top-start`/`bottom-end`/`bottom-start` and defaults to `top-end`; the physical values keep working.
- cf99206: The section's interface locale now reaches the pie-players tool toolkit through its `locale` attribute, so tool chrome takes that locale's `lang`/`dir` and labels from the toolkit's catalogs. The section player elements gain an `i18n` property, and `@pie-players/*` moves to 1.0.0-beta.6.
- Updated dependencies [d8f9b4d]
- Updated dependencies [5dbabcc]
- Updated dependencies [d0e249b]
- Updated dependencies [e874155]
- Updated dependencies [a202037]
- Updated dependencies [572c3d3]
- Updated dependencies [67d94ee]
- Updated dependencies [dba1477]
  - @pie-qti/i18n@1.0.0-beta.2
  - @pie-qti/default-components@1.0.0-beta.2
  - @pie-qti/item-player@1.0.0-beta.2
  - @pie-qti/qti-common@1.0.0-beta.2
  - @pie-qti/ims-cp-core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [66f5281]
  - @pie-qti/default-components@1.0.0-beta.1
  - @pie-qti/i18n@1.0.0-beta.1
  - @pie-qti/ims-cp-core@1.0.0-beta.1
  - @pie-qti/item-player@1.0.0-beta.1
  - @pie-qti/qti-common@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- 32c08b7: Content language follows `xml:lang`. `prepareContentMarkup` restates it as `lang`; the item body takes its `lang` from the item, exposed as `Player.getContentLanguage()`, and glossary lookups pass it. The section player sets the toolbar and TTS language from it and picks a Polly voice for that language unless the host configures `defaultVoice`, which no longer defaults to Joanna; shared HTML blocks take an optional `language`.
- 6c209e2: AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
- 0f93a03: Read-aloud markup reaches delivery. `prepareContentMarkup` moves from to-pie into `@pie-qti/qti-common/accessibility` and reads QTI 3 names; the item player renders SSML docked as catalog idrefs and `data-qti-suppress-tts` as `data-tts-suppress`, and the section player registers the SSML as `spoken` catalogs and projects QTI 3 interactions without suppressed content.
- 1521a74: Shared vocabulary classes, authored interaction aria and richer catalogs. `qti-shared-vocabulary.css` and the interactions honour the QTI 3 shared classes: choice labels and suffixes, writing orientation, `qti-choices-*` placement and `qti-unselected-hidden`. Every interaction takes its authored `aria-label`, `aria-labelledby` and `aria-describedby` through `interactionAria`, resolved to text at extraction (`BaseInteractionData.accessibility`). Catalog entries render multi-part content and media; object replacement keeps aria, role and `lang`. The section player's read-aloud takes native `qti-catalog-info` and APIP spoken cards and docks the SSML of passages.
- 70ee7a8: Move to pie-players 1.0.0-beta.3. The TTS provider config takes the 1.0 shape (`backend`, `serverProvider` and top-level settings), with the pre-1.0 `provider` string, `settings` and `validateEndpoint` keys mapped onto it, and the calculator type now reaches the calculator through the item scope's tool parameters. The readable interaction projection is gone: the 1.0 reader reads interactions from their own shadow content, which it would otherwise read twice.
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
- Updated dependencies [953e5d1]
  - @pie-qti/ims-cp-core@1.0.0-beta.0
  - @pie-qti/default-components@1.0.0-beta.0
  - @pie-qti/qti-common@1.0.0-beta.0
  - @pie-qti/item-player@1.0.0-beta.0
  - @pie-qti/i18n@1.0.0-beta.0

## 0.1.28

### Patch Changes

- Updated dependencies [6af3354]
- Updated dependencies [8fd28e3]
  - @pie-qti/qti-common@0.1.28
  - @pie-qti/default-components@0.1.28
  - @pie-qti/item-player@0.1.28
  - @pie-qti/i18n@0.1.28
  - @pie-qti/ims-cp-core@0.1.28

## 0.1.27

### Patch Changes

- Updated dependencies [498b1e2]
- Updated dependencies [498b1e2]
  - @pie-qti/item-player@0.1.27
  - @pie-qti/qti-common@0.1.27
  - @pie-qti/default-components@0.1.27
  - @pie-qti/i18n@0.1.27
  - @pie-qti/ims-cp-core@0.1.27

## 0.1.26

### Patch Changes

- af8ee10: `QtiSectionDiagnosticSource` names diagnostics a host contributes `'host'`. Breaking: a host emitting the previous host-specific source value switches to `'host'`. The select-point rejection message now says PIE has no element for selecting a point on an image.
- Updated dependencies [ff00d31]
- Updated dependencies [34c0034]
- Updated dependencies [6deb125]
- Updated dependencies [5627ce1]
  - @pie-qti/ims-cp-core@0.1.26
  - @pie-qti/item-player@0.1.26
  - @pie-qti/default-components@0.1.26
  - @pie-qti/qti-common@0.1.26
  - @pie-qti/i18n@0.1.26

## 0.1.25

### Patch Changes

- Align the PIE toolkit, tool loaders, calculator, and speech dependencies on 0.3.73 so hosted tools share compatible registration and context contracts. Packages now build with Svelte 5.57.1, the floor the 0.3.73 calculator tools require, so a single Svelte runtime is loaded.
- @pie-qti/item-player@0.1.25
  - @pie-qti/default-components@0.1.25
  - @pie-qti/i18n@0.1.25
  - @pie-qti/ims-cp-core@0.1.25
  - @pie-qti/qti-common@0.1.25

## 0.1.24

### Patch Changes

- Align the PIE toolkit, tool loaders, calculator, and speech dependencies on 0.3.68 so hosted tools share compatible registration and context contracts.
- Updated dependencies
- Updated dependencies [5c8a8e8]
- Updated dependencies [080f254]
- Updated dependencies [e532f4f]
- Updated dependencies [67e4c23]
  - @pie-qti/default-components@0.1.24
  - @pie-qti/qti-common@0.1.24
  - @pie-qti/i18n@0.1.24
  - @pie-qti/item-player@0.1.24
  - @pie-qti/ims-cp-core@0.1.24

## 0.1.23

### Patch Changes

- 4df35b3: Align the `@pie-players` family on 0.3.67 and migrate off the removed packaged-tool factory.
  
  Merging the four `@pie-players` Dependabot bumps individually left the family straddling
  three releases — 0.3.53, 0.3.65 and 0.3.66 — and those packages pin each other at exact
  versions, so the tree carried parallel copies of five of them. `pie-context` was installed
  twice, which means two independent context instances: a provider registered through one is
  invisible to consumers of the other.
  
  The stale 0.3.53 pin was load-bearing rather than merely untidy. `createPackagedToolRegistry`
  was removed from `pie-assessment-toolkit` in 0.3.65, and `QtiToolButtonBar` still imported
  it, so the build only worked because the duplicate 0.3.53 copy was still resolvable.
  
  Upstream moved the concrete tool registrations out of the toolkit core into
  `@pie-players/pie-default-tool-loaders`, which hard-depends on all eleven packaged tools and
  whose `PACKAGED_TOOL_REGISTRATIONS` references every one statically. Importing its
  `createPackagedToolRegistry` therefore pulled nine unused tool packages into the
  `player-elements` bundle. Instead the two registrations this player actually uses are
  imported individually and installed onto a `ToolRegistry` directly, with a two-entry tag map
  standing in for the default the toolkit no longer ships. No unused tool chunks are emitted.
  
  `player-elements` had a `sideEffects` entry of `./dist/tag-names-*.js` — a rolldown chunk
  name derived from an upstream module, not a source filename. At 0.3.67 that code merges into
  `./dist/define-*.js`, so the entry stopped resolving and the publish check failed; the entry
  and the test asserting it now name the define chunk. The glob remains coupled to upstream
  chunk naming and will need the same treatment on a future reshuffle.
  
  Two `section-player` e2e assertions were checking a workaround rather than a behaviour. The
  toolkit used to render a vendored `nds-icon-button` whose FontAwesome Pro glyph 404ed,
  leaving a blank button that `QtiToolButtonBar` patched with an inline SVG. Those icons are
  licensed to Renaissance products only, so PIE-785 made them opt-in behind `ndsIcons` in
  0.3.59 and plain `<button>` the default. Our previous 0.3.53 pin predated that, so this
  alignment crosses onto the intended default path: no `nds-icon-button` is rendered and the
  fallback marker cannot appear. The assertions now check that the calculator button has a
  visibly rendered icon, whichever layer drew it.
- 4341302: Drop the `nds-icon-button` icon patching, which no longer has anything to patch.
  
  `QtiToolButtonBar` carried ~130 lines that walked open shadow roots, found vendored
  `nds-icon-button` elements and FontAwesome `<i class="fa-*">` icons, and injected inline SVG
  in their place, driven by a `MutationObserver` plus three timers. It existed because the
  toolkit rendered NDS icon buttons whose FontAwesome Pro glyphs 404 against a host that does
  not serve `/_fa-pro/`, leaving blank buttons.
  
  Those icons are licensed to Renaissance products only, so PIE-785 made them opt-in behind
  `ndsIcons` in 0.3.59 and made plain `<button>` the default. This repo never opts in, so no
  `nds-icon-button` is rendered and the patching had no targets — dead since the family moved
  to 0.3.67.
  
  The stylesheet suppression stays. `ensureFontAwesomeFallbackMarker()` is independent of the
  opt-in: the toolkit injects FontAwesome on import, not on the decision to render vendored
  buttons, so removing it brought the `/_fa-pro/` 404s straight back. It is now documented as
  load-bearing and the e2e guard that caught it is kept.
- Updated dependencies [d476546]
- Updated dependencies [2fd7a31]
  - @pie-qti/default-components@0.1.23
  - @pie-qti/item-player@0.1.23
  - @pie-qti/i18n@0.1.23
  - @pie-qti/ims-cp-core@0.1.23
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

- Updated dependencies [3aec4b3]
- Updated dependencies [ba84656]
  - @pie-qti/i18n@0.1.22
  - @pie-qti/item-player@0.1.22
  - @pie-qti/default-components@0.1.22
  - @pie-qti/ims-cp-core@0.1.22
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
  - @pie-qti/default-components@0.1.21
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
  - @pie-qti/i18n@0.1.20
  - @pie-qti/ims-cp-core@0.1.20

## 0.1.19

### Patch Changes

- Updated dependencies [ffe996d]
  - @pie-qti/item-player@0.1.19
  - @pie-qti/default-components@0.1.19
  - @pie-qti/i18n@0.1.19
  - @pie-qti/ims-cp-core@0.1.19
  - @pie-qti/qti-common@0.1.19

## 0.1.18

### Patch Changes

- Updated dependencies [2ebee31]
  - @pie-qti/item-player@0.1.18
  - @pie-qti/default-components@0.1.18
  - @pie-qti/i18n@0.1.18
  - @pie-qti/ims-cp-core@0.1.18
  - @pie-qti/qti-common@0.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [9b1e118]
- Updated dependencies [76311bb]
  - @pie-qti/default-components@0.1.17
  - @pie-qti/i18n@0.1.17
  - @pie-qti/item-player@0.1.17
  - @pie-qti/ims-cp-core@0.1.17
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
- Updated dependencies [3c56bd9]
- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
- Updated dependencies [f4655e6]
  - @pie-qti/item-player@0.1.16
  - @pie-qti/default-components@0.1.16
  - @pie-qti/i18n@0.1.16
  - @pie-qti/ims-cp-core@0.1.16
  - @pie-qti/qti-common@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.15
  - @pie-qti/i18n@0.1.15
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
- 30a4d2a: Use the upstream `pie-players` TTS highlight resolver pipeline for projected QTI content instead of patching private highlight coordinator methods. Consumers with pinned `@pie-players/*` packages must upgrade to the first fixed version that includes the resolver API.
- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
  - @pie-qti/item-player@0.1.14
  - @pie-qti/default-components@0.1.14
  - @pie-qti/i18n@0.1.14
  - @pie-qti/ims-cp-core@0.1.14
  - @pie-qti/qti-common@0.1.14
