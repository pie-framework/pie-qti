# PRD: Assessment Player

<!--
  Status: current
  Type: architecture
  Packages: @pie-qti/assessment-player
  Last reviewed: 2026-07-13
-->

**Status:** current
**Type:** architecture
**Packages:** `@pie-qti/assessment-player`
**Last reviewed:** 2026-07-13

---

## Summary

`@pie-qti/assessment-player` is the multi-item test shell that sits above `@pie-qti/item-player`. It orchestrates an entire QTI `assessmentTest` — managing navigation across items and sections, enforcing submission modes, collecting candidate responses, delegating all scoring to a backend adapter, and displaying test-level feedback after finalization. By itself it never scores anything; it is a secure delivery shell whose only job is to present items in the right order, collect responses, and coordinate with a backend that holds the authoritative item XML and scoring logic.

LTI launch, identity, roster, and grade-passback flows are host-application responsibilities. This package provides an embeddable assessment runtime, not an LTI platform implementation.

---

## Background and rationale

### Why a separate package instead of extending item-player

The item-player is intentionally scoped to a single `assessmentItem`. It has no concept of section hierarchy, part-level navigation modes, inter-item state, or test-level outcomes. Adding those concerns to item-player would couple two very different lifetimes (item session vs. test session) and make item-player unusable in standalone embedding scenarios. The assessment player is therefore an orchestration layer that holds N item-player instances and adds the structural concerns.

### Why the client shell never scores

In any assessment with academic stakes, the correct responses and scoring rules must not reach the candidate's browser — they can be read from the DOM or JavaScript memory. The `BackendAdapter` contract enforces this structurally: the server returns `SecureAssessment`, which is the assessment structure with `<correctResponse>` and `<responseProcessing>` elements stripped for the candidate role. All scoring happens server-side; the client receives only the numeric result. The reference adapter (`ReferenceBackendAdapter`) intentionally does client-side scoring for demos and development, but it is explicitly unsafe for any production use.

### Why the flat item list is built at construction time

After `initSession` returns, `AssessmentPlayer` immediately flattens all `SecureTestPart → SecureSection → SecureItemRef` references into a single ordered `FlatItem[]` array. This is because:

1. Navigation arithmetic (next/previous, index-to-section mapping) is simpler over a flat sequence than over a nested tree, especially when sections may be empty.
2. The runtime applies a preserved section's direct-child selection and ordering once while building
   the session's flat sequence. Required children are retained and fixed children keep their slots.
   An authoritative backend may instead return an already-resolved structure.
3. The flat list is stable for the lifetime of a session. Resuming a session restores the same list
   by restoring the `currentItemIdentifier` from `AssessmentSessionState`; a production backend must
   persist/replay the selected structure or its deterministic seed rather than silently reselecting.
   Replacement selection is not materialized yet because duplicate instances require distinct
   sequence identity and independent ItemSessions.

### Why individual and simultaneous submission modes differ

`submissionMode` is a QTI `testPart` attribute with two values:

- **`individual`**: The candidate submits each item independently as they navigate away. The backend scores each response immediately. The client calls `submitCurrentItem()` inside `next()` before navigating forward. This enables per-item branching decisions (`nextItemIdentifier` in `SubmitResponsesResponse`).
- **`simultaneous`**: All responses are withheld until the candidate explicitly finalizes the assessment. In `submit()`, the player iterates over all items that have not yet been submitted, sends each response to the backend in sequence, then calls `finalizeAssessment()`. The distinction matters for backend scoring: simultaneous mode allows the server to apply test-wide scoring rules that depend on the full response set before producing any scores.

### Why local-first persistence

