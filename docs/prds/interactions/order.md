# PRD: orderInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: orderInteraction
  Last reviewed: 2026-11-09
-->

**Status:** draft
**Type:** interaction
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)
**Last reviewed:** 2026-11-09

---

## Summary

`orderInteraction` is the QTI interaction type for sequencing tasks: the candidate must arrange a set of choices into a specific order. It is used for timeline questions, process-step sequencing, and ranked ordering. The implementation renders `simpleChoice` elements as a drag-and-drop sortable list with full keyboard and touch support, emits `qti-change` events on every reorder, requires explicit confirmation before the response is committed, and uses an `ordered`-cardinality response variable (position matters, not just membership) for all-or-nothing `MATCH_CORRECT` scoring. When `minChoices` asks for a subset ("rank your top 2 of 5"), the candidate instead chooses which choices to order from a pool and orders only those.

---

## Background and rationale

**Why `ordered` cardinality matters for scoring**: Unlike `choiceInteraction`, where a `multiple`-cardinality response is a set of identifiers (order irrelevant), `orderInteraction` uses `ordered` cardinality — the response is an ordered sequence. `["A","B","C"]` and `["A","C","B"]` are two distinct responses. The `match` operator in QTI response processing performs a positional equality check on `ordered` variables: every element must be at the same index. This is why `MATCH_CORRECT` is the canonical template — there is no partial credit at the element level unless the item author writes custom response processing. Item authors who want partial credit (e.g., "2 points if at least 3 items are in the correct position") must use inline `responseCondition` XML, not a standard template.

**Why a confirmation button is required (WCAG 2.2 SC 3.3.4)**: WCAG 2.2 Success Criterion 3.3.4 (Error Prevention — Legal, Financial, Data) requires that submissions which are consequential be reversible, checkable, or confirmable. A drag-reorder gesture is a low-friction, accidentally-triggerable action: a small misclick can produce a different order. Without a confirmation step, the candidate could inadvertently submit a wrong order. The "Confirm Order" button gives the candidate an explicit, reversible commitment point before the response is recorded. The button auto-confirms after a drag (the act of dragging is intentional), but the confirmation state is reset whenever the response is cleared externally, allowing the candidate to undo by their session manager clearing the response and requiring re-confirmation.

**Why drag-and-drop needs a keyboard-equivalent interaction**: The native HTML5 drag API is inaccessible to keyboard-only users and is unreliable on touch devices. The `SortableList` component implements a two-phase keyboard pattern: (1) `Space` or `Enter` "grabs" the focused item and enters move mode; (2) arrow keys reposition the grabbed item one slot per keypress; (3) `Space` or `Enter` drops it. This pattern is described in the W3C ARIA "Sortable List" authoring practice and is the minimum required by WCAG 2.1 SC 2.1.1 (Keyboard). Touch support is provided by `touchDrag` from `@pie-qti/qti-common`, which intercepts `touchstart`/`touchmove`/`touchend` events and synthesizes the equivalent `dragstart`/`dragover`/`drop` events so the same mouse-drag logic handles touch without duplication.

**Why choices are presented as draggable `<button>` elements, not a `<ul>/<li>` list with a drag-handle role**: Each item must be keyboard-focusable and keyboard-operable as a first-class interactive control. `<button>` provides this natively (tab-focusable, activatable with Space/Enter, announced by screen readers as a button). The `role="list"` / `role="listitem"` wrapper around the buttons provides list semantics to screen readers without removing the button interactivity. An alternative using `role="listbox"` / `role="option"` with `aria-grabbed` was considered but `aria-grabbed` was deprecated in ARIA 1.2 and browser support is unreliable; the button-in-list pattern with live-region announcements is more robust.

**Why `shuffle` is applied during extraction, not by the component**: The `shuffle` attribute signals that the author wants choices presented in a randomized initial order. That randomization has to happen before the data reaches the component, so the order can be reproduced on resume rather than re-rolled on every render. It is therefore applied at extraction time by `maybeShuffle` (`packages/item-player/src/core/shuffle.ts`), using a PRNG seeded from the item session GUID and the `responseIdentifier`. `Player` persists that GUID in its saved state and restores it, so the candidate sees the same order on resume while a different candidate or attempt gets a different one. `fixed=true` choices keep their authored index. The component deliberately does not shuffle: doing so would re-order on every re-render and double-shuffle the already-shuffled array. The `SortableList` component receives `orderedIds` (the display order), populated from the response on resume, so the resume path continues to work once an order has been confirmed.

