# PRD: positionObjectInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: positionObjectInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`positionObjectInteraction` is a QTI 2.2 graphic interaction that asks the candidate to drag one or more moveable objects onto a background image (the stage) and drop them at free-form positions. The response is stored as a list of `"x y"` coordinate strings — one per placed object — using `baseType="point"` and `cardinality="multiple"`. **The response format does not record which object produced each coordinate**, making multi-object scoring deterministically impossible in QTI 2.2. This implementation exists for specification compliance and narrow single-object use cases. For labeled-object placement scenarios, `graphicGapMatchInteraction` is the correct interaction.

---

## Background and rationale

### THE QTI 2.2 IDENTITY LIMITATION — read this first

This is the most important thing to understand about `positionObjectInteraction`, and it is impossible to work around within the QTI 2.2 response model.

The `responseDeclaration` for this interaction always has `baseType="point"`. A `point` value is a whitespace-separated pair of integers representing `x y` coordinates in the stage's natural pixel coordinate system. A `multiple`-cardinality response is therefore a flat array of coordinate strings, for example `["105 132", "210 195", "88 74"]`.

**There is no field, attribute, or extension in QTI 2.2 that records which draggable object (which `positionObjectStage`) produced each coordinate.** The QTI 2.2 assessment item information model does not define any mechanism to bind a response value back to a source object identifier. The response is purely geometric.

**Practical consequence — single object items work correctly:**

When the item contains one `positionObjectStage` element and the candidate places it one or more times (the canonical spec use case is "drag an airport icon onto the map up to three times"), every coordinate in the response necessarily belongs to that one object. Scoring with `areaMapping`/`mapResponsePoint` works as intended: check whether any placed coordinate falls inside a defined region.

**Practical consequence — multi-object items cannot be scored deterministically:**

When the item contains two or more `positionObjectStage` elements (each with a distinct draggable image), the response is still a flat coordinate list. The delivery engine cannot tell from the response alone which object is at which position. Consider two objects A and B placed at coordinates P1 and P2: the response `["P1 P2"]` is identical whether A→P1,B→P2 or A→P2,B→P1. Scoring that requires "A must be in zone 1 and B must be in zone 2" is therefore impossible with standard response processing operators.

**This implementation's non-standard workaround and its limits:**

The component internally tracks an array of `{ stageId, x, y }` positions. The `stageId` field records which `positionObjectStage` the candidate dragged from. On change events the component strips `stageId` before emitting the QTI-format `string[]` response. When the component is initialised from a saved response (e.g. returning to a previously answered item), it attempts to reconstruct `stageId` from the array order: points 0..matchMax-1 are attributed to stage 0, points matchMax..2×matchMax-1 to stage 1, and so on. This reconstruction is order-dependent and fails silently if the candidate placed objects in a different order or if the response was produced by a different delivery engine. The visual display may be incorrect on restore; scoring is unaffected (it always uses coordinates). The internal `stageId` tracking is a UX convenience, not a scoring mechanism.

**QTI 3.0 resolution — deferred:**

QTI 3.0 restructures graphic interactions to include object identity in the response. This framework's QTI 3.0 work is tracked in `docs/SPEC-GAPS-PLAN.md`. Until QTI 3.0 graphic response support is implemented, `positionObjectInteraction` remains limited to single-object items for deterministic scoring.

### Why this interaction exists at all

