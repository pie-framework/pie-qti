# PRD: hotspotInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: hotspotInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`hotspotInteraction` presents a background image with one or more defined clickable regions (`hotspotChoice` elements). The candidate selects regions by clicking or tapping them. The response is an `identifier` (single cardinality) or a set of `identifier` values (multiple cardinality), where each identifier names the chosen `hotspotChoice`. The interaction is used in K-12 assessments to test spatial reasoning — identifying countries on a map, labelling anatomy diagrams, or locating features in a photograph.

The component (`pie-qti-hotspot`) renders the image and overlays a scalable SVG layer whose `viewBox` matches the image's natural dimensions. Hotspot regions are SVG shapes (`<circle>`, `<rect>`, `<polygon>`) at native coordinates; the SVG scales with the container so coordinates remain valid at any rendered size. Clicking a shape fires a `qti-change` event.

---

## Background and rationale

### The coordinate system problem

Every `hotspotChoice` defines its region using pixel coordinates within the **natural (authoring-time) dimensions** of the image — the pixel dimensions that were known when the item was authored. These coordinates do not change when the image is displayed at a smaller or larger size in the browser. The delivery engine is therefore responsible for scaling the coordinate space to match the rendered image size.

This is a harder problem than it looks. A naive approach — placing absolutely-positioned `<div>` or `<area>` elements at the authored pixel positions — only works if the rendered image is exactly the same size as the natural image. On mobile, in responsive layouts, or when the item is embedded in a narrow container, the image is typically scaled down, and the hit regions must shrink proportionally.

The implementation solves this by rendering all hotspot shapes inside an SVG overlay whose `viewBox` is set to `"0 0 <naturalWidth> <naturalHeight>"` and which is positioned absolutely over the image (`position: absolute; inset: 0; width: 100%; height: 100%`). The SVG rendering engine scales the coordinate space of the `viewBox` to fit the SVG's actual rendered size automatically. A `<circle cx="100" cy="100" r="20">` at natural coordinates will appear in the same relative position regardless of how wide the container is. No JavaScript coordinate math is required.

The image is constrained with `width: 100%; max-width: <naturalWidth>px` and an `aspect-ratio` derived from the natural dimensions. This keeps the image from growing beyond its authored size (which would make hotspot regions too small relative to the image content) and from changing its aspect ratio (which would distort the regions).

### Accessibility challenge: graphical interactions and screen readers

A hotspot on a map image is visually self-evident — the candidate sees the map, reads the question, and clicks a region. For a blind user or a user navigating by keyboard, none of that is available. Two separate problems must be solved:

1. **Keyboard reachability.** SVG elements are not natively focusable. The component makes each shape focusable by setting `tabindex=0` (or `-1` when `disabled`) and handling `keydown` for Enter and Space. This matches the `role="button"` semantic declared on each shape. The tab order follows DOM order, which is the order of `hotspotChoice` elements in the QTI XML.

2. **Accessible name.** A screen reader reaching a shape with `role="button"` will read its accessible name. Without an explicit name, the name would be empty or derived from SVG content (which is none). The component generates `aria-label="Select hotspot {identifier}"` (with `". Correct answer"` appended in scorer role when the choice is correct). This is a fallback. The QTI spec provides `hotspotLabel` on `hotspotChoice` specifically to supply a meaningful human-readable name (e.g. "Glasgow" instead of "A"). The extractor reads `hotspotLabel` and includes it in the extracted data; the component should use it as the `aria-label` when present — **this is not yet wired up** (see Known gaps).

3. **Image alt text.** The background image itself needs an accessible description. The QTI spec does not mandate alt text on the `<object>` element, but WCAG 2.2 SC 1.1.1 does. The component supplies a fallback alt of `"Hotspot interaction"` when no i18n key is configured. Item authors should be instructed to use the `<object>` element's text content as the alt description, or to provide it via the i18n system.

### Touch target sizing

WCAG 2.2 SC 2.5.8 (Target Size Minimum) requires interactive targets to be at least 24×24 CSS px. WCAG 2.5.5 (Target Size Enhanced, Level AAA) recommends 44×44 CSS px. For K-12 assessments on touch devices, 44×44 is the practical minimum because younger students have less precise motor control.