**Why `minChoices` switches to a two-zone subset UI**: QTI 2.2 ASI §5.73 lets an `orderInteraction` ask for a subset: "If specified, minChoices must be 1 or greater but must not exceed the number of choices available. If unspecified, all of the choices must be ordered and maxChoices is ignored", and §2.4.1.2: "When specified the candidate must select a subset of the choices and impose an ordering on them." A full permutation can never answer such an item: a 5-item response to "rank your top 2 of 5" never matches a 2-item correct response, so the item scores wrong. Subset mode therefore applies when `minChoices` is at least 1 and below the number of choices; the candidate may then order between `minChoices` and the cap, which is `maxChoices` (0 = no limit) clamped to the number of choices. The rule lives in one pure function, `orderChoiceLimits` (`packages/item-player/src/interactions/order/limits.ts`), exported from `@pie-qti/item-player` and read by both the renderer and response validation, so the delivered UI can never produce a response validation rejects. With `minChoices` unspecified, or at or above the number of choices, the interaction stays the full-permutation list described below, unchanged.

**Why a separate `OrderData` extractor type exists alongside `OrderInteractionData`**: The extractor produces `OrderData` (from `packages/item-player/src/interactions/order/extractor.ts`), which includes `fixed` per choice and `orientation`. The component uses `OrderInteractionData` (from `packages/item-player/src/interactions/shared/types.ts`), which does not declare `fixed` or `orientation`. `Player.getInteractions()` spreads the extracted data onto the base type at line 489 of `Player.ts`, so `fixed` and `orientation` are present at runtime on the object the component receives — they are just not in the TypeScript type. This means `fixed` is silently passed to the component but the component does not use it: `SortableList` treats all choices as shuffleable regardless of their `fixed` flag.

