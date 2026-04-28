# PRD: drawingInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: drawingInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor, drawing utilities)  
**Last reviewed:** 2026-04-28

---

## Summary

`drawingInteraction` provides a freehand drawing canvas on which candidates sketch a response. A background image (raster or inline SVG) is optionally placed beneath the canvas layer; the candidate draws on top of it. The response is a `single`-cardinality `file`-baseType variable — specifically, a PNG image serialized as a base64 data URL wrapped in a `QTIFileResponse` object. Scoring is always human (or human-assisted): there is no automatic scoring template that can compare two image files. The interaction is used in K-12 assessments for tasks such as annotating a diagram, illustrating a concept, or completing a partially-drawn figure.

The component (`pie-qti-drawing`) delegates all canvas logic to the shared `DrawingCanvas` component, which uses the browser's native `<canvas>` API via pointer events. No third-party canvas library is used.

---

## Background and rationale

### Why `file` baseType and human scoring

The QTI `file` baseType stores a binary file reference. For `drawingInteraction`, the file is the canvas raster output. There is no scoring template defined in the QTI spec (nor in the response processing engine) for comparing two images — pixel-level comparison is brittle (brush stroke order, anti-aliasing, background colour differences) and semantic comparison (does this diagram show the water cycle correctly?) requires human judgement. The framework therefore treats any `drawingInteraction` response variable as human-scored: the engine captures the file, marks `completionStatus` as completed when a response exists, but does not compute a `SCORE` outcome automatically.

The `drawingUtils` module (`packages/item-player/src/utils/drawingUtils.ts`) provides a helper (`analyzeDrawing`) that can determine whether the canvas contains any non-white pixels — useful for a host system that wants to flag blank submissions before sending to a human reviewer. This is an extension point, not part of the core response processing pipeline.

### Canvas rendering: no library dependency

The implementation uses only `HTMLCanvasElement` and `CanvasRenderingContext2D`, both standard browser APIs. This avoids a third-party canvas library dependency (Fabric.js, Konva, etc.) and the associated bundle size, version management, and potential security surface. The trade-off is a minimal drawing tool set: the current implementation provides a single fixed-stroke pen and a clear button. Undo, eraser, and colour selection are defined in the i18n key set (`undo`, `redo`, `strokeColor`, `strokeWidth`, `tool`) but **are not implemented in the component**. See Known gaps.

### Background image as `<object>` child

The QTI spec defines the background using an `<object>` child element on `drawingInteraction`. Two variants are supported: an external raster image reference (`data` attribute) and an inline SVG (`type="image/svg+xml"` with SVG markup as body content). The background is placed in the DOM as an absolutely-positioned layer beneath the transparent canvas. This is purely decorative — the candidate draws over it but the background is not part of the serialized response. The canvas output (PNG) includes only the candidate's strokes, not the background image composited with them. If a test delivery system needs the composite image, it must blend the background and the canvas PNG in a post-processing step.

### Serialization: PNG data URL

On each `pointerup` event, the canvas is serialized to a PNG data URL via `canvas.toDataURL('image/png')` and wrapped in a `QTIFileResponse` object:

```typescript
{
  name: `drawing-${responseId}.png`,
  type: 'image/png',
  size: <estimated byte size>,
  lastModified: <Date.now()>,
  dataUrl: 'data:image/png;base64,...',
  imageData?: { data: Uint8ClampedArray, width: number, height: number }
}
```

The `imageData` field is an optional performance extension: it carries the raw RGBA pixel data extracted synchronously from the canvas via `ctx.getImageData()`. It allows server-side or response-processing custom operators to analyze the drawing content without decoding the base64 data URL asynchronously. This field is not part of the QTI spec; it is an implementation extension.

The `QTIFileResponse` object is stored in the item's response variable. The Player preserves file-type response objects directly without base-type coercion (see `Player.coerceToDeclarationValue` at the `baseType === 'file'` branch).

### Accessibility: freehand drawing is inherently inaccessible for motor-impaired users

This is the most significant design constraint, and it cannot be resolved at the component level.

Freehand drawing requires continuous pointer input (mouse drag or touch). There is no keyboard equivalent for drawing a shape — no standard ARIA pattern, no keyboard navigation that replaces the spatial, motor-continuous nature of freehand mark-making. WCAG 2.2 SC 2.1.1 (Keyboard) requires that all functionality be operable by keyboard, but the spec also recognises that "activities requiring path-dependent input" are exempt (WCAG note 1 to SC 2.1.1). Freehand drawing qualifies for this exemption.