Because hotspot regions are in natural-image coordinate space, a region that is 44×44 px at the authored image size shrinks proportionally when the image is displayed at, say, 50% of natural width. A 44-px region becomes 22-px, falling below threshold. Item authors and QTI tools must therefore ensure regions are large enough at the **minimum expected rendered size**. This PRD specifies a minimum natural-coordinate size of 44×44 (for rect/circle-bounding-box) but cannot enforce it at runtime — the component does not know the rendered device size. The extractor's validator checks that shape areas are non-degenerate (non-zero coords), which is a necessary but not sufficient check.

### Why SVG rather than `<area>` / `<map>`

HTML `<map>` and `<area>` elements provide native image-map semantics and were the standard approach in QTI 2.1 era players. SVG overlay was chosen instead for three reasons:

1. **Responsive scaling.** `<area>` coords are pixel-absolute. They require JavaScript to be recalculated when the image resizes, and browsers do not consistently scale image maps. SVG `viewBox` scaling is automatic and CSS-driven.
2. **Visual feedback.** SVG shapes can receive CSS fill, stroke, and transition styling. An `<area>` element has no visible rendering and cannot show selection state without additional DOM elements.
3. **ARIA support.** SVG elements accept `role`, `aria-label`, `aria-pressed`, and `tabindex`, making them suitable interactive elements when attributed correctly.

