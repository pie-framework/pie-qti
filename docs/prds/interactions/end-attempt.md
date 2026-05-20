# PRD: endAttemptInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: endAttemptInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`endAttemptInteraction` is a control button embedded inside a QTI `assessmentItem`'s `<itemBody>`. It is not a content interaction — it collects no candidate-provided answer. Instead, clicking it terminates the current attempt and triggers response processing. It is only meaningful in adaptive items (`adaptive="true"`). Common deployments are "I don't know" buttons, "Request a Hint" buttons, and "Submit this attempt" buttons in multi-attempt scaffolded items. The response variable it binds to is a `boolean` (`true` when clicked, `null` otherwise) which response processing can branch on to change scores, set `completionStatus`, or reveal feedback.

---

## Background and rationale

### Why `endAttemptInteraction` exists

Most QTI interactions let the candidate express content knowledge: they pick a choice, drag a token, type text. `endAttemptInteraction` is different — it lets the candidate signal a meta-level intent: "I am done with this attempt, process it now." In a non-adaptive item the player's chrome already provides a submit button, and `endAttemptInteraction` would be redundant. The value of `endAttemptInteraction` comes entirely from the adaptive item lifecycle, where response processing can run multiple times without closing the session.

### The adaptive item lifecycle in detail

A QTI `assessmentItem` carries an `adaptive` attribute (boolean, default `false`). Its value controls two fundamentally different session contracts:

**Non-adaptive (`adaptive="false"`):**
The item is submitted once. The player runs response processing, sets `completionStatus` to `"completed"`, and the session closes. There is no opportunity for the candidate to modify their answer after submission.

**Adaptive (`adaptive="true"`):**
The item session remains open until response processing itself sets `completionStatus` to `"completed"`. Between that moment and the initial `"not_attempted"` state, the session can cycle through `"unknown"` and `"incomplete"` as many times as the item XML permits. Each call to `submitAttempt()` runs response processing again. Response processing reads the current response variables — including the `endAttemptInteraction` boolean — and decides what to do: award partial credit, set an outcome variable that controls hint visibility, increment a scoring tier, or finally set `completionStatus = "completed"` to close the session.

This architecture gives item authors full programmatic control over branching without requiring any player-specific extension. The entire multi-attempt, hint-granting, score-tiering logic lives in the item XML. The player only needs to implement the session contract faithfully.

### The four built-in session variables

Every item session, adaptive or not, has four built-in variables initialised before the first submission:

| Variable | Type | Initial value | Purpose |
|---|---|---|---|
| `numAttempts` | `integer` (single) | `0` | Counts submissions where `countAttempt=true` |
| `completionStatus` | `identifier` (single) | `"not_attempted"` | Session lifecycle state |
| `duration` | `duration` (single) | `null` | Time spent on the item |
| `$dirty` | `boolean` (single) | `false` | Internal flag: response changed since last process |

`numAttempts` and `completionStatus` are the variables most relevant to `endAttemptInteraction`. Response processing can read them (via `<variable identifier="numAttempts"/>`) to implement logic like "if this is the second attempt, award half credit" or "if hint was requested, do not score".

### `completionStatus` state machine

The lifecycle states are ordered: `not_attempted` → `unknown` → `incomplete` → `completed`. Transitions are:

- On the first `submitAttempt()` call, the player promotes `completionStatus` from `"not_attempted"` to `"unknown"` before running response processing (if response processing does not set it explicitly).
- Response processing can explicitly set `completionStatus` to any value via `<setOutcomeValue identifier="completionStatus">`.
- Setting `completionStatus = "completed"` closes the session. Calling `submitAttempt()` on a completed session throws an error; the player must check `isCompleted()` before exposing submit controls.
- Setting `completionStatus = "incomplete"` signals "processed, but not done yet" — the candidate may continue. This is the value item authors use to keep the session open after a hint request or a failed attempt.

