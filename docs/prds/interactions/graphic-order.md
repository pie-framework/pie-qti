# PRD: graphicOrderInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: graphicOrderInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`graphicOrderInteraction` is a QTI 2.x interaction type that asks a candidate to arrange labelled regions of an image into a specific sequence. The candidate is shown a background image overlaid with `associableHotspot` regions; they interact with those regions (by clicking/tapping or dragging in the reorder list) to establish an order. The response is an `ordered`-cardinality variable of `identifier` baseType — a ranked list of hotspot identifiers. This interaction is the graphical counterpart of `orderInteraction`: the choices are spatial regions on an image rather than plain text labels.

In this implementation, the hotspot coordinates are used by the extractor to record spatial metadata but the primary candidate-facing UI is a sortable list panel rendered beside (or below) the image. Candidates drag list items or use keyboard controls to establish the sequence; sequence numbers (1, 2, …) are shown as badges on each list item. The image serves as the visual context that motivates the ordering task but is not itself the interactive surface.

---

## Background and rationale

### Why coordinates are metadata, not the interactive surface

The QTI spec defines `associableHotspot` regions with `shape` and `coords` attributes and notes that delivery engines should "display numbers or other indicators showing the selection order." The spec is deliberately silent on the precise interaction modality — click-in-sequence on the image, drag-and-drop, or a separate list are all valid implementations.

A click-in-sequence approach (click hotspot 1, click hotspot 2, …) requires pixel-accurate hit-testing of arbitrarily shaped regions rendered on a responsive image. Image scaling, fractional device pixels, and the need to deselect and re-sequence make this fragile on mobile and complex to make accessible. Instead, the implementation renders a separate sortable list beneath the image. The image provides the ordering context (a soil cross-section, a process diagram, a flowchart); the list provides the sequencing surface. Hotspot `shape`/`coords` attributes are extracted and stored for future use (e.g. rendering sequence number overlays on the image, or for custom renderers that do prefer click-in-sequence), but the default component does not use them for interaction.

### Why the image is passive, not interactive

Making the image interactive at the hotspot level requires the component to composite sequence-number badges at the correct image coordinates on every screen size and device pixel ratio. This is possible but adds significant complexity, particularly for SVG content where coordinates are in the SVG viewBox space, not CSS pixels. Deferring that complexity to a future enhancement (or to custom renderers) keeps the default component simple, accessible by default, and mobile-safe. The image is still present and visible — it is the semantic anchor that gives the list items their meaning.

### Why a confirmation step exists

WCAG 2.2 SC 3.3.4 (Error Prevention) requires that submissions of legal commitments, financial transactions, and test responses be reversible or confirmable. In an assessment context, the first drag (or reorder) should not irrevocably commit the candidate's response. The component therefore renders a "Confirm Order" button once the candidate has interacted. Drag gestures auto-confirm (the candidate has clearly committed to the drag), but there is also an explicit confirmation button before the response is emitted for scoring. This is the same pattern used in `orderInteraction`.

### Why the visual order panel shows numbered badges

The sortable list renders a position badge (1, 2, …) in front of each item, updated live as the candidate reorders. This fulfils the spec's requirement to "display numbers or other indicators showing the selection order" without requiring image-coordinate overlays. Candidates can always see the current sequence state without needing to track which hotspot corresponds to which position in memory.

### Use cases in K-12 assessment

`graphicOrderInteraction` is well-suited to items that ask candidates to sequence steps shown in a diagram — geological strata (bottom to top), steps in a water cycle shown as a circular diagram, stages of cell division shown as microscopy images, steps in a chemical process shown as a flowchart. The common thread is that the image makes the spatial or conceptual relationship between steps visible, while the ordering task requires the candidate to apply domain knowledge to determine the correct sequence.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place)  
**Spec section:** §3.3.3 graphicOrderInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `graphicOrderInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId` on `BaseInteractionData`; used in `qti-change` event payload |
| `maxChoices` | ❌ Not extracted | Spec: maximum number of hotspots the candidate may include in their ordered response (0 = all). Not in `GraphicOrderInteractionData`. See Known gaps. |
| `minChoices` | ❌ Not extracted | Spec: minimum number of hotspots that must appear in the response. Not in `GraphicOrderInteractionData`. See Known gaps. |

