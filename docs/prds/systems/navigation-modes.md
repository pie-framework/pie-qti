# PRD: Navigation Modes and Scoped Timing

<!--
  Status: current
  Type: system
  Packages: @pie-qti/assessment-player
  Last reviewed: 2026-07-13
-->

**Status:** current
**Type:** system
**Packages:** `@pie-qti/assessment-player`
**Last reviewed:** 2026-07-13

---

## Summary

Assessment delivery is controlled by the QTI modes declared on each `testPart` and by time limits
declared at assessment, test-part, section, and item-reference scope.

`AssessmentPlayer` flattens the delivered section tree into an ordered item list, but each flat item
retains its owning `SecureTestPart` and `SecureSection`. This lets the player change navigation and
submission behavior at test-part boundaries while keeping a simple item index for rendering and
save/resume.

- `linear` navigation is one-way: the candidate may remain on the current item or advance to the
  immediately following item, but may not skip ahead or return to an earlier item.
- `nonlinear` navigation permits arbitrary movement within the current test part, subject to item
  session controls.
- Test parts themselves are always entered in document order. A candidate may cross into the next
  part only through the adjacent next item and may not return to a completed part.
- `individual` submission is applied from the current test part when `next()` is used.
- `simultaneous` responses are retained until final submission. Mixed-mode test-part finalization is
  not yet complete; see Remaining gaps.
- `TimeManager` maintains independent cumulative clocks for the assessment and active test part,
  section, and item. Those clocks and their active scope identifiers survive save/restore.

The client provides navigation UX, minimum-time guards, countdown events, and timing evidence. A
production backend remains authoritative for allowed transitions, deadlines, scoring, and session
state.

---

## Background and rationale

### Modes belong to `testPart`

QTI places `navigationMode` and `submissionMode` on `testPart`, so a multi-part assessment can use
different delivery policies in different parts. `SecureTestPart` preserves both values. The
top-level fields on `SecureAssessment` remain as compatibility fallbacks and are populated from the
first parsed test part; they are not the authoritative source for later parts.

The standalone `NavigationManager` models one navigation mode over one item range. Multi-part
orchestration is therefore handled by `AssessmentPlayer.canNavigateByTestPart()`, which reads the
mode retained on the current flat item.

### Linear delivery is one-way

In QTI linear delivery, items are presented in sequence and an item cannot be revisited after the
candidate moves on. The player consequently exposes no Previous action in a linear part, rejects a
backward `navigateTo()`, and rejects a forward jump larger than one item. `allowReview` is relevant
to nonlinear review; it does not re-enable backtracking in linear mode.

This is an assessment-validity constraint. A UI that only hides the Previous button is insufficient,
so the same rule is checked in the imperative navigation API.

### Flat navigation with retained scope

A flat item index keeps next/previous operations and persistence simple. Unlike the earlier flat-list
model, however, the current entries retain their test part and direct containing section. This is
enough to switch modes at part boundaries and to accumulate clocks for the active scopes.

The trade-off is that a flat item currently retains only its direct containing section, not the full
ancestor-section path. Nested ancestor section time limits therefore remain a gap.

### Independent clocks, authoritative deadlines

Time spent at one scope is not interchangeable with time spent at another. For example, returning to
an item in nonlinear mode resumes that item's cumulative clock while the enclosing section and test
part continue from their own accumulated values. `TimeManager` checkpoints a scope whenever the
active identifier changes and restores it when that scope becomes active again.

The timer uses client elapsed time to power warnings, display, minimum-time guards, and submission
evidence. Client code can be modified or suspended, so production backends must validate deadlines
against server-owned session timestamps. The bundled `ReferenceBackendAdapter` demonstrates this by
rejecting hard-limit submissions from assessment elapsed time or submitted timing evidence.

---

## QTI specification alignment

- **Spec versions:** QTI 2.1, QTI 2.2, QTI 3.0
- **Relevant concepts:** `assessmentTest`, `testPart`, `assessmentSection`,
  `assessmentItemRef`, `navigationMode`, `submissionMode`, `timeLimits`, and
  `itemSessionControl`