### The role of `endAttemptInteraction` in this lifecycle

`endAttemptInteraction` does not change `completionStatus` by itself. It merely sets a `boolean` response variable to `true` when clicked, which becomes visible to response processing when `submitAttempt()` is called. Response processing then branches on it:

```xml
<!-- Check whether the candidate clicked the "I don't know" button -->
<responseCondition>
  <responseIf>
    <match>
      <variable identifier="HINT_REQUEST"/>
      <baseValue baseType="boolean">true</baseValue>
    </match>
    <!-- Reveal hint, do not score, leave session incomplete -->
    <setOutcomeValue identifier="HINT_VISIBLE">
      <baseValue baseType="boolean">true</baseValue>
    </setOutcomeValue>
    <setOutcomeValue identifier="completionStatus">
      <baseValue baseType="identifier">incomplete</baseValue>
    </setOutcomeValue>
  </responseIf>
  <responseElse>
    <!-- Normal scoring pass -->
    <setOutcomeValue identifier="SCORE">
      <match>
        <variable identifier="RESPONSE"/>
        <correct identifier="RESPONSE"/>
      </match>
    </setOutcomeValue>
    <setOutcomeValue identifier="completionStatus">
      <baseValue baseType="identifier">completed</baseValue>
    </setOutcomeValue>
  </responseElse>
</responseCondition>
```

Crucially, the `endAttemptInteraction` button is not a "submit answer" button — the player's chrome provides that. It is a button whose _click_ is an input to response processing, just as selecting a choice is an input. The distinction matters for UX: a regular submit button belongs to the player shell; `endAttemptInteraction` belongs to the item content and can be positioned anywhere in the item body alongside pedagogical text.

### How `countAttempt` changes the semantics

The `countAttempt` attribute (default `true`) controls whether clicking the `endAttemptInteraction` increments `numAttempts`. Item authors use `countAttempt="false"` for hint requests or "show me an example" buttons where the click should not penalise the candidate. With `countAttempt=true` (the default and most common case), the click is treated as a full attempt submission. With `countAttempt=false`, the click triggers scoring without incrementing the attempt counter. This allows authors to offer multiple hints before the first "real" scored attempt.

In the PIE-QTI player, `countAttempt` is surfaced through the `getHintEndAttemptIdentifiers()` method on `Player`, which returns the `responseIdentifier` values of all `endAttemptInteraction` elements with `countAttempt=false`. The item player UI layer uses this to decide whether to call `submitAttempt(true)` or `submitAttempt(false)`.

### Why `endAttemptInteraction` is not a content interaction

The QTI spec distinguishes content interactions (which collect responses used in scoring) from control interactions. `endAttemptInteraction` is the only control interaction in QTI 2.x. Its `responseIdentifier` binds to a `boolean` response variable, but the variable's value is not scored directly — it is a signal that response processing reads to decide how to score the _other_ response variables. `getResponseInteractions()` on the player explicitly filters out `endAttemptInteraction` elements, which means response completeness checks and validation do not apply to it.

### How this differs from the player's submit button

A regular submit button in the player chrome submits all interactions at once, runs response processing, and closes the session (for non-adaptive items) or waits for `completionStatus` to be `"completed"` (for adaptive items). `endAttemptInteraction` is different in three ways:

1. It lives inside the item XML, authored by the item author, not added by the delivery player. The label and position are part of the item content.
2. It fires a `qti-change` event for _its own_ response variable (the `boolean`) without submitting any other interaction response.
3. The actual submission (calling `submitAttempt()`) is still triggered by the player infrastructure in response to the `qti-change` event. The button click sets the response variable to `true` and signals the player to process.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping to `qti-end-attempt-interaction` is in place)  
**Spec section:** §3.4.5 `endAttemptInteraction` (`docs/QTI_techguide.md`)

### Supported attributes on `endAttemptInteraction`

