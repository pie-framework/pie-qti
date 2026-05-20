# PRD: associateInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: associateInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`associateInteraction` is the QTI interaction type for symmetric pair-forming tasks: the candidate selects two items from a single shared pool to form an association. The response is `multiple` cardinality with `pair` baseType — a set of `"id1 id2"` strings where the two identifiers are always stored in sorted (lexicographic) order so that `"A B"` and `"B A"` are treated as the same pair. This contrasts with `matchInteraction`, which uses `directedPair` (ordered, asymmetric) and draws from two separate source/target pools.

---

## Background and rationale

### pair vs. directedPair: choosing the right interaction type

`associateInteraction` and `matchInteraction` are frequently confused because both produce pairing responses. The critical difference is semantic symmetry:

- **`pair` (associateInteraction)**: The relationship is symmetric. `"dog ↔ animal"` is the same association as `"animal ↔ dog"`. Use this for synonyms, same-category groupings, equivalent expressions, or any relationship where direction does not matter. All choices come from one pool; any choice can be paired with any other (subject to `matchMax` and `matchGroup` constraints).

- **`directedPair` (matchInteraction)**: The relationship is directional. `"cause → effect"` is not the same as `"effect → cause"`. Use this for term-definition matching, cause-effect, event-date, or any relationship where one side is the source and the other is the target. Choices come from two separate `simpleMatchSet` pools.

Confusing the two at item-authoring time produces silent correctness bugs: if an author uses `matchInteraction` for a synonym task and a student answers `"animal dog"` when the key says `"dog animal"`, the student scores zero even though they were correct. The `pair` baseType prevents this class of error.

### maxAssociations=0 is unlimited, not zero

The QTI spec defines `maxAssociations=0` as "no upper bound". This is the same footgun as `maxChoices=0` in `choiceInteraction`. The default value is `1` (one pair), so leaving the attribute absent gives a one-pair interaction. Authors who want to allow unlimited pairs must explicitly write `maxAssociations="0"`. Authors who accidentally omit the attribute when they intended to allow many pairs will get a one-pair interaction — a subtle authoring error that produces confusing behavior for students. The extractor surfaces `maxAssociations` as-is; the UI enforces the limit by refusing additional clicks once the limit is reached.

### Two-step click interaction model

Unlike `choiceInteraction` where each click is a complete act, associating requires two clicks: one to "select" a choice (marking it as awaiting a partner) and a second to "complete" the pair. The component manages a `selectedForPairing` state variable to track the pending choice. This two-step model works without drag-and-drop, making it keyboard- and touch-accessible without requiring complex pointer event handling.

The `selectedForPairing` state lives in the associate component. When the component is used standalone (outside the item player), the same internal state model applies.

### Pair canonicalization at scoring time

When a student clicks `B` then `A`, the component stores the pair as `"B A"` (click order). The scoring engine normalizes this to `"A B"` before comparing against `correctResponse` or `mapping` keys. Normalization happens in two places:

1. **In `Player.ts` `parseMapping()`** — when loading `mapEntry` keys from the `responseDeclaration`, each `pair` key is sorted: `[...parts].sort().join(' ')`. This means `mapEntry mapKey="B A"` and `mapEntry mapKey="A B"` resolve to the same entry.

2. **In `qti-processing` `evaluator.ts` `normalizeScalarForCompare()`** — when evaluating `match`, `member`, and correctResponse comparisons, `pair` values are sorted before comparison.

The response array stored in `player.declarations` is NOT canonicalized when the student clicks — the raw click-order string is stored. Canonicalization happens only at evaluation time. This means `player.getResponses()` can return `["B A", "C D"]` even when the canonical form is `["A B", "C D"]`. The integration test at `packages/item-player/tests/core/interaction-plumbing.test.ts` verifies that `setResponses({ RESPONSE: ['B A', 'C D'] })` still produces full score against a correctResponse of `["A B", "C D"]`.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, 2.2, 3.0 (via element name mapping)
- **Spec section(s):** §3.1.3 `associateInteraction` in `docs/QTI_techguide.md`