State is persisted to `localStorage` → `sessionStorage` → memory (in degradation order) rather than requiring a dedicated persistence endpoint. This allows the player to function completely offline and reduces infrastructure requirements for low-stakes deployments. Backend-authoritative persistence is layered on top via the optional `BackendAdapter.saveState()` method. If the backend call fails, the client-side state is still preserved.

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
| `assessmentSection.visible` | Full (hidden sections omitted from section menu) |
| `assessmentSection.rubricBlock` (view-filtered) | Full |
| `timeLimits.minTime` / `maxTime` (assessment, testPart, section, item) | Runtime enforcement with independent persisted clocks; edge/browser coverage remains |
| `timeLimits.allowLateSubmission` | Full |
| `itemSessionControl.maxAttempts` | UI hint (server-authoritative) |
| `itemSessionControl.allowReview` | UI hint |
| `itemSessionControl.allowSkipping` | UI hint |
| `itemSessionControl.showFeedback` | UI hint |
| `itemSessionControl.validateResponses` | UI hint |
| `testFeedback` (outcome-based) | Full for preserved structured feedback and finalized backend feedback |
| `assessmentSection.selection` (direct children) | Implemented without replacement; replacement clones remain open |
| `assessmentSection.ordering` (shuffle/fixed) | Implemented during session-sequence construction |
| `outcomeDeclaration` / `outcomeProcessing` (test-level) | Parsed/executed by the reference adapter; production backend remains authoritative |

### Deliberately incomplete assessment semantics

- Parsed `preCondition` expressions are retained but are not evaluated dynamically while walking
  test parts, sections, and item refs.
- Item-ref branch rules can be evaluated by the reference backend; section and testPart branch rules
  are not yet represented/executed. A production backend may return `nextItemIdentifier` as its
  authoritative branch decision.
- `selection withReplacement="true"` does not materialize distinct sequence-indexed item instances;
  the runtime rejects selections that require more instances than source children.
- `assessmentSectionRef` resolution needs explicit cycle/depth limits in addition to its package-path checks.

### Known divergences from spec

- **Dynamic structure rules (G-16):** preconditions, section/testPart branches, and replacement
  instances remain the material assessment-level conformance gap.
- **Timing evidence (G-22):** scoped clocks and `minTime`/`maxTime` enforcement exist, but direct
  integration coverage for every minimum-time scope and simultaneous expiry combination remains.

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
- **FR-8:** `getCurrentRubricBlocks()` must return the section-level rubric blocks for the current item, falling back to test-part-level blocks if the section has none.
- **FR-9:** `TimeManager` must independently accumulate and persist assessment, testPart, section,
  and item clocks; enforce the shortest active hard maximum and every applicable minimum transition;
  and fire warning/expiry callbacks for the active limiting scope.
- **FR-10:** `getState()` must return a shallow clone; mutations to the returned object must not affect internal state.
- **FR-11:** `restoreState(state)` must navigate to the item identified by `state.currentItemIdentifier`, restore `visitedItems` into `NavigationManager`, and rehydrate `itemResults` from `state.itemScores` so that `submit()` can skip already-submitted items.
- **FR-12:** `destroy()` must clear all event listener sets and null the current item player to avoid memory leaks.
- **FR-13:** `getVisibleFeedback()` after a successful `submit()` must return the feedback provided by `FinalizeAssessmentResponse.feedback` if present.
- **FR-14:** `getAllSections()` must enumerate sections across all test parts in document order.

---

## Non-functional requirements

- **Accessibility:** The assessment player provides the headless logic layer; accessibility responsibilities for navigation announcements, focus management, and ARIA live regions live in the Svelte shell components (`AssessmentShell`, `NavigationBar`). The PRD for those components covers WCAG 2.2 AA requirements. The `AssessmentPlayer` class itself exposes `onItemChange` and `onSectionChange` events that shell components must use to trigger screen-reader announcements.
- **Performance:** `flattenItems()` runs once at construction; all subsequent navigation calls are O(1) array index lookups. Item players are created lazily on `navigateTo()`, not pre-created for all items.
- **Cross-platform:** No DOM dependencies. The player class is framework-agnostic and can be used headlessly (e.g. server-side with Node.js for testing, or wrapped in a web component).
- **Security:** The player trusts the `BackendAdapter` contract. It must never apply client-computed scores to `itemResults` in a way that could be finalized — all `ItemResult.score` values must come from `SubmitResponsesResponse.result` or `FinalizeAssessmentResponse.itemScores`, not from local computation.
- **i18n:** The player accepts an `i18nProvider` from the host. If none is supplied, a no-op provider is created that returns translation keys as-is. String content (e.g. error messages thrown from navigation) should be keys, not hardcoded English.

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
faster over a flat array. The source tree is retained through XML ingestion, and direct-child
selection/ordering is applied once while constructing the per-session flat sequence.
**Alternatives considered:** Keeping the tree structure and walking it on each navigation call. Rejected because section-crossing navigation (jumping from item 3 in section 1 to item 1 in section 2) becomes ambiguous without a flat index.
**Consequences:** `SecureAssessment` must contain all source children or an already-resolved
sequence before construction. Dynamic insertion is not supported. `withReplacement` cannot safely
reuse identifier-keyed state and therefore remains rejected until distinct runtime instance keys,
sequence indexes, ItemSessions, and results are materialized.

