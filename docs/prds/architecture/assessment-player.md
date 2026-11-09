# PRD: Assessment Player

<!--
  Status: current
  Type: architecture
  Packages: @pie-qti/assessment-player
  Last reviewed: 2026-11-09
-->

**Status:** current
**Type:** architecture
**Packages:** `@pie-qti/assessment-player`
**Last reviewed:** 2026-11-09

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
end-of-test path: pending simultaneous-mode responses are submitted, every visited individual-mode
item the backend has not accepted yet is collected through the same detached end-attempt loop (an
item the candidate answered and then jumped away from without a forward submission, an item an
expired limit froze, and the current item; unchanged responses never re-submit, so no attempt is
re-spent), the backend finalizes (outcome processing runs against the freshly persisted final
snapshot, so the built-in durations are current), results are produced, `complete` fires with them
(every ending alike — the shell hands them to its host's `onSubmit` once), and navigation closes
(`canNext`/`canPrevious` become false; further navigation rejects with a typed `testFinalized`
error). The results, the finalized event and `getEndReason()` record why the test ended:
`candidate`, `expiry`, `proctor` or `branch` (the outermost caller decides — a candidate's submit
whose last submission branches to `EXIT_TEST` stays a candidate end — except that an end collecting
a delivery the time already closed, the whole test expired or a scope expiry left nothing open, is
an `expiry` end whoever triggers it: the automatic submission, the candidate's Submit after it
failed, a proctor's force-submit). `EXIT_TESTPART`/`EXIT_SECTION` first continue with the
next delivered item outside the ended scope, finalizing the ended test part when delivery leaves it
or nothing follows.

The end of the test never navigates: it collects where the candidate stands. A branch decision the
backend returns for the end's own collection is kept on record, not followed — if the end does not
complete (a failed finalize), the next `next()` from that item follows it — so the final snapshot
never records an unseen item as current or visited, and a retry is never held by a question the
candidate was moved onto. A scope that expires while the end runs closes at once (its items go out
as they stand, `time-expired`); delivery moves off it only if that end does not finalize.

The end of the test is also the end of every item session: the snapshot persisted before the
backend finalizes, and after it the player's own record (the live session included), carry each
delivered item session closed. A practice item reopened for attempts the candidate did not use
stands as the backend last accepted it — the collection re-sent every changed response — so Results
Reporting reports it `final`, never `pendingSubmission`. An end that does not finalize leaves the
sessions open (the stored draft is saved again), so the remaining attempts survive.

### Why a move without a submission still applies branch rules and preconditions

QTI branch rules and preconditions decide every forward move, not only the ones that submit an
item. The backend decides the moves it sees: each counted submission returns its decision for
leaving the item (`nextItemIdentifier`, built from the test's branch rules and the preconditions of
what follows). A submission that stays on the item — a practice check, a counted
`endAttemptInteraction` — keeps that decision on record (one at a time: any later counted
submission replaces it, because the outcomes it was made on have moved), and the candidate's next
move on from the item that submits nothing — the response unchanged — follows it. A changed
response re-submits and the fresh decision replaces it.

A move with no backend decision on record — a nonlinear jump into the next test part, a move on from
a simultaneous part, a session resumed after a reload, a backend that returns no decision — is
decided by the player with the reference backend's own rules (`test-navigation.ts`:
`nextItemIdentifier`, `firstEligibleItem`), against the test outcomes the backend last returned and
the item results it recorded (its `result.outcomeValues` over the accepted item session). The same
forward step feeds `next()`, `canNext`, `getForwardTransitionInfo()`, `navigateTo()` legality, the
review screen's jumps and the scope-expiry hop, so a test part whose precondition fails is never
entered and, in a linear part, a section or item whose precondition fails is skipped. When nothing
eligible follows, Next gives way to Submit. A test without branch rules or preconditions evaluates
nothing and moves to the adjacent open item, as before.

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
cadence and storage, and `startOver()` for the candidate-facing restart: it clears what the
candidate authored and the backend has not accepted — responses, flags, comments, visited state,
the timer preference and unrecorded check state — and persists the blank draft at once, so a
refresh cannot resurrect discarded answers. It keeps the time accounting: the clocks, every expired
scope and a whole-test expiry persist, because a restart must never grant a fresh time allowance
after the candidate has seen the questions. Items the backend accepted keep their recorded results
(the backend remains authoritative for them). Hosts that never let a candidate discard saved work
turn Start over off (`allowStartOver` / `allow-start-over="false"`). A session created from a
backend-restored snapshot (`initSession.resumeSessionId`) reopens at the saved item with its
answers; `hasRestoredProgress()` tells shells whether there is work worth resuming, and the
snapshot's `timing.savedAt` dates the resume prompt.
`StatePersistenceManager` exists as an internal source utility but is not a published package export;
`ReferenceBackendAdapter` uses local storage for explicit demo/reference delivery.

### Why itemSessionControl is a UI hint, not an enforcement boundary

`itemSessionControl` settings (maxAttempts, allowReview, allowSkipping) are exposed by the server via `SecureTestPart.itemSessionControl` and echoed to the client. The client uses `ItemSessionController` to provide UI hints — disabling the Previous button, hiding Submit after max attempts, etc. The server remains authoritative for actual enforcement; a malicious client that bypasses these UI gates will still be rejected at the submission endpoint. This is called out explicitly in the code comments to avoid the temptation of treating client-side enforcement as a security boundary.

The client does apply `allowSkipping` and `validateResponses` to its own submissions, as one rule: both are QTI controls of items in `individual` submission parts ("only applicable when the item is in a testPart with individual submission mode"), and both gate *submission*, not navigation — moving away from an item in a nonlinear part is not a submission. A skipped item is one whose every response is NULL, empty or still equal to its declared default (the `numberResponded` test). A candidate-initiated submission (`next()`, `submitCurrentItem()`, `checkCurrentItem()`, and the end of the test) never sends a skipped item while `allowSkipping=false`, nor an answered item whose responses do not satisfy its interactions while `validateResponses=true`; the end of the test rejects naming the items rather than force-submitting them or failing generically.

A test part cannot be re-entered, so a question left owing an answer in a part the candidate leaves could never be fixed. Leaving an individual part is therefore gated on that part's questions the candidate can still reach (`getTestPartBlockers()`): Next out of the part, a direct jump into the next part and a branch decision leaving it (`EXIT_TESTPART`, `EXIT_SECTION` with nothing after it in the part, a later-part target, `EXIT_TEST`) reject with `leavePartResponseRequired` / `leavePartResponseInvalid` naming them; a refused branch decision is kept and followed by the next `next()` from that item. A question the candidate can no longer reach (behind them in a linear part, from a session restored from before the gate) never holds the way out — nothing could answer it. As a safety net, a question the candidate can no longer reach never holds the end of the test either: `getSubmissionBlockers()` reports only reachable questions, and the unreachable ones (`getUnreachableSubmissionBlockers()` — a session restored from before the gate) are collected as they stand with `submissionReason: 'unreachable'`, never as a normal candidate submission. An administrative end — a time expiry, a proctor's forced submit — collects everything as it stands (the QTI end-of-scope rule), recording an unanswered required item as skipped by the expiry.

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
| `timeLimits.minTime` / `maxTime` (assessment, testPart, section — every enclosing section, not only the innermost — item) | Runtime enforcement with independent persisted clocks (nested sections each run their own clock, expire, gate `minTime` transitions and accumulate `SECTION_ID.duration`); edge/browser coverage remains |
| `timeLimits.allowLateSubmission` | Full |
| `itemSessionControl` cascade (testPart → sections → item ref) | Full, over the QTI defaults |
| `itemSessionControl.maxAttempts` | Backend-enforced; UI hint (adaptive items unlimited). More than one attempt delivers the item-level check-answer control ("Attempt N of M"; the control disables with a localized explanation once the attempts are used up) and shows feedback for every non-final attempt |
| `itemSessionControl.allowComment` | Backend-enforced; a per-item "Comments for the test team" disclosure sends the comment with the item's next submission |
| `itemSessionControl.allowReview` | UI hint; governs only once the item's session is over — after its last attempt (an adaptive item: once completed). While attempts remain the candidate may return to use them |
| `itemSessionControl.allowSkipping` | Individual parts only (QTI): a candidate submission — `next()`, check, `submitCurrentItem()`, the end of the test — never sends a skipped item (every response NULL, empty or equal to its declared default) while false; the end of the test rejects naming the items (`finalizeResponseRequired`), and so does leaving the part (`leavePartResponseRequired`). Navigation within a part is not submission. A question no longer reachable is collected as it stands (`unreachable`); time expiry and proctor force-submit collect regardless |
| `itemSessionControl.showFeedback` / `showSolution` | Applied to the item presentation. Feedback visibility is attempt-relative: with more than one attempt, feedback shows for every non-final attempt; after the last attempt `showFeedback` governs (presentation, captured item feedback, and the check-answer control alike) |
| `itemSessionControl.validateResponses` | Individual parts only (QTI): an answered item whose responses do not satisfy its interactions (minChoices, minStrings, matchMin…) is not submitted; the end of the test rejects naming the items (`finalizeResponseInvalid`), and so does leaving the part (`leavePartResponseInvalid`). The blocker carries the interaction's `requirement` (minimum selections, strings, associations, plays). A skipped item is the `allowSkipping` rule's domain |
| `preCondition` (testPart, section, item ref) | Evaluated on entering each (a test part in any navigation mode; a section or item in a linear part): by the backend for the moves it decides, by the player with the same rules for a move without a backend decision (a jump into the next part, a move on from a simultaneous part, a resumed session). A failing part is never entered |
| `branchRule` (item ref, section, testPart) | Evaluated by the backend; returned as `nextItemIdentifier`. A submission that stays on the item (a practice check, a counted end-attempt) keeps the decision, and the next move on that submits nothing follows it; a later counted submission voids it, so the rules re-evaluate on the outcomes they moved. Leaving a simultaneous part on Next commits the part first and then follows the decision the flush returned for the part's last item (the part's rule ran there with every variable committed), through the same part-leave and `EXIT_*` guards as a submitting move; the end of the test's own collection stores no decision. The decision is persisted with the session state, so a restored session lands identically. Without a backend decision the player applies the rules itself. `EXIT_TEST`/`EXIT_TESTPART`/`EXIT_SECTION` terminate the ended scope through the same finalization path as `submit()` |
| `variableMapping` / `templateDefault` | Full. In a nonlinear test part every item ref's `templateDefault` is evaluated once at part entry (cached per part) with the test outcomes and the other items' persisted variables (`ITEM.VARIABLE`) in scope; linear parts evaluate on entering each item |
| `testFeedback` (outcome-based) | Full for preserved structured feedback and finalized backend feedback |
| `assessmentSection.selection` (direct children, with replacement) | Drawn by the backend at session start |
| `assessmentSection.ordering` (shuffle, fixed, keepTogether) | Drawn by the backend at session start |
| `outcomeDeclaration` / `outcomeProcessing` (test-level) | Parsed/executed by the reference adapter; production backend remains authoritative |
| Built-in duration variables in test-level outcome processing | `duration` (test), `TESTPART_ID.duration`, `SECTION_ID.duration` declared from the persisted timing clocks, converted to QTI seconds |

