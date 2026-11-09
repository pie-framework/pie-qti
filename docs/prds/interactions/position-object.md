# PRD: positionObjectInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: positionObjectInteraction
  Last reviewed: 2026-11-09
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-11-09

---

## Summary

`positionObjectInteraction` is a QTI 2.2 graphic interaction that asks the candidate to drag one or more moveable objects onto a background image (the stage) and drop them at free-form positions. The response is stored as a list of `"x y"` coordinate strings — one per placed object — using `baseType="point"` and `cardinality="multiple"`. **The response format does not record which object produced each coordinate**, making multi-object scoring deterministically impossible in QTI 2.2. This implementation exists for specification compliance and narrow single-object use cases. For labeled-object placement scenarios, `graphicGapMatchInteraction` is the correct interaction.

---

## Background and rationale

### THE QTI 2.2 IDENTITY LIMITATION — read this first

This is the most important thing to understand about `positionObjectInteraction`, and it is impossible to work around within the QTI 2.2 response model.

> **Scope of the limitation (since G-17).** In the QTI content model each draggable object is its own `positionObjectInteraction` inside the shared `positionObjectStage`, bound to its own response variable, and the extractor follows that model. Several distinct objects on one stage, authored as one interaction each, therefore keep their identity: each object's points live in its own response variable and are scored against its own `areaMapping`. The identity-free response described below concerns the points of a single interaction, and becomes a real limitation only for renderer data that lists several different objects in one interaction (a non-standard extension; see Design decisions).

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

