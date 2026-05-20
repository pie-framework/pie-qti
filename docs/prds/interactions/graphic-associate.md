# PRD: graphicAssociateInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: graphicAssociateInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`graphicAssociateInteraction` is a QTI interaction type where the candidate creates associations between named regions (hotspots) on an image by clicking pairs of them. Each formed association is visualized as a line drawn between the two hotspot centers using an SVG overlay. The response is a `multiple`-cardinality `pair`-baseType variable where each value is an unordered `"ID1 ID2"` string. This interaction is used for concept mapping, biological diagrams, network topology tasks, and any scenario where the visual relationship between labeled regions matters.

---

## Background and rationale

**Why `pair` and not `directedPair`**: The QTI spec uses `pair` baseType for associations that are symmetric — if A is connected to B, then B is connected to A and the two representations are equivalent. `directedPair` is used when direction matters (e.g. "A causes B"). `graphicAssociateInteraction` uses `pair` because the connection between two hotspots is undirected: clicking A then B is the same association as clicking B then A. The comparison operator `match` treats pairs as unordered sets: `"HEART PUMP"` equals `"PUMP HEART"`. This is why `isCorrectPair()` in the component checks both orderings when scoring.

**Why SVG overlay rather than canvas**: The connection lines are rendered as `<line>` elements in an `<svg>` element absolutely positioned over the image. This approach was chosen over HTML Canvas for four reasons:
1. SVG elements are part of the DOM and can carry ARIA attributes, making them potentially accessible to screen readers in future iterations.
2. SVG scales with CSS without repainting — when the container is resized, the overlay scales with `width: 100%; height: 100%` and the `x1/y1/x2/y2` coordinates (expressed in image pixels) remain geometrically correct because the SVG viewport matches the image container dimensions.
3. SVG `<line>` elements are simpler to render and style than canvas paths — stroke color, width, dash pattern, and linecap are all CSS properties.
4. Canvas would require explicit resize event handling and repainting; SVG does not.

The SVG overlay has `pointer-events: none` so hotspot click events pass through to the `<button>` elements below. This is essential: without `pointer-events: none` on the SVG, lines drawn over hotspots would intercept clicks.

**Why hotspots are `<button>` elements positioned absolutely**: Each `associableHotspot` is rendered as an absolutely positioned `<button>` whose dimensions and position are computed from the `coords` attribute. Buttons are used instead of `<area>` elements (which would require an image map) because:
1. `<button>` is natively keyboard-accessible and focusable without custom ARIA.
2. `<button disabled>` correctly communicates the maxed state to assistive technology.
3. Absolute positioning over an `<img>` or inline SVG is more predictable than image maps, which have browser-specific sizing quirks.

**Why the two-click model instead of drag-to-draw**: The candidate selects the first hotspot (which enters a "pending" state with visual feedback), then selects the second hotspot to complete the association. There is no drag gesture because:
1. Drag-to-draw requires precise mouse tracking and is very difficult to implement accessibly — keyboard users and switch-access users cannot drag.
2. The two-click model maps directly to keyboard operation: Tab to first hotspot, Enter, Tab to second hotspot, Enter.
3. For touch devices, a tap gesture is more reliable than a drag across a small image on a mobile screen.

**Why association order in the stored string is first-clicked, second-clicked**: When the candidate clicks hotspot A then hotspot B, the pair is stored as `"A B"` (not sorted). Pair comparison at scoring time must check both orderings — and the component's `isCorrectPair()` and `removePair()` logic do so. This means the response array is not normalized, which is intentional: normalization would make the response harder to reconstruct for display (the correct indicator shown after submission uses the pair string as-is from the `correctResponse`).

**Why `maxAssociations` is enforced optimistically**: The `canAddMore` guard (`pairs.length < interaction.maxAssociations`) is checked when the second hotspot is clicked, not when the first is selected. This means the candidate can select a first hotspot even when at the maximum — they will see the selection indicator but the pair will not be formed when they click the second hotspot. This is intentional: showing feedback ("you have reached the limit") only after a second click avoids confusingly disabling hotspot interaction entirely when at the limit, since the candidate might want to deselect the current first hotspot.