### Supported attributes on `hotspotChoice` / `associableHotspot`

The QTI 2.x spec uses `hotspotChoice` as the child element name for `graphicOrderInteraction`. Note: `associableHotspot` is the child element type for `graphicAssociateInteraction` and `graphicGapMatchInteraction`. The extractor reads `hotspotChoice` children, which carry the following:

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required; deduplicated; becomes the response value for this hotspot position |
| `shape` | ✅ Extracted | Extracted and stored in `GraphicOrderChoice.shape`. Supported values: `rect`, `circle`, `poly`, `ellipse`. Default: `rect`. Not used for hit-testing in the default component; available for custom renderers. |
| `coords` | ✅ Extracted | Extracted and stored in `GraphicOrderChoice.coords`. Default: `0,0,50,50`. Not used for rendering in the default component; available for custom renderers. |
| `fixed` | ✅ Extracted (boolean) | Extracted and stored as `fixed?: boolean`. The sortable list does not enforce position-locking of fixed hotspots — this is a known gap (see below). |
| `matchMax` | ❌ Not applicable | `matchMax` is an attribute of `associableHotspot` (used in `graphicAssociateInteraction`), not `hotspotChoice`. Not present on graphic order hotspots. |
| text content | ✅ Full | Text content of the `hotspotChoice` element becomes `label`; falls back to `identifier` if empty. Used as the visible text in the sortable list. |
| CSS classes | ✅ Extracted | Element classes extracted as `classes?: string[]` for custom renderer detection. Not rendered as CSS classes in the default component. |

### Response variable contract

- **baseType:** `identifier`
- **cardinality:** `ordered`
- **Value format:** an array of `identifier` strings in candidate-specified sequence order. Example: `["BEDROCK", "SEDIMENTARY", "TOPSOIL"]`
- **Null/empty:** The initial value before any interaction is the authored order (the order in which `hotspotChoice` elements appear in the XML). This means the response is never literally `null` — the candidate starts with a default ordering. The response is considered uncommitted until the confirmation step is completed.

### Standard response processing templates

- **MATCH_CORRECT** (most common) — scores 1 when `RESPONSE` exactly equals `correctResponse` in order. Scores 0 otherwise. All-or-nothing; no partial credit for a mostly-correct sequence. This is the template used in the eval fixture (`graphic-order/graphic-order/correct`).
- **MAP_RESPONSE** — not applicable for `ordered` cardinality in the standard templates; custom `responseCondition` XML is required for partial credit based on sequence proximity.
- **Custom `responseCondition`** — can be used to award partial credit (e.g. "3 of 5 in correct position scores 0.5"). The response processing engine supports the `ordered` expression and `index` operator needed for position-based scoring.

### Coordinate system

The `coords` attribute uses the same HTML image map coordinate convention as `hotspotInteraction` and `selectPointInteraction`:

- **`rect`**: `x1,y1,x2,y2` — top-left and bottom-right corners in image pixels
- **`circle`**: `cx,cy,radius` — center and radius in image pixels
- **`poly`**: `x1,y1,x2,y2,...,xN,yN` — polygon vertices in image pixels
- **`ellipse`**: `cx,cy,rx,ry` — center plus x-radius and y-radius in image pixels

Coordinates are in the natural (un-scaled) image pixel space. When the image is displayed at a different size than its natural dimensions, a consumer of these coordinates is responsible for applying the scale factor.

### Known gaps