### Supported attributes on `associateInteraction`

| Attribute | Default | Behavior |
|-----------|---------|----------|
| `responseIdentifier` | — | Required. Binds to `responseDeclaration` with `baseType="pair"` `cardinality="multiple"`. |
| `shuffle` | `false` | When `true`, choice order is randomized at extraction time. The shuffled order is fixed for the session. |
| `maxAssociations` | `1` | Maximum number of pairs the candidate may form. `0` means unlimited. |
| `minAssociations` | `0` | Minimum number of pairs required for a complete response. Extracted but **not enforced at submission time** (see G-06 below). |

### Supported attributes on `simpleAssociableChoice`

| Attribute | Default | Behavior |
|-----------|---------|----------|
| `identifier` | — | Required. Used as both the response token and the lookup key in `mapEntry`. |
| `matchMax` | — | Required per spec. Maximum times this choice may appear in the response (across all pairs). `0` means unlimited. Extracted and present in `AssociateData.choices[].matchMax`. **Not enforced by the UI** — see design decisions. |
| `matchMin` | `0` | Minimum times this choice must appear. Extracted and conditionally included in `AssociateData.choices[].matchMin`. **Not validated at submission** (G-06). |
| `class` | — | Optional space-separated CSS class names. Extracted into `choices[].classes`. |

### Known gaps

**G-01 — `matchGroup` not extracted** (`SPEC-GAPS-PLAN.md §G-01`, status: Open)

The `matchGroup` attribute restricts which choices may be paired with each other. When `matchGroup="set-a"` is set on a choice, it may only be paired with other choices whose `matchGroup` includes `"set-a"`. Item banks use this to prevent nonsensical pairings in large pools (e.g., a pool of 8 items where only specific subsets should be paired together).

Impact: Items that rely on `matchGroup` will silently allow invalid pairings. The UI offers all choices as valid partners for any pending selection, which is incorrect. The extractor does not read the attribute; it is absent from `AssociateData`.

Required fix: Add `matchGroup?: string[]` to `AssociableChoice` and extractor; filter valid pairing targets in the UI component based on shared group membership.

**G-06 — `matchMin` not validated at submission** (`SPEC-GAPS-PLAN.md §G-06`, status: Open)

`matchMin > 0` on a `simpleAssociableChoice` means the choice must appear in at least that many pairs in a valid response. Currently, `matchMin` is extracted and passed to the component but not checked when the candidate submits. A response that violates `matchMin` is accepted without warning.

Impact: Items that use `matchMin` to enforce mandatory choice usage (e.g., "each term must be used at least once") will accept incomplete responses silently.

### Type-system gap

`AssociateInteractionData` (in `packages/item-player/src/interactions/shared/types.ts`) does not include `minAssociations` or per-choice `matchMin`/`matchGroup` fields, even though the extractor reads and returns them. The runtime type used by the component is narrower than the extractor's `AssociateData` type. If these fields are needed by the UI, the shared type must be updated in the same PR.

---

## Functional requirements

