# PRD: orderInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: orderInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft
**Type:** interaction
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)
**Last reviewed:** 2026-04-28

---

## Summary

`orderInteraction` is the QTI interaction type for sequencing tasks: the candidate must arrange a set of choices into a specific order. It is used for timeline questions, process-step sequencing, and ranked ordering. The implementation renders `simpleChoice` elements as a drag-and-drop sortable list with full keyboard and touch support, emits `qti-change` events on every reorder, requires explicit confirmation before the response is committed, and uses an `ordered`-cardinality response variable (position matters, not just membership) for all-or-nothing `MATCH_CORRECT` scoring.

---

## Background and rationale

**Why `ordered` cardinality matters for scoring**: Unlike `choiceInteraction`, where a `multiple`-cardinality response is a set of identifiers (order irrelevant), `orderInteraction` uses `ordered` cardinality — the response is an ordered sequence. `["A","B","C"]` and `["A","C","B"]` are two distinct responses. The `match` operator in QTI response processing performs a positional equality check on `ordered` variables: every element must be at the same index. This is why `MATCH_CORRECT` is the canonical template — there is no partial credit at the element level unless the item author writes custom response processing. Item authors who want partial credit (e.g., "2 points if at least 3 items are in the correct position") must use inline `responseCondition` XML, not a standard template.

**Why a confirmation button is required (WCAG 2.2 SC 3.3.4)**: WCAG 2.2 Success Criterion 3.3.4 (Error Prevention — Legal, Financial, Data) requires that submissions which are consequential be reversible, checkable, or confirmable. A drag-reorder gesture is a low-friction, accidentally-triggerable action: a small misclick can produce a different order. Without a confirmation step, the candidate could inadvertently submit a wrong order. The "Confirm Order" button gives the candidate an explicit, reversible commitment point before the response is recorded. The button auto-confirms after a drag (the act of dragging is intentional), but the confirmation state is reset whenever the response is cleared externally, allowing the candidate to undo by their session manager clearing the response and requiring re-confirmation.

**Why drag-and-drop needs a keyboard-equivalent interaction**: The native HTML5 drag API is inaccessible to keyboard-only users and is unreliable on touch devices. The `SortableList` component implements a two-phase keyboard pattern: (1) `Space` or `Enter` "grabs" the focused item and enters move mode; (2) arrow keys reposition the grabbed item one slot per keypress; (3) `Space` or `Enter` drops it. This pattern is described in the W3C ARIA "Sortable List" authoring practice and is the minimum required by WCAG 2.1 SC 2.1.1 (Keyboard). Touch support is provided by `touchDrag` from `@pie-qti/qti-common`, which intercepts `touchstart`/`touchmove`/`touchend` events and synthesizes the equivalent `dragstart`/`dragover`/`drop` events so the same mouse-drag logic handles touch without duplication.

**Why choices are presented as draggable `<button>` elements, not a `<ul>/<li>` list with a drag-handle role**: Each item must be keyboard-focusable and keyboard-operable as a first-class interactive control. `<button>` provides this natively (tab-focusable, activatable with Space/Enter, announced by screen readers as a button). The `role="list"` / `role="listitem"` wrapper around the buttons provides list semantics to screen readers without removing the button interactivity. An alternative using `role="listbox"` / `role="option"` with `aria-grabbed` was considered but `aria-grabbed` was deprecated in ARIA 1.2 and browser support is unreliable; the button-in-list pattern with live-region announcements is more robust.

**Why `shuffle` is extracted but not applied by the component**: The `shuffle` attribute signals that the item author wants choices presented in a randomized initial order. The actual randomization must happen before the interaction data reaches the component, so that the shuffled order can be persisted in the session (the candidate must see the same shuffled order on resume). The item player's `Player` class owns an `rng` function (seeded or `Math.random`) and is the correct place to apply shuffling as a post-extraction transformation. Currently, no code path in the player applies `shuffle` to the `choices` array before rendering — `shuffle` is extracted and passed through but the array order is unchanged. This is a known gap. The `SortableList` component receives `orderedIds` (the display order), which is populated from the response on resume, so the resume path works correctly once an order has been confirmed.

