# PRD: graphicGapMatchInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: graphicGapMatchInteraction
  Last reviewed: 2026-11-09
-->

**Status:** draft
**Type:** interaction
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)
**Last reviewed:** 2026-11-09

---

## Summary

`graphicGapMatchInteraction` is the most complex interaction in the set. It presents a background image with defined `<associableHotspot>` regions and a pool of draggable `<gapImg>` or `<gapText>` choices. The candidate assigns one choice to each hotspot by drag-and-drop (mouse or touch) or by a two-step keyboard workflow. Each assignment produces a `directedPair` value of the form `"choiceIdentifier hotspotIdentifier"`. The interaction collects a `multiple`-cardinality, `directedPair`-baseType response and is scored with `map_response` partial credit (one point per correct pair) or `match_correct` all-or-nothing scoring.

The implementation renders both text labels (`gapText`) and image labels (`gapImg`, named by the image's text alternative) as buttons in one choice pool.

---

## Background and rationale

### What this interaction is for

The interaction is designed for tasks where a candidate must identify and label parts of a diagram using image icons or text labels — for example: place airport code images on a UK map, assign flags of countries to map regions, label anatomy diagrams with organ names. The choice pool and the background image together convey the instructional context; neither alone is sufficient.

In K-12 assessment, the most common pedagogical use is labelling a scientific or geographic diagram. Text labels (planet names, anatomical terms) are the most practical choice for most content. Image labels are used when the recognizable icon is the answer (e.g., a flag image, a chemical structure diagram) and text would defeat the purpose.

### Why `directedPair` has a fixed direction

`directedPair` in QTI is an ordered tuple. The pair `"gapImgId hotspotId"` is not the same as `"hotspotId gapImgId"`. The direction is always **choice → hotspot**: the first identifier is the dragged item (source), the second is the drop target (destination). This matches the interaction's conceptual direction — you drag a label *onto* a map region, not the other way around.

This ordering is not cosmetic. Response processing templates (`map_response`, `match_correct`) perform exact string equality on `mapEntry` keys. A `responseDeclaration` with `<value>GLA A</value>` will only match a response that contains exactly `"GLA A"`, never `"A GLA"`. Every place that constructs or compares pair strings — the component's `handleHotspotDrop`, the validator, the scoring XML — must preserve choice-first, hotspot-second order.

### Why drag-and-drop must have a full keyboard alternative

WCAG 2.2 SC 2.5.7 (Dragging Movements, Level AA) requires that every action achievable by drag-and-drop is also achievable through a pointer action that does not require dragging. SC 2.1.1 requires keyboard access to all functionality. On mobile devices without a mouse, drag-and-drop is implemented via touch events, which are handled by the `touchDrag` Svelte action from `@pie-qti/qti-common`.

The keyboard pattern is a two-step select-then-confirm model: press Space/Enter on a label to select it, Tab to a hotspot, press Space/Enter to place. Escape cancels. This avoids the poor assistive-technology support for the W3C ARIA drag-and-drop roles (`role="listitem"` with `aria-grabbed`) and matches established practice for this interaction type.

### Why the background image uses SVG coordinates, not pixel layout

Hotspot positions are defined as `shape`/`coords` attributes on `associableHotspot` elements — the same coordinate system used by HTML `<map>` elements and `hotspotInteraction`. The coordinate origin is the top-left of the background image at its declared pixel dimensions. The overlay SVG is sized to match the background image's declared `width`/`height` and uses a `viewBox` of `"0 0 width height"` so that hotspot coordinates correspond directly to the `width`/`height` values in the XML.

This means the interaction does not scale the hotspot regions independently of the image. If the host page scales the image (via CSS `transform: scale()` or a container narrower than `width`), the visual hotspot overlay will scale with it (because it is an `absolute`-positioned SVG overlay), but the `coords` numbers in the XML remain fixed. Authors must provide image dimensions that reflect actual intended display size.

### Why placed labels are shown as SVG text on the hotspot, not as overlaid HTML

When a candidate places a label onto a hotspot, the component renders the label text as an SVG `<text>` element centered within the hotspot shape. This is a practical choice given the architecture: the hotspot overlay is already an SVG layer positioned absolute over the background image. Rendering the label text inside the SVG avoids the z-index and overflow management complexity that would arise from positioning separate HTML elements over the image. The trade-off is that SVG text has limited rich-content support — HTML within a label (bold, images) will not render inside an SVG `<text>` element.

### Why `poly` shape is supported but not accurately rendered

The `parseCoords` function in the component handles `circle` and `rect` with full coordinate parsing. For `poly`, it falls back to a bounding box approximation: it uses the first two coordinates as the top-left origin and sets a fixed 40×40px bounding box. This is because drawing an interactive SVG polygon drop zone with correct pointer-events requires a full SVG `<polygon>` element, which the current implementation does not render. The practical consequence is that `poly` hotspots function but are visually represented as a 40×40 point rather than the true polygon shape. `ellipse` is not handled by `parseCoords`; it would follow the circle path and produce incorrect rendering.

### Why the label pool is hidden in scorer role

When `role="scorer"` and `correctResponse` is provided, the label pool (the `gapTexts` row) is not shown. Instead, correct label texts are rendered directly on their correct hotspots in the SVG overlay using the same text rendering path as placed labels. This is intentional: in scorer mode the purpose is to show the answer key, not present an interactive pool. The candidate does not need to see the pool; the reviewer needs to see where each correct label belongs on the diagram.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name `qti-graphic-gap-match-interaction`)
**Spec section:** §3.3.5 graphicGapMatchInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `graphicGapMatchInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used in `qti-change` event payload |
| `maxAssociations` | ✅ Full | Extracted into `GraphicGapMatchInteractionData.maxAssociations` (0 = unlimited). An absent attribute takes the per-version spec default: 1 for QTI 2.2 and 3.0, no cap (0) for QTI 2.1, which has no such attribute (see the default note under Known gaps). **Enforced by the UI**: a placement that would exceed the cap is refused and announced (author's `data-max-selections-message` wins). Engine response validation rejects over-limit responses at submit. |
| `data-max-selections-message` | ✅ Full | Author's message for a refused placement past `maxAssociations`; delivered as `maxSelectionsMessage` and announced verbatim. |
| `minAssociations` | ❌ Not extracted | Spec: minimum total pairs required; not extracted; not enforced |

### Supported attributes on `gapText`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required; deduplicated in validator |
| `matchMax` | ✅ Full | Extracted; controls how many times a label can be used. When `matchMax=1` (default), the label button is disabled and shows "placed" state once matched |
| `matchMin` | ✅ Extracted, not validated | Extracted to the local `GraphicGapMatchData` shape; not in `GraphicGapMatchInteractionData` type; not enforced at submission |
| `matchGroup` | ✅ Full (G-01) | Delivered as `gapTexts[]`/`gapImages[].matchGroup`: the hotspots this label may be placed on. Applied with the hotspot's own `matchGroup` by the shared rule (see Resolved gaps) |
| CSS classes | ✅ Partial | Extracted as `classes?: string[]`; present in `GraphicGapMatchData` but not surfaced in `GraphicGapMatchInteractionData` |

### Supported attributes on `associableHotspot`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required; deduplicated in validator |
| `shape` | ✅ Partial | `circle` and `rect` rendered correctly. `poly` uses a 40×40 bounding-box approximation. `ellipse` not handled. |
| `coords` | ✅ Partial | Parsed for `circle` and `rect`. `poly` uses only the first coordinate pair plus a fixed size. |
| `matchMax` | ✅ Full | Extracted; when a hotspot already has a label placed on it, a subsequent drop replaces the occupant (enforces `matchMax=1` semantics implicitly) |
| `matchMin` | ❌ Not extracted | Not in `AssociableHotspot` type; not validated at submission |
| `matchGroup` | ✅ Full (G-01) | Delivered as `hotspots[].matchGroup`: the labels this hotspot accepts (see Resolved gaps) |

### `gapImg` element

`gapImg` choices (each holding an `<object>` or `<img>` image) are extracted as `gapImages` with their `src`, size, `matchMax` and `matchGroup`, and render as image buttons in the same pool as `gapText` labels. A gap image is named by its image's text alternative; one without any gets the generic, localized name "Label", never its identifier.

### Response variable contract

- **baseType:** `directedPair`
- **cardinality:** `multiple`
- **Value format:** an array of strings, each of the form `"gapTextIdentifier hotspotIdentifier"` (source first, hotspot second, space-separated)
- **Null/empty:** `[]` before any label is placed
- **Direction invariant:** the first identifier is always the choice (gapText/gapImg), the second is always the hotspot. This matches QTI spec directedPair semantics.

### Standard response processing templates

- **MAP_RESPONSE** — partial credit via `mapping` on the `responseDeclaration`. Each `mapEntry` key is a `"gapTextId hotspotId"` string. The scoring engine sums mapped values for each pair in the response. This is the most common scoring path for this interaction (one point per correctly placed label). Use `lowerBound="0"` to prevent negative total scores when wrong placements have negative `mappedValue`.
- **MATCH_CORRECT** — full credit only when the response array exactly equals `correctResponse` (all correct pairs, no incorrect ones). Appropriate only when every label must be correctly placed for full credit.

### Resolved gaps

**G-01: `matchGroup`** (`docs/SPEC-GAPS-PLAN.md` §G-01, Done). QTI 2.2 and 3.0 define `matchGroup` on `gapText`, `gapImg` and `associableHotspot` as "a list of the identifiers for the objects that can be matched with" it (QTI 2.2.4 ASI Information Model, Tables 5.39.4, 5.37.4, 5.5.4; QTI 3.0, Tables 5.58.4, 5.56.4, 5.7.4). The component decides every placement with `isMatchGroupCompatible` from `@pie-qti/item-player`, the rule `Player.validateResponses()` applies: while a label is held or dragged, the hotspots that refuse it are `aria-disabled`, dimmed, named "Not available due to a match group restriction." and do not accept a drag; a refused keyboard placement keeps the label held and announces why. The label being dragged is judged on its own, even when another label is held from the keyboard. The rule accepts a pairing when either reading allows it: the specification's (label and hotspot name each other) or the shared-group-label reading some content uses (shared token; a side without `matchGroup` is unrestricted). `matchGroup` constrains label–hotspot pairs only: placing one label never makes another unavailable.

**`gapImg`**: extracted and rendered (see `gapImg` element above).

### Known gaps

**`maxAssociations` default follows the spec per QTI version**
The interaction-level `maxAssociations` attribute is extracted and the component refuses and announces placements past it (the author's `data-max-selections-message` wins), so an over-limit response can no longer be built through the UI only to be rejected at submit. An absent attribute takes the specification's default for the item's QTI version: QTI 2.2 (ASI Information Model Table 5.41.2) and QTI 3.0 (Table 5.60.2) define `max-associations` as optional with `Default = "1"` (0 = no restriction), so such an item allows one association; the attribute does not exist on `graphicGapMatchInteraction` in QTI 2.1 (it was added in 2.2), so a 2.1 item has no interaction cap, only the per-choice `matchMax` values. An authored value is honoured in every version, including 2.1 content, with `0` meaning unlimited. Items meant to fill several hotspots author `max-associations` explicitly; the demo sample items and the clean-room certification fixtures do.

Per-label and per-hotspot `matchMax` need no separate UI guard: the placement model holds one pair per label and one pair per hotspot, so a placement never raises either side's count above 1 — never past any authored `matchMax ≥ 1`. The engine (`graphicGapMatchMaximaErrors` in `Player.validateResponses`) additionally checks all three maxima against restored or programmatic responses.

**`poly` and `ellipse` shape rendering incomplete**
`poly` hotspots are rendered as a 40×40 bounding box anchored at the first coordinate pair. `ellipse` is not explicitly handled. Both are documented and expected to be fixed when real content requiring those shapes is needed.

---

## Functional requirements

- **FR-1:** Render a background image (SVG inline or raster `<img>`) at the declared `width` × `height` pixel dimensions. Overlay an absolutely-positioned, full-coverage SVG for hotspot rendering.
- **FR-2:** Render a label pool above the image stage, displaying one button per `gapText` entry. Labels in the pool that have already been placed show a visually distinct "placed" state and are disabled for dragging.
- **FR-3:** When a candidate drags a label onto a hotspot and drops it, create the pair `"gapTextId hotspotId"` and add it to the response array. If the hotspot was already occupied, replace the existing pair (displace the previous label, which returns to an available state in the pool). Emit a `qti-change` event.
- **FR-4:** When a candidate clicks the ✕ button adjacent to a placed label in the pool, remove that label's pair from the response array and return the label to an available state. Emit `qti-change`.
- **FR-5:** Enforce `matchMax` on each label: when a label has been placed `matchMax` times (default 1), it is shown in "placed" state and cannot be dragged or keyboard-selected. The button remains visible in the pool so the candidate knows the label exists.
- **FR-5a:** Enforce the interaction's `maxAssociations`: a placement (drag or keyboard) whose response would hold more pairs than `maxAssociations` (0 = unlimited) is refused and announced through the polite live region — the author's `data-max-selections-message` when authored, else the localized "Association not possible: the limit of {max} is reached." A keyboard label stays held on refusal; replacing a placed label within the cap is still allowed.
- **FR-6:** Support touch drag-and-drop via the `touchDrag` Svelte action applied to each label button.
- **FR-7:** Support a two-step keyboard alternative: press Space/Enter on a label button to select it (toggle); Tab to a hotspot SVG element; press Space/Enter to place; press Escape to cancel. Hotspot elements must receive `tabindex=0` only when a label is actively selected (otherwise `tabindex=-1`).
- **FR-8:** On each response change, emit a `qti-change` CustomEvent from the root element with `{ responseIdentifier, value: string[] }` where `value` is the full current pairs array.
- **FR-9:** Accept a `response` prop (`string[]`) and reflect existing pairs on mount without emitting `qti-change`.
- **FR-10:** When `disabled=true`, suppress all interaction: no drag, no keyboard pairing, no ✕ buttons. Existing pairs remain visible in the SVG overlay.
- **FR-11:** When `role='scorer'` and `correctResponse` is provided, hide the label pool and render correct label texts directly on their correct hotspot positions in the SVG overlay. Do not reveal correct answers to any other role.
- **FR-12:** Render the `prompt` HTML content above the label pool and image stage when present.
- **FR-13:** Show visual hover feedback on hotspots during drag-over (blue fill, solid stroke).
- **FR-14:** Show visual placement confirmation on hotspots when a label is placed (green fill, solid stroke, label text centered in hotspot).

---

## Non-functional requirements

### Accessibility

WCAG 2.2 Level AA is mandatory. Assessment-specific concerns compound the general requirements:

- **Keyboard alternative (SC 2.5.7, SC 2.1.1):** The full interaction must be operable by keyboard alone. Drag-and-drop may not be the only path to placement. The two-step select-then-confirm model satisfies this.
- **Label buttons must be focusable `<button>` elements** with `aria-pressed` indicating selection state. When a label has been placed, the button must be `disabled` (HTML attribute), which removes it from the tab order and announces it as disabled to screen readers.
- **Hotspot SVG elements** (`<circle>`, `<rect>`) must carry `role="button"` and `tabindex` (0 when a label is selected, -1 otherwise) to be reachable by keyboard. Each hotspot must have an `aria-label` that identifies its position (e.g., "Hotspot 1") and its current contents ("Contains Mercury" or "Available").
- **`aria-live="polite"` region** must announce placements, removals, and selection changes as they occur.
- **Visually hidden instruction block** must describe the keyboard workflow; the interaction region must reference it via `aria-describedby`.
- **Background image alt text:** The background image (`<object>` element) requires an accessible description. SVG backgrounds rendered inline need either an accessible `<title>` child or an `aria-label` on the containing element. Currently the SVG is rendered with `{@html}` and carries no accessible name — this is a known gap to address in content authoring guidelines.
- **`gapImg` objectLabel:** The `objectLabel` attribute on `gapImg` elements is not extracted; image labels are named by their image's text alternative instead.
- **Touch targets:** Label buttons must have a minimum touch target size of 44×44px (WCAG 2.2 SC 2.5.8 minimum 24×24px; assessment best practice is 44×44px). Hotspot regions' interactive area must satisfy the same constraint.
- **Color is not the only indicator:** Placed (green) vs. available (primary) vs. selected (accent) state must be distinguishable without relying on color alone. The label text, `aria-pressed`, and button `disabled` state together provide non-color cues.

### Performance

- Extraction and rendering for a 6-label, 4-hotspot item must complete in under 16 ms on a mid-range mobile device.
- The SVG overlay is re-rendered reactively on each `pairs` state change. For typical item sizes (≤10 labels, ≤10 hotspots), this is a simple DOM patch. No virtualization is required.

### Cross-platform

- Touch drag via `touchDrag` action must work on iOS Safari 16+ and Android Chrome.
- The `touch-action: none` CSS on `[draggable="true"]` is required to prevent scroll interference during drag.
- On narrow viewports (≤640px), the stage image may exceed the viewport width; the host must allow horizontal scroll or scale the stage via `::part(stage)` override. The component does not force-scale the image.

### Security

- The `prompt` field is rendered via `{@html}`. Content must be sanitized upstream by the item player before reaching the component.
- SVG content for the background image is rendered via `{@html}`. Inline SVG from QTI XML must be sanitized to remove `<script>` elements and event attributes before extraction. The extractor does not perform this sanitization; it is the item player's responsibility.
- Label `text` is rendered via `{@html}` inside the pool buttons. Same sanitization requirement applies.

### i18n

The following string keys must be provided via the `i18n` prop or fall back to the English defaults:

| Key | Default |
|-----|---------|
| `common.errorNoData` | `"No interaction data provided"` |
| `interactions.graphicGapMatch.availableLabel` | `"Available labels to place"` |
| `interactions.graphicGapMatch.availableHeading` | `"Available Labels:"` |
| `interactions.graphicGapMatch.removeLabel` | `"Remove label"` |
| `interactions.graphicGapMatch.associationLimitReached` | `"Association not possible: the limit of {max} is reached."` |

---

## Design decisions

### Two-phase keyboard workflow: select label first, then activate hotspot

**Decision:** Keyboard interaction requires two sequential actions: (1) press Space/Enter on a label button to mark it as "selected for placement", then (2) Tab to a hotspot and press Space/Enter to complete the placement. Hotspot elements are only keyboard-reachable (`tabindex=0`) when a label is actively selected.

**Rationale:** ARIA drag-and-drop roles (`aria-grabbed`, `aria-dropeffect`) were removed from WAI-ARIA 1.1 due to poor and inconsistent screen-reader support. The two-step model avoids custom ARIA roles entirely and uses `aria-pressed` (well-supported) on source buttons and `role="button"` (well-supported) on SVG hotspots. Keeping hotspots at `tabindex=-1` when no label is selected prevents the tab order from being cluttered with inactive hotspot buttons. When a label is selected, all hotspots become reachable so the candidate can navigate to any target.

**Alternatives considered:** Always expose hotspots in tab order. Rejected: an 8-hotspot item would add 8 extra tab stops to the page even when the candidate is not placing a label.

**Consequences:** The keyboard interaction requires two distinct gestures. Screen reader users must understand that pressing Space on a label does not complete a placement — a second action on the hotspot is required. This is communicated via the visually hidden instructions and the `aria-live` announcement after selection.

### Labels render as text in SVG on the hotspot (not as HTML overlay)

**Decision:** When a label is placed, its text is rendered as an SVG `<text>` element centered at the hotspot's coordinate center. The text is not an HTML element overlaid on the image.

**Rationale:** The hotspot overlay is already an SVG layer. Adding HTML elements absolutely positioned over the image at hotspot coordinates would require computing pixel positions from the SVG coordinate space, handling image scaling, and managing z-index layering between the background image and the overlay. SVG `<text>` renders within the same coordinate system without any position calculation. The visual result is identical for plain text labels.

**Alternatives considered:** HTML `<div>` overlays with `position: absolute` and calculated `top`/`left`. Rejected for the reasons above. Also rejected because HTML inside a `foreignObject` in SVG has inconsistent cross-browser rendering.

**Consequences:** Rich HTML label content (images, bold text, inline equations) cannot be rendered on the hotspot via SVG `<text>`. If a label contains HTML markup, the raw text content (stripping tags) is what appears on the hotspot. This is acceptable for text labels but would be a problem for `gapImg` image labels — a separate rendering approach would be needed for image-based choices.

### Hotspot occupancy is always single (one label per hotspot)

**Decision:** `handleHotspotDrop` and `placeSelectedLabelOnHotspot` both unconditionally remove any existing pair for the target hotspot before adding the new one. A hotspot can hold at most one label at a time in the UI, regardless of the hotspot's `matchMax` value.

**Rationale:** The overwhelming majority of K-12 labelling tasks are one-label-per-region. Supporting multiple labels per hotspot would require visual disambiguation (e.g., a numbered list inside the hotspot region) and a UX pattern for replacing only one of several occupants. The `matchMax=1` default on `associableHotspot` reflects this. Multiple occupants per hotspot are theoretically possible per QTI spec but are extremely rare in practice.

**Alternatives considered:** Accumulate labels in the hotspot up to `matchMax`. Rejected: adds layout complexity and is not needed for any current content.

**Consequences:** If an author sets `matchMax > 1` on a hotspot, only one label can be placed on it via the UI. The single pair is still emitted correctly in the response; the constraint is a UI limitation, not a data corruption.

### `gapText` and `gapImg` share one choice pool

**Decision:** Text labels (`gapText`) and image labels (`gapImg`) are delivered separately (`gapTexts`, `gapImages`) and rendered in one pool with the same placement, `matchMax` and `matchGroup` rules.  
**Rationale:** The QTI choice element for this interaction is `gapImg`; content also uses `gapText`. One set of rules keeps keyboard, pointer and touch placement identical for both.  
**Consequences:** A placed image label is shown on its hotspot by name, not by its image (see Open questions).

### `poly` shape uses bounding-box approximation

**Decision:** `parseCoords` for `poly` shapes returns a 40×40 bounding box at the first coordinate pair rather than computing the true polygon bounding box or rendering a `<polygon>` element.

**Rationale:** No current content uses `poly` hotspots. A complete implementation requires computing the minimum bounding box of all polygon vertices (or rendering a `<polygon>` SVG element as the hit area). This was deferred as it requires additional geometry code and a `<polygon>` rendering branch in the hotspot template.

**Consequences:** Items with `poly` hotspots will display incorrectly sized and positioned hotspot regions. The interaction remains functional (pairs are formed and emitted), but the visual hotspot alignment will be wrong.

---

## Data model / contracts

### `GraphicGapMatchInteractionData` (from `@pie-qti/item-player`)

Source: `packages/item-player/src/interactions/shared/types.ts`

```typescript
interface AssociableHotspot {
  identifier: string;   // from associableHotspot identifier attribute
  shape: string;        // 'circle' | 'rect' | 'poly' | 'ellipse'
  coords: string;       // comma-separated coordinate string
  matchMax: number;     // from matchMax attribute; defaults to 1
}