### Known divergences from spec

None of these contradicts a clear QTI rule. The first is a test-coverage note; the other two are architecture choices the specification leaves to the delivery system.

- **Timing evidence (G-22, coverage note):** scoped clocks and `minTime`/`maxTime` enforcement exist, and the
  built-in `duration`, `TESTPART_ID.duration` and `SECTION_ID.duration` variables are exposed to
  test-level outcome processing in seconds from the timing clocks. Direct integration coverage for
  every minimum-time scope and simultaneous expiry combination remains.
- **Client-evaluated navigation rules (architecture):** QTI defines what branch rules and preconditions mean and when they apply (QTI 3.0 §2.8.2, §5.23), not which component evaluates them. For a move without a backend decision the player
  evaluates branch rules and preconditions itself. It reads the item variables the client holds
  (the accepted item session, with the backend's `result.outcomeValues` over its outcomes), and a
  condition using a `random*` operator draws from the client's `Math.random`, not the backend's
  rng. A production backend stays authoritative and must refuse a submission for an item its own
  rules make ineligible.
- **Item feedback with secured production content (architecture):** QTI decides feedback visibility from outcome values (QTI 3.0 §5.93) and does not say where response processing runs. The check-answer flow and the submit-on-move
  transition surface item feedback from the candidate session's own response processing (and from
  a backend `result.feedback` when the session produces no modal feedback). Production item XML
  delivered without `<responseProcessing>` therefore needs the backend to return feedback through
  the submission contract; the reference adapter keeps response processing candidate-side, so
  preview/low-stakes delivery shows authored feedback out of the box.