**Why `minChoices` and `maxChoices` are not extracted into `OrderInteractionData`**: The QTI spec allows `orderInteraction` to have fewer choices in the response than are presented — `minChoices` sets the lower bound, `maxChoices` the upper bound, on the number of items the candidate must place. Both are absent from `OrderInteractionData` (the type used by the component) and are not extracted by `standardOrderExtractor`. This is an unimplemented gap. In the common case all choices must be ordered (no `minChoices`/`maxChoices` constraints), which is why this was not prioritised. Items that use these attributes to present a "pick and rank" UI (e.g., "select and rank the top 3 from this list of 6") will silently ignore the constraints and require all choices to be placed.

**Why a separate `OrderData` extractor type exists alongside `OrderInteractionData`**: The extractor produces `OrderData` (from `packages/item-player/src/extraction/extractors/orderExtractor.ts`), which includes `fixed` per choice and `orientation`. The component uses `OrderInteractionData` (from `packages/item-player/src/types/interactions.ts`), which does not declare `fixed` or `orientation`. `Player.getInteractions()` spreads the extracted data onto the base type at line 489 of `Player.ts`, so `fixed` and `orientation` are present at runtime on the object the component receives — they are just not in the TypeScript type. This means `fixed` is silently passed to the component but the component does not use it: `SortableList` treats all choices as shuffleable regardless of their `fixed` flag.