interface GraphicGapMatchInteractionData extends BaseInteractionData {
  type: 'graphicGapMatchInteraction';
  responseId: string;          // from responseIdentifier attribute
  prompt: string | null;       // HTML content of <prompt> child, or null
  imageData: ImageData | null; // background image (SVG inline or raster src)
  gapTexts: Array<{
    identifier: string;        // from gapText identifier attribute
    text: string;              // HTML content of gapText element
    matchMax: number;          // from matchMax attribute; defaults to 1
  }>;
  hotspots: AssociableHotspot[];
}
```

**Invariants enforced by extractor:**
- `gapTexts` has at least one entry (error if empty)
- `hotspots` has at least one entry (error if empty)
- All `identifier` values in `gapTexts` are non-empty and unique (error on duplicate)
- All `identifier` values in `hotspots` are non-empty and have non-empty `coords` (error otherwise)
- `imageData` absence produces a warning (not an error)

**Invariants not enforced (gaps):**
- `matchMin` per gapText extracted into extractor-local shape but discarded before returning from `extract()` (not in `GraphicGapMatchInteractionData`)

### Response format

The response is `string[]` where each element is `"gapTextIdentifier hotspotIdentifier"`.

Example for a 4-label, 4-hotspot labelling item:
```
["MERCURY A", "VENUS B", "EARTH C", "MARS D"]
```

The response variable in QTI XML:
```xml
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
  <correctResponse>
    <value>MERCURY A</value>
    <value>VENUS B</value>
    <value>EARTH C</value>
    <value>MARS D</value>
  </correctResponse>
  <mapping lowerBound="0" defaultValue="0">
    <mapEntry mapKey="MERCURY A" mappedValue="1"/>
    <mapEntry mapKey="VENUS B" mappedValue="1"/>
    <mapEntry mapKey="EARTH C" mappedValue="1"/>
    <mapEntry mapKey="MARS D" mappedValue="1"/>
  </mapping>
