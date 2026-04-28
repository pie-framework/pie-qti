# PRD: Navigation Modes System

<!--
  Status: draft
  Type: system
  Packages: @pie-qti/assessment-player
  Last reviewed: 2026-04-27
-->

**Status:** draft
**Type:** system
**Packages:** `@pie-qti/assessment-player`
**Last reviewed:** 2026-04-27

---

## Summary

The navigation modes system controls how a candidate moves through items in a QTI `assessmentTest` and when their responses are transmitted to the backend for scoring. It implements two orthogonal QTI concepts: `navigationMode` (`linear` or `nonlinear`), which governs which items a candidate may visit and in what order, and `submissionMode` (`individual` or `simultaneous`), which governs when collected responses are sent to the backend. These modes are represented in `SecureAssessment` (the client-safe assessment structure returned by `BackendAdapter.initSession`), enforced by `NavigationManager`, and surfaced to candidates through `NavigationBar` and `SectionMenu`. A subset of `itemSessionControl` attributes — notably `allowSkipping`, `allowReview`, and `showFeedback` — interact with these modes and are currently treated as UI hints rather than hard enforcement boundaries.

---

## Background and rationale

### QTI navigation as a test-design contract

Navigation and submission modes are not implementation details; they are part of the test design that an assessment author chooses when constructing a `testPart`. A K-12 summative assessment that uses `linear` mode is making a deliberate pedagogical choice: candidates must engage with each item in the intended sequence before seeing later items. This is common in reading passages where the passage context is introduced sequentially, or in math tests where later items assume earlier work was not skipped.

`nonlinear` mode gives the candidate control over pacing and review, which is appropriate for timed benchmark tests where a candidate who quickly solves easy items should be able to return to hard ones before time expires.

Getting these modes wrong in the player — for example, allowing skipping in a `linear` assessment — is a test-validity problem, not merely a UI bug.

### Why `linear` allows backtracking

A common misconception is that `linear` mode means "no back button." The QTI 2.2 spec is precise: `linear` constrains *forward* navigation only (items must be attempted in order). Reviewing previously-visited items is explicitly permitted. The `NavigationManager.canNavigateTo(targetIndex, currentIndex)` implementation reflects this: `targetIndex <= currentIndex` always returns `true` in linear mode, while `targetIndex > currentIndex + 1` always returns `false`. Removing backward navigation from a `linear` assessment would be a spec violation and would harm candidates who need to correct an earlier answer after reading a later question for context.

### Why submission mode matters for scoring and UX

`submissionMode` determines the temporal relationship between candidate interaction and backend scoring:

- In `individual` mode, each time the candidate navigates away from an item, `BackendAdapter.submitResponses()` is called before the index advances. The backend scores the response immediately and may return feedback that is shown before the next item appears. It may also return a `nextItemIdentifier` to drive branching.
- In `simultaneous` mode, responses are accumulated on the client throughout the test part. `BackendAdapter.submitResponses()` is only called during the final `submit()` call. No per-item feedback is possible mid-test, and branching based on individual item responses cannot occur.

For K-12 standardized assessments, `simultaneous` mode is the norm: it prevents candidates from seeing whether their answers are correct before completing all items, preserving the integrity of the full-test score. `individual` mode is better suited to practice tests, adaptive diagnostics, or formative assessments where immediate feedback is desirable.

### Client-side timer as UX, not security

Time limits (`timeLimits.maxTime`) are enforced client-side by `TimeManager`. The intent is to give the candidate an accurate countdown and to block the UI submission path when the clock reaches zero (unless `allowLateSubmission` is true). However, a malicious or network-disrupted client can bypass the timer. The backend is the authoritative deadline enforcer. This is called out explicitly in the design decisions below.

### Why section-level navigation is not currently enforced

The QTI spec defines `assessmentSection` as a structural container that can carry its own `required` flag, ordering rules, and — in theory — per-section navigation constraints. The current `NavigationManager` operates on a flat `FlatItem[]` array: all items from all sections across all test parts are indexed 0..N. Sections are a UI concern only (visible in the `SectionMenu`), not a navigation enforcement boundary. This was a deliberate simplification to reduce state-machine complexity; the trade-off is documented as gap G-05-nav (see Open questions).

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, QTI 2.2
- **Spec section(s):** §2.1 (assessmentTest, testPart, assessmentSection), §2.2 (timeLimits), §2.3 (itemSessionControl)