**Why `ordered` cardinality response is `string[]` not a QTI container type**: The component emits and accepts `string[]` (an array of identifiers). The item player's `Player` class knows the response variable has `ordered` cardinality and serialises/deserialises accordingly. This keeps the component interface simple and avoids coupling the component to the QTI variable system.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place via `qti-order-interaction`)
**Spec section:** §3.1.2 orderInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `orderInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | Full | Extracted as `responseId`; used in `qti-change` event payload |
| `shuffle` | Partial | Extracted as `shuffle: boolean`; passed to component. **The component does not apply the shuffle** — choices are rendered in authored order regardless of this flag. See Known gaps. |
| `orientation` | Partial | Extracted by `standardOrderExtractor` as `orientation` (`'vertical'` \| `'horizontal'`); defaults to `'vertical'`. Reached component via runtime spread but not in `OrderInteractionData` TypeScript type. The `SortableList` component reads `orientation` and adjusts arrow-key axis and flex layout direction accordingly. |
| `minChoices` | Not extracted | Spec defines minimum number of choices in the response. Not in `OrderInteractionData`. Not enforced. All choices are always required. See Known gaps. |
| `maxChoices` | Not extracted | Spec defines maximum number of choices in the response. Not in `OrderInteractionData`. Not enforced. See Known gaps. |

### Supported attributes on `simpleChoice`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | Full | Required; deduplicated; used as list item key, in `qti-change` payload, and in response |
| `fixed` | Partial | Extracted by `standardOrderExtractor` as `fixed?: boolean` on the choice object; passed to component via runtime spread. **The component does not honour `fixed`** — all choices are draggable regardless. See Known gaps. |
| class (CSS classes) | Partial | Extracted as `classes?: string[]`; not rendered as CSS classes by default component but available for custom renderer detection |
| `templateIdentifier` | Not implemented | Template-variable-driven conditional visibility. Not supported. |
| `showHide` | Not implemented | Companion to `templateIdentifier`. Not supported. |

### Response variable contract

- **baseType:** `identifier`
- **cardinality:** `ordered`
- **Value format:** `string[]` — an ordered array of `identifier` strings, one per placed choice
- **Null/empty:** `null` before any interaction; `[]` after clearing a response. The component treats `null` and `[]` equivalently as "unconfirmed".
- **Scoring:** The `match` operator on `ordered` cardinality performs positional equality. `["A","B","C"]` matches only `["A","B","C"]`; partial matches score 0.

### Standard response processing templates

- **MATCH_CORRECT** — canonical template for `orderInteraction`. Sets `SCORE=1.0` (or `MAXSCORE` value) when the entire ordered sequence matches `correctResponse`. Sets `SCORE=0.0` otherwise. All-or-nothing; no built-in partial credit.
- Custom `responseCondition` XML — can be used to award partial credit by counting correctly-positioned items (e.g., using `index` and `match` operators in a loop), but this requires explicit item authoring and is not surfaced by any standard template.

### Known gaps

- **Shuffle not applied (unimplemented):** When `shuffle=true`, choices should be presented in a randomised order that is stable for the session. Currently no code path in the item player or component applies this shuffle. A future implementation should randomise `choices` in `Player.getInteractions()` after extraction, using the player's seeded `rng`, and respect `fixed=true` items (which must retain their authored index).

- **`fixed` on `simpleChoice` not honoured (unimplemented):** When `shuffle=true`, choices with `fixed=true` should remain in their authored position while unfixed choices are shuffled around them. The `fixed` flag is extracted into `OrderData.choices[*].fixed` but `SortableList` does not use it — all items are draggable and can be repositioned.

- **`minChoices`/`maxChoices` not extracted (unimplemented):** Items that require the candidate to rank a subset of choices (e.g., "order the top 3 from this list of 6") cannot be represented. Both constraints are absent from `OrderInteractionData`. When present in QTI XML, they are silently ignored and all choices are treated as required.

- **G-09 (PNP elimination tool):** When `pnp.cognitive.eliminationTool` is enabled, an eliminate/dismiss button should appear per choice. Not implemented. Tracked in `docs/SPEC-GAPS-PLAN.md`.

---

## Functional requirements

- **FR-1:** Render each `simpleChoice` as a draggable list item in a `role="list"` container. Each item must show a position badge (1-based index), a drag handle icon, and the choice text.
- **FR-2:** Support mouse drag-and-drop reordering: drag any item to any other position; the item replaces the target and all others shift accordingly.
- **FR-3:** Support touch drag reordering: a single-touch press and drag must move items the same way mouse drag does. Multi-touch must not trigger drag (single-touch only).
- **FR-4:** Support keyboard reordering: `Space` or `Enter` grabs the focused item; arrow keys (Up/Down for vertical, Left/Right for horizontal) move the grabbed item one position per press; `Space` or `Enter` drops it; `Escape` cancels the grab without changing order.
- **FR-5:** After every reorder (drag or keyboard), auto-confirm the response and emit a `qti-change` CustomEvent with `{ responseIdentifier, value: string[] }` from the root element. The event must bubble.
- **FR-6:** Show a "Confirm Order" button when the response has not yet been confirmed (e.g., first mount with no prior response). Clicking "Confirm Order" commits the current displayed order and emits `qti-change`.
- **FR-7:** When the candidate has not reordered any items, the confirm button must show "Confirm Order (No Changes)" to make the default state explicit.
- **FR-8:** After confirmation, show a success badge ("Order confirmed") and hide the confirm button.
- **FR-9:** Announce all keyboard movements to screen readers via an `aria-live="polite"` region. Messages must include item name, new position, and total positions.
- **FR-10:** When `disabled=true`, all drag handles must have `draggable=false`, all items must be visually de-emphasised (`opacity: 0.55`), and no interaction events may fire.
- **FR-11:** When `role='scorer'` and `correctResponse` is provided, highlight each item with a success colour when it is in the correct position (i.e., its index in the current order matches its index in `correctResponse`). Do not reveal correct positions to any other role.
- **FR-12:** Render the `prompt` HTML content above the sortable list when present.
- **FR-13:** Accept a `response` prop (string[]) and restore the displayed order from it on mount without emitting a `qti-change` event.
- **FR-14:** Reset confirmation state when `response` is externally cleared (set to `null` or `[]`).
- **FR-15:** Support vertical orientation (default) and horizontal orientation, controlled by the `orientation` value from extracted data.

---

## Non-functional requirements

### Accessibility

WCAG 2.2 Level AA compliance is mandatory for all default components.

- **Keyboard drag pattern (SC 2.1.1):** The grab → move → drop pattern with Space/Enter and arrow keys is mandatory. Arrow keys must respect orientation: Up/Down for `vertical`, Left/Right for `horizontal`.
- **Focus management (SC 2.4.3):** After a keyboard drop, focus must remain on the dropped item at its new position.
- **Live region announcements (SC 4.1.3):** All position changes must be announced via `aria-live="polite"` with messages in the format: `"{item} moved to position {N} of {total}"`. Grab, drop, and cancel must each have their own message. Messages are i18n-keyed (see `interactions.order.*` keys).
- **Static instructions for screen readers:** An `aria-describedby` pointing to a visually hidden instructions element must be present on the list container. The instructions explain the grab → arrow → drop pattern.
- **`aria-grabbed` (SC 4.1.2):** Each list item button must carry `aria-grabbed={isGrabbed}` to reflect grab state.
- **Touch targets (SC 2.5.8):** Each sortable item must be at least 44×44 CSS px on a 375-px viewport.
- **`disabled` accessibility:** When `disabled=true`, items must have `disabled` attribute (native button disabled) so assistive technologies announce them as non-interactive.
- **Confirmation button (SC 3.3.4):** The "Confirm Order" button must have an `aria-label` that fully describes the action (`'Confirm this order as your answer'`) and must be reachable by Tab.
- **Colour-only feedback (SC 1.4.1):** Correct-position highlighting must not rely on colour alone. The implementation uses both a colour change and a "Correct" badge text label.

### Performance

- Extraction and initial render must complete in under 16 ms for up to 10 choices on a mid-range mobile device.
- Shadow DOM prevents host-page style recalculation from affecting component layout.

### Cross-platform

- Touch drag must work on iOS Safari and Chrome for Android. The `touchDrag` Svelte action synthesises drag events from touch events to reuse the same mouse-drag logic.
- Horizontal orientation must wrap on narrow viewports without overflow.
- Drag handles must be large enough for touch targets (see accessibility).

### i18n

All user-visible strings pass through the `i18n` provider. The keys used are:

| Key | Default (en-US) | Description |
|-----|----------------|-------------|
| `interactions.order.instruction` | `'Drag items to reorder them'` | Instruction text below the confirm button |
| `interactions.order.keyboardInstructions` | `'Press Space or Enter to grab an item. Use arrow keys to move the item. Press Space or Enter again to drop. Press Escape to cancel.'` | Screen-reader-only instructions string |
| `interactions.order.listLabel` | `'Reorderable list of choices'` | `aria-label` on the list container |
| `interactions.order.confirmOrder` | `'Confirm Order'` | Button label when user has reordered |
| `interactions.order.confirmOrderNoChanges` | `'Confirm Order (No Changes)'` | Button label when order unchanged |
| `interactions.order.confirmAria` | `'Confirm this order as your answer'` | `aria-label` on confirm button |
| `interactions.order.itemGrabbed` | `'{item} grabbed. Current position {position} of {total}. Use arrow keys to move, Space or Enter to drop.'` | Live region — item grabbed |
| `interactions.order.itemDropped` | `'{item} dropped at position {position} of {total}'` | Live region — item dropped |
| `interactions.order.itemMoved` | `'{item} moved to position {position} of {total}'` | Live region — item moved by arrow key |
| `interactions.order.selectionCancelled` | `'{item} selection cancelled'` | Live region — Escape pressed |

All locales in `packages/i18n/src/locales/` carry translations for the `interactions.order` namespace.

### Security

Choice text is rendered via `{@html}` (via `SortableList`). Content is sanitized upstream by the item player's HTML sanitizer before the component receives it. The component trusts `interaction.choices[*].text` as safe HTML. No user-supplied values are injected into HTML.

---

## Design decisions

### Drag auto-confirms; first render requires explicit confirmation

**Decision:** A drag gesture auto-confirms the response (sets `hasConfirmed = true` and emits `qti-change`). Initial mount with no prior response requires the candidate to click "Confirm Order".

**Rationale:** Dragging is an intentional gesture — the candidate has actively changed the order and the system should record it. However, on first render, the displayed order is the authored order (or a shuffled order), and the candidate may not have formed an intent. Requiring confirmation prevents a null-order being silently submitted if the candidate simply pages past the item without interacting. WCAG 2.2 SC 3.3.4 motivates this pattern.

**Alternatives considered:** Always require explicit confirmation (even after drag). Rejected: too much friction for candidates who are actively dragging multiple times. Always auto-confirm including on mount. Rejected: violates SC 3.3.4 and would record the authored/shuffled order for candidates who skipped the item.

**Consequences:** If `response` is pre-populated (session restore), `hasConfirmed` starts as `false` and the confirm button appears. This is intentional — the candidate should confirm they intend to keep the restored order. The `$effect` that resets `hasConfirmed` on response clear handles the session-resume case cleanly.

### `SortableList` uses HTML5 drag events; touch support added via a Svelte action

**Decision:** Mouse drag is handled by native HTML5 drag events (`dragstart`, `dragover`, `drop`). Touch drag is provided by the `touchDrag` Svelte action (from `@pie-qti/qti-common`), which synthesises the same drag events from touch input.

**Rationale:** Native drag events are well-supported on desktop and provide accessible drag semantics. Synthesising drag events from touch rather than implementing a parallel touch-only reorder path avoids duplicating the drop logic. The 10-pixel drag threshold in `touchDrag` prevents accidental drags from scroll gestures.

**Alternatives considered:** A third-party drag library (dnd-kit, SortableJS). Rejected: adds bundle weight, introduces version-drift risk, and complicates shadow DOM compatibility. A custom pointer-event handler for both mouse and touch. Rejected: more complex than the synthesis approach and loses native drag semantics.

**Consequences:** The `touchDrag` action dispatches `DragEvent` instances via `document.elementFromPoint`, which may miss elements hidden behind the dragged item's opacity change. The action sets `opacity: 0.5` on the node during drag, which is separate from the Svelte class bindings. If a future maintainer adds another drag library, these opacity side-effects should be removed.

### Keyboard movement triggers `onReorder` immediately (live preview)

**Decision:** Each arrow-key press while an item is grabbed calls `moveItem()`, which invokes `onReorder()` immediately and emits a `qti-change` event. The order changes are visible live as the candidate presses arrow keys.

**Rationale:** Live preview provides immediate confirmation to the candidate that their keyboard input is working. Screen-reader users receive position announcements on each key press. An alternative where the drop is only applied on Space/Enter would require maintaining a shadow copy of the order during the grab, adding complexity. The QTI response model allows the response to be overwritten multiple times before submission.

**Consequences:** Each arrow-key press emits a `qti-change` event. Consumers who listen to `qti-change` for analytics purposes should be aware that multiple events may fire during a single keyboard drag session.

### Props accept both parsed objects and JSON strings (web component compatibility)

**Decision:** `interaction`, `response`, `correctResponse`, and `i18n` are each parsed with `parseJsonProp` before use.

**Rationale:** When the component is used as a native web component (via HTML attributes), prop values arrive as strings. When used as a Svelte component inside the item player, they arrive as typed objects. `parseJsonProp` handles both transparently. This avoids a separate web-component wrapper.

**Consequences:** There is a small runtime cost of attempting JSON.parse on every reactive update for the web component case. This is negligible for the data sizes involved.

### Position badges are visible numbers, not ARIA-only

**Decision:** Each item displays a visible 1-based position badge (e.g., "1", "2", "3") as part of its visual layout.

**Rationale:** Sighted candidates need to see the current position of each item at a glance. A position badge is the most direct visual affordance. Screen readers receive position via `aria-label` on the button (e.g., "Step 1. Position 2 of 4").

**Consequences:** The badge updates on every reorder, which may cause visual flicker on rapid moves. The badge uses DaisyUI `badge` classes with inline fallback CSS via CSS custom properties so it works without DaisyUI loaded.

---

## Data model / contracts

### `OrderInteractionData` (from `@pie-qti/item-player`)

```typescript
interface OrderInteractionData extends BaseInteractionData {
  type: 'orderInteraction';
  responseId: string;     // from responseIdentifier attribute
  shuffle: boolean;       // authored shuffle preference (NOT applied by component; see Known gaps)
  prompt: string | null;  // HTML content of <prompt> child, or null
  choices: Array<{
    identifier: string;   // from simpleChoice identifier attribute
    text: string;         // HTML content of simpleChoice
  }>;
}
```

**Note on runtime-only fields:** The `standardOrderExtractor` produces additional fields that are spread onto the interaction object at runtime but are not declared in `OrderInteractionData`:

- `orientation?: 'vertical' | 'horizontal'` — defaults to `'vertical'`; used by `SortableList` to orient the list and bind arrow keys
- `choices[*].fixed?: boolean` — indicates a choice must not move during shuffle; currently unused by the component

**Invariants enforced by `standardOrderExtractor.validate()`:**
- `choices` has at least 2 entries (error if fewer)
- All `identifier` values are non-empty (error on empty)
- All `identifier` values are unique within the interaction (error on duplicate)
- More than 10 choices produces a warning (usability, not a hard error)

**Response type:**
```typescript
// In InteractionResponseMap (packages/item-player/src/types/interactions.ts)
orderInteraction: string[]
// An ordered array of simpleChoice identifiers in candidate-selected order.
// Null-equivalent: null before confirmation, [] after response clear.
```

**`qti-change` event payload:**
```typescript
{
  detail: {
    responseIdentifier: string,  // from parsedInteraction.responseId
    value: string[]              // ordered array of identifiers
  }
}
```

---

## Acceptance criteria

### Functional

```
AC-1: Initial render shows all choices
  Given: an orderInteraction with 4 simpleChoices (ChoiceA, ChoiceB, ChoiceC, ChoiceD)
  When: the item renders at /item-demo/order-interaction
  Then: all 4 choices are visible as draggable list items; each has a position badge (1–4)
  Notes: choices appear in authored XML order (shuffle not yet applied by default component)