| Attribute | Required | Support | Behaviour |
|---|---|---|---|
| `responseIdentifier` | Required | Full | Extracted as `responseId`; bound to a `boolean` `ResponseDeclaration`; used as the `qti-change` event payload identifier |
| `title` | Required | Full | Displayed as the button label text. Must be human-readable (e.g., "I don't know", "Request Hint"). Defaults to `"End Attempt"` when absent. |
| `countAttempt` | Optional | Full | When `true` (default), clicking this button constitutes an attempt and increments `numAttempts`. When `false`, clicking triggers scoring without incrementing the attempt counter. Surfaced on `EndAttemptInteractionData` and used by the player's `getHintEndAttemptIdentifiers()` method. |

### Child elements

| Element | Support | Behaviour |
|---|---|---|
| `<prompt>` | Full | Optional HTML content displayed above the button. Extracted and rendered as `parsedInteraction.prompt`. May contain rich text, math, or formatted instructions explaining the button's purpose. |

### Response variable contract

- **baseType:** `boolean`
- **cardinality:** `single`
- **Value when clicked:** `true`
- **Value when not clicked (null/default):** `null` (the response declaration has no `defaultValue`; the absence of a click leaves the variable at its initial `null` state)
- **Standard response processing:** No standard template applies to `endAttemptInteraction` alone; it is always used with custom `responseCondition` branching. The evals use a minimal `responseCondition` that awards `SCORE=1` when `RESPONSE=true`.

### Adaptive item requirements

The QTI spec states that `endAttemptInteraction` is only meaningful when `adaptive="true"` is set on the parent `assessmentItem`. Placing it in a non-adaptive item is not prohibited by the XML schema, but the outcome is undefined — response processing runs once, the session closes, and the `boolean` variable is simply a part of the scored response like any other. The current implementation does not warn or block when `endAttemptInteraction` appears in a non-adaptive item.

### QTI 3.0 name mapping

In QTI 3.0, `endAttemptInteraction` maps to `qti-end-attempt-interaction`. The element name mapping layer in `@pie-qti/item-player` handles this transparently. The extractor's `elementTypes` array contains `'endAttemptInteraction'` only; QTI 3.0 elements are normalised to their 2.x names before extraction.

### Known gaps

There are no open spec-gap items in `docs/SPEC-GAPS-PLAN.md` that apply directly to `endAttemptInteraction`. The following are implementation limitations rather than spec gaps:

- **No warning for non-adaptive usage:** The extractor does not warn when `endAttemptInteraction` appears in an item where `adaptive="false"`. Item authors placing it in a non-adaptive item would get silent incorrect behaviour.
- **Response reset between attempts:** The QTI spec requires that `endAttemptInteraction` response variables are reset to `null` between attempts so the previous-click state does not contaminate the next scoring pass. The current `hasEnded` state in the component is synchronised from the `response` prop, but the player must ensure the boolean is reset to `null` (not `false`) before re-enabling the session for a second attempt.

---

## Functional requirements

- **FR-1:** When rendered, display a button whose visible label is the value of the `title` attribute.
- **FR-2:** When the button is clicked and `disabled` is `false` and the button has not already been activated in this attempt, set the response variable to `true` and dispatch a `qti-change` CustomEvent carrying `{ responseIdentifier, value: true }`.
- **FR-3:** After the button is activated, visually disable it and show a confirmation state (checkmark icon + "Attempt Ended" or "Requested" label). The button must not be clickable a second time within the same attempt.
- **FR-4:** When `disabled=true` is passed as a prop, the button must be non-interactive before activation and must not respond to clicks.
- **FR-5:** When the `response` prop is updated to `true` externally (e.g. session restore), reflect the activated/disabled visual state without requiring a button click.
- **FR-6:** When the `response` prop is updated to `null` or `false` externally (e.g. attempt reset), restore the button to its pre-click interactive state.
- **FR-7:** When `countAttempt=true` (default), the player must increment `numAttempts` before running response processing when this button triggers submission.
- **FR-8:** When `countAttempt=false`, the player must call `submitAttempt(false)` so `numAttempts` is not incremented.
- **FR-9:** When the `prompt` child element is present, render its HTML content above the button.
- **FR-10:** When `countAttempt=true` and the button has been clicked, display an inline warning message that communicates the attempt cannot be modified.
- **FR-11:** The interaction must only trigger one scoring pass per click. Rapid double-clicks must not result in two calls to `submitAttempt()`.
- **FR-12:** For adaptive items, after `endAttemptInteraction` triggers a scoring pass that leaves `completionStatus = "incomplete"`, the rest of the item interactions (e.g. a `choiceInteraction`) must remain interactive for the next attempt.