</responseDeclaration>
```

`lowerBound="0"` on the mapping is recommended to prevent negative total scores when incorrect placements carry negative `mappedValue` and the candidate guesses.

---

## Acceptance criteria

### Functional

```
AC-1: Place a label via drag-and-drop
  Given: an item with 4 labels (MERCURY, VENUS, EARTH, MARS) and 4 hotspots (A, B, C, D)
  When: the candidate drags the "Mercury" label button onto hotspot A
  Then: the pair "MERCURY A" appears in the response; the Mercury button shows placed
        (green, disabled); SVG text "Mercury" appears centered on hotspot A; a qti-change
        event fires with the updated array

AC-2: Replace an occupied hotspot
  Given: "MERCURY A" is already placed
  When: the candidate drags the "Venus" label onto hotspot A
  Then: "MERCURY A" is removed from the response; "VENUS A" is added; the Mercury button
        returns to available state; the Venus button shows placed state; qti-change fires

AC-3: Remove a placed label via ✕ button
  Given: "MERCURY A" is placed; the Mercury button shows a ✕ button adjacent to it
  When: the candidate clicks the ✕ button on the Mercury label
  Then: "MERCURY A" is removed from the response; the Mercury button returns to available
        state; the SVG text on hotspot A disappears; qti-change fires with the updated array