AC-2: Drag reorder updates displayed order and fires qti-change
  Given: the item from AC-1 with choices in order A, B, C, D
  When: the candidate drags ChoiceD to the first position
  Then: the displayed order becomes D, A, B, C;
        a qti-change event fires with value=["ChoiceD","ChoiceA","ChoiceB","ChoiceC"]

AC-3: Drag auto-confirms response
  Given: the item from AC-1 with confirm button visible
  When: the candidate drags any item
  Then: hasConfirmed becomes true; the confirm button is replaced by the "Order confirmed" badge;
        qti-change fires with the new order

AC-4: Confirm button commits current order without dragging
  Given: the item from AC-1 at initial render with no prior response
  When: the candidate clicks "Confirm Order (No Changes)"
  Then: qti-change fires with value=["ChoiceA","ChoiceB","ChoiceC","ChoiceD"] (authored order);
        the confirm button is replaced by the "Order confirmed" badge

AC-5: Correct ordering scores full marks
  Given: the order-interaction sample (science method item; correct answer: A→B→C→D)
  When: the candidate drags items to order A, B, C, D and submits
  Then: SCORE=2.0, MAXSCORE=2.0

AC-6: Incorrect ordering scores zero
  Given: the same item as AC-5
  When: the candidate places items in order D, C, B, A and submits
  Then: SCORE=0.0, MAXSCORE=2.0
  Notes: all-or-nothing; no partial credit from MATCH_CORRECT

