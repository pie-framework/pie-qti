# PRD: selectPointInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: selectPointInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`selectPointInteraction` is the QTI interaction type for "click a location on an image" questions. Unlike `hotspotInteraction`, where the scoreable regions are visible to the candidate as defined clickable areas, `selectPointInteraction` presents a plain image and asks the candidate to click anywhere. The scoring regions are defined by the item author in the `responseDeclaration` via `areaMapping`, and are never shown to the candidate during response collection. The response is a `point` baseType value representing the clicked coordinate in the image's natural (intrinsic) pixel space. Coordinate normalization from rendered pixels to natural image dimensions is the central implementation concern, because `areaMapping` coordinates are always authored in natural image space.

---

## Background and rationale

**Why scoring regions are hidden**: This is the defining characteristic of `selectPointInteraction`. The pedagogical intent is to test whether the candidate knows where something is on an image, not to give them a target to aim at. Showing scoring regions would turn the interaction into a trivial click-inside-the-highlighted-box exercise. This means the component must never render `areaMapEntry` regions visually, even in scorer role — the component only shows the submitted point marker(s) and, in scorer role, the ideal correct answer point(s) from `correctResponse`. The scoring regions themselves stay inside the `responseDeclaration`.

**Why coordinate normalization is mandatory**: Modern browsers scale images via CSS. The image in the DOM is rendered at whatever size the CSS and container dictate, but the `areaMapping` coordinates in the XML are authored against the image's natural (intrinsic) dimensions — e.g. if the image is 500×400 pixels wide and `width="500"` is declared in the XML, a circle `coords="350,200,20"` means "radius 20 around pixel (350,200) in the 500×400 space." If the image is rendered at 250×200 (50% scale) and the user clicks at rendered pixel (175,100), the click must be recorded as natural pixel (350,200), not (175,100). Without normalization, scoring is only correct when the image is displayed at exactly its natural size, which is never guaranteed on mobile or fluid-layout pages.

**Why the component reads `imageData.width` and `imageData.height` rather than `naturalWidth`/`naturalHeight` from the DOM**: The extractor extracts the `width` and `height` attributes from the QTI XML's `<object>` or `<img>` element. These are the authoring-time natural dimensions used by the item author when placing `areaMapEntry` coordinates. The browser's `img.naturalWidth` would give the actual intrinsic pixel size of the loaded image file, which may differ if the image file is not the exact size the item author had in mind. Using the authored dimensions keeps the coordinate space consistent with what was specified in the XML.

**Why this is different from `hotspotInteraction`**: In `hotspotInteraction`, the `hotspotChoice` elements define named regions the candidate selects; the response is a set of `identifier` strings. In `selectPointInteraction`, there are no pre-defined choice regions — the candidate selects any pixel; the response is a `point` string. The scoring engine checks where the point lands using `areaMapping` post-response. This inverts the authoring model: the item author must think about scoring geometry when writing the `responseDeclaration`, not when writing the item body.

**Why `maxChoices=0` means unlimited**: QTI defines `maxChoices=0` as no restriction on the number of points (see the `maxChoices` row below for the per-version defaults). The extractor accepts 0 and rejects only a negative value, and the component's `canSelectMore` treats 0 as unlimited.