The trade-off is that inline SVG in a shadow root has some quirks with Tailwind utility classes and hover pseudo-classes. The component includes fallback native CSS for hover state in the `<style>` block alongside the Tailwind utilities.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 element name mapping (`qti-hotspot-interaction`) is handled by the name-mapping layer but not tested  
**Spec section:** §3.3.1 hotspotInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `hotspotInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used in `qti-change` event payload |
| `maxChoices` | ✅ Extracted | Defaults to `1` when absent. **Currently only single-select (string response) is implemented in the UI**; `maxChoices > 1` is extracted but the component does not support multi-selection. See Known gaps. |
| `minChoices` | ✅ Extracted | Defaults to `0` when absent; included in `HotspotData` when non-zero. Not enforced at response-submission time. |

### Supported attributes on `hotspotChoice`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required; deduplicated; used as response value |
| `shape` | ✅ Full | `circle`, `rect`, `poly` rendered as SVG shapes. `ellipse` is in the type union but has no rendering branch; falls through without rendering. `default` is reserved for full-image fallback and also not rendered. |
| `coords` | ✅ Partial | See coordinate format notes below. `rect` format has a spec divergence. |
| `hotspotLabel` | ✅ Extracted | Extracted into `HotspotData.hotspotChoices[*].hotspotLabel`; **not yet used as `aria-label` in the component.** Falls back to `"Select hotspot {identifier}"`. |
| `fixed` | ❌ Not extracted | Spec: in interactions with shuffling, `fixed=true` choices keep their position. `hotspotInteraction` does not implement shuffle, so this attribute has no effect. Not extracted. |

### Image element

The spec uses `<object>` to embed the background image (with `type`, `data`, `width`, `height` attributes). The extractor reads `<object>` children and extracts either an image URL (`src`) or inline SVG content. The `width` and `height` attributes on `<object>` provide the natural dimensions used to set the SVG `viewBox`. If dimensions are absent or non-numeric, the `viewBox` falls back to `800 600` and the overlay may misalign.

### Shape coordinate formats

The spec defines the following formats (all coordinates are in natural image pixel units):

| Shape | Spec format | Notes |
|-------|-------------|-------|
| `circle` | `centerX,centerY,radius` | Renders as SVG `<circle cx cy r>`. Correctly implemented. |
| `rect` | `left,top,right,bottom` (two corners) | **The component incorrectly interprets these as `x,y,width,height`**. See Known gaps — G-RECT. |
| `poly` | `x1,y1,x2,y2,...,xn,yn` (vertex pairs) | Renders as SVG `<polygon points="...">`. Correctly implemented. Closing-point repeat is handled by the to-pie transformer but not in the component (the SVG polygon element closes automatically). |
| `ellipse` | `centerX,centerY,radiusX,radiusY` | No rendering branch in the component. Shape type is in the TypeScript union but silently skipped. |

### Response variable contract

- **baseType:** `identifier`
- **cardinality:** `single` when `maxChoices=1`; `multiple` when `maxChoices>1` or `maxChoices=0` (unlimited)
- **Value format (single):** a string matching one `hotspotChoice` identifier
- **Value format (multiple):** an array of identifier strings (spec) — **not yet implemented in the component**; the component always produces a single string

### Standard response processing templates

- **MATCH_CORRECT** — correct when `RESPONSE` equals the single `correctResponse` identifier. Standard for `maxChoices=1` items.
- **MAP_RESPONSE** — partial credit via `mapping` on the `responseDeclaration`. Each identifier maps to a point value. Used for items where some hotspots earn more points than others (e.g. a partially-correct planet in an astronomy item).
- `map_response_point` (area mapping) applies to `selectPointInteraction`, not `hotspotInteraction`.

### Known gaps

- **G-RECT: `rect` coordinate format divergence.** The QTI spec defines `rect` coords as `left,top,right,bottom` (two corners). The component's SVG `<rect>` expects `x,y,width,height`. The code comment in the component says "coords are x, y, width, height" — this is incorrect per spec. Items authored per spec with `rect` coords will render visually wrong (the rect will be at the correct top-left origin but with `width=right` and `height=bottom` instead of `width=right-left` and `height=bottom-top`). Items authored against the broken interpretation will work correctly but are non-portable. **This is a rendering bug that must be fixed.** To fix: in the `rect` branch, compute `width = coords[2] - coords[0]` and `height = coords[3] - coords[1]`. Also note: the to-pie transformer (`packages/to-pie/src/transformers/hotspot.ts`) correctly interprets `rect` as `x1,y1,x2,y2` and computes width/height — so the transformer is correct but the native QTI player component is wrong.
- **Multi-select not implemented.** When `maxChoices > 1`, the spec requires a `multiple`-cardinality response (array of identifiers). The component stores `response` as a single string and `handleClick` replaces it unconditionally. An item with `maxChoices=2` will behave identically to `maxChoices=1`.
- **`ellipse` shape not rendered.** The `ellipse` shape type is in the TypeScript union (from the extractor) but the component has no rendering branch for it. Hotspot choices with `shape="ellipse"` are silently skipped; the candidate cannot see or select them.
- **`hotspotLabel` not used as `aria-label`.** The extractor reads `hotspotLabel` and includes it in `HotspotData`. The component does not read it when composing `aria-label`; all hotspots get the generic `"Select hotspot {identifier}"` label.
- **Image alt text not author-configurable.** The `<object>` element's text content (which QTI uses as the fallback alt text) is not extracted as image alt text. The component uses a static i18n key fallback.
- **`minChoices` not enforced at submission time.** Extracted and present in `HotspotData` but not checked against the number of selected hotspots before submission.

---

## Functional requirements

- **FR-1:** Render the background image (raster or SVG) filling the full available container width, constrained to the image's natural width, preserving aspect ratio.
- **FR-2:** Overlay an SVG element positioned absolutely over the image, with `viewBox` set to `"0 0 {naturalWidth} {naturalHeight}"`, covering the image exactly.
- **FR-3:** For each `hotspotChoice` with `shape="circle"`, render an SVG `<circle>` at the extracted `cx,cy,r` coordinates within the overlay.
- **FR-4:** For each `hotspotChoice` with `shape="rect"`, render an SVG `<rect>` using `x=left, y=top, width=right-left, height=bottom-top` (QTI spec `left,top,right,bottom` format).
- **FR-5:** For each `hotspotChoice` with `shape="poly"`, render an SVG `<polygon>` whose `points` attribute is constructed from alternating x,y coordinate pairs.
- **FR-6:** Unselected hotspot regions must have a transparent (or near-transparent) fill so the image beneath is visible. A hover state provides visual affordance that the region is clickable.
- **FR-7:** When a hotspot is selected, its fill and stroke change to a visually distinct selected state (blue fill/stroke by default). The change must apply immediately on click/tap/Enter/Space without a page reload.
- **FR-8:** Clicking or tapping a selected hotspot (when `maxChoices=1`) replaces the current selection — it does not deselect. There is no deselect gesture for single-select.
- **FR-9:** On each selection change, emit a `qti-change` CustomEvent from the root element with `{ responseIdentifier, value }`. The event must bubble and be `composed: true` so it crosses the shadow DOM boundary.
- **FR-10:** Accept a `response` prop reflecting the current response state. On initial mount with a pre-set `response`, the corresponding hotspot(s) must render in selected state without emitting a `qti-change` event.
- **FR-11:** When `disabled=true`, all hotspot shapes must be non-interactive (no click/keydown handling, `tabindex=-1`). The `disabled` state must be visually distinguishable (e.g. `cursor: not-allowed` on the overlay, reduced opacity).
- **FR-12:** When `role='scorer'` and `correctResponse` is provided, highlight correct hotspot(s) with a distinct visual treatment (green fill/stroke). Correct answers must not be revealed to the `candidate` role.
- **FR-13:** Render the `prompt` HTML content above the image/overlay when present.
- **FR-14:** When `parsedInteraction` is null or undefined, render an error state rather than a blank or broken layout.

---

## Non-functional requirements

### Accessibility

- **WCAG 2.2 SC 1.1.1 (Non-text content):** The background image must have a meaningful `alt` attribute. When the i18n key `interactions.hotspot.altText` is not configured, fall back to a descriptive string (not `""`). When `imageData.type === 'svg'`, the inline SVG must have a `<title>` element or `aria-label` on the `<svg>` container.
- **WCAG 2.2 SC 1.3.1 (Info and relationships):** Each hotspot region must have `role="button"` and `aria-label` conveying the region's identity. When `hotspotLabel` is provided on the `hotspotChoice`, use it verbatim as the `aria-label`. Fall back to a translated "Select region {identifier}" string.
- **WCAG 2.2 SC 1.4.3 (Contrast):** Selected and hover fill colours must provide sufficient contrast against the image content. The current blue (`rgba(59,130,246,0.3)`) may be insufficient over light-coloured images. Hosts may override via `::part(overlay)` and `::part(image)`. Consider a stroke-only visual indicator as an alternative.
- **WCAG 2.2 SC 2.1.1 (Keyboard):** All hotspot regions must be reachable and operable by keyboard. Tab moves focus sequentially through regions. Enter and Space activate the focused region (same behaviour as click). Focus must be visible on each SVG shape — SVG elements need an explicit `:focus` CSS outline since the browser default focus ring may not appear on SVG shapes in all browsers.
- **WCAG 2.2 SC 2.4.7 (Focus visible):** The focus indicator on each hotspot shape must be visible. Implement via `outline` on `.qti-hotspot-shape:focus`.
- **WCAG 2.2 SC 2.5.3 (Label in name):** The `aria-label` on each button must describe the region; for scorer role, append ". Correct answer" or similar translated suffix when the choice is correct.
- **WCAG 2.2 SC 2.5.8 (Target size minimum):** In rendered CSS pixels, each hotspot must have a minimum bounding box of 44×44 CSS px. This cannot be enforced at runtime (it depends on rendered size), but the extractor should warn when a hotspot's natural-coordinate bounding box is smaller than 44×44 (assuming full natural-size rendering).
- **WCAG 2.2 SC 4.1.2 (Name, role, value):** `aria-pressed="true"/"false"` communicates selected state for each button-role shape.

### Performance

- Extraction and first render must complete within 16 ms for up to 20 hotspot regions on a mid-range mobile device (2019 equivalent). SVG is rendered declaratively by the browser; there is no JavaScript hit-testing.
- The overlay SVG must not block pointer events on image text/content in unoccupied areas (`pointer-events` must be set to `none` on the SVG and `all` on the individual shapes, or vice versa to avoid blocking image text selection in adjacent elements).

### Cross-platform

- Touch events (tap) must register the same as mouse click events. SVG `onclick` handles this natively in current browsers. Verify on iOS Safari (which has historically had SVG touch-event quirks).
- On narrow viewports (320 px minimum), the image must scale down without overflow. Hotspot shapes scale automatically with the SVG `viewBox`.
- Landscape and portrait orientations must both work; the aspect-ratio constraint ensures the image does not distort.

### Security

- The `prompt` field is rendered via `{@html}` and must be sanitized upstream by the item player's HTML sanitizer before reaching the component.
- When `imageData.type === 'svg'`, the SVG content is rendered via `{@html}`. Inline SVG can contain `<script>` and event handlers. The item player's sanitizer must strip `<script>`, `on*` event attributes, and `javascript:` hrefs from SVG content before it reaches this component. The component trusts the `imageData.content` value as safe.

### i18n

- `interactions.hotspot.altText` — alt text for the background image when not SVG.
- `interactions.hotspot.selected` — prefix label before the selected identifier in the info panel.
- Hotspot accessible names should use a translated pattern like `interactions.hotspot.regionLabel` with `{identifier}` interpolation, falling back to `"Select hotspot {identifier}"`.

---

## Design decisions

### SVG overlay with `viewBox` instead of CSS `transform` or JavaScript coordinate mapping

**Decision:** Use a single SVG element with `viewBox="0 0 {naturalWidth} {naturalHeight}"` as the hitzone overlay, absolutely positioned over the image.  
**Rationale:** The `viewBox` attribute delegates coordinate scaling entirely to the browser's SVG rendering engine. Adding or removing a hotspot shape requires only a `<circle>`, `<rect>`, or `<polygon>` element at natural coordinates; no JavaScript recalculates positions on resize. The alternative — placing DOM elements at fractional-percentage positions or recalculating in a `ResizeObserver` — requires runtime math and introduces a dependency on the image's actual rendered size, which may not be available synchronously.  
**Alternatives considered:** (1) HTML `<map>/<area>` with JavaScript position recalculation; rejected because `<area>` does not support visual feedback or ARIA attributes adequately. (2) Percentage-positioned `<div>` elements; rejected because div coordinates are percentages of the container, not the image, and the image may not fill the full container width.  
**Consequences:** The SVG must be kept in perfect positional and dimensional sync with the image. If the image fails to load (broken URL, CORS) and the browser renders a broken-image icon at a different size, the SVG overlay will not align. The component renders the SVG regardless of image load state.

### Single-file response value (string, not array), even when `maxChoices=1`

**Decision:** The component currently stores `response` as a single `identifier` string, matching the `single` cardinality case.  
**Rationale:** The initial implementation targeted the most common use case (`maxChoices=1`). The response variable contract for `single` cardinality is a bare string, not a one-element array, so this is spec-correct for that case. Multi-select support (`multiple` cardinality, array response) is a gap, not an intentional permanent decision.  
**Consequences:** `maxChoices > 1` items silently behave as single-select. Item authors writing multi-select hotspot items will receive incorrect responses. This gap should be resolved before shipping multi-select hotspot content. See Known gaps.

### Colors are hardcoded (not theme tokens)

**Decision:** Selected state uses `rgba(59,130,246,0.3)` (blue) and correct state uses `rgba(34,197,94,0.3)` (green). These are Tailwind 500 values.  
**Rationale:** SVG `fill` and `stroke` attributes cannot receive CSS custom properties in the same way HTML elements can. While CSS custom properties can be used in SVG `fill` via `var()`, this requires explicit CSS declaration on the SVG or its ancestors. The current approach is explicit and predictable. The `::part(overlay)` CSS shadow-part exposes the SVG to host-page styling for intentional overrides.  
**Alternatives considered:** CSS custom properties on `:host` for theming; requires host to declare the variables and increases API surface. Not implemented in this version.  
**Consequences:** Items displayed in high-contrast mode (e.g. Windows High Contrast Mode) will not automatically adapt. Hosts requiring accessible colour overrides must use `::part(overlay)` or inject styles that override fill/stroke on `.qti-hotspot-shape` — but shadow DOM prevents direct CSS targeting unless `::part()` is used.

### Props accept both parsed objects and JSON strings

**Decision:** `interaction`, `response`, `correctResponse`, and `i18n` are each parsed with `parseJsonProp` before use.  
**Rationale:** Identical to the pattern in `choiceInteraction` and all other default components. When used as a native web component, all prop values arrive as attribute strings. When used as a Svelte component inside the item player, they arrive as typed objects. `parseJsonProp` handles both.  
**Consequences:** Small runtime JSON.parse overhead on each reactive update. Negligible for typical hotspot item sizes.

---

## Data model / contracts

### `HotspotInteractionData` (from `@pie-qti/item-player`)

```typescript
// packages/item-player/src/interactions/shared/types.ts