The component documents this limitation explicitly and provides the following mitigation layer:

- The canvas has `aria-label` (via i18n key `interactions.drawing.canvas`) and `aria-describedby` pointing to an instruction paragraph.
- An `aria-live="polite"` region announces state changes ("Drawing updated.", "Drawing cleared.") so screen-reader users know when the response changes.
- The Clear button is a standard `<button>` element, keyboard-operable, and announced by assistive technology.
- The canvas uses `touch-action: none` to prevent the browser's default scroll/pan gesture from interfering with touch drawing on mobile.

Item authors who need to accommodate motor-impaired candidates for content that tests drawing skills must provide an alternative form of the task (e.g., an `uploadInteraction` that accepts a scanned hand-drawing, or a structured `hotspotInteraction` that approximates the drawing task). This is an item-authoring concern, not a player concern, but it should be documented in assessment design guidelines.

### Touch drawing on mobile

The component uses `PointerEvent` (not `MouseEvent` or `TouchEvent`) for input handling. `PointerEvent` is a unified abstraction that handles mouse, stylus, and touch inputs through the same event handlers. `canvas.setPointerCapture(e.pointerId)` on `pointerdown` ensures that `pointermove` events continue to be delivered to the canvas even when the pointer leaves the canvas bounds mid-stroke, preventing stroke discontinuities on fast touches.

The canvas is sized in physical pixels (width/height attributes set to integer values derived from `imageData.width/height` or defaults of 600×400). A `style` container positions it at a CSS size matching the physical pixel size at 1× density. On high-DPI (Retina) displays, the canvas may appear slightly blurry because the CSS size and the canvas buffer size are equal — the canvas is not scaled up for device pixel ratio. This is a known limitation.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary)  
**Spec section:** §3.4.3 drawingInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `drawingInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used in `qti-change` event and as the PNG filename prefix |

### Vendor extension attributes (non-spec, `data-*`)

These attributes are not part of the QTI specification. They are read from `rawAttributes` to allow item authors to configure the drawing tool without extending the spec XML schema:

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-stroke-color` | `#111827` | Initial CSS colour string for the drawing stroke |
| `data-line-width` | `3` | Stroke width in canvas units (pixels at 1× DPI) |
| `data-line-cap` | `round` | Canvas `lineCap` value: `butt`, `round`, or `square` |
| `data-line-join` | `round` | Canvas `lineJoin` value: `bevel`, `round`, or `miter` |

These attributes enable authoring-time configuration of minimal drawing properties without requiring a full tool palette implementation.

### `<object>` child element (background image)

The extractor reads the first `<object>` child of `drawingInteraction` and extracts:

| `<object>` attribute | Extracted to | Notes |
|---------------------|--------------|-------|
| `type` | used to discriminate SVG vs. raster | `image/svg+xml` → inline SVG; any other image MIME → raster |
| `data` | `imageData.src` | External URL for raster images |
| `width` | `imageData.width` | Canvas width (string); defaults to 600 if absent |
| `height` | `imageData.height` | Canvas height (string); defaults to 400 if absent |
| body content | `imageData.content` | Inline SVG markup when `type` starts with `image/svg` |

A `drawingInteraction` without an `<object>` child is valid per spec. The extractor issues a warning ("drawingInteraction has no background image — students will draw on a blank canvas") but not an error.

### `<prompt>` child element

`<prompt>` is extracted as HTML content and rendered above the canvas. Optional.

### Response variable contract

- **baseType:** `file`
- **cardinality:** `single`
- **Value type:** `QTIFileResponse` object (not serializable to a plain QTI `file` URI; see Data model)
- **Null state:** When the candidate has not yet drawn anything (or has cleared the canvas), the response variable is `null`. `completionStatus` does not advance to `completed` until a non-null drawing is committed.

### Standard response processing templates

None apply. `drawingInteraction` items should omit `responseProcessing` or use `responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/no_response_processing"`. Any `SCORE` outcome must be set by a human scorer or an external automated scoring service after the candidate submits.

### Known gaps