**How keyboard placement works**: Free-form coordinate selection has no native keyboard equivalent, so the component provides a crosshair. When the selection surface gets keyboard focus, a crosshair appears at the center of the image. Arrow keys move it by 5% of the image per press, or 1% with Shift. Enter or Space places a point there. A polite live region announces the position, each placement and removal, and when the maximum is reached. Each placed point has a "Remove point N" button. A pointer click places its point directly and shows no crosshair. QTI defines no keyboard interaction for this interaction, so the crosshair is an accessibility extension for WCAG 2.2 SC 2.1.1.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place)  
**Spec section:** §3.3.2 selectPointInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `selectPointInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | Full | Extracted as `responseId`; bound to the response variable; included in `qti-change` event payload |
| `maxChoices` | Full | `0` means no restriction; a value `>= 1` caps the points, and the component blocks additional selections once `selectedPoints.length === maxChoices`. An absent attribute takes the per-version spec default: 0 in QTI 2.2 (Table 5.95.2) and 3.0 (Table 5.128.2), or 1 when the response is single cardinality, which holds one point; QTI 2.1 content keeps 1, its information model (`maxChoices [1] = 1`) and XSD (default 0) disagreeing |
| `minChoices` | Full | Extracted and surfaced in the UI as a "select at least N" badge. `Player.validateResponses()` reports a response with fewer points incomplete; whether that blocks submission is the delivery policy (in a test, `itemSessionControl.validateResponses`) |

### Child elements

| Element | Support | Behaviour |
|---------|---------|-----------|
| `<prompt>` | Full | HTML content extracted and rendered above the image |
| `<object type="image/...">` | Full | External image loaded via `data` attribute as `src` |
| `<object type="image/svg+xml">` | Full | Inline SVG extracted and rendered via `{@html}` |
| `<img>` | Full | Fallback when `<object>` is absent; `src` extracted from `src` attribute |

### Response variable contract

- **baseType:** `point`
- **cardinality:** `single` when `maxChoices=1`; `multiple` when `maxChoices>1` or `0`
- **Wire format (single):** A single string `"x y"` — two integers separated by a space, where `x` and `y` are coordinates in natural image pixel space (origin top-left)
- **Wire format (multiple):** An array of `"x y"` strings
- **Null/empty:** `null` before any selection (single cardinality); `[]` before any selection (multiple cardinality)
- **Internal representation:** The component maintains `selectedPoints: Point[]` where `Point = { x: number; y: number }`. Conversion between internal `Point[]` and the `"x y"` string format happens at every click and every inbound `response` prop sync.

The component reads an inbound `response` only in that `"x y"` form (a string, or an array of them); any other value places no points. It always emits canonical `"x y"` strings outward.

### Scoring

Two scoring patterns are supported:

**1. `MAP_RESPONSE_POINT` template with `areaMapping`:**

```xml
<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="point">
  <areaMapping defaultValue="0">
    <areaMapEntry shape="circle" coords="350,200,20" mappedValue="1"/>
  </areaMapping>
</responseDeclaration>
<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response_point"/>
```

The `mapResponsePoint` expression in `@pie-qti/qti-processing` evaluates each selected point against each `areaMapEntry` in sequence, returning the `mappedValue` of the first matching entry. For `multiple` cardinality, scores for each point are summed. `lowerBound` and `upperBound` clamp the total. Supported shapes: `rect`, `circle`, `ellipse`, `poly`, `default`. Coordinate format per shape follows the HTML `<area>` element convention.

**2. Custom `responseProcessing` using the `inside` operator:**

```xml
<responseProcessing>
  <responseCondition>
    <responseIf>
      <inside shape="circle" coords="350,200,20">
        <variable identifier="RESPONSE"/>
      </inside>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">1.0</baseValue>
      </setOutcomeValue>
    </responseIf>
    ...
  </responseCondition>