interface HotspotChoice {
  identifier: string;
  shape: 'circle' | 'rect' | 'poly' | 'ellipse' | 'default';
  coords: string;    // raw comma-separated string from QTI XML
  hotspotLabel?: string;
  classes?: string[];
}

interface HotspotInteractionData extends BaseInteractionData {
  type: 'hotspotInteraction';
  responseId: string;            // from responseIdentifier attribute
  maxChoices: number;            // 1 = single; >1 or 0 = multiple (unlimited)
  minChoices?: number;           // included only when > 0
  prompt: string | null;
  imageData: ImageData | null;
  hotspotChoices: HotspotChoice[];
}

interface ImageData {
  type: 'image' | 'svg';
  src?: string;       // for type='image': URL of raster image
  content?: string;   // for type='svg': full <svg>...</svg> markup
  width?: string;     // natural width in px (string from XML attribute)
  height?: string;    // natural height in px (string from XML attribute)
}
```

**Invariants enforced by extractor:**
- `hotspotChoices` has at least one entry (error if zero)
- All `identifier` values are non-empty and unique (error on duplicate)
- `maxChoices >= 0` (error if negative)
- `minChoices <= maxChoices` when `maxChoices > 0` (error if violated)
- `imageData` is present and has either `src` (image) or `content` (SVG) (error if missing)

**Invariants NOT enforced (gaps):**
- Coord format correctness per shape type is not validated
- Minimum hotspot bounding-box size (44×44 natural px) is not checked
- `ellipse` shape is accepted without warning despite having no rendering support

### Component props (`pie-qti-hotspot`)

| Prop | Type | Direction | Notes |
|------|------|-----------|-------|
| `interaction` | `HotspotInteractionData \| string` | in | Parsed with `parseJsonProp` |
| `response` | `string \| null` | in/out (`$bindable`) | Current selected identifier (single-select only) |
| `correctResponse` | `string \| string[] \| null` | in | Correct identifier(s); only shown in `scorer` role |
| `disabled` | `boolean` | in | Default `false` |
| `role` | `string` | in | `'candidate'` (default) or `'scorer'` |
| `i18n` | `I18nProvider` | in | Optional; falls back to English strings |
| `onChange` | `(value: string) => void` | in | Callback for Svelte usage (web component uses `qti-change` event) |

### `qti-change` event payload

```typescript
{
  type: 'qti-change',
  bubbles: true,
  composed: true,
  detail: {
    responseIdentifier: string,   // matches HotspotInteractionData.responseId
    value: string                 // selected hotspotChoice identifier
  }
}
```

---

## Acceptance criteria

### Functional

```
AC-1: Single-select hotspot renders image with overlaid shapes
  Given: an item at /item-demo/hotspot (UK airports map, 4 circle hotspots, maxChoices=1)
  When: the item renders
  Then: the background map image is visible; four clickable circles are overlaid on the image
        at the correct proportional positions; no shapes overflow the image boundary