---

## Functional requirements

- **FR-1:** `AssessmentPlayer.create(config)` must call `BackendAdapter.initSession()` before constructing the player, and must use the `SecureAssessment` returned from the server — not any locally-held QTI XML — as the authoritative item list.
- **FR-2:** In a linear testPart, `navigateTo(index)` must permit only the current item or immediate
  next item; once the candidate advances, earlier items in that part cannot be revisited.
- **FR-3:** In nonlinear navigation mode, `navigateTo(index)` must allow any in-bounds index.
- **FR-4:** In `individual` submission mode, `next()` must call `submitCurrentItem()` and await its result before advancing the index. If the backend returns a `nextItemIdentifier`, the player must navigate to that item instead of `currentIndex + 1`; when it returns none, the player moves to the next item the delivery rules make eligible (FR-31).
- **FR-5:** In `simultaneous` submission mode, `submit()` must send all unsubmitted items to the backend before calling `finalizeAssessment()`. Client-collected responses must survive across backend state-update responses during the submission loop.
- **FR-6:** `getNavigationState()` must return `canPrevious: false` throughout a linear testPart and
  when review policy forbids the previous item in nonlinear delivery.
- **FR-7:** QTI `allowSkipping=false` (individual parts only) gates every candidate-initiated submission of a skipped item (every response NULL, empty or equal to its declared default): `next()` throws before submitting, `submitCurrentItem()`/`checkCurrentItem()` reject, and the end of the test rejects with the coded `finalizeResponseRequired` naming the reachable items (`getSubmissionBlockers()`) instead of submitting NULL responses. Leaving an individual test part with such a question rejects with `leavePartResponseRequired` before anything is submitted (`getTestPartBlockers()`), on Next, a direct jump and a branch decision alike — counting only questions the candidate can still reach (one behind them in a linear part cannot hold the way out). Navigation within a part (nonlinear jump, previous) is not submission and stays allowed; a simultaneous part is never gated; a question no longer reachable never holds the end of the test and is collected as it stands (`submissionReason: 'unreachable'`); a time expiry or a proctor's forced submit collects the item as skipped.
- **FR-8:** `getCurrentSharedRubricBlocks()` must return cloned test-part and section rubric blocks for
  the active item in that order. The compatibility `getCurrentRubricBlocks()` method retains its
  section-first/fallback behavior. Direct `assessmentItem` rubrics must remain on
  `ItemSession.present().directRubrics` rather than being merged into shared section content.
- **FR-9:** `TimeManager` must independently accumulate and persist assessment, testPart, section
  (every enclosing section — nested sections run alongside each other), and item clocks; enforce
  the shortest active hard maximum and every applicable minimum transition (leaving an enclosing
  section waits for its minimum too); and fire warning/expiry callbacks for the active limiting
  scope, outer sections included.
- **FR-10:** `getState()` must return a save snapshot with cloned top-level collections and timing
  maps. It is not a recursively immutable value; callers must treat nested response, score, and
  serialized-session entries as read-only or clone them before mutation.
- **FR-11:** `restoreState(state)` must navigate to the item identified by `state.currentItemIdentifier`, restore `visitedItems` into `NavigationManager`, and rehydrate `itemResults` from `state.itemScores` so that `submit()` can skip already-submitted items.
- **FR-12:** `destroy()` must unsubscribe and dispose the current live item session, clear cached definitions and all event listener sets, and release timer resources.
- **FR-13:** `getVisibleFeedback()` after successful finalization must evaluate preserved structured
  `testFeedback` against `FinalizeAssessmentResponse.outcomes`; test feedback comes only from the
  test's and its test parts' `testFeedback` blocks.
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
  finalized/while busy) clears the draft of the furthest test part reached and what follows —
  responses, sessions, results, flags, comments, visited state, the timer preference and
  unrecorded check state — repositions delivery to the first open item of that part (else the first
  open item after it, or reports the expiry dead end) and persists the blank draft at once. A part
  already left is never re-entered: its questions stay closed as they stand (visited, collected at
  the end of the test). It keeps the time accounting: clocks, expired scopes and a whole-test expiry
  persist (no fresh time allowance); items the backend accepted keep their recorded results.