**Why `matchMax=0` is not treated as unlimited**: Unlike `maxChoices=0` in `choiceInteraction` (which the spec defines as "unlimited"), the spec does not give `matchMax=0` a special meaning. The extractor defaults `matchMax` to `1` when absent. A hotspot with `matchMax=0` would never be activatable, which would be an authoring error. The validator warns when `matchMax < 0` but does not specially handle `0`.

**K-12 use cases**: This interaction type is appropriate for grades 6–12. Common uses include:
- Biology: connecting organs to functions, cell structures to roles
- Chemistry: connecting elements to their group properties
- Geography: connecting countries to capitals or climate zones
- Computer science: connecting nodes in a network diagram
- Math: connecting functions to their graphs on a coordinate plane

At lower grade bands (K–5), the interaction complexity (two-step click model, visual line drawing) may be confusing. Content authors should prefer `matchInteraction` for younger students unless the visual/spatial relationship of the image is the learning objective.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place)  
**Spec section:** §3.3.4 `graphicAssociateInteraction` (`docs/QTI_techguide.md`)

### Supported attributes on `graphicAssociateInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used in `qti-change` event payload |
| `maxAssociations` | ✅ Full | Defaults to `1` if absent. Enforced at second-click time. `0` is not treated as unlimited. |
| `minAssociations` | ✅ Extracted, not enforced | Extracted and displayed as "Minimum required: N" in the panel. Not validated at submission time. See Known gaps (G-06). |

### Supported attributes on `associableHotspot`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required. Used as the pair component in response values and in ARIA labels. |
| `shape` | ✅ Partial | `rect` and `circle` rendered. `poly` and `ellipse` are defined in the QTI spec but are not handled — hotspots with those shapes are silently skipped at render time (the extractor extracts them, but the component template has no branch for them). See Known gaps. |
| `coords` | ✅ Full (for supported shapes) | `rect`: `x1,y1,x2,y2`. `circle`: `cx,cy,r`. The hotspot button dimensions and the SVG line endpoint are both computed from `coords`. |
| `matchMax` | ✅ Full | Per-hotspot maximum connections. Enforced at selection time: clicking a maxed hotspot as the first selection is silently rejected; the button is `disabled` when maxed. |
| `matchMin` | ✅ Extracted, not enforced | Extracted and stored on the hotspot data object. Not validated at submission time. See Known gaps (G-06). |
| `matchGroup` | ❌ Not extracted | Spec: restricts which hotspots can be paired with each other. Not read from XML; not enforced in the UI. See Known gaps (G-01). |
| `class` (CSS classes) | ✅ Partial | Extracted as `classes?: string[]`; not currently used for rendering or `matchGroup` enforcement. |

### Image container

The interaction wraps its background image in a QTI `<object>` element (not `<img>`). The extractor handles two cases:

| Object `type` | Handling |
|---------------|---------|
| `image/svg+xml` (inline SVG) | SVG content is extracted as raw HTML and rendered via `{@html}`. The inline SVG content appears directly inside the stage container. |
| Any other image MIME type | The `data` attribute is used as the `src` of an `<img>` element. |

The `width` and `height` attributes of `<object>` set the pixel dimensions of the stage container. If absent, defaults are `500px × 300px`.

### Response variable contract

- **baseType:** `pair`
- **cardinality:** `multiple`
- **Value format:** An array of strings, each of the form `"ID1 ID2"` (space-separated, unordered). The order of `ID1` and `ID2` is the order of clicking (first clicked, then second clicked) — not alphabetical or authoring order.
- **Null/empty:** `[]` before any association is formed.
- **Symmetry:** `"A B"` and `"B A"` represent the same association. Scoring comparisons must check both orderings. The `match` operator in QTI response processing treats `pair` values as unordered.

### Standard response processing templates

- **MATCH_CORRECT** — exact match against `correctResponse`. Scores `1.0` when the response set equals the correct set exactly; `0.0` otherwise. This is the template used in the demo item (organ → function). Partial credit requires `MAP_RESPONSE` with `mapEntry` per pair.
- **MAP_RESPONSE** — each `mapEntry` maps a `"ID1 ID2"` string to a point value. Because pairs are unordered, the item author must write one `mapEntry` per pair in the canonical order they appear in the correct response. The response processing engine must compare both orderings when evaluating `mapEntry` keys for `pair` values — verify this behavior in `packages/qti-processing/` before authoring partial-credit items.