---

## Non-functional requirements

- **Accessibility:**
  - The button element must use a native HTML `<button>` element, not a `<div>` or `<span>`, so it is reachable by Tab and activatable by Enter/Space without custom key handlers.
  - The button must have an accessible label that communicates the action clearly. The `title` attribute value must be used as `aria-label` when the visible button label does not fully describe the action (e.g. when the button shows only an icon in activated state). The current implementation applies `aria-label={parsedInteraction.title}` unconditionally — this is the correct behaviour.
  - The button must never display the raw identifier `"endAttemptInteraction"` as its label. Authors must supply a `title` describing the action in plain language: "I don't know", "Request Hint", "Give Up", or equivalent.
  - The disabled state after activation must use the native `disabled` attribute (which removes the button from the tab sequence and prevents focus) rather than `aria-disabled` alone, since the interaction is genuinely complete.
  - The confirmation message shown after activation must be accessible to screen readers. It must not be hidden with `visibility: hidden` or `display: none`. The current implementation renders it conditionally inside the DOM with `{#if hasEnded && parsedInteraction.countAttempt}`, which is correct.
  - Touch targets on the button must be at least 44×44 CSS px (WCAG 2.2 SC 2.5.8). The `btn-lg` class from DaisyUI provides a target height of approximately 48px, satisfying this requirement.
- **Performance:** The button component is trivially lightweight. No performance constraints beyond the standard 16 ms render budget.
- **Cross-platform:** The button must be activatable by touch tap on mobile. Native `<button>` satisfies this. The `btn-lg` size class ensures an adequate touch target on small screens.
- **Security:** The `prompt` content is rendered via `{@html}`, which means it must be sanitized upstream by the item player's HTML sanitizer before reaching this component. The component trusts the values it receives.
- **i18n:** The post-click label text is translated under two keys:
  - `interactions.endAttempt.ended` (shown when `countAttempt=true`) — falls back to `"Attempt Ended"`
  - `interactions.endAttempt.requested` (shown when `countAttempt=false`) — falls back to `"Requested"`
  - The confirmation message `"Your attempt has been ended and can no longer be modified."` is currently a hard-coded string in the component and is not covered by the i18n provider. This is an open i18n gap.

---

## Design decisions

### Once-and-done activation within a single attempt

**Decision:** Once the button is clicked, `hasEnded` is set to `true` and the button is permanently disabled for the current attempt. There is no undo.  
**Rationale:** `endAttemptInteraction` in QTI is semantically a one-way gate: clicking it means "end this attempt now." Allowing it to be clicked again would either fire two `submitAttempt()` calls (breaking the adaptive lifecycle) or require complex deduplication logic. The spec does not define a way to "un-end" an attempt.  
**Alternatives considered:** Allowing the button to toggle (clicking again reverts to `null` state). Rejected: not specced, confusing UX, creates lifecycle bugs.  
**Consequences:** Item authors must not design items that require the candidate to click `endAttemptInteraction` more than once per attempt. If a session is reset for a new attempt, the button must be reset to its pre-click state by passing `response=null` from the player.

### Button state is driven by `response` prop, not internal state alone