</responseProcessing>
```

The `inside` expression is also implemented in `@pie-qti/qti-processing`. It supports the same four shapes as `areaMapEntry`. The sample item at `apps/demo` uses this pattern rather than `map_response_point`. Both patterns are valid QTI.

### Area coordinate format reference

| Shape | `coords` format | Example |
|-------|----------------|---------|
| `rect` | `x1,y1,x2,y2` — top-left and bottom-right corners | `"80,80,180,180"` |
| `circle` | `cx,cy,r` — centre and radius | `"350,200,20"` |
| `ellipse` | `cx,cy,rx,ry` — centre and semi-axes | `"350,200,30,20"` |
| `poly` | `x1,y1,x2,y2,...` — polygon vertices (min 3 points, i.e. 6 values) | `"130,280,180,360,80,360"` |
| `default` | (no coords) — always matches | — |

All coordinates are in natural image pixel space (origin top-left).

### Known gaps

- **No PNP support:** PNP personal needs (G-09, G-13, G-14) are not implemented for this interaction.

Resolved since the previous review, and no longer gaps:

- **`maxChoices=0`**: accepted as unlimited (see the rationale above).
- **Keyboard coordinate selection**: the crosshair (see [Non-functional requirements](#non-functional-requirements)).
- **`AreaMapping.entries` type**: both `@pie-qti/item-player` and `@pie-qti/qti-processing` use `AreaMapEntry[]`.

---

## Functional requirements

- **FR-1:** When the candidate clicks or taps a location on the image, record the coordinate in natural image pixel space (normalized from rendered pixel coordinates using the authored `imageData.width` and `imageData.height` as the reference dimensions).
- **FR-2:** Display a circular marker at each selected point. The marker must be positioned using percentage offsets computed from natural coordinates (`x / naturalWidth * 100%`, `y / naturalHeight * 100%`) so the marker tracks the correct visual location regardless of rendered image size.
- **FR-3:** Each point marker must include a visible number label (1, 2, …) for multi-point interactions, and a remove button that deletes the corresponding point from the response.
- **FR-4:** Emit a `qti-change` CustomEvent from the root element after every point addition or removal. The event payload must contain `responseIdentifier` and `value`. For `maxChoices=1`, `value` is a single `"x y"` string or `null`. For `maxChoices>1`, `value` is an array of `"x y"` strings.
- **FR-5:** When `selectedPoints.length === maxChoices`, block further clicks (do not add new points) and display an alert informing the candidate that the maximum has been reached.
- **FR-6:** When `minChoices > 0`, display a badge indicating whether the minimum has been met. The badge must update reactively as points are added or removed.
- **FR-7:** Provide a "Clear All" button when at least one point is selected. Activating it removes all points and emits a `qti-change` event with `null` (single cardinality) or `[]` (multiple cardinality).
- **FR-8:** Accept an inbound `response` prop and initialize `selectedPoints` from it. Support the `"x y"` string and an array of `"x y"` strings; any other value places no points.
- **FR-9:** When `disabled=true`, the image container must be non-interactive (no clicks accepted, cursor must be `default`). Point markers must be disabled. Clear All must be disabled. No `qti-change` events may fire.
- **FR-10:** When `role='scorer'` and `correctResponse` is provided, display correct-answer markers (green, `✓` label) at the correct point positions on the image, overlaid on top of the candidate's markers. The scoring regions (`areaMapEntry` areas) must never be rendered visually.
- **FR-11:** Support both external raster images (via `<object data="...">` or `<img src="...">`) and inline SVG (via `<object type="image/svg+xml">`).
- **FR-12:** When `imageData` is null or absent, render a placeholder and do not attempt any coordinate computation.

---

## Non-functional requirements

### Accessibility

`selectPointInteraction` is the most accessibility-challenging standard QTI interaction because free-form coordinate selection has no natural keyboard equivalent. The following requirements define what "accessible" means for this interaction:

- **Pointer operation (minimum):** The image container must be reachable by keyboard (Tab to focus, visible focus ring). At minimum, the focused container must announce its purpose via `aria-label` (e.g. "Click to select points on the image").
- **Keyboard coordinate selection (WCAG 2.2 SC 2.1.1):** When the image container gets keyboard focus:
  - A visible crosshair appears at the center of the image.
  - Arrow keys move the crosshair by 5% of the image per press, or 1% with Shift.
  - An ARIA live region announces the position as the crosshair moves (e.g. "Position: 50%, 50%.").
  - Enter or Space places a point at the crosshair and fires `qti-change`.
  - Moving focus away hides the crosshair; no point is placed without Enter or Space.
- **Point markers:** Each point marker is a `<button>` with an `aria-label` that includes the point number and coordinates (e.g. "Remove point 1 at coordinates 350, 200"). This satisfies SC 4.1.2.
- **Image alt text:** The image's text alternative comes from the QTI source: the `<object>` fallback text, `aria-label`/`aria-labelledby`, an inline SVG `<title>`/`<desc>`, or an `<img alt>`. Without one, the image is named by the localized fallback `interactions.selectPoint.imageFallback` ("Image for this question").
- **Result announcement:** Placing or removing a point is announced through the component's polite live region.
- **Touch target size:** Point markers are 32×32 CSS px by default, which is below WCAG 2.2 SC 2.5.8's 24×24 minimum. The correct-answer marker variant is 50×50. Both must meet 44×44 CSS px for full AA compliance on mobile.
- **Cursor feedback:** The image container uses `cursor: crosshair` to signal it is a coordinate-selection target. This is a usability hint, not an accessibility requirement.

### Performance

- Coordinate normalization (two multiplications and two divisions) on each click is negligible.
- SVG content is injected via `{@html}` into the DOM. Large or complex SVGs (e.g. detailed maps) may cause layout reflow. Item authors should ensure SVG viewBox dimensions are declared so the browser does not need to recompute layout after image load.

### Cross-platform

- Touch coordinates from `touchstart`/`touchend` events are not handled separately; the component relies on the browser's synthetic `click` event synthesized from touch, which uses `clientX`/`clientY`. This works on iOS and Android but may mis-fire on fast taps or scrolling gestures. Point placement should be confirmed by a stable tap (not a pan gesture).
- On mobile, the rendered image width is constrained by the viewport. Coordinate normalization using the authored intrinsic dimensions ensures scoring correctness regardless of the displayed size.
- The crosshair cursor style does not render on touch devices; the visual affordance for the interaction on mobile is solely the image itself.

### Security

- Inline SVG content extracted from the QTI XML is injected via `{@html}`. The item player's HTML sanitizer must sanitize SVG content before it reaches the component. The component does not sanitize SVG itself; it trusts `imageData.content` as pre-sanitized.
- External image URLs (`imageData.src`) are loaded by the browser; CSP policy at the delivery host controls which origins are permitted.

### i18n

Labels used by the component are sourced from the `i18n` provider under the `interactions.selectPoint.*` namespace. Keys include:

| Key | Default |
|-----|---------|
| `interactions.selectPoint.instructionAria` | "Click to select points on the image" |
| `interactions.selectPoint.canvas` | "Selection canvas" |
| `interactions.selectPoint.noImage` | "No image provided" |
| `interactions.selectPoint.pointsSelected` | "Points selected:" |
| `interactions.selectPoint.minimumMet` | "✓ Minimum met" |
| `interactions.selectPoint.selectAtLeast` | "Select at least {minChoices}" |
| `interactions.selectPoint.maxPointsReached` | "Maximum points reached. Remove a point to add a new one." |

The "Clear All" button and the "Maximum points reached" alert use hardcoded English strings in the current implementation and are not yet i18n-keyed.

---

## Design decisions

### Coordinate storage uses authored intrinsic dimensions, not `img.naturalWidth`

**Decision:** Use `parseInt(parsedInteraction.imageData.width)` and `parseInt(parsedInteraction.imageData.height)` as the reference dimensions for normalizing click coordinates.  
**Rationale:** The `width` and `height` attributes on the QTI `<object>` element are the dimensions in which the item author placed their `areaMapEntry` coordinates. If the item author declared `width="500"` and placed a circle at `(350,200,20)`, those coordinates are in a 500-unit-wide coordinate space. Using the authored dimensions ensures the normalization aligns with the scoring geometry, regardless of what size the image file actually is. Using `img.naturalWidth` would be correct only if the image file dimensions exactly matched the authored dimensions — not a safe assumption for all content sources.  
**Alternatives considered:** Use `img.naturalWidth` / `img.naturalHeight` from the DOM. Rejected: image load timing makes these unavailable synchronously, and they may differ from the QTI-authored coordinate space.  
**Consequences:** If the authored `width`/`height` does not match the image's actual pixel dimensions, scoring regions will be misaligned. Item authors are responsible for declaring correct dimensions in the QTI XML.

### Coordinate normalization formula

**Decision:** `x = Math.round((clickX / rect.width) * intrinsicWidth)`, where `clickX` is the click offset from `getBoundingClientRect().left`, `rect.width` is the rendered element width, and `intrinsicWidth` is the authored natural width.  
**Rationale:** This is the standard CSS-to-natural-coordinate mapping. `rect.width` is the actual rendered width at click time (accounts for CSS zoom, DPR-independent because `clientX` is in CSS pixels, and any container constraints). `intrinsicWidth` is the authored natural width. The division gives the fractional position (0..1), multiplied by the natural width gives the natural coordinate.  
**Alternatives considered:** Use `event.offsetX` instead of `event.clientX - rect.left`. Rejected: `offsetX` is relative to the event target, which may be a child element (e.g. a previously placed marker button) rather than the image container, causing incorrect offsets when clicking near a marker.  
**Consequences:** The click handler uses `event.clientX - rect.left` (and Y equivalent) unconditionally, which means it reads from `getBoundingClientRect()` on every click. This is a read-only DOM query with negligible cost.

### Point markers use percentage positioning, not pixel positioning

**Decision:** Render markers with `left: (x / naturalWidth * 100)%` and `top: (y / naturalHeight * 100)%` using CSS percentage within the image container.  
**Rationale:** Percentage positioning keeps markers at the correct visual location when the image is scaled by CSS. Pixel offsets would only be correct at 100% zoom. The image container uses `position: relative; display: inline-block` so the percentage is relative to the container's rendered size.  
**Consequences:** Marker positions are recomputed on every render but do not require event listeners for resize. If the container width changes (e.g. window resize), Svelte re-renders and the derived percentages are re-applied.

### The component reads only the QTI `"x y"` response form

**Decision:** The `response` prop accepts `"x y"` strings and arrays of them, the QTI point form, normalized to `Point[]` internally. Other values, such as `{ x, y }` objects, place no points.  
**Rationale:** The item player's state store holds canonical `"x y"` strings (per QTI spec), and nothing in the player produces another shape. The project is pre-1.0, so it keeps no earlier inbound format.  
**Alternatives considered:** Also accept `{ x, y }` objects. Rejected: no producer emits them, and a second inbound shape is non-spec surface with no user.  
**Consequences:** The `$effect` that syncs inbound `response` to `selectedPoints` must run on every render. It is idempotent and cheap, but it means the component does not treat `response` as write-once.

### Scoring regions are never rendered

**Decision:** `areaMapEntry` regions from the `responseDeclaration` are not passed to or rendered by the component under any role, including `scorer`.  
**Rationale:** The QTI spec explicitly states that `selectPointInteraction` presents "hidden hotspot" questions — the regions must not be disclosed. Rendering them in scorer role would reveal the scoring key to candidates viewing post-submission feedback, which violates assessment integrity. The `correctResponse` point(s) may be shown in scorer role (as a green marker), but the geometric tolerances (`areaMapping`) are not.  
**Alternatives considered:** Show scoring regions in scorer role for item review purposes. Rejected: the `scorer` role is defined by QTI to represent a human scorer or automated post-processing view, not a candidate-facing post-submission view. An item review tool (outside the player) may render regions for authoring/audit purposes.  
**Consequences:** The component receives `SelectPointInteractionData` which does not include `areaMapping` data — that data lives in the `ResponseDeclaration` within the item player's variable store, not in the interaction data model.

---

## Data model / contracts

### `SelectPointInteractionData` (from `@pie-qti/item-player`)

```typescript
interface SelectPointInteractionData extends BaseInteractionData {
  type: 'selectPointInteraction';
  responseId: string;       // from responseIdentifier attribute
  prompt: string | null;    // HTML content of <prompt> child, or null
  maxChoices: number;       // 0 = no restriction; absent: 0 (QTI 2.2/3.0, 1 for a single response), 1 (QTI 2.1)
  minChoices: number;       // must be >= 0; must be <= maxChoices
  imageData: ImageData | null;
}