### Known gaps

**G-01 (`matchGroup` not extracted):** The `matchGroup` attribute on `associableHotspot` restricts which hotspots can pair with each other. Not extracted. Any `matchGroup` constraints in the QTI XML are silently ignored. See `docs/SPEC-GAPS-PLAN.md` §G-01.

**G-06 (`matchMin` not enforced at submission):** `matchMin` on `associableHotspot` declares the minimum number of times each hotspot must appear in the response. Extracted but not validated at submission time. A response missing required hotspot usages is accepted. See `docs/SPEC-GAPS-PLAN.md` §G-06.

**Unsupported hotspot shapes:** `poly` and `ellipse` shapes are valid QTI `associableHotspot` types but are not rendered by the component. Hotspots with these shapes are extracted (data is present) but the Svelte template has no rendering branch for them and they do not appear on screen. Item authors using `poly` hotspots will see blank interaction areas. This is an undocumented gap not yet tracked in SPEC-GAPS-PLAN.

---

## Functional requirements

- **FR-1:** The component renders the background image (raster or inline SVG) at the dimensions specified by the `<object>` element's `width` and `height` attributes. If those attributes are absent, the stage defaults to `500 × 300` px.
- **FR-2:** Each `associableHotspot` with `shape="rect"` or `shape="circle"` is rendered as an absolutely positioned `<button>` overlaid on the image at the position and size derived from `coords`.
- **FR-3:** Clicking an un-maxed hotspot when no hotspot is selected marks that hotspot as "pending" and displays an info banner identifying the selected hotspot and prompting the candidate to click a second hotspot.
- **FR-4:** Clicking a second, different, un-maxed hotspot while one hotspot is pending creates a pair, adds it to the response array, draws a line between the two hotspot centers on the SVG overlay, and clears the pending selection.
- **FR-5:** Clicking the already-selected (pending) hotspot again deselects it and clears the pending state without creating a pair.
- **FR-6:** Clicking any hotspot when `pairs.length >= maxAssociations` does not create a new pair. The `canAddMore` guard is evaluated at second-click time.
- **FR-7:** Each `associableHotspot` whose usage count equals its `matchMax` is rendered `disabled`. Clicking a disabled hotspot as the first selection has no effect.
- **FR-8:** Each formed association appears in the associations panel (right column on desktop, below on mobile) as a labeled row showing `hotspot1.label ↔ hotspot2.label`, a numeric index badge, and a remove button (when not disabled).
- **FR-9:** Clicking the remove button on an association removes it from `pairs`, removes the corresponding SVG line, decrements affected hotspot usage counts (potentially un-maxing them), and emits a `qti-change` event.
- **FR-10:** When `role === 'scorer'` and `correctResponse` is provided, each association in the panel is styled with a success badge if it matches a correct pair (order-insensitive). Each correct pair not present in the candidate's response is drawn as a dashed green line on the SVG overlay.
- **FR-11:** When `disabled=true`, all hotspot buttons are disabled and the remove buttons are hidden. The existing associations and lines remain visible.
- **FR-12:** The `qti-change` event fires on every pair addition and pair removal. The event payload is the full current `pairs` array (not a delta).
- **FR-13:** The component accepts `response` as an array of `"ID1 ID2"` strings and syncs `pairs` from it via a reactive `$effect`. This allows the host to restore a previous response (e.g. after page reload).
- **FR-14:** If `minAssociations > 0`, the count is displayed below the associations panel as "Minimum required: N".
- **FR-15:** The associations counter in the panel header reads "Associations (current/max)" at all times.

---

## Non-functional requirements

### Accessibility

This interaction has significant accessibility challenges because its primary UX is visual (drawing lines on an image). A keyboard-only and screen-reader-only path must be functional.

**Keyboard navigation:**
- All hotspot buttons must be reachable via Tab. The tab order follows the DOM order of `associableHotspot` elements in the source XML.
- Enter or Space on a focused hotspot button triggers `handleHotspotClick`. The two-click model works naturally with keyboard: Tab to first hotspot → Enter → Tab to second hotspot → Enter.
- The remove button in each association row must be focusable and activatable with Enter/Space.
- There is no drag interaction; all operations are click/tap-equivalent, which maps to keyboard without additional implementation.