### Current support

| QTI concept | Current status | Implementation notes |
|---|---|---|
| `testPart.navigationMode=linear` | Implemented | Current item or immediate next item only; no backward navigation |
| `testPart.navigationMode=nonlinear` | Implemented | Arbitrary in-bounds navigation within the current test part |
| Sequential test-part delivery | Implemented | Only the adjacent first item of the next part may be entered; completed parts cannot be revisited |
| Per-test-part `submissionMode=individual` | Implemented during `next()` | The current item is submitted before advancing; backend branching may choose the next item |
| Per-test-part `submissionMode=simultaneous` | Partial | Navigation defers item submission, but flushing is assessment-final rather than test-part-final |
| `timeLimits.minTime` | Implemented with limitations | Item transition, section/test-part exit, and final assessment submission are guarded; see Remaining gaps |
| `timeLimits.maxTime` | Implemented as client tracking and backend evidence | Independent assessment/test-part/section/item clocks; nearest active deadline drives countdown events |
| `timeLimits.allowLateSubmission` | Partial | Used for expiry callbacks/evidence; the default shell does not itself block or auto-submit |
| Save/resume of timing | Implemented | Total, item, section, and test-part elapsed milliseconds plus active identifiers and pause state are persisted |
| PNP extended time | Implemented for `maxTime` | Finite multipliers apply to every active max-time scope; `Infinity` removes those client limits |
| `itemSessionControl.allowSkipping` | Partial | `next()` blocks an unanswered item when false; direct nonlinear navigation can bypass that path |
| `itemSessionControl.allowReview` | Partial | Consulted for nonlinear review through `AssessmentPlayer`; the standalone `NavigationManager` has no session-control policy |

### Compatibility fields

`SecureAssessment.navigationMode` and `SecureAssessment.submissionMode` are retained for callers that
construct the delivery model directly or omit per-part values. XML ingestion also sets them from the
first test part. New code must treat `SecureTestPart.navigationMode` and
`SecureTestPart.submissionMode` as authoritative for the active part.

---

## Functional requirements

- **FR-1:** In a linear test part, navigation must allow only the current item or the immediately
  following item. It must reject backward navigation and forward skips.
- **FR-2:** In a nonlinear test part, navigation may target any in-bounds item in that same part,
  subject to the applicable item-session controls and minimum-time guards.
- **FR-3:** Test parts must be delivered in order. Navigation may cross a part boundary only from the
  final item of one part to the adjacent first item of the next part, and may not return to an earlier
  part.
- **FR-4:** Navigation state must set `canPrevious=false` throughout a linear part and at a test-part
  boundary. In a nonlinear part, Previous is available only when the preceding item is reviewable.
- **FR-5:** In an individual-submission part, `next()` must submit the current item before changing
  the index. A backend `nextItemIdentifier` decision takes precedence over the adjacent item.
- **FR-6:** In a simultaneous-submission part, normal navigation must retain responses without
  calling `submitResponses()` for each move.
- **FR-7:** `next()` must prevent leaving an unanswered item when the effective
  `itemSessionControl.allowSkipping` is false.
- **FR-8:** Effective item-session controls must use section values over test-part values when both
  are declared.
- **FR-9:** `TimeManager` must accumulate assessment, test-part, section, and item elapsed time
  independently, including across nonlinear revisits.
- **FR-10:** Leaving an item must enforce that item's `minTime`. Crossing a section or test-part
  boundary must additionally enforce the minimum for the scope being left. Final assessment
  submission must enforce all active minimum-time scopes, including the assessment.
- **FR-11:** Remaining time must be calculated from the nearest active hard or allow-late max-time
  among assessment, test part, direct section, and item.
- **FR-12:** When any active hard max-time expires, the timer must stop ticks and emit one generic
  expiry notification to the host. An allow-late expiry must remain queryable as expired without
  stopping the timer; a later hard expiry at any parent scope must still take precedence.
