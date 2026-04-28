# PRD: sliderInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: sliderInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`sliderInteraction` is the QTI interaction type for selecting a numeric value by dragging (or keyboard-stepping) a thumb along a track. It binds to a response variable with `single` cardinality and `integer` or `float` baseType. Typical use cases are rating scales, percentage estimates, and number-line placements. The implementation renders an HTML `<input type="range">` with bound-labels flanking the track and a live numeric readout below it.

---

## Background and rationale

**Why a slider rather than a text input for numeric responses**: A slider forces the candidate to select from a constrained numeric range, which eliminates free-text parsing problems (invalid characters, out-of-range values, locale-specific decimal separators) and gives a visual representation of relative position within the range. The tradeoff is reduced precision for large continuous ranges — a `step=1` slider spanning 0–1000 has 1001 discrete positions, but a narrow track makes selecting a specific value like 137 difficult with touch or coarse motor control. Text input is the better choice when the exact value matters and the range is large; sliders are better when communicating approximate position or relative magnitude is the goal. Item authors should set `step` explicitly to match the pedagogical precision level.

**Why the default initial value is the midpoint**: Before any candidate interaction, the slider must display some position. The spec does not mandate a default value, but placing the thumb at `lowerBound` (0) could be misread as an active "zero" response rather than "no answer". The implementation uses the midpoint (`Math.floor((lowerBound + upperBound) / 2)`) so the thumb is visually neutral — neither at an extreme nor at zero — which reduces the chance of a candidate inadvertently submitting the initial position as their answer. This does not solve the fundamental "no response" ambiguity (see Known gaps), but it reduces false zeros in scoring.

**Why `step=0` (continuous) is not spec-valid**: The QTI spec requires `step > 0`. The underlying HTML `<input type="range">` uses `step="any"` for a continuous slider, but QTI has no such concept — every valid response must be a member of the discrete set `{lowerBound, lowerBound+step, lowerBound+2*step, …, upperBound}`. The extractor validates that `step > 0` and emits an error if not. Authoring tools that want fine-grained float selection should use a small but non-zero step (e.g. `step="0.01"` over a 0–10 range).

**Why `step` granularity matters pedagogically**: A 0–100 slider with `step=1` has 101 valid positions. On a 320px-wide mobile track, each step is ~3px apart, making precise tap-and-drag targeting unreliable. K-12 assessment guidance recommends that each valid step occupy at least 8–10px on a typical mobile screen. For a 320px track, that limits effective steps to roughly 32–40 distinct positions, suggesting `step=3` or `step=5` for a 0–100 range. Authors who leave `step=1` on wide ranges will get a technically valid item that is difficult to score precisely on mobile; the extractor emits a warning when range/step > 40 to surface this.

**Why `mapResponse` scoring is the natural fit**: Unlike choice interactions where correct responses are identifiers, slider responses are numbers. Exact-match scoring (`match_correct`) is appropriate only when there is a single numerically exact answer (e.g. a formula evaluates to exactly 3.14). More commonly, sliders are used for estimation tasks where nearby values deserve partial credit. `mapResponse` with a `<mapping>` block allows the item author to award full credit for the exact value and partial credit for near-miss values, with `defaultValue="0"` catching all other positions. The reference sample item (`docs/evals/default-components/slider/evals.yaml`) demonstrates this pattern: exact value 75 earns 3.0, adjacent values 74/76 earn 2.5, and all others earn 0.0.

**Why the component is a web component with shadow DOM**: Same rationale as all default components — shadow DOM provides style encapsulation so host-page CSS cannot leak into or override assessment content. The `::part()` API exposes `root`, `prompt`, `track`, `min`, `max`, `input`, `value`, `value-number` for intentional host customisation. See `docs/prds/architecture/web-components.md`.

**Why scorer-role display is read-only**: When `role="scorer"`, the component substitutes `correctResponse` for the candidate's response and disables the input. This allows side-by-side review of what was answered vs. what was correct without letting a scorer accidentally change the recorded response.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place)  
**Spec section:** §3.4.1 sliderInteraction (`docs/QTI_techguide.md`)

### Supported attributes