**Decision:** `hasEnded` is a derived state that is synced from `parsedResponse` via `$effect`. If `response` is set externally to `null`/`false`, the button reverts to interactive.  
**Rationale:** Session restoration requires the player to set response variables from a stored session state. If the component relied only on internal `hasEnded` state set by clicks, restoring a session where the button had been previously clicked would show an interactive button despite the stored response being `true`. Syncing from the prop ensures correct visual state on restore.  
**Alternatives considered:** Treating `hasEnded` as purely internal state. Rejected: breaks session restore.  
**Consequences:** The `$effect` runs on every `parsedResponse` change, including redundant re-syncs where the value hasn't changed. This is harmless but means external code that sets `response` to `true` will trigger the activated visual state even if the button was never clicked in the current session.

### `countAttempt` controls the player's `submitAttempt()` call, not the component's event

**Decision:** The component always emits `qti-change` with `value=true` regardless of `countAttempt`. The `countAttempt` flag is metadata on the extracted interaction data that the player uses when deciding how to call `submitAttempt()`.  
**Rationale:** The component's responsibility is to faithfully represent the interaction state and fire the change event. Deciding whether the submission counts as an attempt is a player-level concern; conflating it with the component event would require the component to know about the player's scoring lifecycle, violating separation of concerns.  
**Alternatives considered:** Emit a different event or a flag in the event payload for `countAttempt=false`. Rejected: unnecessary coupling; the player already has access to `getHintEndAttemptIdentifiers()` to determine which interactions should not increment `numAttempts`.  
**Consequences:** The player must implement `getHintEndAttemptIdentifiers()` correctly and check it before calling `submitAttempt()`.

### `endAttemptInteraction` is excluded from response completeness checks

**Decision:** `getResponseInteractions()` in `Player.ts` explicitly filters out `endAttemptInteraction` elements. Response validation (`validateResponse()`) does not apply to `endAttemptInteraction` response variables.  
**Rationale:** Requiring the candidate to have clicked `endAttemptInteraction` before submitting would be backwards — the button is how they submit, not a prerequisite for submitting. Including it in completeness checks would force item authors to work around it or introduce confusing validation errors.  
**Alternatives considered:** Including `endAttemptInteraction` in completeness checks with a special `optional` flag. Rejected: adds complexity with no benefit.  
**Consequences:** Players that compute "have all interactions been answered?" must use `getResponseInteractions()`, not `getInteractions()`, to get the correct answer.

### Confirmation message only appears when `countAttempt=true`

**Decision:** The warning message "Your attempt has been ended and can no longer be modified" is only shown when `countAttempt=true`.  
**Rationale:** When `countAttempt=false` (hint request scenario), the candidate may still submit a real answer after requesting the hint. Showing a "cannot be modified" warning would be incorrect and alarming. The button still shows the activated "Requested" state, which is sufficient feedback.  
**Alternatives considered:** Always show some confirmation message. Rejected: the "cannot be modified" message implies session finality, which only applies when the attempt was counted.  
**Consequences:** Items that use `countAttempt=false` will not show a warning after the button click. Item authors relying on this for "give up" scenarios where the item truly ends should use `countAttempt=true`.

---

## Data model / contracts

### `EndAttemptInteractionData` (from `@pie-qti/item-player`)

Source: `packages/item-player/src/interactions/shared/types.ts`

```typescript
interface EndAttemptInteractionData extends BaseInteractionData {
  type: 'endAttemptInteraction';
  responseId: string;          // from responseIdentifier attribute
  prompt: string | null;       // HTML content of <prompt> child, or null
  title: string;               // from title attribute; defaults to "End Attempt"
  countAttempt: boolean;       // from countAttempt attribute; defaults to true
}
```

**Invariants enforced by extractor:**
- `title` is non-empty (error if blank after trim)
- `countAttempt=false` triggers an extractor validation warning (uncommon usage; flag for author review)