### Supported attributes

| QTI concept | Support level | Notes |
|---|---|---|
| `testPart.navigationMode` (`linear` / `nonlinear`) | Full | Enforced by `NavigationManager` |
| `testPart.submissionMode` (`individual` / `simultaneous`) | Full | Drives when `submitResponses` is called |
| `timeLimits.maxTime` (assessment level) | Full | `TimeManager` countdown; client-side only |
| `timeLimits.allowLateSubmission` | Full | `TimeManager.allowsLateSubmission()` |
| `timeLimits.minTime` | Declared (type only) | Not enforced; UI does not block early navigation |
| `itemSessionControl.maxAttempts` | UI hint | Tracked; enforcement is backend-authoritative |
| `itemSessionControl.allowSkipping` | UI hint | Declared in `SecureTestPart`; not enforced by `NavigationManager` |
| `itemSessionControl.allowReview` | UI hint | `canPrevious` gated via `ItemSessionController.canReview()`; `allowReview=false` is not fully enforced |
| `itemSessionControl.showFeedback` | UI hint | Partially implemented; see open questions |
| `itemSessionControl.validateResponses` | UI hint | Declared; not enforced |

### Deliberately omitted attributes

- `testPart.timeLimits` and `assessmentSection.timeLimits` — only assessment-level time limits are enforced client-side. Part- and section-level limits require server enforcement.
- `assessmentSection.required` — sections marked `required=true` have no enforcement at the navigation layer. The flat-item-list design decision (see below) is the reason.
- `assessmentSection.ordering` and `assessmentSection.selection` — resolved server-side before the client receives the item list.
- `branchRule`, `preCondition` — branching is server-driven via `SubmitResponsesResponse.nextItemIdentifier`.

### Known divergences from spec

- **`allowSkipping` not enforced (navigation gap):** The spec says that when `allowSkipping=false`, a candidate must not be able to advance to the next item without providing a response. `NavigationManager.canNavigateTo(currentIndex + 1, currentIndex)` always returns `true` for the immediately next item regardless of `allowSkipping`. The UI does not currently prevent the Next button from being activated on an empty response. See Open questions.
- **`allowReview` not fully enforced:** `canPrevious()` in `NavigationManager` returns `true` for any `currentIndex > 0` without consulting `allowReview`. The `AssessmentPlayer.getNavigationState()` method does gate `canPrevious` through `ItemSessionController.canReview()`, but `NavigationManager` itself is unaware of this constraint. The enforcement therefore lives one layer above `NavigationManager` and can be bypassed by callers that call `NavigationManager` directly. See Open questions.
- **Navigation mode is a top-level field, not per-testPart:** QTI places `navigationMode` on `testPart`. `SecureAssessment` exposes it as a single top-level `navigationMode` field. Multi-part assessments with different navigation modes per part will use only the top-level value. See design decision below.

---

## Functional requirements

- **FR-1:** In `linear` mode, `NavigationManager.canNavigateTo(targetIndex, currentIndex)` must return `true` if `targetIndex <= currentIndex` (any previously visited or current position) or `targetIndex === currentIndex + 1` (the immediately next item). It must return `false` for any `targetIndex > currentIndex + 1`.
- **FR-2:** In `nonlinear` mode, `NavigationManager.canNavigateTo(targetIndex, currentIndex)` must return `true` for any in-bounds index.
- **FR-3:** `NavigationManager.canNext(currentIndex)` must return `false` only when `currentIndex` is the last item index.
- **FR-4:** `NavigationManager.canPrevious(currentIndex)` must return `false` only when `currentIndex` is zero.
- **FR-5:** `NavigationManager.markVisited(index)` must record the index such that subsequent `isVisited(index)` calls return `true`.
- **FR-6:** In `individual` submission mode, the assessment player must call `BackendAdapter.submitResponses()` for the current item before advancing the navigation index when `next()` is called.
- **FR-7:** In `simultaneous` submission mode, the assessment player must not call `BackendAdapter.submitResponses()` during navigation. It must call `submitResponses()` for all unsubmitted items during the final `submit()` invocation, in item-index order.
- **FR-8:** When `timeLimits.maxTime` is set, `TimeManager` must start the countdown immediately on construction, fire `onWarning` at the configured warning threshold, and fire `onExpired` when the countdown reaches zero.
- **FR-9:** When `allowLateSubmission` is `false` and the timer has expired, the UI must prevent submission. When `allowLateSubmission` is `true`, submission must remain possible after expiry.
- **FR-10:** `NavigationBar` must disable the Previous button (`disabled` attribute) when `navState.canPrevious` is `false`. It must disable the Next button when `navState.canNext` is `false`.
- **FR-11:** In `nonlinear` mode, `SectionMenu` must render a list of all visible sections and call `onSectionSelect` when a section entry is activated.
- **FR-12:** `NavigationManager.restoreState(visitedItems)` must populate the visited-items set from a previously persisted index array, so that post-restore navigation decisions correctly reflect which items were already visited.
- **FR-13:** `NavigationManager.reset()` must clear the visited-items set to support assessment retake scenarios.
- **FR-14:** `NavigationManager.getVisitedItems()` must return the visited indices in ascending order.