AC-7: Response prop restores order on mount
  Given: an item with response=["ChoiceC","ChoiceA","ChoiceD","ChoiceB"] passed on mount
  When: the component renders
  Then: choices appear in order C, A, D, B; no qti-change event fires on initial render

AC-8: Clearing response resets confirmation state
  Given: the item with response confirmed and confirm button hidden
  When: the response prop is set to null or []
  Then: hasConfirmed resets to false; the confirm button reappears

AC-9: disabled=true prevents all interaction
  Given: the item rendered with disabled=true
  When: the candidate attempts to drag, keyboard-reorder, or click confirm
  Then: no item moves; no qti-change fires; items appear at reduced opacity (0.55);
        draggable attribute is false on all items

AC-10: Scorer role shows correct positions
  Given: the item rendered with role="scorer" and correctResponse=["ChoiceA","ChoiceB","ChoiceC","ChoiceD"]
        and current response=["ChoiceA","ChoiceC","ChoiceB","ChoiceD"]
  When: the item renders
  Then: ChoiceA and ChoiceD have green success highlighting and a "Correct" badge
        (positions 1 and 4 match); ChoiceB and ChoiceC have no special styling
  Notes: a choice is "correct" only if it is at the same index in both response and correctResponse

AC-11: Candidate role does not reveal correct positions
  Given: the item rendered with role="candidate" and correctResponse populated
  When: the item renders
  Then: no choice has a "Correct" badge or green styling; all choices look identical

