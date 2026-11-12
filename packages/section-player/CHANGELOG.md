# @pie-qti/section-player

## 1.0.0-beta.5

### Minor Changes

- d3619a3: Final review fixes for the section player shells:
  
  - **Additive (section elements)**: both section elements now dispatch typed, bubbling, composed `qti-section-framework-error`, `qti-section-display-settings` and `qti-section-item-pane-ready` events alongside `qti-section-response-delta`; expose a `display-settings` attribute (`display-settings="false"` turns the candidate's display settings tool off) and a `focusActiveItem(options?)` skip-link helper. A composition the layouts cannot render (a hand-built object missing `sharedContext` or the response snapshot) emits `qti-section-framework-error` with code `invalid-composition` instead of throwing an uncaught `TypeError` from the Svelte render. The player-elements README documents the event surface and the remaining FontAwesome-suppression CSP implication (the `data:` marker stylesheet now renders inside the section's own DOM instead of the host `<head>`).
  - **Behaviour fixes (display settings)**: a candidate's display settings raise the host profile's floor instead of overwriting it — a 24pt profile no longer shrinks to 14pt on "Large", and "Extra text spacing" no longer drops a `lineHeight: 2.0` profile to 1.5. `withDisplaySettings` subtracts the settings' own fingerprints (a size step, the black-on-white scheme, the exact reference-spacing triple) from the incoming profile before applying, so the documented resume contract (persist the effective `pnp`, pass it back as the candidate's PNP) keeps the toggles reversible; section layouts seed the tool's controls from `displaySettingsOf` when no session settings exist, so a persisted profile starts where the candidate left off.
  - **Behaviour fixes (layouts)**: an item whose speech extraction is rejected (a `<!DOCTYPE>`, an item over the parsing limits) degrades to no read-aloud catalogs with a `QtiSectionFrameworkError` diagnostic instead of aborting the section layout's update batch; a failed item player element load is retried for the next item instead of sticking; test feedback renders in both section layouts through a persistent `aria-live` region (the region exists before its content, per WCAG 4.1.3); stacking the split panes keeps focus in whichever pane holds it (WCAG 2.4.3/2.4.7); the splitter reports and steps within the percentages its container can actually take.

### Patch Changes

- 4e5f1a8: Accommodations and tools in the section player.
  
  - **Display accommodations cover the whole section.** A section layout (`SectionPlayerSplitPane`, `SectionPlayerVertical` and their custom elements) applies the candidate's PNP display needs — colour scheme, inverted polarity, single-column layout, text appearance, magnification metadata — to its own root, a PNP surface, so passages, stimuli, rubric blocks, tool bars, the Passage/Question tabs, item headers and items all take them. The host page outside the layout is never repainted. Item bodies inside a surface leave their display needs to it, so one profile governs passage and question and an inverting filter applies once. A single-column need stacks the split pane behind its tabs at any width. The layouts apply their `pnp` prop, else the new `ResolvedQtiSectionComposition.pnp`, which `resolveQtiSectionComposition` now carries along with `assessmentId`.
  - **Candidates can adjust their display.** A "Display settings" button in the item tool bar opens an accessible native modal on the section surface: text size (Default, Large, Larger, Largest), higher-contrast text and extra text spacing, applied through the PNP mechanisms (`withDisplaySettings`). Settings last for the page session per assessment, also across a split-pane/vertical layout swap, and every change reaches the host as `{ sectionIdentifier, settings, pnp }` through the layouts' `onDisplaySettingsChange` and `QtiSectionRuntimeHostContract.onDisplaySettingsChange`, with the effective profile to persist. `displaySettings={false}` leaves the tool out; `initialDisplaySettings` and `displaySettingsOf()` restore persisted settings.
  - **Ruler and protractor render.** The tool bars register the packaged `ruler` and `protractor` tools, so the measurement tools the PNP and an item's companion materials grant are no longer granted but invisible. Companion materials become the item scope's required tools, and section-scoped tools render on the active item's tool bar.
  - **Tool bars bind the real assessment, with PNP enforcement on.** The hardcoded `qti-section-demo` id is gone: the toolkit takes the composition's `assessmentId` (else the section identifier) and the candidate's PNP tool supports as its profile, so granted tools are protected and prohibited ones withdrawn.
  - `@pie-qti/item-player` exports `applyPnpToSurface`, `clearPnpSurface`, `isWithinPnpSurface` and `PNP_SURFACE_ATTRIBUTE` for hosts that paint a larger surface themselves.
  - New catalog keys `sectionPlayer.displaySettings.*` in every locale.
