# @pie-qti/item-player

## 1.0.0-beta.0

### Major Changes

- 3c70cc3: Declare the player platform's 1.0 feature set complete with a beta: all tracked QTI 2.2 / 3.0 spec gaps are closed — the spec-conformant PCI runtime (registry contract, `getInstance`, QTI variable JSON, AMD loading with resolution configs, clean-room conformance fixtures) plus the opt-in sandboxed execution engine (`@pie-qti/pci-runner`), PNP structured labels and braille data exposure, and manifest-level shared catalog files. The player/platform packages move together to the prerelease line and publish under the `beta` npm dist-tag; `latest` stays on 0.1.x. The transformation packages (`@pie-qti/pie-to-qti2`, `to-pie`, `transform-cli`, `transform-core`, `transform-types`, `source-profiles`) stay pre-alpha on their own 0.1.x lockstep and keep their current versioning: they ride along as the plain patch their dependents' release requires and publish to `latest` with no `beta` suffix. The final 1.0.0 follows the official-suite evidence refresh and a production-host validation.

### Patch Changes

- 32c08b7: Content language follows `xml:lang`. `prepareContentMarkup` restates it as `lang`; the item body takes its `lang` from the item, exposed as `Player.getContentLanguage()`, and glossary lookups pass it. The section player sets the toolbar and TTS language from it and picks a Polly voice for that language unless the host configures `defaultVoice`, which no longer defaults to Joanna; shared HTML blocks take an optional `language`.
- 6c209e2: AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
- 0f93a03: Read-aloud markup reaches delivery. `prepareContentMarkup` moves from to-pie into `@pie-qti/qti-common/accessibility` and reads QTI 3 names; the item player renders SSML docked as catalog idrefs and `data-qti-suppress-tts` as `data-tts-suppress`, and the section player registers the SSML as `spoken` catalogs and projects QTI 3 interactions without suppressed content.
- 1521a74: Shared vocabulary classes, authored interaction aria and richer catalogs. `qti-shared-vocabulary.css` and the interactions honour the QTI 3 shared classes: choice labels and suffixes, writing orientation, `qti-choices-*` placement and `qti-unselected-hidden`. Every interaction takes its authored `aria-label`, `aria-labelledby` and `aria-describedby` through `interactionAria`, resolved to text at extraction (`BaseInteractionData.accessibility`). Catalog entries render multi-part content and media; object replacement keeps aria, role and `lang`. The section player's read-aloud takes native `qti-catalog-info` and APIP spoken cards and docks the SSML of passages.
- a7c714e: `feedbackInline` resolves in either QTI spelling, nested and by membership in a container outcome, in the item body, choice text, rubric blocks and modal feedback; `qti-common` exports the shared visibility rule as `isShownByIdentifier`.
- 5be190e: Evaluate `feedbackBlock`, `templateBlock`, `templateInline`, choice-level `templateIdentifier` and MathML template variables in both QTI spellings, show modal feedback by membership, and read context variables, including `QTI_CONTEXT`, set through `openSession({ contextVariables })`.
- bac1158: `printedVariable` honours `format`, `base`, `index`, `powerForm`, `field`, `delimiter` and `mappingIndicator` in both QTI spellings, and resolves in rubric blocks and modal feedback as well as the item body.
- a4353af: Prompts, choices and interaction hosts keep their authored `lang`, catalog idref and read-aloud suppression.
- 8063850: `ItemSession` takes `templateDefaults`, applied before template processing, and a `presentation` policy whose `showFeedback` and `showSolution` gate integrated feedback and the solution view.
- f20a87e: `interpolationTable` is a step lookup per QTI: the first entry in document order whose `sourceValue` the source exceeds, or equals unless `includeBoundary="false"`, else `defaultValue`, else NULL. Lookup results and `defaultValue` take the outcome's base type, `interpolationMethod` is gone, and `qti-match-table` and `qti-interpolation-table` build.
- 30b045d: Test-level outcome processing sees every delivered item with its typed variables, section path, categories, weights, declared normal bounds and presented/responded/correct/incorrect/selected flags, so `numberResponded`, `numberSelected`, `numberCorrect` without `MAXSCORE`, section and category filters and weighted `testVariables` evaluate as authored. Item scoring reports `correct`; `outcomeMinimum`/`outcomeMaximum` read `normalMinimum`/`normalMaximum`.
- bbaab53: PCI module loading reaches the spec's AMD default resolution (G-08 phase 2): every authored `qti-interaction-module` entry is extracted with its id, multi-module declarations load through a `define`/`require` implementation that wires dependencies by id, and the RequireJS-shaped resolution config is parsed from the authored `primary-configuration` reference or the defined default locations (`modules/module_resolution.js`, then `modules/fallback_module_resolution.js`). The entry module is picked by the `customInteractionTypeIdentifier` tail, falling back to its authored fallback path on failure. Evaluation still goes through the host resolver — the loader decides how dependencies wire up, the resolver still decides whether code runs.
- 0ca867a: PCI conformance evidence and a fallback-loading fix (G-08 phase 3): on a multi-module load's fallback attempt, the entry module's id now rebinds to the authored fallback path, so a fallback declared beside a wrong primary path registers instead of re-fetching the broken path. Clean-room conformance fixtures under `tests/conformance/pci/` drive the full delivery path over real module files — registration, `getInstance` state seeding in QTI variable JSON, `onready`/`ondone`, `getState()` restore, and fallback resolution.
- 833ddad: PCI sandboxed engine (plan Option C): Portable Custom Interaction modules can now run in a
  hardened, opt-in cross-origin frame instead of the page realm. `PciConfiguration.sandbox`
  points at a runner page served from a dedicated cookieless origin; the module executes with
  an opaque origin — no shared storage, cookies, or DOM with the player — while `getResponse()`
  stays synchronous by answering from a bridge-maintained cache. New `@pie-qti/pci-runner`
  package is the deployable runner page (`dist/pci-runner.html` + bundle), with mutual origin
  locking over the versioned `pie-qti-pci-sandbox` protocol. `PciConfiguration.moduleResolver`
  is now optional: required for page-realm execution, unused when `sandbox` is configured, with
  the new `createAllowlistPciModulePolicy` available to allow-list which module URLs may be
  handed to the frame. `PciHostController.onError` reports asynchronous engine failures (frame
  handshake, in-frame module load, instance errors). The page-realm engine and its resolver
  contract are unchanged.