**ARIA:**
- Each hotspot button's `aria-label` must include: the hotspot label, the current usage count, the `matchMax`, and whether the hotspot is part of a correct pair in scorer role. The current implementation renders: `"{label} ({usageCount}/{matchMax} connections){, Correct answer}"`.
- Disabled hotspot buttons (`disabled` attribute) are correctly announced as unavailable by screen readers.
- The SVG overlay carries `pointer-events: none` and no ARIA roles — it is purely decorative. Connections are represented in text in the associations panel, which is the accessible form of the response.
- The info banner ("Selected: X. Click another hotspot to create an association.") appears as a live region when a hotspot is selected. This banner should carry `aria-live="polite"` or equivalent so screen readers announce it on selection.

**Touch targets:**
- Each hotspot button must meet the WCAG 2.2 SC 2.5.8 (minimum 24×24 CSS pixels) target size. Hotspots derived from `coords` may be smaller. Item authors are responsible for authoring hotspots with adequate size; the component does not enforce a minimum size.
- The remove button in each association row is a `btn-xs` (32px minimum height via DaisyUI) — acceptable but borderline. Do not reduce it further.

**Color alone:**
- Connection lines are drawn in `--color-primary` (blue). Correct lines in scorer role are drawn in `--color-success` (green). These two states must not be distinguished by color alone (WCAG 1.4.1). The correct line in scorer mode uses a dashed stroke (`stroke-dasharray="4,4"`) to distinguish it visually from candidate lines in addition to color. The panel list also labels correct associations with a success badge.
- Hotspot selected state is indicated by both a thicker border and a blue fill tint — not color alone.
- Maxed hotspots use `opacity: 0.5` in addition to `cursor: not-allowed`.

**Screen reader announcements:**
- The associations panel is the text-accessible representation of all current connections. It must be navigable with screen reader virtual cursor.
- The SVG lines are decorative and have no accessible label — this is correct.
- When an association is added or removed, the change is reflected in the panel DOM. Screen readers using live regions or re-reading the panel will pick up the change.

### Performance

- SVG line rendering is O(N) where N is `maxAssociations`. For typical K-12 items (N ≤ 10), this is negligible.
- The inline SVG image path uses `{@html}` to inject raw SVG content. For large SVGs (> 100 KB), this can cause a perceptible paint delay. Item authors should use raster images for large or complex diagrams.
- The component does not load or render the background image — it either injects the `<object data>` src into an `<img>` tag or injects the SVG content. No lazy loading is needed for typical assessment image sizes.

### Cross-platform

- The two-click model works on desktop (mouse click), touch devices (tap), and keyboard (Enter/Space). No drag gesture is required.
- On narrow viewports, the layout switches from `flex-row` (image left, panel right) to `flex-col` (image top, panel bottom) at the `lg` breakpoint (1024px). The image stage does not resize; it may overflow on small screens if the `<object>` width is large. Item authors should use images ≤ 560px wide for mobile-compatible content.
- The component is a custom element (`pie-qti-graphic-associate`) and must function inside shadow DOM without Tailwind CSS being available from the host page. Critical layout rules are duplicated in `<style>` blocks using plain CSS fallbacks.

### Security

- Inline SVG content is injected via `{@html}`. This SVG content comes from parsed QTI XML. The item player's HTML sanitization pipeline must strip `<script>` elements and `on*` attributes from SVG content before it reaches the component. The component itself does not sanitize.
- Raster image `src` URLs come from the `data` attribute of the QTI `<object>` element. No additional URL sanitization is applied in the component; the item player pipeline is responsible for validating content package URLs.

### i18n

Three strings require localization:

| Key | Default (English) | Usage |
|-----|-------------------|-------|
| `interactions.associate.selectAnotherHotspot` | `Selected: <strong>{label}</strong>. Click another hotspot to create an association.` | Info banner when hotspot is pending |
| `interactions.associate.removeAssociation` | `Remove association` | ARIA label on remove button |
| `interactions.associate.altText` | `Association diagram` | `alt` attribute on raster background image |

The `i18n` provider is injected as a prop. When absent, the English defaults are used. There is no RTL-specific handling; associations are listed in selection order regardless of text direction.

---

## Design decisions

### SVG coordinates are in image-pixel space, not CSS-pixel space