- **No undo/redo.** The i18n locale files define `interactions.drawing.undo` and `interactions.drawing.redo` keys, indicating these were planned. Neither is implemented in `DrawingCanvas.svelte`. The canvas has no history stack. A candidate who makes an errant stroke must use the Clear button to start over.
- **No eraser tool.** The component exposes only a pen stroke. The i18n key `interactions.drawing.tool` suggests a tool-selection API was anticipated. No eraser mode is implemented; there is no way to partially remove a stroke.
- **No colour picker UI.** `data-stroke-color` sets a fixed colour at authoring time. There is no runtime colour-picker control for the candidate.
- **Canvas not DPI-aware.** The canvas buffer size equals the logical pixel size from `imageData.width/height`. On high-DPI displays, the rendered image is upscaled by CSS and may appear blurry. Fix: multiply canvas `width`/`height` attributes by `window.devicePixelRatio` and scale the context accordingly, then set the CSS size to the logical dimensions.
- **Background not composited into response.** The PNG exported from the canvas contains only the candidate's strokes on a transparent background. If the delivery system needs a composite image (background + strokes), it must blend them externally.
- **No `minChoices`/`maxChoices` concept.** Drawing is always a single continuous response. No spec attribute constrains stroke count or interaction count for this interaction type.

---

## Functional requirements

- **FR-1:** Render a `<canvas>` element whose pixel dimensions (`width`/`height` attributes) are derived from the background `<object>` element's `width` and `height` attributes, defaulting to 600×400 when absent.
- **FR-2:** When `imageData.type === 'image'`, render a raster `<img>` absolutely positioned beneath the canvas, filling the canvas area, with `pointer-events: none` and `aria-hidden="true"`.
- **FR-3:** When `imageData.type === 'svg'`, render the inline SVG markup absolutely beneath the canvas using `{@html}`, with `pointer-events: none` and `aria-hidden="true"`.
- **FR-4:** When the candidate performs a pointer-down + pointer-move gesture on the canvas, draw a continuous stroke from the initial pointer-down point through all subsequent pointer-move points until pointer-up, using the configured `strokeColor`, `lineWidth`, `lineCap`, and `lineJoin`.
- **FR-5:** On `pointerup` (or `pointercancel`), serialize the canvas to a PNG data URL and emit a `qti-change` event with the resulting `QTIFileResponse` as the value.
- **FR-6:** The "Clear" button (`interactions.drawing.clear` i18n label) must, when activated, call `ctx.clearRect()` over the full canvas, set the response to `null`, and emit a `qti-change` event with `value: null`.
- **FR-7:** When `disabled=true`, the canvas must not respond to pointer events; the cursor must indicate `not-allowed`; the Clear button must be disabled. No `qti-change` event may fire while disabled.
- **FR-8:** When a non-null `response` prop is passed on mount (session restore), display the filename and size of the prior response below the canvas. Do not re-render the prior PNG back onto the canvas (the canvas will be blank on restore; only the metadata is shown).
- **FR-9:** When `parsedInteraction` is null or cannot be parsed, render an error message instead of a broken layout.
- **FR-10:** Render the `prompt` HTML content above the canvas when the `prompt` field is non-null.
- **FR-11:** On each pointer-down, call `canvas.setPointerCapture(e.pointerId)` to retain pointer events during fast, out-of-bounds strokes.
- **FR-12:** The `qti-change` event must bubble and be `composed: true` so it crosses the shadow DOM boundary.

---

## Non-functional requirements

### Accessibility

`drawingInteraction` is partially inaccessible by design (see Background and rationale). The following requirements define the accessible baseline that is achievable:

- **WCAG 2.2 SC 1.1.1 (Non-text content):** The background image must have `aria-hidden="true"` (it is decorative relative to the canvas interaction). The canvas itself must have a meaningful `aria-label` (e.g. "Drawing canvas") and an `aria-describedby` pointing to the instruction text.
- **WCAG 2.2 SC 2.1.1 (Keyboard) — partial exemption:** Freehand drawing is exempt from keyboard operability per WCAG note 1 (path-dependent input). The Clear button must be fully keyboard-operable. The canvas `tabindex` should be set so it can receive focus and announce its description to assistive technology, but keyboard users cannot produce strokes.
- **WCAG 2.2 SC 2.4.7 (Focus visible):** The canvas and the Clear button must have visible focus indicators.
- **WCAG 2.2 SC 4.1.3 (Status messages):** The `aria-live="polite"` region must announce "Drawing updated." after each committed stroke and "Drawing cleared." after the Clear action.
- **Documented limitation for item authors:** Items using `drawingInteraction` for scored tasks MUST provide an alternative assessment path for candidates with motor impairments. This is an item-authoring requirement, not a player requirement, but assessment designers must be informed.