- **FR-1:** The component renders all `simpleAssociableChoice` elements as clickable buttons in a 2-column grid (1 column on narrow viewports).
- **FR-2:** Clicking an unselected, unpaired choice marks it as "pending" (first click of a pair). Visual state: `btn-accent` styling plus a `◉` indicator.
- **FR-3:** Clicking the pending choice again deselects it without creating a pair.
- **FR-4:** Clicking a different choice while one is pending creates a pair, adds it to the response array, clears the pending state, and emits a `qti-change` event with the full response array.
- **FR-5:** When `maxAssociations > 0` and the current pair count equals `maxAssociations`, clicks on unpaired choices must not create additional pairs. The UI must make the enforcement mechanism visually clear (e.g., disable further pairing or show a limit-reached message).
- **FR-6:** Formed pairs are displayed in a "Current Associations" list showing both choice labels and a remove button (`✕`) per pair.
- **FR-7:** Clicking the remove button on a pair removes it from the response array and emits `qti-change`.
- **FR-8:** When `disabled=true`, all click handlers are no-ops (including pairing and removal). All interactive elements carry the `disabled` attribute.
- **FR-9:** When `role="scorer"` and `correctResponse` is provided, the component renders a "Correct Associations" list showing the correct pairs. Per-pair correctness is indicated in the "Current Associations" list via `btn-success` styling and a `Correct` badge.
- **FR-10:** The component dispatches `qti-change` as a composed, bubbling `CustomEvent` with `detail: { responseId, value: string[], timestamp }` for web component usage, and calls the `onChange` prop callback for Svelte component usage.
- **FR-11:** The `qti-change` value is always a flat `string[]` of space-separated pair strings (e.g., `["A B", "C D"]`). The order within each pair reflects click order, not canonical sort order — canonicalization is the scoring engine's responsibility.
- **FR-12:** When `shuffle=true`, choice order is randomized. The shuffled order is stable within a render (not re-randomized on re-render with the same data).
- **FR-13:** A contextual helper message is shown when not in scorer mode: when no choice is pending, instruct the candidate to "Click two items to create an association"; when a choice is pending, instruct to "Click another item to create an association (or click again to deselect)".

---

## Non-functional requirements

### Accessibility

**Keyboard navigation:** The two-step click model must be fully operable by keyboard. Each choice button must be reachable by `Tab`, activatable by `Enter` or `Space`. The first activation marks the choice as pending; the second activation on a different choice completes the pair. No pointer events should be required.

**Focus management:** After a pair is created, focus must remain on a logically appropriate element (the grid of choices) so that keyboard users can continue forming pairs without re-navigating.

**ARIA roles and labels:** Each choice button must have a discernible accessible name (the choice text). The pending state must be communicated to assistive technology — at minimum via `aria-pressed="true"` or `aria-selected="true"` on the pending button, and an `aria-live` region that announces pair creation and removal. The helper message area should use `role="status"` or `aria-live="polite"`.

**Remove buttons:** Each pair's remove button (`✕`) must have an accessible label beyond the symbol: `aria-label="Remove association: [choice1 text] and [choice2 text]"`.

**Touch targets:** Minimum 44×44 CSS pixel touch targets on all interactive elements (buttons in the choice grid, remove buttons). This is especially critical on mobile devices used in K-12 test delivery.

**Color independence:** Correct/incorrect and selected/paired states must not rely on color alone. The `◉` and `✓` indicators in the choice buttons provide shape redundancy. Badge text (`Correct`) provides text redundancy for color-coded pair rows.

### Performance

No specific latency budget beyond the standard 16 ms per-frame target. The component re-renders on each pair creation/removal, but with at most ~20 choices (typical item bank limit), this is negligible.

### Cross-platform

The choice grid uses CSS `grid` with a `repeat(2, minmax(0, 1fr))` layout that collapses to single-column at ≤640 px via `@media (max-width: 640px)`. All interactions must be operable on iOS Safari and Android Chrome with touch input.

### Security

Choice text (`choice.text`) is rendered via `{@html ...}`. This is intentional — QTI content can include inline HTML (bold, italic, math markup). The extractor must sanitize raw HTML from the QTI XML before it reaches the component. The item player's `toTrustedHtml()` pipeline handles sanitization at render time; the component itself trusts the `AssociateInteractionData.choices[].text` values it receives.

### i18n

Three strings are externalized to the `@pie-qti/i18n` provider:

| Key | Default (English) |
|-----|------------------|
| `interactions.associate.correctAssociations` | `Correct Associations` |
| `interactions.associate.currentAssociations` | `Current Associations` |
| `interactions.associate.clickToAssociate` | `Click two items to create an association between them` |
| `interactions.associate.clickAnotherOrDeselect` | `Click another item to create an association (or click again to deselect)` |
| `interactions.choice.correct` | `Correct` |

RTL layout is inherited from the page/shadow root's `dir` attribute; no special RTL logic is required in the component.