- 33b1a1a: PCI adopts the QTI 3.0 §6.1 registry contract (G-08 phase 1), replacing the bespoke `PciModule` interface outright: modules register against the page's `qtiCustomInteractionContext` and the host instantiates through `getInstance(dom, configuration, state)` with `onready`/`ondone`, a derived `status` (`interacting`/`closed`/`solution`/`review`), and QTI variable JSON (`base`/`list`/`record`) at the boundary. Responses are owned by the mounted module — `restore()` re-seeds `getInstance` state instead of pushing a setter — and `getState()` is exposed on the host. Host resolver trust gating is unchanged. A module written against the retired `PciModule` breaks; none is known to exist.
- 765423c: Structured labels and braille routing (G-13): `pnp.display.structuredLabelSupport` presents choice and match answer sets as one ARIA group named by the interaction prompt, with match columns named by their visible headings. An AfA PNP `<braille/>` grant now routes to the platform `brailleText` preference (`sign-language` to `signingDefinition`), and `getCatalogEntry` under a QTI 3 usage falls back to the APIP support name (`braille-text` → `braille`, `signing-definition` → `sign-language`), so QTI 3 and APIP catalogs share one lookup path. The research note, markup contract, and NVDA checklist live in `packages/item-player/docs/PNP.md`.
- 0edef83: Resolve external QTI processing fragments during packaged assessment delivery.
  
  `xi:include` fragments referenced by an item's `responseProcessing`, `templateProcessing`, or `outcomeProcessing` are now preloaded from the content package during reference-mode assessment parsing and executed through a package-contained resolver, so packaged fragments work without host wiring. Nested includes resolve relative to the fragment that references them, and authored `xi:fallback` content runs when a fragment file is missing. The processing engine now requires the XInclude namespace for `include` and `fallback` elements and fails loudly when another vocabulary uses those local names. Test-scope (`scope: 'test'`) fragments still require a host-supplied resolver and fail closed, unchanged.