| Attribute | Required | Support | Behaviour |
|-----------|----------|---------|-----------|
| `responseIdentifier` | Required | ✅ Full | Extracted as `responseId`; used in `qti-change` event payload |
| `lowerBound` | Required | ✅ Full | Numeric lower bound; default `0` if absent (extractor default, not spec default) |
| `upperBound` | Required | ✅ Full | Numeric upper bound; default `100` if absent |
| `step` | Optional | ✅ Full | Step size; default `1`. Propagated directly to `<input type="range" step>` and to the response value. Non-positive values produce an extraction error. |
| `stepLabel` | Optional | ✅ Extracted, not rendered | Extracted as a boolean flag in `SliderInteractionData`. The QTI spec says "display a label at each step interval". This is **not currently rendered** — no tick marks or step labels appear in the component. See Known gaps. |
| `orientation` | Optional | ✅ Extracted, not rendered | Extracted as `"horizontal"` or `"vertical"`. The component **always renders horizontally**. Vertical orientation is not implemented. See Known gaps. |
| `reverse` | Optional | ✅ Extracted, not rendered | Extracted as boolean. The component **does not invert the track direction**. The `reverse` attribute is silently ignored during rendering. See Known gaps. |
| `<prompt>` child element | Optional | ✅ Full | Extracted as HTML string; rendered via `{@html}` above the track |

### Response variable contract

- **baseType:** `integer` or `float` — both are valid per spec; the component returns a JavaScript `Number`. The response processing engine treats the value as `float` unless the `responseDeclaration` declares `baseType="integer"`, in which case comparison operators apply integer semantics.
- **cardinality:** `single` (always; the spec does not permit other cardinalities)
- **Value format:** a number in the closed interval `[lowerBound, upperBound]` that is a member of the step grid
- **Null / unanswered state:** before any candidate interaction, the component holds the midpoint value internally but does **not** emit a `qti-change` event. The response variable remains `null` in the Player's variable store. If the candidate submits without touching the slider, the response is `null`, not the midpoint. See Known gaps.

### Standard response processing templates

- **`match_correct`** — awards credit when `RESPONSE` equals `correctResponse`. Appropriate for items with a single exact correct value (e.g. step=0.01, answer=3.14).
- **`map_response`** — partial credit via `<mapping>` on the `responseDeclaration`. Map keys are the numeric value as a string (e.g. `mapKey="75"`). The evaluator normalises keys via `String(value).trim()` for lookup; for `integer`/`float` baseType this means integer responses stored as `"75"` match a `mapKey="75"`. Float responses stored as `"3.14"` match `mapKey="3.14"`. There is a precision risk if float arithmetic produces `"3.1400000000000001"` — authors should use range-check response processing (`gte`/`lte` operators) for float targets instead of map keys.
- **Custom `responseCondition` with `gte`/`lte`** — preferred for float ranges (e.g. "award credit for any answer within ±0.01 of 3.14"). See the `slider-decimal-steps` sample item.

### Known gaps

None of the spec gaps (G-01 through G-15) in `docs/SPEC-GAPS-PLAN.md` directly target sliderInteraction, but the following attribute-level gaps exist in the current implementation and are tracked here for completeness:

| Gap | Attribute | Status | Impact |
|-----|-----------|--------|--------|
| Slider-A | `orientation="vertical"` | Extracted but not rendered; component always horizontal | Items authored with vertical orientation render as horizontal |
| Slider-B | `reverse="true"` | Extracted but not rendered; track direction not inverted | Items authored with reverse orientation render left-to-right |
| Slider-C | `stepLabel` | Extracted but no tick marks or step labels rendered | Step labels declared in content are silently dropped |
| Slider-D | Unanswered / null state | No "no-response" state distinguishable from the midpoint visually | Candidates may not know they must move the slider to register a response |

---

## Functional requirements