---

## Design decisions

### Decision: Two-step sequential click, not drag-and-drop

**Decision:** Pairs are formed by two sequential clicks, not by dragging one item onto another.  
**Rationale:** Drag-and-drop is inaccessible to keyboard-only users and unreliable on touch screens, especially when items are small. The QTI spec does not mandate a specific interaction modality. Sequential click is fully keyboard-operable, requires no pointer events, and works reliably on touch screens of any size. It also avoids the complexity of drag state management.  
**Alternatives considered:** Drag-and-drop with a keyboard fallback (two separate code paths, much more complexity); select-from-dropdown-after-selecting-first-item (less discoverable).  
**Consequences:** The interaction requires users to understand the two-step model. The helper message mitigates this, but there is no visual affordance connecting two choices before the pair is formed.

### Decision: Pair string format — click order, not canonical sort

**Decision:** The component stores pairs in the response array in click order (`"B A"` when B was clicked first), not in canonical sorted order (`"A B"`). Canonicalization happens only in the scoring engine.  
**Rationale:** The component's job is to faithfully record what the student did. Normalizing before storage would make it impossible to replay the original interaction (e.g., for audit trails or session replay). Scoring correctness is the engine's responsibility; the engine already normalizes `pair` values in both `parseMapping()` (map key normalization) and `normalizeScalarForCompare()` (evaluation-time normalization). This is verified by the integration test in `packages/item-player/tests/core/interaction-plumbing.test.ts`.  
**Alternatives considered:** Canonical sort at storage time — simpler scoring logic, but loses interaction fidelity and creates a confusing discrepancy between what the student sees and what the response contains.  
**Consequences:** Callers who inspect `player.getResponses()` directly must not assume canonical sort order. The scoring engine handles this transparently; host applications that render stored responses without going through the engine must normalize pairs before comparison.

### Decision: matchMax not enforced by the UI

**Decision:** The UI does not enforce `matchMax` per choice (the maximum number of times a single choice may appear across pairs).  
**Rationale:** Enforcing `matchMax` in the UI requires tracking per-choice appearance counts and disabling choices that have reached their limit — significant added complexity for a constraint that, in practice, is almost always `matchMax=1` (one-to-one matching) or `matchMax=0` (unlimited). Spec-correct behavior is that over-limit responses are handled by response processing, not blocked at the UI level. The QTI spec says the delivery engine "should" enforce `matchMax` but does not require it to block interaction; the spec's validation rules apply at response processing time.  
**Alternatives considered:** Enforcing `matchMax` in the UI — would require counting per-choice usage and updating button enabled state after every pair change; adds complexity and a new class of UI state bug.  
**Consequences:** A student can technically create more pairs than `matchMax` allows for a given choice. Response processing will still score correctly (or zero) because the engine evaluates the mapping against the actual response. This is a known limitation documented as out-of-scope until a compelling real-world item requires it.

### Decision: selectedForPairing state lives in the component

**Decision:** The `selectedForPairing` state is owned by the associate component.  
**Rationale:** The item-player rendering path no longer maintains a separate vanilla renderer state object for pairing selection. Keeping this transient UI state inside the component keeps the item rendering seam smaller.  
**Alternatives considered:** Lifting pairing state into the item-player renderer — rejected because it expands the renderer contract for one interaction-specific behavior.  
**Consequences:** When integrating `pie-qti-associate` outside the item player, the component still works with its internal selection state.

---

## Data model / contracts

### `AssociateData` (extractor output, `packages/item-player/src/interactions/associate/extractor.ts`)

```typescript
interface AssociateData {
  choices: Array<{
    identifier: string;
    text: string;        // HTML string, sanitized by item player pipeline
    matchMax: number;    // 0 = unlimited
    matchMin?: number;   // Present only when > 0
    classes?: string[];  // Present only when non-empty
  }>;
  shuffle: boolean;
  maxAssociations: number;   // 0 = unlimited; default 1
  minAssociations?: number;  // Present only when > 0
  prompt: string | null;
}
```