AC-4: Full-credit submission
  Given: the solar-system item at /item-demo/graphic-gap-match-solar-system
  When: the candidate places Mercury→A, Venus→B, Earth→C, Mars→D and submits
  Then: SCORE=4.0, MAXSCORE=4.0

AC-5: Partial credit (one wrong)
  Given: the same item
  When: the candidate places Mercury→A, Venus→B, Earth→C, Mars→C (last one wrong) and submits
  Then: SCORE=3.0, MAXSCORE=4.0

AC-6: Zero score (all wrong)
  Given: the same item
  When: the candidate places all labels on the wrong hotspots and submits
  Then: SCORE=0.0, MAXSCORE=4.0

AC-7: matchMax=1 prevents reuse
  Given: all labels have matchMax=1 (default); Mercury has been placed on hotspot A
  When: the candidate attempts to drag the Mercury button
  Then: the Mercury button is disabled (not draggable); it cannot be keyboard-selected;
        no drag initiates

AC-8: matchMax=2 allows a label to be placed twice
  Given: a label L1 with matchMax=2 and at least two available hotspots
  When: the candidate places L1 on hotspot A, then places L1 on hotspot B
  Then: the response contains both "L1 A" and "L1 B"; L1's button remains active after the
        first placement; it becomes disabled after the second (matchMax reached)
  Notes: The ✕ button appears after the first placement. Removing one placement returns
         L1 to active state.