- **FR-13:** Submitted timing evidence must identify the effective limiting scope, elapsed
  milliseconds, limit seconds, expiry state, and `allowLateSubmission` value.
- **FR-14:** A state snapshot must persist total time, per-item time, per-section time, per-test-part
  time, active scope identifiers, and pause state. Restore must continue each active clock from the
  saved elapsed values without counting offline time.
- **FR-15:** Warning and tick events must reflect the nearest active max-time. Warnings must be
  emitted at most once per active scope during one runtime session.
- **FR-16:** `NavigationBar` must use the semantic `disabled` attribute for unavailable Previous and
  Next actions. `SectionMenu` navigation must still pass through `AssessmentPlayer.navigateTo()` so
  mode and minimum-time checks cannot be bypassed by the UI.

---

## Non-functional requirements

- **Accessibility:** Previous and Next must remain keyboard operable when enabled and be removed from
  interaction through the native `disabled` attribute when unavailable. `AssessmentTimer`, when a
  host mounts it, must expose a timer label and announce warning/expiry changes without announcing
  every one-second tick.
- **Performance:** Navigation checks are constant time. Timing uses one interval and constant-time
  maps keyed by scope identifier; it must not create one interval per scope.
- **Persistence:** Calling `getState()` must checkpoint active clocks without losing time or
  restarting them from zero. State objects returned to callers must not share mutable timing maps
  with the live manager.
- **Security:** Client timing is evidence, not authority. Backends must validate session deadlines,
  transitions, and late-submission policy independently.
- **Cross-platform:** Navigation controls must remain keyboard and touch operable on desktop and
  mobile layouts.
- **Internationalization:** Navigation and optional timer strings must use the configured i18n
  provider, with English fallback strings where the component contract permits them.

---

## Design decisions

### Linear mode prohibits backtracking

**Decision:** Linear navigation accepts `targetIndex === currentIndex` and
`targetIndex === currentIndex + 1` only.

**Rationale:** This directly models QTI's one-way linear delivery and prevents a host from restoring
backtracking merely by calling an imperative API instead of the standard buttons.

**Consequences:** `allowReview=true` does not make a linear part reviewable. Authors who require
review must choose nonlinear navigation.

### Test-part policy is enforced above `NavigationManager`

**Decision:** Keep `NavigationManager` as a reusable single-mode primitive and enforce part-aware
navigation in `AssessmentPlayer.canNavigateByTestPart()`.

**Rationale:** The player already owns the flattened entries and their part boundaries. Rebuilding
the manager whenever the active part changes would add state churn without improving the public
navigation result.

**Consequences:** Direct consumers of `NavigationManager` receive only single-range behavior. Hosts
must use `AssessmentPlayer` for correct multi-part delivery.

### Scope clocks accumulate independently

**Decision:** Store elapsed maps for item, section, and test part alongside total assessment elapsed
time, and checkpoint a clock when its active identifier changes.

**Rationale:** Nonlinear revisits and save/resume require cumulative per-scope values. Deriving all
scope durations from total time after the fact is ambiguous when a candidate moves between sections
or parts.

**Consequences:** Timing persistence includes active scope identifiers and pause state. Nested
ancestor sections require a future scope-path model rather than the current single active section.

### Expiry is a host event and backend decision

**Decision:** `TimeManager` emits warnings, ticks, and expiry; submission carries timing evidence;
the backend decides whether a response is accepted. The default shell does not silently finalize an
assessment when a client timer expires.

**Rationale:** Auto-submission can lose unsaved interaction state and a browser clock cannot be a
security boundary. Hosts need explicit policy for warning UI, grace periods, reconnects, and
proctor-controlled sessions.

**Consequences:** Deployments that require a visible timer or hard UI lock must mount
`AssessmentTimer` or subscribe to the timing API and implement that policy. The backend must still
enforce the actual deadline.

---

## Acceptance criteria

### Navigation and submission