- fc99dd9: The passage collapse control keeps one name in both states (WCAG 4.1.2).
  
  Its accessible name used to carry the state as an action verb ("The Water Cycle — Collapse passage", then "The Water Cycle — Expand passage") while `aria-expanded` changed as well, so the state was announced twice and the name a voice-control user speaks changed with every press. The control is now labelled by the passage's heading ("The Water Cycle", or the neutral "Passage" / "Passage 2" for an untitled one) and `aria-expanded` alone carries the state. The visible chevron is unchanged.
  
  **Breaking: locale keys removed** (beta prerelease). `assessment.expandPassage` and `assessment.collapsePassage` have no use left and are removed from all locales. Hosts that override these keys in a custom catalog can drop the overrides.
- bf483a3: Name each passage's collapse toggle for its own passage (WCAG 2.4.6/4.1.2). The icon-only
  expand/collapse control previously announced "Expand passage"/"Collapse passage" for every
  passage, so with several passages on screen a screen-reader user could not tell which passage a
  toggle belonged to. The accessible name is now composed from the passage's heading (authored
  title, or the neutral "Passage"/"Passage 2" label) plus the translated verb, e.g. "The Water
  Cycle — Collapse passage"; the visible icon, `aria-expanded` and the existing i18n keys are
  unchanged.
