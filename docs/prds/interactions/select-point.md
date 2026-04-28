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

**Why `maxChoices=0` is rejected rather than treated as unlimited**: The QTI spec defines `maxChoices=0` as meaning "no upper bound" (consistent with `choiceInteraction`). However, the extractor currently validates `maxChoices <= 0` as an error, and the component's `canSelectMore` derivation (`selectedPoints.length < maxChoices`) would immediately block all selections when `maxChoices=0` because `n < 0` is always false. This is a known spec divergence. In practice, K-12 assessments authored for this framework always provide an explicit `maxChoices ≥ 1`; the `maxChoices=0` unlimited case is not a common K-12 authoring pattern for point-selection. The gap is documented rather than fixed because fixing it requires coordinated changes to the extractor validator, the component, and test coverage. See [Known gaps](#known-gaps).

**Why the keyboard interaction is incomplete**: Keyboard-accessible coordinate selection on a free-form image is hard. The natural interaction is a mouse click or a touch tap. A fully accessible implementation would need a focus-managed crosshair that moves by arrow key in fixed steps, Tab/Enter to confirm, and a way to announce the current coordinate position via ARIA live region — none of which are currently implemented. The component is keyboard-reachable (the image container is `role="button"` with `tabindex=0`) but the `onkeydown` handler only prevents default for Enter and Space without placing any point. This is an accessibility gap. See [Non-functional requirements](#non-functional-requirements) for the required approach and [Known gaps](#known-gaps) for the backlog item.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place)  
**Spec section:** §3.3.2 selectPointInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `selectPointInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | Full | Extracted as `responseId`; bound to the response variable; included in `qti-change` event payload |
| `maxChoices` | Partial | Values `>= 1` are extracted and enforced. The component blocks additional selections once `selectedPoints.length === maxChoices`. **`maxChoices=0` (unlimited) is rejected by the validator as an error** — see Known gaps |
| `minChoices` | Full | Extracted and surfaced in the UI as a "select at least N" badge. Not enforced as a hard block at submission time (the response is accepted regardless); enforcement is a delivery-engine concern |

### Child elements

| Element | Support | Behaviour |
|---------|---------|-----------|
| `<prompt>` | Full | HTML content extracted and rendered above the image |
| `<object type="image/...">` | Full | External image loaded via `data` attribute as `src` |
| `<object type="image/svg+xml">` | Full | Inline SVG extracted and rendered via `{@html}` |
| `<img>` | Full | Fallback when `<object>` is absent; `src` extracted from `src` attribute |

### Response variable contract

- **baseType:** `point`
- **cardinality:** `single` when `maxChoices=1`; `multiple` when `maxChoices>1`
- **Wire format (single):** A single string `"x y"` — two integers separated by a space, where `x` and `y` are coordinates in natural image pixel space (origin top-left)
- **Wire format (multiple):** An array of `"x y"` strings
- **Null/empty:** `null` before any selection (single cardinality); `[]` before any selection (multiple cardinality)
- **Internal representation:** The component maintains `selectedPoints: Point[]` where `Point = { x: number; y: number }`. Conversion between internal `Point[]` and the `"x y"` string format happens at every click and every inbound `response` prop sync.

The component also accepts legacy inbound formats (`{ x, y }` object, or an array of `{ x, y }` objects) from the `response` prop for backwards compatibility. It always emits canonical `"x y"` strings outward.

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

- **`maxChoices=0` (unlimited) not supported:** The extractor validator rejects `maxChoices <= 0` as an error. The component's `canSelectMore` derivation would block all selections for `maxChoices=0`. The QTI spec allows `0` to mean "no upper bound." Not a common K-12 authoring pattern for this interaction type; deferred.
- **Keyboard coordinate selection not implemented:** The component is keyboard-reachable but does not support keyboard-driven point placement. See Non-functional requirements for the required design.
- **`AreaMapping.entries` type mismatch:** `@pie-qti/item-player` defines `AreaMapping.entries` as `Record<string, AreaMapEntry>` while `@pie-qti/qti-processing` expects `AreaMapEntry[]`. The evaluator iterates with `for...of`, which works on both arrays and record values, but the declared types diverge. Any code that reads `areaMapping.entries` as a Record (by key lookup) will not work correctly with the qti-processing runtime's array form. This should be unified to `AreaMapEntry[]` in both packages.
- **No PNP support:** PNP personal needs (G-09, G-13, G-14) are not implemented for this interaction. The main gap for selectPointInteraction is that no alternative input modality is provided for candidates who cannot use a pointer device.

---

## Functional requirements

- **FR-1:** When the candidate clicks or taps a location on the image, record the coordinate in natural image pixel space (normalized from rendered pixel coordinates using the authored `imageData.width` and `imageData.height` as the reference dimensions).
- **FR-2:** Display a circular marker at each selected point. The marker must be positioned using percentage offsets computed from natural coordinates (`x / naturalWidth * 100%`, `y / naturalHeight * 100%`) so the marker tracks the correct visual location regardless of rendered image size.
- **FR-3:** Each point marker must include a visible number label (1, 2, …) for multi-point interactions, and a remove button that deletes the corresponding point from the response.
- **FR-4:** Emit a `qti-change` CustomEvent from the root element after every point addition or removal. The event payload must contain `responseIdentifier` and `value`. For `maxChoices=1`, `value` is a single `"x y"` string or `null`. For `maxChoices>1`, `value` is an array of `"x y"` strings.
- **FR-5:** When `selectedPoints.length === maxChoices`, block further clicks (do not add new points) and display an alert informing the candidate that the maximum has been reached.
- **FR-6:** When `minChoices > 0`, display a badge indicating whether the minimum has been met. The badge must update reactively as points are added or removed.
- **FR-7:** Provide a "Clear All" button when at least one point is selected. Activating it removes all points and emits a `qti-change` event with `null` (single cardinality) or `[]` (multiple cardinality).
- **FR-8:** Accept an inbound `response` prop and initialize `selectedPoints` from it. Support `"x y"` string, `{ x, y }` object, and arrays of either form.
- **FR-9:** When `disabled=true`, the image container must be non-interactive (no clicks accepted, cursor must be `default`). Point markers must be disabled. Clear All must be disabled. No `qti-change` events may fire.
- **FR-10:** When `role='scorer'` and `correctResponse` is provided, display correct-answer markers (green, `✓` label) at the correct point positions on the image, overlaid on top of the candidate's markers. The scoring regions (`areaMapEntry` areas) must never be rendered visually.
- **FR-11:** Support both external raster images (via `<object data="...">` or `<img src="...">`) and inline SVG (via `<object type="image/svg+xml">`).
- **FR-12:** When `imageData` is null or absent, render a placeholder and do not attempt any coordinate computation.

---

## Non-functional requirements

### Accessibility

`selectPointInteraction` is the most accessibility-challenging standard QTI interaction because free-form coordinate selection has no natural keyboard equivalent. The following requirements define what "accessible" means for this interaction:

- **Pointer operation (minimum):** The image container must be reachable by keyboard (Tab to focus, visible focus ring). At minimum, the focused container must announce its purpose via `aria-label` (e.g. "Click to select points on the image").
- **Keyboard coordinate selection (required for full compliance):** When the image container has keyboard focus, pressing Enter or Space must open (or toggle) a keyboard navigation mode where:
  - A visible crosshair cursor appears at the center of the image.
  - Arrow keys move the crosshair in configurable pixel steps (default 10px in natural coordinates).
  - An ARIA live region announces the current coordinate as the crosshair moves (e.g. "Position: 350, 200").
  - Pressing Enter or Space places a point at the current crosshair position and fires `qti-change`.
  - Pressing Escape exits keyboard navigation mode without placing a point.
  - This keyboard mode is currently not implemented; it is required for WCAG 2.2 SC 2.1.1 compliance.
- **Point markers:** Each point marker is a `<button>` with an `aria-label` that includes the point number and coordinates (e.g. "Remove point 1 at coordinates 350, 200"). This satisfies SC 4.1.2.
- **Image alt text:** The `<img>` rendered for the background image uses `alt` text from the i18n key `interactions.selectPoint.canvas` (default: "Selection canvas"). Item authors should provide a more descriptive `alt` attribute via the `<object>` element's `alt` attribute when the image carries meaningful content. The extractor does not currently extract a custom `alt` text.
- **Result announcement:** After placing or removing a point, the response state should be announced via an ARIA live region so screen-reader users know their action was recorded. Currently there is no live region in the component; this should be added alongside the keyboard navigation mode.
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

### The component accepts multiple inbound `response` formats

**Decision:** The `response` prop is typed as `any` and accepts `"x y"` strings, `{ x, y }` objects, and arrays of either form. All are normalized to `Point[]` internally.  
**Rationale:** Different integration layers pass different shapes. The item player's state store uses canonical `"x y"` strings (per QTI spec). Some vendor integrations may pass `{ x, y }` objects for convenience. Handling all forms in the component reduces adapter code in callers.  
**Alternatives considered:** Restrict to canonical `"x y"` format only. Rejected: would break existing integrations without a migration path.  
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
  maxChoices: number;       // must be >= 1; 0 is rejected by extractor validator
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
- `maxChoices >= 1` (error if `<= 0`)
- `minChoices >= 0` (error if negative)
- `minChoices <= maxChoices` (error if violated)
- `imageData` is never null for well-formed items (warning if absent)
- For `type='image'`: `src` is non-empty (error if absent)
- For `type='svg'`: `content` is non-empty (error if absent)

**Invariants that are NOT enforced (gaps):**
- The authored `width`/`height` values are not validated against the actual image file dimensions
- `maxChoices=0` is rejected rather than treated as unlimited per the QTI spec

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
  entries: Record<string, AreaMapEntry>;  // Note: qti-processing uses AreaMapEntry[] — see Known gaps
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

AC-E2: Legacy {x,y} response object is accepted
  Given: a maxChoices=1 item with response={x:350, y:200} passed as the response prop
  When: the item renders
  Then: one marker appears at (350,200) in natural coordinates; qti-change is not fired on mount

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

- [ ] Should `maxChoices=0` be supported as "unlimited" (per QTI spec) rather than rejected as an error? This requires changes to the extractor validator and the `canSelectMore` derivation.
- [ ] Should the component clamp an inbound `response` array that has more entries than `maxChoices` (AC-E3)? Currently it reflects all points without enforcing `maxChoices` on the inbound side.
- [ ] What is the correct `alt` text strategy for the background image? The extractor does not extract an `alt` attribute from `<object>` elements. Item authors currently rely on the generic "Selection canvas" default. Should the extractor propagate a custom `alt` attribute from the QTI source?
- [ ] Should keyboard coordinate selection (the crosshair mode) be implemented as part of this component or as a wrapper accessible component that the host platform provides? The QTI spec does not define keyboard interaction for this interaction type; it is an accessibility extension.
- [ ] The `AreaMapping.entries` type is `Record<string, AreaMapEntry>` in `@pie-qti/item-player` and `AreaMapEntry[]` in `@pie-qti/qti-processing`. Which should be the canonical type? The array form is simpler and maps directly to the XML structure (ordered entries, no natural key). Recommend unifying to `AreaMapEntry[]`.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.3.2 selectPointInteraction
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md` §3 (map_response_point and inside operator)
- Spec gaps: `docs/SPEC-GAPS-PLAN.md`
- Component: `packages/default-components/src/plugins/select-point/SelectPointInteraction.svelte`
- Extractor: `packages/item-player/src/extraction/extractors/selectPointExtractor.ts`
- Extractor tests: `packages/item-player/tests/extraction/extractors/selectPointExtractor.test.ts`
- Interaction types: `packages/item-player/src/types/interactions.ts` — `SelectPointInteractionData`, `Point`
- Scoring evaluator: `packages/qti-processing/src/eval/evaluator.ts` — `expr.mapResponsePoint`, `expr.inside`
- Response variable types: `packages/item-player/src/types/index.ts` — `AreaMapping`, `AreaMapEntry`
- Sample item: `apps/demo/src/lib/sample-items.ts` — `SELECT_POINT_INTERACTION`
- Evals: `docs/evals/default-components/select-point/evals.yaml`
- Adjacent PRDs: [hotspot.md](hotspot.md) (visible scoring regions — contrast interaction), [choice.md](choice.md) (comparable maxChoices/minChoices pattern)