AC-2: Clicking a hotspot selects it and fires qti-change
  Given: the item from AC-1 with no pre-selected response
  When: the candidate clicks the hotspot with identifier "A"
  Then: the circle for "A" shows blue fill/stroke (selected state); a qti-change event fires
        with value="A" and responseIdentifier="RESPONSE"

AC-3: Clicking a different hotspot changes the selection (single-select)
  Given: the item from AC-1 with "A" already selected
  When: the candidate clicks hotspot "B"
  Then: "B" shows selected state; "A" returns to unselected state; qti-change fires with value="B"

AC-4: Correct answer scores 1.0 with MATCH_CORRECT
  Given: the item from AC-1 with correct answer "A" (MATCH_CORRECT template)
  When: the candidate selects "A" and submits
  Then: SCORE=1.0, MAXSCORE=1.0

AC-5: Wrong answer scores 0.0
  Given: the item from AC-1
  When: the candidate selects "B" and submits
  Then: SCORE=0.0, MAXSCORE=1.0

AC-6: Partial credit with MAP_RESPONSE
  Given: the partial-credit hotspot item at /item-demo/hotspot-partial-credit
        (VENUS hotspot has mappedValue=0.7)
  When: the candidate selects "VENUS" and submits
  Then: SCORE=0.7, MAXSCORE=1.0