AC-12: Prompt renders above the list
  Given: an orderInteraction with a <prompt> child element
  When: the item renders
  Then: the prompt HTML appears above the sortable list
```

### Accessibility

```
AC-A1: Keyboard grab and move — vertical orientation
  Given: the item from AC-1 rendered with orientation=vertical (default)
  When: the candidate Tabs to ChoiceC and presses Space
  Then: ChoiceC is "grabbed" (aria-grabbed=true; visual highlight; live announcement reads
        "ChoiceC grabbed. Current position 3 of 4. Use arrow keys to move, Space or Enter to drop.")
  When: the candidate presses ArrowUp
  Then: ChoiceC moves to position 2; ChoiceB moves to position 3;
        live region announces "ChoiceC moved to position 2 of 4"
  When: the candidate presses Space
  Then: ChoiceC is dropped; live region announces "ChoiceC dropped at position 2 of 4";
        focus remains on ChoiceC at its new position

AC-A2: Keyboard cancel with Escape
  Given: ChoiceC has been grabbed as in AC-A1
  When: the candidate presses Escape before dropping
  Then: ChoiceC returns to its original position; live region announces "ChoiceC selection cancelled";
        aria-grabbed becomes false

AC-A3: Keyboard move — horizontal orientation
  Given: an item with orientation=horizontal
  When: an item is grabbed and the candidate presses ArrowRight
  Then: the item moves one position to the right; ArrowLeft moves it left;
        ArrowUp and ArrowDown have no effect on the order