- **FR-1:** The component MUST render an `<input type="range">` with `min`, `max`, `step`, and `value` attributes matching `lowerBound`, `upperBound`, `step`, and `currentValue` from `SliderInteractionData`.
- **FR-2:** The component MUST display the `lowerBound` value to the left and `upperBound` value to the right of the slider track.
- **FR-3:** The component MUST display the currently selected numeric value in a visible readout beneath the track.
- **FR-4:** When the slider thumb is moved (mouse drag, touch drag, or keyboard), the component MUST emit a `qti-change` custom event with `detail.responseId` and `detail.value` (the new numeric value).
- **FR-5:** The `qti-change` event MUST NOT be emitted on initial render — only on candidate interaction.
- **FR-6:** The response value MUST be a number in the closed interval `[lowerBound, upperBound]`. The browser's native range input enforces this; the component must not override it.
- **FR-7:** The response value MUST be a member of the step grid `{lowerBound + n*step}`. The browser enforces this via the `step` attribute; the component must pass `step` unchanged.
- **FR-8:** The `<prompt>` child content, if present, MUST be rendered above the track and MUST support inline HTML (bold, italic, math markup passed by the item author).
- **FR-9:** When `disabled=true`, the range input MUST be non-interactive (HTML `disabled` attribute). The readout MUST remain visible.
- **FR-10:** When `role="scorer"` and `correctResponse` is non-null, the component MUST display the correct response value instead of the candidate's value, set the input to disabled, and apply a visual success indicator (green styling) to the readout.
- **FR-11:** The extractor MUST validate that `step > 0`; violations produce an extraction error.
- **FR-12:** The extractor MUST validate that `lowerBound < upperBound`; violations produce an extraction error.
- **FR-13:** The extractor MUST emit a warning when `step` does not evenly divide the range `(upperBound - lowerBound)` — this means the theoretical maximum value is not reachable by stepping from `lowerBound`.
- **FR-14:** The extractor MUST emit a warning when `(upperBound - lowerBound) / step > 40` — the step is likely too granular for reliable mobile touch interaction.

---

## Non-functional requirements

### Accessibility

WCAG 2.2 Level AA compliance is mandatory. The native `<input type="range">` provides substantial baseline accessibility but requires explicit ARIA augmentation:

- **ARIA attributes:** `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-label` MUST be present and kept in sync with the current state. The browser updates `aria-valuenow` automatically for native range inputs, but explicit attributes ensure compatibility with older assistive technology.
- **Accessible label:** The `aria-label` attribute on the input MUST describe the purpose and range. The current implementation uses `"Slider value from {lowerBound} to {upperBound}"`. When `role="scorer"`, the label also appends `". Correct answer: {value}"`.
- **Live value announcement:** When the slider value changes via keyboard, the browser announces the new `aria-valuenow` automatically through the native range input's role=slider semantics. No additional live region is required for keyboard navigation. Touch-drag changes also trigger native announcements.
- **Keyboard navigation:** The `<input type="range">` provides native keyboard support. These key bindings MUST work:
  - Arrow Right / Arrow Up: increment by one `step`
  - Arrow Left / Arrow Down: decrement by one `step`
  - Page Up: increment by a larger step (browser-defined, typically 10% of range or 10 steps)
  - Page Down: decrement by a larger step
  - Home: move to `lowerBound`
  - End: move to `upperBound`
- **Focus visibility:** The focus ring on the slider thumb MUST be visible at 2px minimum contrast. DaisyUI's `range-primary` class provides this; if DaisyUI is not loaded, the browser default outline must not be suppressed.
- **Touch target:** The slider thumb MUST meet a minimum 44×44px touch target (WCAG 2.5.5). DaisyUI's `range` class provides a large thumb; custom CSS MUST NOT reduce thumb dimensions below this floor.
- **Disabled state:** When `disabled=true`, the input MUST have `aria-disabled="true"` (or the native `disabled` attribute, which implies it). The readout value MUST remain readable.

### Performance

- No known constraints specific to this interaction. The component does not load external resources. The range input is a native browser control with minimal rendering overhead.

### Cross-platform

- **Desktop:** Mouse-drag and click-to-position on track must work.
- **Mobile (touch):** Touch-drag on the thumb must work. The thumb must be large enough to drag without accidental adjacent-element taps. Minimum 44×44px touch target applies.
- **Vertical orientation (when implemented):** Must support both horizontal-drag and vertical swipe gestures.

### Security

- The `prompt` content is rendered via `{@html}`. It MUST be sanitized upstream by the item player's HTML sanitizer before reaching the component. The component itself does not sanitize.

### i18n

