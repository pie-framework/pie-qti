# @pie-qti/qti-common

## 1.0.0-beta.5

### Patch Changes

- 310b975: Single source of truth for two XML helpers that each existed in three drifted copies across the conversion packages:
  
  - **Catalog idrefs**: `qti-common/accessibility` now exports `CATALOG_IDREF_PATTERN` + `catalogIdrefFromMatch`, matching quoted (single/double) and bare attribute values. Previously the exporter parsed `data-catalog-idref` with a *different grammar* than the importer — a bare idref written by one side parsed differently on the other. The qti-common and to-pie readers now accept bare values too (backwards-compatible widening).
  - **XML escaping**: new canonical `escapeXmlAttribute` (safe inside `"..."` and `'...'`; also escapes apostrophes, so generated attributes containing apostrophes now carry `&apos;` — XML-equivalent). `pie-to-qti2`'s three identical `escapeXml` copies and `to-pie`'s local `escapeAttribute` delegate to it.
- 30bc3bf: One `escapeText` instead of three byte-identical copies: apip.ts and catalog-info.ts carried private duplicates of markup.ts's exported text escaper (`& < >`, quotes stay as authored) and now import it from markup, whose export remains the public `escapeText` of `qti-common/accessibility`. Emitted XML is unchanged byte for byte (the accessibility suites that assert the exact strings pass as before). The attribute escapers stay per-module on purpose: markup's `escapeXmlAttribute` also escapes `'` while apip/catalog-info's `escapeAttribute` escape `"` only, and unifying those would change emitted XML.
- 99341e5: QTI specification fixes in the scoring engine and item player, plus QTI Results Reporting output.
  
  - **Durations are seconds, as QTI defines them.** `@pie-qti/qti-processing` reads duration values as seconds: the specified `xsd:double` form (`<baseValue baseType="duration">30</baseValue>`, previously rejected as invalid) and, as a leniency, ISO 8601 (`PT30S`). `durationLT`/`durationGTE` normalize both operands, so a malformed duration is invalid instead of silently comparing false, and `match`/`equal` compare durations by their seconds. In `@pie-qti/item-player` the built-in `duration` variable now holds seconds, so response processing compares it with seconds. **Behavior change:** the QTI variable value seen in `ScoringResult.outcomeValues.duration`, `SerializedItemSessionState.contextVariables.duration` and `ItemSessionView.context.duration` is now seconds (it was milliseconds). The host-facing `duration` fields — `SerializedItemSessionState.duration`, `ItemSessionActionResult.duration`, `ItemSessionView.duration` — stay in milliseconds, and sessions saved before this change restore correctly. New helpers: `parseDurationSeconds`, `durationSeconds`, `durationSecondsFromMilliseconds`.
  - **Unsupported response-processing templates fail explicitly.** An item whose `responseProcessing` only references a template the player does not implement now fails compilation with `UnsupportedResponseProcessingTemplateError` (exported), instead of logging a warning and scoring its outcome defaults. The predefined `no_response_processing` template is supported (the standard empty program: outcomes keep their defaults); strict QTI compliance no longer rejects QTI 3.0 items.
  - **`strictQtiCompliance` validates the item.** Compilation checks the item's QTI namespace, its element names against the XSD-verified QTI 2.2/3.0 vocabulary (unknown QTI-namespace elements and unknown `qti-` elements), interactions whose `responseIdentifier` has no `responseDeclaration`, QTI interactions without a `responseIdentifier`, and response-bound elements no registered extractor renders (previously skipped silently). Findings are listed on the new `AssessmentItemDefinition.diagnostics` and logged: warnings by default, errors in strict mode, where versions other than QTI 2.2 and 3.0 are findings too. Strict mode with `rejectUnknownExtensions` throws a `QtiComplianceError` carrying them. **Behavior change:** strict mode no longer rejects QTI 3.0 items for not being QTI 2.2.
  - **matchGroup is enforced in response validation.** `validateResponses` reports pairs that `matchGroup` forbids in associate, match, gap match, graphic gap match and graphic associate responses (`match_group` errors, which block submission), so restored or programmatic responses cannot bypass the renderers' restriction.
  - **Version detection says when it guessed.** `@pie-qti/qti-common` adds `detectQtiVersionDetailed`, which returns the version `detectQtiVersion` returns together with its basis, a confidence and warnings — for example when an unversioned `assessmentItem` is assumed to be QTI 2.2. It also exports the QTI element vocabularies (`isQtiVocabularyElement`, `QTI2_ELEMENTS`, `QTI2_XHTML_ELEMENTS`, `QTI3_ELEMENTS`).
  - **QTI Results Reporting.** `@pie-qti/assessment-player` adds `toAssessmentResultXml(results, { version: '2.2' | '3.0' })`, which writes the assessment's results as a QTI Results Reporting `assessmentResult` document (context, test result with outcomes and durations, an item result per item with its status, response and outcome variables), and `serializeAssessmentResult` for hand-built reports.
  
  Deliberate deviations from the specification (Unicode folding in string comparison, duration lexical forms, the matchGroup reading) are documented in `docs/QTI_techguide.md` §7.4.