- 098f997: Round-3 accessibility fixes for content language, transient UI on pause, and forced colors:
  
  - **Test-level content keeps its language (WCAG 3.1.2):** the assessmentTest parser now carries
    the authored language of each `testFeedback` and `rubricBlock` (passages, instructions) as an
    optional `language` field: its own `xml:lang` (QTI 3.0 also `lang`, or its
    `qti-content-body`'s), else the enclosing test part's, section's or test's, across an
    `assessmentSectionRef` too; `xml:lang=""` declares none. `TestFeedbackItem`,
    `VisibleTestFeedback` and `AssessmentRubricBlock` gain the optional field,
    `normalizeQtiSharedContext` passes it through as `QtiSharedHtmlBlock.language`, and the section
    player's `TestFeedback` renders it as each block's `lang`/`dir` — in delivery and on the
    completion screen — so screen readers and read-aloud switch to the content's voice while the
    chrome keeps the interface locale. A passage's nested `xml:lang` is now restated as HTML `lang`
    (with `dir` where the direction changes against the passage's own language) even without SSML.
  - **Transient UI closes on a proctor pause:** the math-input dialog and glossary/catalog popups
    listen for the host's `pie-qti-close-transient-ui` event on `document` (the assessment shell
    dispatches it with `detail.reason: 'pause'`). The math dialog closes through its cancel path
    (`onCancel`, focus trap released, focus back on its opener) and a request that arrives while
    MathLive is still loading cancels it before it opens; an open popup closes as if dismissed. The
    math dialog's focus trap is re-entrancy-safe: it never re-handles the focus moves it makes, so it
    cannot recurse against another focus containment such as the pause overlay.
  - **States survive forced colors (WCAG 1.4.11/1.4.1):** in Windows High Contrast and other
    forced-colors modes the picked-up item of a reorderable list keeps a heavier system `Highlight`
    border (no layout shift), and pressed Bold/Italic toolbar toggles in the rich-text editor take
    the system selection colours. Focus outlines are unchanged.
- ad99965: Accessibility fixes from the round-4 WCAG 2.2 AA review:
  
  - **Interactions state their minimum requirement** (WCAG 3.3.2, 3.3.3). Choice, match, associate, order, gap match, hotspot and graphic order interactions show a visible hint while the response is below its authored minimum (`minChoices`, `minAssociations`, a choice's `matchMin` in match, associate and gap match), the same minimums response validation enforces before an answer counts as complete. The author's `data-min-selections-message` wins over the localized default ("Select at least 2 answers.", "Needs more associations: Red.", "Still to place in the blanks: blue and green."). The hint describes the answer group (`aria-describedby`), draws in `--pie-qti-warning-text`, and is announced politely once when a change leaves the minimum unmet, not on every change. It shows only while the candidate can answer: not when the interaction is disabled or rendered for another role.
  - `@pie-qti/item-player` delivers `minSelectionsMessage` for order and associate interactions, also reads the QTI 3.0 `data-min-selections-message` on match interactions, and extracts graphic order `minChoices` (with its message), which response validation now enforces. `GapMatchInteractionData` choices carry `matchMin`.
  - New `interactions.*` catalog keys in every locale: `choice.minChoicesHint`, `match.minAssociationsHint`, `match.minChoiceUsesHint`, `associate.minAssociationsHint`, `associate.minChoiceUsesHint`, `order.minChoicesHint`, `graphicOrder.minChoicesHint`, `hotspot.minChoicesHint` and `gapMatch.minPlacementsHint`.
  - **PNP inverted polarity no longer inverts a forced-colours palette**: under `@media (forced-colors: active)` the inversion filter is off, so Windows high contrast keeps the colours the candidate chose.
  - **A proctor pause keeps a typed math expression**: the math dialog reports a host close as an interrupted cancel with the LaTeX typed so far, and the rich-text editor offers it again in its next insert dialog. The draft is session-only and per response field; inserting the math or the candidate's own cancel discards it.
  - **Nested languages in section content**: an `xml:lang` inside test feedback, instructions or rubrics now renders as HTML `lang` (with `dir` where the direction changes), as in passages (WCAG 3.1.2).
- d6ac3bb: **Section events are delivered once** (beta prerelease). The section layouts fired every framework error, response delta and display-settings change through both channels — the composition's `QtiSectionRuntimeHostContract` callback *and* the layout's callback prop — so a host that supplies the contract (the natural way to carry the package/URL-policy hooks) and embeds `pie-qti-section-player-*` listening to the documented DOM events heard every occurrence twice. The two channels are alternatives, as the README always said: the layout now delivers through the host contract's callback when the composition's `host` carries it, and the callback prop — the custom elements' DOM event source — fires only when that slot is absent. A host relying on the double delivery (there is no reason to) sees one event per occurrence now.
- 2667df1: The assessment shell and section player no longer require DaisyUI or Tailwind on the host page.
  
  - **Self-contained styling**: the shell (`<pie-qti-assessment-player>`) and section players (`<pie-qti-section-player-splitpane>`, `<pie-qti-section-player-vertical>`) style themselves with scoped CSS on the `--pie-qti-*` tokens, with fallbacks when no theme is loaded. Icons are sized by the components, buttons are ≥44px with visible 2px focus rings, and alerts, spinners, the splitter and test feedback no longer read DaisyUI `--color-*` variables. Existing class names and `data-testid` hooks are kept.
  - **Layout**: the shell fills its host container instead of a fixed `100vh` box (`--pie-qti-assessment-min-block-size` / `--pie-qti-assessment-max-block-size` tune the bounds when the host gives no height). A new `full-viewport` attribute (`fullViewport` property) fills the dynamic viewport with safe-area insets and page-level `header`/`main`/`nav` landmarks. At short viewports (400% zoom, landscape phones) everything flows in one scroll and no bar is pinned over the content.
  - **Phones**: navigation is one compact row (Previous, position, Next/Submit), nested gutters collapse to one slim gutter, and a passage shares the screen with the question through an accessible Passage/Question tab switch instead of a 40%-height scroll box. Wide screens keep the keyboard-resizable splitter.
  - **Accessibility**: a "Skip to question" link, a region named by the assessment title, a labelled navigation landmark, Previous/Next arrows mirrored right-to-left, and navigation buttons that keep focus while a transition is in flight.
  - **Polish**: the header shows the assessmentTest `title` (or a localized generic title), never the identifier; untitled sections no longer read "Section 2 of 0"; passages are headed by their `title` or a neutral localized "Passage" label at a heading level that fits the outline (`heading-level` attribute on the assessment and section elements). Item load failures show a localized message instead of the raw error.
  - **Host CSS**: a low-priority `@layer pie-qti-base` restores user-agent defaults (lists, headings, paragraph spacing, link underlines, inline images, bordered tables, media max-width) inside item, passage and rubric content, so host resets no longer strip question stems.
  - **APIs**: `AssessmentPlayer.getAssessmentTitle()`; optional `title` on `QtiSharedHtmlBlock`; the reference parser leaves a missing assessmentTest title empty instead of English "Assessment". `@pie-qti/i18n` adds `assessment.skipToQuestion` and a `sectionPlayer` section across all eight locales.
- 20e8e52: Section tool bars move to `@pie-players` 1.0.0-beta.9 and render in the interface language, with each locale's catalog loaded only when a tool bar needs it.
  
  - **The tool packages are on 1.0.0-beta.9.** `pie-assessment-toolkit`, `pie-default-tool-loaders`, `pie-tool-tts-inline` and `pie-tool-calculator-desmos` move from 1.0.0-beta.6 to 1.0.0-beta.9. The section player also declares `pie-calculator-desmos`, `tts-client-server`, `@pie-players/pie-players-shared` and `@pie-players/pie-i18n-generated` as runtime dependencies, all at 1.0.0-beta.9.
  - **The toolkit's chrome follows the interface locale.** In 1.0.0-beta.9 the toolkit's default provider ships English only. The tool bar now gives the toolkit a provider over the two pie-players catalog tiers, composed as pie-players documents: the bundled catalog first, then `@pie-players/pie-i18n-generated`. A Dutch interface reads "Voorlezen starten", and Arabic, Spanish, French, Romanian, Thai, Chinese and the other locales that package ships get their own toolkit chrome. A regional tag reaches its language (`es-MX` → `es`, `nl-BE` → `nl-NL`), and the toolkit's `lang` names the catalog it renders.
  - **Catalogs load lazily, one locale at a time.** English is bundled and needs no fetch, so an English page loads nothing extra. The generated package is reached only through a dynamic `import()`, the first time a tool bar needs a non-English locale. Each locale's catalog is a chunk of its own, fetched only for that locale, and every tool bar on the page shares it. The catalog loads before the toolkit renders, so a non-English tool bar does not appear in English first.
  - **A locale with no catalog falls back to English.** It renders the toolkit in English under its own tag. The pseudo-locales render English without fetching a catalog: `ar-XB` keeps its own `lang` and right-to-left `dir` instead of resolving to the Arabic catalog. If the generated package fails to load, tool bars render in English and the section player warns once.
- b8a2862: No section label shows a raw i18n key.
  
  - **A provider that misses a key no longer puts the key in a label.** The passage collapse control composes its name from the passage heading and an action verb. Under a host provider that answers a lookup without a default with the key, it read "Passage — assessment.collapsePassage". The section's labels now go through one helper that falls back to the English phrase whenever a provider hands back the key. That covers the passage, instructions, rubric and test feedback regions, the item heading and loading messages, the split-pane labels and resizer, and the display settings button and dialog. Some of these labels also rendered empty without a provider; they now read the English phrase.
- 2916759: Dead-code removal in the assessment and section players (cleanup phase 1). Delivery is unchanged: navigation, submission gating, attempts, timing, scoring and the reference backend behave exactly as before.
  
  **Breaking: removed APIs** (beta prerelease; migrate before upgrading):
  
  - `@pie-qti/assessment-player`: the `rng` option of `AssessmentPlayer.create()` (`BackendAssessmentPlayerConfig.rng`) is gone. It has been ignored since the backend started drawing selection and ordering at session start. Pass the seed to the reference backend instead: `new ReferenceBackendAdapter({ rng })`.
  - `@pie-qti/assessment-player`: `AssessmentPlayer.getItemSessionInfo()` no longer takes an item identifier. The argument was ignored: the method always reported the current item, and still does. Drop the argument.
  - `@pie-qti/assessment-player` no longer exports `shortSupportCode`, `isSubmissionBlockedError`, or the types `ItemRef` and `NavigationMode`. Nothing outside the package used them and no documentation named them. For a support code, read `assessmentErrorDisplay(error).supportCode`. To recognize a refusal that names unanswered questions, check `isAssessmentPlayerError(error)` and its `code` (`finalizeResponseRequired`, `finalizeResponseInvalid`, `leavePartResponseRequired` or `leavePartResponseInvalid`). No API took or returned `ItemRef` or `NavigationMode`.
  - `@pie-qti/section-player` no longer exports `hasDisplaySettingsChanged`. To test whether a candidate changed the display settings, compare them with `DEFAULT_DISPLAY_SETTINGS` (a different `textSize` step, or `highContrast` or `textSpacing` on).
  
  **`@pie-qti/section-player` dependencies:** `@pie-players/pie-calculator-desmos` and `@pie-players/tts-client-server` are no longer direct dependencies. The section player never imported them; `@pie-players/pie-default-tool-loaders`, which loads the calculator and read-aloud tools, declares and imports them itself, so they are still installed, at the same version. An app that imported either package without declaring it should add it to its own dependencies.
  
  Also removed, internal to `@pie-qti/assessment-player` and never reachable from its entry points: the navigation-gating `ItemSessionController.canNavigateAway()` and `validateItem()` (with the coordinator's wrapper), `ItemSessionController.resetItem()` and `clear()`, the reference session store's `removeSession()`, and the never-set `currentSectionStartTime` timing field. QTI gates submission, not navigation: `allowSkipping` and `validateResponses` stay enforced where they were, by the submission gate and the item player's response validation.
  
  `@pie-qti/player-elements`: the documentation of `QtiAssessmentPlayerConfig.rng`, which still seeds the element's built-in reference backend, no longer points at the removed headless option.
- 8d03d05: Module boundaries (cleanup phase 3), with one fix.
  
  **Fix: a coded error keeps its code across copies of the package.** `isAssessmentPlayerError` (and `assessmentErrorDisplay`, which builds on it) used `instanceof`, which fails for an `AssessmentPlayerError` created by another copy of `@pie-qti/assessment-player`. The `<pie-qti-assessment-player>` bundle carries two copies — it compiles the shell and core from source and also imports the package's built entry — so a coded error reached the `player-error` event without its `code`. A host that loads `@pie-qti/assessment-player` beside the self-contained player-elements bundle met the same split. Every `AssessmentPlayerError` now carries a `Symbol.for('pie-qti.AssessmentPlayerError')` brand, which the guard checks; recognize coded errors with `isAssessmentPlayerError`, not `instanceof`.
  
  Without behavior changes:
  
  - `@pie-qti/section-player` exports `filterToolsForRole`, the tool filter its composition applies. `@pie-qti/assessment-toolkit`'s `normalizeQtiToolConfig` is now that filter without PNP supports: the same result, still an array.
  - `@pie-qti/item-player` exports `DEFAULT_COMPONENT_TAGS_BY_TYPE`, its default custom-element tag per interaction type (plus `catalogPopup`), and `@pie-qti/default-components` derives `registerDefaultComponents` from it. Tag names are unchanged; the registrations' debugging `description` is now generic (`Default Svelte-based component for <type>`).
  - Internal: unpublished component source is imported through one workspace alias map instead of `../../../<pkg>/src` paths; item-player's presentation code no longer imports from its Svelte component helpers; the reference backend's session key prefix (`qti_session_`) is defined once, so saved sessions resume as before.
- 611b971: Player cleanup, phase 4 (assessment-player and section-player): three internal deduplications with no intended behavior change.
  
  **Shared section layout.** `SectionPlayerVertical` and `SectionPlayerSplitPane` move their duplicated section body — the role/security/PNP/display-settings state, the runtime-host notifications, the response and framework-error handlers, and the passage, rubric+item and display-settings fragments — into a shared `SectionLayout` module that both render through a layout-provided frame. Role and view filtering stays in `resolveQtiSectionComposition`. The rendered DOM, landmarks, headings and focus order are unchanged (pinned by new component tests); `focusActiveItem`, the props and the `onItemPaneReady`/`onResponseChange`/`onFrameworkError`/`onDisplaySettingsChange` callbacks keep their shapes.
  
  **One attempt-relative feedback helper.** New (internal) `resolveMaxAttempts(settings, adaptive)` and `attemptFeedbackVisible({ showFeedback, maxAttempts, attempts, adaptive })` in assessment-player carry the player's feedback semantics that `AssessmentPlayer.feedbackVisible` and the check-answer state used to inline; the private `resolvedMaxAttempts` is gone. `getItemSessionInfo().showFeedback` keeps its current semantics — it stays false before the item's first submission even when `itemSessionControl@showFeedback` is on, reads the live recorded attempt count rather than the projected one, and treats an adaptive item as unlimited only through its resolved settings — and now shares the attempt-relative arithmetic with the presentation rule.
  
  **`TimeManager.formatTime` moved.** The clock readout is now a standalone `formatTime` util (still not re-exported from the package root, like `TimeManager` itself); `TimeManager.formatTime` is removed with it. Nothing outside the package could call it, and the rendering is byte-identical.
- fa577a0: No-legacy removals in the assessment and section players (legacy audit items A1 to A4). The project is pre-1.0 and keeps no compatibility paths for its own earlier APIs, wire shapes or stored formats. Spec-conformant delivery, scoring, timing and test feedback behave as before.
  
  **Breaking:**
  
  - **`FinalizeAssessmentResponse.feedback` is gone** from `@pie-qti/assessment-player`, and so from `QtiAssessmentFinalizeResponse` in `@pie-qti/player-elements`, which aliases it. The contract documented it as "legacy: single string; prefer outcomes + assessment.testFeedback". For a test without `testFeedback`, the player showed that string as one synthetic end-of-test feedback entry. Test feedback now comes only from the test's and its test parts' `testFeedback` blocks, evaluated against the outcomes the backend returns. To migrate a backend that answered `finalizeAssessment` with a feedback string, author the text as `testFeedback` in the assessmentTest and return the test-level `outcomes` that select it. `SubmitItemResponse.feedback` (the per-item `FeedbackItem[]`) is unchanged.
  - **The reference backend no longer rebuilds an item's test-level state from its stored score** (`ReferenceBackendAdapter`). Sessions it stored before item test states existed (earlier beta builds) hold only `itemScores` for their submitted items. Outcome processing used to rebuild those items' variables from the scores, count them as responded from their raw responses, and infer correctness from SCORE and MAXSCORE. Such items now reach outcome processing as presented with only their SCORE: not responded, neither correct nor incorrect. Their scores still count toward the totals. Sessions stored by current builds are unaffected. A submission whose response processing fails still counts as presented, and as responded when the candidate gave a response, as before.
  - **`responseInvalid` is no longer an `AssessmentPlayerErrorCode`.** The `@pie-qti/i18n` catalogs no longer carry its message (`assessment.errors.codes.responseInvalid`) in any of the eight locales, and `MessageKey` no longer includes that key. Nothing has thrown the code since navigation stopped gating on response validity (cleanup phase 1): invalid responses are refused at submission, with `attemptValidationFailed`, `finalizeResponseInvalid` or `leavePartResponseInvalid`. Drop the code from any `switch` and the key from catalog overrides.
  - **`@pie-qti/section-player` no longer maps the pre-1.0 toolkit TTS provider shape.** A `textToSpeech` tool's `provider` now applies over the section player's defaults as given. To migrate, name the backend with `backend` (`'server'` or `'browser'`) and the server with `serverProvider` instead of a string `provider`, move `settings` keys to the top level, and use `endpointValidationMode: 'none'` instead of `validateEndpoint: false`. The old keys now reach the toolkit unchanged, and the toolkit rejects a string `provider`.
  
  Also removed, internal to `@pie-qti/assessment-player` and never reachable from its entry points: `TimeManagerConfig.warningThreshold`, which was kept "for compatibility" and merged into `warningThresholds`. The player now passes the whole warning list, so `TimeManager` fires exactly the thresholds it is given. The host options are unchanged: `timeWarningThreshold` (default 60) sets the default warning and `timeWarningThresholds` adds to it.
- 07f1bc2: Section player fixes around error reach and tool-bar coordinator lifecycle:
  
  - **Split pane restore**: the persisted split percentage is restored again on mount. The initialization effect clobbered the `onMount` restore back to the 50% default (the restore path was dead code), so a candidate's saved split never survived a reload. The persisted value now wins and the prop default is only the fallback.
  - **Tool-bar coordinator lifecycle**: a reused tool bar now applies tool-policy changes to its `ToolkitCoordinator` instead of keeping the first scope's snapshot — placement moves through `updateToolsPlacement`, provider config changes through `updateToolConfig`, and a changed `tools.policy` allowlist (no mutator exists) rebuilds the coordinator. The bar also disposes the coordinator it owns on unmount, so a shell retry that unmounts and remounts tool bars no longer leaks one coordinator per remount. A host that captured the coordinator through the `qti-toolkit-coordinator-ready` event and kept using it after the bar went away now sees a disposed coordinator.
  - **Error reach**: `QtiToolButtonBar` gained an `onFrameworkError` prop (per the runtime-host contract pattern) and reports toolkit element chunk failures with the new code `toolkit-load-failed`; `ItemRenderer` and `RubricDisplay` forward their existing `onFrameworkError` to the bars they render. `ItemRenderer` now also bridges the inner `pie-qti-item-player` element's bubbling `error` event to `onFrameworkError` (code passthrough with `item-load-failed` / `response-processing-failed` / `submission-failed` / `render-failed`), so item failures inside a section reach `onFrameworkError` / `qti-section-framework-error`. The README documents the `qti-section-framework-error` event, its detail shape and every code.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [310b975]
- Updated dependencies [64f6607]
- Updated dependencies [35bd0c3]
- Updated dependencies [d7a8262]
- Updated dependencies [30bc3bf]
- Updated dependencies [91d2e05]
- Updated dependencies [23a4077]
- Updated dependencies [bd67d58]
- Updated dependencies [0f11f98]
- Updated dependencies [4e5f1a8]
- Updated dependencies [2fa635f]
- Updated dependencies [7dcb9d7]
- Updated dependencies [bc7e8f6]
- Updated dependencies [b504c41]
- Updated dependencies [756771f]
- Updated dependencies [0a1c071]
- Updated dependencies [7cbed03]
- Updated dependencies [bdfc40e]
- Updated dependencies [3d51b92]
- Updated dependencies [0973689]
- Updated dependencies [f6e7714]
- Updated dependencies [209a0c0]
- Updated dependencies [eb50277]
- Updated dependencies [7c451f7]
- Updated dependencies [3a31af2]
- Updated dependencies [2f43e0e]
- Updated dependencies [6128449]
- Updated dependencies [8c4274b]
- Updated dependencies [ac81831]
- Updated dependencies [ee233f4]
- Updated dependencies [19b6ce2]
- Updated dependencies [495730a]
- Updated dependencies [0cf8193]
- Updated dependencies [fc99dd9]
- Updated dependencies [9c75e43]
- Updated dependencies [72b3545]
- Updated dependencies [cfb78e2]
- Updated dependencies [99341e5]
- Updated dependencies [9cd2772]
- Updated dependencies [372037e]
- Updated dependencies [9814c9b]
- Updated dependencies [098f997]
- Updated dependencies [410fe38]
- Updated dependencies [9abdf17]
- Updated dependencies [c6ae98c]
- Updated dependencies [ad99965]
- Updated dependencies [d6ac3bb]
- Updated dependencies [fff7dd7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [fe9e624]
- Updated dependencies [7cff6aa]
- Updated dependencies [362b7c1]
- Updated dependencies [2e4f6fb]
- Updated dependencies [816c8f8]
- Updated dependencies [3ed760e]
- Updated dependencies [9cb24ad]
- Updated dependencies [90d1c60]
- Updated dependencies [01fb4d1]
- Updated dependencies [d7d744e]
- Updated dependencies [9e07058]
- Updated dependencies [dc38e3b]
- Updated dependencies [af961a1]
- Updated dependencies [c85ea64]
- Updated dependencies [209a0c0]
- Updated dependencies [2667df1]
- Updated dependencies [74c3886]
- Updated dependencies [de1eed5]
- Updated dependencies [a1c989d]
- Updated dependencies [30bc3bf]
- Updated dependencies [b34d710]
- Updated dependencies [f13613d]
- Updated dependencies [643ae6c]
- Updated dependencies [51e70e8]
- Updated dependencies [88b69c0]
- Updated dependencies [30bc3bf]
- Updated dependencies [68c8b37]
- Updated dependencies [ecbc9ef]
- Updated dependencies [5e5072a]
- Updated dependencies [795c767]
- Updated dependencies [91d2e05]
- Updated dependencies [6d4d19d]
- Updated dependencies [6d4d19d]
- Updated dependencies [befc768]
- Updated dependencies [e7188e4]
- Updated dependencies [35bd0c3]
- Updated dependencies [fe86d42]
- Updated dependencies [500b714]
- Updated dependencies [47e9176]
- Updated dependencies [a183a16]
- Updated dependencies [7cf746f]
- Updated dependencies [8d03d05]
- Updated dependencies [1449b94]
- Updated dependencies [562182a]
- Updated dependencies [b5d8bf7]
- Updated dependencies [2fd1003]
- Updated dependencies [4f9a07c]
- Updated dependencies [edd4020]
- Updated dependencies [281d6fb]
- Updated dependencies [93df941]
- Updated dependencies [fa577a0]
- Updated dependencies [0bdb7f1]
- Updated dependencies [7c767d4]
- Updated dependencies [b38cb07]
- Updated dependencies [db8e08f]
- Updated dependencies [3b3927e]
- Updated dependencies
- Updated dependencies [9ec0f69]
- Updated dependencies [b668938]
  - @pie-qti/qti-common@1.0.0-beta.5
  - @pie-qti/default-components@1.0.0-beta.5
  - @pie-qti/item-player@1.0.0-beta.5
  - @pie-qti/i18n@1.0.0-beta.5
  - @pie-qti/ims-cp-core@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- 15ef671: Align declared dependencies with what shipped code actually imports, enforced by a new `check:dist-dependencies` gate (added to `verify:publish:quick` and `lint:all`):
  
  - `@pie-qti/player-elements` now declares `@pie-qti/default-components`, `@pie-qti/i18n`, and `@pie-qti/section-player` as real dependencies: shipped declarations import their types, so consumer typechecks no longer depend on hoisted installs.
  - `@pie-qti/transform-core` no longer installs `@pie-qti/test-utils` (and transitively `@pie-qti/storage`) at runtime; the same cleanup moves build-only `@pie-qti/transform-core` out of `@pie-qti/to-pie` / `@pie-qti/pie-to-qti2` runtime dependencies, drops unused `@tiptap/*` runtime entries from `@pie-qti/default-components` (bundled into its bundle, now devDependencies), and removes never-imported dependencies from `@pie-qti/assessment-player`, `@pie-qti/assessment-toolkit`, `@pie-qti/test-utils`, and `@pie-qti/section-player` (the two `@pie-players` packages that were only ever resolved transitively).
- 406c76c: Surface silently-degraded host setup as one-time console warnings (new `warnOnce` helper in `@pie-qti/qti-common`):
  
  - No `i18n` provider on the item player: UI messages would render as raw keys (e.g. `item.parsingError`) and `lang`/`dir` attributes are never set.
  - `locale` attribute set without an `i18n` provider: previously a silent no-op.
  - Section TTS tool using the default host-served `/api/tts` endpoint: the host must serve that route or override the provider config.
  
  Warnings fire only on actual misconfiguration (deliberately not environment-gated, since the workspace ships both tsc- and vite-built outputs and a missing-wiring warning is useful in production too).
- Updated dependencies [b91a4a3]
- Updated dependencies [15ef671]
- Updated dependencies [a4ef12c]
- Updated dependencies [25ae481]
- Updated dependencies [bc58949]
- Updated dependencies [406c76c]
- Updated dependencies [fb2b4e2]
- Updated dependencies [29210b4]
  - @pie-qti/default-components@1.0.0-beta.4
  - @pie-qti/item-player@1.0.0-beta.4
  - @pie-qti/qti-common@1.0.0-beta.4
  - @pie-qti/ims-cp-core@1.0.0-beta.4
  - @pie-qti/i18n@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [c408053]
- Updated dependencies [e69c39d]
  - @pie-qti/ims-cp-core@1.0.0-beta.3
  - @pie-qti/default-components@1.0.0-beta.3
  - @pie-qti/item-player@1.0.0-beta.3
  - @pie-qti/i18n@1.0.0-beta.3
  - @pie-qti/qti-common@1.0.0-beta.3

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