- **FR-22:** A session created from a backend-restored snapshot reports `hasRestoredProgress()`
  (saved answers present), `getRestoredSavedAt()` (the snapshot's `timing.savedAt`) and carries
  `savedAt` on `getStartInfo()`. Restored responses, flags, timer preference and the current
  item are restored by the snapshot, and a restored-paused session reopens paused: the shell
  shows the pause overlay without waiting for an `onPauseChange` (it syncs from
  `isPaused()`/`getPauseReason()` at creation), announces assertively and holds focus on the
  overlay until the host resumes it; the core reports the restored pause and a restored terminal
  session once at creation (`onPauseChange`, `onFinalized`), so an embedding's events (the
  element's `player-pause`, `session-finalized`) never miss them.
- **FR-23:** `checkCurrentItem()` submits the active item through the normal per-item path
  (`countAttempt: true`, branching not followed) and stays on it, keeping the backend's
  `nextItemIdentifier` as the decision for leaving the item (FR-31). It is a coded
  `maxAttemptsReached` rejection once the resolved attempts are used up and a coded
  `navigationNotAllowed` rejection outside an individual part with `showFeedback`. While
  attempts remain, a non-adaptive item whose attempt just ended reopens writable from that
  processed attempt — its attempt count (`contextVariables.numAttempts`, so attempt k runs response
  processing as attempt k) and its computed outcomes, with the lifecycle back to `interacting` — so
  the integrated feedback the outcomes drive renders during the revision; adaptive items keep
  their engine loop. Each counted submission captures the item's modal feedback (session-side,
  else the backend's `result.feedback`) behind the resolved `showFeedback`, exposed through
  `getLastItemFeedback()` until `clearLastItemFeedback()` or the next submission replaces it.
- **FR-24:** Moving on from an item whose last counted submission carried exactly these
  responses (a practice check the candidate did not revise) does not submit again and does not
  spend an attempt; it follows the backend decision that submission returned (FR-31). A changed
  response re-submits through the normal path. The same rule gates
  the final current-item submission inside `endTestInternal()`, and extends to the whole
  collection: at finalize, every visited individual-mode item whose live responses differ from
  its last counted submission — or that has no recorded result — is submitted once through the
  detached end-attempt loop, so an answer left behind a nonlinear jump is scored instead of
  finalized from NULL. Items already accepted with identical responses are never re-sent, and a
  resumed session seeds that memory from the snapshot's recorded results (`itemScores` +
  `itemResponses`).
- **FR-25:** `setItemComment()` records the candidate's per-item comment (QTI `allowComment`)
  into the session state, restarts the autosave debounce like other candidate activity, and the
  core sends it as `comment` on every submission path for that item.
- **FR-26:** `getResultsSummary()` returns null before finalization and, after it, the delivered
  items with their answered status and the backend's per-item score (when returned), plus the
  finalized totals. The shell renders it only under the opt-in `showResultsSummary` prop.
- **FR-27:** QTI `validateResponses=true` (individual parts only) keeps an answered item whose
  responses do not satisfy its interactions from being submitted: the per-item paths reject with
  `attemptValidationFailed`, and the end of the test rejects with the coded `finalizeResponseInvalid`
  naming the items. A skipped (empty) item is the `allowSkipping` rule's domain, not validation's.
- **FR-28:** `submit({ force: true })` is the proctor's administrative end of the test: it runs
  during a pause and behind the begin gate, ignores minimum times and the skipping/validation
  controls, collects every response as it stands under `timing.submissionReason: 'proctor'` —
  except items an expired time limit closed, which go out as `time-expired` (time wins over
  `proctor`) — and ends the test (`endReason: 'proctor'`; `expiry` when the time had already
  closed the delivery: the whole test expired, or a scope expiry left nothing open). It never
  rejects as busy: a force-submit requested while a
  candidate transition is in flight is queued behind it and lands when it settles. A candidate's
  `submit()` stays blocked while paused. The shell surfaces a refused candidate end of the test as a
  warning naming the questions, never as a retryable failure.
- **FR-29:** Template defaults (QTI `templateDefault`) in a nonlinear test part are evaluated once,
  at part entry, for every item ref in the part, with the test outcomes and the other items'
  persisted variables (`ITEM.VARIABLE`) in scope, and cached for the part; linear parts evaluate
  each item's defaults on entering it, against the test outcomes.
- **FR-30:** The reference backend (`ReferenceBackendAdapter`, `requiresItemSession: true`) always
  receives the candidate's serialized item session and scores from it: a templated item against
  the instance the candidate saw (a restore never re-runs template processing), an adaptive item
  from its outcomes as submitted. A templated or adaptive item without a session is refused
  (`AssessmentItemScoringError` `itemSessionRequired`). Production backends keep the
  `sendItemSessionToBackend` default (off).
- **FR-31:** Every forward move applies the test's branch rules and preconditions. A counted
  submission that moves (`next()`, `submitCurrentItem()`) follows its `nextItemIdentifier`; one
  that stays on the item (a practice check, a counted `endAttemptInteraction`) keeps it — one
  decision at a time, replaced by any later counted submission — and the next forward move from
  that item that submits nothing follows it (its minimum times checked). A move without a backend
  decision (a nonlinear jump into the next test part, a move on from a simultaneous part, a resumed
  session, a backend that returns none) lands on the item the reference rules
  (`test-navigation.ts`) deliver, evaluated against the backend's last test outcomes and the
  recorded item results: a test part whose precondition fails is never entered (a jump into it is
  a coded `navigationNotAllowed`; the forward step lands past it), and in a linear part a section
  or item whose precondition fails is skipped. `next()`, `canNext`, `getForwardTransitionInfo()`,
  `isNavigationTargetLegal()`/`getReviewItems()` and the scope-expiry hop share that forward step;
  with nothing eligible after the item, `canNext` is false and Submit is the way on.