**Decision:** Line endpoints (`x1`, `y1`, `x2`, `y2`) and hotspot button positions are computed directly from the `coords` attribute values, which are defined in the coordinate system of the original image.

**Rationale:** The SVG overlay is sized to `100% × 100%` of the stage container, and the stage container is sized to the `width × height` from the `<object>` element. Because the image is rendered with `object-fit: contain` and the container is exactly the image's natural dimensions, image-pixel coordinates map 1:1 to CSS pixels without any scaling transform needed. If the stage were resized (e.g. by CSS), the SVG viewport would scale but the `x1/y1` values would no longer be accurate unless the SVG had a `viewBox` attribute matching the image's natural dimensions.

**Alternatives considered:** Using a `viewBox` on the SVG set to `"0 0 {imageWidth} {imageHeight}"` so that `x1/y1` coordinates are always correct regardless of CSS scaling. This was not implemented; the current approach relies on the stage being sized exactly to the image dimensions.

**Consequences:** If a host page applies CSS that changes the stage container dimensions (e.g. `max-width: 100%` on a narrow screen), the hotspot buttons and SVG lines will be misaligned with the image content. Item authors must size images to fit the expected rendering context.

### Pair deduplication is not enforced

**Decision:** The component does not prevent a candidate from creating the same pair twice (e.g. clicking A → B and then A → B again would add `"A B"` twice to `pairs`).

**Rationale:** The QTI spec does not explicitly require pair deduplication for `graphicAssociateInteraction` at the UI level. `matchMax` on individual hotspots is the mechanism for controlling how many connections each hotspot can have — if `matchMax=1` on both A and B, then after connecting A→B, both hotspots are maxed and the pair cannot be re-created. If `matchMax > 1` on both, the spec allows A to appear in multiple pairs (e.g. A-B and A-C), and duplicate pairs would be a response that some scoring templates would need to handle.

**Alternatives considered:** Blocking duplicate pairs in `handleHotspotClick`. Rejected because it would change the spec semantics for cases where `matchMax > 1` and an item author deliberately wants to allow multiple connections between the same nodes.

**Consequences:** Item authors who set `matchMax=1` on all hotspots will naturally avoid duplicates. Authors setting higher `matchMax` values should be aware that duplicate pairs are possible and that their response processing must handle them.

### The associations panel is always visible

**Decision:** The associations panel (the list of formed pairs) is rendered at all times alongside the image, not shown only on hover or as a modal.

**Rationale:** The panel is the accessible, text-based representation of the candidate's current response. Hiding it would mean screen reader users could not perceive the current state without re-reading the component. It also provides a clear affordance for the remove action, which is the primary way to undo a mistake.

**Alternatives considered:** Showing a tooltip or popup near each line that allows removal by clicking the line. This was rejected because lines are rendered in the SVG overlay with `pointer-events: none` and adding click targets to SVG elements introduces accessibility complexity (SVG elements require `role` and `tabindex` to be keyboard-accessible).

**Consequences:** On narrow screens, the panel occupies vertical space below the image. Layout switches to column at the `lg` breakpoint. On very small screens, the combined height of image + panel may require scrolling.

### Hotspot label is text content of `<associableHotspot>`, not a separate attribute

**Decision:** The label displayed on the hotspot button and in the associations panel is extracted from the text content of the `<associableHotspot>` element. If the element has no text content, the `identifier` is used as a fallback.

**Rationale:** The QTI spec does not define a `label` attribute on `associableHotspot` (unlike `simpleChoice` which uses element content as its label). Using the element's text content matches how other QTI players handle hotspot labeling. The `identifier` fallback ensures the component is functional even for items that omit labels.

**Consequences:** Items that include child elements inside `<associableHotspot>` (e.g. `<img>` for image-labeled hotspots) will have their text content incorrectly extracted or empty. The QTI spec does not specify such usage for `graphicAssociateInteraction`, but it is worth noting.

---

## Data model / contracts

Key types are defined in `packages/item-player/src/interactions/shared/types.ts`:

```typescript
interface GraphicAssociateHotspot {
  identifier: string;
  shape: string;        // 'rect' | 'circle' (others extracted but not rendered)
  coords: string;       // comma-separated coordinate string per QTI spec
  matchMax: number;     // defaults to 1 if absent in XML
  label: string;        // text content of element, falls back to identifier
}

interface GraphicAssociateInteractionData extends BaseInteractionData {
  type: 'graphicAssociateInteraction';
  prompt: string | null;
  maxAssociations: number;   // defaults to 1 if absent
  minAssociations: number;   // defaults to 0 if absent
  imageData: ImageData | null;
  associableHotspots: GraphicAssociateHotspot[];
}
```

The `ImageData` type (defined in `graphicAssociateExtractor.ts`) supports `type: 'image'` (external raster) and `type: 'svg'` (inline SVG). For raster images, `src` is the URL from the `<object data>` attribute. For SVG, `content` is the full `<svg>...</svg>` HTML string.

**Invariants the code enforces:**
- `associableHotspots.length >= 2` (validator error if fewer)
- All hotspot `identifier` values are unique (validator error on duplicates)
- `matchMax >= 0` (validator error if negative)
- `maxAssociations >= 0` (validator error if negative)
- `minAssociations >= 0` (validator error if negative)

**Invariants the code does NOT enforce:**
- `minAssociations <= maxAssociations` (authoring error, not validated)
- `matchMax` relationship to `maxAssociations` (it is possible to author a `maxAssociations` that can never be reached if all hotspots have low `matchMax`)
- Uniqueness of formed pairs (duplicate pairs are allowed)

---

## Acceptance criteria

### Functional

**AC-1: Basic pair creation**
```
Given: An item with hotspots A (rect) and B (rect), maxAssociations=2
When: The candidate clicks hotspot A, then clicks hotspot B
Then: A line is drawn from the center of A to the center of B on the SVG overlay;
      the associations panel shows "A ↔ B" with a remove button;
      pairs = ["A B"];
      a qti-change event is fired with the updated pairs array
```

**AC-2: Deselect by re-clicking pending hotspot**
```
Given: An item with hotspots A and B, no pending selection
When: The candidate clicks hotspot A (now pending), then clicks hotspot A again
Then: The pending state is cleared; the info banner disappears;
      no pair is formed; pairs remains []
```

**AC-3: maxAssociations limit enforced**
```
Given: An item with maxAssociations=2, pairs = ["A B", "C D"]
When: The candidate clicks hotspot E then hotspot F
Then: No new pair is formed; pairs remains ["A B", "C D"];
      no additional line is drawn
Notes: The guard is at second-click time; selecting E as first hotspot succeeds
       and shows the info banner; clicking F is where the guard fires.
```

**AC-4: matchMax limit enforced**
```
Given: Hotspot A has matchMax=1 and is already part of pair "A B"
When: The candidate attempts to click hotspot A as the first selection
Then: Hotspot A's button is disabled; the click has no effect;
      no info banner appears; selectedHotspot remains null
```

**AC-5: Remove pair**
```
Given: pairs = ["A B", "C D"]; candidate is in non-disabled mode
When: The candidate clicks the remove button on the "A ↔ B" row
Then: pairs = ["C D"]; the "A ↔ B" line is removed from the SVG overlay;
      the "C D" line remains; a qti-change event fires with ["C D"];
      hotspot A and hotspot B are no longer maxed (if they were)
```

**AC-6: Scorer role — correct pair highlighting**
```
Given: role="scorer"; correctResponse=["A B"]; candidate response=["A B", "C D"]
When: The component renders
Then: The "A ↔ B" row in the panel shows a success badge;
      the "A B" line is drawn in success (green) color;
      the "C D" line is drawn in primary (blue) color;
      no dashed lines are shown (all correct pairs are present in candidate response)
```

**AC-7: Scorer role — missing correct pair shown as dashed line**
```
Given: role="scorer"; correctResponse=["A B", "C D"]; candidate response=["A B"]
When: The component renders
Then: A solid green line connects A and B (candidate has this correct pair);
      a dashed green line (opacity 0.6, stroke-dasharray "4,4") connects C and D
      (candidate does not have this correct pair);
      the "A ↔ B" row in the panel has a success badge
```

**AC-8: Disabled state**
```
Given: disabled=true; pairs=["A B"]
When: The candidate views the interaction
Then: All hotspot buttons have the disabled attribute;
      no remove buttons are visible in the associations panel;
      the existing "A ↔ B" line is still drawn;
      clicking hotspot buttons has no effect
```