**Why `ordered` cardinality response is `string[]` not a QTI container type**: The component emits and accepts `string[]` (an array of identifiers). The item player's `Player` class knows the response variable has `ordered` cardinality and serialises/deserialises accordingly. This keeps the component interface simple and avoids coupling the component to the QTI variable system.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place via `qti-order-interaction`)
**Spec section:** §3.1.2 orderInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `orderInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | Full | Extracted as `responseId`; used in `qti-change` event payload |
| `shuffle` | ✅ Full | Extracted as `shuffle: boolean` and applied at extraction time, seeded from the item session GUID; stable for the whole session, including across re-renders and reloads. `fixed=true` choices keep their authored index. |
| `orientation` | Partial | Extracted by `standardOrderExtractor` as `orientation` (`'vertical'` \| `'horizontal'`); defaults to `'vertical'`. Reached component via runtime spread but not in `OrderInteractionData` TypeScript type. The `SortableList` component reads `orientation` and adjusts arrow-key axis and flex layout direction accordingly. |
| `minChoices` | ✅ Full | Extracted as `minChoices` (0 when unspecified). From 1 up to fewer than the choices it requests subset ordering (two-zone UI); unspecified, or at or above the number of choices, every choice is ordered. Response validation enforces the same minimum. |
| `maxChoices` | ✅ Full | Extracted as `maxChoices` (0 when unspecified). Caps subset ordering (clamped to the number of choices; 0 = up to all); adding past it is refused and announced, and validation rejects a longer response. Ignored when `minChoices` is unspecified, as the spec requires. |

### Supported attributes on `simpleChoice`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | Full | Required; deduplicated; used as list item key, in `qti-change` payload, and in response |
| `fixed` | Full | Extracted by `standardOrderExtractor` as `fixed?: boolean` on the choice object. The extraction-time shuffle keeps a fixed choice at its authored index. QTI's `fixed` binds the delivery engine ("the position of this choice within the interaction must not be changed by the delivery engine even if the immediately enclosing interaction supports the shuffling of choices", QTI 3.0 §5.132.2), not the candidate, so every choice stays draggable. |
| class (CSS classes) | Partial | Extracted as `classes?: string[]`; not rendered as CSS classes by default component but available for custom renderer detection |
| `templateIdentifier` | Full | A choice whose template variable hides it is dropped before extraction, by the shared visibility rule. |
| `showHide` | Full | Inverts `templateIdentifier` visibility. |

### Response variable contract

- **baseType:** `identifier`
- **cardinality:** `ordered`
- **Value format:** `string[]` — an ordered array of `identifier` strings, one per placed choice; in subset mode only the ordered subset
- **Null/empty:** `null` before any interaction; `[]` after clearing a response. The component treats `null` and `[]` equivalently as "unconfirmed". In subset mode an empty order is reported as `null`.
- **Scoring:** The `match` operator on `ordered` cardinality performs positional equality. `["A","B","C"]` matches only `["A","B","C"]`; partial matches score 0.
- **Validation:** `Player.validateResponses` counts an order that has begun against its mode's minimum — every choice without a subset, `minChoices` with one — and in subset mode rejects a response longer than the cap (`exceeds maxChoices=N`). An untouched order is a skip, governed by `allowSkipping`.

### Standard response processing templates

- **MATCH_CORRECT** — canonical template for `orderInteraction`. Sets `SCORE=1.0` (or `MAXSCORE` value) when the entire ordered sequence matches `correctResponse`. Sets `SCORE=0.0` otherwise. All-or-nothing; no built-in partial credit.
- Custom `responseCondition` XML — can be used to award partial credit by counting correctly-positioned items (e.g., using `index` and `match` operators in a loop), but this requires explicit item authoring and is not surfaced by any standard template.

### Known gaps


- **`fixed` does not restrict dragging (not a divergence):** `fixed=true` is honoured when the initial shuffle is applied (the choice keeps its authored index), and `SortableList` still lets the candidate drag it afterwards. QTI constrains the delivery engine's shuffling, not candidate interaction (QTI 2.1 choice; QTI 3.0 §5.132.2), so this follows the specification.

- **G-09 (PNP elimination tool):** Implemented for `orderInteraction`; when `pnp.cognitive.eliminationTool` is enabled, an eliminate/dismiss button appears per choice without changing the response value. In subset mode each choice keeps exactly one toggle, in whichever zone it is.

---

## Functional requirements

- **FR-1:** Render each `simpleChoice` as a draggable list item in a `role="list"` container. Each item must show a position badge (1-based index), a drag handle icon, and the choice text.
- **FR-2:** Support mouse drag-and-drop reordering: drag any item to any other position; the item replaces the target and all others shift accordingly.
- **FR-3:** Support touch drag reordering: a single-touch press and drag must move items the same way mouse drag does. Multi-touch must not trigger drag (single-touch only).
- **FR-4:** Support keyboard reordering: `Space` or `Enter` grabs the focused item; arrow keys (Up/Down for vertical, Left/Right for horizontal) move the grabbed item one position per press, with Left/Right mirrored when the list's computed `direction` is `rtl`; `Space` or `Enter` drops it; `Escape` cancels the grab without changing order.
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
- **FR-16 (subset mode):** When `minChoices` is at least 1 and below the number of choices, render two labelled zones: "Your order" (the SortableList, holding only the ordered subset, with position badges) and "Not in your order" (every other choice, in presentation order, with no position badge). The order starts empty and the response is `null` until the candidate adds an item.
- **FR-17 (subset mode):** Each pool row is one add control named "Add {item} to your order"; each order row gains a remove control named "Remove {item} from your order". Adding appends the item at the end of the order; removing returns it to its pool position. Each add, remove or reorder emits `qti-change` with the ordered subset, or `null` when the order is empty. Names come from the choice's rendered text (image alt and MathML included), never its identifier.
- **FR-18 (subset mode):** Adding past the cap is refused and announced ("Your order can hold up to {max} items. Remove one to add another."); at the cap the remaining add controls stay focusable with `aria-disabled="true"`.
- **FR-19 (subset mode):** State the limits up front where the unmet-minimum hint goes — "Choose {count} items and put them in order." when `minChoices` equals the cap, else "Choose between {min} and {max} items and put them in order." — until the minimum is met; the author's `data-min-selections-message` wins.
- **FR-20 (subset mode):** No confirm control: every ordered item got there by an explicit, reversible add (see Design decisions).
- **FR-21 (subset mode):** With `role='scorer'` and a `correctResponse`, list the authored subset under "Correct order" (read-only), beside the candidate's subset marked position by position.

---

## Non-functional requirements

### Accessibility

WCAG 2.2 Level AA compliance is mandatory for all default components.

- **Keyboard drag pattern (SC 2.1.1):** The grab → move → drop pattern with Space/Enter and arrow keys is mandatory. Arrow keys must respect orientation: Up/Down for `vertical`, Left/Right for `horizontal`. Horizontal keys follow the inline direction: under `rtl`, ArrowRight moves earlier.
- **Focus management (SC 2.4.3):** After a keyboard drop, focus must remain on the dropped item at its new position.
- **Live region announcements (SC 4.1.3):** All position changes must be announced via `aria-live="polite"` with messages in the format: `"{item} moved to position {N} of {total}"`. Grab, drop, and cancel must each have their own message. Messages are i18n-keyed (see `interactions.order.*` keys).
- **Static instructions for screen readers:** An `aria-describedby` pointing to a visually hidden instructions element must be present on the list container. The instructions explain the grab → arrow → drop pattern. Its id, like every name and state id in the list, is unique per list instance, so several lists in one document never share it.
- **Grab state (SC 4.1.2):** The `aria-grabbed` attribute (deprecated since WAI-ARIA 1.1, unreliable in current screen readers) is not used. Grab state is exposed through the item's `aria-describedby` state sentence ("Grabbed. Use arrow keys to move."), the `data-grabbed` styling hook, and the grab, drop and cancel live-region announcements.
- **Touch targets (SC 2.5.8):** Each sortable item must be at least 44×44 CSS px on a 375-px viewport.
- **`disabled` accessibility:** When `disabled=true`, items must have `disabled` attribute (native button disabled) so assistive technologies announce them as non-interactive.
- **Confirmation button (SC 3.3.4):** The "Confirm Order" button must have an `aria-label` that fully describes the action (`'Confirm this order as your answer'`) and must be reachable by Tab.
- **Colour-only feedback (SC 1.4.1):** Correct-position highlighting must not rely on colour alone. The implementation uses both a colour change and a "Correct" badge text label.
- **Subset mode (SC 2.1.1, 2.4.3, 2.5.8, 3.3.2, 4.1.3):** Add and remove are native buttons (keyboard operable), at least 44×44 CSS px. Focus follows the moved item: an add lands on the new row's remove control, a remove on the returned item's add control. Add, remove and refusal announce through the component's polite live region, toggling a trailing zero-width space so a repeated refusal is announced again; moves keep the SortableList's own announcements. On narrow screens a row's controls wrap under the item (SC 1.4.10). The at-cap add controls keep a `GrayText` state under forced colors, and the zones use logical CSS so they mirror under `rtl`.

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
| `interactions.order.yourOrder` | `'Your order'` | Subset mode — label of the ordered zone |
| `interactions.order.notInOrder` | `'Not in your order'` | Subset mode — label of the pool |
| `interactions.order.emptyOrder` | `'Nothing is in your order yet.'` | Subset mode — empty order, also its list description |
| `interactions.order.addItem` | `'Add {item} to your order'` | Subset mode — add control name |
| `interactions.order.removeItem` | `'Remove {item} from your order'` | Subset mode — remove control name |
| `interactions.order.itemAdded` | `'{item} added to your order at position {position} of {total}.'` | Live region — item added |
| `interactions.order.itemRemoved` | `'{item} removed from your order.'` | Live region — item removed |
| `interactions.order.orderLimitReached` | plural: `'Your order can hold up to {max} items. Remove one to add another.'` | Live region — add refused at the cap |
| `interactions.order.correctOrder` | `'Correct order'` | Subset mode — scorer's correct-response list |
| `interactions.order.subsetExactHint` | plural: `'Choose {count} items and put them in order.'` | Subset mode — limits when `minChoices` equals the cap |
| `interactions.order.subsetRangeHint` | plural: `'Choose between {min} and {max} items and put them in order.'` | Subset mode — limits as a range |

All locales in `packages/i18n/src/locales/` carry translations for the `interactions.order` namespace.

### Security

Choice text is rendered via `{@html}` (via `SortableList`). Content is sanitized upstream by the item player's HTML sanitizer before the component receives it. The component trusts `interaction.choices[*].text` as safe HTML. No user-supplied values are injected into HTML.

---

## Design decisions

### Subset ordering uses two zones, not an include toggle per item

**Decision:** In subset mode the candidate moves choices between "Not in your order" and "Your order" with explicit add and remove controls; "Your order" is the existing SortableList.

**Rationale:** The spec's wording — "select a subset of the choices and impose an ordering on them" — names two gestures, and the two zones map onto them one to one: membership is which zone an item is in, order is the position within "Your order". Reusing the SortableList keeps every established ordering behaviour (drag, touch, the grab/move/drop keys, move buttons, RTL key mirroring, forced-colors grab state, focus retention, position announcements) and keeps positions meaningful: "Position 2 of 2" counts only ordered items.

**Alternatives considered:** An include toggle on each item of a single list. Rejected: excluded items would still sit between ordered ones, so positions, badges and "position N of M" announcements would need to skip them, and dragging past an excluded item would be ambiguous.

**Consequences:** Ordering a subset takes one more gesture per item (add, then optionally move). The pool keeps presentation order, so a removed item returns to where it was.

### No confirm step in subset mode

**Decision:** Subset mode renders no "Confirm Order" control; each add, remove and reorder records the response at once, and an empty order is `null`.

**Rationale:** Full mode needs the confirm step because the presented order is itself a plausible answer a candidate might mean to keep untouched (WCAG 2.2 SC 3.3.4). In subset mode nothing is ordered until the candidate adds an item, every ordered item got there by an explicit add, and every act is reversible (remove, move) until submission — the "reversible" branch of SC 3.3.4.

**Consequences:** A restored subset response does not ask to be confirmed again.

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
  shuffle: boolean;       // authored shuffle preference (applied at extraction time)
  minChoices: number;     // 0 when unspecified; 1..N-1 requests subset ordering
  maxChoices: number;     // 0 when unspecified; caps subset ordering, ignored without minChoices
  prompt: string | null;  // HTML content of <prompt> child, or null
  choices: Array<{
    identifier: string;   // from simpleChoice identifier attribute
    text: string;         // HTML content of simpleChoice
  }>;
}
```