**AC-1: Linear mode is one-way**
```
Given: A five-item linear test part, currently on item index 2
When: The candidate or host attempts to navigate to index 1
Then: Navigation is rejected and the current index remains 2
And: The Previous button is disabled
When: The host attempts to navigate to index 4
Then: Navigation is rejected
When: The host navigates to index 3
Then: Navigation succeeds
```

**AC-2: Nonlinear mode permits review within a part**
```
Given: A nonlinear test part with review allowed, currently on index 3
When: The candidate selects index 0 in the section menu
Then: Index 0 is displayed
When: The candidate selects any other in-bounds item in the same part
Then: That item is displayed
```

**AC-3: Modes switch at a test-part boundary**
```
Given: A linear part containing item 0 followed by a nonlinear part containing items 1 and 2
When: The candidate advances from item 0
Then: Item 1 is displayed
And: The candidate may navigate between items 1 and 2
But: Navigation from either item back to item 0 is rejected
```

**AC-4: Individual submission is scoped to the active part**
```
Given: The current test part has submissionMode="individual"
And: The current item contains a response
When: next() is invoked
Then: submitResponses() receives that item before the displayed index changes
And: A backend nextItemIdentifier is followed instead of the ordinary adjacent item
```

**AC-5: Simultaneous navigation does not submit per move**
```
Given: The current test part has submissionMode="simultaneous"
When: The candidate changes items within that part
Then: Responses remain in assessment state
And: submitResponses() is not called by the navigation action
```

**AC-6: Skipping is enforced on Next**
```
Given: The current section has allowSkipping=false
And: The current item has no non-empty response
When: next() is invoked
Then: Navigation is rejected with an actionable error
And: The current item remains displayed
```

### Scoped timing

**AC-7: Scope clocks accumulate independently**
```
Given: The candidate spends 1 second on item A and then 2 seconds on item B in the same section
Then: Item A reports 1 second and item B reports 2 seconds
And: Their section and test part each report 3 seconds
When: The candidate moves to another section for 0.5 seconds
Then: The first section remains at 3 seconds
And: The second section reports 0.5 seconds
And: The test part reports 3.5 seconds
```

**AC-8: Minimum time is checked when its scope is left**
```
Given: The current item has minTime=10 seconds
When: The candidate attempts to navigate away after 7 seconds
Then: Navigation is rejected with the remaining seconds
Given: The current section or test part has minTime=10 seconds
When: The candidate attempts to cross that scope boundary after 7 seconds
Then: Navigation is rejected with the remaining seconds
```

**AC-9: Assessment minimum time is checked at final submission**
```
Given: The assessment has minTime=60 seconds
When: submit() is invoked after 45 seconds
Then: Submission is rejected with the remaining seconds
When: submit() is invoked after at least 60 seconds
Then: The minimum-time guard permits submission to continue
```

**AC-10: The nearest active max-time drives remaining time**
```
Given: Active maxTime values of 60 seconds for the assessment, 30 for the test part,
       20 for the section, and 5 for the item
When: 2 seconds elapse
Then: getRemainingTime() reports 3 seconds
```

**AC-11: A hard parent limit is not masked by an allow-late child**
```
Given: An assessment maxTime of 10 seconds with allowLateSubmission=false
And: An item maxTime of 5 seconds with allowLateSubmission=true
When: 6 seconds have elapsed
Then: The item expiry is allow-late
When: 11 total seconds have elapsed
Then: The active timing state is a hard expiry
And: The reference backend rejects a response submitted after that deadline
```

**AC-12: Timing state round-trips**
```
Given: A saved session with 1.5 seconds accumulated in the active assessment, test part,
       section, and item clocks
When: The session is restored and remains active for another 0.5 seconds
Then: Each restored active clock reports 2 seconds
And: Time while the session was not active is not added
```

**AC-13: Pause freezes every active scope**
```
Given: Assessment, test-part, section, and item clocks are active
When: Timing is paused for 10 seconds
Then: None of the four elapsed values increases during the pause
When: Timing resumes
Then: All active clocks continue from their saved values
```