AC-9: disabled=true suppresses all interaction
  Given: the item rendered with disabled=true and an existing response ["MERCURY A"]
  When: the candidate attempts drag, keyboard-select, or ✕ button click
  Then: no response change occurs; no qti-change event fires; buttons are visually disabled;
        the SVG shows the existing placement but no ✕ button appears

AC-10: Pre-existing response reflected on mount
  Given: the item rendered with response=["MERCURY A", "VENUS B"]
  When: the component mounts
  Then: Mercury and Venus buttons show placed state; hotspot A shows "Mercury" text; hotspot B
        shows "Venus" text; no qti-change fires on mount

AC-11: scorer role shows correct answer key
  Given: the item rendered with role="scorer" and correctResponse=["MERCURY A","VENUS B","EARTH C","MARS D"]
  When: the item renders
  Then: the label pool is hidden; correct label texts appear in green on their correct hotspots
        in the SVG; no interaction is possible

AC-12: candidate role never reveals correct answers
  Given: the item rendered with role="candidate" and correctResponse populated
  When: the item renders
  Then: no green correct-answer highlights appear on hotspots; the label pool is visible and
        interactive; the SVG overlay shows only currently placed labels (if any)

AC-13: prompt renders above the interaction
  Given: a graphicGapMatchInteraction with a <prompt> containing HTML
  When: the item renders
  Then: the prompt HTML appears above the label pool and above the image stage