- **`interactions.slider.statTitle`** i18n key labels the readout ("Selected Value"). This MUST be translated in all supported locales.
- Numeric values are displayed as-is (no locale number formatting). If the assessment locale uses a comma decimal separator, numeric readouts may appear inconsistent with locale expectations. This is a known limitation; no fix is planned for the current release.
- RTL locales: horizontal track direction for RTL languages has not been tested. The CSS `flex-direction` and the browser's native range input behaviour under `dir="rtl"` should be verified before enabling RTL support.

---

## Design decisions

### Initial value at midpoint, not at lowerBound

**Decision:** Before any candidate interaction, `currentValue` is `Math.floor((lowerBound + upperBound) / 2)`.  
**Rationale:** Placing the initial thumb at `lowerBound` (typically 0) risks a candidate submitting a 0 response without intending it. Placing at midpoint is visually neutral and does not bias toward either end. This does not fully solve the "no response" problem (see Known gaps, Slider-D), but reduces accidental zero submissions.  
**Alternatives considered:** (a) Displaying no thumb / empty state — not possible with native `<input type="range">` without hiding the element, which breaks keyboard navigation; (b) `lowerBound` as default — increases false-zero submissions; (c) requiring the author to declare a `defaultValue` in the `responseDeclaration` — not universally done in existing content.  
**Consequences:** Candidates who have not touched the slider but submit will have `response=null` (the response variable stays null until a `qti-change` event fires), but the visual display shows the midpoint. This visual/state mismatch is the central unresolved tension of this interaction.

### Null response until first interaction

**Decision:** The Player's response variable for the slider remains `null` until the candidate first moves the slider and a `qti-change` event fires. The component renders the midpoint visually but does not emit an initial-value event.  
**Rationale:** Emitting a `qti-change` on mount would silently pre-fill the response with the midpoint, making it impossible to distinguish "candidate chose the midpoint" from "candidate never touched the slider". Keeping the variable `null` allows response processing to handle the unanswered case explicitly (e.g. `isNull` branch in `responseCondition`).  
**Alternatives considered:** Emitting an event on mount — rejected because it conflates "no interaction" with "selected midpoint".  
**Consequences:** A candidate who sees the midpoint visually but submits without touching the slider will have their response processed as `null`. If the `responseProcessing` does not handle `isNull`, the scoring behaviour is undefined. Item authors using `map_response` templates MUST include an `isNull` check (as shown in the reference sample).

### `mapResponse` key lookup for numeric types

**Decision:** The `mapResponse` evaluator normalises keys with `String(value).trim()` before lookup. For `integer` baseType, a response of `75` is stored as the JavaScript number `75`, converted to `"75"` for lookup against `mapKey="75"` — this works reliably. For `float` baseType, a response of `3.14` stored as a JavaScript float may serialise to `"3.14"` or a longer decimal depending on float precision.  
**Rationale:** String key lookup is the simplest approach for `identifier`-based interactions (the common case) and happens to work for integers. Float keys are fragile.  
**Alternatives considered:** Numeric comparison with tolerance — adds complexity to the evaluator and couples it to baseType knowledge.  
**Consequences:** Item authors MUST NOT use `mapResponse` for float slider responses. Use `responseCondition` with `gte`/`lte` operators instead (see `slider-decimal-steps` sample). This constraint should be documented in authoring guidance.

### `reverse`, `orientation`, and `stepLabel` are silently ignored

**Decision:** These three attributes are extracted and stored in `SliderInteractionData` but have no effect on rendering in the current component.  
**Rationale:** Implementing vertical orientation requires CSS transforms or a custom painted slider that replaces the native range input; this sacrifices the native accessibility support that horizontal range inputs provide. `reverse` requires either CSS (`direction: rtl` on the input, which has cross-browser inconsistencies) or mirroring the value math. `stepLabel` requires a separate DOM structure for tick labels that must be pixel-aligned with step positions. None of these were prioritised for initial implementation.  
**Alternatives considered:** Using CSS `transform: rotate(90deg)` for vertical — inconsistent hit-testing and keyboard behaviour across browsers. Using `direction: rtl` for reverse — does not reliably invert the native thumb position in all browsers.  
**Consequences:** Items authored with `reverse="true"` will silently render left-to-right. Items with `orientation="vertical"` will render horizontally. Items with `stepLabel="true"` will not display tick marks. These are documented gaps (Slider-A, Slider-B, Slider-C) that must be fixed before this implementation can claim full QTI 2.2 conformance.