### itemSessionControl has testPart defaults with section overrides

**Decision:** In the constructor, `ItemSessionController` starts from the first `testPart` defaults; navigation then applies effective item-session settings for the current item/section when available.
**Rationale:** QTI allows testPart, section, and item-level control settings. The runtime needs a stable controller object, but its settings must follow the current item's effective context.
**Alternatives considered:** Per-section `ItemSessionController` instances. Deferred because updating the active controller settings is simpler and keeps existing session state intact.
**Consequences:** Multi-section assessments can express section-level `allowSkipping` / `allowReview` differences, while multi-testPart assessments still need additional work if each part has materially different control policy.

### Navigation and submission modes are testPart-scoped

**Decision:** Every `SecureTestPart` retains its own navigation and submission modes. Navigation
checks consult the active item's part; the top-level fields remain compatibility fallbacks only.
**Rationale:** QTI scopes both modes to the testPart, and mixed-mode assessments must not inherit the
first part's behavior.
**Alternatives considered:** Collapsing all modes to one top-level pair. Rejected because it changes
valid mixed-part delivery semantics.
**Consequences:** Linear parts allow only the immediate forward transition and cannot be re-entered.
Nonlinear parts permit in-part navigation subject to ItemSessionControl. Dynamic part/section branch
targets remain backend/G-16 work.

### Event listeners use `Set<listener>`, not an event emitter library

**Decision:** Each event type is backed by a `Set<ListenerFn>` maintained on the player instance.
**Rationale:** Avoids a runtime dependency, keeps the subscription model explicit and type-safe, and makes memory leak prevention obvious (each `on*()` call returns an unsubscribe function).
**Alternatives considered:** EventEmitter, RxJS, Svelte stores. Rejected — unnecessary dependencies for a headless player.
**Consequences:** No wildcard subscriptions, no once() helper, no error event. These can be added if needed without breaking the existing API.

### `submit()` preserves client response map during simultaneous-mode item loop

**Decision:** In simultaneous mode, `submit()` captures `allItemResponses = { ...this.state.itemResponses }` before the loop and restores it after each backend state update.
**Rationale:** Some backend adapters return `updatedState` in their `submitResponses` response. This `updatedState` may only contain responses for items submitted so far, which would silently erase responses for items not yet submitted. The client-side capture prevents data loss.
**Alternatives considered:** Requiring backends not to return `updatedState` during simultaneous-mode submission. Rejected — the contract allows it and it's better to be defensive.
**Consequences:** If the backend intentionally modifies responses server-side (e.g. normalizing values), those modifications will be overwritten by the client capture. Backends that need to modify responses should do so only at finalization.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|---|---|---|---|
| Backend adapter | `BackendAdapter` in `src/integration/api-contract.ts` | Implement all four required methods; pass instance to `AssessmentPlayer.create()` | `class MyBackendAdapter implements BackendAdapter { ... }` |
| Item rendering | `QTIPlugin` (via `@pie-qti/item-player`) | Host shells can pass item-player plugins/security/i18n into the item renderer layer; the headless assessment player only constructs the core `Player` needed for state/scoring. | Custom extractor + web component for a vendor interaction type |
| Custom outcome processing | Backend adapter / host application | Implement assessment-level outcome policy in the backend or host integration. | Compute aggregate outcomes before returning updated assessment state |
| Time management callbacks | `onWarning`, `onExpired`, `onTick` in `BackendAssessmentPlayerConfig` | Provide callbacks at construction | Display a countdown banner or auto-submit |
| Extended text editor hint | `extendedTextEditor` in `BackendAssessmentPlayerConfig` | Pass `'tiptap'` or `'textarea'`; plumbed through to item renderers | `config.extendedTextEditor = 'tiptap'` |
| Persistence backend | `BackendAdapter.saveState()` | Implement `saveState()` on your adapter; the player calls it during auto-save | Persist to PostgreSQL session table |