interface ImageData {
  type: 'svg' | 'image';
  content?: string;   // present when type='svg'; full <svg>...</svg> HTML string
  src?: string;       // present when type='image'; URL of the image
  width: string;      // authored natural width in pixels, as string (e.g. "500")
  height: string;     // authored natural height in pixels, as string (e.g. "400")
}
```

**Invariants enforced by extractor:**
- `maxChoices >= 0` (error if negative; `0` means no restriction)
- `minChoices >= 0` (error if negative)
- `minChoices <= maxChoices` when `maxChoices > 0` (error if violated)
- `imageData` is never null for well-formed items (warning if absent)
- For `type='image'`: `src` is non-empty (error if absent)
- For `type='svg'`: `content` is non-empty (error if absent)

**Invariants that are NOT enforced (gaps):**
- The authored `width`/`height` values are not validated against the actual image file dimensions

### `Point` (from `@pie-qti/item-player`)

```typescript
interface Point {
  x: number;  // natural image x coordinate (left = 0)
  y: number;  // natural image y coordinate (top = 0)
}
```

This is the component's internal representation. The wire format (inbound `response` prop and outbound `qti-change` event value) uses `"x y"` strings for canonical QTI compatibility.

### `AreaMapping` and `AreaMapEntry` (from `@pie-qti/item-player`)

These live on `ResponseDeclaration.areaMapping`, not on `SelectPointInteractionData`. The component never receives or uses them directly.

```typescript
interface AreaMapping {
  defaultValue?: number;
  lowerBound?: number;
  upperBound?: number;
  entries: AreaMapEntry[];  // the same type in @pie-qti/qti-processing
}