AC-7: Hotspot shapes scale with container width
  Given: the item from AC-1 in a 400px-wide container
  When: the container width is changed to 200px (simulating mobile or embedded view)
  Then: the image scales to 200px wide; the hotspot circles scale proportionally and remain
        centred on the correct map features; click/tap on a circle still registers the correct identifier

AC-8: SVG viewBox matches natural image dimensions
  Given: the item from AC-1 (image natural size: 206×280px)
  When: the item renders
  Then: the overlay SVG has viewBox="0 0 206 280"

AC-9: Pre-set response reflects on mount
  Given: the item from AC-1 with response="A" passed on mount
  When: the item renders
  Then: hotspot "A" appears in selected state; no qti-change event fires during initial render

AC-10: disabled=true prevents selection
  Given: the item from AC-1 with disabled=true
  When: the candidate clicks any hotspot
  Then: no hotspot enters selected state; no qti-change event fires; cursor is not-allowed over the overlay

AC-11: Scorer role shows correct answer highlights
  Given: the item from AC-1 rendered with role="scorer" and correctResponse="A"
  When: the item renders
  Then: hotspot "A" shows green fill/stroke; other hotspots show no correctness indication

AC-12: Candidate role does not reveal correct answer
  Given: the item from AC-1 rendered with role="candidate" and correctResponse="A"
  When: the item renders
  Then: no hotspot shows green highlight; all unselected hotspots look identical