AC-A4: Screen-reader instructions are present but visually hidden
  Given: any orderInteraction item rendered
  When: a screen reader reaches the list container
  Then: aria-describedby points to a visually-hidden element containing the keyboard instructions text

AC-A5: Touch drag moves items
  Given: the item rendered on a touch device (or with Touch emulation active)
  When: the candidate touches and drags one item to another position
  Then: the item moves to the new position; qti-change fires with the updated order;
        the dragged item returns to normal opacity after release

AC-A6: Touch targets meet minimum size
  Given: any orderInteraction rendered on a 375-px viewport
  When: each sortable item button is measured
  Then: every item has a clickable area of at least 44×44 CSS px per WCAG 2.2 SC 2.5.8

AC-A7: Confirm button is keyboard accessible
  Given: the item at initial render with confirm button visible
  When: the candidate Tabs to the "Confirm Order" button and presses Space or Enter
  Then: the response is confirmed; qti-change fires; the button is replaced by the success badge;
        focus moves to the next logical element (or the badge)

AC-A8: Disabled state is announced by screen readers
  Given: the item rendered with disabled=true
  When: a screen reader reaches any sortable item button
  Then: the button is announced as "dimmed" or "unavailable" (native disabled attribute)
```

### Edge cases

```
AC-E1: Minimum 2 choices — validator enforces
  Given: a QTI XML with only 1 simpleChoice
  When: standardOrderExtractor.validate() is called
  Then: errors includes "orderInteraction must have at least 2 choices"; valid=false

AC-E2: 10+ choices produces a warning only
  Given: an orderInteraction with 11 simpleChoices
  When: standardOrderExtractor.validate() is called
  Then: valid=true; warnings includes a message about usability with 11 choices

AC-E3: Duplicate identifiers are rejected
  Given: two simpleChoices both with identifier="A"
  When: standardOrderExtractor.validate() is called
  Then: errors includes "Duplicate choice identifier: A"; valid=false