interface AreaMapEntry {
  shape: 'circle' | 'rect' | 'poly' | 'ellipse' | 'default';
  coords: string;
  mappedValue: number;
}
```

---

## Acceptance criteria

### Functional

```
AC-1: Single point placement records normalized coordinate
  Given: an item with selectPointInteraction maxChoices=1 and a 500×400 image displayed at 250×200 (50% scale)
  When: the candidate clicks at rendered pixel (125, 100)
  Then: the recorded response is "250 200" (normalized to natural image space)
  Notes: 125/250 * 500 = 250; 100/200 * 400 = 200

AC-2: Point marker appears at correct visual location
  Given: the item from AC-1 after the click
  When: inspecting the marker's CSS position
  Then: marker left ≈ 50% (250/500 * 100), top = 50% (200/400 * 100)

AC-3: qti-change fires on point placement
  Given: any selectPointInteraction item
  When: the candidate clicks the image
  Then: a qti-change CustomEvent fires from the root element with responseIdentifier and value="x y"

AC-4: qti-change value is canonical "x y" string for single cardinality
  Given: a maxChoices=1 item
  When: the candidate places a point
  Then: the event value is a single "x y" string, not an array, not an object

AC-5: qti-change value is array of "x y" strings for multiple cardinality
  Given: a maxChoices=3 item
  When: the candidate places two points
  Then: the event value is an array of two "x y" strings

