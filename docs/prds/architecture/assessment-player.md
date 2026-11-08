# PRD: Assessment Player

<!--
  Status: current
  Type: architecture
  Packages: @pie-qti/assessment-player
  Last reviewed: 2026-11-07
-->

**Status:** current
**Type:** architecture
**Packages:** `@pie-qti/assessment-player`
**Last reviewed:** 2026-11-07

---

## Summary

`@pie-qti/assessment-player` is the multi-item test shell above `@pie-qti/item-player`. It orchestrates an entire QTI `assessmentTest` — managing navigation across items and sections, enforcing submission modes, collecting candidate responses, delegating authoritative scoring to a backend adapter, and displaying test-level feedback after finalization. For the active item it owns exactly one live `ItemSession`, created from a cached `AssessmentItemDefinition`, and passes that same session through section composition to the item element. Persisted `SerializedItemSessionState` is used only to hand off or restore an inactive item; it is never synchronized as a second mutable authority.

LTI launch, identity, roster, and grade-passback flows are host-application responsibilities. This package provides an embeddable assessment runtime, not an LTI platform implementation.

---

## Background and rationale

### Why a separate package instead of extending item-player

The item-player is intentionally scoped to a single `assessmentItem`. It has no concept of section hierarchy, part-level navigation modes, inter-item state, or test-level outcomes. Adding those concerns to item-player would couple two very different lifetimes (item session vs. test session) and make item-player unusable in standalone embedding scenarios. The assessment player therefore caches immutable item definitions, owns one live session for only the active item, and adds the assessment structural concerns. On navigation it serializes and disposes the outgoing session; returning to that item restores a new session from the serialized handoff.

### Why the client shell never scores

In any assessment with academic stakes, the correct responses and scoring rules must not reach the candidate's browser — they can be read from the DOM or JavaScript memory. The `BackendAdapter` contract enforces this structurally: the server returns `SecureAssessment`, which is the assessment structure with `<correctResponse>` and `<responseProcessing>` elements stripped for the candidate role. All scoring happens server-side; the client receives only the numeric result. The reference adapter (`ReferenceBackendAdapter`) intentionally does client-side scoring for demos and development, but it is explicitly unsafe for any production use.

### Why the flat item list is built at construction time

After `initSession` returns, `AssessmentPlayer` immediately flattens all `SecureTestPart → SecureSection → SecureItemRef` references into a single ordered `FlatItem[]` array. This is because:

1. Navigation arithmetic (next/previous, index-to-section mapping) is simpler over a flat sequence than over a nested tree, especially when sections may be empty.
2. The backend draws selection and ordering at session start and returns the drawn assessment; the
   player flattens it as given. The reference adapter's `drawAssessment` keeps required children,
   keeps fixed children in their slots, clones `withReplacement` repeats under suffixed identifiers
   (`.2`, `.3`) and mixes an invisible `keepTogether="false"` section into its parent's shuffle. Its
   rng is the adapter's `rng` option.
3. The flat list is stable for the lifetime of a session. The backend stores the draw, so a resume
   returns the same assessment and restores `currentItemIdentifier` from `AssessmentSessionState`.

### Why individual and simultaneous submission modes differ

`submissionMode` is a QTI `testPart` attribute with two values:

- **`individual`**: The candidate submits each item independently as they navigate away. The backend scores each response immediately. The client calls `submitCurrentItem()` inside `next()` before navigating forward. This enables per-item branching decisions (`nextItemIdentifier` in `SubmitResponsesResponse`).
- **`simultaneous`**: All responses are withheld until the candidate explicitly finalizes the assessment. In `submit()`, the player iterates over all items that have not yet been submitted, sends each response to the backend in sequence, then calls `finalizeAssessment()`. The distinction matters for backend scoring: simultaneous mode allows the server to apply test-wide scoring rules that depend on the full response set before producing any scores.

### Why every terminal transition routes through one finalization path

QTI `branchRule` targets can end delivery early: `EXIT_TEST` terminates the test (remaining items
are not presented), `EXIT_TESTPART` ends the current test part, and `EXIT_SECTION` ends the current
section. All of them — and the explicit `submit()` call — route through the same internal
end-of-test path: pending simultaneous-mode responses are submitted, the current individual-mode
item is submitted if needed, the backend finalizes (outcome processing runs, results are produced),
`complete` fires, and navigation closes (`canNext`/`canPrevious` become false; further navigation
rejects with a typed `testFinalized` error). `EXIT_TESTPART`/`EXIT_SECTION` first continue with the
next delivered item outside the ended scope, finalizing the ended test part when delivery leaves it
or nothing follows.

### Why navigation transitions are serialized

In individual submission mode `next()` submits before advancing, so navigation and submission share
one backend round-trip. The core runs every public navigation/submit call through a transition lock:
while one transition is in flight, further navigation or submit calls reject with a typed
`navigationInFlight` error instead of racing it. `getNavigationState().isLoading` exposes the real
in-flight flag (also via `onBusyChange` and `isBusy()`), so shells disable Previous/Next/Submit and
set `aria-busy` while busy. A failed submit restores the candidate to the same item with the
response intact and retryable.

### Why candidate-facing errors are coded