**Invariants that are NOT enforced:**
- The extractor does not verify that `adaptive="true"` is set on the parent `assessmentItem`. Non-adaptive usage is silently accepted.
- The extractor does not verify that the `responseIdentifier` resolves to a `ResponseDeclaration` with `baseType="boolean"` and `cardinality="single"`.

### Response variable contract (XML)

```xml
<!-- Required: ResponseDeclaration for endAttemptInteraction -->
<responseDeclaration identifier="HINT_REQUEST" cardinality="single" baseType="boolean"/>

<!-- The interaction element inside itemBody -->
<endAttemptInteraction responseIdentifier="HINT_REQUEST"
                       title="Request a Hint"
                       countAttempt="false">
  <prompt>Use this button to request a hint. This will not count against your score.</prompt>
</endAttemptInteraction>
```

The `correctResponse` element is not meaningful on a `boolean` response bound to `endAttemptInteraction` and must not be present. The value `true` is not "correct" — it is a signal. Response processing determines the outcome.

### `AdaptiveAttemptResult` (returned by `player.submitAttempt()`)

Source: `packages/item-player/src/core/Player.ts`

```typescript
interface AdaptiveAttemptResult extends ScoringResult {
  numAttempts: number;           // current value of the numAttempts built-in variable
  completionStatus: CompletionStatus; // 'not_attempted' | 'unknown' | 'incomplete' | 'completed'
  canContinue: boolean;          // true when isAdaptive() && !completed
}
```

When `canContinue=true`, the player UI should allow further interaction (the `endAttemptInteraction` button must be reset to interactive state for the next attempt if needed).

---

## Acceptance criteria

### Functional