AC-6: Maximum selection enforcement
  Given: a maxChoices=2 item with 2 points already placed
  When: the candidate clicks a third location
  Then: no new point is placed; no qti-change fires; the "Maximum points reached" alert is visible

AC-7: Remove point by clicking marker
  Given: an item with one point placed at "350 200"
  When: the candidate clicks the marker
  Then: the marker disappears; qti-change fires with value=null (single) or [] (multiple)

AC-8: Clear All removes all points
  Given: an item with 2 points placed
  When: the candidate clicks "Clear All"
  Then: both markers disappear; qti-change fires with [] (or null for single cardinality)

AC-9: Scoring correct point with circle areaMapping
  Given: the sample item at /item-demo/select-point (circle coords="350,200,20", MATCH_CORRECT template or map_response_point)
  When: the candidate clicks at (350, 200) and submits
  Then: SCORE=1.0, MAXSCORE=1.0

AC-10: Scoring outside all mapped regions returns defaultValue
  Given: the sample item with defaultValue="0" and a single circle region
  When: the candidate clicks clearly outside the circle and submits
  Then: SCORE=0.0

AC-11: Scoring with inside operator (custom responseProcessing)
  Given: the sample item which uses <inside shape="circle" coords="350,200,20">
  When: the candidate clicks at (340, 195) (inside the circle, ≤20px radius) and submits
  Then: SCORE=1.0