Note: `matchGroup` is absent (G-01 gap). `minAssociations` is extracted but absent from `AssociateInteractionData` in `interactions.ts` — it does not reach the component.

### `AssociateInteractionData` (component input, `packages/item-player/src/interactions/shared/types.ts`)

```typescript
interface AssociateInteractionData extends BaseInteractionData {
  type: 'associateInteraction';
  shuffle: boolean;
  maxAssociations: number;
  prompt: string | null;
  choices: AssociableChoice[];  // AssociableChoice has identifier, text, matchMax only
}
```

This type is narrower than `AssociateData` — `minAssociations`, per-choice `matchMin`, per-choice `classes`, and (once G-01 is addressed) per-choice `matchGroup` are all absent. The gap between extractor output and component input is a known inconsistency.

### Response variable

```
responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair"
```

The response value is a `string[]` where each element is `"id1 id2"` with a single space separator. Order within a string reflects click order (not canonical). The `multiple` cardinality means the array is treated as a set — duplicate pairs are not expected.

### `qti-change` event detail

```typescript
{
  responseId: string;   // matches responseDeclaration identifier
  value: string[];      // full current response array after the change
  timestamp: number;    // Date.now()
}
```

---

## Acceptance criteria

### Functional

```
AC-1: Basic pair creation
  Given: An associateInteraction with 4 choices (A, B, C, D) and maxAssociations=2
  When: The candidate clicks A, then clicks B
  Then: A pair "A B" or "B A" appears in the "Current Associations" list
        A qti-change event fires with value containing one element
        A's button shows a ✓ indicator; B's button shows a ✓ indicator
        The pending state is cleared (no ◉ indicator visible)

AC-2: Pending state on first click
  Given: An associateInteraction with no pairs formed
  When: The candidate clicks choice A
  Then: Choice A's button shows a ◉ indicator and btn-accent styling
        The helper message changes to "Click another item to create an association (or click again to deselect)"
        No qti-change event fires

AC-3: Deselection by re-clicking
  Given: Choice A is pending (◉ state)
  When: The candidate clicks choice A again
  Then: The pending state is cleared
        No pair is created
        No qti-change event fires
        The helper message reverts to "Click two items to create an association between them"

AC-4: Pair removal
  Given: A pair "A B" exists in the Current Associations list
  When: The candidate clicks the ✕ remove button on that pair
  Then: The pair is removed from the list
        A qti-change event fires with value that no longer includes any "A B" or "B A" string

AC-5: maxAssociations limit enforced
  Given: An associateInteraction with maxAssociations=2 and 2 pairs already formed
  When: The candidate clicks a choice button
  Then: No new pending state is set (or the UI otherwise prevents a third pair from forming)
  Notes: Exact enforcement UX (disable buttons vs. show message) is an implementation detail; what matters is that the response never exceeds maxAssociations pairs.

AC-6: maxAssociations=0 allows unlimited pairs
  Given: An associateInteraction with maxAssociations=0 and choices A, B, C, D
  When: The candidate forms pairs A-B, C-D, A-C (if matchMax allows reuse)
  Then: All three pairs are accepted
        No limit-enforcement behavior is triggered

AC-7: qti-change emits full response array
  Given: Three pairs have been formed
  When: The candidate removes the second pair
  Then: The qti-change event detail.value is an array of the two remaining pairs (not just the removed one)

AC-8: Disabled state
  Given: disabled=true
  When: The candidate clicks any choice button
  Then: No pending state is set
        No pairs are created
        No qti-change events fire

AC-9: Scorer mode — correct associations display
  Given: role="scorer", correctResponse=["A B", "C D"], response=["A B", "E F"]
  When: The component renders
  Then: A "Correct Associations" section shows "A ↔ B" and "C ↔ D"
        In the "Current Associations" section, "A ↔ B" has success styling and a "Correct" badge
        "E ↔ F" does not have success styling

AC-10: Scorer mode — pair symmetry in correctness check
  Given: role="scorer", correctResponse=["A B"], response=["B A"]
  When: The component renders
  Then: The pair "B ↔ A" is shown with success styling and a "Correct" badge
  Notes: isCorrectPairMatch checks both "id1 id2" and "id2 id1" orderings.

AC-11: Scoring — canonical pair normalization
  Given: An item with correctResponse value "A B" and a student response of ["B A"]
  When: player.processResponses() is called
  Then: SCORE equals the full credit value
  Notes: Verifies that the scoring engine normalizes pair order before comparison.

AC-12: Scoring — partial credit via mapping
  Given: An item with a mapping (mapEntry mapKey="A B" mappedValue="1", mapKey="C D" mappedValue="1") and maxScore 2
         Student forms pairs ["A B"] only
  When: player.processResponses() is called
  Then: SCORE equals 1.0 and MAXSCORE equals 2.0

AC-13: Scoring — incorrect pairs score 0
  Given: An item with a mapping for pairs "A B" and "C D"
         Student forms pairs ["A C", "B D"] (wrong pairings)
  When: player.processResponses() is called
  Then: SCORE equals 0.0

AC-14: mapEntry key normalization
  Given: A responseDeclaration with mapEntry mapKey="B A" mappedValue="1"
         Student response contains "A B"
  When: player.processResponses() is called
  Then: SCORE equals 1.0
  Notes: parseMapping() in Player.ts sorts pair keys so "B A" and "A B" resolve to the same entry.

AC-15: shuffle=true randomizes choice order
  Given: An associateInteraction with shuffle=true and choices A, B, C, D in that XML order
  When: The component renders on multiple sessions
  Then: Choice buttons do not always appear in A-B-C-D order (probabilistic — test with multiple samples)
  Notes: Shuffle must be stable within a single render; re-rendering with the same data must not re-shuffle.

AC-16: prompt rendered when present
  Given: An associateInteraction with a non-empty prompt element
  When: The component renders
  Then: The prompt text appears above the choice grid with part="prompt" attribute

AC-17: No interaction data error state
  Given: The component is mounted with no interaction prop
  When: The component renders
  Then: An error message is shown (alert-error class) instead of the choice grid
        No JavaScript exception is thrown
```