The core throws `AssessmentPlayerError` with a stable `code` (plus interpolation `params`) for every
candidate-visible failure. The `message` keeps the original text — including raw backend error
strings — for logs and host callbacks (`config.onError`, the web component's `player-error` event),
but shells render only the localized message from `assessment.errors.codes.<code>`; anything
uncoded renders as a generic localized message plus a short support code, never a raw backend or
engine string.

### Why the shell autosaves drafts (and how hosts turn it off)

Historically `BackendAdapter.saveState()` existed but nothing called it: in simultaneous mode
responses only reached the backend at the final Submit, so a refresh or crash lost everything.
The core now runs a debounced autosave: candidate activity (response edits, navigation, flags,
the timer-visibility preference, pause changes) restarts a 1.5 s debounce window (tunable via
`autosaveIntervalMs`), and `visibilitychange`/`pagehide` trigger an immediate best-effort
`flushAutosave()` through the shell. The backend is the store — there is no offline queue and
no client-side database. Autosave is **ON by default** when the backend reports the save
capability (`canSaveState !== false`; `ReferenceBackendAdapter` sets it) and never runs after
finalization. Saves are busy-aware (a due save defers while a transition runs) and non-fatal:
a failure logs to the console, fires `onAutosaveFailed` (the element's `autosave-failed`
event) and the indicator's `failed` state, and retries on the next change. Hosts that persist
state themselves set `autosave: false` (or `canSaveState: false` on the adapter), which also
hides the save indicator.

### Why persistence stays host-shaped

`AssessmentPlayer` exposes `getState()`/`restoreState()` for hosts that want full control of
cadence and storage, and `startOver()` for the candidate-facing restart: it resets responses,
flags, visited state, the timer preference and the clocks to a fresh session and persists the
blank draft, so a refresh cannot resurrect discarded answers. Already-submitted items stay
submitted — the backend remains authoritative for accepted results. A session created from a
backend-restored snapshot (`initSession.resumeSessionId`) reopens at the saved item with its
answers; `hasRestoredProgress()` tells shells whether there is work worth resuming, and the
snapshot's `timing.savedAt` dates the resume prompt.
`StatePersistenceManager` exists as an internal source utility but is not a published package export;
`ReferenceBackendAdapter` uses local storage for explicit demo/reference delivery.

### Why itemSessionControl is a UI hint, not an enforcement boundary

`itemSessionControl` settings (maxAttempts, allowReview, allowSkipping) are exposed by the server via `SecureTestPart.itemSessionControl` and echoed to the client. The client uses `ItemSessionController` to provide UI hints — disabling the Previous button, hiding Submit after max attempts, etc. The server remains authoritative for actual enforcement; a malicious client that bypasses these UI gates will still be rejected at the submission endpoint. This is called out explicitly in the code comments to avoid the temptation of treating client-side enforcement as a security boundary.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.2, QTI 3.0 (structure layer)
- **Spec section(s):** §2 (Assessment Architecture), §2.1 (assessmentTest, testPart, assessmentSection, assessmentItemRef), §2.4 (testFeedback), §2.3 (itemSessionControl), §2.2 (timeLimits)

### Supported attributes

| QTI concept | Support |
|---|---|
| `testPart.navigationMode` (linear / nonlinear) | Full |
| `testPart.submissionMode` (individual / simultaneous) | Full |
| `assessmentSection.visible` | Full (invisible sections — and sections under an invisible ancestor — are never listed candidate-facing: omitted from the section list, never surfaced next to the question counter; their items still deliver in order) |
| `assessmentSection.rubricBlock` (view-filtered) | Full |
| `timeLimits.minTime` / `maxTime` (assessment, testPart, section, item) | Runtime enforcement with independent persisted clocks; edge/browser coverage remains |
| `timeLimits.allowLateSubmission` | Full |
| `itemSessionControl` cascade (testPart → sections → item ref) | Full, over the QTI defaults |
| `itemSessionControl.maxAttempts` | Backend-enforced; UI hint (adaptive items unlimited) |
| `itemSessionControl.allowComment` | Backend-enforced; comments sent with the submission |
| `itemSessionControl.allowReview` / `allowSkipping` | UI hint |
| `itemSessionControl.showFeedback` / `showSolution` | Applied to the item presentation |
| `itemSessionControl.validateResponses` | Applied when the attempt ends |
| `preCondition` (testPart, section, item ref) | Evaluated by the backend on entering each |
| `branchRule` (item ref, section, testPart) | Evaluated by the backend; returned as `nextItemIdentifier`. `EXIT_TEST`/`EXIT_TESTPART`/`EXIT_SECTION` terminate the ended scope through the same finalization path as `submit()` |
| `variableMapping` / `templateDefault` | Full |
| `testFeedback` (outcome-based) | Full for preserved structured feedback and finalized backend feedback |
| `assessmentSection.selection` (direct children, with replacement) | Drawn by the backend at session start |
| `assessmentSection.ordering` (shuffle, fixed, keepTogether) | Drawn by the backend at session start |
| `outcomeDeclaration` / `outcomeProcessing` (test-level) | Parsed/executed by the reference adapter; production backend remains authoritative |
| Built-in duration variables in test-level outcome processing | `duration` (test), `TESTPART_ID.duration`, `SECTION_ID.duration` declared from the persisted timing clocks, converted to QTI seconds |

### Known divergences from spec

- **Modal feedback:** the assessment renders no item `modalFeedback`; `showFeedback` governs the
  integrated feedback only.
- **Timing evidence (G-22):** scoped clocks and `minTime`/`maxTime` enforcement exist, and the
  built-in `duration`, `TESTPART_ID.duration` and `SECTION_ID.duration` variables are exposed to
  test-level outcome processing in seconds from the timing clocks. Direct integration coverage for
  every minimum-time scope and simultaneous expiry combination remains.

---

## Functional requirements

- **FR-1:** `AssessmentPlayer.create(config)` must call `BackendAdapter.initSession()` before constructing the player, and must use the `SecureAssessment` returned from the server — not any locally-held QTI XML — as the authoritative item list.
- **FR-2:** In a linear testPart, `navigateTo(index)` must permit only the current item or immediate
  next item; once the candidate advances, earlier items in that part cannot be revisited.
- **FR-3:** In nonlinear navigation mode, `navigateTo(index)` must allow any in-bounds index.
- **FR-4:** In `individual` submission mode, `next()` must call `submitCurrentItem()` and await its result before advancing the index. If the backend returns a `nextItemIdentifier`, the player must navigate to that item instead of `currentIndex + 1`.
- **FR-5:** In `simultaneous` submission mode, `submit()` must send all unsubmitted items to the backend before calling `finalizeAssessment()`. Client-collected responses must survive across backend state-update responses during the submission loop.
- **FR-6:** `getNavigationState()` must return `canPrevious: false` throughout a linear testPart and
  when review policy forbids the previous item in nonlinear delivery.
- **FR-7:** When `itemSessionControl.allowSkipping` is false and the current item has no response, `next()` must throw before calling `submitCurrentItem()`.
- **FR-8:** `getCurrentSharedRubricBlocks()` must return cloned test-part and section rubric blocks for
  the active item in that order. The compatibility `getCurrentRubricBlocks()` method retains its
  section-first/fallback behavior. Direct `assessmentItem` rubrics must remain on
  `ItemSession.present().directRubrics` rather than being merged into shared section content.
- **FR-9:** `TimeManager` must independently accumulate and persist assessment, testPart, section,
  and item clocks; enforce the shortest active hard maximum and every applicable minimum transition;
  and fire warning/expiry callbacks for the active limiting scope.
- **FR-10:** `getState()` must return a save snapshot with cloned top-level collections and timing
  maps. It is not a recursively immutable value; callers must treat nested response, score, and
  serialized-session entries as read-only or clone them before mutation.
- **FR-11:** `restoreState(state)` must navigate to the item identified by `state.currentItemIdentifier`, restore `visitedItems` into `NavigationManager`, and rehydrate `itemResults` from `state.itemScores` so that `submit()` can skip already-submitted items.
- **FR-12:** `destroy()` must unsubscribe and dispose the current live item session, clear cached definitions and all event listener sets, and release timer resources.
- **FR-13:** `getVisibleFeedback()` after successful finalization must evaluate preserved structured
  `testFeedback` against `FinalizeAssessmentResponse.outcomes`; when no structured feedback exists,
  the legacy `FinalizeAssessmentResponse.feedback` string may be exposed as one compatibility item.
- **FR-14:** `getAllSections()` must enumerate sections across all test parts in document order.
- **FR-15:** `getCurrentItemSession()` must return the exact live session owned for the active item. `toSectionComposition()` must place that same reference on only the active `QtiSectionItemRef`; it must not create a renderer-side session or pass serialized state as a synchronization mechanism.
- **FR-16:** Before leaving an active item, assessment-player must serialize its live session into `AssessmentSessionState.itemSessions`, dispose it, and later restore through `AssessmentItemDefinition.openSession({ restore, responses })`. A restored state with a different item identifier must be rejected.
- **FR-17:** Each cached item definition must use `SecureItemRef.role` and the configured immutable
  definition-plugin list. The resulting session role cannot be overridden by presentation callers.
- **FR-18:** `submitCurrentItem()` must treat local `endAttempt` as provisional. If validation,
  transport, backend acceptance, or result validation fails before commit, it must replace the closed
  live session with a session restored from the exact pre-submit snapshot so the attempt remains
  retryable and is not double-counted.
- **FR-19:** Assessment delivery owns the end-attempt decision. When a candidate activates an
  `endAttemptInteraction`, the renderer must only record its boolean response — a renderer or
  session guest must never close the assessment-owned session locally. The player recognizes the
  end-attempt response on the session's normal response path (from the item's
  `endAttemptInteraction` metadata) and decides per QTI submission mode: in `individual` mode it
  submits the item through the normal per-item path with the interaction's `countAttempt` honored
  (true → a counted attempt toward maxAttempts; false → a hint submission that runs response
  processing, records no result, and consumes no attempt), branching ignored — the candidate stays
  on the item; in `simultaneous` mode the response is recorded like any response and response
  processing is deferred to the end of the testPart. A locally closed session must never make a
  later submission throw.