- **`maxChoices` not extracted or enforced:** The spec allows item authors to require the candidate to order only a subset of hotspots (e.g. pick the top 3 of 5 and order them). This is not supported. All hotspots are included in the sortable list and all must appear in the response.
- **`minChoices` not extracted or enforced:** The spec defines this as a completeness constraint. Not extracted or validated.
- **`fixed` hotspot position-locking not enforced:** When a `hotspotChoice` has `fixed=true`, its position in the order should be locked and the candidate should not be able to move it. The extractor reads and stores `fixed`, but the sortable list does not enforce it.
- **No image-level sequence overlays:** The spec says delivery engines should display sequence indicators on the image. The default implementation shows sequence badges in the list panel only. Coordinates are extracted and available for implementers who want to overlay numbers on the image.
- **`matchGroup` not applicable here:** `matchGroup` is an attribute of `associableHotspot` (used in `graphicAssociateInteraction` and related interactions), not `hotspotChoice`. It is not a gap for this interaction.

---

## Functional requirements

- **FR-1:** Render the background image (raster or inline SVG) in a container above the ordering panel.
- **FR-2:** Render a sortable list of all `hotspotChoice` labels, in their authored order, below the image.
- **FR-3:** Display a numeric sequence badge (1-based) on each list item, updated live as the candidate reorders.
- **FR-4:** Support mouse drag-and-drop reordering of list items.
- **FR-5:** Support keyboard reordering: Tab to reach the list; Space/Enter to pick up an item; Arrow keys to move it; Space/Enter to drop; Escape to cancel.
- **FR-6:** Support touch drag-and-drop reordering via the `touchDrag` action from `@pie-qti/qti-common`.
- **FR-7:** On drag completion, auto-confirm the response and emit a `qti-change` CustomEvent with `{ responseIdentifier, value: string[] }` from the root element. The event must bubble.
- **FR-8:** When the response has not been confirmed, show a "Confirm Order" button. Show "Confirm Order (No Changes)" if the candidate has not yet reordered from the default sequence.
- **FR-9:** On button click, confirm the response and emit `qti-change`.
- **FR-10:** After confirmation, replace the button with a visual success indicator ("Order confirmed").
- **FR-11:** Accept a `response` prop (`string[]`) and synchronise the list order to it without re-emitting `qti-change`.
- **FR-12:** When `response` is cleared (set to `null` or `[]`), reset the list to the authored order and clear the confirmed state.
- **FR-13:** When `disabled=true`, all drag handles and the confirm button must be non-interactive. Disabled state must be visually distinct (reduced opacity, `cursor: not-allowed`).
- **FR-14:** When `role='scorer'` and `correctResponse` is provided, visually distinguish each item that is in its correct position (green highlight, "Correct" badge). Do not reveal correct order to any other role.
- **FR-15:** Render the `prompt` HTML content above the image when present.

---

## Non-functional requirements

### Accessibility

- **Image alt text:** The `<img>` element must have a descriptive `alt` attribute. The default value is `'Ordering diagram'`; item authors should provide a more specific description via the `i18n` provider key `interactions.graphicOrder.altText`. SVG content embedded directly does not use an `<img>` element and should carry its own `<title>` element as the accessible name.
- **List semantics:** The sortable list must have `role="list"` with an accessible label (`aria-label`). Each item must have `role="listitem"`. This pattern communicates to screen readers that the items form an ordered collection.
- **Item accessible names:** Each list item (button) must have a descriptive `aria-label` that includes: the item's text content, its current numeric position in the sequence (e.g. "Position 2 of 3"), and a hint when the item is grabbed ("Grabbed. Use arrow keys to move."). This is provided by the `SortableList` component.
- **Drag status:** The `aria-grabbed` attribute must be set to `true` when an item is keyboard-grabbed and `false` otherwise.
- **Live announcements:** A `role="status"` (or `aria-live="polite"`) region must announce position changes and grab/drop events to screen readers. The `SortableList` component provides this via its `announceText` state.
- **Instructions for keyboard users:** A visually hidden element with keyboard instructions ("Press Space or Enter to grab an item. Use arrow keys to move…") must be associated with the list via `aria-describedby`.
- **Confirm button:** The confirm button must have a descriptive `aria-label` (e.g. "Confirm this order as your answer") separate from its visible label to avoid ambiguity.
- **Touch targets:** All interactive elements (list item buttons, confirm button) must have a touch target of at least 44×44 CSS px (WCAG 2.2 SC 2.5.8).
- **Focus management:** After a keyboard-driven reorder, focus must remain on the moved item at its new position. After confirmation, focus must not be lost.
- **Disabled state announcement:** When `disabled=true`, buttons must carry `disabled` (or `aria-disabled="true"` with pointer-events blocked) so screen readers announce the inactive state.