- fe86d42: Compiled-pattern reuse on the hot path (no behavior change):
  
  - `xsdPatternToRegExp` (qti-processing) translates and compiles an authored XSD pattern on every
    call, and `patternMatch`/`patternMask` validation runs per keystroke while authored patterns are
    static per item. Each (pattern, flags) pair is now compiled once and its `RegExp` shared
    through a bounded module-level memo (cleared past 512 entries, so a stream of distinct patterns
    cannot grow it without bound; cached `RegExp`s are stateful-free since no caller compiles with
    `g`/`y`). Failed compiles are cached too.
  - Feedback rendering (qti-common `processFeedbackInline`/`feedbackInlineAttr`) built a fresh
    `RegExp` per attribute lookup per feedback element per keystroke; the matchers for an attribute
    name (both QTI spellings) are now compiled once and shared, through the same bounded-memo
    shape. `feedbackInlineAttr` is now exported from `@pie-qti/qti-common` so hosts and tests can
    use the same reader.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 1.0.0-beta.4

### Patch Changes

- a4ef12c: Move the feedback-text utilities (`cleanFeedbackText`, `processFeedbackInline`, `DEFAULT_FEEDBACK_TRANSFORMS`, `DEFAULT_FEEDBACK_OUTCOME_ID`, `FeedbackTransform`, `ProcessFeedbackInlineOptions`) to `@pie-qti/qti-common`, which already owns the feedback visibility rule they build on (`isShownByIdentifier`). The `@pie-qti/item-player/components/utils` subpath export is removed — it existed only to expose these two functions to a single internal consumer. Import the functions from `@pie-qti/item-player`'s or `@pie-qti/qti-common`'s main entry instead.
- 406c76c: Surface silently-degraded host setup as one-time console warnings (new `warnOnce` helper in `@pie-qti/qti-common`):
  
  - No `i18n` provider on the item player: UI messages would render as raw keys (e.g. `item.parsingError`) and `lang`/`dir` attributes are never set.
  - `locale` attribute set without an `i18n` provider: previously a silent no-op.
  - Section TTS tool using the default host-served `/api/tts` endpoint: the host must serve that route or override the provider config.
  
  Warnings fire only on actual misconfiguration (deliberately not environment-gated, since the workspace ships both tsc- and vite-built outputs and a missing-wiring warning is useful in production too).

## 1.0.0-beta.3

No changes in this release.

## 1.0.0-beta.2

### Patch Changes

- 5dbabcc: Content and interface direction are now separate: player chrome takes `lang` and `dir` from the interface locale, while the item body, passages, rubrics and modal feedback take them from the content's `xml:lang`, and content that declares no language inherits the chrome's. Nested `xml:lang` spans get a `dir` where their direction differs from the surrounding text. `@pie-qti/i18n` exports `languageDirection`, `canonicalLanguageTag`, `contentLanguageAttributes` and `interfaceLocaleAttributes`, and `@pie-qti/section-player` now depends on `@pie-qti/i18n` directly.