### Performance

- Stroke rendering must be synchronous and frame-rate-continuous. The `pointerMove` handler draws directly to the 2D context on each event; there is no batching or debouncing. This is the correct approach for low-latency drawing.
- `canvas.toDataURL('image/png')` is called once per `pointerup`, not on every `pointerMove`. For a 600×400 canvas, this takes < 5 ms in Chrome on modern hardware. For larger canvases (> 1200×900), this may take 10–30 ms; the response commit is still synchronous and may cause a brief stutter on low-end mobile devices.
- `ctx.getImageData()` for the `imageData` extension field is called once per `pointerup`. For large canvases, this is also potentially slow. If performance profiling reveals issues, this call should be deferred to a `requestIdleCallback` (but then the `imageData` will not be synchronously available in the response object immediately after `pointerup`).

### Cross-platform

- Touch drawing (finger or stylus) on iOS Safari, Android Chrome, and iPadOS must work. The `PointerEvent` + `touch-action: none` approach is the correct solution.
- The canvas container must not scroll the page when the candidate draws near the edges. `touch-action: none` on the canvas prevents the browser's scroll gesture from being triggered by pointer events that begin on the canvas.
- The global `:global(canvas) { pointer-events: auto !important }` rule in `DrawingInteraction.svelte` is required because some DaisyUI theme styles apply `pointer-events: none` to canvas elements.

### Security

- The background image `src` URL is rendered into an `<img>` element directly. URLs must be validated and sanitized by the item player before reaching the component. SVG-as-image is safe in an `<img>` tag (scripts in SVG are blocked). When `imageData.type === 'svg'`, the content is rendered via `{@html}`, which can execute inline scripts. The item player's HTML sanitizer must strip `<script>`, `on*` attributes, and `javascript:` hrefs from SVG content before it reaches this component.
- The `QTIFileResponse.dataUrl` is a large base64 string. Care must be taken in the host system when storing or transmitting it — the uncompressed PNG of a 600×400 canvas with strokes is typically 10–50 KB base64-encoded.

### i18n

| Key | Default (en-US) | Notes |
|-----|-----------------|-------|
| `interactions.drawing.clear` | `"Clear drawing"` | Clear button label |
| `interactions.drawing.instructions` | `"Draw with your mouse or touch. Use the Clear button to reset."` | Instruction text; referenced by `aria-describedby` |
| `interactions.drawing.canvas` | `"Drawing canvas"` | Canvas `aria-label` |
| `interactions.drawing.updated` | `"Drawing updated."` | Live region announcement after stroke |
| `interactions.drawing.cleared` | `"Drawing cleared."` | Live region announcement after clear |
| `interactions.drawing.generated` | `"Generated:"` | Label prefix for the committed-response filename display |

Keys `interactions.drawing.undo`, `interactions.drawing.redo`, `interactions.drawing.strokeColor`, `interactions.drawing.strokeWidth`, and `interactions.drawing.tool` are defined in locale files but are not currently consumed by any component. They are reserved for a future drawing toolbar.

---

## Design decisions

### No third-party canvas library

**Decision:** Use only the native `HTMLCanvasElement` and `CanvasRenderingContext2D` APIs.  
**Rationale:** The drawing requirement for K-12 assessment is a simple pen-on-canvas interaction. A library like Fabric.js or Konva would add 150–300 KB to the bundle for features (object-level selection, vector shapes, export formats) that are not needed. The native Canvas 2D API is sufficient, well-supported, and has no upgrade or security risk.  
**Alternatives considered:** Fabric.js (large bundle, object model overkill); Konva (similar concerns); SVG-based drawing (no rasterization without canvas anyway). All rejected.  
**Consequences:** Implementing undo/redo or an eraser tool requires building a canvas history stack manually. This is non-trivial but achievable. See Known gaps.

### PNG as the serialization format