### Performance

- Extraction and initial render must complete in under 16 ms for up to 8 hotspots on a mid-range mobile device.
- SVG content is injected as raw HTML (`{@html}`); the SVG must not trigger additional network requests.

### Cross-platform

- Drag-and-drop must be operable via touch on iOS Safari and Chrome for Android using the `touchDrag` action from `@pie-qti/qti-common`.
- The layout must be usable on 375px viewport width (portrait phone) without horizontal scrolling.
- The image container must scale down proportionally when the viewport is narrower than the image's natural width.

### Security

- Image `src` URLs and SVG content arrive from the item player's extraction pipeline, which sanitizes HTML content. The component trusts `imageData.src` and `imageData.content` as safe values. SVG content is rendered via `{@html}` inside a contained `<div>`; it must not escape that container.

### i18n

All user-visible strings are injectable via the `I18nProvider`. Default fallback values in parentheses:

| Key | Default |
|-----|---------|
| `interactions.graphicOrder.altText` | `'Ordering diagram'` |
| `interactions.graphicOrder.orderHeading` | `'Order (drag to reorder)'` |
| `interactions.graphicOrder.confirmOrder` | `'Confirm Order'` |
| `interactions.graphicOrder.confirmOrderNoChanges` | `'Confirm Order (No Changes)'` |
| `interactions.graphicOrder.confirmAria` | `'Confirm this order as your answer'` |
| `interactions.graphicOrder.instruction` | `'Drag to reorder, or click to confirm'` |
| `common.errorNoData` | `'No interaction data provided'` |

---

## Design decisions

### Sortable list panel rather than click-in-sequence on the image

**Decision:** The primary interaction surface is a text list rendered beside/below the image, not clickable hotspot regions overlaid on the image.  
**Rationale:** Click-in-sequence requires pixel-accurate hit-testing of potentially overlapping, arbitrarily shaped regions on a scaled image. On mobile, finger precision makes this error-prone; on desktop, overlap between adjacent regions makes the expected click target unclear. A sortable list is familiar (drag handles are a known UX pattern), reliable, and straightforwardly accessible via keyboard and screen reader. The image still provides the visual context that makes the ordering meaningful.  
**Alternatives considered:** (1) Click-to-assign-sequence-number on each hotspot region — rejected due to hit-testing complexity and lack of a clear deselection model. (2) Drag from image to a slot list — rejected as it conflates two interaction patterns and is hard to operate one-handed on mobile.  
**Consequences:** The hotspot `shape` and `coords` attributes are extracted and stored but are not used by the default rendering. A future enhancement or custom renderer could use them to overlay sequence badges on the image at the correct positions.

### Auto-confirm on drag; explicit confirm button for initial/unchanged state

**Decision:** Any completed drag gesture auto-sets `hasConfirmed = true` and immediately emits `qti-change`. The confirm button is shown only until the first drag is completed (or, for keyboard-only users, until the button is explicitly clicked).  
**Rationale:** A drag is an unambiguous deliberate action — the candidate picked up an item and placed it somewhere. Auto-confirming removes friction after drag. The button exists as a WCAG 3.3.4 "confirmation before submission" affordance for the case where the candidate has not yet dragged anything (the default order may itself be their intended response), and for keyboard-only users who reorder via Space/Arrow/Space and need an explicit commit step.  
**Alternatives considered:** Always require the confirm button, even after a drag — rejected as too many clicks for a common operation. Never require confirmation — rejected as it violates WCAG 3.3.4 for the case where the candidate intends to submit the default order without changes.  
**Consequences:** Once the candidate has dragged at least one item, the confirm button disappears and cannot be un-confirmed without a page/item reload. This is by design — the response is committed.