- 953e5d1: Shared catalog files from the content package manifest (G-15, QTI 3.0 §6.3): `loadResolvedManifest` surfaces resources of type `imsqti_catalog_xmlv3p0` as `sharedCatalogs`; `createResolvedItemDeliveryContext` accepts `packageCatalogSources` and the reference backend adapter threads a host-supplied list (`parseAssessmentTestXml({ sharedCatalogs })`, exposed as `QtiAssessmentPlayerConfig.sharedCatalogs`) into every item's delivery context. The item player merges package-scope entries at the bottom, so an item-level `qti-catalog-info` wins a shared identifier and a shared file backs items that declare none.
- Updated dependencies [65e62f6]
- Updated dependencies [0d99546]
- Updated dependencies [32c08b7]
- Updated dependencies [6c209e2]
- Updated dependencies [0f93a03]
- Updated dependencies [a7c714e]
- Updated dependencies [f20a87e]
- Updated dependencies [30b045d]
- Updated dependencies [765423c]
- Updated dependencies [0edef83]
- Updated dependencies [953e5d1]
- Updated dependencies [c785703]
  - @pie-qti/qti-processing@1.0.0-beta.0
  - @pie-qti/ims-cp-core@1.0.0-beta.0
  - @pie-qti/qti-common@1.0.0-beta.0
  - @pie-qti/i18n@1.0.0-beta.0

## 0.1.28

### Patch Changes

- Updated dependencies [6af3354]
- Updated dependencies [8fd28e3]
  - @pie-qti/qti-common@0.1.28
  - @pie-qti/qti-processing@0.1.28
  - @pie-qti/i18n@0.1.28
  - @pie-qti/ims-cp-core@0.1.28

## 0.1.27

### Patch Changes

- 498b1e2: The item player resolves a QTI 2.x item's APIP access elements as catalogs, docking each link on the element, word or characters it names as `data-catalog-idref`.
- Updated dependencies [498b1e2]
  - @pie-qti/qti-common@0.1.27
  - @pie-qti/qti-processing@0.1.27
  - @pie-qti/i18n@0.1.27
  - @pie-qti/ims-cp-core@0.1.27

## 0.1.26

### Patch Changes

- 34c0034: Read the PNP as a per-candidate AfA PNP 3.0 profile. `parsePnpXml` now parses an `access-for-all-pnp` document, `parseAfaPnpXml` returns its whole record and `pnpProfileFromAfa` maps a record onto `PnpProfile`. to-pie no longer emits `personalNeedsProfile` for an assessmentTest and warns `QTI_PNP_IN_CONTENT` instead; the `PersonalNeedsProfile` type is removed.
- Updated dependencies [ff00d31]
- Updated dependencies [5627ce1]
  - @pie-qti/ims-cp-core@0.1.26
  - @pie-qti/qti-common@0.1.26
  - @pie-qti/qti-processing@0.1.26
  - @pie-qti/i18n@0.1.26

## 0.1.25

### Patch Changes

- Updated dependencies [0bb51e3]
  - @pie-qti/qti-processing@0.1.25
  - @pie-qti/i18n@0.1.25
  - @pie-qti/ims-cp-core@0.1.25
  - @pie-qti/qti-common@0.1.25

## 0.1.24

### Patch Changes

- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.
- Updated dependencies [5c8a8e8]
- Updated dependencies [080f254]
- Updated dependencies [e532f4f]
- Updated dependencies [67e4c23]
  - @pie-qti/qti-common@0.1.24
  - @pie-qti/i18n@0.1.24
  - @pie-qti/qti-processing@0.1.24
  - @pie-qti/ims-cp-core@0.1.24

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
  - @pie-qti/i18n@0.1.22
  - @pie-qti/ims-cp-core@0.1.22
  - @pie-qti/qti-common@0.1.22
  - @pie-qti/qti-processing@0.1.22

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

- 2c00bd1: Initialize numeric outcome variables to 0 when no default is declared. Per QTI 2.1 §5.2, carried
  into 2.2 and 3.0, an outcome with no `<defaultValue>` initializes to NULL unless its base type is
  `integer` or `float`, where it initializes to 0. Every defaultless outcome was initialized to NULL,
  so accumulating response processing such as `SCORE = sum(SCORE, 1)` propagated NULL and the item
  never scored: 1EdTech acceptance criteria Q12-L2-D3/D4/D5 require `SCORE` of 1, 0 and 2 for the
  composite inline-choice sample, and pie-qti returned NULL for every response set. The rule is
  applied at parse time, so it also governs the reset before each response-processing run and the
  `<default>` expression. Response and template variables are unaffected — an unanswered numeric
  response must stay distinguishable from an answered zero — and an authored `<defaultValue>` still
  wins. `@pie-qti/assessment-player` already applied this rule to test-level declarations; item and
  test level now agree.

  A `MAXSCORE` declared without a default is consequently 0 rather than absent, so an item that never
  assigns it scores against a maximum of zero. Substituting 1 inside response processing would make
  this engine disagree with a conformant one, so the value stands and the player warns once per item,
  naming the item and the remedy. `ScoringResult.maxScore` still falls back to `1.0` when `MAXSCORE`
  is not declared at all, which the spec leaves open.

  `Declaration` gains `impliedNumericDefault`, marking a `defaultValue` that came from this rule
  rather than from the author.

  Remove the unused `core/declarations.js` exports (`initializeDeclarations`, `addDeclaration`,
  `addMapping`, `addAreaMapping`, `getVariableValue`, `setVariableValue`, `resetDeclarations`,
  `cloneDeclarations`, `DeclarationsContext`) and `BUILTIN_DECLARATIONS`. Nothing in the framework
  called them; they were a second declaration model that took no response/outcome kind, so they could
  not carry the numeric-outcome rule and would have kept returning NULL defaults. `BUILTIN_DECLARATIONS`
  also described built-ins the runtime does not use and typed `completionStatus` as `string` where the
  runtime seeds `identifier`. Hosts that built declaration maps by hand should use
  `createAssessmentItemDefinition()` and the session interface instead.