The framework is a QTI player. When a content package contains `positionObjectInteraction` elements, they must render and collect responses — refusing to render would break real items. The implementation provides a working player-side experience so that item authors and platform integrators who have single-object items (the spec's intended use case) get correct behavior. It does not attempt to solve the multi-object scoring gap because any solution would require extending the response format beyond QTI 2.2.

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
| `maxChoices` | ✅ Full | Maximum total placements across all stages. `0` = unlimited. Enforced by the component: the palette item becomes non-draggable when the limit is reached, and a placement refused at the limit is announced (see FR-10) |
| `minChoices` | ✅ Full | Minimum placements for a complete response. `Player.validateResponses()` reports the response incomplete while fewer than `minChoices` coordinates are placed; the component shows the requirement as a text hint and leaves submit gating to the host |
| `centerPoint` | ✅ Full | The point on the object image treated as the object's position: an offset from the object image's top-left corner, in its own pixels, horizontal then vertical (IntegerList of two). That point is held under the pointer, placed on the recorded point, and recorded as the response. When absent, the spec default applies: the centre of the object image's bounding rectangle. Read in every spelling: `centerPoint` (QTI 2.2), `centrePoint` (QTI 2.1 schema), `center-point` (QTI 3.0) and `centre-point` (a QTI 2.1 item converted to QTI 3.0). A malformed value is treated as absent |

### `positionObjectStage` structure (spec nesting)

As in QTI 2.2 and 3.0, `positionObjectStage` is the **parent** of `positionObjectInteraction` (the stage holds the background `object`; each interaction holds its own draggable `object`). The extractor discovers the interaction below its parent stage and reads the shared background from that parent (`packages/item-player/src/interactions/position-object/extractor.ts`; gap G-17 in `docs/SPEC-GAPS-PLAN.md`, closed). A parent that is not a `positionObjectStage` containing the interaction is rejected, not silently treated as a stage.

| Extracted from the stage/interaction pair | Source | Behaviour |
|-------------------------------------------|--------|-----------|
| Stage identifier | `responseIdentifier` of the interaction | Internal tracking key for the one draggable object this interaction contributes (see Design decisions) |
| Background image | stage's `object` child | Rendered as the canvas; its declared `width`/`height` define the coordinate system |
| Draggable object | interaction's `object` child | Rendered in the palette; its declared `width`/`height` (default 50×50) size the placed box |
| `label` | the draggable object's authored text alternative | Names the object in the palette and announcements; never falls back to the identifier (which can leak the answer key) |
| `class` on the interaction | interaction element | Extracted into the stage entry's `classes`; not currently applied to the rendered palette element |
| Placement limit | interaction `maxChoices` | Becomes the stage entry's `matchMax` (one draggable object, placed up to `maxChoices` times) |

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

Remaining gaps against the specification and this PRD:

- **Object identity in hand-built multi-object data**: the extractor delivers one draggable object per interaction, so extracted items restore exactly (every point of a response belongs to its interaction's one object). Renderer data built by hand with several `positionObjectStages` entries in one interaction is a non-standard extension: its points carry no object identity, and on restore the component maps them to entries by array order, so positions may appear on the wrong object after reload.
- **`centerPoint` on an object without a declared size**: `centerPoint` is measured in the object image's pixels, but its natural size is only known from the declared `width`/`height`. An object that declares neither renders in the 50×50 fallback box, so an authored point is taken against that box and lands off by the image's scale. The response point is unaffected; only where the object is drawn around it shifts. Authors using `centerPoint` should declare the object's size.
- **Restored responses are not clamped**: placements made in the component are clamped to the stage image, but a restored or programmatic response outside `[0, width] × [0, height]` is drawn where it says.

Resolved since the previous review, and no longer gaps:

- **Keyboard placement** (K-04): an object is selected in the palette with Enter or Space, moved on the canvas with the arrow keys and placed with Enter or Space; Escape cancels. A click or tap on the canvas places the selected object too (single-pointer alternative, WCAG 2.5.7). See Accessibility.
- **`positionObjectStage` hierarchy** (G-17): extraction follows the spec nesting, with the stage as the interaction's parent (see `positionObjectStage` structure above).
- **`minChoices` at submission**: `Player.validateResponses()` reports the response incomplete below `minChoices`.

---

## Functional requirements

- **FR-1:** The component SHALL render the background image at full container width, maintaining the declared aspect ratio (`width`/`height` from the `object` element), without distortion.
- **FR-2:** The component SHALL render a palette panel listing each `positionObjectStage` with its label and a visual preview of its object image.
- **FR-3:** A candidate SHALL be able to place an object from the palette at any coordinate on the canvas by dragging it (mouse or touch), or by selecting it (click, tap, Enter or Space) and then clicking/tapping the canvas or positioning it with the arrow keys and Enter.
- **FR-4:** After each placement, the component SHALL emit a `qti-change` event carrying the `responseIdentifier` and the updated response array of `"x y"` strings in natural image coordinates.
- **FR-5:** Coordinates recorded in the response SHALL be in the background image's natural coordinate system (i.e. scaled back from any CSS scaling applied to the container).
- **FR-6:** The recorded coordinate SHALL be the stage position of the object's reference point: its authored `centerPoint`, or the centre of its bounding rectangle when none is authored. The placed object SHALL render with that point on the recorded coordinate, for pointer, touch, click-to-place and keyboard placement alike.
- **FR-7:** A placed object SHALL be re-draggable to a new position within the canvas. Moving an existing placement SHALL update its coordinate in the response array at the same index.
- **FR-8:** A placed object SHALL have a remove button that removes it from the canvas and restores it as available in the palette.
- **FR-9:** The palette item for a stage SHALL become non-draggable (visually dimmed, `draggable=false`) when that stage's `matchMax` placements have been used.
- **FR-10:** The palette item for any stage SHALL become non-draggable when the interaction-level `maxChoices` total has been reached (and `maxChoices > 0`). A placement attempt refused at a cap — keyboard Enter, canvas click/tap or drag drop — SHALL be announced through the polite live region naming the maximum ("The maximum of {max} placements is reached."), never silently ignored; the crosshair placement mode stays active so Escape still works.
- **FR-11:** When `role="scorer"` and `correctResponse` is non-empty, the component SHALL display correct-position ghost overlays (dashed green outline) at the correct coordinates for each stage.
- **FR-12:** When `role="scorer"`, user-placed objects that fall within 5 pixels of a correct position SHALL display a visual match indicator (green border, checkmark badge).
- **FR-13:** When `disabled=true`, all drag interactions SHALL be inert. The remove button SHALL not appear. Placed objects SHALL be visible but not interactive.
- **FR-14:** When the `response` prop is set externally (e.g. on item load), the component SHALL initialise positions from the response array. For single-stage items this SHALL be exact. For multi-stage items, array-order reconstruction SHALL be used and is acknowledged as best-effort.
- **FR-15:** The component SHALL display a `minChoices`/`maxChoices` counter indicating how many objects have been placed and how many are allowed or required. The maximum is stated whenever `maxChoices > 0`, including items that declare no minimum (WCAG 3.3.2: the cap is known before the first refusal).

---

## Non-functional requirements

### Accessibility

Free drag-and-drop has no native keyboard equivalent. WCAG 2.2 Success Criterion 2.1.1 requires all functionality to be operable via keyboard, and SC 2.5.7 requires a single-pointer alternative to dragging. Both are implemented (K-04; covered by `packages/default-components/tests/component/position-object.vitest.ts`):

- Palette items are focusable (`tabindex=0`) and have `role="button"`, `aria-pressed` while selected, and an `aria-label` with the object name and usage count. A fully used item is `aria-disabled` and leaves the tab order.
- **Keyboard placement:** Enter or Space on a palette item selects the object and moves focus to the canvas, which becomes a focusable `role="application"` (so screen readers pass the arrow keys through) with an instruction label. The arrow keys move a visible crosshair (5% steps, 1% with Shift), each move announced as a position; Enter or Space places the object at the crosshair, Escape cancels. The crosshair starts on the object's last placement, else the centre.
- **Single-pointer placement:** after selecting an object, a click or tap on the canvas places it there; no dragging is needed.
- Placed objects are `role="group"` elements named with the object and its position in percent of the stage ("Airport at 25%, 40%."), holding their remove button ("Remove Airport"), so no button nests inside a button.
- Placements, removals, cancellations and refused placements are announced through a polite live region. A placement refused at the interaction's `maxChoices` names the maximum ("The maximum of {max} placements is reached."); pressing Enter again re-announces it, and the placement mode stays active, so Escape still cancels and the response is unchanged.

**Other accessibility requirements:**

- All instructional text (palette title, usage counts, placement hints) MUST be rendered in visible text, not only as visual indicators.
- Color MUST NOT be the sole differentiator for correct/incorrect placement (the green border alone is insufficient; the checkmark badge serves as the non-color indicator).
- Touch targets for the remove button MUST be at least 24×24 CSS pixels (WCAG 2.5.8).

### Performance

- Stage images and background images are referenced by URL; no lazy-loading is handled by this component. The host is responsible for preloading.
- Placed objects are positioned in percentages of the stage, so they scale with it without recalculation; pointer positions are mapped to natural image pixels from the canvas's bounding rectangle at the moment of placement.
- Items with more than approximately 20 placed objects have not been tested; large placement counts may cause DOM performance issues.

### Cross-platform

- Desktop pointers drag with the HTML5 Drag and Drop API. Touch drags use the shared `touchDrag` helper from `@pie-qti/qti-common`, which maps a touch drag onto the same drop handling, and tap-to-select then tap-to-place works without any drag.
- The canvas scales fluidly (`width: 100%` with `aspect-ratio` CSS) up to the image's natural size, so the background image always fits the viewport.

### i18n

- All visible text and accessible names (palette title and instructions, usage counts, minimum/maximum hints, canvas instructions, placed-object names, remove labels, image fallbacks and live announcements) are routed through the `@pie-qti/i18n` provider under `interactions.positionObject.*` and shared `accessibility.*` keys, in every shipped locale.
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

### `centerPoint` is a point, defaulting to the object's centre

**Decision:** The extractor reads `centerPoint` as an `{ x, y }` offset in the object image's own pixels, or `null` when it is absent or malformed. The component treats `null` as the centre of the object's bounding rectangle.

**Rationale:** The QTI information model (QTI 2.2.4 ASI Information Model, Table 5.81.1) defines it: "The centrePoint attribute defines the point on the image being positioned that is to be treated as the centre as an offset from the top-left corner of the image in horizontal, vertical order. By default this is the centre of the image's bounding rectangle." An earlier version of this component modelled it as a boolean (`true` = centre, `false` = top-left corner), which could not express an authored point such as the tip of a pin.

**Alternatives considered:** Keeping the boolean alongside a new offset field was rejected: two fields for one concept, one of them not in the spec. The legacy top-left placement is expressible as `centerPoint="0 0"`.

**Consequences:** `PositionObjectInteractionData.centerPoint` is `PositionObjectCenterPoint | null`. A host that hands the web component JSON with the legacy boolean gets the default (centre) placement. Coordinates in `correctResponse` and `areaMapping` are stage positions of the reference point, so they must be authored against the same `centerPoint`.

### Scale factor conversion on drop

**Decision:** Drop event coordinates are converted from CSS-pixel space back to natural image coordinate space before being recorded in the response. The pointer marks the object's reference point (the drag image is held by it), so no `centerPoint` adjustment is applied to the recorded point; the reference point only offsets where the object is drawn.

**Rationale:** The canvas container scales the background image to fill available width. The canvas's rendered size (its bounding rectangle) against the declared image `width`/`height` gives the scale. All coordinates stored in the response and all `areaMapping` coordinates in the `responseDeclaration` reference natural image pixels. Failing to convert would produce responses that only score correctly when the canvas is at exactly 100% of the declared image width.

**Alternatives considered:** Storing scaled coordinates was rejected because the scoring operator (`mapResponsePoint`) evaluates against `areaMapEntry` coordinates which are always in natural pixels.

**Consequences:** If `imageContainer` is null at drop time (e.g. the component is partially unmounted), the drop is silently ignored.

### `positionObjectStage` as the interaction's parent

**Decision:** The extractor follows the QTI content model: it discovers each `positionObjectInteraction` below its parent `positionObjectStage`, reads the shared background `object` from that parent and the draggable `object` from the interaction, and delivers that one draggable object as the single `positionObjectStages` entry of the interaction's data (G-17, closed).

**Rationale:** The earlier extractor looked for `positionObjectStage` elements as children of the interaction, the reverse of the QTI 2.2/3.0 nesting, so schema-valid items (including the specification's airport example) did not extract. Keeping the renderer's `positionObjectStages` array as the delivery shape left the component unchanged.

**Alternatives considered:** Requiring content to be restructured before delivery was rejected: schema-valid QTI must play as authored.

**Consequences:** Several interactions on one stage each render their own canvas with the shared background and their own response variable. An interaction outside a `positionObjectStage`, or without a draggable `object`, fails extraction validation. Renderer data with several `positionObjectStages` entries in one interaction is only reachable by hand-built data (see Known gaps).

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
  centerPoint: PositionObjectCenterPoint | null;  // null = centre of the object's bounding rectangle
  imageData: ImageData | null;
  positionObjectStages: PositionObjectStage[];
}

/** Offset from the object image's top-left corner, in its own pixels (QTI centerPoint). */
interface PositionObjectCenterPoint {
  x: number;
  y: number;
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
- Coordinates are in the range `[0, imageData.width]` × `[0, imageData.height]`: placements made in the component are clamped to the stage image (restored responses are drawn as given)
- Extracted data has exactly one `positionObjectStages` entry, the interaction's draggable object, identified by the interaction's `responseIdentifier`; the extractor's `validate()` rejects an interaction without a parent stage background or a draggable object

---

## Acceptance criteria

### Functional

**AC-1: Single object single placement**
```
Given: An item with one positionObjectStage (maxChoices=1, stage matchMax=1)
When: The candidate drags the stage from the palette and drops it at approximately (150, 80)
Then: The response is ["150 80"] (or coordinates within ±1px of the drop point)
      The stage in the palette shows "1/1 used" and is non-draggable
      The placed object is visible on the canvas with its reference point at the drop position
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
      A third drag attempt produces no new placement and announces
      "The maximum of 2 placements is reached."
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

**AC-7: Default reference point is the object centre**
```
Given: An item without centerPoint and a stage object of width=24, height=24
When: The candidate drops the object such that the pointer is at canvas coordinates (110, 90)
Then: The recorded coordinate is "110 90" and the object's centre is drawn at (110, 90)
      Notes: The drag image is held by its centre; the box is shifted back by half its size
```

**AC-8: Authored centerPoint is the placed and recorded point**
```
Given: An item with centerPoint="12 24" and a stage object of width=24, height=24 (a pin whose tip is bottom-centre)
When: The candidate drops the object such that the pointer is at canvas coordinates (110, 90)
Then: The recorded coordinate is "110 90" and the pin's tip is drawn at (110, 90)
      Notes: The drag image is held by the tip; keyboard placement records the crosshair the same way
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
Then: The placed object's reference point appears at (105, 132) in stage pixels, scaled with the rendered stage
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
      Notes: This is a visual hint; the component does not block submission. Player.validateResponses()
      reports the response incomplete until 2 objects are placed; gating submission on it is the host's choice
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

**AC-A1: Keyboard placement**
```
Given: The component renders with one object in the palette
When: The user focuses the palette item, presses Enter, presses ArrowRight once, then presses Enter
Then: Focus moves to the canvas, which has role="application" and an instruction label while placing
      The object is placed 5% right of the stage centre, and the placement is announced in the live region
      Escape instead of the second Enter cancels the placement and announces it
```

**AC-A2: Palette items have role and accessible names**
```
Given: A palette item for stage "Airport Icon" with usage "1/2 used"
When: A screen reader focuses the palette item
Then: The announced label includes the stage name and usage count
      The element has role="button" and tabindex=0
      When the stage is non-draggable, tabindex=-1
```

**AC-A3: Placed objects have accessible names with their position**
```
Given: An object named "Airport" is placed at 25%, 40% of the stage
When: A screen reader reaches the placed object
Then: It is a group named "Airport at 25%, 40%." that contains its remove button (no button nests in a button)
      If the position is correct (scorer role), the name ends with "Correct position."
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

**AC-A7: A placement refused at maxChoices is announced (round 8)**
```
Given: maxChoices=1, the stage's matchMax allows more picks, and a restored response
       already holds one placement
When: The candidate picks the object in the palette and presses Enter on the canvas
      (or taps/clicks the canvas, or drops a drag)
Then: No second placement is recorded; the live region announces
      "The maximum of 1 placement is reached."; the crosshair stays active and
      Escape still cancels with the usual announcement
```

**AC-A8: The maximum is stated for a maxChoices-only item**
```
Given: minChoices=0 and maxChoices=2
When: The component renders
Then: The hint line shows "Maximum: 2" without any "Minimum required" text
```

### Edge cases

**AC-E1: Interaction outside a positionObjectStage**
```
Given: A positionObjectInteraction whose parent is not a positionObjectStage (even one holding an object)
When: The extractor validates the extracted data
Then: Validation fails: "positionObjectInteraction must have a parent positionObjectStage with a background object"
```

**AC-E2: maxChoices=0 (unlimited)**
```
Given: maxChoices=0 (spec: no upper limit)
When: The candidate places 10 objects (assuming stage matchMax is sufficient)
Then: All 10 placements are accepted
      The response contains 10 "x y" strings
      The palette does NOT show a "/" total count (or shows "10/∞")
```

**AC-E3: Missing draggable object**
```
Given: The positionObjectInteraction has no <object> child of its own
When: The extractor validates the data
Then: Validation fails: "positionObjectInteraction must contain one draggable object"
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

Resolved and removed since the previous review: strict `positionObjectStage` nesting (now extracted as the spec nests it, G-17), the keyboard placement pattern (select, arrow keys, Enter; K-04), mobile touch drag (the shared `touchDrag` helper plus tap-to-place), `minChoices` at submission (`Player.validateResponses()`), and clamping of placements (clamped to the stage image).

- [ ] **Restored out-of-bounds points**: Should a restored or programmatic response outside `[0, width] × [0, height]` be clamped, flagged, or drawn as given (current behaviour)?

- [ ] **Hand-built multi-object data**: Should renderer data that lists several different objects in one interaction stay supported (with its array-order restoration), or be rejected now that extracted items always carry one object per interaction?

---

## Related

- QTI spec: §3.3.6 positionObjectInteraction — `docs/QTI_techguide.md`
- Response processing: `map_response_point` template — `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Implementation: `packages/default-components/src/plugins/position-object/`
- Component tests (keyboard, single-pointer and touch placement): `packages/default-components/tests/component/position-object.vitest.ts`
- Extractor: `packages/item-player/src/interactions/position-object/extractor.ts` (tests: `packages/item-player/tests/extraction/extractors/positionObjectExtractor.test.ts`)
- Types: `packages/item-player/src/interactions/shared/types.ts` — `PositionObjectInteractionData`, `PositionObjectStage`
- Plugin README with limitation notes: `packages/default-components/src/plugins/position-object/README.md`
- Eval scenarios: `docs/evals/default-components/position-object/evals.yaml`
- Spec gaps plan: `docs/SPEC-GAPS-PLAN.md` §G-17 (`positionObjectStage` hierarchy, closed)
- Adjacent PRDs:
  - `docs/prds/interactions/graphic-gap-match.md` — the recommended alternative for labeled object placement (`planned`)
  - `docs/prds/interactions/select-point.md` — simpler coordinate-click interaction when no draggable object is needed
  - `docs/prds/interactions/hotspot.md` — for clicking predefined regions rather than free placement