### Authored order as the initial response value (never null)

**Decision:** The `orderedIds` state is initialised from the authored hotspot order when no `response` prop is provided. The response is never `null` for this interaction.  
**Rationale:** `orderInteraction` (the text-based sibling) uses the same pattern: the initial state is the authored order, not an empty selection. This is consistent with the QTI spec's model where `ordered` cardinality responses are collections that always have a defined sequence; the question is whether the candidate has consciously chosen that sequence. The `hasConfirmed` flag tracks whether the candidate has actively committed to the current order.  
**Alternatives considered:** Start with `null` and require the candidate to establish an order from scratch — rejected because it breaks "confirm default order" as a valid candidate action (a candidate who agrees with the authored order would need to drag something to establish any response at all).  
**Consequences:** Scoring works correctly out of the box — `RESPONSE` will always be a non-null ordered array. However, the `$dirty` flag is not set until `hasConfirmed` becomes true, ensuring that an interaction the candidate never touched is not submitted as a committed response.

### Props accept both parsed objects and JSON strings

**Decision:** `interaction`, `response`, `correctResponse`, and `i18n` are each processed with `parseJsonProp` before use.  
**Rationale:** When used as a native web component via HTML attributes, all prop values arrive as strings. When used as a Svelte component inside the item player, they arrive as typed objects. `parseJsonProp` handles both cases transparently. Without this, the web component usage would require a separate wrapper.  
**Consequences:** Small runtime cost of attempting `JSON.parse` on every render for the web component case. Negligible for the number of hotspots typical in K-12 items (2–8).

### `qti-change` events dispatched from the root element inside shadow DOM

**Decision:** Events are dispatched from the inner root `<div>` (`bind:this={rootElement}`), not from a child button or the `SortableList` component.  
**Rationale:** Consistent with the `qti-change` event contract across all default components. The root `<div>` is inside the shadow root, so the event crosses the shadow boundary retargeted to the host element with the full payload assembled (responseIdentifier + value array).  
**Consequences:** The item player's event listener attaches to the host custom element (`pie-qti-graphic-order`) and receives `qti-change` events regardless of which interaction widget inside the shadow DOM triggered the change.

---

## Data model / contracts

### `GraphicOrderChoice` (from `@pie-qti/item-player`)

```typescript
interface GraphicOrderChoice {
  identifier: string;   // from hotspotChoice identifier attribute; response value token
  shape: string;        // 'rect' | 'circle' | 'poly' | 'ellipse'; default 'rect'
  coords: string;       // image-pixel coordinates; default '0,0,50,50'
  label: string;        // text content of hotspotChoice; falls back to identifier if empty
  fixed?: boolean;      // from fixed attribute; if true, position should be locked (not enforced)
  classes?: string[];   // CSS class list from the element (for custom renderer detection)
}
```

### `GraphicOrderInteractionData` (from `@pie-qti/item-player`)

```typescript
interface GraphicOrderInteractionData extends BaseInteractionData {
  type: 'graphicOrderInteraction';
  prompt: string | null;         // HTML content of <prompt> child, or null
  imageData: ImageData | null;   // background image; null produces a warning
  hotspotChoices: GraphicOrderChoice[];  // ordered by XML document order
}

interface ImageData {
  type: 'image' | 'svg';
  src?: string;           // for type='image': URL of the raster image
  content?: string;       // for type='svg': full SVG markup including <svg> root element
  width?: string;         // natural width in pixels (string); default '500'
  height?: string;        // natural height in pixels (string); default '300'
}
```