---

## Non-functional requirements

- **Accessibility:** The Previous and Next buttons in `NavigationBar` must be keyboard-operable with no mouse dependency. The `disabled` HTML attribute (not just visual styling) must be set when a button is inactive, so that screen readers announce it as disabled and keyboard users cannot activate it. The progress label ("Question N of M") must be readable by screen readers; see the accessibility PRD (`docs/prds/systems/accessibility.md`) for the full requirement set on `NavigationBar`.
- **Performance:** `NavigationManager` operations (`canNavigateTo`, `canNext`, `canPrevious`, `isVisited`) are O(1) or O(log n). No scanning of the full item list at navigation time. `TimeManager` uses a single `setInterval` (1-second tick); no per-item timers.
- **Cross-platform:** Navigation buttons must meet the 44×44 CSS pixel touch-target minimum on a 375px-wide viewport. The `SectionMenu` dropdown must be fully usable via touch, including dismissal by tapping the backdrop. The responsive CSS in `NavigationBar` stacks buttons vertically on narrow viewports; this must not cause overlapping controls.
- **Security:** Timer enforcement is client-side only. The backend must maintain its own deadline; the client timer is a UX feedback mechanism. `itemSessionControl` values received from the server must be treated as UI hints, not security boundaries. The server must reject submissions that violate `allowSkipping=false` or `maxAttempts` at the API layer.
- **i18n:** All visible strings in `NavigationBar` and `SectionMenu` must be sourced from the `@pie-qti/i18n` provider when one is supplied, with hardcoded English strings as `??` fallbacks only. Affected keys: `common.previous`, `common.next`, `assessment.navigation.submit`, `assessment.question`, `assessment.section`, `assessment.sections.title`, `assessment.sectionDefault`, `assessment.closeMenu`.

---

## Design decisions

### Linear mode allows backtracking

**Decision:** `NavigationManager.canNavigateTo(targetIndex, currentIndex)` returns `true` for any `targetIndex <= currentIndex` in linear mode, permitting the candidate to return to any previously visited item.

**Rationale:** QTI 2.2 §2.1 specifies that `navigationMode=linear` requires items to be "presented in turn" without permitting the candidate to "navigate back to a previously attempted item" as a *forward* skip. It does not prohibit backward review of visited items. The QTI 2.2 spec explicitly distinguishes between the sequencing constraint (items must be attempted in order) and the review permission (`allowReview` attribute of `itemSessionControl`). Many early implementations conflated the two, leading to "linear" meaning "no back button." This is incorrect per spec and is harmful to candidates who misread an earlier question and want to correct it after reading a later one for context.

**Alternatives considered:** Restricting backtracking in linear mode (i.e., only forward navigation at all times). Rejected as spec-incorrect and harmful to candidate experience.

**Consequences:** QA engineers and testers who expect "linear = no back button" must be educated. Assessment authors who want to prevent backtracking in a linear test must set `itemSessionControl.allowReview=false` in addition to using `linear` navigation mode.

---

### Flat item list, not hierarchical tree navigation

**Decision:** `NavigationManager` operates on a flat 0-based integer index. Sections are a UI presentation concern, not a navigation enforcement boundary. `AssessmentPlayer` flattens all `SecureTestPart → SecureSection → SecureItemRef` references into a single `FlatItem[]` array at construction time.