AC-12: Scorer role shows correct answer marker
  Given: a selectPointInteraction item with correctResponse value="350 200" rendered with role="scorer"
  When: the item is displayed
  Then: a green checkmark marker appears at the visual position corresponding to (350, 200) on the image

AC-13: Scorer role does not show area mapping regions
  Given: the item from AC-12 with an areaMapping circle at (350,200,20)
  When: inspecting the rendered DOM
  Then: no element representing the areaMapping circle is present in the DOM

AC-14: disabled=true prevents all interaction
  Given: a selectPointInteraction rendered with disabled=true
  When: the candidate clicks the image
  Then: no point is placed; no qti-change fires; the cursor is default (not crosshair)

AC-15: minChoices badge reflects selection count
  Given: a maxChoices=3, minChoices=2 item with 1 point placed
  When: the candidate views the interaction
  Then: a warning badge shows "Select at least 2"; after placing a second point the badge shows "✓ Minimum met"

AC-16: Inbound response prop initializes markers
  Given: a maxChoices=2 item with response=["200 150", "400 300"] passed on mount
  When: the item renders
  Then: two markers appear at the correct visual positions; no qti-change fires on mount

AC-17: SVG image support
  Given: a selectPointInteraction with an inline SVG image (object type="image/svg+xml")
  When: the candidate clicks inside the SVG canvas area
  Then: a point is placed and a qti-change fires with the normalized coordinate

AC-18: Point on image border
  Given: a 500×400 image
  When: the candidate clicks at the top-left corner (rendered pixel 0,0)
  Then: the response records "0 0"; the marker is visible at position 0%,0%

AC-19: Multiple areaMapEntry shapes — first match wins
  Given: a responseDeclaration with areaMapping where a rect entry (mappedValue=0.5) and a circle entry (mappedValue=1.0) overlap
  When: the candidate places a point inside both regions
  Then: the score is determined by whichever areaMapEntry appears first in the XML (first match wins per QTI spec)

AC-20: Point coordinates are integers after normalization
  Given: an image rendered at non-integer scale
  When: the candidate clicks
  Then: the stored coordinates are integer values (Math.round applied)
```

### Accessibility

```
AC-A1: Image container is keyboard reachable
  Given: any selectPointInteraction item
  When: the user presses Tab
  Then: focus reaches the image container; a visible focus ring is shown; ARIA role="button" is present

AC-A2: Image container ARIA label describes the task
  Given: any selectPointInteraction item
  When: a screen reader focuses the image container
  Then: it announces something equivalent to "Click to select points on the image"

AC-A3: Background image has non-empty alt text
  Given: an item using an <img> background (not SVG)
  When: a screen reader encounters the image element
  Then: it announces the alt text (at minimum "Selection canvas")

AC-A4: Point marker ARIA label includes coordinate
  Given: a point placed at (350, 200) with index 1
  When: a screen reader focuses the point marker button
  Then: it announces "Remove point 1 at coordinates 350, 200"

AC-A5: Correct-answer marker is accessible-only announced
  Given: scorer role with a correct point at (350, 200)
  When: a screen reader encounters the correct-point marker
  Then: it announces "Correct answer point at coordinates 350, 200"