---

## Data model / contracts

Key types are in `packages/assessment-player/src/integration/api-contract.ts`. Invariants not obvious from the types:

- **`SecureAssessment.navigationMode`** is a single top-level field, not per `SecureTestPart`. See the design decision above.
- **`SecureItemRef.itemXml`** must be pre-filtered by the server. For `candidate` role, `<correctResponse>` and `<responseProcessing>` must be absent. The client does not validate this; it trusts the server.
- **`AssessmentSessionState.itemResponses`** is keyed by item identifier, then by response variable identifier. The inner value type is `Record<string, ResponseValue>`. A missing outer key means the item has never been visited; an empty inner object means the item was visited but no response was entered.
- **`SubmitResponsesResponse.nextItemIdentifier`** is the server's branching decision. When present, the client must navigate to that item. When absent, the client falls back to `currentIndex + 1` (individual mode) or stays in place (simultaneous mode). Servers that do not implement branching should omit this field entirely.
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

AC-2: Linear navigation allows backward movement
  Given: An assessment with navigationMode 'linear', currently on item 2
  When: previous() is called
  Then: currentItemIndex becomes 1 and onItemChange fires

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
  Then: All three items' responses are present in the final submitResponses call for item 3
  Notes: Regression test for the allItemResponses capture pattern

AC-11: RubricBlocks fall back to testPart level
  Given: Section A has no rubricBlocks, but its parent testPart has rubricBlocks
  When: getCurrentRubricBlocks() is called while on an item in section A
  Then: The testPart-level rubricBlocks are returned

AC-12: Timer fires warning and expiry callbacks
  Given: An assessment with timeLimits.maxTime of 5 seconds and timeWarningThreshold of 3
  When: 2 seconds elapse
  Then: onTimeWarning fires with remainingSeconds approximately 3
  When: 5 seconds elapse
  Then: onTimeExpired fires and isTimeExpired() returns true
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
  Then: The item player is re-initialized with the same item (or the call is a no-op — either is acceptable, but no error is thrown)
  Notes: canNavigateTo(2, 2) returns true in both modes because targetIndex <= currentIndex in linear mode.

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

## Open questions

- [ ] Should `ItemSessionController` be instantiated per `testPart` so that different parts can have different `maxAttempts` and `allowReview` settings? Currently only the first part's settings are used.
- [ ] `G-05`: `testFeedback` visibility logic needs to be updated to perform string equality checks against arbitrary outcome variable values, not boolean coercion. When is this scheduled?
- [ ] `G-11`: Full `<outcomeProcessing>` XML interpretation at the assessment level is deferred. The infrastructure in `@pie-qti/qti-processing` (`buildOutcomeProcessingAst`, `execProgram`) already exists; wiring it to the assessment player is the remaining work. When does this become a blocker for real content?

---

## Related

- QTI spec: §2 (Assessment Architecture), §2.1–2.4
- Implementation: `packages/assessment-player/src/core/AssessmentPlayer.ts`, `NavigationManager.ts`, `ItemSessionController.ts`, `TimeManager.ts`
- API contract: `packages/assessment-player/src/integration/api-contract.ts`
- Adjacent PRDs: `docs/prds/architecture/item-player.md`, `docs/prds/architecture/response-processing.md`
- Existing docs: `packages/assessment-player/BACKEND-INTEGRATION.md`, `packages/assessment-player/EXTENSIBILITY.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` §G-05, §G-11