**Rationale:** Navigation arithmetic (next/previous, index-to-section mapping) is simpler over a flat sequence. QTI selection and ordering (random pools, shuffle) are resolved server-side; the client receives an already-ordered list. The flat list is stable for the lifetime of a session, which simplifies save/resume. Supporting cross-section navigation without a flat index would require a two-dimensional coordinate system (section index + item-within-section index) and special handling for section boundaries.

**Alternatives considered:** Keeping the QTI section tree and walking it during navigation. Rejected because cross-section index arithmetic becomes ambiguous, especially for empty sections. Per-section `NavigationManager` instances. Rejected because it would require coordination between managers when the candidate crosses a section boundary.

**Consequences:** Section-level constraints (`assessmentSection.required`, per-section navigation modes) cannot currently be enforced by the player layer. This is tracked as an open gap (see Open questions). Any server that uses section-level time limits must enforce them server-side; the client does not enforce them.

---

### Client-side timer with `allowLateSubmission`

**Decision:** `TimeManager` maintains a client-side countdown using `setInterval`. When the countdown reaches zero, it fires `onExpired`. If `allowLateSubmission=false`, the assessment shell blocks the submission UI. If `allowLateSubmission=true`, submission remains possible.

**Rationale:** A client-side timer gives the candidate an accurate, visible countdown without requiring a round-trip to the server every second. It also allows the shell to disable interactions gracefully when time expires — giving the student a clear signal that the test is over — without requiring a server-push mechanism. The inherent weakness (a malicious client can manipulate the timer) is accepted because the server is the authoritative deadline enforcer.

**Alternatives considered:** Polling the server for remaining time on each item navigation. Rejected because it adds latency to every item transition and requires infrastructure support for a timer endpoint. Server-sent events or WebSockets for real-time timer sync. Rejected as over-engineering for the majority of K-12 deployment environments.

**Consequences:** Client time can drift from server time if the device clock changes or the browser tab is backgrounded. `TimeManager` uses elapsed wall-clock milliseconds (`Date.now()` delta), which is reasonably robust against backgrounding but not against system clock changes. Backends that are strict about deadlines should use their own timestamp at `initSession` time and validate submission timestamps server-side.

---

### `submissionMode` determines when `submitResponses()` is called

**Decision:** In `individual` mode, `AssessmentPlayer.next()` calls `BackendAdapter.submitResponses()` before advancing the index. In `simultaneous` mode, all item submissions happen inside `AssessmentPlayer.submit()` just before `finalizeAssessment()`.

**Rationale:** The QTI spec defines `submissionMode` as controlling when "responses are submitted for response processing." Individual mode enables per-item scoring and branching because the server has each item's response before the next item is presented. Simultaneous mode enables test-wide scoring (e.g., partial credit that depends on the full response set) and prevents feedback leakage mid-test — a requirement for high-stakes summative assessments.

**Alternatives considered:** Always submitting immediately but buffering the score display until finalization in simultaneous mode. Rejected because it would still give the server per-item responses before the candidate has finished, which may affect item selection in adaptive or semi-adaptive tests. Buffering all responses client-side and submitting at the end regardless of mode. Rejected because it breaks per-item branching in individual mode.

**Consequences:** In simultaneous mode, a network failure during `submit()` (which loops over all items) must be handled gracefully. The player captures a snapshot of `allItemResponses` before the loop to prevent backend `updatedState` responses from overwriting responses for items not yet submitted. Backends that return `updatedState` mid-loop should only include scores, not modified responses.

---

## Acceptance criteria

### Functional

**AC-1: Linear mode blocks forward skips**
```
AC-1: Linear mode blocks forward skips
  Given: An assessment with navigationMode 'linear' and 5 items, currently on item index 1
  When: canNavigateTo(3, 1) is called on NavigationManager
  Then: The call returns false
  Notes: canNavigateTo(2, 1) must return true (next item); canNavigateTo(0, 1) must return true (backtrack)
```

**AC-2: Linear mode allows sequential advance**
```
AC-2: Linear mode allows sequential advance
  Given: An assessment with navigationMode 'linear', currently on item index 2
  When: canNavigateTo(3, 2) is called
  Then: The call returns true
```

**AC-3: Linear mode allows backward navigation to any visited item**
```
AC-3: Linear mode allows backward navigation to any visited item
  Given: An assessment with navigationMode 'linear', currently on item index 4
  When: canNavigateTo(0, 4) is called
  Then: The call returns true
  Notes: This is the "linear allows backtracking" invariant. Items 0-3 were all visited to reach item 4.
```