**AC-9: Response sync from parent**
```
Given: The component mounts with response=["C D", "E F"]
When: The component renders
Then: pairs = ["C D", "E F"]; two lines are drawn on the SVG overlay;
      the panel shows both associations
```

**AC-10: Info banner on hotspot selection**
```
Given: No hotspot is pending; hotspot A has label "Heart"
When: The candidate clicks hotspot A
Then: An info banner appears below the image with text including "Heart" and
      instructions to click another hotspot;
      hotspot A is rendered with a thicker border and blue fill tint
```

**AC-11: Associations counter in panel header**
```
Given: maxAssociations=3; pairs=["A B"]
When: The component renders
Then: The panel header reads "Associations (1/3)"
```

**AC-12: minAssociations display**
```
Given: minAssociations=2; the interaction is in candidate mode
When: The component renders
Then: A text element below the associations list reads "Minimum required: 2"
Notes: No validation error is shown for unmet minAssociations — this is a known gap (G-06)
```

**AC-13: SVG image rendering**
```
Given: An interaction with an inline SVG object (type="image/svg+xml")
When: The component renders
Then: The SVG content is injected into the stage container via {@html};
      the hotspot buttons and SVG overlay are positioned above the SVG content;
      the stage has the dimensions from the <object> width/height attributes
```

**AC-14: Raster image rendering**
```
Given: An interaction with an external raster image (type="image/png", data="/path/image.png")
When: The component renders
Then: An <img> element is rendered with src="/path/image.png";
      the img has alt text ("Association diagram" or i18n equivalent);
      hotspot buttons and SVG overlay are positioned above the img
```

**AC-15: Empty state**
```
Given: pairs=[]
When: The component renders in candidate mode
Then: The panel body shows "Click two hotspots on the image to create an association.";
      no lines are drawn on the SVG overlay;
      all hotspot buttons are enabled (assuming not disabled and not maxed)
```

**AC-16: No interaction data**
```
Given: The interaction prop is null or undefined
When: The component renders
Then: An error alert is shown ("No interaction data provided" or i18n equivalent);
      no image, no hotspots, no panel are rendered
```

### Line rendering

**AC-17: Line from rect center**
```
Given: Hotspot A has shape="rect" coords="100,50,200,150" (center: 150,100);
       hotspot B has shape="rect" coords="300,200,400,300" (center: 350,250);
       pair "A B" exists
When: The SVG overlay renders
Then: An SVG <line> element exists with x1=150, y1=100, x2=350, y2=250
      (or x1=350, y1=250, x2=150, y2=100 — order of endpoints is not specified)
Notes: Center of rect is ((x1+x2)/2, (y1+y2)/2)
```

**AC-18: Line from circle center**
```
Given: Hotspot A has shape="circle" coords="200,150,40" (center: 200,150);
       pair "A B" exists where B is any other hotspot
When: The SVG overlay renders
Then: The SVG <line> for this pair has an endpoint at (200,150) for hotspot A
Notes: Center of circle is (cx,cy) directly from coords
```

**AC-19: SVG overlay is non-interactive**
```
Given: The SVG overlay is rendered over the image and hotspot buttons
When: The candidate attempts to click on a drawn line
Then: The click passes through to the hotspot button or image beneath;
      no click handler on the SVG line is triggered
Notes: Verify pointer-events:none is applied to the SVG element
```

### Accessibility

**AC-A1: Hotspot button ARIA label**
```
Given: Hotspot "Heart" with matchMax=3, currently used 1 time; not in correct pair
When: The component renders
Then: The button's aria-label is "Heart (1/3 connections)"
```

**AC-A2: Hotspot button ARIA label — scorer with correct pair**
```
Given: role="scorer"; hotspot "Heart" is part of a correct pair
When: The component renders
Then: The button's aria-label ends with ". Correct answer"
```

**AC-A3: Maxed hotspot button accessibility**
```
Given: Hotspot A has matchMax=1 and is already used in a pair
When: The component renders
Then: Hotspot A's button has the disabled attribute;
      screen readers announce it as unavailable/dimmed
```