**Decision:** Canvas output is serialized as `image/png` via `canvas.toDataURL('image/png')`.  
**Rationale:** PNG is lossless and handles transparency correctly (the candidate's strokes on a transparent background). JPEG would introduce compression artefacts on sparse strokes. SVG is not suitable because the canvas 2D API does not directly produce SVG path data — the canvas is a raster surface.  
**Alternatives considered:** JPEG (lossy, inappropriate for line art); WebP (better compression but not universally decodable by older scoring systems); direct SVG path serialization (would require a parallel path-tracking data structure alongside the canvas render).  
**Consequences:** PNG files are larger than JPEG for photographic content but smaller for sparse line-art strokes, which is the expected drawing content. A 600×400 canvas with a few pen strokes compresses to approximately 5–15 KB.

### Response committed on `pointerup`, not on every `pointerMove`

**Decision:** `commitValue()` (which calls `toDataURL` and emits `qti-change`) is called only on `pointerup`.  
**Rationale:** `toDataURL` is expensive for large canvases and calling it on every `pointermove` event (which fires at screen refresh rate, 60–120 Hz) would block the main thread and make drawing laggy. Committing on `pointerup` means the response is updated once per completed stroke.  
**Alternatives considered:** Committing on a debounced `pointermove` (complex to implement correctly with pointer capture); committing on a timer (response state could be stale if the user pauses mid-stroke); committing on `pointerdown` (response is always one stroke behind).  
**Consequences:** If the candidate's device crashes mid-stroke (pointer down, no pointer up), the in-progress stroke is lost. The last committed response (from the previous `pointerup`) is preserved in the session state.

### Background not composited into the exported PNG

**Decision:** The exported PNG contains only the candidate's strokes (transparent background); the background image is not composited.  
**Rationale:** Compositing requires the background image to be loaded into the canvas via `drawImage()`. This introduces async loading concerns, potential CORS failures for external image URLs, and increases PNG file size significantly (a 600×400 background image might be 100+ KB when included in the PNG). The scoring system that receives the response can composite the known background image with the candidate's strokes if a visual representation is needed.  
**Alternatives considered:** Composite on export (requires async image load at commit time); use a single canvas layer (no layering possible without compositing).  
**Consequences:** The exported PNG, viewed in isolation, shows strokes on a transparent/white background. The human scorer must view the strokes overlaid on the background image to interpret them correctly. The delivery system is responsible for this presentation.

### Canvas dimensions from `<object>` attributes, not from rendered image size

**Decision:** Canvas `width` and `height` attributes are set from `imageData.width`/`imageData.height` (extracted from the `<object>` element in QTI XML), defaulting to 600×400.  
**Rationale:** The canvas buffer size must be determined synchronously at render time. Reading the natural dimensions of a loaded `<img>` element is async. The QTI `<object>` element's `width`/`height` attributes are the authoritative source of the background image dimensions and are always available from the extractor.  
**Alternatives considered:** Reading `img.naturalWidth` after load (async, layout-dependent); using CSS intrinsic size (unreliable before image load).  
**Consequences:** If the `<object>` element omits `width`/`height` (a validator warning is issued), the canvas defaults to 600×400, which may not match the actual background image dimensions. The background image will stretch to fill the canvas container, potentially distorting it.

---

## Data model / contracts

### `DrawingInteractionData` (from `@pie-qti/item-player`)

```typescript
// packages/item-player/src/types/interactions.ts

interface DrawingInteractionData extends BaseInteractionData {
  type: 'drawingInteraction';
  responseId: string;           // from responseIdentifier attribute
  prompt: string | null;        // HTML content of <prompt> child
  imageData: ImageData | null;  // null when no <object> child present
  rawAttributes: Record<string, string>; // all XML attributes, including data-* extensions
}

interface ImageData {
  type: 'image' | 'svg';
  src?: string;       // type='image': external image URL
  content?: string;   // type='svg': full <svg>...</svg> markup string
  width?: string;     // canvas width in px (string from XML attribute)
  height?: string;    // canvas height in px (string from XML attribute)
}
```

**Invariants enforced by extractor:**
- `responseId` is always a non-empty string (error if `responseIdentifier` attribute is absent).
- `imageData` is `null` if no `<object>` child is present (warning emitted, not error).
- If `<object>` is present, at least one of `src` or `content` is non-empty (otherwise `imageData` is `null`).

**Invariants NOT enforced:**
- `width` and `height` are raw strings (not parsed to numbers) at extraction time; the canvas component converts them via `Number()` with a fallback.
- SVG content is not sanitized by the extractor; sanitization is the item player's responsibility.

### `QTIFileResponse` (from `@pie-qti/item-player`)

```typescript
// packages/item-player/src/types/index.ts

interface QTIFileResponse {
  name: string;         // e.g. "drawing-RESPONSE.png"
  type: string;         // "image/png"
  size: number;         // estimated byte size (computed from base64 length)
  lastModified: number; // Date.now() at commit time
  dataUrl: string;      // "data:image/png;base64,..."
  imageData?: {         // optional: raw RGBA pixel data for analysis
    data: Uint8ClampedArray;
    width: number;
    height: number;
  };
}
```

The `imageData` extension field is populated synchronously from `ctx.getImageData()` at commit time. It allows custom operators or host code to call `analyzeDrawing(response)` from `@pie-qti/item-player` to determine whether the canvas contains any drawn content without decoding the data URL. The field is `undefined` if `getImageData()` throws (e.g. canvas tainted by cross-origin image).

### Component props (`pie-qti-drawing`)

| Prop | Type | Direction | Notes |
|------|------|-----------|-------|
| `interaction` | `DrawingInteractionData \| string` | in | Parsed with `parseJsonProp`; supports both web component (string) and Svelte (object) usage |
| `response` | `QTIFileResponse \| string \| null` | in/out (`$bindable`) | Current response; `null` when canvas is empty or cleared |
| `disabled` | `boolean` | in | Default `false`; prevents drawing and clears |
| `i18n` | `I18nProvider` | in | Optional; falls back to bare i18n key strings when absent |
| `typeset` | `(el: HTMLElement) => void` | in | Optional math typesetting callback |
| `onChange` | `(value: QTIFileResponse \| null) => void` | in | Callback for Svelte usage; web component usage receives `qti-change` event |

### `qti-change` event payload

```typescript
{
  type: 'qti-change',
  bubbles: true,
  composed: true,
  detail: {
    responseIdentifier: string,      // matches DrawingInteractionData.responseId
    value: QTIFileResponse | null    // null when canvas cleared
  }
}
```

---

## Acceptance criteria

### Functional

```
AC-1: Blank canvas renders when no background image is provided
  Given: a drawingInteraction with no <object> child
  When: the item renders
  Then: a 600×400 canvas is displayed with a light border; no background image is visible;
        no JavaScript exception is thrown; no error state renders (only a validator warning
        was emitted at extraction time)

AC-2: Raster background image renders beneath the canvas
  Given: a drawingInteraction whose <object> has type="image/jpeg", data="diagram.jpg",
         width="500", height="300"
  When: the item renders
  Then: the background image is visible at 500×300px; the canvas is layered above it;
        clicking on the image area and dragging draws on the canvas, not the image

AC-3: Inline SVG background renders beneath the canvas
  Given: a drawingInteraction whose <object> has type="image/svg+xml" and inline SVG content
         with width="400" and height="300"
  When: the item renders
  Then: the SVG is rendered visibly beneath the canvas at 400×300px; the canvas receives
        pointer events and the SVG does not

AC-4: Drawing a stroke commits a QTIFileResponse
  Given: the item from AC-1 (blank canvas)
  When: the candidate clicks and drags across the canvas
  Then: a qti-change event fires with a QTIFileResponse where:
        - name starts with "drawing-" and ends with ".png"
        - type === "image/png"
        - size > 0
        - dataUrl starts with "data:image/png;base64,"
        - imageData is present and has width=600, height=400

AC-5: Second stroke appends to the first (canvas is not cleared between strokes)
  Given: the item from AC-1 after one stroke has been drawn
  When: the candidate draws a second stroke in a different location
  Then: both strokes are visible on the canvas; the qti-change event fires with an updated
        QTIFileResponse that includes pixels from both strokes

AC-6: Clear button resets canvas and emits null response
  Given: the item from AC-1 with one stroke drawn
  When: the candidate clicks the Clear button
  Then: the canvas is blank; a qti-change event fires with value=null; the filename display
        below the canvas disappears; the aria-live region announces "Drawing cleared."

AC-7: Committed response metadata displays below canvas
  Given: the item from AC-1 after one stroke is drawn and committed
  When: the item renders
  Then: a line appears below the canvas showing the generated filename (e.g. "drawing-RESPONSE.png")
        and its size in bytes

AC-8: disabled=true prevents drawing and Clear
  Given: a drawingInteraction rendered with disabled=true
  When: the candidate clicks and drags on the canvas
  Then: no stroke is drawn; no qti-change event fires; the cursor shows "not-allowed"
  When: the candidate clicks the Clear button
  Then: the button is visually disabled and cannot be activated

AC-9: Pre-existing response prop shows metadata on mount
  Given: a drawingInteraction mounted with response={name: "drawing-RESPONSE.png", type: "image/png", size: 12345, ...}
  When: the item renders
  Then: the filename and size are displayed below the canvas; the canvas itself is blank
        (the prior PNG is not re-rendered onto the canvas); no qti-change event fires

AC-10: Stroke configuration from rawAttributes is applied
  Given: a drawingInteraction with rawAttributes:
         data-stroke-color="#ff0000", data-line-width="8", data-line-cap="butt", data-line-join="miter"
  When: the candidate draws a stroke
  Then: the stroke is drawn in red at 8px width with butt caps and miter joins

AC-11: Default stroke configuration when rawAttributes are absent
  Given: a drawingInteraction with no data-stroke-color, data-line-width, etc. attributes
  When: the candidate draws a stroke
  Then: the stroke uses color #111827, lineWidth 3, lineCap "round", lineJoin "round"

AC-12: Canvas dimensions from object element attributes
  Given: a drawingInteraction with <object width="800" height="600">
  When: the item renders
  Then: the canvas element has width attribute 800 and height attribute 600

AC-13: Canvas defaults to 600×400 when object dimensions are absent
  Given: a drawingInteraction with <object> that has no width or height attributes
  When: the item renders
  Then: the canvas element has width=600 and height=400

AC-14: Prompt renders above canvas
  Given: a drawingInteraction with <prompt>Label the parts of this cell.</prompt>
  When: the item renders
  Then: the prompt text "Label the parts of this cell." is visible above the canvas,
        not overlapping it

AC-15: qti-change event fires with responseIdentifier from XML
  Given: a drawingInteraction with responseIdentifier="DRAW1"
  When: the candidate completes a stroke
  Then: the qti-change event detail contains responseIdentifier="DRAW1"

AC-16: No interaction data renders error state
  Given: the component rendered with interaction=null
  When: the component renders
  Then: an error message is visible; no canvas or drawing tools are rendered;
        no JavaScript exception is thrown

AC-17: Touch drawing works on mobile
  Given: the item from AC-1 on a touch-capable device (iOS Safari or Android Chrome)
  When: the candidate uses a finger to draw on the canvas
  Then: strokes are drawn following the finger path; the page does not scroll during drawing;
        a qti-change event fires on finger-lift; the aria-live region announces "Drawing updated."

AC-18: Fast out-of-bounds stroke is clamped, not broken
  Given: the item from AC-1
  When: the candidate begins a stroke inside the canvas and quickly moves the pointer
        outside the canvas bounds before lifting
  Then: the stroke follows the pointer to the canvas boundary and stops; the pointer-up
        event (when the candidate finally releases) commits the response; no exception is thrown
  Notes: setPointerCapture ensures pointermove events continue delivering outside the canvas boundary
```

### Accessibility

```
AC-A1: Canvas has aria-label and aria-describedby
  Given: any drawingInteraction item
  When: the item renders
  Then: the <canvas> element has aria-label="Drawing canvas" (or the i18n translation);
        aria-describedby points to the ID of the instruction paragraph element

AC-A2: Instruction text is visible and associated with canvas
  Given: any drawingInteraction item
  When: the item renders
  Then: a visible instruction text paragraph exists ("Draw with your mouse or touch...")
        and its ID matches the canvas aria-describedby value

AC-A3: aria-live region announces after stroke
  Given: the item from AC-1
  When: the candidate completes a stroke
  Then: the aria-live="polite" region contains "Drawing updated." immediately after the stroke ends

AC-A4: aria-live region announces after clear
  Given: the item from AC-1 with one stroke drawn
  When: the candidate activates the Clear button
  Then: the aria-live="polite" region contains "Drawing cleared."

AC-A5: Clear button is keyboard-operable
  Given: any drawingInteraction item that has been drawn on
  When: the candidate tabs to the Clear button and presses Space or Enter
  Then: the canvas is cleared; a qti-change with value=null fires; "Drawing cleared." is announced

AC-A6: Clear button focus indicator is visible
  Given: any drawingInteraction item
  When: the candidate tabs to the Clear button
  Then: a visible focus indicator (outline or ring) is present around the button

AC-A7: Background image is hidden from assistive technology
  Given: a drawingInteraction with a raster background image
  When: the item renders
  Then: the background <img> has aria-hidden="true"; a screen reader does not announce it
        when the candidate navigates the interaction

AC-A8: Keyboard users receive an informative canvas description
  Given: any drawingInteraction item
  When: a keyboard user tabs to the canvas element
  Then: a screen reader announces the canvas label ("Drawing canvas") and reads the
        instruction text via aria-describedby; the user understands this is a drawing area
        and that freehand drawing requires a pointing device

AC-A9: disabled canvas is not in tab order for drawing
  Given: a drawingInteraction with disabled=true
  When: the candidate tabs through the interaction
  Then: the Clear button is not activatable (visually disabled); the canvas may still receive
        focus for screen reader navigation but pointer events are suppressed
```

### Edge cases

```
AC-E1: Very large canvas (authoring-time dimension > 2000px) does not crash
  Given: a drawingInteraction with <object width="2400" height="1800">
  When: the item renders
  Then: the canvas renders at 2400×1800 buffer size; drawing works; toDataURL completes
        without error (may be slow on low-end devices)
  Notes: delivery systems should cap authoring-time canvas dimensions; this AC verifies
         no crash, not performance

AC-E2: Non-numeric width/height attributes fall back to defaults
  Given: a drawingInteraction with <object width="auto" height="inherit">
  When: the item renders
  Then: Number("auto") is NaN; the canvas falls back to width=600, height=400;
        no JavaScript exception is thrown

AC-E3: Cross-origin background image does not taint canvas or crash
  Given: a drawingInteraction with a cross-origin image URL that does not send CORS headers
  When: the candidate draws a stroke and pointer-up fires commitValue()
  Then: ctx.getImageData() throws a SecurityError (canvas is tainted); the QTIFileResponse
        is emitted with imageData=undefined (not undefined dataUrl); the drawing still works;
        a console warning is issued

AC-E4: Inline SVG background with scripting content is rendered safely
  Given: SVG content that has been sanitized by the item player (scripts stripped)
  When: the component renders the SVG via {@html imageData.content}
  Then: the SVG renders visually; no inline script executes
  Notes: this AC verifies that the component trusts the upstream sanitizer; the component
         itself does not sanitize SVG content

AC-E5: Response cleared mid-session, then drawn again
  Given: a drawingInteraction where the candidate draws, clears (response=null), then draws again
  When: the second stroke is committed
  Then: the qti-change event fires with a valid QTIFileResponse containing only the second
        drawing; no pixels from the first drawing are present
```

---

## Open questions

- [ ] Should the canvas buffer scale by `window.devicePixelRatio` for Retina display quality? This would double the buffer size (and PNG file size) on Retina displays. Decision should consider the trade-off between file size and visual quality for human scorers reviewing the drawings.
- [ ] Should undo/redo be implemented? The i18n keys exist. Implementing a history stack requires saving the full `ImageData` after each stroke (each snapshot is `width × height × 4` bytes). For a 600×400 canvas this is ~960 KB per undo step. Alternative: store `pointerdown`→`pointerup` path arrays and redraw from scratch. Decide before any toolbar implementation work begins.
- [ ] Should the eraser tool be implemented as a separate mode, or via `globalCompositeOperation = 'destination-out'` on the same stroke path? The latter is simpler but may have unexpected visual interactions with the background image layer.
- [ ] Should the background image be composited into the exported PNG? This is a delivery system concern but needs a documented recommendation for scoring system integrators who receive the raw `QTIFileResponse`.
- [ ] For human-scoring workflows, should the `QTIFileResponse` include the background image URL so the scoring system can render the composite without separate context? Currently the scorer would need the original item XML to find the background.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.4.3 drawingInteraction
- Response tracking: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md` — `file` baseType handling, `Player.coerceToDeclarationValue`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — no gap item currently covers `drawingInteraction`; the undo/eraser/colour-picker gap described above is implementation-internal
- Component: `packages/default-components/src/plugins/drawing/DrawingInteraction.svelte`
- Shared canvas component: `packages/default-components/src/shared/components/DrawingCanvas.svelte`
- Extractor: `packages/item-player/src/extraction/extractors/drawingExtractor.ts`
- Drawing analysis utilities: `packages/item-player/src/utils/drawingUtils.ts` (`hasLine`, `analyzeDrawing`, `getImageDataFromResponse`)
- Types: `packages/item-player/src/types/interactions.ts` — `DrawingInteractionData`, `ImageData`; `packages/item-player/src/types/index.ts` — `QTIFileResponse`
- Adjacent PRDs: [upload.md](upload.md) (same `file` baseType response; different interaction — file picker vs. canvas); [hotspot.md](hotspot.md) (same background-image `<object>` extraction pattern)