**AC-4: Nonlinear mode allows arbitrary forward jumps**
```
AC-4: Nonlinear mode allows arbitrary forward jumps
  Given: An assessment with navigationMode 'nonlinear' and 10 items, currently on item index 0
  When: canNavigateTo(9, 0) is called
  Then: The call returns true
```

**AC-5: Out-of-bounds navigation is always rejected**
```
AC-5: Out-of-bounds navigation is always rejected
  Given: An assessment with 5 items (valid indices 0-4), any navigation mode
  When: canNavigateTo(5, 2) is called
  Then: The call returns false
  When: canNavigateTo(-1, 2) is called
  Then: The call returns false
```

**AC-6: canNext is false on the last item**
```
AC-6: canNext is false on the last item
  Given: An assessment with 5 items (last index = 4)
  When: canNext(4) is called
  Then: The call returns false
  When: canNext(3) is called
  Then: The call returns true
```

**AC-7: canPrevious is false on the first item**
```
AC-7: canPrevious is false on the first item
  Given: currentIndex is 0
  When: canPrevious(0) is called
  Then: The call returns false
  When: canPrevious(1) is called
  Then: The call returns true
```

**AC-8: markVisited and isVisited round-trip**
```
AC-8: markVisited and isVisited round-trip
  Given: A fresh NavigationManager for any mode
  When: markVisited(3) is called
  Then: isVisited(3) returns true
  And: isVisited(2) returns false
```

**AC-9: restoreState populates visited items correctly**
```
AC-9: restoreState populates visited items correctly
  Given: A NavigationManager with no prior visits
  When: restoreState([0, 1, 2]) is called
  Then: isVisited(0), isVisited(1), and isVisited(2) all return true
  And: isVisited(3) returns false
```

**AC-10: reset clears visited items**
```
AC-10: reset clears visited items
  Given: A NavigationManager with markVisited called for indices 0, 1, 2
  When: reset() is called
  Then: isVisited(0), isVisited(1), and isVisited(2) all return false
  And: getVisitedItems() returns an empty array
```

**AC-11: Individual submission mode calls submitResponses before advancing**
```
AC-11: Individual submission mode calls submitResponses before advancing
  Given: An assessment with submissionMode 'individual', currently on item 0 with a response
  When: AssessmentPlayer.next() is called
  Then: BackendAdapter.submitResponses is called for item 0 before currentItemIndex changes to 1
  And: If the backend returns nextItemIdentifier, the player navigates to that item instead of index 1
```

**AC-12: Simultaneous submission mode defers all submits to finalization**
```
AC-12: Simultaneous submission mode defers all submits to finalization
  Given: An assessment with submissionMode 'simultaneous' and 3 items, all visited with responses
  When: AssessmentPlayer.next() is called on items 0 and 1
  Then: BackendAdapter.submitResponses is NOT called during navigation
  When: AssessmentPlayer.submit() is called
  Then: BackendAdapter.submitResponses is called once per item (3 times total)
  And: BackendAdapter.finalizeAssessment is called exactly once after all submits
```

**AC-13: Timer fires warning callback before expiry**
```
AC-13: Timer fires warning callback before expiry
  Given: A TimeManager with maxTime=10 seconds and warningThreshold=3 seconds
  When: 7 seconds elapse
  Then: onWarning fires with a remainingSeconds value of approximately 3
  And: onWarning fires exactly once regardless of how many ticks have passed
```

**AC-14: Timer fires expired callback and blocks submission when allowLateSubmission is false**
```
AC-14: Timer fires expired callback and blocks submission when allowLateSubmission is false
  Given: A TimeManager with maxTime=5 seconds and allowLateSubmission=false
  When: 5 seconds elapse
  Then: onExpired fires
  And: isExpired() returns true
  And: allowsLateSubmission() returns false
```

**AC-15: Timer permits late submission when allowLateSubmission is true**
```
AC-15: Timer permits late submission when allowLateSubmission is true
  Given: A TimeManager with maxTime=5 seconds and allowLateSubmission=true
  When: 6 seconds elapse (timer expired)
  Then: allowsLateSubmission() returns true
  Notes: The shell must check allowsLateSubmission() before blocking the Submit button
```