- **FR-20:** With autosave enabled (default when the backend's `canSaveState` is not false and
  `autosave` is not false), every candidate activity (response change, navigation, flag, timer
  visibility, pause) restarts a debounced `saveState` of the full session snapshot stamped with
  `timing.savedAt`; a due save during a transition defers until the transition settles; nothing
  saves after finalization; failures are non-fatal and reported through `onAutosaveChange`
  (`failed`), `onAutosaveFailed` and a console log, then retried on the next change. Hosts get
  `flushAutosave()` for page-lifecycle moments.
- **FR-21:** `startOver()` (candidate transition, rejected while paused/behind the begin gate/
  finalized/while busy) resets the draft — responses, sessions, results, flags, comments,
  visited state, timer preference and clocks — re-enters the first item and persists the blank
  draft. Already-submitted items keep their accepted results.
- **FR-22:** A session created from a backend-restored snapshot reports `hasRestoredProgress()`
  (saved answers present), `getRestoredSavedAt()` (the snapshot's `timing.savedAt`) and carries
  `savedAt` on `getStartInfo()`. Restored responses, flags, timer preference and the current
  item are restored by the snapshot, and a restored-paused session reopens paused.

---

## Non-functional requirements

- **Accessibility:** The assessment player provides the headless logic layer; accessibility responsibilities for navigation announcements, focus management, and ARIA live regions live in the Svelte shell components (`AssessmentShell`, `NavigationBar`), described under [Candidate shell](#candidate-shell). The `AssessmentPlayer` class itself exposes `onItemChange` and `onSectionChange` events that shell components must use to trigger screen-reader announcements.
- **Performance:** `flattenItems()` runs once at construction; subsequent navigation calls use O(1) array index lookups. Immutable `AssessmentItemDefinition` instances are cached by item identifier, while only the active item has a live session. Response updates are targeted (O(changed item), not O(assessment)): the live session's subscription mirrors only the changed item's responses with one snapshot copy, the section composition carries the active session and the section's response records by shared reference (`getSectionItemResponses()`, no per-item deep copies, unchanged items keep identical props), and the shell rebuilds the composition only when the item, section or delivery state changes — keystrokes recompute the answered counts but never rebuild the section view. A unit guard asserts a keystroke stays at one deep copy and composition builds at zero.
- **Cross-platform:** No DOM dependencies. The player class is framework-agnostic and can be used headlessly (e.g. server-side with Node.js for testing, or wrapped in a web component).
- **Security:** The player trusts the `BackendAdapter` contract. It must never apply client-computed scores to `itemResults` in a way that could be finalized — all `ItemResult.score` values must come from `SubmitResponsesResponse.result` or `FinalizeAssessmentResponse.itemScores`, not from local computation.
- **i18n:** The player accepts an `i18nProvider` from the host. If none is supplied, a no-op provider is created that returns translation keys as-is. String content (e.g. error messages thrown from navigation) should be keys, not hardcoded English.

---

## Candidate shell

`AssessmentShell` (mounted by `<pie-qti-assessment-player>`) and the section layouts it
delegates to (`SectionPlayerSplitPane`, `SectionPlayerVertical`, also mounted by the
`<pie-qti-section-player-*>` elements) render in the light DOM. They are self-contained:
nothing depends on host CSS frameworks.

### Self-contained styling

- Every shell and section component styles itself with scoped CSS on the `--pie-qti-*`
  tokens, each with a fallback (`var(--pie-qti-base-100, oklch(100% 0 0))`), so it renders
  without `@pie-qti/theme` or a DaisyUI bridge. Text uses text tokens
  (`--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-info-text`), boundaries
  `--pie-qti-border-strong`, focus rings `outline: 2px solid var(--pie-qti-focus)` on
  `:focus-visible`; spacing, radius and the 44px control size use the `--pie-qti-space-*`,
  `--pie-qti-radius*` and `--pie-qti-control-min-size` tokens.
- Icons carry `width`/`height` attributes and are sized by component CSS; no Tailwind
  utility is load-bearing. DaisyUI and Tailwind classes are not used by the shell, the
  navigation bar, the section menu, the review screen or the timer.
- Svelte injects the component CSS at mount, so the published `@pie-qti/player-elements`
  bundle ships it; hosts load no stylesheet for the shell.

### Layout and reflow

- **Contained (default).** The shell fills its host container (`block-size: 100%`). When
  the host gives no height it sizes to its content between
  `--pie-qti-assessment-min-block-size` (default `min(32rem, 100dvh)`) and
  `--pie-qti-assessment-max-block-size` (default `100dvh`), so Previous/Next stay reachable.
  Header and navigation sit outside the scrolling question region, never on top of it; the
  region keeps `scroll-padding` so a focused control and its ring stay clear of its edges
  (WCAG 2.4.11).
- **Full viewport.** The `full-viewport` attribute (`fullViewport` property / prop) sizes
  the shell to `100dvh` (iOS toolbars excluded) inside the `safe-area-inset-*` padding
  (needs `viewport-fit=cover`), and renders page-level `header`, `main` and `nav`
  landmarks.
- **Short viewports** (`max-height: 30rem`: 400% zoom of a desktop window, landscape
  phones). Nothing is pinned: header, content and navigation flow in one scroll — the page's
  when the host gives no height, the shell's own when it does (WCAG 1.4.10, 2.4.11).
- **Narrow containers.** The navigation bar is a size container: one row of Previous, the
  position (with the answered count), the per-item actions and Next/Submit. Below a `30rem`
  container width the position moves to its own row and Previous/Next/Review collapse to
  icons — their names stay for assistive technology, and the flag keeps its visible label
  at every width. Below a `48rem` container width the split layout becomes a
  Passage/Question tab switch (APG tabs: arrow keys mirror right-to-left, Home/End,
  `aria-controls`/`aria-labelledby` panels); a newly presented item selects the question
  tab. Wide containers keep the keyboard-resizable splitter. Nested paddings collapse to one
  slim gutter on phones.
- Layout code never applies `transform`, `contain` or `filter` to an ancestor of item
  content, so `position: fixed` drag previews stay viewport-relative.

### Landmarks, headings and focus

- Embedded, the shell is one region named by the assessment title, with a "Question
  content" region and an "Assessment navigation" landmark. A "Skip to question" link
  (visible on focus) moves focus to the active question without touching the host URL.
- The header shows the assessmentTest `title` (`AssessmentPlayer.getAssessmentTitle()`), or
  the localized `assessment.title` — never the identifier. Untitled sections are named by
  their position ("Section 2 of 3") only when there are several.
- Heading levels follow the host outline: the title uses `heading-level` (default 2, 1 in
  full-viewport mode); passage and item titles sit one level below. Passages are headed by
  `QtiSharedHtmlBlock.title`, else a neutral localized "Passage" (numbered when several).
- After navigation, focus moves to the question through the layout's
  `focusActiveItem()`, which first selects the question tab when the panes are stacked.
  Navigation buttons stay focusable (`aria-disabled`) while a transition is in flight.

### Timer and time administration

- **The countdown is in the header, not an overlay.** When the active scope chain
  carries a hard maximum (`AssessmentPlayer.getTimeState().limited`), the shell mounts
  `AssessmentTimer` beside the title. It styles itself on the tokens, reserves layout
  space, mirrors for RTL, and shows the ACTIVE scope's nearest maximum with a
  programmatic name ("Time remaining: 12:34"). The ticking readout is `role="timer"`
  with its live region OFF — a per-second `aria-live` would chatter. PNP extended time
  is applied by `TimeManager`, so the countdown matches the enforced limits.
- **Threshold warnings are separate announcements.** `timeWarningThreshold` (default 60)
  and `timeWarningThresholds` (e.g. `[300, 60]`) each fire once per limiting scope
  through `onTimeWarning`; the timer re-announces them through its own polite
  `role="status"` region ("5 minutes remaining"). The 2.2.1 guidance holds: candidates
  are warned before time runs out, and PNP extended time is honoured.
- **The candidate can hide the countdown.** A ≥44px show/hide toggle (`aria-expanded`)
  collapses the readout; the choice lives in the session state
  (`AssessmentSessionState.timerHidden`, `setTimerHidden`/`isTimerHidden`) like flags,
  so it survives navigation and save/resume. Warnings and expiry still announce while
  the readout is hidden.
- **Scope expiry is surfaced, never silent.** A test part, section or item limit without
  late submission locks its items (`TimeManager.onScopeExpired` → `handleScopeExpired`);
  delivery moves to the next unlocked item and the shell shows an AssessmentDialog
  notice ("The time for this section is over — you are moving on"), announces the new
  question position, and moves focus like a navigation (`onScopeTimeExpired` event,
  `deliveryContinues` says whether delivery could move).
- **An expiry dead end can never strand the candidate.** When nothing unlocked remains,
  the core reports `onTimeExpired({ submissionRequired: true })`, the shell shows the
  expiry dialog with a Submit action, and the navigation bar offers Submit in place of
  Next wherever the candidate is. Ending the test then is the mandated collection: the
  frozen responses go out as `timing.submissionReason: 'time-expired'` (the reference
  backend accepts them; production backends remain authoritative), and minimum times and
  response validation cannot hold a closed delivery open.
- **Whole-test expiry auto-finalizes.** When the assessment limit expires without late
  submission, the core runs the same finalization as `submit()` (pending simultaneous
  responses, the open individual-mode item, `finalizeAssessment`, `onComplete`,
  outcomes/testFeedback), bypassing minimum-time checks; a failure keeps the session
  open, surfaces through `onError`, and the expiry dialog offers Submit. The host hears
  `onTimeExpired({ autoFinalized: true })` and the element's `time-expired` event.
  `allowLateSubmission` keeps the test open past the limit instead.
- **Begin gate (opt-in).** With `beginGate` (shell prop / `begin-gate` attribute), the
  core is created without entering an item and `TimeManager` holds: the shell shows an
  accessible start screen — assessmentTest title, "You have N minutes" (PNP applied,
  `getStartInfo()`), the first test part's role-filtered rubric blocks, and a Begin
  control with focus on the heading. `start()` (Begin, or the imperative API) enters the
  first (or restored) item and starts every clock. Without the gate, delivery and the
  clocks start at session creation, exactly as before; a resumed session's start screen
  shows the time that remains. Begin-gate time never counts: submissions carry the
  candidate's test clock (`timing.assessmentElapsedMs`/`assessmentLimitSeconds`).
- **Proctor pause/resume.** `pause(reason?)` freezes every clock (assessment, part,
  section, item, and the live attempt's QTI `duration` via a suspend + snapshot),
  rejects candidate actions with a coded `assessmentPaused` error, and asks the shell
  for an overlay carrying the host-supplied, candidate-facing reason; the shell makes
  header/content/navigation inert and moves focus to the overlay, announcing the pause
  through `role="status"` (`onPauseChange` / `player-pause` / `player-resume` events).
  A pause requested during a transition applies when it settles; while paused the reason
  can be replaced. `resume()` reopens the attempt from the pause snapshot, so paused
  time never counts as time on task, and the countdown continues where it froze. A
  snapshot taken while paused carries `timing.isPaused`/`pauseReason` and reopens paused.
  PNP extended time stays consistent (it scales the limits the frozen clocks measure).

### Shared dialog

`AssessmentDialog` (exported from the components barrel) is the shell's modal dialog for
submit confirmation, time notices and resume prompts: native `<dialog>` + `showModal()`
(with an emulated modal fallback where it is missing), named by its title and described by
`description`, focus moved to the title (`initialFocus` can pick an action) and returned to
the trigger on close, Escape cancelling unless `dismissible` is false, `busy` keeping the
actions focusable but unavailable, `closeOnConfirm`, and `onConfirm`/`onCancel`/`onClose`
callbacks with a `bind:open` state.

### Safe loading, failure and crash screens

- **A slow load is a status, never an error.** After 10 s of loading the shell adds a polite
  `role="status"` line ("Still loading") to the loading screen. It disappears on its own when
  the load finishes; it never becomes a permanent error, and no developer text ("assessment
  may be invalid") is shown.
- **Load failures are retryable and candidate-safe.** A failed `initSession` renders the
  localized coded-error path (`assessmentErrorDisplay`): coded core errors by their code,
  anything else (raw backend text included) as a generic localized message plus a short
  support code — never the raw message — with a Retry control that tears the half-created
  player down and re-initializes. On another failure the alert is re-announced and focus
  moves to Retry.
- **A crashing question never takes the test down.** `<svelte:boundary>` wraps the question
  content area and the shell's dialogs (each with a `failed` fallback + `onerror`). A crash
  during item rendering shows a localized "This question could not be displayed" fallback
  with Try again (re-render) and Continue (move on where navigation rules allow); the shell,
  header and navigation stay usable. The raw error goes to the console and the host's
  `onError` only. A crashed dialog body degrades to an alert that dismisses the broken modal
  instead of stranding the candidate behind it.

### Autosave indicator, resume prompt and start over

- **The save indicator rides the real save state.** When autosave is enabled, the navigation
  bar shows a polite `role="status"` line next to the answered count: "Saving…" while a save
  is pending or in flight, "Saved · 12:04" (locale-formatted) after one lands, "Not saved"
  after a failure — announced politely so a "Not saved" turn is heard. Hidden entirely when
  the host disables autosave. The element reports the same states through `autosave-change`
  and failures through `autosave-failed`.
- **Resume is offered, never forced.** When the session was created from a backend snapshot
  with saved answers, the shell opens an `AssessmentDialog` resume prompt ("You have answers
  saved from {time}" — `timing.savedAt`, locale-formatted): "Resume where you left off"
  restores responses, flags, the timer-visibility preference and the position (a snapshot
  saved during a proctor pause reopens paused, behind the pause overlay). Escape counts as
  resume — it is never one step away from deletion.
- **Start over deletes with confirmation.** The prompt's other action asks a second,
  destructive-toned confirmation ("Your saved answers will be deleted … This cannot be
  undone"), then `startOver()` clears the draft, persists the blank state and restarts at the
  first item with focus and announcement handled like a navigation.

### Submit safety, review screen and flags (WCAG 3.3.4)

- **Submit is confirmed, never accidental.** The final-submission control sits in the
  navigation bar styled apart from the primary Next (outlined, error-toned, with a distinct
  icon). Activating it opens the `AssessmentDialog` confirmation, which states how many
  questions are answered ("8 of 12 answered") and flagged, names every unanswered question,
  and links back to each one the navigation rules can still reach (linear parts render
  status only). Cancel (or Escape) closes it and returns focus to the Submit control; the
  submission itself runs only on the explicit confirm. A failed submission closes the dialog
  so the alert and the "Try Again" control are reachable, and moves focus there.
- **Leaving a test part is confirmed.** QTI parts are delivered in sequence and cannot be
  re-entered, so when Next would leave the current part the shell first shows a "you cannot
  return" confirmation (`AssessmentPlayer.getForwardTransitionInfo()` reports the boundary).
- **Review screen + item palette.** The navigation bar offers a review view (also reachable
  from the submit confirmation) listing every delivered item grouped by candidate-visible
  section, each with answered / partially answered / unanswered, flagged-for-review and
  not-yet-visited as text plus an icon (never colour alone), jump buttons where
  `AssessmentPlayer.isNavigationTargetLegal()` allows, `aria-current` on the live item, and
  a note that explains why linear parts list status only. Reflows to 320px.
- **Flag for review.** The navigation bar carries a per-item toggle with a visible label and
  `aria-pressed`. Flag state lives in the core session state (`AssessmentSessionState.itemFlags`),
  survives navigation, is reported through `setItemFlag`/`toggleItemFlag`/`isItemFlagged`/
  `getFlaggedItemIdentifiers()` and `onFlagChange`, and is part of `getState()` snapshots
  (the upcoming autosave unit persists it with the rest).
- **One definition of "answered".** `core/reviewState.ts` decides it from the responses
  (non-null, non-empty; per interaction for composite items → answered / partially answered
  / unanswered). `AssessmentPlayer.getItemAnswerStatus()`, `getAnsweredItemCount()` and
  `getReviewItems()` feed the review screen, the section menu and the confirmation alike.
- **Section menu is a disclosure.** The header menu is a button with `aria-expanded` plus a
  plain list of section buttons (not a `role="menu"`): each section shows its answered
  count, only legal jump targets are enabled, the current section is `aria-current`, Escape
  or an outside press closes it, and it styles itself on the tokens.

### Host CSS reaching item content

Item bodies, passages and rubric blocks are light-DOM HTML, so host page CSS reaches
them. `PlayerBaseStyles` injects one `@layer pie-qti-base` sheet of zero-specificity
`:where()` rules: `.pie-qti-chrome` roots take their font, size, line height and colour from
the tokens; `.pie-qti-content` containers (item, passage, rubric, test feedback) get the
user-agent defaults that host resets strip — paragraph, list, `dl`, `blockquote` and
`figure` spacing, list markers, heading sizes and weights, bold table headers, underlined
links, inline images and SVG, `max-inline-size: 100%` media, and borders on `border`
tables. What remains host-dependent:

- **Unlayered host rules win.** Any host selector outside a cascade layer (`p { margin: 2em }`,
  `table { width: 100% }`, `img { border: 1px solid }`, `li::marker { … }`) outranks the base
  layer, whatever its specificity, as do host `!important` declarations.
- **Layered host resets rank below only when declared first.** Tailwind/DaisyUI preflight
  (`@layer base`) yields to `pie-qti-base` when the host's layers are declared before the
  player's sheet is injected. Hosts that load CSS later, or want the opposite order, pin it
  with a layer statement such as `@layer base, pie-qti-base, components, utilities;`.
- **Authored presentational hints stay with the host.** The base does not set cell padding
  (`cellpadding`), table or image widths, image alignment (`align`) or the marker of a list
  with a `type` attribute, because a stylesheet value would override the authored hint; a
  host reset that strips them still does.
- **Inherited typography beyond the tokens.** `letter-spacing`, `word-spacing`,
  `text-transform`, `font-variant` and similar inherited properties set on host ancestors
  flow into the shell and item content.
- **Inline interactions** (text entry, inline choice) render in the light DOM and take host
  form-control rules their own styles do not set. Block interactions render in shadow DOM
  and are unaffected.
- **Standalone item players.** `<pie-qti-item-player>` used outside a section or assessment
  does not get the content base.

Full isolation requires rendering the item body in shadow DOM; until then these limits hold.

---

## Design decisions

### BackendAdapter as mandatory constructor dependency (not optional)

**Decision:** `AssessmentPlayer.create()` requires a `BackendAdapter`. There is no "no-backend mode" in `AssessmentPlayer`.
**Rationale:** Making the backend optional at the class level would mean the same code path has two very different security profiles with no structural signal about which is in use. The `ReferenceBackendAdapter` already provides a client-side implementation for demos; hosts choose the security level by which adapter they instantiate.
**Alternatives considered:** Optional `backend` field with automatic fallback to a built-in reference adapter. Rejected because it makes the insecure path the default.
**Consequences:** All integrations must provide at least a `ReferenceBackendAdapter`. Code that used the old `AssessmentPlayer` constructor (non-backend flavour) cannot use this class directly.

**Current integration (2026-07-13):** `QtiAssessmentPlayerElement` exposes a JS-only backend plus
`initSession` for production-authoritative delivery. Raw answer-bearing assessment XML is refused
unless the host explicitly enables `referenceMode`; that local adapter path remains suitable only
for preview, offline, and trusted low-stakes use.

### Flat item list at construction, not lazy tree walk

**Decision:** All items are flattened into `FlatItem[]` in the constructor, indexed 0-N.
**Rationale:** Navigation, visited-item tracking, and section boundary detection are all simpler and
faster over a flat array. The source tree is retained through XML ingestion, and the backend draws
selection and ordering before the player sees it.
**Alternatives considered:** Keeping the tree structure and walking it on each navigation call. Rejected because section-crossing navigation (jumping from item 3 in section 1 to item 1 in section 2) becomes ambiguous without a flat index.
**Consequences:** `SecureAssessment` arrives drawn. Dynamic insertion is not supported. A
`withReplacement` repeat is its own item ref with a suffixed identifier, so identifier-keyed
sessions and results stay distinct.

### itemSessionControl resolves per item

**Decision:** `resolveItemSessionControl` cascades the test part, each enclosing section from outer to inner, then the item ref over the QTI defaults (maxAttempts 1, showFeedback false, allowReview true, showSolution false, allowComment false, allowSkipping true, validateResponses false). The player seeds `ItemSessionController` with every item's resolved settings; the backend resolves the same cascade to enforce attempts and comments.
**Rationale:** QTI sets item session control at three levels, and every item's effective policy must hold however the candidate reaches it.
**Consequences:** Mixed-policy test parts and sections deliver correctly. Adaptive items allow unlimited attempts and keep their feedback during attempts whatever `showFeedback` says.

### Navigation and submission modes are testPart-scoped

**Decision:** Every `SecureTestPart` retains its own navigation and submission modes. Navigation
checks consult the active item's part; the top-level fields remain compatibility fallbacks only.
**Rationale:** QTI scopes both modes to the testPart, and mixed-mode assessments must not inherit the
first part's behavior.
**Alternatives considered:** Collapsing all modes to one top-level pair. Rejected because it changes
valid mixed-part delivery semantics.
**Consequences:** Linear parts allow only the immediate forward transition and cannot be re-entered.
Nonlinear parts permit in-part navigation subject to ItemSessionControl. Branch rules and
preconditions resolve in the backend, which returns the next eligible item as `nextItemIdentifier`.

### Event listeners use `Set<listener>`, not an event emitter library

**Decision:** Each event type is backed by a `Set<ListenerFn>` maintained on the player instance.
**Rationale:** Avoids a runtime dependency, keeps the subscription model explicit and type-safe, and makes memory leak prevention obvious (each `on*()` call returns an unsubscribe function).
**Alternatives considered:** EventEmitter, RxJS, Svelte stores. Rejected — unnecessary dependencies for a headless player.
**Consequences:** No wildcard subscriptions, no once() helper, no error event. These can be added if needed without breaking the existing API.

### `submit()` preserves client response and item-session maps during simultaneous-mode item loop

**Decision:** In simultaneous mode, `submit()` captures client response and serialized item-session
maps before the loop and reapplies them after each backend state replacement.
**Rationale:** Some backend adapters return `updatedState` containing only items submitted so far.
Replacing local state directly would erase later response drafts or the template/context state needed
to score them.
**Alternatives considered:** Requiring backends not to return `updatedState` during simultaneous-mode submission. Rejected — the contract allows it and it's better to be defensive.
**Consequences:** If the backend intentionally modifies responses server-side (e.g. normalizing values), those modifications will be overwritten by the client capture. Backends that need to modify responses should do so only at finalization.

### Assessment owns the active Live ItemSession

**Decision:** `AssessmentPlayer` creates the active item through `createAssessmentItemDefinition(...).openSession(...)` and remains its owner until navigation or destruction. Section-player and the item custom element receive that exact session reference.
**Rationale:** Candidate response changes, QTI processing, attempt counters, lifecycle, presentation, and assessment persistence must observe one mutable authority. Mirroring response snapshots into another item runtime creates ordering races and can score state different from what was rendered.
**Alternatives considered:** Constructing a second `Player` in the renderer, or feeding `SerializedItemSessionState`/response maps into each rendering layer and reconciling changes afterward.
**Consequences:** The session subscription mirrors immutable response values into assessment state for persistence/events, but that mirror is not executable state. Section-player is composition-only. The item element never disposes an injected session; assessment-player serializes and disposes it when the active item changes.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|---|---|---|---|
| Backend adapter | `BackendAdapter` in `src/integration/api-contract.ts` | Implement all four required methods; pass instance to `AssessmentPlayer.create()` | `class MyBackendAdapter implements BackendAdapter { ... }` |
| Item rendering | `AssessmentItemDefinition` / `ItemSession` (via `@pie-qti/item-player`) | Assessment-player creates and owns the active live session; section and item-element adapters receive the same reference. Plugins/security/i18n are definition inputs. | Custom extractor + web component for a vendor interaction type |
| Definition plugins | `AssessmentItemDefinitionPlugin[]` in `BackendAssessmentPlayerConfig.plugins` | Supply a fixed synchronous extractor/renderer plugin list; it is compiled into every cached item definition. | Vendor interaction extraction and tag mapping |
| Custom outcome processing | Backend adapter / host application | Implement assessment-level outcome policy in the backend or host integration. | Compute aggregate outcomes before returning updated assessment state |
| Time events | `onTimeWarning()`, `onTimeExpired(event)`, `onScopeTimeExpired(event)`, `onTimeTick()`, `getTimeState()`, `getStartInfo()` | Subscribe after construction and retain the returned unsubscribe function. `onTimeExpired` reports `autoFinalized` (whole-test expiry submitted) or `submissionRequired` (nothing unlocked remains). | Display a countdown banner (`getTimeState()`), react to expiry, host-owned submission |
| Begin gate / pause | `beginGate` config, `start()` / `hasStarted()`, `pause(reason?)` / `resume()` / `isPaused()` / `getPauseReason()`, `onPauseChange()` | Set `beginGate: true` (or the `begin-gate` attribute) to hold delivery behind the shell's start screen; call `pause(reason)` for proctor pauses. | Gate delivery until the candidate begins; proctor controls |
| Persistence | `getState()` / `restoreState()` and `BackendAdapter.saveState()` | Autosave runs by default (see "Why the shell autosaves drafts"); set `autosave: false` (config/`autosave` attribute) or `canSaveState: false` on the adapter to persist yourself, then call `saveState`/`restoreState` on your own cadence; `flushAutosave()` covers page-hide when you keep it on. | Persist to a session table with an optional host storage fallback |

---

## Data model / contracts

Key types are in `packages/assessment-player/src/integration/api-contract.ts`. Invariants not obvious from the types:

- **`SecureTestPart.navigationMode` / `submissionMode`** are authoritative per part; top-level fields are compatibility fallbacks.
- **`SecureItemRef.itemXml`** must be pre-filtered by the server. For `candidate` role, `<correctResponse>` and `<responseProcessing>` must be absent. The client does not validate this; it trusts the server.
- **`AssessmentSessionState.itemResponses`** is keyed by item identifier, then by response variable identifier. The inner value type is `Record<string, ResponseValue>`. A missing outer key means the item has never been visited; an empty inner object means the item was visited but no response was entered.
- **`AssessmentSessionState.itemSessions`** contains serialized handoff values for inactive/restorable items. It never contains or represents a second live session. `getCurrentItemSession()` is the sole live reference and is not persistence data.
- **`SubmitResponsesResponse.nextItemIdentifier`** is the server's branching decision. When present, the client must navigate to that item. When absent, the client falls back to `currentIndex + 1` (individual mode) or stays in place (simultaneous mode). Servers that do not implement branching should omit this field entirely.
- **`BackendAdapter.canSaveState`** (default `true`) is the autosave capability flag: the core debounces drafts through `saveState` unless the adapter reports `false` or the config disables autosave. Adapters that cannot store drafts must say so rather than silently accepting saves.
- **`AssessmentSessionState.timing.savedAt`** is the client clock of the last autosave written into a snapshot; shells show it on the resume prompt. It is metadata, not an authority — the backend's own timestamps remain authoritative.
- **`SubmitResponsesRequest.countAttempt`** (default true) carries QTI `endAttempt`'s `countAttempt`: `false` marks a hint / "show me" submission that runs response processing without consuming an attempt. Backends must not count it toward `maxAttempts`, must not record it as the item's result, and must leave the attempt counter unchanged; the candidate continues and a later submission carries the final response.
- **`FinalizeAssessmentResponse.itemScores`** is the authoritative score record. Scores in `AssessmentSessionState.itemScores` accumulated during the session are discarded in favour of this.
- **`AssessmentScoringResult.score`** is a normalized float (0.0–1.0 for most items, but not constrained by the type). `maxScore` is the denominator. `AssessmentResults.totalScore` is the raw sum, not a fraction.

---

## Acceptance criteria

### Functional

```
AC-1: Linear navigation blocks forward skips
  Given: An assessment with navigationMode 'linear' and 3 items, currently on item 0
  When: navigateTo(2) is called
  Then: The call throws an error mentioning linear navigation
  Notes: navigateTo(1) must succeed

AC-2: Linear navigation blocks backward movement
  Given: An assessment with navigationMode 'linear', currently on item 2
  When: previous() is called
  Then: currentItemIndex remains 2 and onItemChange does not fire

AC-3: Nonlinear navigation allows arbitrary jumps
  Given: An assessment with navigationMode 'nonlinear' and 5 items, currently on item 0
  When: navigateTo(4) is called
  Then: currentItemIndex becomes 4 and onItemChange fires

AC-4: Individual submission mode submits before navigation
  Given: An assessment with submissionMode 'individual', currently on item 0 with a response
  When: next() is called
  Then: BackendAdapter.submitResponses is called before BackendAdapter-controlled navigation, and currentItemIndex advances to 1 (or to the nextItemIdentifier returned by the backend)

AC-5: Simultaneous submission mode sends all items on finalize
  Given: An assessment with submissionMode 'simultaneous', all items visited with responses
  When: submit() is called
  Then: BackendAdapter.submitResponses is called once per item that has not already been submitted, then BackendAdapter.finalizeAssessment is called exactly once

AC-6: Backend branching is respected
  Given: An assessment in individual mode, and the backend returns nextItemIdentifier 'q3' for item 'q1'
  When: next() is called on item 'q1'
  Then: The player navigates to the item with identifier 'q3', skipping 'q2'

AC-7: canPrevious is false when allowReview is false for previous item
  Given: itemSessionControl.allowReview is false, and item 1 has been submitted
  When: getNavigationState() is called from item 2
  Then: canPrevious is false

AC-8: canSkip false blocks navigation away from unanswered item
  Given: itemSessionControl.allowSkipping is false, current item has no response
  When: next() is called
  Then: An error is thrown before submitCurrentItem is called

AC-9: State restoration navigates to saved item
  Given: A persisted state with currentItemIdentifier 'q5' and visitedItems ['q1','q2','q3','q4','q5']
  When: restoreState(state) is called
  Then: currentItemIndex points to 'q5', and NavigationManager.isVisited() returns true for the indices corresponding to q1-q5

AC-10: Simultaneous submit preserves response data across backend state updates
  Given: An assessment with 3 items, all with responses, submissionMode 'simultaneous'
  And: The backend returns an updatedState after each item that only includes that item's responses
  When: submit() is called
  Then: Each item's own draft responses and serialized item session reach its submitResponses call
        later item drafts survive every earlier updatedState replacement
  Notes: Regression test for the response/session map capture pattern

AC-11: Shared and direct rubrics stay on their placement surfaces
  Given: The active testPart and section have shared rubricBlocks
         and the assessmentItem has a candidate-visible direct rubricBlock
  When: getCurrentSharedRubricBlocks() and currentSession.present() are called
  Then: Shared blocks contain cloned testPart blocks followed by section blocks
        presentation.directRubrics contains the item block
        the item block is not duplicated into shared content

AC-12: Timer fires warning and expiry callbacks
  Given: An assessment with timeLimits.maxTime of 5 seconds and timeWarningThreshold of 3
  When: 2 seconds elapse
  Then: onTimeWarning fires with remainingSeconds approximately 3
  When: 5 seconds elapse
  Then: onTimeExpired fires and isTimeExpired() returns true

AC-13: Whole-test expiry auto-finalizes
  Given: An assessment with timeLimits.maxTime (no allowLateSubmission) and pending responses
  When: The limit expires
  Then: The core finalizes like submit() (pending responses collected, outcomes computed,
        complete fires) and onTimeExpired reports autoFinalized; results are the same
        object a later submit() returns

AC-14: An expiry dead end leaves Submit reachable
  Given: A test part limit expired and no unlocked item remains
  When: The candidate is on a locked item that is not the last
  Then: onTimeExpired reports submissionRequired, the shell offers Submit in place of Next,
        and the backend accepts the collected responses marked submissionReason 'time-expired'

AC-15: The begin gate holds delivery and the clocks
  Given: AssessmentPlayer.create with beginGate: true and an assessment maxTime
  When: Time passes before start() is called
  Then: hasStarted() is false, no item session exists, totalTime stays 0 and remaining is
        unchanged; after start() the first item is entered and the clocks run

AC-16: A proctor pause freezes every clock and blocks candidate actions
  Given: A running assessment with an active item session
  When: pause('reason') is called
  Then: remaining time, scope times and the item's duration freeze; next/submit/updateResponse
        reject with assessmentPaused; resume() reopens the attempt with responses intact and
        the clocks continue from the frozen point
```

```
AC-13: Assessment, section, and item element share one live item session
  Given: AssessmentPlayer has navigated to item q1
  When: toSectionComposition(player) is resolved and the active item is rendered
  Then: composition.activeItem.session === player.getCurrentItemSession()
        only q1 carries a session reference
        a response event mutates that session once and assessment persistence observes its state

AC-14: Failed individual submission restores the active attempt
  Given: The active candidate session is writable and has not counted an attempt
  And: BackendAdapter.submitResponses rejects or returns success=false
  When: submitCurrentItem() provisionally ends the attempt
  Then: The method rejects
        getCurrentItemSession() is a restored writable session with the same pre-submit variables
        retrying does not double-count the failed attempt

AC-15: Secure item role and plugins are fixed in the definition
  Given: SecureItemRef.role='scorer' and config.plugins=[vendorPlugin]
  When: The item definition opens its active session and present() is called
  Then: vendorPlugin extraction/component registration is available
        scorer role policy is applied
        present() exposes no role override
```

### Accessibility

```
AC-A1: Item change event enables screen reader announcement
  Given: AssessmentShell is listening to onItemChange
  When: next() advances to the next item
  Then: The shell fires an ARIA live region update with the new item number (e.g. "Question 3 of 10")
  Notes: This is a shell-layer responsibility; the player's onItemChange event is the trigger.

AC-A2: Navigation bar buttons have accessible disabled states
  Given: canPrevious is false on the first item
  When: AssessmentShell renders NavigationBar
  Then: The Previous button has aria-disabled="true" or is rendered as a disabled <button>

AC-A3: The shell renders without host CSS
  Given: A host page with no Tailwind, DaisyUI or theme stylesheet
  When: <pie-qti-assessment-player> renders an assessment with a passage
  Then: Shell icons are icon-sized, navigation buttons are at least 44px tall, and a
        keyboard-focused control shows a 2px solid focus ring
  Notes: apps/demo/tests/playwright/no-host-css.pw.ts

AC-A4: Phones get one navigation row and a Passage/Question tab switch
  Given: A 375px-wide container showing an item with a passage
  When: The shell renders
  Then: Previous and Next sit on one row; the passage and question are tabs
        (role="tablist"), and a newly presented item selects the question tab

AC-A5: Content reflows at 400% zoom and focus is never covered
  Given: A 320×256 CSS-pixel viewport
  When: A control inside the question receives focus
  Then: There is no horizontal scrolling, header and navigation are not pinned, and the
        focused control is the topmost element at its position

AC-A6: Skip link and dialog focus
  Given: The shell is rendered
  When: The "Skip to question" link is activated
  Then: Focus moves to the active question
  When: An AssessmentDialog opens and is dismissed with Escape
  Then: Focus moves to its title on open and returns to its trigger on close

AC-A7: Submit is confirmed with the unanswered questions named
  Given: An assessment with unanswered questions on its last item
  When: The candidate activates Submit
  Then: A confirmation dialog names the answered count and each unanswered question,
        links back to the reachable ones, and the test is not finalized without an
        explicit confirm; cancel returns focus to the Submit control

AC-A8: The review screen lists every delivered item with its state
  Given: Items answered, partially answered, unanswered, flagged and unvisited
  When: The candidate opens the review screen from the navigation bar
  Then: Each item shows its state as text plus an icon grouped by candidate-visible
        section, the current item is aria-current, and only navigation-legal items
        offer a jump (linear parts show status only, with an explanatory note)

AC-A9: The countdown never chatters and warns through its own region
  Given: A timed assessment with warning thresholds
  When: The countdown ticks and a threshold is reached
  Then: The ticking readout is role="timer" with aria-live off and a programmatic name
        ("Time remaining: 12:34"); each threshold announces once through a separate
        polite status region; expiry announces assertively; the candidate's hide/show
        toggle persists across navigation

AC-A10: Scope expiry is announced and focus follows delivery
  Given: A section limit expired while items remain outside it
  When: Delivery moves to the next unlocked item
  Then: An acknowledge dialog says the scope's time is over and the candidate is moving
        on; after it closes, focus moves to the question and "Question X of Y" is
        announced; the start screen and expiry dialog pass axe AA
```

### Edge cases

```
AC-E1: submit() on an assessment with no items succeeds
  Given: An assessment with zero items (edge case from server)
  When: submit() is called
  Then: finalizeAssessment is called without submitting any items, and AssessmentResults is returned

AC-E2: navigateTo() with the same index as current index is a no-op
  Given: currentItemIndex is 2
  When: navigateTo(2) is called
  Then: The call is a no-op and the current live ItemSession identity is unchanged
  Notes: the current index is permitted in both modes; a different earlier index is not permitted in a linear part.

AC-E3: destroy() after submit() does not throw
  Given: An assessment that has been fully submitted
  When: destroy() is called
  Then: No error is thrown and all listener sets are empty

AC-E4: Backend returns updatedState after submitCurrentItem; responses are not lost
  Given: An assessment in individual mode with 2 items
  And: The backend returns an updatedState that includes scores but no itemResponses for item 1
  When: next() is called on item 0 (triggering submitCurrentItem)
  Then: The responses for item 0 remain in state.itemResponses after the state update
```

---

## Related

- QTI spec: §2 (Assessment Architecture), §2.1–2.4
- Implementation: `packages/assessment-player/src/core/AssessmentPlayer.ts`, `NavigationManager.ts`, `ItemSessionController.ts`, `TimeManager.ts`
- Shell: `packages/assessment-player/src/components/` (`AssessmentShell`, `NavigationBar`, `AssessmentHeader`, `AssessmentDialog`, `ReviewScreen`, `SectionMenu`); review/answered-state core helpers: `packages/assessment-player/src/core/reviewState.ts`; section layouts and the base layer: `packages/section-player/src/components/` (`SplitPaneResizer`, `SectionPlayerSplitPane`, `SectionPlayerVertical`, `PlayerBaseStyles`)
- API contract: `packages/assessment-player/src/integration/api-contract.ts`
- Adjacent PRDs: `docs/prds/architecture/item-player.md`, `docs/prds/architecture/response-processing.md`
- Existing docs: `packages/assessment-player/BACKEND-INTEGRATION.md`, `packages/assessment-player/EXTENSIBILITY.md`