The framework is a QTI 2.2 player. When a content package contains `positionObjectInteraction` elements, they must render and collect responses — refusing to render would break real items. The implementation provides a working player-side experience so that item authors and platform integrators who have single-object items (the spec's intended use case) get correct behavior. It does not attempt to solve the multi-object scoring gap because any solution would require extending the response format beyond QTI 2.2.

### Why the spec example is narrow

The only example in the IMS QTI 2.2 specification places multiple copies of an identical airport icon on a UK map. This is not a pedagogically common scenario in K-12 assessments: the more natural use case is "drag the heart, lungs, and liver to their correct positions on the body diagram", which requires object identity. The gap between the spec's example and the obvious use case explains why major QTI delivery platforms (TAO, Citolab) have largely not promoted this interaction type.

### Why `graphicGapMatchInteraction` should be used for labeled placement

`graphicGapMatchInteraction` uses `baseType="directedPair"` and `cardinality="multiple"`. Each response value is an `"OBJECT_ID HOTSPOT_ID"` pair, fully encoding object identity. Scoring rules can be exact: "HEART must map to region A, LIVER must map to region B". Any item that needs labeled object placement should be authored as `graphicGapMatchInteraction`.

---

## QTI specification alignment

**Spec version(s):** QTI 2.2 (primary); QTI 3.0 identity limitation resolution is out of scope  
**Spec section:** §3.3.6 positionObjectInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `positionObjectInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used as the key in `qti-change` event payload |
| `maxChoices` | ✅ Full | Maximum total placements across all stages. `0` = unlimited. Enforced by the component: the palette item becomes non-draggable when the limit is reached |
| `minChoices` | ✅ Extracted, not enforced | Present in `PositionObjectInteractionData`. Not validated at submit time. See Known gaps |
| `centerPoint` | ✅ Full | When `true` (the default), drop coordinates are adjusted so the object's center lands at the drop point. When `false`, the top-left corner lands at the drop point |

### Supported attributes on `positionObjectStage`

`positionObjectStage` is the child element defining each draggable object. **Note: in standard QTI 2.2, `positionObjectStage` is a container element in the item body, not a direct child of `positionObjectInteraction`. This implementation extracts `positionObjectStage` as a direct child of the interaction for rendering purposes.** See Design Decisions.

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required. Used as internal tracking key for multi-stage scenarios |
| `matchMax` | ✅ Full | Maximum number of times this specific stage can be placed. Defaults to `1`. Enforced per-stage: a fully-used stage becomes non-draggable |
| `matchMin` | ✅ Extracted | Minimum placements required for this stage. Present in extracted data; not validated at submit time |
| `class` | ✅ Extracted | CSS class list extracted and stored; not currently applied to the rendered stage element in the palette |

### Background image (`object` element)

The background image is the child `object` element of `positionObjectInteraction`. Both external image references (`type="image/png"`, `data="url"`) and inline SVG (`type="image/svg+xml"` with inline content) are supported. The declared `width` and `height` attributes define the natural coordinate system for all response point values.

**Critical: declared dimensions must match actual image dimensions.** The coordinate system of response point values is defined by the declared `width`/`height`. If the declared values differ from the actual rendered image pixels (e.g. the image is scaled by CSS), coordinate values in stored responses will not correspond to the correct visual positions when the item is replayed. The extractor emits a validation warning for external images reminding authors to verify dimension accuracy. See `positionObjectExtractor.ts` `validate()`.

### Response variable semantics

```
responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="point"
```

Each placed object contributes one `"x y"` string to the response array, where `x` and `y` are integer pixel coordinates in the stage's natural coordinate system (i.e. the coordinate system of the declared background image dimensions, before any display scaling). Coordinates are rounded to the nearest integer pixel on placement.

The response array length equals the total number of placed objects across all stages. Array order reflects placement order, not stage order.

### Scoring via `areaMapping` / `mapResponsePoint`

The standard scoring template for this interaction is `map_response_point`, using `areaMapping` in the `responseDeclaration`:

```xml
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="point">
  <areaMapping defaultValue="0">
    <areaMapEntry shape="circle" coords="105,132,25" mappedValue="1.0"/>
  </areaMapping>
</responseDeclaration>
```

`mapResponsePoint` iterates every value in the `multiple`-cardinality response and checks each `"x y"` point against the `areaMapping` entries. Supported shapes: `circle` (center-x, center-y, radius), `rect` (x1, y1, x2, y2), `poly` (x1, y1, x2, y2, ...).

For a single-object item, this scores each placement independently and sums matched values. For a multi-object item, `mapResponsePoint` sums all points against all areas with no notion of which object should be in which area — the limitation described above.

### Known gaps

No `positionObjectInteraction`-specific items appear in `docs/SPEC-GAPS-PLAN.md` (G-01 through G-15). However, the following spec behaviors are not fully implemented:

- **`minChoices` not validated at submit time**: G-06 style gap. `minChoices` on the interaction and `matchMin` on stages are extracted but not checked before submission. The submit button does not become active/inactive based on minimum placement count.
- **Keyboard placement not implemented**: The spec does not mandate a specific keyboard mechanism, but WCAG 2.2 requires all drag-and-drop operations to be operable without a mouse. See Non-functional requirements.
- **`positionObjectStage` XML hierarchy**: Standard QTI 2.2 places `positionObjectStage` as a sibling of `positionObjectInteraction` in the item body. This implementation expects `positionObjectStage` elements as direct children of `positionObjectInteraction` during extraction. Items authored to strict spec structure may not extract correctly. See Design Decisions.
- **Multi-session state restoration**: Because object identity is not encoded in the response, state restoration for multi-stage items uses best-effort array-order mapping. Positions may appear on the wrong stage after reload. Single-stage items restore correctly.

---

## Functional requirements

- **FR-1:** The component SHALL render the background image at full container width, maintaining the declared aspect ratio (`width`/`height` from the `object` element), without distortion.
- **FR-2:** The component SHALL render a palette panel listing each `positionObjectStage` with its label and a visual preview of its object image.
- **FR-3:** A candidate SHALL be able to drag a stage from the palette and drop it at any coordinate on the canvas.
- **FR-4:** After each placement, the component SHALL emit a `qti-change` event carrying the `responseIdentifier` and the updated response array of `"x y"` strings in natural image coordinates.
- **FR-5:** Coordinates recorded in the response SHALL be in the background image's natural coordinate system (i.e. scaled back from any CSS scaling applied to the container).
- **FR-6:** When `centerPoint` is `true`, the recorded coordinate SHALL be the center of the dropped object, not its top-left corner.
- **FR-7:** A placed object SHALL be re-draggable to a new position within the canvas. Moving an existing placement SHALL update its coordinate in the response array at the same index.
- **FR-8:** A placed object SHALL have a remove button that removes it from the canvas and restores it as available in the palette.
- **FR-9:** The palette item for a stage SHALL become non-draggable (visually dimmed, `draggable=false`) when that stage's `matchMax` placements have been used.
- **FR-10:** The palette item for any stage SHALL become non-draggable when the interaction-level `maxChoices` total has been reached (and `maxChoices > 0`).
- **FR-11:** When `role="scorer"` and `correctResponse` is non-empty, the component SHALL display correct-position ghost overlays (dashed green outline) at the correct coordinates for each stage.
- **FR-12:** When `role="scorer"`, user-placed objects that fall within 5 pixels of a correct position SHALL display a visual match indicator (green border, checkmark badge).
- **FR-13:** When `disabled=true`, all drag interactions SHALL be inert. The remove button SHALL not appear. Placed objects SHALL be visible but not interactive.
- **FR-14:** When the `response` prop is set externally (e.g. on item load), the component SHALL initialise positions from the response array. For single-stage items this SHALL be exact. For multi-stage items, array-order reconstruction SHALL be used and is acknowledged as best-effort.
- **FR-15:** The component SHALL display a `minChoices`/`maxChoices` counter indicating how many objects have been placed and how many are allowed or required.

---

## Non-functional requirements

### Accessibility

Free drag-and-drop has no native keyboard equivalent. WCAG 2.2 Success Criterion 2.1.1 requires all functionality to be operable via keyboard. The drag-and-drop mechanism satisfies pointer input; keyboard access requires an alternative path.

**Current keyboard support:**

- Palette items are focusable (`tabindex=0`) and have `role="button"` with an `aria-label` including the stage label and usage count.
- Placed objects on the canvas are focusable (`tabindex=0`) and have `role="button"` with an `aria-label` including stage label and coordinates.
- The remove button on each placed object is keyboard-accessible.
- **There is no keyboard mechanism to initiate a placement from the palette.** Pressing Enter/Space on a palette item does not begin a placement flow.

**Required keyboard fallback (open gap):**

A WCAG-compliant keyboard placement flow is not yet implemented. The minimum acceptable pattern for assessment contexts is:
1. Pressing Enter/Space on a palette item marks it as "selected for placement".
2. Arrow keys move a cursor or phantom indicator over the canvas.
3. Pressing Enter/Space drops the object at the current cursor position.
4. Escape cancels the placement.

Until this is implemented, this interaction does not satisfy WCAG 2.2 SC 2.1.1 for keyboard-only users. This is an open accessibility gap that must be resolved before the interaction can be used in legally required accessible assessments.

**Other accessibility requirements:**

- Canvas element MUST have `role="region"` and a descriptive `aria-label`.
- Placed object elements MUST have `role="button"`, `aria-label` with object name and coordinates, and `aria-pressed` or similar state to indicate selection.
- All instructional text (palette label, usage counts, placement hints) MUST be rendered in visible text, not only as visual indicators.
- Color MUST NOT be the sole differentiator for correct/incorrect placement (the green border alone is insufficient; the checkmark badge serves as the non-color indicator).
- Touch targets for the remove button MUST be at least 24×24 CSS pixels (WCAG 2.5.8).

### Performance

- Stage images and background images are referenced by URL; no lazy-loading is handled by this component. The host is responsible for preloading.
- Scale factor recalculation (`scaleFactor` derived state) re-runs whenever `imageContainer.offsetWidth` changes. This is driven by `$derived.by` and should not cause excessive computation in typical use.
- Items with more than approximately 20 placed objects have not been tested; large placement counts may cause DOM performance issues.

### Cross-platform

- Drag-and-drop relies on the HTML5 Drag and Drop API, which works on desktop browsers but is unreliable on iOS Safari (requires a polyfill or pointer-event fallback). Touch-based drag on mobile requires the use of `pointerdown`/`pointermove`/`pointerup` events or a library such as `@dnd-kit`. The current implementation uses HTML5 DnD only. Mobile support is an open gap.
- The canvas scales fluidly (`width: 100%` with `aspect-ratio` CSS), so the background image always fits the viewport. Coordinate scaling is handled by `scaleFactor`.

### i18n

- The palette title "Available Objects" and the placement hint "Drag objects onto the canvas to position them." are hardcoded English strings not routed through the i18n provider. These should be replaced with `i18n.t()` calls.
- `aria-label` strings for the canvas, placed objects, and palette items use hardcoded English fallbacks. The i18n provider pattern used by other interactions should be applied here.
- RTL layout: the flex layout switches from horizontal (`flex-row`) to vertical (`flex-col`) at small breakpoints; the palette appears to the right of the canvas on large screens. No RTL-specific layout testing has been done.

### Security

- Background image and stage object `src` URLs are passed directly to `<img src>` and SVG `data:` references. The host platform is responsible for ensuring these URLs are trusted.
- Inline SVG content from `positionObjectStage` `object` elements is rendered via `{@html}`. Content MUST be sanitized before extraction; the item-player rendering pipeline should apply sanitization before this component receives data.

---

## Design decisions

### Storing positions as `{ stageId, x, y }` internally

**Decision:** The component's internal state uses `Position[]` where each entry carries a `stageId` alongside coordinates, even though the QTI response format strips `stageId` before emission.

**Rationale:** Without `stageId`, the component cannot determine which palette slot to mark as "used" or which visual object to render at each canvas position. The internal model is richer than the QTI response model for UX purposes.

**Alternatives considered:** Deriving stage identity from canvas-position overlap with stage object bounds was rejected because objects can overlap, and identity would be ambiguous.

**Consequences:** The `stageId` round-trip through QTI format is lossy. On response restoration, `stageId` must be inferred from array order. Items with a single stage are not affected. Items with multiple stages will have degraded state restoration fidelity if the candidate placed objects out of stage order.

### `centerPoint` defaults to `true`

**Decision:** The extractor defaults `centerPoint` to `true` when the attribute is absent.

**Rationale:** The QTI 2.2 spec does not define a default for `centerPoint`. In practice, center-point placement is more natural: when a candidate drops a star icon, they intend the star's center to land at the drop location, not the star's top-left corner. Using `true` as the default matches this expectation and matches what item authors typically expect.

**Alternatives considered:** Defaulting to `false` (top-left) would match the spec's silence but produce counter-intuitive UX.

**Consequences:** Items where the author intended `centerPoint=false` but omitted the attribute will have a 0.5×width/height coordinate offset. Coordinates in existing `correctResponse` values must have been authored under the same `centerPoint` assumption.

### Scale factor conversion on drop

**Decision:** Drop event coordinates are converted from CSS-pixel space back to natural image coordinate space before being recorded in the response and before `centerPoint` adjustment is applied.

**Rationale:** The canvas container scales the background image to fill available width. The `imageContainer.offsetWidth` divided by the declared image `width` gives the scale factor. All coordinates stored in the response and all `areaMapping` coordinates in the `responseDeclaration` reference natural image pixels. Failing to convert would produce responses that only score correctly when the canvas is at exactly 100% of the declared image width.

**Alternatives considered:** Storing scaled coordinates was rejected because the scoring operator (`mapResponsePoint`) evaluates against `areaMapEntry` coordinates which are always in natural pixels.

**Consequences:** If `imageContainer` is null at drop time (e.g. the component is partially unmounted), the drop is silently ignored.

### `positionObjectStage` as child of `positionObjectInteraction`

**Decision:** The extractor looks for `positionObjectStage` elements as direct children of `positionObjectInteraction`, not as siblings in the item body.

**Rationale:** The rendering model requires the stage definitions to be associated with the interaction. Passing them through a separate extraction path and assembling them at a higher level would add significant complexity to the item player's extraction pipeline.

**Alternatives considered:** Extracting stages from the item body and joining them to the interaction by `responseIdentifier` was considered but rejected as over-engineering for an interaction type that is rarely used in practice.

**Consequences:** Items authored to strict QTI 2.2 spec structure (where `positionObjectStage` is a sibling element in the item body containing both the background and the interaction) may not extract correctly. Content that follows the structure shown in the spec's airport example — which nests `positionObjectInteraction` inside `positionObjectStage` — requires restructuring before this extractor can process it. See Open questions.

### Pixel rounding to integers

**Decision:** Coordinates are rounded to the nearest integer pixel (`Math.round`) before inclusion in the response.

**Rationale:** The QTI `point` baseType expects integer coordinates. Sub-pixel coordinates would not be useful for scoring and could cause comparison issues in `areaMapEntry` evaluations.

**Alternatives considered:** Storing float coordinates was rejected; the spec and scoring operator both work with integers.

**Consequences:** Placed objects will snap to integer positions on storage and reload. For objects larger than a few pixels, this is imperceptible.

---

## Data model / contracts

The extracted interaction data type is `PositionObjectInteractionData` from `packages/item-player/src/interactions/shared/types.ts`:

```typescript
interface PositionObjectInteractionData extends BaseInteractionData {
  type: 'positionObjectInteraction';
  prompt: string | null;
  maxChoices: number;    // 0 = unlimited
  minChoices: number;    // 0 = no minimum
  centerPoint: boolean;  // true = center drop point; default true
  imageData: ImageData | null;
  positionObjectStages: PositionObjectStage[];
}

interface PositionObjectStage {
  identifier: string;
  matchMax: number;   // max placements for this stage; default 1
  objectData: { type: 'image' | 'svg'; src?: string; content?: HtmlContent; width?: string; height?: string } | null;
  label: string;      // text content of the stage element, or identifier as fallback
}
```

The response wire format (QTI) is `string[]` where each element is `"x y"` with integer coordinates in natural image pixels. The `InteractionValueMap` for this interaction type maps it as `Record<string, { x: number; y: number }>` but this is the internal map, not the QTI serialization format.

**Invariants:**
- `response.length <= maxChoices` (when `maxChoices > 0`)
- Each `"x y"` string in the response is a pair of integers separated by a single space
- Coordinates are in the range `[0, imageData.width]` × `[0, imageData.height]` for correctly placed objects (unconstrained by the component — the candidate can technically drag outside the canvas)
- `positionObjectStages` has at least one element (enforced by the extractor's `validate()`)
- Each `positionObjectStage.identifier` is unique within the interaction (enforced by the extractor's `validate()`)

---

## Acceptance criteria

### Functional

**AC-1: Single object single placement**
```
Given: An item with one positionObjectStage (maxChoices=1, stage matchMax=1)
When: The candidate drags the stage from the palette and drops it at approximately (150, 80)
Then: The response is ["150 80"] (or coordinates within ±1px of the drop point adjusted for centerPoint)
      The stage in the palette shows "1/1 used" and is non-draggable
      The placed object is visible on the canvas at the correct position
```

**AC-2: Single object multiple placements**
```
Given: An item with one positionObjectStage (maxChoices=3, stage matchMax=3)
When: The candidate places the object three times at distinct coordinates
Then: The response is an array of three "x y" strings
      The palette shows "3/3 used" and the stage is non-draggable
      All three placements are visible on the canvas
```

**AC-3: maxChoices global limit enforced**
```
Given: An item with two positionObjectStages each with matchMax=2, and maxChoices=2
When: The candidate places one object from each stage (total 2 placements)
Then: Both palette items become non-draggable regardless of per-stage matchMax
      A third drag attempt produces no new placement
```

**AC-4: Per-stage matchMax enforced independently**
```
Given: An item with stageA (matchMax=1) and stageB (matchMax=2), maxChoices=0
When: The candidate places stageA once and stageB twice
Then: stageA palette item is non-draggable (1/1 used)
      stageB palette item is non-draggable (2/2 used)
      Response contains three coordinate strings
```

**AC-5: Remove button restores palette availability**
```
Given: A stage has been placed on the canvas (matchMax=1, shows "1/1 used")
When: The candidate clicks the remove button (×) on the placed object
Then: The object is removed from the canvas
      The palette item shows "0/1 used" and becomes draggable again
      The response no longer contains that coordinate
```

**AC-6: Re-drag existing placement updates coordinate**
```
Given: A placed object is visible on the canvas at (100, 100)
When: The candidate drags the placed object to a new position at (200, 150)
Then: The response is updated: the coordinate for that placement changes to "200 150"
      The response array length does not increase
      The old position is no longer shown on the canvas
```

**AC-7: centerPoint=true coordinate adjustment**
```
Given: An item with centerPoint=true and a stage object of width=24, height=24
When: The candidate drops the object such that the pointer is at canvas coordinates (110, 90)
Then: The recorded coordinate is "110 90" (center of the object lands at pointer)
      Notes: The component subtracts half the object dimensions from the drop point before recording
```

**AC-8: centerPoint=false coordinate adjustment**
```
Given: An item with centerPoint=false and a stage object of width=24, height=24
When: The candidate drops the object such that the pointer is at canvas coordinates (110, 90)
Then: The recorded coordinate is "110 90" (top-left of object lands at pointer)
      Notes: No dimension adjustment is applied
```

**AC-9: Coordinate scaling — canvas at 50% width**
```
Given: The canvas container is CSS-scaled to 50% of the declared image width
When: The candidate drops an object at CSS-pixel position (75, 40) on the rendered canvas
Then: The response coordinate is "150 80" (scaled back to natural image coordinates)
      Notes: Verify by checking that the coordinate matches the areaMapEntry evaluation
```

**AC-10: Response initialisation from saved state (single stage)**
```
Given: An item with one positionObjectStage
When: The component is initialised with response=["105 132"]
Then: The placed object appears at (105 * scaleFactor, 132 * scaleFactor) on the canvas
      The palette shows "1/matchMax used"
```

**AC-11: Disabled state**
```
Given: The component is rendered with disabled=true and existing placements
When: The candidate attempts to drag any object
Then: No drag is initiated (ondragstart returns early)
      No remove button is visible on placed objects
      Placed objects remain visible at their positions
```

**AC-12: Scorer role — correct response overlay**
```
Given: role="scorer", correctResponse=["105 132"], and the candidate has placed an object at (200 90)
When: The component renders
Then: A ghost overlay (dashed green outline) appears at the correct coordinate (105, 132)
      The user's placed object at (200, 90) does NOT show a match indicator
```

**AC-13: Scorer role — correct position match indicator**
```
Given: role="scorer", correctResponse=["105 132"], and the candidate placed an object at (105 133)
When: The component renders
Then: The placed object shows a green border and checkmark badge (within 5px tolerance)
      No ghost overlay appears for that correct position (it is already "placed")
```

**AC-14: Prompt rendered**
```
Given: An item where positionObjectInteraction has a <prompt> child element
When: The component renders
Then: The prompt text is displayed above the canvas layout
      The prompt uses @html rendering (allows inline HTML in the prompt)
```

**AC-15: Background image — SVG inline**
```
Given: The background image is an inline SVG (type="image/svg+xml")
When: The component renders
Then: The SVG is rendered via @html in the canvas area
      Objects can be placed over the SVG
      The SVG does not intercept pointer events (pointer-events: none)
```

**AC-16: Background image — external PNG**
```
Given: The background image is an external reference (type="image/png", data="/path/to/img.png")
When: The component renders
Then: An <img> element renders the background
      The alt attribute is set to the i18n-resolved background alt text
      The image does not intercept pointer events
```

**AC-17: No interaction data — error state**
```
Given: The interaction prop is null/undefined
When: The component renders
Then: An error message is displayed ("No interaction data provided" or i18n equivalent)
      No canvas or palette is rendered
```

**AC-18: minChoices indicator**
```
Given: An item with minChoices=2 and maxChoices=3
When: The candidate has placed 1 object
Then: The component displays "Minimum required: 2 | Maximum: 3"
      Notes: This is a visual hint; the component does not block submission based on minChoices
```

**AC-19: qti-change event payload**
```
Given: A valid positionObjectInteraction
When: The candidate places or removes an object
Then: A "qti-change" CustomEvent is dispatched from the root element
      event.detail.identifier equals the responseIdentifier from the interaction
      event.detail.value is an array of "x y" strings in natural image coordinates
```

**AC-20: Multi-stage response array order**
```
Given: An item with stageA and stageB
When: The candidate places stageA at (50, 60) then stageB at (120, 90)
Then: The response is ["50 60", "120 90"] (stageA first, stageB second, reflecting placement order)
      Notes: This is placement order, not stage declaration order
```

### Accessibility

**AC-A1: Canvas has accessible region role**
```
Given: The component renders normally
When: An assistive technology reads the page
Then: The canvas element has role="region" and aria-label="Positioning canvas" (or i18n equivalent)
```

**AC-A2: Palette items have role and accessible names**
```
Given: A palette item for stage "Airport Icon" with usage "1/2 used"
When: A screen reader focuses the palette item
Then: The announced label includes the stage name and usage count
      The element has role="button" and tabindex=0
      When the stage is non-draggable, tabindex=-1
```

**AC-A3: Placed objects have accessible names with coordinates**
```
Given: An object is placed at (105, 132) on the canvas
When: A screen reader focuses the placed object
Then: The label includes the stage name and coordinates, e.g. "Positioned Airport Icon at (105, 132)"
      If the position is correct (scorer role), the label includes "Correct position"
```

**AC-A4: Remove button accessible name**
```
Given: An object is placed with label "Star"
When: A screen reader focuses the remove button
Then: The button announces "Remove Star" (or i18n equivalent)
```

**AC-A5: Remove button touch target size**
```
Given: The component renders on a mobile viewport
When: Inspecting the remove button dimensions
Then: The hit area is at least 24×24 CSS pixels
```

**AC-A6: No color-only correct/incorrect distinction**
```
Given: role="scorer" with both correct and incorrect placements visible
When: Inspecting the visual indicators
Then: Correct positions have both a green border AND a checkmark badge (non-color indicator)
      Ghost overlays for unplaced correct positions use dashed border AND are distinct from placed objects
```

### Edge cases

**AC-E1: Duplicate identifier in positionObjectStages**
```
Given: The QTI XML contains two positionObjectStage elements with the same identifier
When: The extractor validates the extracted data
Then: The extractor returns a validation error: "Duplicate positionObjectStage identifier: {id}"
      The component renders the error state if invalid data reaches it
```

**AC-E2: maxChoices=0 (unlimited)**
```
Given: maxChoices=0 (spec: no upper limit)
When: The candidate places 10 objects (assuming stage matchMax is sufficient)
Then: All 10 placements are accepted
      The response contains 10 "x y" strings
      The palette does NOT show a "/" total count (or shows "10/∞")
```

**AC-E3: Missing background image**
```
Given: The positionObjectInteraction has no <object> element (imageData=null)
When: The extractor validates the data
Then: A validation warning is emitted: "positionObjectInteraction has no background image"
      The component renders without a background (empty canvas area) but does not crash
```

**AC-E4: Multi-stage state restoration — array order mismatch**
```
Given: An item with stageA (matchMax=1) and stageB (matchMax=1)
        A saved response ["200 150", "50 80"] where first coordinate belongs to stageB visually
When: The component is initialised with this response
Then: The component reconstructs: stageA→(200,150), stageB→(50,80) based on array-order heuristic
      The displayed positions may not match the original candidate intent
      No error or crash occurs
      Notes: This is the documented limitation. Single-stage items are not affected.
```

**AC-E5: Drop outside canvas bounds**
```
Given: The candidate drags an object and releases it outside the canvas element
When: The drop event fires on the canvas (dragover/drop are only on the canvas)
Then: If the pointer left the canvas, no drop event fires on the canvas
      The placement does not occur
      The object returns to the palette (HTML5 DnD default behavior)
```

**AC-E6: Malformed response value**
```
Given: The response prop contains a malformed entry such as "abc xyz" or "100"
When: The component initialises from this response
Then: The malformed entry is silently skipped (isNaN check in parsing logic)
      Valid entries are still initialised correctly
      No exception is thrown
```

**AC-E7: Image dimension mismatch warning**
```
Given: An external image item with declared width=300, height=196 but actual file is 600×392
When: The extractor validates the data
Then: A validation warning is emitted reminding the author to verify dimensions
      The component renders with the declared dimensions; coordinates are relative to 300×196 space
```

---

## Open questions

- [ ] **Strict QTI 2.2 `positionObjectStage` nesting**: The QTI 2.2 spec places `positionObjectStage` as a parent container in the item body with `positionObjectInteraction` as its child (i.e., the background image is on the stage, the draggable object is inside the interaction, which is inside the stage). The current extractor inverts this by looking for `positionObjectStage` as children of `positionObjectInteraction`. Item packages authored to strict QTI 2.2 spec nesting will not extract correctly. Decide: adapt the extractor to support the strict nesting, or document this as a permanent constraint and require content normalization?

- [ ] **Keyboard placement flow**: A keyboard alternative for drag-and-drop is required for WCAG 2.2 SC 2.1.1. No implementation exists. What is the approved interaction pattern? Options: (a) Select-then-arrow-keys with Enter to confirm; (b) Select-then-click on a grid overlay; (c) Coordinate text input fields. Needs UX decision before implementation.

- [ ] **Mobile touch drag support**: The HTML5 Drag and Drop API does not work reliably on iOS Safari. Is mobile support required for this interaction? If yes, a pointer-event-based drag implementation (or a polyfill) is needed.

- [ ] **`minChoices` submit-time validation**: Should the submit button be disabled or a warning shown when `minChoices > 0` and fewer placements exist? Currently only a text hint is shown. Should match the behavior of `minChoices` on other interactions.

- [ ] **Coordinate out-of-bounds clamping**: Should coordinates be clamped to the `[0, width] × [0, height]` range? A candidate who places an object at the very edge may produce a coordinate slightly outside the image bounds. Currently unclamped.

---

## Related

- QTI spec: §3.3.6 positionObjectInteraction — `docs/QTI_techguide.md`
- Response processing: `map_response_point` template — `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Implementation: `packages/default-components/src/plugins/position-object/`
- Extractor: `packages/item-player/src/interactions/position-object/extractor.ts`
- Types: `packages/item-player/src/interactions/shared/types.ts` — `PositionObjectInteractionData`, `PositionObjectStage`
- Plugin README with limitation notes: `packages/default-components/src/plugins/position-object/README.md`
- Eval scenarios: `docs/evals/default-components/position-object/evals.yaml`
- Spec gaps plan: `docs/SPEC-GAPS-PLAN.md` (no position-object specific items; keyboard gap is analogous to the accessibility baseline)
- Adjacent PRDs:
  - `docs/prds/interactions/graphic-gap-match.md` — the recommended alternative for labeled object placement (`planned`)
  - `docs/prds/interactions/select-point.md` — simpler coordinate-click interaction when no draggable object is needed
  - `docs/prds/interactions/hotspot.md` — for clicking predefined regions rather than free placement