## 1.0.0-beta.1

No changes in this release.

## 1.0.0-beta.0

### Patch Changes

- 32c08b7: Content language follows `xml:lang`. `prepareContentMarkup` restates it as `lang`; the item body takes its `lang` from the item, exposed as `Player.getContentLanguage()`, and glossary lookups pass it. The section player sets the toolbar and TTS language from it and picks a Polly voice for that language unless the host configures `defaultVoice`, which no longer defaults to Joanna; shared HTML blocks take an optional `language`.
- 0f93a03: Read-aloud markup reaches delivery. `prepareContentMarkup` moves from to-pie into `@pie-qti/qti-common/accessibility` and reads QTI 3 names; the item player renders SSML docked as catalog idrefs and `data-qti-suppress-tts` as `data-tts-suppress`, and the section player registers the SSML as `spoken` catalogs and projects QTI 3 interactions without suppressed content.
- a7c714e: `feedbackInline` resolves in either QTI spelling, nested and by membership in a container outcome, in the item body, choice text, rubric blocks and modal feedback; `qti-common` exports the shared visibility rule as `isShownByIdentifier`.

## 0.1.28

### Patch Changes

- 6af3354: The QTI 3 element map now covers every `qti-*` element of the QTI 3.0 schema, including test structure, shared stimuli and companion materials, so `toNative` and `isQti3Element` answer for them; six names the schema does not declare are removed.
- 8fd28e3: Add a QTI 3.0 export: `targetVersion: '3.0'` on `PieToQtiPlugin` writes QTI 3.0 items, stimuli, tests and content packages, with catalogs as `qti-catalog-info`. `@pie-qti/qti-common` gains `convertQti2ToQti3` and `writeQtiCatalogInfo`; `@pie-qti/to-pie` reads the export back, unwrapping `qti-content-body` and resolving a stimulus reference by its PIE passage id.

## 0.1.27

### Patch Changes

- 498b1e2: `@pie-qti/qti-common/accessibility` maps APIP 1.0 access elements to and from QTI 3 support cards: `readApipAccessElements` reads them with their content links, and `writeApipAccessibility` writes cards as `apip:apipAccessibility`, reporting the supports APIP has no element for.

## 0.1.26

### Patch Changes

- 5627ce1: to-pie converts QTI 3.0 items, stimuli and tests: `normalizeQti3ToQti2` renames them into the QTI 2.2 vocabulary at the entry point, a vendor transformer still sees the authored document, and a portable custom interaction stays rejected. QTI 3.0 catalogs, APIP access elements and inline SSML become PIE accessibility catalogs keyed by `data-catalog-idref`, companion materials land in `metadata.companionMaterials`, and anything not carried warns `QTI_ACCESSIBILITY_NOT_CARRIED`. Passages convert once per stimulus document through `convertQtiPassageDocument` and come out of the package transform beside the items, prompts keep only the stem, and an unresolvable passage reference warns `QTI_PASSAGE_UNRESOLVED`. `PieAssessment` drops `accessibilityCatalogs` and `stimulusRefs` along with the `StimulusRef` type, and its sections carry `rubricBlocks` in the PIE players' `RubricBlock` shape in place of `rubricRefs`. qti-common exports `QTI3_ATTRIBUTE_TO_QTI2` and `QTI2_PROMPT_BEARING_INTERACTIONS`.

## 0.1.25

No changes in this release.

## 0.1.24

### Patch Changes

- 5c8a8e8: Route touch-generated drag events to the actual drop target inside nested open shadow roots, use the source element's owner document, and clear active drag state when the action is destroyed.
- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.

## 0.1.23

## 0.1.22

## 0.1.21

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

## 0.1.19

## 0.1.18

## 0.1.17

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