AC-E4: shuffle=true passes through to interaction data
  Given: an orderInteraction with shuffle="true"
  When: standardOrderExtractor.extract() is called
  Then: result.shuffle === true
  Notes: the component does not apply this shuffle; authored order is preserved in rendering
         until the shuffle gap is resolved

AC-E5: fixed attribute is extracted on choices
  Given: an orderInteraction where the third choice has fixed="true"
  When: standardOrderExtractor.extract() is called
  Then: choices[2].fixed === true; other choices have no fixed property
  Notes: the component currently ignores fixed; all items remain draggable

AC-E6: HTML content in choice text renders
  Given: a simpleChoice whose text contains <strong> and <em> HTML tags
  When: the item renders
  Then: the formatted text appears in the list item without raw tags being visible

AC-E7: QTI 3.0 kebab-case element names are accepted
  Given: a QTI 3.0 item using <qti-order-interaction> with <qti-simple-choice> children
         and max-choices="4" min-choices="4" attributes
  When: the item is parsed and rendered
  Then: the interaction renders identically to a QTI 2.x item with the same content;
        max-choices and min-choices are silently ignored (not extracted)

AC-E8: Response clear resets confirm state when response transitions null → populated → null
  Given: a rendered item where the candidate has confirmed an order
  When: an external caller sets response to null (e.g., session reset)
  Then: the "Confirm Order" button reappears; the success badge disappears

AC-E9: Error state when interaction data is absent
  Given: the component rendered without the interaction prop
  Then: an error message is displayed ("No interaction data provided");
        no drag handles or choices are rendered

AC-E10: Fractions-order sample (math content, no shuffle)
  Given: the fractions-order.xml item (ordering 1/4, 1/2, 3/4, 7/8 from smallest to largest)
        which uses MATCH_CORRECT and correctResponse=["A","C","B","D"]
  When: the candidate orders the fractions A, C, B, D and confirms
  Then: qti-change fires with value=["A","C","B","D"]; SCORE=1.0 on scoring
```

---

## Open questions

- [ ] Should `shuffle` be applied by `Player.getInteractions()` as a post-extraction transformation, using the player's seeded `rng`? The `createSeededRng` infrastructure exists; wiring it to the choice array is the missing step. A seeded shuffle requires storing the seed (or the shuffled order) in the session so the candidate sees the same order on resume.
- [ ] Should `minChoices`/`maxChoices` be extracted into `OrderInteractionData` and surfaced as a partial-placement UI (where the candidate picks N items from a longer list to rank)? This is a significant UX change that affects `SortableList` — it would need a "placed" vs "available" pool UI.
- [ ] Should `fixed` choices be rendered with a lock icon and prevented from being dragged once `shuffle` is honoured? This requires changes to both `SortableList` (conditional `draggable` per item) and the keyboard handler (skip fixed positions during arrow-key movement).

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.1.2 orderInteraction
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-09 (PNP elimination tool)
- Component: `packages/default-components/src/plugins/order/OrderInteraction.svelte`
- Shared subcomponent: `packages/default-components/src/shared/components/SortableList.svelte`
- Touch drag utility: `packages/qti-common/src/dom/touchDrag.ts`
- Extractor: `packages/item-player/src/extraction/extractors/orderExtractor.ts`
- Type (component-facing): `packages/item-player/src/types/interactions.ts` — `OrderInteractionData`
- Extractor type: `packages/item-player/src/extraction/extractors/orderExtractor.ts` — `OrderData`
- i18n keys: `packages/i18n/src/locales/en-US.ts` — `interactions.order.*`
- Eval scenarios: `docs/evals/default-components/order/evals.yaml`
- QTI 3.0 fixture: `packages/qti-common/src/__tests__/fixtures/qti3-order-interaction.xml`
- Real-world fixture: `apps/transform/static/samples/math-assessment/fractions-order.xml`
- Adjacent PRDs: `docs/prds/interactions/choice.md` (shares shuffle pattern and `fixed` gap), `docs/prds/interactions/graphic-order.md` (graphic variant)