---

## Data model / contracts

The extractor produces `SliderData` (in `sliderExtractor.ts`), which the player maps to `SliderInteractionData` (in `packages/item-player/src/types/interactions.ts`):

```typescript
export interface SliderInteractionData extends BaseInteractionData {
  type: 'sliderInteraction';
  lowerBound: number;
  upperBound: number;
  step: number;
  orientation: string;   // 'horizontal' | 'vertical' — extracted but not rendered
  reverse: boolean;      // extracted but not rendered
  prompt: string | null; // HTML string or null
}
```

`BaseInteractionData` contributes `responseId: string` (the `responseIdentifier` attribute value).

The `stepLabel` boolean is present on `SliderData` but is intentionally omitted from `SliderInteractionData` — it is not propagated to the component because the component has no way to render it. When `stepLabel` is implemented, it must be added to `SliderInteractionData`.

The `qti-change` event payload (`createQtiChangeEvent(responseId, value)`) carries:
- `detail.responseId: string` — the response variable identifier
- `detail.value: number` — the selected numeric value

The Player stores this as the `value` on the `VariableDeclaration` for `responseId`. The base type of the declaration (`integer` or `float`) comes from the `<responseDeclaration>` in the QTI XML, not from the component.

---

## Acceptance criteria

### Functional

```
AC-1: Basic render with bounds and value
  Given: a sliderInteraction with lowerBound=0, upperBound=100, step=5
  When: the component renders
  Then: the track is visible; "0" label appears to the left; "100" label appears to the right;
        a numeric readout shows the midpoint value (50); the slider thumb is positioned at midpoint
  Notes: midpoint = Math.floor((0 + 100) / 2) = 50

AC-2: Prompt is rendered
  Given: a sliderInteraction with a <prompt>Rate your confidence</prompt>
  When: the component renders
  Then: the text "Rate your confidence" appears above the slider track

AC-3: Moving the slider updates the readout
  Given: a rendered slider (0–100, step=1)
  When: the candidate drags the thumb to position 73
  Then: the numeric readout immediately shows "73"

AC-4: Moving the slider emits qti-change
  Given: a rendered slider with responseIdentifier="RESPONSE"
  When: the candidate moves the slider to value 73
  Then: a qti-change event fires with detail.responseId="RESPONSE" and detail.value=73

AC-5: No event on initial render
  Given: a rendered slider
  When: the component mounts (no candidate interaction)
  Then: no qti-change event has fired; the response variable in the player is null

AC-6: Response variable is null before interaction
  Given: a Player with a slider item; no candidate interaction
  When: response processing runs
  Then: the RESPONSE variable is null; the isNull branch in responseCondition triggers

AC-7: Exact correct value earns full score (map_response)
  Given: the reference slider item (0–100, step=1, correct=75, mapping: 75→3.0)
  When: the candidate sets slider to 75 and submits
  Then: RESPONSE=75; SCORE=3.0; MAXSCORE=3.0

AC-8: Near-miss earns partial credit (map_response)
  Given: the reference slider item (mapping: 74→2.5, 76→2.5)
  When: the candidate sets slider to 74 and submits
  Then: RESPONSE=74; SCORE=2.5

AC-9: Far-off value earns zero (map_response defaultValue=0)
  Given: the reference slider item
  When: the candidate sets slider to 50 and submits
  Then: RESPONSE=50; SCORE=0.0

AC-10: Disabled state
  Given: a slider with disabled=true
  When: the component renders
  Then: the range input has the disabled attribute; the thumb is not draggable; the readout remains visible

AC-11: Step constraint is enforced by browser
  Given: a slider with lowerBound=0, upperBound=10, step=2
  When: the candidate attempts to position the thumb at value 3 (between steps)
  Then: the browser snaps to the nearest valid step (2 or 4); the emitted value is 2 or 4, not 3

AC-12: Negative range renders correctly
  Given: a slider with lowerBound=-50, upperBound=10, step=1
  When: the component renders
  Then: "-50" appears as the left label; "10" as the right label; midpoint is shown as -20

AC-13: Decimal step
  Given: a slider with lowerBound=0, upperBound=10, step=0.01
  When: the candidate moves to a position representing 3.14
  Then: RESPONSE=3.14 (or nearest step value); qti-change fires with value 3.14

AC-14: Scorer role shows correct response
  Given: a slider with role="scorer", correctResponse=75
  When: the component renders
  Then: the readout shows 75; the readout has green/success styling; the input is disabled

AC-15: Scorer role does not show candidate's response
  Given: a slider with role="scorer", correctResponse=75, candidate's response=40
  When: the component renders
  Then: the readout shows 75, not 40
```