```
AC-1: Button renders with authored title
  Given: an adaptive item with endAttemptInteraction title="I don't know"
  When: the item renders
  Then: a visible button labeled "I don't know" is present in the item body

AC-2: Button click sets response to true and fires qti-change
  Given: the item from AC-1 is rendered and the button has not been clicked
  When: the user clicks the button
  Then: a qti-change event fires with responseIdentifier matching the interaction's responseIdentifier
        and value=true; the response variable in the player is set to true

AC-3: Response is false/null before any click
  Given: the item from AC-1 is freshly rendered with no prior session state
  When: the player reads the response for the endAttemptInteraction's responseIdentifier
  Then: the value is null (not false, not undefined)

AC-4: Button disables immediately after click
  Given: the item from AC-1 is rendered
  When: the user clicks the button
  Then: the button has disabled=true; a second click within the same attempt does not fire a second
        qti-change event; the button cannot be re-activated by Enter or Space

AC-5: Activated state shows confirmation icon and changed label
  Given: countAttempt=true, button has been clicked
  When: the activated state is rendered
  Then: a checkmark icon is visible; the button text reads "Attempt Ended" (or i18n equivalent);
        a warning alert reads "Your attempt has been ended and can no longer be modified"

AC-6: countAttempt=false - no warning message, different label
  Given: an item with countAttempt="false" and button has been clicked
  When: the activated state is rendered
  Then: no warning alert appears; the button text reads "Requested" (or i18n equivalent)

AC-7: Scoring pass runs when endAttemptInteraction fires
  Given: an adaptive item with a custom responseCondition that awards SCORE=1 when the
         endAttemptInteraction boolean is true
  When: the user clicks the button and the player processes the submission
  Then: SCORE=1.0 is returned; the eval case end-attempt/end-attempt/correct passes

AC-8: Session stays open when completionStatus=incomplete after scoring
  Given: an adaptive item whose responseProcessing sets completionStatus="incomplete"
  When: the scoring pass completes
  Then: canContinue=true; the player does not close the session; other interactions remain
        interactive

AC-9: Session closes when completionStatus=completed after scoring
  Given: an adaptive item whose responseProcessing sets completionStatus="completed"
  When: the scoring pass completes
  Then: completed=true; canContinue=false; player.isCompleted() returns true

AC-10: numAttempts increments when countAttempt=true
  Given: an adaptive item with endAttemptInteraction countAttempt="true" (default)
         at initial numAttempts=0
  When: the button is clicked and submitAttempt() is called
  Then: player.getNumAttempts() returns 1 after the scoring pass

AC-11: numAttempts does not increment when countAttempt=false
  Given: an adaptive item with endAttemptInteraction countAttempt="false"
         at initial numAttempts=0
  When: the button is clicked and submitAttempt(false) is called
  Then: player.getNumAttempts() returns 0 after the scoring pass

AC-12: Response prop restore reflects activated state without click
  Given: an item where the endAttemptInteraction response variable is restored to true
         (e.g., from a saved session)
  When: the component receives response=true via the prop
  Then: the button immediately shows the activated/disabled visual state without a click event
        being needed; no qti-change event fires on restore

AC-13: Response reset to null restores interactive state
  Given: the button was clicked (hasEnded=true) and the player resets the response variable to null
         to begin a new attempt
  When: the component receives response=null
  Then: the button returns to its pre-click interactive state; disabled=false; the warning message
        is not shown

AC-14: Multiple endAttemptInteractions in one item each respond independently
  Given: an adaptive item with two endAttemptInteraction elements: HINT_REQUEST (countAttempt=false)
         and GIVE_UP (countAttempt=true)
  When: the user clicks HINT_REQUEST
  Then: only the HINT_REQUEST response variable is set to true; GIVE_UP remains null;
        only the HINT_REQUEST button is disabled; the GIVE_UP button remains interactive

AC-15: Not-clicked response evaluates to false/null in scoring, not true
  Given: the eval case end-attempt/end-attempt/wrong-not-ended
  When: the user navigates to the item and submits without clicking the button
  Then: RESPONSE is null or false; SCORE=0.0

AC-16: endAttemptInteraction is excluded from response completeness checks
  Given: an item with a choiceInteraction (unanswered) and an endAttemptInteraction
  When: the player checks whether all required interactions have a response
  Then: the endAttemptInteraction is not included in the completeness check;
        only the choiceInteraction's unanswered state marks the response incomplete

AC-17: prompt content renders above the button
  Given: an item whose endAttemptInteraction has a <prompt> containing "Click if stuck."
  When: the item renders
  Then: the text "Click if stuck." appears above the button in the DOM order

AC-18: disabled=true prop prevents click before activation
  Given: disabled=true is passed to the component and the button has not been clicked
  When: the user attempts to click the button or press Enter/Space on it
  Then: no qti-change event fires; the button retains its pre-click visual state

AC-19: Non-adaptive item with endAttemptInteraction processes without error
  Given: an assessmentItem with adaptive="false" containing an endAttemptInteraction
  When: the button is clicked and the player processes the response
  Then: response processing runs once; completionStatus is set to "completed";
        no JavaScript error is thrown (behaviour is defined even if not spec-recommended)

AC-20: Response variable resets correctly between attempts in adaptive scenario
  Given: an adaptive item where the first attempt sets the endAttemptInteraction to true,
         completionStatus is returned as "incomplete", and the player begins a new attempt
  When: the player resets the endAttemptInteraction response variable to null for the new attempt
  Then: response processing on the second attempt does not see the boolean as true unless the
        candidate clicks the button again
```

### Accessibility