AC-14: Hover feedback during drag-over
  Given: the candidate is dragging a label
  When: the drag cursor moves over a hotspot
  Then: that hotspot's SVG shape shows blue fill and solid blue stroke; other hotspots remain
        in their default dashed-stroke state; when the cursor leaves, the feedback clears

AC-15: Touch drag places labels on mobile
  Given: the item rendered on a mobile viewport with touch input
  When: the candidate touch-drags a label and releases over a hotspot
  Then: the pair is created identically to a mouse drag; qti-change fires with the pair
```

### Accessibility

```
AC-A1: Label button selection via keyboard
  Given: the item rendered in candidate mode
  When: the user Tabs to the "Mercury" label button and presses Space
  Then: the button's aria-pressed becomes true; an aria-live announcement says
        "Mercury selected. Navigate to a hotspot and press Space or Enter to place."

AC-A2: Placement completion via keyboard
  Given: "Mercury" is selected (aria-pressed=true)
  When: the user presses Tab (hotspot buttons become reachable) and Tabs to hotspot 1,
        then presses Space
  Then: "MERCURY A" is added to the response; aria-live announces "Mercury placed on hotspot 1";
        Mercury's aria-pressed returns to false; hotspot buttons return to tabindex=-1

AC-A3: Escape cancels keyboard selection
  Given: "Mercury" is keyboard-selected
  When: the user presses Escape
  Then: Mercury's aria-pressed returns to false; aria-live announces "Selection cancelled";
        no pair is created; hotspot buttons return to tabindex=-1