### Accessibility

```
AC-A1: All choice buttons keyboard-operable
  Given: The component is rendered with 4 choices
  When: The user navigates with Tab to each button and presses Enter or Space
  Then: The button activates (pending state on first press, pair created on second press on a different button)
        No pointer events are required at any point

AC-A2: Pending state announced to screen reader
  Given: No choice is pending
  When: The user activates choice A
  Then: The choice A button communicates its selected/pending state to assistive technology
        (e.g., aria-pressed="true" or aria-selected="true")
        An aria-live region announces that A is selected and awaiting a second choice

AC-A3: Pair creation announced
  Given: Choice A is pending
  When: The user activates choice B
  Then: An aria-live region announces that the association "A and B" has been created

AC-A4: Remove button has accessible label
  Given: A pair "Variable ↔ Stores data" exists in the Current Associations list
  When: The remove button for that pair is inspected
  Then: The button's accessible name is "Remove association: Variable and Stores data" (or equivalent descriptive text), not "✕" alone

AC-A5: Touch target size
  Given: The component is rendered on a 375 px wide mobile viewport
  When: Choice buttons and remove buttons are measured
  Then: Each interactive element has a minimum rendered size of 44×44 CSS pixels

AC-A6: State not communicated by color alone
  Given: A pair has been formed and a different choice is pending
  When: The component is viewed without CSS color (e.g., high-contrast mode or color-blind simulation)
  Then: The ◉ indicator distinguishes the pending choice from formed choices (✓ indicator)
        Correct pairs in scorer mode are distinguishable by the "Correct" badge text
```

### Edge cases