AC-A6: Touch target size for point markers
  Given: a selectPointInteraction with at least one point placed
  When: the rendered marker size is measured
  Then: the interactive area is at least 44×44 CSS px (WCAG 2.2 SC 2.5.8)
```

### Edge cases

```
AC-E1: No image renders placeholder without error
  Given: a selectPointInteraction item with no <object> or <img> child element
  When: the item renders
  Then: a "No image provided" placeholder is shown; clicking the placeholder does nothing; no JS error is thrown

AC-E2: An {x,y} response object places no points
  Given: a maxChoices=1 item with response={x:350, y:200} passed as the response prop
  When: the item renders
  Then: no marker appears and the points list is empty; qti-change is not fired on mount

AC-E3: maxChoices=1 with two points in inbound array — only first is shown
  Given: a maxChoices=1 item with response=["200 150", "400 300"] passed as the response prop
  When: the item renders
  Then: only the first point ("200 150") is reflected (or all are clamped — document which behaviour applies)
  Notes: This tests inbound data that violates the maxChoices constraint. The current implementation does not clamp — both points would show. Clarify expected behaviour.

AC-E4: areaMapping with lowerBound and upperBound
  Given: an areaMapping with lowerBound=0 and upperBound=2 and three area entries each worth 1 point
  When: the candidate places points scoring 1+1+1=3 total
  Then: SCORE is clamped to 2.0 (upperBound)

AC-E5: Item with no response processing still places point marker
  Given: a selectPointInteraction with no <responseProcessing> element
  When: the candidate places a point
  Then: the marker appears and qti-change fires; no error occurs on submission (no score is computed)

AC-E6: Point placed exactly on a shared areaMapEntry boundary
  Given: a circle areaMapEntry with coords="350,200,20"
  When: the candidate places a point exactly on the circumference (e.g. "370 200", distance=20)
  Then: the point is scored as inside (boundary is inclusive per the inCircle formula: dx²+dy² <= r²)
```

---

## Open questions

- [x] Should `maxChoices=0` be supported as "unlimited" (per QTI spec) rather than rejected as an error? (resolved) Yes: the extractor accepts 0 and the component treats it as unlimited.
- [ ] Should the component clamp an inbound `response` array that has more entries than `maxChoices` (AC-E3)? Currently it reflects all points without enforcing `maxChoices` on the inbound side.
- [x] What is the correct `alt` text strategy for the background image? (resolved) The extractor reads the author's text alternative (see Non-functional requirements); the localized fallback applies only when there is none.
- [x] Should keyboard coordinate selection (the crosshair mode) be implemented as part of this component or as a wrapper accessible component that the host platform provides? (resolved) It is part of the component; QTI defines no keyboard interaction for this interaction, so it is an accessibility extension.
- [x] Which `AreaMapping.entries` type is canonical? (resolved) `AreaMapEntry[]`, in both packages.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.3.2 selectPointInteraction
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md` §3 (map_response_point and inside operator)
- Spec gaps: `docs/SPEC-GAPS-PLAN.md`
- Component: `packages/default-components/src/plugins/select-point/SelectPointInteraction.svelte`
- Extractor: `packages/item-player/src/interactions/select-point/extractor.ts`
- Extractor tests: `packages/item-player/tests/extraction/extractors/selectPointExtractor.test.ts`
- Interaction types: `packages/item-player/src/interactions/shared/types.ts` — `SelectPointInteractionData`, `Point`
- Scoring evaluator: `packages/qti-processing/src/eval/evaluator.ts` — `expr.mapResponsePoint`, `expr.inside`
- Response variable types: `packages/item-player/src/types/index.ts` — `AreaMapping`, `AreaMapEntry`
- Sample item: `apps/demo/src/lib/sample-items.ts` — `SELECT_POINT_INTERACTION`
- Evals: `docs/evals/default-components/select-point/evals.yaml`
- Adjacent PRDs: [hotspot.md](hotspot.md) (visible scoring regions — contrast interaction), [choice.md](choice.md) (comparable maxChoices/minChoices pattern)