**AC-16: SectionMenu renders only when there are multiple sections**
```
AC-16: SectionMenu renders only when there are multiple sections
  Given: An assessment with a single visible section
  When: SectionMenu is rendered with sections.length=1
  Then: No section menu button or dropdown is rendered in the DOM
  Given: An assessment with two visible sections
  When: SectionMenu is rendered with sections.length=2
  Then: The sections menu button is visible
```

**AC-17: NavigationBar Previous button is disabled on first item**
```
AC-17: NavigationBar Previous button is disabled on first item
  Given: NavigationBar is rendered with navState.canPrevious=false
  When: The DOM is inspected
  Then: The Previous button element has the disabled attribute set
  And: Activating the button via keyboard (Enter or Space) does nothing
```

**AC-18: NavigationBar shows Submit on last item, Next otherwise**
```
AC-18: NavigationBar shows Submit on last item, Next otherwise
  Given: NavigationBar is rendered with currentIndex=4 and totalItems=5 (last item)
  When: The DOM is inspected
  Then: A Submit button with data-testid="assessment-submit" is rendered
  And: No Next button with data-testid="assessment-next" is rendered
  Given: NavigationBar is rendered with currentIndex=3 and totalItems=5
  Then: A Next button is rendered and no Submit button is rendered
```

---

### Keyboard

**AC-K1: Previous and Next buttons are reachable and activatable by keyboard**
```
AC-K1: Previous and Next buttons are reachable and activatable by keyboard
  Given: NavigationBar is rendered with canPrevious=true and canNext=true
  When: A keyboard user tabs to the Previous button and presses Enter
  Then: onPrevious callback fires
  When: A keyboard user tabs to the Next button and presses Enter
  Then: onNext callback fires
```

**AC-K2: SectionMenu opens and dismisses by keyboard**
```
AC-K2: SectionMenu opens and dismisses by keyboard
  Given: SectionMenu is rendered with multiple sections and disabled=false
  When: A keyboard user focuses the Sections button and presses Enter
  Then: The section dropdown opens
  When: The keyboard user presses Escape or activates the backdrop button
  Then: The dropdown closes
  And: Focus returns to the Sections button
```

**AC-K3: Section items in SectionMenu are keyboard-selectable**
```
AC-K3: Section items in SectionMenu are keyboard-selectable
  Given: The SectionMenu dropdown is open with three sections
  When: A keyboard user tabs to the second section item and presses Enter
  Then: onSectionSelect fires with sectionIndex=1
  And: The dropdown closes
```

---

### Edge cases

**AC-E1: Simultaneous mode preserves responses when backend returns updatedState mid-loop**
```
AC-E1: Simultaneous mode preserves responses when backend returns updatedState mid-loop
  Given: An assessment with submissionMode 'simultaneous' and 3 items, all with responses
  And: The backend returns an updatedState after each submitResponses call that includes only that item's response (omitting others)
  When: AssessmentPlayer.submit() completes
  Then: All three items' responses are present in state.itemResponses after finalization
  Notes: Regression test for the allItemResponses snapshot pattern
```

**AC-E2: NavigationManager navigation on single-item assessment**
```
AC-E2: NavigationManager navigation on single-item assessment
  Given: A NavigationManager constructed with totalItems=1
  When: canNext(0) is called
  Then: Returns false
  When: canPrevious(0) is called
  Then: Returns false
  When: canNavigateTo(0, 0) is called in linear mode
  Then: Returns true (same-index navigation is always allowed)
```

**AC-E3: TimeManager with no maxTime never fires expiry**
```
AC-E3: TimeManager with no maxTime never fires expiry
  Given: A TimeManager constructed with no assessmentTimeLimits (or maxTime undefined)
  When: Any amount of time elapses
  Then: onExpired is never called
  And: isExpired() always returns false
  And: getRemainingSeconds() returns null
```

**AC-E4: TimeManager restoreState resumes countdown from elapsed position**
```
AC-E4: TimeManager restoreState resumes countdown from elapsed position
  Given: A saved TimeTrackingState with totalElapsed of 60000ms and a TimeManager with maxTime=120 seconds
  When: restoreState(savedState) is called
  Then: getRemainingSeconds() returns approximately 60 seconds (120 - 60)
  And: The countdown continues from that point, not from zero
```