```
AC-A1: Button is keyboard reachable by Tab
  Given: the item is rendered and keyboard focus is on the item body
  When: the user presses Tab
  Then: focus reaches the endAttemptInteraction button; it is visible in the focus order

AC-A2: Button is activatable by Enter and Space
  Given: the button has focus and has not been activated
  When: the user presses Enter or Space
  Then: the button activates; a qti-change event fires with value=true; the button becomes disabled

AC-A3: aria-label communicates the action
  Given: the item renders the endAttemptInteraction button
  When: a screen reader announces the button
  Then: the accessible name comes from the title attribute (e.g., "I don't know" or "Request Hint");
        the raw identifier "endAttemptInteraction" never appears in the accessible name

AC-A4: Disabled state after activation is announced by screen readers
  Given: the button has been activated (disabled=true, hasEnded=true)
  When: a screen reader navigates to the button
  Then: the button's disabled state is conveyed; screen readers should indicate it is unavailable
        (native disabled attribute handles this)

AC-A5: Confirmation message is in the DOM and accessible
  Given: countAttempt=true, button has been clicked
  When: a screen reader navigates to the item content after button activation
  Then: the warning message "Your attempt has been ended and can no longer be modified" is reachable
        in the DOM and readable; it must not be hidden via CSS that removes it from the a11y tree

AC-A6: Touch target meets minimum size requirement
  Given: the item is rendered on a mobile viewport (375px wide)
  When: the button is measured
  Then: the button's tappable area is at least 44×44 CSS px per WCAG 2.2 SC 2.5.8
```

### Edge cases

```
AC-E1: Title attribute absent - fallback label
  Given: an endAttemptInteraction element with no title attribute
  When: the extractor processes the element
  Then: title defaults to "End Attempt"; the extractor does not return an error

AC-E2: Empty title - extractor error
  Given: an endAttemptInteraction with title=""
  When: the extractor validates the extracted data
  Then: the extractor returns a validation error: "endAttemptInteraction must have a title"

AC-E3: countAttempt=false - extractor warning
  Given: an endAttemptInteraction with countAttempt="false"
  When: the extractor validates the extracted data
  Then: the extractor returns a validation warning about uncommon usage; no error; the interaction
        is still extracted successfully

AC-E4: interaction prop arrives as JSON string (web component usage)
  Given: the component is used as a native web component with interaction prop as a JSON string
  When: the component mounts
  Then: parseJsonProp correctly deserialises the string; the button renders with the correct title;
        no "No interaction data provided" error alert appears

AC-E5: Interaction data absent (null/undefined interaction prop)
  Given: the component is mounted with no interaction prop
  When: the component renders
  Then: an error message "No interaction data provided" appears in place of the button;
        no JavaScript error is thrown
```

---

## Open questions

- [ ] **Response variable reset protocol between attempts:** The spec is clear that response variables bound to `endAttemptInteraction` should be reset to `null` at the start of each new attempt so the prior-click state does not bleed into the next scoring pass. The current player code (`submitAttempt()`) does not appear to explicitly reset `boolean` response variables before running response processing. Verify that the adaptive attempt cycle resets the `endAttemptInteraction` response variable; add a regression test if it does not.
- [ ] **i18n coverage for the hard-coded confirmation message:** "Your attempt has been ended and can no longer be modified." is not covered by an i18n key. A follow-up should add `interactions.endAttempt.endedMessage` to the i18n framework and use it in the component.
- [ ] **Non-adaptive item warning:** Should the extractor or the player emit a warning when `endAttemptInteraction` appears in an item where `adaptive="false"`? Currently silent. Decide whether this is a validation error, a warning, or intentionally permitted.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.4.5 `endAttemptInteraction`
- Response tracking and scoring: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps plan: `docs/SPEC-GAPS-PLAN.md` (no direct gap items for this interaction)
- Evals: `docs/evals/default-components/end-attempt/evals.yaml`
- Implementation — Svelte component: `packages/default-components/src/plugins/end-attempt/EndAttemptInteraction.svelte`
- Implementation — extractor: `packages/item-player/src/interactions/end-attempt/extractor.ts`
- Implementation — types: `packages/item-player/src/interactions/shared/types.ts` (`EndAttemptInteractionData`)
- Implementation — player: `packages/item-player/src/core/Player.ts` (`submitAttempt`, `isAdaptive`, `getHintEndAttemptIdentifiers`)
- Adjacent PRDs: `docs/prds/architecture/response-processing.md`, `docs/prds/architecture/item-player.md`