- **FR-32:** Once the test ends every delivered item session is closed: the snapshot persisted
  before `finalizeAssessment()` and the player's record afterwards (`getState()`, the live
  session) carry them closed, so Results Reporting reports each scored item `final`. An end that
  does not finalize re-saves the open draft.

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
  late submission locks its items — a nested (outer) section's expiry locks its whole subtree
  (`TimeManager.onScopeExpired` → `handleScopeExpired`);
  delivery moves to the next open question across the whole reachable delivery — forward in the
  part, else an open question earlier in a nonlinear part, else the next part — and the shell
  shows an acknowledge-only AssessmentDialog notice naming where ("The time for this section is
  over — You are moving on to question 1"; a part: "the next part of the test"). Every close of
  it — Continue or Escape — moves focus to that question and announces its position like a
  navigation (`onScopeTimeExpired` event: `deliveryContinues`, `nextIndex`). An expiry also closes
  a submit confirmation or leave-part warning that was open (its blockers and jumps no longer
  hold). The move is never undone: a branch decision returned by a submission that was in flight
  when the expiry moved delivery is not followed, and no branch decision re-enters a test part
  already left. A scope that expires while the end of the test runs closes at once (its items go
  out as they stand); delivery moves off it only if that end does not finalize. Expiries are not part of a snapshot: a restored session recomputes them from its clocks
  before entering any item, so a scope that ran out while the candidate was away is locked at once
  (never editable until the next tick) and delivery lands on an open question the same way — or,
  with none, shows the closed item read-only and reports the dead end below.
- **An expiry dead end can never strand the candidate.** When no open question remains
  reachable, the core reports `onTimeExpired({ submissionRequired: true })`, the shell shows the
  expiry dialog with a Submit action (dismissed with Escape, focus moves to the navigation bar's
  Submit), and the navigation bar offers Submit in place of Next wherever the candidate is — as it
  does whenever no forward step remains (an earlier question still open after the later ones
  closed). Ending the test then is the mandated collection — an `expiry` ending, with the
  time-expired completion heading: the
  frozen responses go out as `timing.submissionReason: 'time-expired'` (the reference
  backend accepts them; production backends remain authoritative), and minimum times and
  response validation cannot hold a closed delivery open.
- **Whole-test expiry auto-finalizes.** When the assessment limit expires without late
  submission, the core runs the same finalization as `submit()` (pending simultaneous
  responses, the open individual-mode item, `finalizeAssessment`, `onComplete`,
  outcomes/testFeedback), bypassing minimum-time checks and the skipping/validation controls
  (an unanswered required item is recorded as skipped by the expiry); a failure keeps the
  session open with every item closed, surfaces through `onError`, and the expiry dialog
  offers Submit — still an `expiry` ending (the time-expired completion heading), as is a
  proctor's force-submit at that point. The host hears `onTimeExpired({ autoFinalized: true })` and the element's
  `time-expired` event. A session restored after its whole-test limit ran out finalizes the
  same way as soon as delivery runs. `allowLateSubmission` keeps the test open past the limit
  instead.
- **Begin gate (opt-in).** With `beginGate` (shell prop / `begin-gate` attribute), the
  core is created without entering an item and `TimeManager` holds: the shell shows an
  accessible start screen — assessmentTest title, "You have N minutes" (PNP applied,
  `getStartInfo()`), the first test part's role-filtered rubric blocks, and a Begin
  control with focus on the heading. `start()` (Begin, or the imperative API) enters the
  first (or restored) item and starts every clock. Without the gate, delivery and the
  clocks start at session creation, exactly as before; a resumed session's start screen
  shows the time that remains. A pause in force when the gate holds (a session restored paused,
  or a pause before Begin) shows on the start screen and holds Begin until the proctor resumes.
  Begin-gate time never counts: submissions carry the candidate's test clock
  (`timing.assessmentElapsedMs`/`assessmentLimitSeconds`).
- **Proctor pause/resume.** `pause(reason?)` freezes every clock (assessment, part,
  section, item, and the live attempt's QTI `duration` via a suspend + snapshot),
  rejects candidate actions with a coded `assessmentPaused` error, and asks the shell
  for an overlay carrying the host-supplied, candidate-facing reason; the shell makes
  header/content/navigation inert and moves focus to the overlay (its heading one level below the
  shell title), announcing the pause
  through `role="status"` (`onPauseChange` / `player-pause` / `player-resume` events).
  A pause requested during a transition applies when it settles; while paused the reason
  can be replaced. `resume()` reopens the attempt from the pause snapshot, so paused
  time never counts as time on task, and the countdown continues where it froze. A
  snapshot taken while paused carries `timing.isPaused`/`pauseReason` and **reopens paused: the
  shell syncs the overlay from the core at creation** (no `onPauseChange` fires for the restored
  state — the shell announces the pause assertively, lands focus on the overlay, suppresses the
  resume prompt while the pause holds and returns it when the pause lifts). Opening the pause
  closes every shell dialog (submit confirmation, expiry notice, feedback, resume prompt — a
  candidate must never answer or submit underneath a pause), closes every dialog inside the shell —
  the section display settings dialog included, which would otherwise stay in the top layer above
  the pause card — dispatches `pie-qti-close-transient-ui` (`{ reason: 'pause' }`) on `document` for
  the transient UI outside dialogs (the math editor, glossary popups), makes the whole chrome inert
  through one wrapper while the overlay stays operable outside it, and contains focus within the
  shell: focus that falls on covered content returns to the overlay heading, while the host page
  around an embedded player stays operable (its help, a proctor chat).
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
  bar shows a polite `role="status"` region that exists from the start (empty while idle, so a
  screen reader catches the first message) next to the answered count: "Saving…" while a save
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
  undone"), then `startOver()` clears the draft, persists the blank state and repositions to the
  first open item with focus and announcement handled like a navigation — clocks and expired
  limits persist, so a restart never grants new time. The `allowStartOver` prop
  (`allow-start-over="false"`) removes the action: a restored draft then simply continues.
- **A finalized session restores terminal.** When the backend reports the stored session as
  finalized (`InitSessionResponse.finalized`), the shell renders the already-submitted
  completion view instead of delivery whose every action would reject: no navigation, no resume
  prompt, `submit()` returning the stored results (`finalResults`).

### Submit safety, review screen and flags (WCAG 3.3.4)

- **Submit is confirmed, never accidental.** The final-submission control sits in the
  navigation bar styled apart from the primary Next (outlined, error-toned, with a distinct
  icon). Activating it opens the `AssessmentDialog` confirmation, which states how many
  questions are answered ("8 of 12 answered") and flagged, names every question that still needs
  an answer before the test can end (QTI `allowSkipping=false` without one) and, as a separate
  group, every incomplete answer (`validateResponses=true`) with what it still owes ("Go to
  question 2: select at least 2"), with jumps where navigation allows, and holds Submit
  until they are answered (its "Review questions" action is unavailable while the submission
  runs); a refused end of the test returns as a warning naming the questions,
  not a "Try again" failure. It also names every unanswered question,
  and links back to each one the navigation rules can still reach (linear parts render
  status only). Cancel (or Escape) closes it and returns focus to the Submit control; the
  submission itself runs only on the explicit confirm. A failed submission closes the dialog
  so the alert and the "Try Again" control are reachable, and moves focus there.
- **Leaving a test part is confirmed.** QTI parts are delivered in sequence and cannot be
  re-entered, so when Next would leave the current part the shell first shows a "you cannot
  return" confirmation (`AssessmentPlayer.getForwardTransitionInfo()` reports the boundary). It
  names the part's questions that still owe an answer (`getTestPartBlockers()`, the same groups as
  the submit confirmation) with jumps, and holds Continue until they are answered — the core
  refuses the step as well.
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

### Practice delivery: check answer, attempts and comments

- **A practice item offers "Check answer" in the navigation bar.** When the active item is in
  an `individual` submission-mode part and more than one attempt is allowed (or the item is
  adaptive), the bar shows an
  item-level check control — distinct from the section's Next and the test's outlined
  Submit — with a polite "Attempt N of M" counter beside it. Activating it submits the
  item through the normal per-item path (`AssessmentPlayer.checkCurrentItem()`, attempt
  counted, backend result recorded, `countAttempt: true`) and STAYS on the item: the item
  body renders its integrated feedback from the computed outcomes, and any modal feedback
  the submission produced opens in the shell's dialog. While attempts remain, a non-adaptive
  item reopens writable from the attempt it just made (its attempt count and outcomes), so the
  candidate revises and checks again; adaptive items keep their engine-driven attempt loop.
  Once the attempts are used up the control disables with a localized explanation, the
  item closes, and moving on needs no further submission. `next()` re-submits an
  already-checked item only when the candidate changed their response; an unchanged
  response does not spend another attempt and moves where the backend decided for the check.
- **`showFeedback` with a single attempt delivers feedback on the move.** There is no
  check control (nothing could be re-attempted); Next submits as always and the captured
  item feedback opens over the question the candidate arrived on — the only way feedback
  is seen in a linear part, and the moment it is seen in a nonlinear one (returning to a
  submitted item re-renders its integrated feedback from the restored outcomes).
- **Simultaneous parts never offer the control.** QTI gives them no per-item submission;
  `getCheckAnswerState()` reports them as unavailable and the bar renders without it. A single
  attempt (whatever `showFeedback` says) keeps the submit-on-move delivery: showing feedback for
  a would-be non-final attempt needs an attempt left to spend.
- **`allowComment` shows a per-item comment disclosure.** A native `<details>` region
  ("Comments for the test team") with a labelled textarea sits above the navigation bar;
  the text lives in the session state (`itemComments`), so it autosaves, rides snapshots,
  and is sent as `SubmitResponsesRequest.comment` with the item's next submission.

### Completion screen and results summary

Finalization replaces the dead last item with a candidate-facing completion screen:
"You have finished the test" (its time-expired variant whenever the time ended the test — a
whole-test limit, or a scope expiry that left nothing open, whether the automatic submission, the
candidate's Submit after it failed, or a proctor's force-submit collected it; its proctor variant — "Your test was submitted by your proctor.", announced
assertively — after a force-submit, which also replaces a start screen it ended behind; its
already-submitted variant when a finalized session was restored), the
test's outcome-matched `testFeedback`, and — only when the host opts
in through the shell's `showResultsSummary` prop (the element's `show-results-summary`
attribute, off by default) — a per-question results summary from
`AssessmentPlayer.getResultsSummary()`: each delivered item's answered status plus the
backend's score when it returned one, under the finalized total. High-stakes hosts keep
control by leaving it off; `onSubmit`/`submit` always delivers the full results either
way. Focus moves to the completion heading like a navigation target, and the view is
token-styled and keyboard-clean down to 320px.

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
preconditions resolve in the backend, which returns the next eligible item as `nextItemIdentifier`;
a move without a backend decision applies the same rules in the player (see "Why a move without a
submission still applies branch rules and preconditions"), so "the immediate forward transition"
is the next item those rules deliver.

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
| Practice delivery | `getCheckAnswerState()`, `checkCurrentItem()`, `getLastItemFeedback()` / `clearLastItemFeedback()`, `setItemComment()` / `getItemComment()` | Build a check-answer control from the state (attempts, exhaustion), call `checkCurrentItem()` on activation and render `getLastItemFeedback()` in a modal; drive the comment disclosure from `getItemSessionInfo().canComment`. The built-in shell does all of this. | A custom candidate shell around the headless core |
| Completion / results | `getResultsSummary()`, the shell's `showResultsSummary` prop (`show-results-summary` attribute), `onComplete` / `submit` | Show the built-in completion screen (default) or your own; opt into the per-question summary only for deliveries where candidates may see scores. | High-stakes host keeps the summary off and renders results in its own UI |
| Begin gate / pause | `beginGate` config, `start()` / `hasStarted()`, `pause(reason?)` / `resume()` / `isPaused()` / `getPauseReason()`, `onPauseChange()` | Set `beginGate: true` (or the `begin-gate` attribute) to hold delivery behind the shell's start screen; call `pause(reason)` for proctor pauses. A restored pause is reported once at creation. | Gate delivery until the candidate begins; proctor controls |
| Proctor console | `submit({ force })`, `isFinalized()`, `getTimeState()`, `flushAutosave()`, `onFinalized()` (element: `submit({ force: true })`, `isPaused()`, `getPauseReason()`, `isFinalized()`, `getTimeState()`, `flushAutosave()`, `scope-time-expired`, `session-finalized`) | Read the clocks and the pause/terminal state, save the draft on demand, and force-submit a running test (`timing.submissionReason: 'proctor'`). | A proctor console supervising delivery |
| Persistence | `getState()` / `restoreState()` and `BackendAdapter.saveState()` | Autosave runs by default (see "Why the shell autosaves drafts"); set `autosave: false` (config/`autosave` attribute) or `canSaveState: false` on the adapter to persist yourself, then call `saveState`/`restoreState` on your own cadence; `flushAutosave()` covers page-hide when you keep it on. | Persist to a session table with an optional host storage fallback |

---

## Data model / contracts

Key types are in `packages/assessment-player/src/integration/api-contract.ts`. Invariants not obvious from the types:

- **`SecureTestPart.navigationMode` / `submissionMode`** are authoritative per part; top-level fields are compatibility fallbacks.
- **`SecureItemRef.itemXml`** must be pre-filtered by the server. For `candidate` role, `<correctResponse>` and `<responseProcessing>` must be absent. The client does not validate this; it trusts the server.
- **`AssessmentSessionState.itemResponses`** is keyed by item identifier, then by response variable identifier. The inner value type is `Record<string, ResponseValue>`. A missing outer key means the item has never been visited; an empty inner object means the item was visited but no response was entered.
- **`AssessmentSessionState.itemSessions`** contains serialized handoff values for inactive/restorable items. It never contains or represents a second live session. `getCurrentItemSession()` is the sole live reference and is not persistence data.
- **`AssessmentSessionState.branchDecisions`** carries the kept branching decision per item (see `nextItemIdentifier` below): item identifier → target, at most the freshest counted submission's. It is what makes a restored session land identically to the live one; backends that never store it just lose the kept decision across a resume.
- **`SubmitResponsesResponse.nextItemIdentifier`** is the server's branching decision. When present, the client must navigate to that item — on a candidate's move. A submission that stays on the item (a practice check, a counted end-attempt) keeps it, and the next move on from the item that submits nothing follows it; any later counted submission voids the kept decision (the outcomes it was decided on have moved), so stale testPart rules cannot redirect a nonlinear part. Leaving a simultaneous test part on Next commits the part's pending responses first and then follows the decision the flush returned for the part's last item — a target inside the part that is ending is rejected — while the end of the test never navigates (a decision returned for its own collection is kept on record and followed by the next `next()` only if the end does not complete), a decision that arrives after a scope expiry moved delivery is not followed, and no decision re-enters a test part already left. When absent — and for a move without any backend decision — the client moves to the next item the test's branch rules and preconditions deliver, evaluating them itself with the reference rules (for a test without any: `currentIndex + 1`). Servers that do not implement branching should omit this field entirely.
- **`SubmitResponsesResponse.updatedState`** carries the backend's scores and attempt records; it never moves the candidate. The client keeps its own `currentItemIdentifier` across the replacement (delivery moves through `nextItemIdentifier` only), so a stale backend position cannot redirect responses or the next snapshot.
- **`BackendAdapter.canSaveState`** (default `true`) is the autosave capability flag: the core debounces drafts through `saveState` unless the adapter reports `false` or the config disables autosave. Adapters that cannot store drafts must say so rather than silently accepting saves.
- **`BackendAdapter.requiresItemSession`** (default unset) declares a backend that scores from `SubmitResponsesRequest.itemSession`; the core then sends it on every submission whatever `sendItemSessionToBackend` says. The reference adapter declares it.
- **`SubmitTimingEvidence.submissionReason`** is `candidate` (default), `time-expired`, `proctor`, or `unreachable` — a question the end of the test collects as it stands because the candidate can no longer reach it although its skipping/validation control would refuse it.
- **`AssessmentSessionState.timing.savedAt`** is the client clock of the last autosave written into a snapshot; shells show it on the resume prompt. It is metadata, not an authority — the backend's own timestamps remain authoritative.
- **`SubmitResponsesRequest.countAttempt`** (default true) carries QTI `endAttempt`'s `countAttempt`: `false` marks a hint / "show me" submission that runs response processing without consuming an attempt. Backends must not count it toward `maxAttempts`, must not record it as the item's result, and must leave the attempt counter unchanged; the candidate continues and a later submission carries the final response.
- **Item feedback** (`getLastItemFeedback()`) is the shell's view of what an item-level submission produced: the candidate session's outcome-matched `modalFeedback` when the delivered item XML carries response processing, else the backend's `SubmitResponsesResponse.result.feedback` entries. It is gated by the resolved `showFeedback` and lasts until the shell dismisses it or the next submission replaces it; backends that deliver no candidate-side response processing must return `result.feedback` (or outcomes that drive integrated feedback) for candidates to see anything.
- **`getResultsSummary()`** is derived at finalization from the backend's `FinalizeAssessmentResponse` (`totalScore`, `maxScore`, per-item `itemScores`) plus each delivered item's answered status. It is presentation data for the opt-in completion summary, never a second scoring authority.
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

AC-8: canSkip false blocks submitting an unanswered item
  Given: itemSessionControl.allowSkipping is false, current item has no response
  When: next() is called
  Then: An error is thrown before submitCurrentItem is called
  When: submit() is called with another individual item left without a response
  Then: The call rejects with finalizeResponseRequired naming that item, and nothing is submitted

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

AC-17: A practice item checks in place and counts attempts
  Given: An individual testPart whose itemSessionControl sets showFeedback=true maxAttempts=2
         and a candidate response
  When: checkCurrentItem() is called
  Then: submitResponses runs with countAttempt true, the candidate stays on the item,
        getCheckAnswerState() reports 1 of 2 attempts used, getLastItemFeedback() carries the
        outcome-matched modal feedback, and the item session is writable again with the
        computed outcomes restored
  When: The candidate revises and checks again, then tries a third check
  Then: The second check records attempt 2; the third rejects with maxAttemptsReached;
        next() moves on with no further submission and the check control renders disabled

AC-18: Simultaneous parts and single-attempt items keep submit-on-move
  Given: A simultaneous testPart with showFeedback=true, and an individual part with
         showFeedback=false and a single attempt
  When: getCheckAnswerState() is read on their items
  Then: available is false with reason 'simultaneous' / 'feedbackOff'; no check control
        renders; next() still submits per-item in the individual part
  When: An individual part allows two attempts with showFeedback=false
  Then: The control is offered, and checking shows the item's feedback (QTI: feedback for
        every non-final attempt); after the last attempt showFeedback=false hides it again

AC-19: Submit-on-move feedback is visible on the transition
  Given: An individual part with showFeedback=true and maxAttempts=1 (or unset) over two items
  When: The candidate answers item 1 and calls next()
  Then: The item is submitted before the move and getLastItemFeedback() carries its feedback;
        a shell that renders it (the built-in one does) shows it over the item they arrived on

AC-20: The completion screen reports the end and (opt-in) the results
  Given: An assessment the candidate submits (or a whole-test expiry auto-submits)
  When: finalization completes
  Then: The shell replaces delivery with "You have finished the test" (the time-expired
        variant after an auto-finalized expiry), renders the test's outcome-matched
        testFeedback, and — only with showResultsSummary — lists every delivered item's
        status and the backend's per-item score under the finalized total

AC-21: The end of the test never navigates
  Given: An individual part q1..q3 whose backend returns nextItemIdentifier 'q2' for q1
  When: submit() — or a whole-test expiry's auto-finalize, or submit({ force: true }) — runs from q1
  Then: No item change fires; the final snapshot records q1 as current and q2 as not visited
  When: finalizeAssessment fails
  Then: The candidate is still on q1, a retry finalizes, and a next() follows the kept decision

AC-22: A scope expiry's move is not undone by an in-flight submission
  Given: A section limit that expires while next() submits q1, moving delivery into the next part
  When: The submission then returns nextItemIdentifier 'q2' (in the part delivery left)
  Then: Delivery stays where the expiry moved it, and getState() records that item as current

AC-23: Only reachable questions hold the way out of a part
  Given: A restored session on q2 of a linear part with q1 behind it unanswered (allowSkipping=false)
  When: The candidate answers q2 and calls next()
  Then: getTestPartBlockers() is empty, delivery enters the next part, and the end of the test
        collects q1 with submissionReason 'unreachable'

AC-24: An ending the time forced is an expiry ending
  Given: A whole-test expiry whose automatic finalize failed, or a scope expiry that left nothing open
  When: The candidate (or a proctor) submits
  Then: endReason is 'expiry' and the completion screen shows its time-expired variant

AC-25: A practice check's branch decision is followed when the candidate moves on unchanged
  Given: A linear individual part q1, q2 (preCondition false), q3 with maxAttempts 2
  When: The candidate checks q1, then calls next() without changing the response
  Then: Delivery lands on q3, q1 is not submitted again, and getForwardTransitionInfo() reported
        nextIndex 2 before the move; a changed response re-submits and follows the fresh decision

AC-25a: A kept branch decision survives a save/restore and cannot go stale
  Given: A checked q1 whose rule reads the test score, and a nonlinear part whose testPart rule
         reads the test score with its last item checked
  When: getState() is restored into a fresh player and next() runs; or, in the nonlinear part,
        another item is submitted after the check and the candidate returns and moves on unchanged
  Then: The restored session lands exactly where the live one would (the decision the snapshot
        carries is followed, no extra attempt); and the nonlinear move re-evaluates the rule on
        the moved outcomes instead of following the stale decision

AC-25b: Leaving a simultaneous part follows the decision its flush returns for the last item
  Given: A nonlinear simultaneous part whose testPart rule reads the last item's score, followed
        by another part and a part beyond it
  When: The candidate answers the part and calls next() from its last item
  Then: The part's pending responses go out first and delivery lands on the rule's target (an
        EXIT_TEST decision finalizes exactly once without navigating); a following part whose
        precondition is false is skipped; a failed submission keeps the candidate in the part and
        the retry lands on the target without re-submitting the items the backend already accepted

AC-26: A test part whose precondition fails is never entered
  Given: A nonlinear part [q1], a part [q2] whose preCondition is false, a part [q3]
  When: navigateTo(1) is called from q1
  Then: It rejects with navigationNotAllowed, isNavigationTargetLegal(1) is false, and the
        forward step (next(), navigateTo(2)) lands on q3; with the precondition true, navigateTo(1)
        enters q2

AC-27: A checked item is reported final once the test ends
  Given: An individual part c1, c2 with maxAttempts 2
  When: The candidate checks c1, moves on unchanged, answers c2 and submits
  Then: The result report built from getState({ includeItemSessions: true }) and from the
        snapshot saved before finalize reports c1 and c2 'final'; a second check of c1 would
        have run response processing with numAttempts 2
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

AC-A10b: A pause closes covered dialogs and the host page stays operable
  Given: The section display settings dialog (or any dialog inside the content) is open
  When: The proctor pauses
  Then: Every dialog in the shell closes, `pie-qti-close-transient-ui` fires on document,
        the pause heading takes focus, the pause is announced assertively, and a Tab press
        reaches the host page's own controls outside the shell

AC-A10: Scope expiry is announced and focus follows delivery
  Given: A section limit expired while items remain outside it
  When: Delivery moves to the next unlocked item
  Then: An acknowledge dialog says the scope's time is over and the candidate is moving
        on; after it closes, focus moves to the question and "Question X of Y" is
        announced; the start screen and expiry dialog pass axe AA

AC-A11: The check control, its counter, the feedback dialog and the completion screen
        are accessible
  Given: A practice item (showFeedback, maxAttempts 2) with modal feedback, and the
         assessment then submitted
  When: The candidate checks the answer, dismisses the feedback dialog and finishes
  Then: The counter is a polite live region ("Attempt 2 of 2", then the used-up
        explanation), the disabled control keeps its accessible name with the
        explanation beside it, the feedback dialog moves focus to its title and
        returns it on close, and the completion screen moves focus to its heading;
        all pass axe AA at desktop and 320px widths
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
- Shell: `packages/assessment-player/src/components/` (`AssessmentShell`, `NavigationBar`, `AssessmentHeader`, `AssessmentDialog`, `ReviewScreen`, `SectionMenu`, `CompletionScreen`); review/answered-state core helpers: `packages/assessment-player/src/core/reviewState.ts`; section layouts and the base layer: `packages/section-player/src/components/` (`SplitPaneResizer`, `SectionPlayerSplitPane`, `SectionPlayerVertical`, `PlayerBaseStyles`)
- API contract: `packages/assessment-player/src/integration/api-contract.ts`
- Adjacent PRDs: `docs/prds/architecture/item-player.md`, `docs/prds/architecture/response-processing.md`
- Existing docs: `packages/assessment-player/BACKEND-INTEGRATION.md`, `packages/assessment-player/EXTENSIBILITY.md`