```
AC-E1: Self-pairing prevented
  Given: Choice A is pending
  When: The user activates choice A (the same choice that is already pending)
  Then: The pair "A A" is NOT created (deselection behavior applies, per FR-3)
  Notes: The QTI spec does not explicitly forbid self-pairing, but it is nonsensical for association tasks and the component prevents it.

AC-E2: Duplicate pair not added
  Given: Pair "A B" already exists in the response
  When: The user attempts to create pair "A B" again (clicks A then B)
  Then: Either the pair is not added a second time, or the UI prevents the pairing (choices already in a pair should show as paired, not available for re-pairing)
  Notes: This is an implementation-level invariant; the current code allows re-pairing if matchMax > 1. Document actual behavior.

AC-E3: Response restoration
  Given: A session with previously saved response ["A B", "C D"]
  When: The component is mounted with response=["A B", "C D"]
  Then: Both pairs are shown in the Current Associations list on initial render
        No qti-change event fires on mount

AC-E4: G-01 — matchGroup absent, all choices offered as partners
  Given: An item with matchGroup="set-a" on choices A and B, matchGroup="set-b" on choices C and D
  When: The candidate selects choice A as pending
  Then: Choices C and D appear as clickable (no filtering occurs — G-01 is open)
  Notes: This is the known incorrect behavior until G-01 is fixed. Document that the acceptance criterion will invert once G-01 is resolved: after the fix, C and D must be visually inert when A (set-a) is pending.

AC-E5: G-06 — matchMin not enforced at submission
  Given: An item with matchMin=1 on choice A (A must be used at least once)
         The candidate submits without including A in any pair
  When: player.validateResponse() or submit is invoked
  Then: No validation error is surfaced for the unmet matchMin constraint (G-06 is open)
  Notes: This is the known gap. After G-06 is fixed, the criterion inverts: submission must be blocked with an appropriate accessibility-friendly error message.

AC-E6: maxAssociations=1 (default) limits to one pair
  Given: An associateInteraction with no maxAssociations attribute (default=1)
  When: A pair has been formed and the candidate tries to create a second pair
  Then: The second pair is not created

AC-E7: HTML content in choice text
  Given: A simpleAssociableChoice with text "<em>H<sub>2</sub>O</em>"
  When: The component renders
  Then: The button displays "H₂O" with subscript formatting (HTML is rendered, not escaped)
```

---

## Open questions

- [ ] **matchMax enforcement**: Should the UI disable choice buttons that have reached their `matchMax` usage count, or silently allow over-limit pairings and let response processing handle it? The current stance (no enforcement) is documented above, but a product decision on the UX trade-off may change this.
- [ ] **Duplicate pairs**: Does the component allow a candidate to form the same pair twice (when `matchMax > 1`)? The current code does not prevent it. Is this spec-correct behavior worth documenting with a test?
- [ ] **Self-pairing**: The spec does not explicitly forbid `"A A"`. Is there a valid assessment use case? Currently prevented by the component's deselect-on-same-click logic.

---

## Related

- QTI spec section: `docs/QTI_techguide.md` §3.1.3
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` §G-01 (matchGroup), §G-06 (matchMin validation)
- Response tracking and scoring: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Svelte component: `packages/default-components/src/plugins/associate/AssociateInteraction.svelte`
- Extractor: `packages/item-player/src/interactions/associate/extractor.ts`
- Type definitions: `packages/item-player/src/interactions/shared/types.ts` (`AssociateInteractionData`, `AssociableChoice`)
- Item body renderer: `packages/item-player/src/components/ItemBody.svelte`
- Pair normalization (scoring): `packages/item-player/src/core/Player.ts` `parseMapping()` and `packages/qti-processing/src/eval/evaluator.ts` `normalizeScalarForCompare()`
- Integration test: `packages/item-player/tests/core/interaction-plumbing.test.ts`
- Eval scenarios: `docs/evals/default-components/associate/evals.yaml`
- Adjacent interaction PRD (matchInteraction, directedPair): `docs/prds/interactions/match.md` (planned)
- Adjacent interaction PRD (graphicAssociateInteraction): `docs/prds/interactions/graphic-associate.md` (planned)