- Updated dependencies [8836ebf]
- Updated dependencies [2c00bd1]
  - @pie-qti/qti-processing@0.1.21
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
  - @pie-qti/qti-common@0.1.20
  - @pie-qti/qti-processing@0.1.20
  - @pie-qti/i18n@0.1.20
  - @pie-qti/ims-cp-core@0.1.20

## 0.1.19

### Patch Changes

- ffe996d: Scope SMIL element removal to `<svg>` subtrees, so item HTML using those tag names keeps its text.

  `ACTIVE_SVG_ELEMENTS` — `animate`, `animateColor`, `animateMotion`, `animateTransform`,
  `discard`, `set` — was matched by tag name anywhere in the document, and matches were removed
  along with their children. The policy exists because SMIL can mutate `href` and other
  URL-bearing attributes after the static attribute pass, which is only true inside SVG.

  Outside an `<svg>` subtree these are inert unknown elements, and `<set>` reaches real content:
  ExamView-style QTI 2.1 exports wrap parts of a question stem in `<set bf="">`. Removing it
  discarded the wrapped text, truncating a stem mid-sentence — a myPerspectives item asking
  "Which evidence from paragraph 1 of Selection 1 **best** supports the inference that the
  narrator enjoys playing outdoors?" rendered as "Which evidence from paragraph 1 of Selection 1".

  These elements are now unwrapped outside SVG, preserving their sanitized children, which is
  what non-QTI hyphenated elements already did — both paths now share one helper. Inside an
  `<svg>` subtree they are still removed outright, so a `<set attributeName="href">` animation
  cannot survive.

  - @pie-qti/i18n@0.1.19
  - @pie-qti/ims-cp-core@0.1.19
  - @pie-qti/qti-common@0.1.19
  - @pie-qti/qti-processing@0.1.19

## 0.1.18

### Patch Changes

- 2ebee31: Scope QTI stylesheets with an at-rule-aware walker, so `@media` conditions are no longer dropped.

  `scopeCssRules` matched rules with `([^{}@]+)\{([^{}]*)\}`. Excluding `@` from the selector
  pattern kept the scope from being glued onto an at-rule, but it did not make the walker
  understand at-rules, and the failure that remained is worse than a visibly broken selector.

  An `@media` block never matched as a unit, so its inner rules matched on their own and were
  emitted **without the condition**. A `@media print` rule therefore applied on screen as well,
  and a narrow-viewport rule applied at every width — valid CSS that silently renders in the
  wrong places, which is harder to notice than a rule that fails outright. `@supports` behaved
  the same way. `@keyframes spin { 0% { … } }` had its percentage selectors scoped into
  `[scope] 0%` and lost the animation name, so the animation could not run, and `@font-face`
  became `[scope] font-face`.

  Scoping now walks the stylesheet brace-by-brace:

  - `@media`, `@supports`, `@container`, `@layer` and `@scope` keep their prelude and have
    their inner rules scoped, recursively.
  - `@font-face`, `@keyframes` (including vendor-prefixed), `@page`, `@property` and
    `@counter-style` pass through untouched, as do at-rules the walker does not recognise.
  - Parsing is string- and paren-aware, so a `{` inside `content: "{"` does not end a block and
    a `,` inside `:is(a, b)` does not split a selector list. Comment stripping is string-aware
    too, so a literal `content: "/*"` survives where the previous regex strip corrupted it.
  - Style-rule blocks are emitted verbatim, which is what native CSS nesting needs: nested
    selectors are relative to a parent that has already been scoped.

  `:root`, `html` and `body` are still replaced by the scope selector rather than prefixed, and
  now preserve whatever followed them — `html.dark .a` becomes `[scope].dark .a` instead of
  discarding the `.dark` compound.

  One deliberate behaviour change beyond at-rules: **a leading pseudo is now scoped as a
  descendant rather than attached.** `:is(.a, .b) .c` becomes `[scope] :is(.a, .b) .c`, not
  `[scope]:is(.a, .b) .c`. The authored selector means "some element matching `.a` or `.b`", so
  attaching it required the item body itself to carry the authored class, which it does not.
  The same applies to `:hover` and `::selection`.

  **This both adds and removes rendering.** At-rules have never applied correctly, so some
  styles start applying — but `@media` rules that currently apply unconditionally will now
  apply only behind their real condition, so styles that render today may stop. That is the
  fix, and it is worth eyeballing against real content: a print stylesheet that appeared to
  work on screen was never meant to.

  Flat selector rules scope exactly as before, and `isBlockedStylesheetCss` still rejects any
  stylesheet containing `url(` or `@import` before scoping runs, so `@font-face` with a real
  `src` never reaches this path in practice.

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
  - @pie-qti/i18n@0.1.17
  - @pie-qti/ims-cp-core@0.1.17
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

- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
  - @pie-qti/i18n@0.1.16
  - @pie-qti/ims-cp-core@0.1.16
  - @pie-qti/qti-common@0.1.16
  - @pie-qti/qti-processing@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.15
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/qti-common@0.1.15
  - @pie-qti/qti-processing@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
  - @pie-qti/i18n@0.1.14
  - @pie-qti/ims-cp-core@0.1.14
  - @pie-qti/qti-common@0.1.14
  - @pie-qti/qti-processing@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.13
  - @pie-qti/ims-cp-core@0.1.13
  - @pie-qti/qti-common@0.1.13
  - @pie-qti/qti-processing@0.1.13
  - @pie-qti/typeset-katex@0.1.13

## 0.1.12

### Patch Changes

- abe0be5: Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

  `loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

  `@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.

  - @pie-qti/i18n@0.1.12
  - @pie-qti/ims-cp-core@0.1.12
  - @pie-qti/qti-common@0.1.12
  - @pie-qti/qti-processing@0.1.12
  - @pie-qti/typeset-katex@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.11
  - @pie-qti/ims-cp-core@0.1.11
  - @pie-qti/qti-common@0.1.11
  - @pie-qti/qti-processing@0.1.11
  - @pie-qti/typeset-katex@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.10
  - @pie-qti/ims-cp-core@0.1.10
  - @pie-qti/qti-common@0.1.10
  - @pie-qti/qti-processing@0.1.10
  - @pie-qti/typeset-katex@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.9
  - @pie-qti/ims-cp-core@0.1.9
  - @pie-qti/qti-common@0.1.9
  - @pie-qti/qti-processing@0.1.9
  - @pie-qti/typeset-katex@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.8
  - @pie-qti/ims-cp-core@0.1.8
  - @pie-qti/qti-common@0.1.8
  - @pie-qti/qti-processing@0.1.8
  - @pie-qti/typeset-katex@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.7
  - @pie-qti/ims-cp-core@0.1.7
  - @pie-qti/qti-common@0.1.7
  - @pie-qti/qti-processing@0.1.7
  - @pie-qti/typeset-katex@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.6
  - @pie-qti/ims-cp-core@0.1.6
  - @pie-qti/qti-common@0.1.6
  - @pie-qti/qti-processing@0.1.6
  - @pie-qti/typeset-katex@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.5
  - @pie-qti/ims-cp-core@0.1.5
  - @pie-qti/qti-common@0.1.5
  - @pie-qti/qti-processing@0.1.5
  - @pie-qti/typeset-katex@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.4
  - @pie-qti/ims-cp-core@0.1.4
  - @pie-qti/qti-common@0.1.4
  - @pie-qti/qti-processing@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.3
  - @pie-qti/ims-cp-core@0.1.3
  - @pie-qti/qti-common@0.1.3
  - @pie-qti/qti-processing@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.2
  - @pie-qti/ims-cp-core@0.1.2
  - @pie-qti/qti-common@0.1.2
  - @pie-qti/qti-processing@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/qti-processing@0.1.1