AC-A4: Label button description reflects placement state; its name does not change
  Given: Mercury is placed on hotspot A
  When: a screen reader reads the Mercury button
  Then: its name is "Mercury", as before it was picked up or placed; its description
        (aria-describedby) includes "Already placed on a hotspot" (or equivalent phrasing).
        The picked-up state is aria-pressed alone: neither name nor hint repeats it

AC-A5: aria-label on hotspot reflects availability and contents
  Given: hotspot 1 has Mercury placed; hotspot 2 is empty
  When: a screen reader reads hotspot 1 and hotspot 2 (accessible via keyboard when a label
        is selected)
  Then: hotspot 1 is announced as "Hotspot 1. Contains Mercury. Press Space or Enter to place label"
        (or equivalent); hotspot 2 is announced as "Hotspot 2. Available. Press Space or Enter
        to place label"

AC-A6: Keyboard instructions present in DOM
  Given: any rendered instance of the interaction
  When: the page DOM is inspected
  Then: a visually hidden element with id="graphic-gap-match-instructions" contains the full
        keyboard workflow; the outer region element references it via aria-describedby

AC-A7: aria-live region announces removals
  Given: "Mercury" is placed on hotspot A and the user clicks the ✕ button
  When: the removal completes
  Then: the aria-live region announces "Mercury removed from hotspot" (or equivalent)

AC-A8: Placed label button is disabled for assistive technology
  Given: a label has been placed (matchMax=1, already used once)
  When: a screen reader navigates to that label button
  Then: the button is announced as disabled; it does not appear in the interactive tab order
        (tabindex not 0 or button is HTML disabled)

AC-A9: Touch target size
  Given: the item rendered on a 375px viewport
  When: each label button is measured
  Then: each button has at least 44×44px touch target (height ≥ 44px, no horizontal clipping)

AC-A10: Color is not the sole state indicator
  Given: a label in placed (green) state vs. available (primary) state vs. selected (accent) state
  When: the states are compared without color (e.g., grayscale rendering or forced-colors mode)
  Then: each state remains distinguishable via button disability (placed), aria-pressed
        (selected), or visual affordance (cursor, border style)
```

### matchGroup (G-01)

```
AC-G1: Without matchGroup, any label goes on any hotspot
  Given: a graphicGapMatchInteraction whose labels and hotspots author no matchGroup
  When: the candidate holds or drags any label
  Then: every hotspot accepts it; none is aria-disabled

AC-G2: matchGroup restricts placements on both sides, by the rule validation applies
  Given: label RAIN with matchGroup="LAKE", label SUN with matchGroup="SKY LAKE",
         hotspot SKY with matchGroup="SUN", hotspot LAKE with matchGroup="RAIN"
  When: the candidate holds RAIN, then SUN
  Then: holding RAIN, SKY is aria-disabled and named "Not available due to a match group restriction.";
        placing RAIN on SKY adds nothing and keeps RAIN held; RAIN on LAKE gives "RAIN LAKE"
        holding SUN, LAKE refuses it (LAKE names only RAIN); SUN on SKY gives "SUN SKY"
  Notes: player.validateResponses() accepts exactly the pairs the UI allows (isMatchGroupCompatible)
```

### gapImg

```
AC-G3: gapImg elements are extracted and rendered as image labels
  Given: a graphicGapMatchInteraction containing gapImg children
  When: the item is extracted and rendered
  Then: each gapImg is an image button in the pool, named by its text alternative (generic name when
        it has none, never its identifier), and can be placed like a text label
```

### Edge cases

```
AC-E1: Single label and single hotspot
  Given: an item with 1 label and 1 hotspot
  When: the candidate places the label on the hotspot and submits
  Then: the response contains one pair; SCORE=1.0 (assuming map_response, mappedValue=1);
        the label pool shows the label in placed state

AC-E2: More labels than hotspots (distractors)
  Given: an item with 6 labels and 3 hotspots; 3 labels are correct, 3 are distractors
  When: the candidate places 3 correct labels and submits
  Then: SCORE=3.0; the 3 unused distractor labels remain in available state in the pool

AC-E3: No imageData
  Given: a graphicGapMatchInteraction with no <object> child (no background image)
  When: the item is extracted and rendered
  Then: the extractor emits a warning "graphicGapMatchInteraction has no background image";
        the component renders the label pool and an empty stage area; no crash

AC-E4: No prompt element
  Given: a graphicGapMatchInteraction with no <prompt> child
  When: the item renders
  Then: no prompt area is rendered above the label pool; no layout gap or empty container appears

AC-E5: SVG background image
  Given: a graphicGapMatchInteraction whose <object> has type="image/svg+xml"
  When: the item renders
  Then: the inline SVG is injected into the stage via {@html}; the SVG fills the declared
        width × height; the hotspot overlay SVG is positioned above it