AC-13: Prompt renders above image
  Given: the item from AC-1 which has prompt "Which one is Glasgow?"
  When: the item renders
  Then: the prompt text appears above the image, not overlapping it

AC-14: No interaction data renders error state
  Given: the component rendered with interaction=null
  When: the component renders
  Then: an error message is visible (not a blank or broken layout); no JavaScript exception is thrown

AC-15: rect shape renders at correct position (spec coords: left,top,right,bottom)
  Given: an item with a hotspotChoice shape="rect" coords="50,50,150,100"
  When: the item renders
  Then: the SVG <rect> has x=50, y=50, width=100 (150-50), height=50 (100-50)
  Notes: if coords are interpreted as x,y,width,height, width would be 150 and height 100 — this
         is the existing bug; this AC verifies the fix is applied

AC-16: circle shape renders at correct position
  Given: an item with hotspotChoice shape="circle" coords="77,115,8"
  When: the item renders
  Then: the SVG <circle> has cx=77, cy=115, r=8

AC-17: poly shape renders at correct position
  Given: an item with hotspotChoice shape="poly" coords="150,120,180,100,200,130,170,160"
  When: the item renders
  Then: the SVG <polygon> has points="150,120 180,100 200,130 170,160"
```

### Accessibility

```
AC-A1: Hotspot regions are keyboard-focusable
  Given: the item from AC-1 rendered without disabled
  When: the candidate presses Tab until focus enters the interaction
  Then: the first hotspot shape receives a visible focus ring; subsequent Tab presses move
        focus to each remaining hotspot in DOM order

AC-A2: Enter activates a focused hotspot
  Given: the item from AC-1 with keyboard focus on hotspot "A"
  When: the candidate presses Enter
  Then: hotspot "A" enters selected state; qti-change fires with value="A"

AC-A3: Space activates a focused hotspot
  Given: the item from AC-1 with keyboard focus on hotspot "B"
  When: the candidate presses Space
  Then: hotspot "B" enters selected state; qti-change fires with value="B"

AC-A4: Focused hotspot has visible focus ring in all browsers
  Given: the item from AC-1
  When: any hotspot receives keyboard focus (Tab)
  Then: a visible outline (minimum 2px solid, non-transparent) appears around the shape
  Notes: SVG shapes require explicit :focus CSS outline; test in Chrome, Firefox, and Safari

AC-A5: aria-pressed reflects selection state
  Given: the item from AC-1 with no selection
  When: the item renders
  Then: all hotspot shapes have aria-pressed="false"
  When: the candidate selects hotspot "A"
  Then: hotspot "A" has aria-pressed="true"; others remain aria-pressed="false"

AC-A6: hotspotLabel used as aria-label when provided
  Given: an item where hotspotChoice identifier="A" has hotspotLabel="Glasgow"
  When: the item renders
  Then: the SVG shape for "A" has aria-label="Glasgow" (not "Select hotspot A")

AC-A7: Fallback aria-label when hotspotLabel is absent
  Given: an item where hotspotChoice has no hotspotLabel
  When: the item renders
  Then: the shape has aria-label containing the identifier (e.g. "Select hotspot A")

AC-A8: Image has non-empty alt text
  Given: the item from AC-1 (raster image)
  When: the item renders
  Then: the <img> element has a non-empty alt attribute; a screen reader announces a description
        of the image when focus enters the interaction

AC-A9: Disabled hotspots are not in tab order
  Given: the item from AC-1 with disabled=true
  When: the candidate presses Tab
  Then: none of the hotspot shapes receive focus (tabindex=-1 on all shapes)

AC-A10: Touch targets meet minimum size in rendered dimensions
  Given: the item from AC-1 at natural image size (206×280px, hotspot radius=8)
  When: the component is rendered at full natural width
  Then: each hotspot circle has a rendered diameter of at least 16px
  Notes: radius=8 in natural coordinates is below 44px minimum; this AC verifies the
         requirement is testable — item authors must use larger hotspots for WCAG compliance;
         emit a validator warning for natural bounding-boxes below 44×44