### Keyboard navigation

```
AC-K1: Arrow Right increments by one step
  Given: a slider (0–100, step=5) with current value 50; the input has focus
  When: the candidate presses Arrow Right
  Then: value becomes 55; readout shows 55; qti-change fires with value=55

AC-K2: Arrow Left decrements by one step
  Given: a slider (0–100, step=5) with current value 50; input has focus
  When: the candidate presses Arrow Left
  Then: value becomes 45

AC-K3: Arrow Right at upperBound does not exceed bound
  Given: a slider with current value=100 (upperBound); input has focus
  When: the candidate presses Arrow Right
  Then: value stays 100; no qti-change event fires (or fires with 100)

AC-K4: Arrow Left at lowerBound does not go below bound
  Given: a slider with current value=0 (lowerBound); input has focus
  When: the candidate presses Arrow Left
  Then: value stays 0

AC-K5: Home key moves to lowerBound
  Given: a slider with current value=50; input has focus
  When: the candidate presses Home
  Then: value becomes lowerBound; qti-change fires

AC-K6: End key moves to upperBound
  Given: a slider with current value=50; input has focus
  When: the candidate presses End
  Then: value becomes upperBound; qti-change fires

AC-K7: Slider is keyboard-reachable via Tab
  Given: a rendered slider item with no other focusable elements before it
  When: the candidate presses Tab from the page start
  Then: focus lands on the slider thumb (visible focus ring appears)
```

### Accessibility

```
AC-A1: ARIA label is present
  Given: a slider with lowerBound=0, upperBound=100
  When: the component renders
  Then: the input has aria-label containing "0" and "100"

AC-A2: ARIA value attributes are correct
  Given: a slider at value 50 (midpoint)
  When: the component renders
  Then: aria-valuemin=0; aria-valuemax=100; aria-valuenow=50

AC-A3: ARIA valuenow updates on change
  Given: a slider at value 50; input has focus
  When: the candidate presses Arrow Right (step=1)
  Then: aria-valuenow=51

AC-A4: Screen reader announces new value on keyboard change
  Given: a slider with focus; using a screen reader (NVDA+Chrome or VoiceOver+Safari)
  When: the candidate presses Arrow Right
  Then: the screen reader announces the new value (e.g. "51") within 500ms
  Notes: this is a function of the native range input role=slider announcement; verify in both NVDA/Chrome and VoiceOver/Safari

AC-A5: Scorer-mode aria-label includes correct answer
  Given: a slider with role="scorer", correctResponse=75
  When: the component renders
  Then: aria-label contains "Correct answer: 75" or equivalent text

AC-A6: Disabled slider is accessible
  Given: a slider with disabled=true
  When: a screen reader reads the input
  Then: the input is announced as disabled (or dimmed/unavailable depending on AT)

AC-A7: Touch target meets minimum size
  Given: a slider rendered in a 320px-wide viewport
  When: the thumb is measured
  Then: the thumb's clickable/tappable area is at least 44×44px
```

### Edge cases