**AC-A4: Keyboard pair creation**
```
Given: No hotspot is pending; candidate uses keyboard only
When: The candidate Tabs to hotspot A and presses Enter, then Tabs to hotspot B and presses Enter
Then: A pair "A B" is formed, identical to mouse-click behavior
Notes: The button onclick fires on Enter for <button> elements natively
```

**AC-A5: Remove button accessibility**
```
Given: pairs=["A B"]; the remove button for this pair is rendered
When: The candidate focuses the remove button via Tab and reads it with a screen reader
Then: The button is announced with aria-label "Remove association"
```

**AC-A6: Background image has alt text**
```
Given: An interaction with a raster background image
When: The component renders
Then: The <img> element has a non-empty alt attribute ("Association diagram" or i18n equivalent)
Notes: This provides context for screen reader users who cannot see the image
```

### Edge cases

**AC-E1: Hotspot with unknown shape**
```
Given: An associableHotspot with shape="poly" in the XML
When: The component renders
Then: No button is rendered for that hotspot;
      the interaction continues to function for other hotspots;
      no JavaScript error is thrown
Notes: poly shape is a known gap — verify it fails gracefully, not with an exception
```

**AC-E2: maxAssociations=1 (default)**
```
Given: An item with no maxAssociations attribute (defaults to 1)
When: The candidate creates one pair "A B"
Then: The counter shows "Associations (1/1)";
      attempting to create a second pair (clicking C then D) does not form a pair
```

**AC-E3: All hotspots maxed, no associations possible**
```
Given: All hotspots have matchMax=1 and are already in pairs
When: The candidate attempts to click any hotspot
Then: All hotspot buttons are disabled;
      no info banner appears;
      the response is unchanged
```

**AC-E4: Pair symmetric comparison in scorer mode**
```
Given: role="scorer"; correctResponse=["HEART PUMP"];
       candidate response=["PUMP HEART"] (reverse order)
When: The component renders
Then: The "PUMP ↔ HEART" row in the panel has a success badge;
      the line is drawn in success color (not primary color)
Notes: Pair comparison must be order-insensitive in both directions
```

**AC-E5: No prompt**
```
Given: An interaction with no <prompt> child element
When: The component renders
Then: No prompt element is rendered (no empty paragraph or whitespace);
      the image area renders correctly without top margin for a prompt
```

---

## Open questions

- [ ] Should duplicate pair creation be blocked in the UI? The current code allows it when `matchMax > 1` on both hotspots. The QTI spec is silent on this for `graphicAssociateInteraction`. A consistent policy should be established before G-01 (`matchGroup`) is implemented, since `matchGroup` filtering logic interacts with pair deduplication.
- [ ] Should `maxAssociations=0` be treated as unlimited (like `maxChoices=0` in `choiceInteraction`) or as an authoring error (current behavior)? The QTI spec section for `graphicAssociateInteraction` does not explicitly state the semantics of `maxAssociations=0`.
- [ ] The `poly` and `ellipse` hotspot shapes are silently unsupported. Should this be tracked as a formal spec gap item in `SPEC-GAPS-PLAN.md`? The `coords` format for `poly` (`x1,y1,x2,y2,...`) would need a new geometric center calculation and a new rendering strategy (SVG `<polygon>` element positioned absolutely, or a clip path).

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.3.4
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` §G-01 (`matchGroup`), §G-06 (`matchMin` enforcement)
- Response tracking: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Component: `packages/default-components/src/plugins/graphic-associate/GraphicAssociateInteraction.svelte`
- Extractor: `packages/item-player/src/interactions/graphic-associate/extractor.ts`
- Type definitions: `packages/item-player/src/interactions/shared/types.ts` (`GraphicAssociateInteractionData`, `GraphicAssociateHotspot`)
- Extractor tests: `packages/item-player/tests/extraction/extractors/graphicAssociateExtractor.test.ts`
- Eval scenarios: `docs/evals/default-components/graphic-associate/evals.yaml`
- Demo item XML: `apps/demo/src/lib/sample-items.ts` (`GRAPHIC_ASSOCIATE_INTERACTION` export)
- Adjacent PRDs: `docs/prds/interactions/associate.md` (text-based associate interaction with same `pair` baseType semantics), `docs/prds/interactions/hotspot.md` (hotspot rendering without associations), `docs/prds/interactions/graphic-order.md` (graphic interaction with ordering)