**AC-E5: SectionMenu disabled prop prevents selection**
```
AC-E5: SectionMenu disabled prop prevents selection
  Given: SectionMenu is rendered with disabled=true
  When: A user attempts to click a section item in the dropdown
  Then: onSectionSelect is NOT called
  And: All section item buttons carry the disabled attribute
```

**AC-E6: Linear mode same-index navigation is a no-op, not an error**
```
AC-E6: Linear mode same-index navigation is a no-op, not an error
  Given: An assessment in linear mode, currently on item index 2
  When: canNavigateTo(2, 2) is called
  Then: Returns true (targetIndex <= currentIndex is satisfied)
  Notes: NavigateTo with the same index is not a forward skip. AssessmentPlayer may treat it as a no-op at the orchestration layer.
```

---

## Open questions

- [ ] **`allowSkipping` not enforced by NavigationManager:** The QTI spec says `allowSkipping=false` must prevent the candidate from advancing without providing a response. Currently, `NavigationManager.canNavigateTo(currentIndex + 1, currentIndex)` always returns `true`, and the Next button is not gated on whether the current item has a response. The `AssessmentPlayer.next()` method contains a check (FR-7 in the assessment-player PRD), but `NavigationManager` itself is not aware of this constraint. A future implementation should either pass an `isCurrentItemAnswered()` predicate to `NavigationManager` or handle the check entirely at the `AssessmentPlayer` layer and document clearly that `NavigationManager.canNavigateTo` does not enforce `allowSkipping`.

- [ ] **`allowReview` enforcement is incomplete:** `NavigationManager.canPrevious(index)` returns `true` for any `index > 0` regardless of `allowReview`. The `AssessmentPlayer.getNavigationState()` method gates `canPrevious` through `ItemSessionController.canReview()`, which is correct. However, callers that use `NavigationManager` directly (e.g. in tests or custom shells) will not see this constraint. The enforcement should be explicitly documented as an `AssessmentPlayer`-layer responsibility, and `NavigationManager` should carry a comment noting it does not handle `allowReview`.

- [ ] **Section-level navigation enforcement (G-05-nav):** `NavigationManager` operates on a flat item list and has no concept of section boundaries. The QTI spec allows `assessmentSection.required=true` (the section must be completed before proceeding) and per-section ordering constraints. These are not enforced. If assessment authors rely on section-required semantics, they must enforce them server-side (e.g. by rejecting `submitResponses` calls for out-of-order items). A future implementation could add a `SectionBoundaryPolicy` to `NavigationManager` that knows which index ranges belong to which sections and applies `required` constraints when crossing a boundary.

- [ ] **Navigation mode is a top-level field, not per-testPart:** The QTI spec places `navigationMode` on `testPart`, not on `assessmentTest`. `SecureAssessment.navigationMode` is a single top-level field. Multi-testPart assessments with different navigation modes per part are not representable in the current data model. If a real content use case requires per-part navigation modes, `SecureAssessment` will need to move `navigationMode` to `SecureTestPart`, and `NavigationManager` will need to switch modes at part boundaries.

- [ ] **`minTime` is declared but not enforced:** `TimeLimits.minTime` is present in the type definition but `TimeManager` never checks it. The QTI spec says delivery engines should not allow candidates to proceed until `minTime` has elapsed. The enforcement implementation is absent.

---

## Related

- QTI spec: §2.1 (assessmentTest, testPart, assessmentSection), §2.2 (timeLimits), §2.3 (itemSessionControl)
- Implementation: `packages/assessment-player/src/core/NavigationManager.ts`
- Implementation: `packages/assessment-player/src/core/TimeManager.ts`
- Implementation: `packages/assessment-player/src/components/NavigationBar.svelte`
- Implementation: `packages/assessment-player/src/components/SectionMenu.svelte`
- API contract: `packages/assessment-player/src/integration/api-contract.ts` (`SecureAssessment`, `SecureTestPart`, `SubmitResponsesResponse.nextItemIdentifier`)
- Types: `packages/assessment-player/src/types/index.ts` (`NavigationState`, `TimeLimits`)
- Adjacent PRDs: `docs/prds/architecture/assessment-player.md` (orchestration layer that uses NavigationManager)
- Adjacent PRDs: `docs/prds/systems/accessibility.md` (keyboard and ARIA requirements for NavigationBar)
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-05 (`testFeedback` visibility; also relates to section-level navigation gap)