**Note on runtime-only fields:** The `standardOrderExtractor` produces additional fields that are spread onto the interaction object at runtime but are not declared in `OrderInteractionData`:

- `orientation?: 'vertical' | 'horizontal'` — defaults to `'vertical'`; used by `SortableList` to orient the list and bind arrow keys
- `choices[*].fixed?: boolean` — indicates a choice must not move during shuffle; honoured by the extraction-time shuffle

**Invariants enforced by `standardOrderExtractor.validate()`:**
- `choices` has at least 2 entries (error if fewer)
- All `identifier` values are non-empty (error on empty)
- All `identifier` values are unique within the interaction (error on duplicate)
- More than 10 choices produces a warning (usability, not a hard error)

**Response type:**
```typescript
// In InteractionValueMap (packages/item-player/src/interactions/shared/types.ts)
orderInteraction: string[] | null
// The ordered array of simpleChoice identifiers in candidate-selected order;
// null in subset mode once the candidate has ordered nothing. Nothing is emitted
// before the first confirm or reorder, so the response stays null until then.
```

**`qti-change` event payload:**
```typescript
{
  detail: {
    responseId: string,      // from parsedInteraction.responseId
    value: string[] | null,  // ordered identifiers; null for an empty subset order
    timestamp: number
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
  Notes: with shuffle="false" choices appear in authored XML order

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
  Then: ChoiceC is "grabbed" (its description gains "Grabbed. Use arrow keys to move.";
        data-grabbed="true"; visual highlight; no aria-grabbed; live announcement reads
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
        the "Grabbed." sentence leaves its description (data-grabbed="false")

AC-A3: Keyboard move — horizontal orientation
  Given: an item with orientation=horizontal
  When: an item is grabbed and the candidate presses ArrowRight
  Then: the item moves one position to the right; ArrowLeft moves it left;
        ArrowUp and ArrowDown have no effect on the order;
        under a computed direction of rtl, ArrowRight moves it one position earlier and ArrowLeft later

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
  Notes: the shuffle is applied at extraction time, seeded from the item session GUID
         until the shuffle gap is resolved

AC-E5: fixed attribute is extracted on choices
  Given: an orderInteraction where the third choice has fixed="true"
  When: standardOrderExtractor.extract() is called
  Then: choices[2].fixed === true; other choices have no fixed property
  Notes: the extraction-time shuffle keeps a fixed choice in place; the candidate may still drag it (QTI binds only the delivery engine)

AC-E6: HTML content in choice text renders
  Given: a simpleChoice whose text contains <strong> and <em> HTML tags
  When: the item renders
  Then: the formatted text appears in the list item without raw tags being visible

AC-E7: QTI 3.0 kebab-case element names are accepted
  Given: a QTI 3.0 item using <qti-order-interaction> with <qti-simple-choice> children
         and max-choices="4" min-choices="4" attributes
  When: the item is parsed and rendered
  Then: the interaction renders identically to a QTI 2.x item with the same content;
        min-choices equal to the number of choices is full ordering, so every choice is ordered

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

AC-E11: Rank your top 2 of 5 (subset ordering)
  Given: the order-subset-top-two sample (minChoices="2" maxChoices="2", five planets,
         correctResponse=["MERCURY","VENUS"])
  When: the candidate adds Venus and Mercury by keyboard, moves Mercury first, and submits
  Then: the pool keeps Earth, Jupiter and Mars with no position numbers; a third add is refused
        and announced; RESPONSE=["MERCURY","VENUS"]; SCORE=1.0
  Notes: covered by apps/demo/tests/playwright/order-subset.pw.ts

AC-E12: Subset bounds are validated
  Given: an orderInteraction with minChoices="2" maxChoices="2" over five choices
  When: a restored or programmatic RESPONSE orders three choices
  Then: validateResponses reports it invalid ("exceeds maxChoices=2"); with minChoices
        unspecified, a started RESPONSE of fewer than all choices is incomplete
```

