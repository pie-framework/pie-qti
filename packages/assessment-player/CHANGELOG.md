# @pie-qti/assessment-player

## 1.0.0-beta.5

### Patch Changes

- c2e938b: Internal restructuring of the assessment player core; no behaviour change. `AssessmentPlayer` becomes an orchestrator that keeps the public façade, the transition lock, the current item and the terminal state, while the pure policy moves into its own `core/` modules (delivery structure, scope locks, navigation legality, exit-boundary resolution, submission gate, review views, time policy, template defaults) and the independent pieces are extracted (a typed event emitter behind the unchanged `on*` subscriptions, a `PauseController`, and the autosave wiring around the existing `AutosaveManager`). `AssessmentSessionCoordinator` is now the only writer of session state, through one commit method per submit-path combination (individual/simultaneous × backend returns/omits `updatedState`) — the state shape sent to backends and snapshots is unchanged, and no public export moves (`SubmissionBlocker` and `EffectiveItemTimeLimits` are re-exported from `AssessmentPlayer` as before).
- bf509ec: Branch-rule targets are honored forward-only on every path (QTI 2.2 §5.15: the test jumps forward, and an item or section target must refer to something that has not yet been presented — a delivered test cannot re-enter presented items). The client path (`exitBoundaries.branchTargetIndex`, and the branch hop in `AssessmentPlayer.followBranch`) previously resolved a literal target to the first item with that identifier anywhere in the delivered sequence, so a backward-targeting decision — spec-violating content, or a production backend echoing a raw target — made the candidate revisit an already-presented item while the reference backend moved forward. Both engines now resolve literal targets through one shared helper (`testStructure.firstForwardBranchTarget`: the first forward match by item, then enclosing-section, then test-part identifier), so identical XML branches identically on the backend and client paths; parity is pinned by tests over the same fixtures. A target with no forward occurrence is skipped — the rule does not fire and delivery falls through to the next item, exactly as the backend's own walk does — and a target whose identifier is presented again later lands on its first forward occurrence. `EXIT_TEST` / `EXIT_TESTPART` / `EXIT_SECTION` handling is unchanged.
  
  **Breaking:** a branch decision (a backend's `nextItemIdentifier`) naming an already-presented item no longer navigates backwards. Delivery skips such a decision and falls through to the delivery rules; content authoring backward branch targets (a spec violation) and hosts returning raw backward decisions see forward delivery now, never re-entry.
  
  The `SecureTimeLimits.minTime` / `maxTime` JSDoc now states their unit (seconds), matching every other duration field in the package.
- d7a8262: Package metadata hygiene: `@pie-qti/default-components` now declares svelte with a caret range (`^5.57.1`) like every other package instead of an exact pin that could ship two svelte runtimes into one bundle; `@pie-qti/assessment-toolkit` drops its never-imported `@pie-qti/ims-cp-core` dependency and `@pie-qti/assessment-player` drops its never-imported direct `@pie-qti/default-components` entry (it consumes default-components transitively through `section-player`, which remains declared). Both packages gain READMEs (assessment-toolkit, source-profiles) describing their role and consumers.
- 080a35c: Assessment delivery correctness fixes in the assessment core:
  
  - **EXIT_* branching finalizes the test.** QTI `branchRule` targets `EXIT_TEST` / `EXIT_TESTPART` / `EXIT_SECTION` now terminate delivery through the same finalization path as `submit()`: pending simultaneous-mode responses are submitted, outcome processing runs, results are produced, `complete` fires, and navigation is closed afterwards (typed `testFinalized` rejection). Previously `EXIT_TEST` only fired the completion callback with no submit, no outcomes and no results, and `next()` kept presenting the remaining items.
  - **Navigation transitions are serialized.** While a navigation/submission round trip is in flight, further navigation or submit calls reject with a typed `navigationInFlight` error instead of racing the backend (which could discard a response). `getNavigationState().isLoading` now carries the real in-flight flag, with `onBusyChange`/`isBusy()` for hosts; the shell disables Previous/Next/Submit and sets `aria-busy` while busy. A failed submit keeps the candidate on the same item with the response intact and retryable.
  - **`ItemSessionController` QTI defaults fixed.** `maxAttempts` now defaults to 1 (the QTI default; 0 remains unlimited for adaptive items) instead of unlimited.
  - **Outcome-processing failures surface.** `ReferenceBackendAdapter` no longer swallows test-level outcome-processing errors: submit/finalize responses, the persisted session and `AssessmentResults` carry a typed `OutcomeProcessingError` (stable code `OUTCOME_PROCESSING_FAILED`), hosts receive it via the new `config.onError` callback and the assessment element's `player-error` event, and candidate responses stay accepted and persisted.
  - **Coded, localizable errors.** The core throws `AssessmentPlayerError` (stable `code` + `params`) for every candidate-visible failure; the shell renders localized messages from `assessment.errors.codes.*` (new keys in all 8 locales) plus a short support code, so backend/raw error strings are never shown to candidates.
  - **Invisible sections are truly invisible.** Sections with `visible="false"` (or under an invisible ancestor) are omitted from candidate-facing section data, their titles never surface, and items still deliver in order under the outermost visible ancestor. `getAllSections()` now returns `CandidateSectionView` entries with a `navigable` flag (legal targets for the current navigationMode) and `navigateToSection()` rejects illegal jumps with typed errors.
- eb40f2e: Fix the assessment dialog (submit confirmation, leave-part warning) sometimes closing itself right after it was reopened. Browsers fire a dialog's `close` event from a queued task, and Chromium can run the click that reopens the dialog before it, so a stale event from the previous close cancelled the new one. The dialog now ignores close events it caused itself and treats only browser-initiated closes as a cancel.
- 4c18fe7: Assessment player core fixes: the scope-expiry hop runs under the transition lock.
  
  - **Expiry hops serialize with in-flight transitions.** When a test part, section or item limit without late submission runs out while a candidate navigation or submission transition is in flight, the scope still closes at once — but the move to the next open question now queues behind that transition (the player stays `isBusy()` for it) and takes the transition lock when the player is idle again, like every other state-changing path. Previously the hop ran outside the lock: it could move delivery in the middle of a backend submission or a part-crossing jump, and the jump could then move delivery a second time, re-opening the item session it landed on. Now the in-flight transition completes first (exactly one landing), and the branch decision its submission returns is dropped when a queued hop is about to move delivery — the same outcome as before, without the mid-flight move. A hop still waiting is moot once the test finalized, and dropped when the player is destroyed. For a raced submission the `scopeTimeExpired` event is reported after the transition settles: with the hop's `nextIndex` when the hop itself moves, without it when delivery already sits on an open question. An expiry that fires while the player is idle behaves exactly as before.
  - **The whole-test expiry queues for the lock instead of retrying.** The auto-finalize that ends the test when `timeLimits.maxTime` runs out used up to five tries behind in-flight transitions (a `navigationInFlight` miss re-armed on the player going idle); with enough administrative transitions taking the lock back-to-back — the queued expiry hops of nested timed scopes, a force submit, a host acting on idle — the budget could run out and the test stayed open for the candidate to submit. It now queues once with the same mechanism as a force submit: the lock is taken the moment the last transition settles, however many transitions intervene, and no candidate action slips in first. A transition that ends the test itself still suppresses the expiry notice, and a failed end still leaves the test open with the Submit action.
  - **The core no longer imports the integration layer.** The pure delivery-rules walk (branch rules, preconditions, eligibility — `nextItemIdentifier`/`firstEligibleItem`) moved verbatim into the shared `core/testStructure.ts`, the module the client's navigation legality already shares with the backend. `@pie-qti/assessment-player/integration` re-exports the walk, so its surface is unchanged and no import path a host could import moved.
- 2fa635f: The assessment shell's two remaining double-state controls, the dialog action-button styles, and a duplicate-bundle finding from the final review round are fixed.
  
  **The timer control keeps one name in both states (WCAG 4.1.2).** Its accessible name used to flip between "Show timer" and "Hide timer" while `aria-expanded` changed at the same time, so the state was announced twice and the name a voice-control user speaks changed with every press. The control is now a disclosure named for what it reveals — a stable "Timer" (`assessment.timer.label`, new in all locales) — and `aria-expanded` (with `aria-controls` while the countdown exists) alone carries the state.
  
  **Breaking: locale keys removed and a visible label renamed** (beta prerelease). `assessment.timer.showTimer` and `assessment.timer.hideTimer` have no use left and are removed from all locales (hence the `@pie-qti/i18n` entry); hosts that override them in a custom catalog can drop the overrides. Hosts that depended on the visible "Show timer" / "Hide timer" text (tests or voice-control grammars) now see "Timer" in both states.
  
  **The review button carries its state exactly once (WCAG 4.1.2).** Its visible label still flips ("Review questions" when the review screen is closed, "Back to question" when it is open — the two views genuinely differ, and the label is the only affordance back out of review), and it is the accessible name, so `aria-expanded` is removed: it announced the same fact a second time, and the whole main region it swaps is no disclosed region of this control. `aria-pressed` was considered and rejected for the same reason. Its visible labels are unchanged.
  
  **The dialog action buttons' styles have one source.** The `.submit-dialog-action` rule family was copied across the submit confirmation, the resume prompt and the leave-part warning, and the copies had drifted. They now share one injected rule (`submitDialogAction.ts`, once per document, after the default-components `srOnly.ts` idiom); the class stays the theme hook and every declaration is unchanged, so the rendered styles are identical.
  
  **`@pie-qti/player-elements` ships each module once.** The bundle compiled the two players' Svelte components from source while a bare `@pie-qti/assessment-player` / `@pie-qti/section-player` import resolved to those packages' built `dist` — a second module identity for code the bundle also carried as source. Seven assessment- and section-player modules shipped twice (~7.6 KB; the coded-error class stayed one identity only through its `Symbol.for` brand). The build now pins the two bare names to the same source entry every other import uses: total dist JS drops from 9,764,880 to 9,757,312 bytes on identical sources, duplicated modules 7 → 0, and the error brand key appears exactly once. Consumers are unaffected — the package stays a self-contained bundle with zero runtime bare imports, and public types still resolve to the built declarations. Pinned by `tests/bundle-single-copy.test.ts`, which reads the built sourcemaps and fails if any module is bundled from both a package dist and its source.
- 2dd61d4: Assessment player fixes:
  
  - **Next is offered at a simultaneous part's end when the crossing flush decides.** `canNext` and `getForwardTransitionInfo()` used the delivery rules' result from before the part's responses were submitted, so when those pre-flush rules found nothing after the part (for example a following part whose preCondition reads the part's item outcomes) the shell showed Submit instead of Next, although the flush in `next()` would branch on, open the next part or take an `EXIT_TEST` decision. While the part still has responses to submit, the step now reports like a submitting Next: it is offered when an open item follows, as a step out of the part (`leavesTestPart: true`, the adjacent open item standing for the flush's decision).
  - **Test-level outcomes are persisted with the session state.** `AssessmentSessionState.testOutcomes` now carries the values the backend last returned from its outcome processing, so a restored session's branch and preCondition rules evaluate on them and navigate identically to the live one. Session-format addition: backends that never store the field just lose the values across a resume, and the restored rules evaluate on missing outcomes.
  - **`timeWarningThreshold: 0` turns the default warning off.** It used to fall back to 60 seconds (an `||` fallback); `0` now means no default warning, while `timeWarningThresholds` still fire. Unset keeps the 60-second default.
  - **A hint keeps a reopened item's session open.** An uncounted (hint) submission after a counted check could close the item session — response processing may mark the item completed (a hint on a correct answer) — leaving the candidate with no way to answer. After a hint the session is as open as it was before it, and the hint's accepted response set stands as the item's last submitted set: moving on unchanged still follows the counted decision on record instead of re-submitting the hint response.
- d7d482f: Backend branch decisions (`nextItemIdentifier`) are now honoured everywhere delivery moves, not only on the submitting move. QTI-observable navigation changes:
  
  - **Simultaneous test parts follow branching.** Leaving a simultaneous part on Next submits the part's pending responses first and then follows the decision the backend returned for the part's last item (its testPart branchRule ran there, with every variable committed), through the same part-leave, `EXIT_TEST` and finalized guards as a submitting move. Previously the crossing precomputed its landing from the delivery rules before the flush — with no item variables committed — so a testPart branchRule was ignored and the next part's precondition was evaluated on uncommitted state; an `EXIT_TEST` rule at the crossing never fired at all. A decision target inside the part that is ending is rejected, and the end of the test's own collection (the same submit path) stores no decision — it never navigates.
  - **Kept decisions cannot go stale.** Any later counted submission voids the decision kept for an earlier one, so a testPart rule in a nonlinear part re-evaluates on the moved outcomes instead of replaying a target decided on the old ones.
  - **Live and restored sessions land identically.** The kept decision is persisted with the session state (`AssessmentSessionState.branchDecisions`, item identifier → target, stored with that item's last-submission record), so a save/resume follows it exactly as the live session would. Session-format addition: backends that never store the field just lose the kept decision across a resume and fall back to the delivery rules.
- 3d51b92: Fix `endAttemptInteraction` delivery inside assessments and honor `countAttempt` on every item:
  
  - **Assessment delivery decides the end-attempt submission.** The item player auto-submits only a session it owns (standalone). With an injected session (assessment delivery), the `AssessmentPlayer` recognizes the end-attempt response on the normal response path from the item's `endAttemptInteraction` metadata: in `individual` submission mode it submits the item through the normal per-item path (branching ignored — the candidate stays on the item); in `simultaneous` mode the response is recorded like any response and response processing stays deferred to the end of the testPart, so the final submission always succeeds. A locally closed session no longer makes a later submission throw.
  - **`countAttempt="false"` works on non-adaptive items.** Response processing runs (hint outcomes and feedback compute), but `numAttempts` is unchanged, `completionStatus` is not forced to `completed`, and the session stays open so the candidate continues. Only a counted attempt finalizes a non-adaptive item. Works for QTI 2.2 `countAttempt` and QTI 3.0 `count-attempt`.
  - **`SubmitResponsesRequest.countAttempt`** (default true) lets the client mark a hint submission; the reference backend honors it by skipping the maxAttempts rejection, not recording a result, and leaving the attempt count unchanged.
  - **Test-level outcome processing reads the built-in scope durations.** `duration` (test), `TESTPART_ID.duration` and `SECTION_ID.duration` are declared from the persisted timing clocks in QTI seconds (clocks stay in milliseconds), alongside the item-level `ITEM_ID.duration`.
- cfb78e2: Assessment shell practice delivery and completion round: item-level check answer with attempts and feedback, candidate comments, and a built-in completion screen with an opt-in results summary.
  
  **Practice delivery ("Check answer").** In an `individual` submission-mode part whose resolved `itemSessionControl@showFeedback` is on, an item with more than one allowed attempt (or an adaptive item) now shows an item-level "Check answer" control in the navigation bar — distinct from the section's Next and the test's outlined Submit — with a polite "Attempt N of M" counter beside it (`AssessmentPlayer.getCheckAnswerState()` / `checkCurrentItem()`). Checking submits the item through the normal per-item path (counted, backend-authoritative) and stays on it: integrated feedback renders from the computed outcomes, and any item modal feedback the submission produced opens in the shell's dialog (`getLastItemFeedback()`; a backend that delivers no candidate-side response processing supplies the same surface through `SubmitResponsesResponse.result.feedback`). While attempts remain, a non-adaptive item reopens writable from its pre-submit state with the outcomes restored so the candidate revises and checks again; adaptive items keep their engine loop. Once the attempts are used up the control disables with a localized explanation and moving on needs no further submission; moving on re-submits an already-checked item only when the response changed (an unchanged answer never spends an extra attempt). `showFeedback=true` with a single attempt keeps today's submit-on-move delivery — the captured feedback dialog rides the transition; simultaneous parts and `showFeedback=false` never offer the control. A counted submission no longer double-counts the attempt when the backend returns `updatedState` with its own `itemSessionStates`.
  
  **Candidate comments (QTI `allowComment`).** A per-item "Comments for the test team" disclosure above the navigation bar edits the item's comment into the session state (`AssessmentPlayer.setItemComment`, autosave-aware, rides snapshots) and it is sent as `SubmitResponsesRequest.comment` with the item's submissions (already honored by the reference adapter).
  
  **Completion screen.** After finalization the shell replaces the dead last item with a candidate-facing completion state — "You have finished the test", or its time-expired variant when a whole-test limit auto-submitted — rendering the test's outcome-matched `testFeedback` and moving focus to its heading. The host opts in per embed with the shell's `showResultsSummary` prop (the `<pie-qti-assessment-player>` element's `show-results-summary` attribute) to add a per-question results summary from the new `AssessmentPlayer.getResultsSummary()`: each delivered item's answered status plus the backend's score when returned, under the finalized total. `onSubmit`/`submit` still deliver the full results; `onComplete` now fires after `submit()`'s results exist. Token-styled, keyboard-clean, reflows to 320px; new `assessment` locale keys (check answer, attempts, comments, completion) in all 8 locales.
- 99341e5: QTI specification fixes in the scoring engine and item player, plus QTI Results Reporting output.
  
  - **Durations are seconds, as QTI defines them.** `@pie-qti/qti-processing` reads duration values as seconds: the specified `xsd:double` form (`<baseValue baseType="duration">30</baseValue>`, previously rejected as invalid) and, as a leniency, ISO 8601 (`PT30S`). `durationLT`/`durationGTE` normalize both operands, so a malformed duration is invalid instead of silently comparing false, and `match`/`equal` compare durations by their seconds. In `@pie-qti/item-player` the built-in `duration` variable now holds seconds, so response processing compares it with seconds. **Behavior change:** the QTI variable value seen in `ScoringResult.outcomeValues.duration`, `SerializedItemSessionState.contextVariables.duration` and `ItemSessionView.context.duration` is now seconds (it was milliseconds). The host-facing `duration` fields — `SerializedItemSessionState.duration`, `ItemSessionActionResult.duration`, `ItemSessionView.duration` — stay in milliseconds, and sessions saved before this change restore correctly. New helpers: `parseDurationSeconds`, `durationSeconds`, `durationSecondsFromMilliseconds`.
  - **Unsupported response-processing templates fail explicitly.** An item whose `responseProcessing` only references a template the player does not implement now fails compilation with `UnsupportedResponseProcessingTemplateError` (exported), instead of logging a warning and scoring its outcome defaults. The predefined `no_response_processing` template is supported (the standard empty program: outcomes keep their defaults); strict QTI compliance no longer rejects QTI 3.0 items.
  - **`strictQtiCompliance` validates the item.** Compilation checks the item's QTI namespace, its element names against the XSD-verified QTI 2.2/3.0 vocabulary (unknown QTI-namespace elements and unknown `qti-` elements), interactions whose `responseIdentifier` has no `responseDeclaration`, QTI interactions without a `responseIdentifier`, and response-bound elements no registered extractor renders (previously skipped silently). Findings are listed on the new `AssessmentItemDefinition.diagnostics` and logged: warnings by default, errors in strict mode, where versions other than QTI 2.2 and 3.0 are findings too. Strict mode with `rejectUnknownExtensions` throws a `QtiComplianceError` carrying them. **Behavior change:** strict mode no longer rejects QTI 3.0 items for not being QTI 2.2.
  - **matchGroup is enforced in response validation.** `validateResponses` reports pairs that `matchGroup` forbids in associate, match, gap match, graphic gap match and graphic associate responses (`match_group` errors, which block submission), so restored or programmatic responses cannot bypass the renderers' restriction.
  - **Version detection says when it guessed.** `@pie-qti/qti-common` adds `detectQtiVersionDetailed`, which returns the version `detectQtiVersion` returns together with its basis, a confidence and warnings — for example when an unversioned `assessmentItem` is assumed to be QTI 2.2. It also exports the QTI element vocabularies (`isQtiVocabularyElement`, `QTI2_ELEMENTS`, `QTI2_XHTML_ELEMENTS`, `QTI3_ELEMENTS`).
  - **QTI Results Reporting.** `@pie-qti/assessment-player` adds `toAssessmentResultXml(results, { version: '2.2' | '3.0' })`, which writes the assessment's results as a QTI Results Reporting `assessmentResult` document (context, test result with outcomes and durations, an item result per item with its status, response and outcome variables), and `serializeAssessmentResult` for hand-built reports.
  
  Deliberate deviations from the specification (Unicode folding in string comparison, duration lexical forms, the matchGroup reading) are documented in `docs/QTI_techguide.md` §7.4.
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
- 184b47b: Assessment player core fixes (round 3 review): no orphaned players, honest failures, isolated listeners.
  
  - **A player whose creation resolves after teardown is destroyed.** `createPlayerConnection` now counts teardowns (`teardown()`/`destroy()`); if the shell unmounts (or a retry tears down) while `AssessmentPlayer.create()` is still in flight, the resolved player is destroyed exactly once and never assigned or wired — previously it was adopted with nobody owning it, and its TimeManager interval ticked forever.
  - **Unevaluable branch rules and preConditions are reported, not silent.** A test-scope condition that fails to parse or evaluate still reads as false (delivery proceeds on the default path — the documented divergence; a NULL result reading as false is unchanged, per QTI), but the failure is no longer indistinguishable from an authored false: `nextItemIdentifier`/`firstEligibleItem`/`evaluateTestCondition` take an optional reporter, and the player reports a coded `testConditionFailed` `AssessmentPlayerError` through `config.onError`, once per distinct failed rule however often delivery re-evaluates it. Callers without a reporter (the reference backend's own evaluation) keep the console warning.
  - **Reference backend persistence failures are honest.** `saveSession` returns whether the localStorage write landed, and the adapter propagates it: `saveState` returns `success: false` (the autosave engine's existing `failed` indicator, backoff retry and onError take over), `submitResponses` refuses the submission it cannot persist (`success: false` — the player restores the pre-submit state and throws its coded `submitFailed`, so an accepted-but-unstored answer can no longer silently vanish on resume), and `finalizeAssessment` returns `success: false` when the `finalized` flag never persisted (the player throws its coded `finalizeFailed` and the test stays open — it no longer reports a completion that a resume would resurrect). The initial session write and outcome-processing-error bookkeeping stay best-effort (their response shapes carry no failure).
  - **Item scoring failures are distinguishable from wrong answers.** When response processing fails, the reference scorer still accepts the submission with a degenerate 0 (keeping the item's declared `normalMaximum` where known instead of inventing 1) and now carries an `ItemScoringError` (`{ code: 'ITEM_SCORING_FAILED', message }`) on `AssessmentScoringResult.scoringError` — the item-level mirror of `outcomeProcessingError`. The player reports it once per distinct item failure through `config.onError` as a coded `itemScoringFailed` error.
  - **A throwing host listener can no longer break delivery.** `TypedEventEmitter.emit` isolates per-listener exceptions (logging and continuing, the ItemSession subscriber pattern), so a throwing `busyChange` listener can no longer leave `transitionInFlight` stuck true (every later transition rejected as `navigationInFlight`) — the flag is also now set inside the try — and a throwing `scopeTimeExpired` listener can no longer kill an expiry hop mid-notify with the expired scope left locked. `leaveExpiredScope`'s completion handler keeps swallowing only the destroyed-player case and reports any other rejection through `config.onError`, aligned with the automatic finalization.
- 184b47b: Documented and implemented the `config.onError` reach policy for candidate-initiated failures.
  
  - **Hard backend failures of an end of the test now reach `config.onError`.** The hook documented itself as the host surface for core and backend failures, but a candidate's submit or finalize that the backend refused surfaced only as inline shell state. The built-in shell (`AssessmentShell`) owns the config and now calls the host's `config.onError` at those sites, once, with the typed error: `submitFailed` and `finalizeFailed` reach both the host hook and the shell's inline submit-failure alert (with Retry). Validation refusals stay inline-only: the coded warnings naming questions still needing an answer (`finalizeResponseRequired` and friends) and `attemptValidationFailed` are candidate-facing state, never failures, and never call the hook. The `onError` JSDoc documents this policy, together with the failures the core already reports (failed item entries, `outcomeProcessingFailed`, `testConditionFailed`, `itemScoringFailed`, a failed expiry auto-finalization, autosave rejections).
  - New stable error codes in the `AssessmentPlayerError` taxonomy: `testConditionFailed` (a test-scope branch rule or preCondition that could not be evaluated) and `itemScoringFailed` (an item whose response processing failed). Additive; existing codes unchanged.
  - New `ItemScoringError` type and optional `scoringError` field on `AssessmentScoringResult` (see the core fixes changeset). Additive.
  - The delivery-rules helpers `evaluateTestCondition`, `nextItemIdentifier` and `firstEligibleItem` (re-exported from `@pie-qti/assessment-player/integration`) accept an optional trailing reporter `(expressionXml, error) => void` for condition evaluation failures. Additive, optional parameter.
  - `saveSession` (reference session store) now returns `boolean` instead of `void`, reporting whether the write landed. Callers that ignored the result are unaffected.
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
- 7cff6aa: The two results-report writers share one undeclared-base-type inference (`inferBaseType`, in the reporting module both `serializeAssessmentResult` and `toAssessmentResultXml` import). A value that no declaration and no serialized field types writes as `boolean` (booleans), `integer` (whole numbers), `float` (fractional numbers) or `string` (anything else); a list types itself by its members — `integer` only when every member is a whole number, `float` when any member is fractional, else its first member's type. **Behavior change:** `toAssessmentResultXml` used to carry its own inference that wrote every undeclared number, and every undeclared list of numbers, as `baseType="float"`, so the same undeclared whole number wrote `integer` from one writer and `float` from the other. Undeclared whole numbers now write `baseType="integer"` — an undeclared whole value is an integer base-type value in QTI's value spaces, and the writers, the PCI variable JSON binding, and the schema-valid output all agree. Declared variables (the overwhelmingly common case) are untouched, and documents remain valid against both results schemas.
- dc38e3b: Assessment shell resilience round: debounced autosave with resume, candidate-safe load/failure screens, and targeted response updates.
  
  **Autosave (default ON when the backend supports it).** `BackendAdapter` gains a `canSaveState` capability flag (default `true`; `ReferenceBackendAdapter` implements it), and the core now actually calls `saveState`: candidate activity (responses, navigation, flags, timer visibility, pause) restarts a 1.5 s debounce (`autosaveIntervalMs`), the shell flushes on `visibilitychange`/`pagehide`, and nothing saves after finalization. Saves defer while a transition is in flight and fail non-fatally (console + typed event + indicator, retried on the next change). New config: `autosave`, `autosaveIntervalMs`, `onAutosaveChange`, `onAutosaveFailed`; the `<pie-qti-assessment-player>` element gains `autosave` / `autosave-interval-ms` attributes and `autosave-change` / `autosave-failed` events. Hosts that persist state themselves set `autosave: false` (or `canSaveState: false`), which also hides the new save indicator ("Saving…" / "Saved · 12:04" / "Not saved", localized, polite live region). The navigation bar's snapshot section gained an optional `saveLabel` slot. Snapshots stamped with `timing.savedAt` date the new resume prompt: a session created from a stored draft (`initSession.resumeSessionId`; `ReferenceBackendAdapter.latestSessionId()` finds it) asks "Resume your test?" — Resume restores answers, flags and the hidden-timer preference, Start over confirms (WCAG 3.3.4) and calls the new `AssessmentPlayer.startOver()` to clear the draft, persist the blank state and restart at the first item. Restored-paused sessions still reopen paused. `hasRestoredProgress()`/`getRestoredSavedAt()` expose the resume facts.
  
  **Safe load, failure and crash screens.** The 10 s loading timeout no longer turns into a permanent error: it becomes a polite "Still loading" status that clears itself, and its developer-phrased message is replaced by candidate-safe text in all 8 locales. A failed load renders the localized coded-error message (never raw backend text) with a Retry control that re-initializes the session, and `<svelte:boundary>` now wraps the question content area and the shell's dialogs, so a crash during item rendering shows a localized "This question could not be displayed" fallback with Try again / Continue (navigation rules still apply) instead of blanking the test.
  
  **Response updates are O(changed item), not O(assessment).** Profiling showed every keystroke rebuilt the whole section composition with two `structuredClone` calls per delivered item (48 clones for a 24-item section). The composition now carries the active session and the section's response records by shared reference (`AssessmentPlayer.getSectionItemResponses()`, `getCurrentSectionItemRefs()` no longer clones delivery contexts), and the shell rebuilds it only on item/section/delivery changes — keystrokes recompute answered counts only. A unit guard pins a keystroke at one deep copy and a composition build at zero. Section-host `onSnapshotChange` notifications now fire per navigation instead of per keystroke; hosts needing per-edit events keep `onResponseDelta`/`response-change`.
  
  **Also:** `toSectionComposition` passes the real assessment id (not the section identifier) to `resolveQtiSectionComposition`, and the shell root is a PNP surface driven by the candidate's display-settings changes, so display accommodations cover the header, navigation bar and timer chrome while the section player keeps covering its own subtree (scopes non-overlapping; nested inverting filters are neutralized). New `assessment` locale keys (autosave, resume, still-loading, item error) in all 8 locales.
- af961a1: Submit safety, review screen and flag-for-review in the candidate shell (WCAG 3.3.4):
  
  - **Submitting is confirmed, never accidental.** The final-submission control is styled and placed apart from the primary Next (outlined, error-toned, distinct icon) and opens a confirmation dialog that states the answered count ("8 of 12 answered"), names the flagged questions, lists every unanswered question with a jump link where the navigation rules allow (linear parts render status only), and requires an explicit confirm; cancel and Escape return focus to the Submit control. A failed submission closes the dialog and moves focus to the retry control so the alert is reachable.
  - **Leaving a test part warns "you cannot return".** QTI parts cannot be re-entered, so when the next step crosses the part boundary the shell first shows a clear confirmation (`AssessmentPlayer.getForwardTransitionInfo()` reports it).
  - **Candidate review screen and item palette.** The navigation bar gains a review view (also offered from the submit confirmation) listing all delivered items grouped by candidate-visible sections with answered / partially answered / unanswered, flagged and not-yet-visited as text plus an icon (never colour alone), `aria-current` on the live item, jump buttons wherever jumping is legal, a note explaining status-only listing in linear parts, and 320px reflow.
  - **Flag for review.** A per-item toggle with a visible label and `aria-pressed` in the navigation bar. Flag state lives in the session state (`AssessmentSessionState.itemFlags`), survives navigation and rides `getState()` snapshots for persistence. New player APIs: `setItemFlag` / `toggleItemFlag` / `isItemFlagged` / `getFlaggedItemIdentifiers` / `onFlagChange`.
  - **One definition of "answered".** New `core/reviewState.ts` helpers (`itemAnswerStatus`, `isAnsweredValue`, `interactionResponseIdentifiers`) decide answered / partially answered / unanswered from the responses — per interaction for composite items. `AssessmentPlayer.getItemAnswerStatus()`, `getAnsweredItemCount()` and `getReviewItems()` feed the review screen, section menu and confirmation; the answered count ("8 of 12 answered") is visible in the navigation bar and named by the progress bar.
  - **Section menu is a real disclosure.** `SectionMenu` drops the `role="menu"`/`menuitemradio` pattern for a button with `aria-expanded` plus a plain list of section buttons: per-section answered counts, only legal jump targets enabled, `aria-current` on the current section, Escape/outside-press close, and self-contained token styling (the interim styling hack is removed from `AssessmentHeader`).
  - **Navigation bar reflow.** Below a 30rem container the position moves to its own row and Previous/Next/Review collapse to icons (names kept for assistive technology); the flag keeps its visible label at every width.
  - New localized strings (`assessment.review.*`, `assessment.submit.*`, `assessment.flag.*`, `assessment.leavePart.*`, `assessment.navigation.answeredCount`) in all 8 locales.
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
- f13613d: A failed assessment submission now tells candidates, in their language, that their answers were not lost and they can try again, together with a support code. Backend error text is still never shown. Previously an uncoded backend or network failure fell back to a generic "Something went wrong" message, losing that reassurance.
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
- 29d993f: Remove unused public API (verified zero consumers repo-wide): `StatePersistenceManager` and its `PersistableState`/`PersistenceConfig` types (whose state model contradicted the session state the player actually persists — code importing it would have saved the wrong shape), the never-imported `ItemSessionInfo` component, and duplicate `hasAnyResponse`/`shuffleArray` helper copies (the shared implementations are now the single source of truth).
- 47e9176: Remove unused public API from `@pie-qti/item-player` (verified zero consumers repo-wide): `PerformanceMonitor`/`globalPerformanceMonitor` (and `@pie-qti/assessment-player`'s dead re-export shim), the `core/constants` star-export, `isResponseEmpty`/`countAnsweredForResponseIds`, `QTIInteractionBase` (no web-component subclassers exist — the `/web-components` entry keeps the event classes and types that consumers use), and a drifted duplicate of the MathLive editor extension. The extraction package's `VariableDeclaration` (a divergent, smaller shape that shadowed the main one in the root barrel under the same name) is renamed to `ExtractionVariableDeclaration`. "Meaningful response" logic used by response validation and attempted-state tracking now shares one implementation instead of two verbatim copies.
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
- da6c48e: Split the 1,741-line `ReferenceBackendAdapter` reference file into focused modules and remove its never-called demo item-bank machinery. The QTI assessmentTest parser now lives in `integration/qti-test-parser.ts` (the adapter's static `parseAssessmentTestXml` delegates to it — call sites are unaffected), navigation (branch rules, preconditions, eligibility) in `integration/test-navigation.ts` as pure functions, and the localStorage session store in `integration/session-store.ts`. `ReferenceBackendAdapter.queryItemBank` and its client-side bank cache/fetch simulation are removed: the method was an optional convenience on the backend contract that nothing in the repo ever called. `NavigationManager` is reduced to visited-item tracking (`markVisited`/`restoreState`): its unused decision API (`canNext`, `canNavigateTo`, …) disagreed with the player's real navigation rules, which live in `AssessmentPlayer` and read session state the manager never saw.
- 7c767d4: **Breaking: `OperatorRegistry` is removed from `@pie-qti/qti-processing`, and `EvalEnv` loses its `ops` field** (beta prerelease). The evaluator never read it: every built-in operator is an inline `switch` case in the evaluator, `<customOperator>` dispatch uses the separate `EvalEnv.customOperators` record, and nothing could ever be registered that had an effect — so every caller just constructed an empty registry to satisfy the type. Hosts that build an `EvalEnv` drop the `ops: new OperatorRegistry()` entry; hosts that import `OperatorRegistry` remove the import. Nothing else migrates: the fields that matter (`ctx`, `rng`, `language`, `stringComparison`, `customOperators`, `test`) are unchanged, and scoring is identical. The players' internal environments (`processingEnv`, the test-level expression evaluator, the adapter's outcome-processing run) already dropped the field with it.
  
  Also deduplicates the point-in-shape geometry (rect, circle, ellipse, poly hit tests) that `<inside>` and `mapResponsePoint` each carried as their own verbatim ~55-line copies in the evaluator: both operators now share one module-scope implementation, pinned by tests covering every shape on both operators (boundary inclusivity, zero radii, malformed polygon coords), so the two can no longer drift apart.
- 893de7c: The shell-presentation options (`showSections`, `allowSectionNavigation`, `showProgress`) now default in exactly one place — the bundled `AssessmentShell` (absent means shown/enabled, `false` hides or disables). They were defaulted twice before, in `createPlayerConnection`'s core-config build (which the headless core never reads, so the values were dead on arrival) and again on the raw config at the shell's render sites, with the header and navigation bar carrying a third implicit default; the copies could drift. The child chrome components now render what the shell tells them (their props are required booleans), the core-config fields are documented as ignored by the headless core, and the README says so. No host-visible behavior change: hosting through the shell (including the `@pie-qti/player-elements` element, which passes `config` through) behaves exactly as before.
- ff880bb: Internal restructuring of the assessment shell (Phase 5 "shell split", pure code motion — **no behaviour change**):
  
  - The shell's dialogs are child components now: `SubmitConfirmDialog` (with the shared `SubmitBlockerGroup` list), `LeavePartDialog`, `ResumeDialog`, `StartOverDialog`, `FeedbackDialog`, `ExpiryNoticeDialog`, and the proctor pause's `PauseOverlay`. Same DOM, classes, test ids, focus behaviour and events.
  - `AssessmentShell`'s `initialize()` moved into a `createPlayerConnection` composable (player creation, core event wiring, teardown, retry, slow-load status); the shell keeps the session state and handlers. The candidate display settings (PNP) moved into a `displaySettings` module, and the shell's delivery flags derive from one session-status object.
  - The shell's exported element-façade functions (`next`, `previous`, `navigateTo`, `navigateToSection`, `submit`, `start`, `hasStarted`, `pause`, `resume`, `isPaused`, `getPauseReason`, `isFinalized`, `getTimeState`, `flushAutosave`, `updateResponse`, `getResponses`, `getState`, `restoreState`) are unchanged and pinned by `player-elements` façade tests.
  - New component-behaviour tests pin the moved behaviour: delivery landmarks and the skip link, dialog focus in/out, the pause focus round trip, and the resume ↔ start-over hand-off.
- 0570fd1: The shell's visually hidden elements now hide through one injected `.sr-only` rule (`srOnly.ts`, once per document, after the default-components `srOnly.ts` idiom) instead of two drifted per-component copies: `AccessibilityAnnouncer`'s live regions used physical properties with `clip: rect(0, 0, 0, 0)` while `AssessmentTimer`'s announcement regions used logical properties with `clip-path: inset(50%)`. Both now carry the canonical declarations default-components inject, so the computed hidden state is unchanged (1px, absolute, clipped — screen readers still reach the regions), and a host document loads at most one copy of the rule per package. One cascade consequence for theming hosts: a host stylesheet targeting `.sr-only` now reaches the shell's announcer and timer regions too (their scoped copies used to win), matching how every default-components `.sr-only` element already behaves.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- 9ec0f69: Close the remaining `any`-typed public seams (type-only changes, no runtime behavior change):
  
  - `@pie-qti/item-player`: the player config's `i18nProvider` and `getI18nProvider()` are now typed as `I18nProvider` instead of `any`, so consumers get real checking on the provider contract.
  - `@pie-qti/assessment-player`: `AssessmentRubricBlock.view` models QTI's `view` attribute as `string[]` (it is an arbitrary token list; role semantics live in the toolkit/section-player filtering layer). This removes the `as any[]` casts at both parse sites.
  - `@pie-qti/core`: vendor-extension plugin hooks (`registerVendorDetector`, `registerVendorTransformer`, `registerAssetResolver`, `registerCssClassExtractor`, `registerMetadataExtractor`) take `unknown` instead of `any` — the registry is generic plumbing and can no longer silently widen host plugin objects; the five `as any` call-site casts are gone.
- 66b63f3: **Breaking: `NavigationManager` is no longer exported from `@pie-qti/assessment-player`** (beta prerelease). The class is internal machinery of `AssessmentPlayer` (visited-item tracking) and was never meant for hosts; nothing in the repo imported it from the package entry, and the package's exports map (`.` and `./integration`) makes `core/index.ts` unreachable from outside. The class itself stays and `AssessmentPlayer` still uses it; hosts must navigate through `AssessmentPlayer` (`next()`, `previous()`, `goTo()`, `canNavigateByTestPart()`). Hosts that (against the docs) imported `NavigationManager` directly must switch to the player API.
- Updated dependencies [310b975]
- Updated dependencies [35bd0c3]
- Updated dependencies [d7a8262]
- Updated dependencies [30bc3bf]
- Updated dependencies [23a4077]
- Updated dependencies [bd67d58]
- Updated dependencies [0f11f98]
- Updated dependencies [4e5f1a8]
- Updated dependencies [2fa635f]
- Updated dependencies [bc7e8f6]
- Updated dependencies [b504c41]
- Updated dependencies [756771f]
- Updated dependencies [0a1c071]
- Updated dependencies [7cbed03]
- Updated dependencies [bdfc40e]
- Updated dependencies [3d51b92]
- Updated dependencies [0973689]
- Updated dependencies [f6e7714]
- Updated dependencies [eb50277]
- Updated dependencies [7c451f7]
- Updated dependencies [3a31af2]
- Updated dependencies [2f43e0e]
- Updated dependencies [8c4274b]
- Updated dependencies [ac81831]
- Updated dependencies [ee233f4]
- Updated dependencies [0cf8193]
- Updated dependencies [fc99dd9]
- Updated dependencies [9c75e43]
- Updated dependencies [72b3545]
- Updated dependencies [cfb78e2]
- Updated dependencies [99341e5]
- Updated dependencies [9cd2772]
- Updated dependencies [372037e]
- Updated dependencies [bf483a3]
- Updated dependencies [9814c9b]
- Updated dependencies [098f997]
- Updated dependencies [410fe38]
- Updated dependencies [9abdf17]
- Updated dependencies [c6ae98c]
- Updated dependencies [ad99965]
- Updated dependencies [fe86d42]
- Updated dependencies [fe86d42]
- Updated dependencies [d6ac3bb]
- Updated dependencies [fff7dd7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d6ac3bb]
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
- Updated dependencies [2667df1]
- Updated dependencies [74c3886]
- Updated dependencies [de1eed5]
- Updated dependencies [a1c989d]
- Updated dependencies [b34d710]
- Updated dependencies [f13613d]
- Updated dependencies [88b69c0]
- Updated dependencies [20e8e52]
- Updated dependencies [b8a2862]
- Updated dependencies [68c8b37]
- Updated dependencies [795c767]
- Updated dependencies [6d4d19d]
- Updated dependencies [6d4d19d]
- Updated dependencies [e7188e4]
- Updated dependencies [35bd0c3]
- Updated dependencies [30bc3bf]
- Updated dependencies [fe86d42]
- Updated dependencies [47e9176]
- Updated dependencies [2916759]
- Updated dependencies [a183a16]
- Updated dependencies [7cf746f]
- Updated dependencies [8d03d05]
- Updated dependencies [1449b94]
- Updated dependencies [611b971]
- Updated dependencies [562182a]
- Updated dependencies [2fd1003]
- Updated dependencies [4f9a07c]
- Updated dependencies [edd4020]
- Updated dependencies [281d6fb]
- Updated dependencies [93df941]
- Updated dependencies [fa577a0]
- Updated dependencies [0bdb7f1]
- Updated dependencies [7c767d4]
- Updated dependencies [b38cb07]
- Updated dependencies [07f1bc2]
- Updated dependencies [d3619a3]
- Updated dependencies [3b3927e]
- Updated dependencies
- Updated dependencies [9ec0f69]
- Updated dependencies [b668938]
  - @pie-qti/qti-common@1.0.0-beta.5
  - @pie-qti/item-player@1.0.0-beta.5
  - @pie-qti/assessment-toolkit@1.0.0-beta.5
  - @pie-qti/i18n@1.0.0-beta.5
  - @pie-qti/section-player@1.0.0-beta.5
  - @pie-qti/qti-processing@1.0.0-beta.5
  - @pie-qti/ims-cp-core@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- 15ef671: Align declared dependencies with what shipped code actually imports, enforced by a new `check:dist-dependencies` gate (added to `verify:publish:quick` and `lint:all`):
  
  - `@pie-qti/player-elements` now declares `@pie-qti/default-components`, `@pie-qti/i18n`, and `@pie-qti/section-player` as real dependencies: shipped declarations import their types, so consumer typechecks no longer depend on hoisted installs.
  - `@pie-qti/transform-core` no longer installs `@pie-qti/test-utils` (and transitively `@pie-qti/storage`) at runtime; the same cleanup moves build-only `@pie-qti/transform-core` out of `@pie-qti/to-pie` / `@pie-qti/pie-to-qti2` runtime dependencies, drops unused `@tiptap/*` runtime entries from `@pie-qti/default-components` (bundled into its bundle, now devDependencies), and removes never-imported dependencies from `@pie-qti/assessment-player`, `@pie-qti/assessment-toolkit`, `@pie-qti/test-utils`, and `@pie-qti/section-player` (the two `@pie-players` packages that were only ever resolved transitively).
- Updated dependencies [15ef671]
- Updated dependencies [a4ef12c]
- Updated dependencies [bc58949]
- Updated dependencies [406c76c]
- Updated dependencies [fb2b4e2]
- Updated dependencies [29210b4]
  - @pie-qti/assessment-toolkit@1.0.0-beta.4
  - @pie-qti/section-player@1.0.0-beta.4
  - @pie-qti/item-player@1.0.0-beta.4
  - @pie-qti/qti-common@1.0.0-beta.4
  - @pie-qti/ims-cp-core@1.0.0-beta.4
  - @pie-qti/qti-processing@1.0.0-beta.4
  - @pie-qti/i18n@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [c408053]
- Updated dependencies [e69c39d]
  - @pie-qti/ims-cp-core@1.0.0-beta.3
  - @pie-qti/default-components@1.0.0-beta.3
  - @pie-qti/assessment-toolkit@1.0.0-beta.3
  - @pie-qti/item-player@1.0.0-beta.3
  - @pie-qti/section-player@1.0.0-beta.3
  - @pie-qti/i18n@1.0.0-beta.3
  - @pie-qti/qti-common@1.0.0-beta.3
  - @pie-qti/qti-processing@1.0.0-beta.3

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