AC-E6: rect hotspot coordinate parsing
  Given: an associableHotspot with shape="rect" coords="12,108,39,121"
  When: parseCoords is called
  Then: the returned rect has x=12, y=108, width=39, height=121

AC-E7: circle hotspot coordinate parsing
  Given: an associableHotspot with shape="circle" coords="100,150,25"
  When: parseCoords is called
  Then: the returned bounding box has x=75 (cx-r), y=125 (cy-r), width=50 (2r), height=50 (2r)

AC-E8: poly hotspot falls back to 40×40
  Given: an associableHotspot with shape="poly" coords="0,0,100,0,50,100"
  When: parseCoords is called
  Then: the returned rect has x=0, y=0, width=40, height=40 (first coordinate + fixed size)
  Notes: This is the documented approximation. When poly is properly supported, this AC should
         be updated: the returned rect should enclose the full polygon.

AC-E9: Response prop is null or undefined
  Given: the item rendered without a response prop
  When: the component mounts
  Then: no labels show placed state; no SVG text appears on hotspots; the interaction is fully
        functional; no error is thrown

AC-E10: Rapid successive drops on same hotspot
  Given: the candidate quickly drags label A onto hotspot 1, then immediately drags label B
         onto hotspot 1 before the first event has settled
  Then: the final response contains only one pair for hotspot 1 ("B 1"); no duplicate or
        inconsistent state results from the rapid replacement

AC-E11: maxAssociations refusal (pointer drop)
  Given: maxAssociations=1 and "RAIN LAKE" already placed
  When: the candidate drags "Sun" onto the free hotspot
  Then: the placement is refused; the response stays ["RAIN LAKE"]; the aria-live region
        announces "Association not possible: the limit of 1 is reached."

AC-E12: maxAssociations refusal (keyboard placement keeps the label held)
  Given: maxAssociations=1 and "RAIN LAKE" already placed
  When: the candidate picks up "Sun" and presses Enter on a hotspot
  Then: the placement is refused and announced; Sun stays held (aria-pressed=true) so it can
        be placed elsewhere or cancelled with Escape

AC-E13: replacement within the cap is allowed
  Given: maxAssociations=1 and "RAIN LAKE" placed
  When: the candidate drags "Sun" onto the lake
  Then: "RAIN LAKE" is replaced by "SUN LAKE" — the response still holds one pair

AC-E14: the author's data-max-selections-message wins
  Given: maxAssociations=1 and data-max-selections-message="No more than one label may be placed."
  When: a placement past the cap is refused
  Then: the aria-live region announces the author's message verbatim

AC-E15: maxAssociations=0 means unlimited
  Given: maxAssociations=0 (or the attribute absent in a QTI 2.1 item) with two labels and
         two hotspots
  When: the candidate places both labels
  Then: both placements are accepted; no refusal is announced
```

---

## Open questions

- [x] Should `maxAssociations` be extracted and enforced? (resolved 2026-11-09) Yes: it is delivered in `GraphicGapMatchInteractionData`, the component refuses and announces placements past it (author's `data-max-selections-message` wins), and the engine validates it for restored responses. An absent attribute takes the per-version spec default: 1 for QTI 2.2 and 3.0, no cap for QTI 2.1 — see Known gaps.
- [ ] Should the background image carry an accessible name (alt text)? The `<object>` element in QTI XML supports child text fallback content and an `aria-label`. The extractor currently discards anything other than the image data. Adding an `altText` field to `ImageData` and passing it to the SVG container would address this.
- [ ] For `gapImg` image labels placed on a hotspot: should the image be rendered as an SVG `<image>` element on the hotspot, or should a thumbnail badge overlay the hotspot in HTML? SVG `<image>` is simpler; HTML overlay has richer accessibility options.
- [ ] Should `poly` hotspot rendering be prioritized? It is needed for items with irregular (non-rectangular, non-circular) regions such as country shapes on maps.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.3.5 — graphicGapMatchInteraction
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md` — directedPair semantics, map_response template
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-01 (`matchGroup`, Done)
- Shared pairing rule: `packages/item-player/src/core/matchGroups.ts` (`isMatchGroupCompatible`), used through `packages/default-components/src/shared/utils/matchGroupUtils.ts`
- Component: `packages/default-components/src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte`
- Extractor: `packages/item-player/src/interactions/graphic-gap-match/extractor.ts`
- Types: `packages/item-player/src/interactions/shared/types.ts` — `GraphicGapMatchInteractionData`, `AssociableHotspot`
- Touch drag action: `@pie-qti/qti-common` — `touchDrag`
- Evals: `docs/evals/default-components/graphic-gap-match/evals.yaml`
- Sample XML (spec-standard, uses gapImg): `packages/to-pie/tests/fixtures/qti-samples/graphic-interactions/graphic_gap_match.xml`
- Sample XML (demo, uses gapText): `apps/demo/src/lib/sample-items.ts` (GRAPHIC_GAP_MATCH_SOLAR_SYSTEM)
- Adjacent PRDs: `docs/prds/interactions/match.md` (directedPair semantics, the shared `matchGroup` rule), `docs/prds/interactions/hotspot.md` (hotspot coordinate system, shape rendering)