```
AC-E1: lowerBound and upperBound are equal — validation error
  Given: a sliderInteraction with lowerBound=50, upperBound=50
  When: the extractor validates
  Then: an extraction error is emitted: "lowerBound must be less than upperBound"

AC-E2: step=0 — validation error
  Given: a sliderInteraction with step=0
  When: the extractor validates
  Then: an extraction error is emitted: "step must be greater than 0"

AC-E3: step larger than range — validation warning
  Given: a sliderInteraction with lowerBound=0, upperBound=10, step=20
  When: the extractor validates
  Then: a warning is emitted (step larger than range); no error; component renders with a single snap position at lowerBound

AC-E4: step does not evenly divide range — validation warning
  Given: a sliderInteraction with lowerBound=0, upperBound=10, step=3
  When: the extractor validates
  Then: a warning is emitted (step does not evenly divide range); component renders with steps 0, 3, 6, 9 (upperBound 10 is not reachable)

AC-E5: reverse="true" silently ignored
  Given: a sliderInteraction with reverse="true", lowerBound=0, upperBound=10
  When: the component renders
  Then: the track renders left-to-right (lowerBound on left); no error is thrown; the functional behaviour is correct (values still in [0,10])
  Notes: this is a known gap (Slider-B); document in test as expected failure until implemented

AC-E6: orientation="vertical" silently ignored
  Given: a sliderInteraction with orientation="vertical"
  When: the component renders
  Then: the track renders horizontally; no error is thrown
  Notes: known gap Slider-A

AC-E7: No prompt
  Given: a sliderInteraction with no <prompt> child
  When: the component renders
  Then: no prompt element is rendered; the track and labels still render correctly

AC-E8: Large range with step=1
  Given: a sliderInteraction with lowerBound=0, upperBound=1000000, step=1
  When: the extractor validates and the component renders
  Then: a warning is emitted (range/step > 40); the component renders without crashing; the slider is functional but imprecise

AC-E9: Float baseType with decimal step — range-check scoring
  Given: a slider with baseType="float", lowerBound=0, upperBound=10, step=0.01; response processing uses gte/lte operators for ±0.01 tolerance around 3.14
  When: the candidate sets slider to 3.14 and submits
  Then: RESPONSE=3.14; SCORE=1.0

AC-E10: mapResponse with float values — string key precision risk
  Given: a slider with baseType="float", mapKey="3.14"
  When: the candidate sets slider to a position that produces a float slightly different from 3.14 (e.g. 3.1400000001)
  Then: the map lookup misses; SCORE falls back to mapping defaultValue
  Notes: this documents the known float precision risk; item authors should use gte/lte instead of mapResponse for float sliders
```

---

## Open questions

- [ ] **Null state UI**: Should the component visually distinguish "unset" (null) from "set to midpoint"? Options: greyed-out thumb before first interaction; explicit "move to answer" instruction; auto-submission of midpoint on first focus. No decision has been made.
- [ ] **stepLabel rendering**: When `stepLabel="true"` is implemented, how should tick labels be spaced on mobile when there are 20+ steps? Absolute positioning above/below the track vs. custom datalist element vs. SVG overlay. The `<datalist>` approach (linking via `list` attribute on the range input) provides native accessibility but limited styling control.
- [ ] **Vertical orientation accessibility**: A CSS `rotate(90deg)` approach changes the keyboard axis (up/down arrows would then match visual direction, but the native range input would still map left/right to the value axis). A custom painted slider would be needed for correct vertical keyboard semantics.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.4.1
- Response tracking and scoring: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Component implementation: `packages/default-components/src/plugins/slider/SliderInteraction.svelte`
- Extractor: `packages/item-player/src/extraction/extractors/sliderExtractor.ts`
- Types: `packages/item-player/src/types/interactions.ts` (`SliderInteractionData`)
- Eval scenarios: `docs/evals/default-components/slider/evals.yaml`
- Sample items (main): `apps/demo/src/lib/sample-items.ts` (`SLIDER_INTERACTION`)
- Sample items (edge cases): `apps/demo/src/lib/sample-items-edge-cases.ts` (`SLIDER_NEGATIVE_RANGE`, `SLIDER_DECIMAL_STEPS`, `SLIDER_LARGE_RANGE`, `SLIDER_REVERSE_RANGE`)
- Accessibility fixture: `apps/demo/src/lib/a11y/fixtures/SliderInteractionFixture.svelte`
- Extractor tests: `packages/item-player/tests/extraction/extractors/sliderExtractor.test.ts`
- Adjacent PRDs: `docs/prds/interactions/choice.md` (web component rationale); `docs/prds/architecture/web-components.md` (shadow DOM, `::part()`)