```

### Edge cases

```
AC-E1: Missing image data renders gracefully
  Given: HotspotInteractionData with imageData=null
  When: the item renders
  Then: the overlay SVG renders with the fallback 800×600 viewBox; no JavaScript exception
  Notes: this is a content authoring error; the component should not crash

AC-E2: Image with no width/height attributes
  Given: an item whose <object> element has no width or height attributes
  When: the item renders
  Then: the overlay SVG uses fallback viewBox="0 0 800 600"; the image displays with width:100%

AC-E3: Zero hotspot choices (extractor error state)
  Given: an item with no hotspotChoice children (extractor produces an error)
  When: the item renders
  Then: the interaction renders the image without shapes and does not throw; the error is
        logged; no qti-change event fires

AC-E4: SVG image type renders inline SVG with correct sizing
  Given: an item with imageData.type='svg' and SVG content
  When: the item renders
  Then: the SVG image fills the container (width:100%, height:100%); the hotspot overlay
        is correctly positioned over it

AC-E5: Poly with odd number of coordinates
  Given: a hotspotChoice shape="poly" coords="0,0,100,0,50" (5 values, last y is missing)
  When: the item renders
  Then: the polygon renders using the complete pairs (0,0 and 100,0); the dangling value is
        ignored; no JavaScript exception is thrown

AC-E6: Hotspot identifier containing special characters
  Given: a hotspotChoice with identifier="choice-1_2" (hyphens, underscores)
  When: the candidate selects it and the qti-change event fires
  Then: the event value is exactly "choice-1_2" (no encoding); MATCH_CORRECT scoring works

AC-E7: maxChoices=0 (unlimited) in extractor
  Given: a hotspotInteraction with maxChoices="0"
  When: the extractor runs
  Then: HotspotData.maxChoices === 0 and a validator warning is emitted ("maxChoices=0 means
        unlimited; verify this is intended")
  Notes: maxChoices=0 does not currently change UI behaviour (multi-select is unimplemented);
         this AC tests extractor semantics only
```

---

## Open questions

- [ ] Should deselection be supported for single-select hotspots? The spec does not define a deselect gesture. Some delivery engines allow clicking a selected hotspot again to deselect it. This would require setting response to null/empty. Decide before implementing multi-select, since the pattern differs for single vs. multiple cardinality.
- [ ] How should `ellipse` shape be handled? Options: (a) convert to SVG `<ellipse cx cy rx ry>` (straightforward); (b) approximate as a polygon (consistent with to-pie transformer's circle treatment); (c) raise a runtime warning and skip. The SVG `<ellipse>` approach is simplest and correct.
- [ ] Should the extractor warn when a hotspot's natural bounding box is below 44×44 px? This would help item authors catch WCAG 2.5.8 violations at authoring time, but requires the extractor to parse and compute shape geometry rather than just passing raw coord strings.
- [ ] For multi-select: should clicking a selected hotspot deselect it (toggle), or should there be a separate "clear" button? Toggle is the most natural mobile pattern. A "clear all" button may be needed for users who have filled all selections and need to change one.
- [ ] What is the intended behaviour when the image fails to load (broken URL)? Currently the overlay SVG still renders, but the hotspots float over the browser's broken-image icon, which has different dimensions than the natural image. Consider emitting a `qti-image-error` event or showing an error state.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.3.1 hotspotInteraction
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` (no existing gap item for hotspot; the `rect` coordinate bug and multi-select gap described above are new)
- Component: `packages/default-components/src/plugins/hotspot/HotspotInteraction.svelte`
- Extractor: `packages/item-player/src/interactions/hotspot/extractor.ts`
- Types: `packages/item-player/src/interactions/shared/types.ts` — `HotspotInteractionData`, `HotspotChoice`, `ImageData`
- To-PIE transformer: `packages/to-pie/src/transformers/hotspot.ts` (note: uses correct `rect` coord interpretation)
- Eval YAML: `docs/evals/default-components/hotspot/evals.yaml`
- Sample XML: `packages/to-pie/tests/fixtures/qti-samples/graphic-interactions/hotspot.xml`
- Adjacent PRDs: [choice.md](choice.md) (same `qti-change` event pattern, same shadow DOM design), [select-point.md](select-point.md) (similar image-overlay interaction, different response type)