**Invariants enforced by the extractor's `validate()` method:**
- `hotspotChoices` has at least 2 entries (error if fewer)
- All `identifier` values are non-empty (error) and unique within the interaction (error on duplicate)
- If `imageData.type === 'image'`, `imageData.src` must be non-empty (error)
- If `imageData.type === 'svg'`, `imageData.content` must be non-empty (error)
- `imageData === null` produces a warning, not an error (SVG-only items without an `object` element are unusual but not structurally invalid)

**Invariants not enforced (gaps):**
- `maxChoices` and `minChoices` are absent from the type
- `fixed` is extracted but not enforced by the UI

### Response variable

```
responseDeclaration identifier="RESPONSE"
  cardinality: ordered
  baseType: identifier
  correctResponse > value: the correct identifier sequence (one per value element, in order)
```

The player stores the response as `string[]` in `declarations[responseIdentifier].value`. The `qti-change` event `detail.value` carries the same `string[]`.

---

## Acceptance criteria

### Functional

```
AC-1: Image renders above the sortable list
  Given: a graphic-order item with a raster image and 3 hotspot choices
  When: the item is rendered
  Then: the image appears in the stage container above the ordering panel

AC-2: Sortable list shows all hotspot labels in authored order on load
  Given: the item from AC-1 with hotspots [BEDROCK, SEDIMENTARY, TOPSOIL]
  When: the item renders with no response prop
  Then: the list shows "BEDROCK" at position 1, "SEDIMENTARY" at position 2, "TOPSOIL" at position 3

AC-3: Sequence badges are visible and match list position
  Given: the item from AC-1
  When: the item renders
  Then: each list item has a numeric badge showing its 1-based position (1, 2, 3)

AC-4: Confirm button is visible before first confirmation
  Given: the item from AC-1 with no response prop
  When: the item renders
  Then: a "Confirm Order (No Changes)" button is visible; no confirmed checkmark is visible

AC-5: Drag reorder updates sequence badges and emits qti-change
  Given: the item from AC-1
  When: the user drags "TOPSOIL" to position 1
  Then: the badge on "TOPSOIL" changes to 1; "BEDROCK" becomes 2; qti-change fires with
        value=["TOPSOIL","BEDROCK","SEDIMENTARY"]; the confirm button disappears and a
        success indicator appears

AC-6: Confirm button emits qti-change with current order
  Given: the item from AC-1 with the confirm button visible
  When: the user clicks "Confirm Order (No Changes)"
  Then: qti-change fires with value=["BEDROCK","SEDIMENTARY","TOPSOIL"]; the button
        is replaced by the success indicator

AC-7: Correct ordering scores 1
  Given: the item from AC-1 with correctResponse=["BEDROCK","SEDIMENTARY","TOPSOIL"]
        and MATCH_CORRECT response processing
  When: the user submits with RESPONSE=["BEDROCK","SEDIMENTARY","TOPSOIL"]
  Then: SCORE=1.0, MAXSCORE=1.0

AC-8: Incorrect ordering scores 0
  Given: the item from AC-1 with MATCH_CORRECT response processing
  When: the user submits with RESPONSE=["TOPSOIL","SEDIMENTARY","BEDROCK"]
  Then: SCORE=0.0, MAXSCORE=1.0

AC-9: Response prop synchronises list order
  Given: the item from AC-1 with response=["SEDIMENTARY","TOPSOIL","BEDROCK"] passed on mount
  When: the item renders
  Then: "SEDIMENTARY" appears at position 1, "TOPSOIL" at position 2, "BEDROCK" at position 3;
        no qti-change event fires on initial render

AC-10: Clearing response prop resets list to authored order
  Given: the item from AC-1 with an existing response
  When: the response prop is set to null
  Then: the list resets to authored order; the confirmed state clears; the confirm button
        reappears

AC-11: disabled=true blocks drag, keyboard, and button
  Given: the item from AC-1 with disabled=true
  When: the user attempts to drag an item or click the confirm button
  Then: no reordering occurs; no qti-change fires; items appear at reduced opacity

AC-12: SVG image renders without network request
  Given: a graphic-order item with inline SVG imageData
  When: the item renders
  Then: the SVG is visible inside the stage container; no image network request is made;
        the SVG fills the container at its declared dimensions

AC-13: Scorer role shows correct position highlighting
  Given: the item from AC-7 rendered with role="scorer", response=["BEDROCK","SEDIMENTARY","TOPSOIL"],
        correctResponse=["BEDROCK","SEDIMENTARY","TOPSOIL"]
  When: the item renders
  Then: each item in the correct position has a green background and a "Correct" badge;
        no correctness indicators appear for role="candidate"

AC-14: Prompt renders above the image when present
  Given: a graphic-order item with a <prompt> element
  When: the item renders
  Then: the prompt HTML appears above the stage container

AC-15: Error state when interaction data is absent
  Given: the component rendered with no interaction prop
  When: the item renders
  Then: an error message is shown in place of the interaction
```