**AC-14: Submission includes limiting-scope evidence**
```
Given: The item maxTime is the shortest active limit
When: That item is submitted
Then: The backend request identifies scope="item"
And: It includes elapsedMs, limitSeconds, expired, and allowLateSubmission
```

**AC-15: No max-time still tracks elapsed time**
```
Given: No active scope declares maxTime
When: The candidate interacts for 5 seconds
Then: Assessment and active scope elapsed clocks report 5 seconds
And: No warning or expiry callback is emitted
```

---

## Remaining gaps

- [ ] **Mixed submission modes are not finalized per test part.** `next()` correctly reads the
  current part's `submissionMode`, but `submit()` still chooses its whole-assessment flush path from
  the top-level compatibility field. A simultaneous part is not flushed when its boundary is
  crossed, and an assessment that mixes individual and simultaneous parts is therefore not fully
  modeled.

- [ ] **Test-part end lifecycle is implicit.** Crossing from one part to the next is an adjacent
  item transition; there is no explicit part-end confirmation, part-scoped simultaneous processing,
  or part result state.

- [ ] **Nested ancestor section clocks are not represented.** A flat item retains its direct
  containing section only. A `timeLimits` declaration on an ancestor of a nested section is not an
  independently active clock and is not checked when that ancestor is exited.

- [ ] **Default-shell expiry policy is incomplete.** `AssessmentTimer` and timing subscriptions are
  available, but `AssessmentShell` does not mount the timer, disable navigation, block Submit, or
  auto-submit on expiry. `allowLateSubmission` affects timer callbacks and evidence rather than a
  built-in shell policy.

- [ ] **The player-level remaining-time API collapses “unlimited” to zero.** `TimeManager` returns
  `null` when no max-time is active, but `AssessmentPlayer.getRemainingTime()` converts that to `0`.
  Hosts and `AssessmentTimer` cannot distinguish an untimed assessment from an expired countdown
  through that method alone.

- [ ] **Timing evidence describes only one effective max-time scope.** The submit contract carries
  the shortest active limiting scope, not all active scope clocks and limits. A production backend
  must use server-owned assessment structure and timestamps to validate every parent deadline.

- [ ] **Direct navigation bypasses the `allowSkipping` guard.** `next()` calls
  `canNavigateAway()`, but an imperative `navigateTo()` or section-menu jump in nonlinear mode does
  not check whether the current item may be skipped.

- [ ] **Parent minimums are not checked by `submitCurrentItem()`.** That method checks item
  `minTime`; section, test-part, and assessment minimums are checked on scope exit or final
  `submit()`. Hosts that expose direct item submission must not treat it as part completion.

- [ ] **Timer event history is not persisted.** Elapsed clocks and active identifiers survive
  restore, but per-scope warning/expiration-emitted sets do not. A restored session can therefore
  announce a threshold again.

- [ ] **Top-level mode fields remain redundant.** They are needed for compatibility today, but they
  make it possible for hand-built `SecureAssessment` values to disagree with their test parts. The
  API should eventually make the per-part fields required and deprecate the assessment-level mode
  fields.

---

## Related

- Implementation: `packages/assessment-player/src/core/AssessmentPlayer.ts`
- Implementation: `packages/assessment-player/src/core/NavigationManager.ts`
- Implementation: `packages/assessment-player/src/core/TimeManager.ts`
- Implementation: `packages/assessment-player/src/core/ItemSessionController.ts`
- UI: `packages/assessment-player/src/components/NavigationBar.svelte`
- UI: `packages/assessment-player/src/components/SectionMenu.svelte`
- Optional timer UI: `packages/assessment-player/src/components/AssessmentTimer.svelte`
- Delivery API: `packages/assessment-player/src/integration/api-contract.ts`
- Reference backend: `packages/assessment-player/src/integration/ReferenceBackendAdapter.ts`
- Adjacent PRD: `docs/prds/architecture/assessment-player.md`
- Adjacent PRD: `docs/prds/systems/accessibility.md`
- Spec-gap tracker: `docs/SPEC-GAPS-PLAN.md`
