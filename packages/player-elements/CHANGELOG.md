# @pie-qti/player-elements

## 1.0.0-beta.5

### Minor Changes

- 333ee9a: **Additive: per-item injection properties on `pie-qti-assessment-player`** (beta prerelease). The assessment element now exposes the same per-item injection properties its two sibling elements already had, closing the rule gap where `security` and `pci` were properties on all three elements while the rest existed only inside `config`:
  
  - `role` — the QTI view every item renders for, declaratively the `qti-role` attribute (a bare `role` attribute stays the ARIA role, like the item element; unknown values warn and render the candidate view);
  - `i18n` — the interface locale provider (the config spells it `i18nProvider`);
  - `pnp` — the candidate's PNP profile;
  - `plugins` — definition-lifetime extensions applied to every item definition;
  - `stringComparison` — opt-in folds for string comparison in scoring.
  
  Each wins over the same-named `config` field and forwards into the config the element builds for the shell; setting a property re-renders a mounted shell like a `config` change. Hosts who wrote `item.i18n = provider; sectionEl.i18n = provider;` can now write `assessment.i18n = provider` too, instead of knowing the name changes to `i18nProvider` and moves inside `config`.
- 333ee9a: **Breaking: `QtiPciConfiguration` renamed to `QtiPciHostConfiguration`** (beta prerelease). The exported type collided with an unrelated, structurally incompatible type of the same name: `@pie-qti/item-player` exports `QtiPciConfiguration` for the config object a PCI module's `getInstance()` factory receives (the QTI 3.0 §6.1 module-facing contract), while this package's same-named export was the host trust configuration for running PCI modules (page-realm resolver or sandboxed runner) — a hand mirror of item-player's `PciConfiguration`. Hosts importing the name from both sibling packages got two different types. The new name says who configures what (`Host` = the trust decisions a host makes about module execution) and keeps the `QtiPci*` family grouping in the facade (`QtiPciModuleResolver`, `QtiPciSandboxConfiguration`, …); item-player's spec-anchored module-facing name is unchanged. Fix: rename the import — every other use (the `pci` property on all four element interfaces, `QtiAssessmentPlayerConfig.pci`) is structural and keeps working once the type name is updated.
- 333ee9a: **Breaking: the facade's section contract types renamed to their `@pie-qti/section-player` contract names** (beta prerelease). The facade hand-copied several section-player contract types under different names while sibling types in the same contract files were published 1:1, so a host composing through both packages learned two names per concept. Renames (old → new):
  
  - `QtiSectionRuntimeHost` → `QtiSectionRuntimeHostContract` (the same object the headless player's `config.sectionHost` takes)
  - `QtiSectionResponseDeltaDetail` → `QtiSectionResponseDeltaEvent` (the `detail` type of the `qti-section-response-delta` event; the event name itself is unchanged)
  - `QtiSectionComposition` → `ResolvedQtiSectionComposition`
  - `QtiSectionSharedContext` → `QtiSharedContext`
  - `QtiSectionResolvedStylesheetRef` → `QtiResolvedStylesheetRef`
  - `QtiSectionResolvedCatalogSource` → `QtiResolvedCatalogSource`
  
  The renamed types are now type aliases to the section-player contract types instead of hand copies, so they can no longer drift members or names; the facade's data-model drift test asserts name parity against the contract sources. Because the copies were field-identical, hosts' structural usage keeps compiling — the renames are nominal only. Also:
  
  - `QtiSectionToolConfig.toolId` carries the contract's literal union again (`'textToSpeech' | 'calculator' | 'ruler' | 'protractor' | (string & {})`); the hand copy had silently narrowed it to `string`. Assigning an arbitrary string still compiles; autocomplete literals are restored.
  - **Removed three dead facade types** that nothing produced or consumed (`QtiResolvedAssessmentStimulus`, and the pipeline-shaped `QtiResolvedStylesheetRef` / `QtiResolvedCatalogSource` it referenced). They are a different shape from the section-player contract types that now rightly own those names; a stimulus-resolution pipeline typeset does not exist in this package's runtime.
- d6ac3bb: **Breaking: the facade's PnP profile and PCI host-trust family are now exact aliases of the item-player contract types** (beta prerelease), finishing the round-4 de-mirroring that stopped halfway. `QtiPnpProfile` is `@pie-qti/item-player`'s `PnpProfile` — it gains the fields the hand mirror had already dropped (`display.structuredLabelSupport`, `cognitive.spellChecker`), `display.colorScheme` narrows from any string to the AfA/QTI3 named schemes the player actually renders (a host passing an arbitrary colorScheme string must now use a named one), and `content.catalogSupports` takes the structured `CatalogSupportPreferences` shape. `QtiPciHostConfiguration` keeps its round-4 name (item-player's `QtiPciConfiguration` is the unrelated module-facing contract) but is now exactly `PciConfiguration`; `QtiPciModuleResolver`, `QtiPciModuleResolutionContext` and `QtiPciModulePathKind` are 1:1 aliases of the root-exported upstream types, and `QtiPciSandboxConfiguration`/`QtiPciModulePolicy` alias item-player's `./pci` entry, which exports them at their own names. The shapes were already field-identical, so only `QtiPnpProfile`'s members change. New drift pins in `tests/data-model-contracts.ts` (identity `Exactly` pins plus a source walk) fail the build if any of the seven names regresses to a hand copy or a drifted alias.
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
- 080a35c: Assessment delivery correctness fixes in the assessment core:
  
  - **EXIT_* branching finalizes the test.** QTI `branchRule` targets `EXIT_TEST` / `EXIT_TESTPART` / `EXIT_SECTION` now terminate delivery through the same finalization path as `submit()`: pending simultaneous-mode responses are submitted, outcome processing runs, results are produced, `complete` fires, and navigation is closed afterwards (typed `testFinalized` rejection). Previously `EXIT_TEST` only fired the completion callback with no submit, no outcomes and no results, and `next()` kept presenting the remaining items.
  - **Navigation transitions are serialized.** While a navigation/submission round trip is in flight, further navigation or submit calls reject with a typed `navigationInFlight` error instead of racing the backend (which could discard a response). `getNavigationState().isLoading` now carries the real in-flight flag, with `onBusyChange`/`isBusy()` for hosts; the shell disables Previous/Next/Submit and sets `aria-busy` while busy. A failed submit keeps the candidate on the same item with the response intact and retryable.
  - **`ItemSessionController` QTI defaults fixed.** `maxAttempts` now defaults to 1 (the QTI default; 0 remains unlimited for adaptive items) instead of unlimited.
  - **Outcome-processing failures surface.** `ReferenceBackendAdapter` no longer swallows test-level outcome-processing errors: submit/finalize responses, the persisted session and `AssessmentResults` carry a typed `OutcomeProcessingError` (stable code `OUTCOME_PROCESSING_FAILED`), hosts receive it via the new `config.onError` callback and the assessment element's `player-error` event, and candidate responses stay accepted and persisted.
  - **Coded, localizable errors.** The core throws `AssessmentPlayerError` (stable `code` + `params`) for every candidate-visible failure; the shell renders localized messages from `assessment.errors.codes.*` (new keys in all 8 locales) plus a short support code, so backend/raw error strings are never shown to candidates.
  - **Invisible sections are truly invisible.** Sections with `visible="false"` (or under an invisible ancestor) are omitted from candidate-facing section data, their titles never surface, and items still deliver in order under the outermost visible ancestor. `getAllSections()` now returns `CandidateSectionView` entries with a `navigable` flag (legal targets for the current navigationMode) and `navigateToSection()` rejects illegal jumps with typed errors.
- 2fa635f: The assessment shell's two remaining double-state controls, the dialog action-button styles, and a duplicate-bundle finding from the final review round are fixed.
  
  **The timer control keeps one name in both states (WCAG 4.1.2).** Its accessible name used to flip between "Show timer" and "Hide timer" while `aria-expanded` changed at the same time, so the state was announced twice and the name a voice-control user speaks changed with every press. The control is now a disclosure named for what it reveals — a stable "Timer" (`assessment.timer.label`, new in all locales) — and `aria-expanded` (with `aria-controls` while the countdown exists) alone carries the state.
  
  **Breaking: locale keys removed and a visible label renamed** (beta prerelease). `assessment.timer.showTimer` and `assessment.timer.hideTimer` have no use left and are removed from all locales (hence the `@pie-qti/i18n` entry); hosts that override them in a custom catalog can drop the overrides. Hosts that depended on the visible "Show timer" / "Hide timer" text (tests or voice-control grammars) now see "Timer" in both states.
  
  **The review button carries its state exactly once (WCAG 4.1.2).** Its visible label still flips ("Review questions" when the review screen is closed, "Back to question" when it is open — the two views genuinely differ, and the label is the only affordance back out of review), and it is the accessible name, so `aria-expanded` is removed: it announced the same fact a second time, and the whole main region it swaps is no disclosed region of this control. `aria-pressed` was considered and rejected for the same reason. Its visible labels are unchanged.
  
  **The dialog action buttons' styles have one source.** The `.submit-dialog-action` rule family was copied across the submit confirmation, the resume prompt and the leave-part warning, and the copies had drifted. They now share one injected rule (`submitDialogAction.ts`, once per document, after the default-components `srOnly.ts` idiom); the class stays the theme hook and every declaration is unchanged, so the rendered styles are identical.
  
  **`@pie-qti/player-elements` ships each module once.** The bundle compiled the two players' Svelte components from source while a bare `@pie-qti/assessment-player` / `@pie-qti/section-player` import resolved to those packages' built `dist` — a second module identity for code the bundle also carried as source. Seven assessment- and section-player modules shipped twice (~7.6 KB; the coded-error class stayed one identity only through its `Symbol.for` brand). The build now pins the two bare names to the same source entry every other import uses: total dist JS drops from 9,764,880 to 9,757,312 bytes on identical sources, duplicated modules 7 → 0, and the error brand key appears exactly once. Consumers are unaffected — the package stays a self-contained bundle with zero runtime bare imports, and public types still resolve to the built declarations. Pinned by `tests/bundle-single-copy.test.ts`, which reads the built sourcemaps and fails if any module is bundled from both a package dist and its source.
- 0a1c071: Hosts now load one shared copy of the item player and the shared packages, instead of a private copy inside the components bundle.
  
  - **`@pie-qti/default-components/plugins`** no longer bundles its own copy of `@pie-qti/item-player`, `@pie-qti/i18n` (including seven locale catalogs) and `@pie-qti/qti-common`, or the `node-html-parser`, `@xmldom/xmldom` and `decimal.js` code they pulled in. It now imports them as the declared dependencies they already were, so the host's bundler resolves each one once. `dist/plugins.js` drops from 1.88 MB to 1.42 MB (gzip: 491 KB to 353 KB). The Svelte runtime, tiptap/KaTeX and mathlive are still bundled, and importing the entry still registers all 21 interaction custom elements.
  - **`@pie-qti/item-player/element` and `/element-class`** now import the item player's own modules from the package, instead of carrying a second copy. A page that uses both the root entry and the element now runs a single `Player`, `ItemSession` and PCI registry. The element chunk drops from 370 KB to 122 KB. It still bundles the Svelte runtime, so it works without a host Svelte.
  - **`@pie-qti/player-elements`** contains one copy of the item player core instead of two. Its JavaScript drops from 10.76 MB to 9.69 MB in total (gzip: 2.67 MB to 2.39 MB), and `register.js` drops from 1.87 MB to 1.41 MB.
  
  **Breaking: `@pie-qti/default-components/plugins` is no longer self-contained** (beta prerelease). Hosts that build with a bundler need no change. Loading `dist/plugins.js` directly in a browser, as the package's `unpkg` and `jsdelivr` entry does, now needs an import map, or an ESM CDN that rewrites bare imports, for the `@pie-qti/*` packages it imports and their dependencies. `@pie-qti/item-player/element` already works this way.
- 90bf9ab: Correct published dependency graphs: runtime imports no longer hide in `devDependencies`, and test-only packages no longer ride along as production dependencies. `@pie-qti/player-elements` now declares `@pie-qti/qti-common` and `@pie-qti/default-components` (both imported at runtime from its entry points) in `dependencies`; `@pie-qti/pci-runner` likewise declares `@pie-qti/item-player`. `@pie-qti/core` moves `@pie-qti/test-utils` and `@pie-qti/to-pie` moves `@pie-qti/transform-core` to dev dependencies (tests only), and `@pie-qti/pie-to-qti2` drops `@pie-qti/transform-core` entirely (only a type import remained, now satisfied by `@pie-qti/transform-types`). Installing these packages no longer pulls unnecessary extras, and bundlers without hoisting-dependent resolution keep working. The `check:deps` script now flags runtime value imports of workspace packages that are not declared in `dependencies`/`peerDependencies` of publishable packages.
- 0973689: The standalone item player no longer destroys the candidate's attempt state when a host writes a property on it (final-review findings F1, F3, F7, F10, F11).
  
  **Breaking:**
  
  - Standalone delivery now hides integrated feedback (`feedbackInline` / `feedbackBlock`) unless the host opts in, as QTI `itemSessionControl@showFeedback` (default `false`) requires. Hosts that relied on the old always-show behaviour pass `showFeedback: true` (property or `show-feedback` attribute); `showSolution` / `show-solution` opts into correct responses after the attempt ends. An injected `session` keeps its own presentation policy.
  - The `<pie-qti-item-player>` role attribute is renamed to `qti-role`: a bare `role` attribute is the ARIA role, and writing a QTI view name there put an invalid ARIA token on host pages (axe `aria-roles`). The `role` JS property keeps working; unknown `qti-role` values now render as `candidate` with a diagnostic instead of silently going read-only.
  
  **Fixed:**
  
  - Any property write on a mounted item element — a response write, a no-op `disabled` write, a section composition re-assign — used to re-create the item's owned `AssessmentItemDefinition` + `ItemSession`, re-rolling `shuffle` choices mid-answer, re-randomizing template values, wiping submitted modal feedback and resetting adaptive `numAttempts`. The session now re-opens only when a definition-fixed input (`itemXml`, `qti-role`, `security`, `pnp`, `deliveryContext`, `pci`, `stringComparison`, `plugins`, `showFeedback`, `showSolution`) truly changes; `disabled`, `i18n`, `typeset`, `responses` and no-op writes never re-open, and a re-open of the same item replays the same template-processing seed.
  - The element keeps the session it owns across a detach and adopts it again on reattach, so re-parenting the element (framework re-orders, layout moves) resumes the attempt instead of restarting the item.
  - Re-using the element across items no longer fails hard on stale `responses`: values the new item declares carry over, the rest are dropped with a diagnostic (`UnknownResponseIdentifierError` is exported for hosts that want to detect it).
  - A broken item dispatches a typed, bubbling `error` event with detail `{ code, message, itemIdentifier? }` (`item-load-failed`, `response-processing-failed`, `submission-failed`, `render-failed`) and renders a localized generic candidate message instead of the raw parser/engine string; the raw detail goes to the host event only. `ready` now fires only on success, once per successful mount. **Breaking:** hosts that listened for `ready` on broken items receive `error` instead.
  - The item element's attribute list is now documented accurately in `@pie-qti/player-elements`' README, including the attribute-backed `locale` and the fact that `showSubmit` stays `false` (hosts call `submit()`).
  - `item.submitError` ships in all eight locales for the candidate-facing submission-failure message.
- 3a17b4b: Breaking: `QtiAssessmentPlayerElement` now validates its JSON attributes instead of silently tolerating garbage. Setting `items-json`, `config-json` or `security-json` to a malformed JSON document or to JSON that is not an object (a string, number, boolean, array or `null`) previously kept whatever value the attribute held before, with no signal; it now resets the field to its removal value (`items` and `security` cleared, `config` reset to `{}`) and dispatches `load-error` with a message naming the attribute. Removing one of these attributes now also clears the field — it previously kept the stale value, unlike the element's other attributes (`assessment-test-xml`, `assessment-id`, `item-base-url`), which always follow removal. Valid JSON objects parse exactly as before.
- 3a17b4b: Bring the published facade's section data-model mirrors back in sync with `@pie-qti/section-player`'s contracts, where three fields had already drifted away (the mirrors narrowed the contracts, which no assignability pin could catch):
  
  - `QtiSectionModel` gains `assessmentId` (the assessment the section belongs to; names the tool bars' toolkit assessment).
  - `QtiSectionComposition` gains `assessmentId` (keys the candidate's session display settings) and `pnp` (the candidate's PNP a layout applies when it has none of its own).
  - `QtiSectionRuntimeHost` gains `onDisplaySettingsChange`, the callback for the candidate changing display settings.
  - `ResolveItemsForAssessmentOptions` gains `resourceResolver`, the shared bounded resolver option the runtime has always accepted.
  
  All added fields are optional, so no consumer code changes. The facade is now pinned against this drift: a source-walking test (like the existing event-map drift test) requires every contract member of the section data model and the parsed-assessment types to appear on its facade mirror, and compile-time key pins fail the build when a mirror drops a field a contract defines.
- 3a17b4b: Fix a superseded-load race in `QtiAssessmentPlayerElement`'s local reference-backend path: the load sequence was re-checked only after the first await (bounded item resolution), but not after the second one — `ReferenceBackendAdapter.parseAssessmentTestXml`, which resolves external section and item files through the resource resolver and does not observe the supersede abort. A load superseded while that parse ran (a newer `assessmentTestXml`, a `backend` injection, or a disconnect) went on to register the stale assessment, replace an injected production backend with the local answer-bearing one, dispatch a second `load-end`, and mount an interactive shell for the wrong assessment — including after `disconnectedCallback`. The element now re-checks the load sequence immediately after that parse and discards a superseded result before any state mutation.
- cfb78e2: Assessment shell practice delivery and completion round: item-level check answer with attempts and feedback, candidate comments, and a built-in completion screen with an opt-in results summary.
  
  **Practice delivery ("Check answer").** In an `individual` submission-mode part whose resolved `itemSessionControl@showFeedback` is on, an item with more than one allowed attempt (or an adaptive item) now shows an item-level "Check answer" control in the navigation bar — distinct from the section's Next and the test's outlined Submit — with a polite "Attempt N of M" counter beside it (`AssessmentPlayer.getCheckAnswerState()` / `checkCurrentItem()`). Checking submits the item through the normal per-item path (counted, backend-authoritative) and stays on it: integrated feedback renders from the computed outcomes, and any item modal feedback the submission produced opens in the shell's dialog (`getLastItemFeedback()`; a backend that delivers no candidate-side response processing supplies the same surface through `SubmitResponsesResponse.result.feedback`). While attempts remain, a non-adaptive item reopens writable from its pre-submit state with the outcomes restored so the candidate revises and checks again; adaptive items keep their engine loop. Once the attempts are used up the control disables with a localized explanation and moving on needs no further submission; moving on re-submits an already-checked item only when the response changed (an unchanged answer never spends an extra attempt). `showFeedback=true` with a single attempt keeps today's submit-on-move delivery — the captured feedback dialog rides the transition; simultaneous parts and `showFeedback=false` never offer the control. A counted submission no longer double-counts the attempt when the backend returns `updatedState` with its own `itemSessionStates`.
  
  **Candidate comments (QTI `allowComment`).** A per-item "Comments for the test team" disclosure above the navigation bar edits the item's comment into the session state (`AssessmentPlayer.setItemComment`, autosave-aware, rides snapshots) and it is sent as `SubmitResponsesRequest.comment` with the item's submissions (already honored by the reference adapter).
  
  **Completion screen.** After finalization the shell replaces the dead last item with a candidate-facing completion state — "You have finished the test", or its time-expired variant when a whole-test limit auto-submitted — rendering the test's outcome-matched `testFeedback` and moving focus to its heading. The host opts in per embed with the shell's `showResultsSummary` prop (the `<pie-qti-assessment-player>` element's `show-results-summary` attribute) to add a per-question results summary from the new `AssessmentPlayer.getResultsSummary()`: each delivered item's answered status plus the backend's score when returned, under the finalized total. `onSubmit`/`submit` still deliver the full results; `onComplete` now fires after `submit()`'s results exist. Token-styled, keyboard-clean, reflows to 320px; new `assessment` locale keys (check answer, attempts, comments, completion) in all 8 locales.
- 372037e: Round-2 assessment-integrity fixes across the assessment player and its shell:
  
  - **End-of-test collection (S1):** finalize now collects every visited individual-mode item the
    backend has not accepted yet — an answer left behind a nonlinear jump (`navigateTo`/`previous`
    submit nothing) is scored instead of finalized from NULL. Unchanged responses never re-submit,
    so moved-on practice items spend no extra attempt; linear submit-on-move semantics are
    unchanged. Finalization also persists the final snapshot before `finalizeAssessment`, so
    outcome processing reads the end-of-test duration clocks.
  - **Nested section clocks (S2):** every enclosing section now runs its own clock. An outer
    section's `maxTime` expires and locks its whole subtree, its `minTime` gates leaving it, and
    `SECTION_ID.duration` accumulates for outcome processing and Results Reporting; innermost
    behavior is unchanged. Player-side literal `EXIT_SECTION` resolves over the full enclosing
    chain (S3), so an outer-section exit lands outside the whole outer section.
  - **Restored proctor pause (UX1):** a snapshot saved during a pause reopens paused with the
    overlay visible — the shell syncs from the core at creation, announces assertively, holds focus
    on the overlay (Tab and stray focus are contained there), suppresses the resume prompt while
    paused and returns it after resume. Opening a pause now closes every shell dialog (A11y7), and
    the whole chrome goes inert through one wrapper with the overlay operable outside it (A11y1).
  - **Finalized sessions (UX3):** `InitSessionResponse.finalized` (+ `finalResults`) marks a
    resumed session terminal: the shell renders the already-submitted completion view, never offers
    a resume, and `submit()` returns the stored results instead of failing.
  - **Attempt memory across resume (S4):** the submitted-response memory is seeded from the
    snapshot's recorded results, so a resumed session does not re-spend an attempt on identical
    responses.
  - **Shell resilience and a11y:** failed item entries (first item, expiry hop) route to the typed
    failure screen with Retry instead of an eternal loading state (UX5); the crash boundary's
    fallback takes focus (A11y6); the announcer splits into persistent polite and assertive regions
    (A11y3); timer and section-menu toggles no longer carry dangling `aria-controls` (A11y5); the
    expiry dialog stays open and busy on a busy-rejected submit (UX7); malformed item XML can no
    longer crash review-state helpers.
  - **Autosave backoff (UX6):** a failed save retries with a bounded backoff (2s/8s/30s), stopping
    on success or finalization, instead of waiting for the next candidate change.
  - New localized string `assessment.complete.alreadySubmitted` in all 8 locales.
- 9814c9b: Assessment delivery gating, time policy and proctor fixes (round 3).
  
  - **Finalize honours `allowSkipping` / `validateResponses`** (QTI: both apply only to items in `individual` submission parts). A candidate's end of the test never submits an item left without a response while `allowSkipping=false`, nor an answered item whose responses do not satisfy its interactions while `validateResponses=true`: `submit()` rejects with the coded `finalizeResponseRequired` / `finalizeResponseInvalid` naming the questions (`getSubmissionBlockers()`), and the shell's submit confirmation lists them with jump links and holds Submit. `next()`, `submitCurrentItem()` and `checkCurrentItem()` apply the same gates; simultaneous parts are never gated. A time expiry (and a proctor force-submit) collects everything as it stands, recording an unanswered required item as skipped by the expiry.
  - **Attempt-relative feedback**: with more than one attempt, feedback shows for every non-final attempt even when `showFeedback=false`; after the last attempt `showFeedback` governs. The check-answer control is offered whenever more than one attempt is allowed.
  - **`templateDefault` in nonlinear parts** is evaluated once at test-part entry for every item ref, with the other items' variables in scope (`ITEM.VARIABLE`); linear parts are unchanged.
  - **Start over keeps the time accounting**: it clears the candidate's answers, flags, comments and unrecorded check state, but clocks, expired scopes and a whole-test expiry persist (no fresh time allowance), accepted results stay, and delivery repositions to the first open question — or offers Submit when none is open. The blank draft is saved at once. New shell prop `allowStartOver` / element attribute `allow-start-over="false"` removes Start over.
  - **Restored sessions**: scopes whose restored clock already expired lock before any item is entered (no editable window until the next tick); a restored whole-test expiry finalizes once delivery runs; visited marks survive a reload; the end-of-test snapshot is saved after any in-flight autosave, before `finalizeAssessment`.
  - **Proctor console on `<pie-qti-assessment-player>`**: `isPaused()`, `getPauseReason()`, `isFinalized()`, `getTimeState()`, `flushAutosave()`, and `submit({ force: true })` (ends the test during a pause; submissions carry `timing.submissionReason: 'proctor'`). New `scope-time-expired` and `session-finalized` (`{ restored, results }`) events; `player-pause` now fires at mount for a session restored paused (core: `onPauseChange` once after creation, new `onFinalized` hook).
  - **Pause accessibility**: a proctor pause closes every dialog in the shell (section display settings included) and dispatches `pie-qti-close-transient-ui` (`{ reason: 'pause' }`) for transient UI outside dialogs; focus containment is scoped to the shell so host controls stay operable; a paused session behind the begin gate says so on its start screen and holds Begin.
  - **Status regions**: the save indicator's live region exists while idle, "Submitting…" is outside the busy subtree, and the polite/assertive announcer regions no longer clear each other. The pressed Flag button keeps its state in forced-colors mode.
  - New `assessment` locale keys in all eight locales: `errors.codes.finalizeResponseRequired`, `errors.codes.finalizeResponseInvalid`, `submit.needsAnswerHeading(One)`, `start.paused`.
- c6ae98c: Assessment delivery integrity fixes (round 4).
  
  - **Leaving a test part gates on its questions.** QTI parts cannot be re-entered, so leaving an individual part with a question that still owes an answer (`allowSkipping=false` without one, `validateResponses=true` incomplete) is refused with the coded `leavePartResponseRequired` / `leavePartResponseInvalid` naming the questions — on Next (before anything is submitted), on a direct jump into the next part, and on a backend branch decision that would leave the part (`EXIT_TESTPART`, `EXIT_SECTION`, a later-part target, `EXIT_TEST`; the decision is kept and the next `next()` follows it once the questions are answered). New `getTestPartBlockers()`; the shell's "Leave this part?" confirmation lists them with jumps and holds Continue.
  - **An unreachable question never holds Submit.** `getSubmissionBlockers()` reports only questions the candidate can still reach (new `reachable` field); the others (`getUnreachableSubmissionBlockers()`, e.g. a session saved before the leave gate) are collected as they stand at the end of the test with the new `timing.submissionReason: 'unreachable'`, never as a normal candidate submission. The reference backend accepts it like a time-expired collection.
  - **Scope expiry looks across the whole reachable delivery.** When a section, item or part limit closes the current question, delivery moves to the next open question of the part, else an open question earlier in a nonlinear part, else the next part — on a live expiry and on restore. Only when nothing open remains is it the dead end ("You can no longer change your answers"), so the skipping/validation gates and minimum times keep applying while an earlier question is open. `ScopeTimeExpiryEvent` (element `scope-time-expired`) gains `nextIndex`; the shell's notice names the destination ("You are moving on to question 1") and offers Submit in place of Next whenever no forward step remains.
  - **Proctor force-submit always lands.** `submit({ force: true })` no longer rejects with `navigationInFlight` while a candidate action runs: it is queued behind the transition (like `pause()`) and ends the test when it settles. Behind the begin gate it shows the completion screen instead of leaving a dead Begin.
  - **Every ending reaches the host once, with its reason.** `onComplete` now receives the results; the shell calls `onSubmit` (element `submit` event) for every ending — candidate submit, proctor force-submit, QTI `EXIT_TEST` branch, whole-test expiry. New `endReason` (`candidate` | `expiry` | `proctor` | `branch`) on `AssessmentResults`, the `onFinalized` event (element `session-finalized`) and `getEndReason()`. A proctor's ending shows "Your test was submitted by your proctor." with its own assertive announcement.
  - **Incomplete answers are named as such.** The submit confirmation (and the leave-part warning) lists invalid answers in a separate "answer is incomplete" group whose entries say what they still owe ("Go to question 2: select at least 2"), from the new `SubmissionBlocker.requirement` (minChoices / minStrings / minAssociations / minPlays).
  - **QTI skipped = NULL or the declared default.** A response still equal to its declared default counts as no response for `allowSkipping` (the `numberResponded` test); the reference backend no longer marks such an item answered.
  - **`allowReview` applies only after the last attempt.** With attempts left (an adaptive item not yet completed), the candidate may return to an item even when `allowReview=false`, and it reopens attemptable.
  - **Start over never re-enters a left part.** It repositions within the furthest part reached; questions of earlier parts stay closed as they stand (collected at the end of the test).
  - **Reference scoring uses the delivered instance (host-visible).** `BackendAdapter` gains the optional `requiresItemSession` capability; `ReferenceBackendAdapter` (and so the element's `referenceMode`) sets it, so the player now always sends `SubmitResponsesRequest.itemSession` to it, whatever `sendItemSessionToBackend` says. The reference scorer restores that session — a templated item is scored against the instance the candidate saw instead of a fresh template draw, and an adaptive item's outcomes are taken as submitted rather than recomputed. `scoreAssessmentItem()` now throws an `AssessmentItemScoringError` (`itemSessionRequired`) for a templated or adaptive item without a session (`itemScoringRequiresSession()` tells in advance); the reference backend answers such a submission with `success: false`. Production backends keep the `sendItemSessionToBackend` default (off).
  - **Accessibility:** closing a scope expiry notice by Continue or Escape moves focus to the question delivery moved to and announces it (the notice is acknowledge-only); a dismissed submit notice moves focus to Submit; an expiry closes a stale submit confirmation or leave-part warning; "Review questions" does nothing while a submission runs; the pause heading follows the shell's heading outline; the pressed Flag button paints the full Highlight/HighlightText pair in forced colors.
  - New `assessment` locale keys in all eight locales: `submit.incompleteHeading(One)`, `submit.requirement.*`, `submit.incompleteJump`, `submit.incompleteEntry`, `leavePart.needsAnswerHeading(One)`, `leavePart.incompleteHeading(One)`, `timeExpiry.movingToQuestion`, `timeExpiry.closedDescription`, `complete.byProctor`, `complete.byProctorAnnouncement`, `errors.codes.leavePartResponseRequired`, `errors.codes.leavePartResponseInvalid`; `timeExpiry.questionDescription` was removed (replaced by `movingToQuestion`).
- 0a5cc0e: Assessment delivery fixes (round 5): the end of the test never navigates.
  
  - **The end of the test collects where the candidate stands.** `submit()`, a whole-test expiry's automatic submission and a proctor's `submit({ force: true })` no longer follow the branch decision (`nextItemIdentifier`) the backend returns for the end's own collection of the current item. Previously a submit from a non-last item moved delivery onto the backend's next item mid-finalize: the final snapshot recorded that unseen question as current and visited (backends counting `visitedItems` miscounted, and the results report gained an item result for it), and when finalize then failed, the retry was refused because the candidate now stood on an unanswered required question. The decision is kept on record instead: if the end does not complete, the candidate's next `next()` from that item follows it. An exit decision (`EXIT_TESTPART` / `EXIT_SECTION`) returned during the end no longer enters the next part either.
  - **A scope expiry during the end of the test no longer moves delivery or loses an answer.** A section, part or item limit that runs out while the end of the test is in flight closes at once (its items go out as they stand, `time-expired`); delivery moves off it only if that end does not finalize. Previously the expiry's move could land mid-collection, so the end submitted the item it moved to instead of the one the candidate submitted from.
  - **The leave-part gate counts only questions the candidate can still reach.** `getTestPartBlockers()` and the refusal of Next / a jump / a branch decision out of a part ignore a question behind the candidate in a linear part (a session restored from before the gate): nothing could answer it, so it no longer deadlocks the candidate (no fix, no exit, no Submit). It is collected at the end of the test as before (`submissionReason: 'unreachable'`).
  - **A scope expiry's move is never undone by an in-flight submission.** When a limit runs out while `next()` is submitting and delivery moves on (e.g. into the next part), the submission's branch decision no longer pulls the candidate back onto a closed item in the part they left; a branch decision never re-enters a test part already left. A backend `updatedState` no longer resets the client's current item to the backend's (possibly stale) position, so the snapshot and the response path stay on the item the candidate is on.
  - **An ending the time forced is an `expiry` ending.** When the whole test expired (its automatic submission failed and the candidate then submitted from the expiry dialog, or a proctor force-submitted) or a scope expiry left nothing open (the dead end's Submit), `endReason` is `expiry` — on the results, `getEndReason()`, `onFinalized` and the element's `session-finalized` — and the completion screen shows its time-expired heading ("Time is up…") instead of "You have finished the test."
  - **Docs:** the `timing.submissionReason` precedence is documented — items an expired limit closed go out as `time-expired` even inside a proctor's forced end (`time-expired` > `proctor` > `unreachable`).
- efcde5c: Assessment delivery fixes (round 6): branch rules and preconditions hold on every forward move, and a checked item ends final.
  
  - **A practice check keeps the backend's branch decision.** `checkCurrentItem()` (and a counted `endAttemptInteraction`) stays on the item but now keeps the `nextItemIdentifier` the backend returned for it. Moving on with the response unchanged — which submits nothing — follows that decision. Previously the decision was discarded and `next()` moved to the adjacent item, so after a check the candidate landed on an item whose precondition fails, or that a branch rule skipped (a linear part q1 → q2 with a false precondition → q3 landed on q2). A changed response re-submits and follows the fresh decision. Any later counted submission replaces a kept decision, because the outcomes it was made on have changed.
  - **A move without a backend decision applies the same rules.** A nonlinear jump into the next test part, a move on from a simultaneous part, a session resumed after a reload, or a backend that returns no decision now resolve the next item with the reference backend's own rules (`test-navigation.ts`: branch rules, then preconditions). The rules read the test outcomes the backend last returned and the item results it recorded. A test part whose precondition fails is never entered: `navigateTo()` into it rejects with `navigationNotAllowed`, `isNavigationTargetLegal()` and the review screen offer no jump into it, and Next or a scope expiry's move lands past it. In a linear part, a section or item whose precondition fails is skipped. When nothing eligible follows, `canNext` is false and the shell offers Submit. A test without branch rules or preconditions evaluates nothing and moves to the adjacent item as before. Following a kept decision checks the move's minimum times.
  - **A checked item reopens from the attempt it made.** While attempts remain, the item reopens from the processed attempt with its lifecycle set back to `interacting`: its attempt count and computed outcomes carry over. Under the engine's `numAttempts` contract, the next check therefore runs response processing as attempt 2. Previously the item reopened from the pre-submit state, so the second attempt ran as attempt 1.
  - **Once the test ends, every item session is closed.** The snapshot saved before `finalizeAssessment()` closes every item session, and so do the player's record and the live session afterwards. A practice item that was checked and then left unchanged was previously reported as `pendingSubmission` by `toAssessmentResultXml` / `buildAssessmentResultReport` even though the backend had accepted and processed it; it is now reported as `final`. If the end does not finalize, the open draft is saved again, so the remaining attempts survive a reload.
- dc38e3b: Assessment shell resilience round: debounced autosave with resume, candidate-safe load/failure screens, and targeted response updates.
  
  **Autosave (default ON when the backend supports it).** `BackendAdapter` gains a `canSaveState` capability flag (default `true`; `ReferenceBackendAdapter` implements it), and the core now actually calls `saveState`: candidate activity (responses, navigation, flags, timer visibility, pause) restarts a 1.5 s debounce (`autosaveIntervalMs`), the shell flushes on `visibilitychange`/`pagehide`, and nothing saves after finalization. Saves defer while a transition is in flight and fail non-fatally (console + typed event + indicator, retried on the next change). New config: `autosave`, `autosaveIntervalMs`, `onAutosaveChange`, `onAutosaveFailed`; the `<pie-qti-assessment-player>` element gains `autosave` / `autosave-interval-ms` attributes and `autosave-change` / `autosave-failed` events. Hosts that persist state themselves set `autosave: false` (or `canSaveState: false`), which also hides the new save indicator ("Saving…" / "Saved · 12:04" / "Not saved", localized, polite live region). The navigation bar's snapshot section gained an optional `saveLabel` slot. Snapshots stamped with `timing.savedAt` date the new resume prompt: a session created from a stored draft (`initSession.resumeSessionId`; `ReferenceBackendAdapter.latestSessionId()` finds it) asks "Resume your test?" — Resume restores answers, flags and the hidden-timer preference, Start over confirms (WCAG 3.3.4) and calls the new `AssessmentPlayer.startOver()` to clear the draft, persist the blank state and restart at the first item. Restored-paused sessions still reopen paused. `hasRestoredProgress()`/`getRestoredSavedAt()` expose the resume facts.
  
  **Safe load, failure and crash screens.** The 10 s loading timeout no longer turns into a permanent error: it becomes a polite "Still loading" status that clears itself, and its developer-phrased message is replaced by candidate-safe text in all 8 locales. A failed load renders the localized coded-error message (never raw backend text) with a Retry control that re-initializes the session, and `<svelte:boundary>` now wraps the question content area and the shell's dialogs, so a crash during item rendering shows a localized "This question could not be displayed" fallback with Try again / Continue (navigation rules still apply) instead of blanking the test.
  
  **Response updates are O(changed item), not O(assessment).** Profiling showed every keystroke rebuilt the whole section composition with two `structuredClone` calls per delivered item (48 clones for a 24-item section). The composition now carries the active session and the section's response records by shared reference (`AssessmentPlayer.getSectionItemResponses()`, `getCurrentSectionItemRefs()` no longer clones delivery contexts), and the shell rebuilds it only on item/section/delivery changes — keystrokes recompute answered counts only. A unit guard pins a keystroke at one deep copy and a composition build at zero. Section-host `onSnapshotChange` notifications now fire per navigation instead of per keystroke; hosts needing per-edit events keep `onResponseDelta`/`response-change`.
  
  **Also:** `toSectionComposition` passes the real assessment id (not the section identifier) to `resolveQtiSectionComposition`, and the shell root is a PNP surface driven by the candidate's display-settings changes, so display accommodations cover the header, navigation bar and timer chrome while the section player keeps covering its own subtree (scopes non-overlapping; nested inverting filters are neutralized). New `assessment` locale keys (autosave, resume, still-loading, item error) in all 8 locales.
- 2667df1: The assessment shell and section player no longer require DaisyUI or Tailwind on the host page.
  
  - **Self-contained styling**: the shell (`<pie-qti-assessment-player>`) and section players (`<pie-qti-section-player-splitpane>`, `<pie-qti-section-player-vertical>`) style themselves with scoped CSS on the `--pie-qti-*` tokens, with fallbacks when no theme is loaded. Icons are sized by the components, buttons are ≥44px with visible 2px focus rings, and alerts, spinners, the splitter and test feedback no longer read DaisyUI `--color-*` variables. Existing class names and `data-testid` hooks are kept.
  - **Layout**: the shell fills its host container instead of a fixed `100vh` box (`--pie-qti-assessment-min-block-size` / `--pie-qti-assessment-max-block-size` tune the bounds when the host gives no height). A new `full-viewport` attribute (`fullViewport` property) fills the dynamic viewport with safe-area insets and page-level `header`/`main`/`nav` landmarks. At short viewports (400% zoom, landscape phones) everything flows in one scroll and no bar is pinned over the content.
  - **Phones**: navigation is one compact row (Previous, position, Next/Submit), nested gutters collapse to one slim gutter, and a passage shares the screen with the question through an accessible Passage/Question tab switch instead of a 40%-height scroll box. Wide screens keep the keyboard-resizable splitter.
  - **Accessibility**: a "Skip to question" link, a region named by the assessment title, a labelled navigation landmark, Previous/Next arrows mirrored right-to-left, and navigation buttons that keep focus while a transition is in flight.
  - **Polish**: the header shows the assessmentTest `title` (or a localized generic title), never the identifier; untitled sections no longer read "Section 2 of 0"; passages are headed by their `title` or a neutral localized "Passage" label at a heading level that fits the outline (`heading-level` attribute on the assessment and section elements). Item load failures show a localized message instead of the raw error.
  - **Host CSS**: a low-priority `@layer pie-qti-base` restores user-agent defaults (lists, headings, paragraph spacing, link underlines, inline images, bordered tables, media max-width) inside item, passage and rubric content, so host resets no longer strip question stems.
  - **APIs**: `AssessmentPlayer.getAssessmentTitle()`; optional `title` on `QtiSharedHtmlBlock`; the reference parser leaves a missing assessmentTest title empty instead of English "Assessment". `@pie-qti/i18n` adds `assessment.skipToQuestion` and a `sectionPlayer` section across all eight locales.
- a1c989d: String answers now compare as QTI defines them. `match`, `member`, `contains`, `delete`, `stringMatch` and `mapResponse` entry lookup compare `string` values for equality: `match` is true "if the two expressions represent the same value" (QTI 3.0 §6.9.21). Case folds only where the item asks for it, through `stringMatch` with `caseSensitive="false"` or a `mapEntry` whose `caseSensitive` is false (its default). Both values are composed to Unicode NFC first. QTI is silent on normalization, and canonically equivalent text must not be treated as distinct (Unicode conformance clause C6), so `é` typed with a combining accent still matches `é`.
  
  The new delivery option `stringComparison` lets a host opt in to more folding. You can set it on `createAssessmentItemDefinition` (client and server entry points), on the `ItemPlayer` component and the `<pie-qti-item-player>` element, on `AssessmentPlayer.create` (or the `config` of the assessment shell and of `<pie-qti-assessment-player>`), on `ReferenceBackendAdapter` and on `scoreAssessmentItem`:
  
  - `foldScriptInput: true` removes bidi controls (ALM, LRM, RLM, embeddings, overrides, isolates) and tatweel. It folds Arabic presentation forms to their base letters, every script's decimal digits to 0–9, and the Arabic decimal and thousands separators to the content language's marks.
  - `foldLetterVariants: true` folds Arabic spelling variants: hamza and madda alef forms become bare alef, tashkeel is removed, ة becomes ه and ى becomes ي.
  
  Give the player and the scoring backend the same value. Numbers typed into `integer` and `float` responses read digits in any script and the Arabic separators either way. `patternMatch` and `patternMask` always test the text as entered.
  
  Breaking: before this change, string comparisons always folded script input. A string answer that matched only because of that fold now scores as non-matching. Examples are an answer typed with tatweel, a bidi mark or Arabic presentation forms, or a string answer typed with Arabic-Indic digits. To restore the earlier scoring, set `stringComparison: { foldScriptInput: true }` on the player and on the scorer. For example, use `createAssessmentItemDefinition({ itemXml, stringComparison: { foldScriptInput: true } })` and `new ReferenceBackendAdapter({ stringComparison: { foldScriptInput: true } })`.
  
  Breaking: `normalizeResponse` from `@pie-qti/qti-processing` now folds script input only when called with `foldScriptInput: true`. Without it, the function returns the text composed to NFC, and case-folded when `ignoreCase` is set. `foldLetterVariants` is now independent of `foldScriptInput`. It was documented as "an authoring choice per response", but no authored attribute or element ever set it. It is now the host option `stringComparison.foldLetterVariants`.
  
  When `mapResponse` maps a container, a string value that no `mapEntry` matches now keeps its case: `{London, LONDON}` counts as two values, each with the mapping's `defaultValue`. Values that a case-insensitive entry matches still count once.
  
  A `graphicGapMatchInteraction` with `minAssociations` (QTI 2.2; `min-associations` in QTI 3.0) now needs at least that many associations before its response counts as complete. Response validation (`canSubmit`, and `endAttempt` with `validateResponses`) reports a response with fewer associations as incomplete. The interaction data carries the value as `minAssociations`. An absent attribute or `0` sets no minimum.
- 88b69c0: Timed tests are deliverable: countdown, warnings, expiry handling, begin gate and proctor pause in the candidate shell (WCAG 2.2.1 / 4.1.3).
  
  - **Countdown in the shell header.** When the active scope chain carries a hard maximum, `AssessmentTimer` now mounts beside the title (it used to exist only in a demo fixture, with DaisyUI-only variables that never rendered). It is rebuilt self-contained on the `--pie-qti-*` tokens: layout space instead of a fixed overlay, RTL-safe logical CSS, ≥44px controls, and a pause-state display. The ticking readout is `role="timer"` with the live region OFF (no more per-second chatter); its accessible name carries the reading ("Time remaining: 12:34"). Thresholds (`timeWarningThreshold`, new `timeWarningThresholds`, e.g. `[300, 60]`) each announce once through a separate polite status region; expiry announces assertively. Candidates can hide/show the countdown (persisted in the session state like flags via `setTimerHidden`/`isTimerHidden`, `AssessmentSessionState.timerHidden`). The only animation sits behind `prefers-reduced-motion`.
  - **Scope expiry is surfaced.** A test part, section or item limit without late submission locks its scope and moves delivery on; the shell shows an AssessmentDialog notice ("The time for this section is over — you are moving on"), announces the new question position and manages focus (`onScopeTimeExpired` / `onScopeTimeExpired` config with `deliveryContinues`).
  - **An expiry dead end can never strand the candidate.** When nothing unlocked remains, `onTimeExpired` reports `submissionRequired`, the shell shows an expiry dialog with a Submit action and the navigation bar offers Submit in place of Next on any item. The terminal collection submits the frozen responses marked `timing.submissionReason: 'time-expired'`, which the reference backend accepts; minimum times and validation cannot hold a closed delivery open. The submit-timing evidence also carries the candidate's test clock (`assessmentElapsedMs`/`assessmentLimitSeconds`), so begin-gate and pause time never count against a wall-clock check.
  - **Whole-test expiry auto-finalizes** through the same path as `submit()` (pending responses collected, outcomes computed, `complete` fires) unless `allowLateSubmission` applies; a failed finalization keeps the session open, reports through `onError` and offers Submit. Hosts hear the new `time-expired` DOM event (detail: `scope`, `autoFinalized`, `submissionRequired`) and `onTimeExpired` config callback.
  - **Begin gate (opt-in).** `beginGate: true` (shell prop / `begin-gate` attribute / `start()` / `hasStarted()`) holds delivery and every clock at session creation; the shell shows an accessible start screen — assessment title, "You have N minutes" (PNP extended time applied, `getStartInfo()`), the first test part's role-filtered rubric blocks and a Begin control. Without it, existing embeds start exactly as before. Resumed sessions show the time that remains.
  - **Proctor pause/resume.** `pause(reason?)`/`resume()` freeze every clock including the live attempt's QTI `duration`, reject candidate actions with a coded `assessmentPaused` error, and show a localized overlay with the reason (`onPauseChange` / `player-pause` / `player-resume` events, imperative API on `<pie-qti-assessment-player>`). A pause requested during a transition applies once it settles; paused snapshots carry `timing.isPaused`/`pauseReason` and reopen paused. The countdown freezes and continues where it left off.
  - New `AssessmentPlayer` APIs: `getTimeState()`, `getStartInfo()`, `start()`, `hasStarted()`, `pause()`, `resume()`, `isPaused()`, `getPauseReason()`, `onPauseChange`, `onScopeTimeExpired`, `setTimerHidden`/`isTimerHidden`, `TimeManager.getNearestLimit()`/`getAssessmentRemainingSeconds()`, multi-threshold warnings. New element surface: `begin-gate` attribute, `beginGate` property, `time-expired`/`player-pause`/`player-resume` events, `start()`/`hasStarted()`/`pause()`/`resume()`.
  - New localized strings (`assessment.timer.*`, `assessment.start.*`, `assessment.timeExpiry.*`, `assessment.pause.*`, `assessment.errors.codes.assessmentPaused`) in all 8 locales.
  - Demo `fixtures/assessment-timed` (auto-submit / dead-end / pause / start-gate / late scenarios), rebuilt timer a11y fixture, bun + jsdom component coverage and a Playwright suite covering timer visibility, threshold announcement, expiry dialog, auto-submit, the dead-end regression, pause/resume and axe scans of the start screen and expiry dialog.
- 20e8e52: Section tool bars move to `@pie-players` 1.0.0-beta.9 and render in the interface language, with each locale's catalog loaded only when a tool bar needs it.
  
  - **The tool packages are on 1.0.0-beta.9.** `pie-assessment-toolkit`, `pie-default-tool-loaders`, `pie-tool-tts-inline` and `pie-tool-calculator-desmos` move from 1.0.0-beta.6 to 1.0.0-beta.9. The section player also declares `pie-calculator-desmos`, `tts-client-server`, `@pie-players/pie-players-shared` and `@pie-players/pie-i18n-generated` as runtime dependencies, all at 1.0.0-beta.9.
  - **The toolkit's chrome follows the interface locale.** In 1.0.0-beta.9 the toolkit's default provider ships English only. The tool bar now gives the toolkit a provider over the two pie-players catalog tiers, composed as pie-players documents: the bundled catalog first, then `@pie-players/pie-i18n-generated`. A Dutch interface reads "Voorlezen starten", and Arabic, Spanish, French, Romanian, Thai, Chinese and the other locales that package ships get their own toolkit chrome. A regional tag reaches its language (`es-MX` → `es`, `nl-BE` → `nl-NL`), and the toolkit's `lang` names the catalog it renders.
  - **Catalogs load lazily, one locale at a time.** English is bundled and needs no fetch, so an English page loads nothing extra. The generated package is reached only through a dynamic `import()`, the first time a tool bar needs a non-English locale. Each locale's catalog is a chunk of its own, fetched only for that locale, and every tool bar on the page shares it. The catalog loads before the toolkit renders, so a non-English tool bar does not appear in English first.
  - **A locale with no catalog falls back to English.** It renders the toolkit in English under its own tag. The pseudo-locales render English without fetching a catalog: `ar-XB` keeps its own `lang` and right-to-left `dir` instead of resolving to the Arabic catalog. If the generated package fails to load, tool bars render in English and the section player warns once.
- b8a2862: No section label shows a raw i18n key.
  
  - **A provider that misses a key no longer puts the key in a label.** The passage collapse control composes its name from the passage heading and an action verb. Under a host provider that answers a lookup without a default with the key, it read "Passage — assessment.collapsePassage". The section's labels now go through one helper that falls back to the English phrase whenever a provider hands back the key. That covers the passage, instructions, rubric and test feedback regions, the item heading and loading messages, the split-pane labels and resizer, and the display settings button and dialog. Some of these labels also rendered empty without a provider; they now read the English phrase.
- 528974c: The public declaration facade (`QtiSecureAssessment`, `QtiAssessmentBackend`, `QtiScoringResult`, `QtiPlayerSecurityConfig`, `QtiSerializedItemSessionState`, and 22 more) is now composed of type aliases of the upstream contracts in `@pie-qti/assessment-player` and `@pie-qti/item-player` instead of 928 lines of hand-copied mirrors, so the facade can no longer drift from the real backend/player contracts — upstream field additions flow through automatically. Notable alignment: `QtiAssessmentRubricBlock.view` is now `string[]` (authored QTI view tokens), matching the upstream contract, and the backend facade carries upstream's optional `comment`, `branchRule`, `keepTogether`, `variableMappings`, and `templateDefaults` fields. Deliberately hand-written shapes (the element event maps, element classes, PCI/module policy callbacks, processing-fragment runtime, and the resolved-delivery-context composites) are documented as such in the source.
- 780653b: The published element contracts now declare what the elements already dispatch and implement. The contracts had been hand-restated next to the runtime elements and drifted from them; the runtime declarations are the single source now, and every fix only grows the surface (nothing existing changed):
  
  - **`pie-qti-assessment-player`**: the `autosave-change` and `autosave-failed` events are in the published event map (with their `QtiAssessmentAutosaveChangeDetail` and `QtiAssessmentAutosaveFailedDetail` detail types), and the element contract exposes the `autosave` and `autosaveIntervalMs` properties it has always implemented.
  - **`pie-qti-section-player-splitpane` / `pie-qti-section-player-vertical`**: the published event map carried only `qti-section-response-delta`; it now also carries `qti-section-framework-error`, `qti-section-display-settings` and `qti-section-item-pane-ready` (with the `QtiSectionDisplaySettingsEvent`, `QtiSectionFrameworkError` and `QtiSectionItemPaneReadyDetail` detail types exported), and the element contract gains `displaySettings` and `focusActiveItem()`.
  - **`pie-qti-item-player`**: the element contract gains `stringComparison`; the event map and details are re-exported from the element's implementation instead of hand mirrors.
  - **`pie-qti-assessment-player` config**: the published `QtiAssessmentPlayerConfig` gains `stringComparison`, `autosave`, `autosaveIntervalMs` and `now`, which the element already accepts and forwards to the player.
  - The results aliases (`QtiAssessmentResults`, `QtiAssessmentItemResult`, `QtiAssessmentEndReason`) now alias the assessment player's own types, so an `outcomeProcessingError` no longer goes missing from a published result.
  
  A drift-pin test walks each element's runtime source for the events it dispatches and pins the published maps to exactly those events.
- 2916759: Dead-code removal in the assessment and section players (cleanup phase 1). Delivery is unchanged: navigation, submission gating, attempts, timing, scoring and the reference backend behave exactly as before.
  
  **Breaking: removed APIs** (beta prerelease; migrate before upgrading):
  
  - `@pie-qti/assessment-player`: the `rng` option of `AssessmentPlayer.create()` (`BackendAssessmentPlayerConfig.rng`) is gone. It has been ignored since the backend started drawing selection and ordering at session start. Pass the seed to the reference backend instead: `new ReferenceBackendAdapter({ rng })`.
  - `@pie-qti/assessment-player`: `AssessmentPlayer.getItemSessionInfo()` no longer takes an item identifier. The argument was ignored: the method always reported the current item, and still does. Drop the argument.
  - `@pie-qti/assessment-player` no longer exports `shortSupportCode`, `isSubmissionBlockedError`, or the types `ItemRef` and `NavigationMode`. Nothing outside the package used them and no documentation named them. For a support code, read `assessmentErrorDisplay(error).supportCode`. To recognize a refusal that names unanswered questions, check `isAssessmentPlayerError(error)` and its `code` (`finalizeResponseRequired`, `finalizeResponseInvalid`, `leavePartResponseRequired` or `leavePartResponseInvalid`). No API took or returned `ItemRef` or `NavigationMode`.
  - `@pie-qti/section-player` no longer exports `hasDisplaySettingsChanged`. To test whether a candidate changed the display settings, compare them with `DEFAULT_DISPLAY_SETTINGS` (a different `textSize` step, or `highContrast` or `textSpacing` on).
  
  **`@pie-qti/section-player` dependencies:** `@pie-players/pie-calculator-desmos` and `@pie-players/tts-client-server` are no longer direct dependencies. The section player never imported them; `@pie-players/pie-default-tool-loaders`, which loads the calculator and read-aloud tools, declares and imports them itself, so they are still installed, at the same version. An app that imported either package without declaring it should add it to its own dependencies.
  
  Also removed, internal to `@pie-qti/assessment-player` and never reachable from its entry points: the navigation-gating `ItemSessionController.canNavigateAway()` and `validateItem()` (with the coordinator's wrapper), `ItemSessionController.resetItem()` and `clear()`, the reference session store's `removeSession()`, and the never-set `currentSectionStartTime` timing field. QTI gates submission, not navigation: `allowSkipping` and `validateResponses` stay enforced where they were, by the submission gate and the item player's response validation.
  
  `@pie-qti/player-elements`: the documentation of `QtiAssessmentPlayerConfig.rng`, which still seeds the element's built-in reference backend, no longer points at the removed headless option.
- 7cf746f: Response value types, serialized session state and parsing-limit cleanups (cleanup phase 2). Runtime behavior is unchanged except for snapshot variables without `defaultValue`; see below.
  
  **Breaking: `InteractionValueMap` describes what each component emits (types only).** Each entry is now the raw value the standard component's `qti-change` event and `onChange` callback carry, before the player normalizes it into the response declaration, instead of a guess from the QTI base type and cardinality. The runtime payload is unchanged, but event handlers and code typed against the old shapes through `InteractionValueMap`, `InteractionResponseValue`, `QTIChangeEventDetail` or `QTIInteractionElement.response` no longer compile:
  
  | Entry | Was | Now |
  | --- | --- | --- |
  | `matchInteraction`, `gapMatchInteraction`, `graphicGapMatchInteraction` | `Record<string, string>` | `string[]` of `"source target"` pairs |
  | `associateInteraction`, `graphicAssociateInteraction` | `Array<[string, string]>` | `string[]` of `"A B"` pairs |
  | `positionObjectInteraction` | `Record<string, { x: number; y: number }>` | `string[]` of `"x y"` points |
  | `selectPointInteraction` | `Array<{ x: number; y: number }>` | `string \| string[] \| null`: `"x y"` points, null once cleared |
  | `hotspotInteraction` | `string[]` | `string \| null`: the selected hotspot, null once cleared |
  | `hottextInteraction` | `string[]` | `string \| string[] \| null` |
  | `choiceInteraction` | `string \| string[]` | `string \| string[] \| null` |
  | `orderInteraction`, `graphicOrderInteraction` | `string[]` | `string[] \| null`: null for an empty subset order |
  | `extendedTextInteraction` | `string` | `string \| number \| Array<string \| number> \| ExtendedTextNumericRecord \| null` |
  | `drawingInteraction` | `string` | `QTIFileResponse \| null` |
  | `customInteraction` | `any` | `string \| null` |
  | `mediaInteraction` | `any` | `number`: the play count |
  
  The other entries are unchanged.
  
  **Breaking: serialized session variables require `defaultValue`.** `SerializedItemSessionVariable.defaultValue`, and `ServerSerializedVariable.defaultValue` in `@pie-qti/item-player/server`, are no longer optional: `serialize()` always writes the field, `null` when the variable has no default value. Restore reads `null` as "no default value"; a snapshot variable without the field now restores a NULL default instead of the default declared in the item XML. Snapshots written by `serialize()` are unaffected; hand-built snapshots must include the field.
  
  Also:
  
  - `<pie-qti-assessment-player>` no longer rewrites the host's `security` config to force `parsingLimits.enabled: true`. It passes the config through and decides the section depth limit with `normalizeParsingLimits`, which already treats limits as on unless the host passes `enabled: false`. Behavior is unchanged for every config, including `maxHtmlDepth` without `enabled`; an explicit `enabled: undefined` now bounds section depth too, as it already did every other limit.
  - Documentation corrections: the `qti-change` payload examples in the order, position-object, graphic-order, hottext, extended-text and web-components PRDs, and structured labels described as implemented and match-only (QTI tech guide, SPEC-GAPS G-13, accessibility and PNP PRDs, QTI 3 migration guide).
- 8d03d05: Module boundaries (cleanup phase 3), with one fix.
  
  **Fix: a coded error keeps its code across copies of the package.** `isAssessmentPlayerError` (and `assessmentErrorDisplay`, which builds on it) used `instanceof`, which fails for an `AssessmentPlayerError` created by another copy of `@pie-qti/assessment-player`. The `<pie-qti-assessment-player>` bundle carries two copies — it compiles the shell and core from source and also imports the package's built entry — so a coded error reached the `player-error` event without its `code`. A host that loads `@pie-qti/assessment-player` beside the self-contained player-elements bundle met the same split. Every `AssessmentPlayerError` now carries a `Symbol.for('pie-qti.AssessmentPlayerError')` brand, which the guard checks; recognize coded errors with `isAssessmentPlayerError`, not `instanceof`.
  
  Without behavior changes:
  
  - `@pie-qti/section-player` exports `filterToolsForRole`, the tool filter its composition applies. `@pie-qti/assessment-toolkit`'s `normalizeQtiToolConfig` is now that filter without PNP supports: the same result, still an array.
  - `@pie-qti/item-player` exports `DEFAULT_COMPONENT_TAGS_BY_TYPE`, its default custom-element tag per interaction type (plus `catalogPopup`), and `@pie-qti/default-components` derives `registerDefaultComponents` from it. Tag names are unchanged; the registrations' debugging `description` is now generic (`Default Svelte-based component for <type>`).
  - Internal: unpublished component source is imported through one workspace alias map instead of `../../../<pkg>/src` paths; item-player's presentation code no longer imports from its Svelte component helpers; the reference backend's session key prefix (`qti_session_`) is defined once, so saved sessions resume as before.
- fa577a0: No-legacy removals in the assessment and section players (legacy audit items A1 to A4). The project is pre-1.0 and keeps no compatibility paths for its own earlier APIs, wire shapes or stored formats. Spec-conformant delivery, scoring, timing and test feedback behave as before.
  
  **Breaking:**
  
  - **`FinalizeAssessmentResponse.feedback` is gone** from `@pie-qti/assessment-player`, and so from `QtiAssessmentFinalizeResponse` in `@pie-qti/player-elements`, which aliases it. The contract documented it as "legacy: single string; prefer outcomes + assessment.testFeedback". For a test without `testFeedback`, the player showed that string as one synthetic end-of-test feedback entry. Test feedback now comes only from the test's and its test parts' `testFeedback` blocks, evaluated against the outcomes the backend returns. To migrate a backend that answered `finalizeAssessment` with a feedback string, author the text as `testFeedback` in the assessmentTest and return the test-level `outcomes` that select it. `SubmitItemResponse.feedback` (the per-item `FeedbackItem[]`) is unchanged.
  - **The reference backend no longer rebuilds an item's test-level state from its stored score** (`ReferenceBackendAdapter`). Sessions it stored before item test states existed (earlier beta builds) hold only `itemScores` for their submitted items. Outcome processing used to rebuild those items' variables from the scores, count them as responded from their raw responses, and infer correctness from SCORE and MAXSCORE. Such items now reach outcome processing as presented with only their SCORE: not responded, neither correct nor incorrect. Their scores still count toward the totals. Sessions stored by current builds are unaffected. A submission whose response processing fails still counts as presented, and as responded when the candidate gave a response, as before.
  - **`responseInvalid` is no longer an `AssessmentPlayerErrorCode`.** The `@pie-qti/i18n` catalogs no longer carry its message (`assessment.errors.codes.responseInvalid`) in any of the eight locales, and `MessageKey` no longer includes that key. Nothing has thrown the code since navigation stopped gating on response validity (cleanup phase 1): invalid responses are refused at submission, with `attemptValidationFailed`, `finalizeResponseInvalid` or `leavePartResponseInvalid`. Drop the code from any `switch` and the key from catalog overrides.
  - **`@pie-qti/section-player` no longer maps the pre-1.0 toolkit TTS provider shape.** A `textToSpeech` tool's `provider` now applies over the section player's defaults as given. To migrate, name the backend with `backend` (`'server'` or `'browser'`) and the server with `serverProvider` instead of a string `provider`, move `settings` keys to the top level, and use `endpointValidationMode: 'none'` instead of `validateEndpoint: false`. The old keys now reach the toolkit unchanged, and the toolkit rejects a string `provider`.
  
  Also removed, internal to `@pie-qti/assessment-player` and never reachable from its entry points: `TimeManagerConfig.warningThreshold`, which was kept "for compatibility" and merged into `warningThresholds`. The player now passes the whole warning list, so `TimeManager` fires exactly the thresholds it is given. The host options are unchanged: `timeWarningThreshold` (default 60) sets the default warning and `timeWarningThresholds` adds to it.
- 3b3927e: The `qti-role` role list and its parser are one shared export (`parseQtiRole`/`isQtiRole` from `@pie-qti/item-player`) consumed by both the item and assessment elements, replacing the duplicated copy with its own warning style. An unknown `qti-role` on the assessment element now warns once and renders the candidate view (storing `'candidate'`) instead of warning on every occurrence and leaving the config fallback in charge — the same contract as the item element.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [c2e938b]
- Updated dependencies [bf509ec]
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
- Updated dependencies [080a35c]
- Updated dependencies [eb40f2e]
- Updated dependencies [4c18fe7]
- Updated dependencies [2fa635f]
- Updated dependencies [2dd61d4]
- Updated dependencies [7dcb9d7]
- Updated dependencies [d7d482f]
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
- Updated dependencies [bf483a3]
- Updated dependencies [184b47b]
- Updated dependencies [184b47b]
- Updated dependencies [9814c9b]
- Updated dependencies [098f997]
- Updated dependencies [410fe38]
- Updated dependencies [9abdf17]
- Updated dependencies [c6ae98c]
- Updated dependencies [ad99965]
- Updated dependencies [d6ac3bb]
- Updated dependencies [fff7dd7]
- Updated dependencies [0a5cc0e]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d6ac3bb]
- Updated dependencies [efcde5c]
- Updated dependencies [fe9e624]
- Updated dependencies [7cff6aa]
- Updated dependencies [362b7c1]
- Updated dependencies [7cff6aa]
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
- Updated dependencies [20e8e52]
- Updated dependencies [b8a2862]
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
- Updated dependencies [29d993f]
- Updated dependencies [47e9176]
- Updated dependencies [2916759]
- Updated dependencies [a183a16]
- Updated dependencies [7cf746f]
- Updated dependencies [8d03d05]
- Updated dependencies [1449b94]
- Updated dependencies [611b971]
- Updated dependencies [562182a]
- Updated dependencies [b5d8bf7]
- Updated dependencies [2fd1003]
- Updated dependencies [4f9a07c]
- Updated dependencies [edd4020]
- Updated dependencies [281d6fb]
- Updated dependencies [93df941]
- Updated dependencies [fa577a0]
- Updated dependencies [0bdb7f1]
- Updated dependencies [da6c48e]
- Updated dependencies [7c767d4]
- Updated dependencies [b38cb07]
- Updated dependencies [07f1bc2]
- Updated dependencies [d3619a3]
- Updated dependencies [db8e08f]
- Updated dependencies [3b3927e]
- Updated dependencies [893de7c]
- Updated dependencies [ff880bb]
- Updated dependencies [0570fd1]
- Updated dependencies
- Updated dependencies [9ec0f69]
- Updated dependencies [66b63f3]
- Updated dependencies [b668938]
  - @pie-qti/assessment-player@1.0.0-beta.5
  - @pie-qti/qti-common@1.0.0-beta.5
  - @pie-qti/default-components@1.0.0-beta.5
  - @pie-qti/item-player@1.0.0-beta.5
  - @pie-qti/i18n@1.0.0-beta.5
  - @pie-qti/section-player@1.0.0-beta.5
  - @pie-qti/ims-cp-core@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- 15ef671: Align declared dependencies with what shipped code actually imports, enforced by a new `check:dist-dependencies` gate (added to `verify:publish:quick` and `lint:all`):
  
  - `@pie-qti/player-elements` now declares `@pie-qti/default-components`, `@pie-qti/i18n`, and `@pie-qti/section-player` as real dependencies: shipped declarations import their types, so consumer typechecks no longer depend on hoisted installs.
  - `@pie-qti/transform-core` no longer installs `@pie-qti/test-utils` (and transitively `@pie-qti/storage`) at runtime; the same cleanup moves build-only `@pie-qti/transform-core` out of `@pie-qti/to-pie` / `@pie-qti/pie-to-qti2` runtime dependencies, drops unused `@tiptap/*` runtime entries from `@pie-qti/default-components` (bundled into its bundle, now devDependencies), and removes never-imported dependencies from `@pie-qti/assessment-player`, `@pie-qti/assessment-toolkit`, `@pie-qti/test-utils`, and `@pie-qti/section-player` (the two `@pie-players` packages that were only ever resolved transitively).
- 25ae481: Guard all custom-element registrations emitted in shipped bundles. Importing `@pie-qti/default-components/plugins` directly, or via `@pie-qti/player-elements/register`, no longer throws `InvalidStateError` when the elements are already registered — loading several of these entry points together, or loading the same one twice, is now safe. Builds additionally run a new post-build guard step, and `check:ce-define-safety` now also validates shipped `dist` bundles, not only source.
- f8e4225: Clarify the `QtiAssessmentPlayerConfig.rng` documentation: it seeds selection and ordering only in reference/preview mode (built-in reference backend) and is ignored in authoritative-backend delivery, mirroring the deprecated `rng` on the headless assessment-player config. Docs-only change to shipped declarations.
- Updated dependencies [b91a4a3]
- Updated dependencies [15ef671]
- Updated dependencies [a4ef12c]
- Updated dependencies [25ae481]
- Updated dependencies [bc58949]
- Updated dependencies [406c76c]
- Updated dependencies [fb2b4e2]
- Updated dependencies [29210b4]
  - @pie-qti/default-components@1.0.0-beta.4
  - @pie-qti/assessment-player@1.0.0-beta.4
  - @pie-qti/section-player@1.0.0-beta.4
  - @pie-qti/item-player@1.0.0-beta.4
  - @pie-qti/ims-cp-core@1.0.0-beta.4
  - @pie-qti/i18n@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [c408053]
  - @pie-qti/ims-cp-core@1.0.0-beta.3
  - @pie-qti/assessment-player@1.0.0-beta.3
  - @pie-qti/item-player@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- cf99206: The section's interface locale now reaches the pie-players tool toolkit through its `locale` attribute, so tool chrome takes that locale's `lang`/`dir` and labels from the toolkit's catalogs. The section player elements gain an `i18n` property, and `@pie-players/*` moves to 1.0.0-beta.6.
- Updated dependencies [d8f9b4d]
- Updated dependencies [5dbabcc]
- Updated dependencies [d0e249b]
- Updated dependencies [e874155]
- Updated dependencies [a202037]
- Updated dependencies [572c3d3]
- Updated dependencies [67d94ee]
- Updated dependencies [dba1477]
  - @pie-qti/item-player@1.0.0-beta.2
  - @pie-qti/assessment-player@1.0.0-beta.2
  - @pie-qti/ims-cp-core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- @pie-qti/assessment-player@1.0.0-beta.1
  - @pie-qti/ims-cp-core@1.0.0-beta.1
  - @pie-qti/item-player@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- 0d99546: Consolidate the assessment discovery pre-scan with the backend model's scan primitives.
  
  `@pie-qti/assessment-player` now exports `toCanonicalQtiName` and `@pie-qti/ims-cp-core` exports `hasUnsafeEncodedPathToken`, and the player-elements discovery parser reuses both instead of private copies, so QTI 2.x/3.0 name mapping and encoded-path safety cannot drift between the element pre-pass and the authoritative parse. The discovery parser's role (bounded pre-fetch, early depth rejection) and its item-map keying contract with the backend are documented in code. `@pie-qti/player-elements` also moves `@pie-qti/assessment-player` to runtime dependencies to match its existing runtime import of `ReferenceBackendAdapter`.
- 32c08b7: Content language follows `xml:lang`. `prepareContentMarkup` restates it as `lang`; the item body takes its `lang` from the item, exposed as `Player.getContentLanguage()`, and glossary lookups pass it. The section player sets the toolbar and TTS language from it and picks a Polly voice for that language unless the host configures `defaultVoice`, which no longer defaults to Joanna; shared HTML blocks take an optional `language`.
- 6c209e2: AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
- 30b045d: Test-level outcome processing sees every delivered item with its typed variables, section path, categories, weights, declared normal bounds and presented/responded/correct/incorrect/selected flags, so `numberResponded`, `numberSelected`, `numberCorrect` without `MAXSCORE`, section and category filters and weighted `testVariables` evaluate as authored. Item scoring reports `correct`; `outcomeMinimum`/`outcomeMaximum` read `normalMinimum`/`normalMaximum`.
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
- 953e5d1: Shared catalog files from the content package manifest (G-15, QTI 3.0 §6.3): `loadResolvedManifest` surfaces resources of type `imsqti_catalog_xmlv3p0` as `sharedCatalogs`; `createResolvedItemDeliveryContext` accepts `packageCatalogSources` and the reference backend adapter threads a host-supplied list (`parseAssessmentTestXml({ sharedCatalogs })`, exposed as `QtiAssessmentPlayerConfig.sharedCatalogs`) into every item's delivery context. The item player merges package-scope entries at the bottom, so an item-level `qti-catalog-info` wins a shared identifier and a shared file backs items that declare none.
- c785703: Show `testFeedback` at test and test-part level by typed outcome values, single or multiple, with `access="during"` during the test and `atEnd` at the end of the test or its part. The backend contract returns `outcomes` from `submitResponses`, a resumed `initSession` and `finalizeAssessment`; `sum` and `product` accept multiple and ordered containers; QTI 3 items score under their own identifier.
- 8063850: Test structure semantics: the backend draws selection (with replacement clones) and ordering (with `keepTogether`) at session start and stores the draw; preconditions and item, section and test part branch rules decide `nextItemIdentifier`; item session control cascades per item and the backend enforces `maxAttempts` and `allowComment`; an expired test part, section or item limit locks that scope. A backend must now return the drawn assessment and the first eligible item as `InitSessionResponse.currentItemIdentifier`. The player's `rng` option is ignored; pass it to `new ReferenceBackendAdapter({ rng })`.
- Updated dependencies [eca64c2]
- Updated dependencies [0d99546]
- Updated dependencies [32c08b7]
- Updated dependencies [6c209e2]
- Updated dependencies [0f93a03]
- Updated dependencies [1521a74]
- Updated dependencies [a7c714e]
- Updated dependencies [5be190e]
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
- Updated dependencies [c785703]
- Updated dependencies [8063850]
  - @pie-qti/assessment-player@1.0.0-beta.0
  - @pie-qti/ims-cp-core@1.0.0-beta.0
  - @pie-qti/item-player@1.0.0-beta.0

## 0.1.28

### Patch Changes

- @pie-qti/item-player@0.1.28

## 0.1.27

### Patch Changes

- Updated dependencies [498b1e2]
  - @pie-qti/item-player@0.1.27

## 0.1.26

### Patch Changes

- af8ee10: `QtiSectionDiagnosticSource` names diagnostics a host contributes `'host'`. Breaking: a host emitting the previous host-specific source value switches to `'host'`. The select-point rejection message now says PIE has no element for selecting a point on an image.
- Updated dependencies [34c0034]
  - @pie-qti/item-player@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/item-player@0.1.25

## 0.1.24

### Patch Changes

- 080f254: Render readable assessment labels before host translations finish loading, and adopt a later context provider without restarting the attempt. Explicitly configured providers continue to take precedence.
- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.
- 10eba70: Keep assessment answers visible after a failed submission, provide a focused retry action, and prevent duplicate submission while a request is pending.
- Updated dependencies [67e4c23]
  - @pie-qti/item-player@0.1.24

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
- Updated dependencies [d476546]
- Updated dependencies [2fd7a31]
  - @pie-qti/item-player@0.1.23

## 0.1.22

### Patch Changes

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
  - @pie-qti/item-player@0.1.22

## 0.1.21

### Patch Changes

- Updated dependencies [8836ebf]
- Updated dependencies [2c00bd1]
  - @pie-qti/item-player@0.1.21

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
- Updated dependencies
  - @pie-qti/assessment-player@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15
  - @pie-qti/section-player@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
- Updated dependencies [30a4d2a]
  - @pie-qti/section-player@0.1.14
  - @pie-qti/item-player@0.1.14
  - @pie-qti/assessment-player@0.1.14
  - @pie-qti/qti-common@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.13
  - @pie-qti/item-player@0.1.13
  - @pie-qti/qti-common@0.1.13

## 0.1.12

### Patch Changes

- Updated dependencies [abe0be5]
  - @pie-qti/item-player@0.1.12
  - @pie-qti/assessment-player@0.1.12
  - @pie-qti/qti-common@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.11
  - @pie-qti/item-player@0.1.11
  - @pie-qti/qti-common@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.10
  - @pie-qti/item-player@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.9
  - @pie-qti/item-player@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.8
  - @pie-qti/item-player@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.7
  - @pie-qti/item-player@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.6
  - @pie-qti/item-player@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.5
  - @pie-qti/item-player@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.4
  - @pie-qti/item-player@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.3
  - @pie-qti/item-player@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.2
  - @pie-qti/item-player@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/assessment-player@0.1.1
  - @pie-qti/item-player@0.1.1