### Accessibility

```
AC-A1: Image has accessible alt text
  Given: a graphic-order item rendered with no i18n provider
  When: a screen reader reaches the image element
  Then: the image is announced with alt="Ordering diagram"

AC-A2: Sortable list has accessible name
  Given: the item from AC-1
  When: a screen reader reaches the list container
  Then: the list is announced with its aria-label (e.g. "Reorderable list of choices")

AC-A3: Each list item announces position and label
  Given: the item from AC-1 with "SEDIMENTARY" at position 2
  When: a screen reader focuses the "SEDIMENTARY" list item button
  Then: the item is announced as something like "SEDIMENTARY. Position 2 of 3"

AC-A4: Keyboard grab and move announces position changes
  Given: the item from AC-1 with keyboard focus on "TOPSOIL" (position 3)
  When: the user presses Space to grab "TOPSOIL", then presses ArrowUp
  Then: "TOPSOIL" moves to position 2; a live region announces
        "TOPSOIL moved to position 2 of 3"

AC-A5: Keyboard Escape cancels grab without changing order
  Given: "TOPSOIL" is grabbed (Space pressed)
  When: the user presses Escape
  Then: "TOPSOIL" returns to its previous position; the order is unchanged;
        a live region announces the cancellation

AC-A6: Keyboard drop places item at new position
  Given: "TOPSOIL" grabbed at position 3, moved to position 1 via ArrowUp
  When: the user presses Space or Enter to drop
  Then: the item is placed at position 1; the live region announces the drop;
        qti-change fires with the new order

AC-A7: Confirm button has descriptive aria-label
  Given: the item from AC-1 before confirmation
  When: a screen reader reaches the confirm button
  Then: the button is announced as "Confirm this order as your answer" (or the i18n equivalent)

AC-A8: Focus is retained on moved item after keyboard reorder
  Given: "SEDIMENTARY" grabbed at position 2
  When: the user presses ArrowDown (moves to position 3) and then Space to drop
  Then: focus remains on the "SEDIMENTARY" button at its new position (3)

AC-A9: Disabled items are announced as inactive
  Given: the item rendered with disabled=true
  When: a screen reader reaches a list item button
  Then: the button is announced as disabled (not interactive)

AC-A10: Touch targets meet minimum size
  Given: the item from AC-1 rendered on a 375px viewport
  When: each list item button is measured
  Then: the clickable area is at least 44×44 CSS px per WCAG 2.2 SC 2.5.8
```

### Edge cases