---

## Open questions

- [x] Should `shuffle` be applied as a post-extraction transformation using a seeded RNG? Yes — implemented in `packages/item-player/src/core/shuffle.ts` and applied by the extractors. The seed is derived from the item session GUID, which `Player` already persists and restores, so no extra session field was needed.
- [x] Should `minChoices`/`maxChoices` be extracted into `OrderInteractionData` and surfaced as a partial-placement UI (where the candidate picks N items from a longer list to rank)? Yes — both are extracted and a `minChoices` below the number of choices renders the two-zone "Your order" / "Not in your order" UI (see Design decisions).
- [ ] Should `fixed` choices be rendered with a lock icon and prevented from being dragged once `shuffle` is honoured? This requires changes to both `SortableList` (conditional `draggable` per item) and the keyboard handler (skip fixed positions during arrow-key movement).

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.1.2 orderInteraction
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-09 (PNP elimination tool)
- Component: `packages/default-components/src/plugins/order/OrderInteraction.svelte`
- Shared subcomponent: `packages/default-components/src/shared/components/SortableList.svelte`
- Subset-mode subcomponent: `packages/default-components/src/shared/components/OrderSubset.svelte`
- Subset rule shared with validation: `packages/item-player/src/interactions/order/limits.ts` — `orderChoiceLimits`
- Touch drag utility: `packages/qti-common/src/dom/touchDrag.ts`
- Extractor: `packages/item-player/src/interactions/order/extractor.ts`
- Type (component-facing): `packages/item-player/src/interactions/shared/types.ts` — `OrderInteractionData`
- Extractor type: `packages/item-player/src/interactions/order/extractor.ts` — `OrderData`
- i18n keys: `packages/i18n/src/locales/en.ts` — `interactions.order.*`
- Eval scenarios: `docs/evals/default-components/order/evals.yaml`
- QTI 3.0 fixture: `packages/qti-common/src/__tests__/fixtures/qti3-order-interaction.xml`
- Real-world fixture: `packages/to-pie/tests/fixtures/qti-samples/math-assessment/fractions-order.xml`
- Adjacent PRDs: `docs/prds/interactions/choice.md` (shares shuffle pattern and `fixed` gap), `docs/prds/interactions/graphic-order.md` (graphic variant)