```
AC-E1: Two-hotspot minimum renders and scores correctly
  Given: a graphic-order item with exactly 2 hotspot choices (A, B)
  When: the item renders, and the user reorders and submits
  Then: no errors; scoring against correctResponse=["A","B"] works as expected

AC-E2: Single-hotspot item is rejected by validator
  Given: a graphicOrderInteraction XML with only one hotspotChoice
  When: the extractor's validate() is called
  Then: validation returns valid=false with an error containing "at least 2 hotspots"

AC-E3: Duplicate identifiers are rejected by validator
  Given: a graphicOrderInteraction with two hotspotChoices both having identifier="A"
  When: the extractor's validate() is called
  Then: validation returns valid=false with an error containing "Duplicate hotspot identifier: A"

AC-E4: Image URL from external source renders correctly
  Given: a graphic-order item with imageData.src pointing to an external URL
  When: the item renders
  Then: the <img> element has src set to that URL; the alt text is present;
        if the image fails to load, the alt text is still visible

AC-E5: Hotspot label falls back to identifier when text content is empty
  Given: a hotspotChoice element with no text content but identifier="LAYER_2"
  When: the item renders
  Then: the list item shows "LAYER_2" as its label

AC-E6: Image missing (imageData=null) renders with warning, list still operable
  Given: a graphic-order item whose object element is absent
  When: the item renders
  Then: no image appears in the stage; the sortable list renders and is fully operable;
        no JavaScript error is thrown

AC-E7: Large coordinate values do not break layout
  Given: a hotspotChoice with coords="0,0,2000,1500" on a 400×300 image
  When: the item renders
  Then: the image and list render without CSS overflow or layout breakage;
        the coords are stored correctly in the extracted data

AC-E8: Partial ordering when maxChoices is smaller than hotspot count
  Given: a graphicOrderInteraction with maxChoices=2 and 4 hotspotChoices
  When: the item renders (noting maxChoices is not currently enforced)
  Then: all 4 items appear in the list; the response includes all 4 identifiers;
  Notes: this is a known gap — maxChoices enforcement is not implemented. This AC
         documents the current (non-enforcing) behaviour as the baseline until the gap is closed.

AC-E9: Response reflects confirmed drag order on subsequent re-render
  Given: the item with 3 hotspots; the user drags TOPSOIL to position 1 (qti-change fires)
  When: the parent re-renders the component with the new response prop
  Then: the list reflects TOPSOIL at position 1; no additional qti-change fires
```

---

## Open questions

- [ ] Should the default component overlay sequence number badges on the image at the hotspot coordinates (in addition to the list badges)? This requires coordinate-to-CSS-pixel scaling and increases complexity, but would better match the spec intent of "display indicators showing the selection order" on the image itself.
- [ ] Should `maxChoices` and `minChoices` be extracted and enforced? Currently neither is in `GraphicOrderInteractionData`. Enforcing `maxChoices < N` would require a "pick k of n" UI (candidates select which hotspots to include in their sequence), which is a materially different interaction model from the current "order all of them" approach.
- [ ] Should `fixed` hotspot position-locking be enforced in the sortable list? A fixed hotspot should not be draggable. This requires `SortableList` to accept a `lockedIds` prop.
- [ ] Should the image be clickable (click-in-sequence) as an alternative input modality alongside the sortable list? This would require hit-testing and deselection logic.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.3.3 graphicOrderInteraction
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — no gap items currently assigned to graphicOrderInteraction; the `maxChoices`/`minChoices`/`fixed` gaps documented above are not yet tracked
- Component: `packages/default-components/src/plugins/graphic-order/GraphicOrderInteraction.svelte`
- Shared component: `packages/default-components/src/shared/components/SortableList.svelte`
- Extractor: `packages/item-player/src/extraction/extractors/graphicOrderExtractor.ts`
- Type: `packages/item-player/src/types/interactions.ts` — `GraphicOrderInteractionData`, `GraphicOrderChoice`
- Extractor tests: `packages/item-player/tests/extraction/extractors/graphicOrderExtractor.test.ts`
- Eval fixture: `docs/evals/default-components/graphic-order/evals.yaml`
- Adjacent PRDs: [choice.md](choice.md) (shares shadow DOM / web component / parseJsonProp patterns), [order.md](order.md) (identical response cardinality, identical confirmation pattern, shares `SortableList`), [hotspot.md](hotspot.md) (shares image + hotspot coordinate model)
