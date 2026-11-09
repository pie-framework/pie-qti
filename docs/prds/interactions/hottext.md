# PRD: hottextInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: hottextInteraction
  Last reviewed: 2026-11-09
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-11-09

---

## Summary

`hottextInteraction` is the QTI interaction type for inline text-selection questions. The candidate reads a passage containing marked-up `<hottext>` spans — words or phrases embedded in flowing prose — and clicks (or taps) to select them. The implementation extracts the entire passage as sanitized HTML, preserving the `<hottext>` custom elements inside it, then renders the passage in a content div where those elements are progressively enhanced with click handlers, keyboard bindings, and ARIA attributes. The response is a set of `identifier` strings, one per selected hottext span.

---

## Background and rationale

**Why hottext is fundamentally different from list-based interactions**: In `choiceInteraction`, `orderInteraction`, and `matchInteraction`, the candidate's choices are presented as a discrete list separated from the stimulus. In `hottextInteraction`, the selectable elements live inside the stimulus itself — inside flowing prose. This changes nearly every aspect of the implementation:

- The interaction element wraps the entire passage, not just a list of choices. The extractor must treat the whole element body as content HTML, not enumerate child `<simpleChoice>` elements.
- The custom `<hottext>` elements are non-standard HTML. They survive the HTML parser as unknown elements and must be discovered via `querySelectorAll('hottext')` after the content is injected into the DOM.
- Reading order must be preserved exactly as authored. There is no shuffle attribute and no reordering — the text must appear in exactly the authored sequence.
- Keyboard navigation through clickable spans embedded in paragraph text is harder to make accessible than a discrete list. With `maxChoices>1` the Tab order passes through every hottext span in document order, which can be a large number of stops in a long passage. With `maxChoices=1` the spans form one radio group: Tab stops once, on the checked span (or the first), and the arrow keys move between the spans.

**Why `maxChoices=1` produces a string response, not a one-element array**: The QTI spec defines the `hottextInteraction` response variable as `single` cardinality when `maxChoices=1` and `multiple` cardinality when `maxChoices>1`. The component encodes this: when `maxChoices=1` it emits a bare identifier string (or `null`); when `maxChoices>1` it emits an `string[]`. This mirrors how `choiceInteraction` handles the radio vs. checkbox distinction. Delivery system code that processes responses must branch on the response type; the extractor's `maxChoices` value is the canonical signal.

**Why `maxChoices=0` is not treated as "unlimited"**: Unlike `choiceInteraction`, the `hottextInteraction` spec defines `maxChoices` default as `1` (not `0`). The QTI spec states `0` means unlimited for both interaction types, but practically all real K-12 `hottextInteraction` items use a fixed positive value. The extractor defaults `maxChoices` to `1` when the attribute is absent, consistent with the spec default. The validator emits a warning when `maxChoices > hottext count`, which catches the most common authoring errors.

**Why hottext elements are not shuffled**: The QTI spec does not define a `shuffle` attribute on `hottextInteraction`. The position of each hottext span within the prose is fixed by the author's intent — rearranging them would alter the meaning of the text. This is unlike `choiceInteraction` where the choices are semantically independent options.

**Why the `fixed` attribute on `<hottext>` is not extracted**: The QTI spec defines a `fixed` attribute on `hottext` elements, analogous to `fixed` on `simpleChoice`. Its purpose is to mark spans that should not be shuffled when a hypothetical `shuffle` attribute exists on the interaction — but since `hottextInteraction` has no `shuffle`, `fixed` is meaningless in practice. It is not extracted and has no effect on rendering.

**Why content is injected as raw HTML via `{@html}`**: The passage may contain arbitrary HTML — `<em>`, `<strong>`, `<a>`, block elements, MathML, tables — along with `<hottext>` elements that are non-standard. Building a Svelte template that handles all valid QTI content structures is not tractable. Injecting the sanitized HTML string and then post-processing the DOM via `querySelectorAll` is the only practical approach. The security risk is mitigated by the item player's HTML sanitizer, which strips `<script>`, event handlers, iframes, and dangerous URL schemes before the string reaches the component. See the security PRD for the full sanitizer policy.

**Why hottext progressive enhancement happens inside a `$effect`**: The component renders `{@html parsedInteraction.contentHtml}`, which injects the passage including raw `<hottext>` elements. Svelte's reactivity does not understand custom elements inside injected HTML — only DOM APIs can reach them. The `$effect` that runs after `contentElement` is bound does the `querySelectorAll('hottext')` sweep, attaches onclick/onkeydown handlers, and sets the `role` (`radio` when `maxChoices=1`, `button` otherwise). This is a one-time setup effect; subsequent selection changes update ARIA state (`aria-checked` or `aria-pressed`), the tab order (`tabindex`, roving for the radio group) and `aria-disabled` via a separate `updateHottextStyles()` call rather than re-running the full setup.

**Why the footer count shows selected vs. total hottext count**: K-12 test candidates benefit from knowing how many spans they can still select. Showing `n / total_hottext_count` gives a clear signal: when both numbers are equal the candidate has selected everything; the "Clear answer" button retracts the whole answer in one step. The denominator uses `hottextChoices.length` (total hottext spans), not `maxChoices`, because showing `n / maxChoices` would be confusing when `maxChoices < total spans`.

**Pedagogical note**: `hottextInteraction` is most effective with 2–4 selectable spans embedded in a short passage (2–4 sentences). Longer passages with many selectable spans create cognitive fatigue and make keyboard navigation tedious. Item authors should also avoid spans that are adjacent or overlapping, since touch targets become hard to distinguish. The PRD does not enforce these guidelines programmatically but they inform the acceptance criteria.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place)  
**Spec section:** §3.2.4 hottextInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `hottextInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | Full | Extracted as `responseId`; used in `qti-change` event payload |
| `maxChoices` | Full | Enforced at selection time, and it decides the widget. With `maxChoices=1` the spans form a radio group: a new selection replaces the current one, activating the selected span again keeps it (a radio is never unchecked by activating it), and "Clear answer" retracts the answer. With `maxChoices>1` each span is a toggle button: activating a selected span deselects it, and once `selectedIds.length === maxChoices` further selections are refused until a deselection occurs. Default `1` when absent. |
| `minChoices` | Partial — extracted, not surfaced | Extracted by `standardHottextExtractor` (conditionally included in `HottextData` when `> 0`) and validated structurally. **Not present in `HottextInteractionData`** and not surfaced to the component, so no "minimum required" UI hint is shown. See Known gaps. |

### Supported attributes on `<hottext>`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | Full | Required. Used as the value stored in the response when this span is selected. Must be unique within the interaction. |
| `fixed` | Not extracted | Spec: prevents this span from being shuffled. `hottextInteraction` has no `shuffle` attribute, so `fixed` is meaningless. Not extracted; has no effect. |
| `templateIdentifier` | Full | A hidden hottext is dropped before extraction, from `hottextChoices` and `contentHtml` alike, by the shared visibility rule. |
| `showHide` | Full | Inverts `templateIdentifier` visibility. |
| CSS `class` attribute | Partial | Extracted as `classes?: string[]` in `HottextData`; not carried forward into `HottextInteractionData` or the component. |

### Response variable contract

- **baseType:** `identifier`
- **Cardinality:** `single` when `maxChoices=1`; `multiple` when `maxChoices>1`
- **Value format (single):** a bare identifier string matching one `<hottext>` element, or `null` when nothing is selected
- **Value format (multiple):** `string[]` of identifier strings in selection order (not sorted by document order), or `[]` when nothing is selected
- **Clearing:** the "Clear answer" button resets to `null` (single) or `[]` (multiple) and fires a `qti-change` event. Under single cardinality it is the only way to retract the answer: activating the selected span again keeps it.

### Standard response processing templates

- **MATCH_CORRECT** — correct when `RESPONSE` equals `correctResponse`. Used for `maxChoices=1` (single identifier match).
- **MAP_RESPONSE** — partial credit via `mapping` on the `ResponseDeclaration`. Each hottext identifier maps to a point value. Used for multi-select partial credit where some spans are worth more than others.
- Custom `responseCondition` branching is valid; the multiple-select fixture uses an exact set match (`<match>` with `multiple` cardinality).
- **`containsAll` / `isNull` operators** are commonly used with `multiple` cardinality hottext responses in custom response processing.

### Known gaps

- **`minChoices` not surfaced to the component**: `minChoices` is extracted by `standardHottextExtractor` and present in the local `HottextData` type (in the extractor file), but `HottextInteractionData` (in `packages/item-player/src/interactions/shared/types.ts`) does not include the field. The component therefore cannot render a "Select at least N" hint or gate submission. This is analogous to the `choiceInteraction` `minChoices` gap. Not tracked under a named gap item in `docs/SPEC-GAPS-PLAN.md` but consistent with the pattern described by G-06.
- **`fixed` on `<hottext>` not extracted**: As noted above, this is a deliberate no-op because `hottextInteraction` has no shuffle.
- **G-09 (PNP)**: When `pnp.cognitive.eliminationTool` is enabled, candidates should be able to dismiss non-selectable spans from consideration. Not implemented.

---

## Functional requirements

- **FR-1:** Render the interaction content HTML inside a `role="radiogroup"` container when `maxChoices=1` and a `role="group"` container otherwise; both carry the same accessible name. The `<hottext>` elements within the HTML must be keyboard-operable and mouse-clickable, and they stay inline in the running text.
- **FR-2:** When a candidate clicks or activates (Enter/Space) an unselected hottext span and the selection count is below `maxChoices`, add the span's identifier to the response and visually mark the span as selected. When `maxChoices=1` and another span is already selected, the activated span replaces it (radio group, as in `choiceInteraction`): the previous span is deselected and one `qti-change` fires with the new identifier.
- **FR-3:** Activating a selected hottext span depends on the cardinality:
  - `maxChoices=1` (radio group): activating the selected span again — click, tap, Enter or Space — is a no-op. The span stays selected and no `qti-change` fires, as with a native radio button. The candidate changes the answer by selecting another span and retracts it with "Clear answer" (FR-10).
  - `maxChoices>1` (toggle buttons): activating a selected span removes its identifier from the response and visually reverts the span to unselected, as a checkbox does. Removing a selection never exceeds the limit.
- **FR-4:** When `maxChoices>1` and the selection count equals `maxChoices`, clicking an unselected span must have no effect (the span is not selected, no event fires). The `selectable` visual cue must be removed from unselected spans in this state, and the refusal is announced: the authored `maxSelectionsMessage` (role="alert") is shown, or a localized default ("You can select up to {max}. Deselect one to choose another.") when none is authored. With `maxChoices=1` nothing is ever refused, so unselected spans keep the `selectable` cue and no default message is shown; an authored `maxSelectionsMessage` is still shown once a span is selected, as in `choiceInteraction`.
- **FR-5:** When `maxChoices=1`, the response value emitted is a bare identifier string (or `null` on clear). When `maxChoices>1`, the response value emitted is `string[]`.
- **FR-6:** On each selection change, emit a `qti-change` CustomEvent with `{ responseIdentifier, value }` from the root element. The event must bubble.
- **FR-7:** Accept a `response` prop and reflect it as the initial selection state without firing a `qti-change` event on mount.
- **FR-8:** When `disabled=true`, all hottext spans must be non-interactive (`cursor: default`, `tabindex="-1"`, `aria-disabled="true"`), and no "Clear answer" button is offered, as in `choiceInteraction`. The selection and, in the scorer view, the correct-answer marking stay visible.
- **FR-9:** When `role='scorer'` and `correctResponse` is provided, visually mark correct hottext spans with the `correct` class (green background **and** an underline, so the marker never relies on color alone) and add a hidden "Correct answer" phrase to each correct span's accessible name. Do not reveal correct answers to any other role.
- **FR-10:** Display a footer showing `selected / total_hottext_count` and a "Clear answer" button, for both cardinalities. The button appears only while at least one span is selected and the interaction is enabled. It carries the same label as `choiceInteraction`'s control for the same function (key `interactions.choice.clearAnswer`). Activating it resets the response (FR-5) and moves focus to the first hottext span, so keyboard focus never drops to the document.
- **FR-11:** Render the optional `<prompt>` HTML above the passage content when present.
- **FR-12:** When no `interaction` data is provided, render a localized error message instead of an empty div.
- **FR-13:** When `maxChoices=1`, the spans follow the WAI-ARIA APG radio group keyboard model. A roving `tabindex` makes the group one Tab stop: the checked span, or the first span when none is checked. Arrow keys move focus to the next or previous span in document order and check it, wrapping at either end. Up/Down are fixed, and Left/Right follow the inline direction, so under RTL ArrowLeft moves forward. Arrow keys held with Alt, Ctrl or Meta are left to the browser and assistive technology. Space checks the focused span, and so does Enter. When `maxChoices>1`, every span is its own Tab stop, Space and Enter toggle it, and the arrow keys are not handled.

---

## Non-functional requirements

### Accessibility

WCAG 2.2 Level AA is mandatory for all assessment interactions.

- **Keyboard operability (SC 2.1.1):** A user must be able to complete the interaction entirely by keyboard without using a mouse. With `maxChoices=1` the spans are one radio group with a roving `tabindex` (FR-13). Tab reaches the checked span, or the first span when none is checked, and leaves the group from there. The arrow keys move between the spans and check them, and Space or Enter check the focused span. With `maxChoices>1` every hottext span receives focus via Tab in document order, and Space and Enter toggle the focused span.
- **Focus visible (SC 2.4.7 / 2.4.11):** Focused hottext spans must have a visible focus indicator that meets contrast and size requirements. The browser's default `:focus` ring is not sufficient for custom elements; the implementation must explicitly style `:focus-visible` or provide a substitute.
- **Name, role, value (SC 4.1.2):** The role and state match what activation does. With `maxChoices=1` each `<hottext>` element receives `role="radio"` and `aria-checked="true/false"` inside a `role="radiogroup"` container. With `maxChoices>1` it receives `role="button"` and `aria-pressed="true/false"` inside a `role="group"` container. The two never mix: a radio is never `aria-pressed`, and a toggle button is never `aria-checked`. A toggle button that activation could not unpress would tell assistive technology that the selected span can be released by activating it again, so single selection does not use one. Each span's accessible name is its rendered content, referenced via `aria-labelledby`; a span whose content has nothing to read (an empty `<hottext>`) is named by the shared localized ordinal of its position in reading order, `accessibility.choiceFallback` ("Choice 2"), never by its identifier. The name carries no state word: `aria-checked` or `aria-pressed` conveys the state, so a screen reader announces it once and the name does not change when the selection does. The referenced ids are unique per interaction instance, so two hottext interactions in one document never label each other's spans. No flattened `textContent` label and no hardcoded English prefix is used. The state attribute is updated on every selection change. A disabled span carries `aria-disabled="true"`. Both containers receive an `aria-label` identifying them as the selection area.
- **Touch targets (SC 2.5.8):** On mobile viewports, hottext spans must meet the 24×24 CSS px minimum target size. The implementation adds `padding: 2px 4px` inline, which may not be sufficient for very short spans (single characters or punctuation). Item authors should avoid single-character hottext spans.
- **Reading order (SC 1.3.2):** The prose reading order must not be altered by the interaction framework. The content HTML is injected verbatim; no reordering occurs.
- **User select disabled on spans (CSS `user-select: none`):** To prevent accidental text selection when clicking quickly, hottext spans have `user-select: none`. This is acceptable for the span itself but must not disable text selection in surrounding prose (WCAG SC 1.4.12 requires text reflow support, not selection disablement).
- **Screen reader announcement:** Screen readers announce a single-select span as a radio button in a radio group, with its checked state and usually its position ("radio button, checked, 2 of 3"). They announce a multi-select span as a toggle button with its pressed state. When the selection changes, the changed `aria-checked` or `aria-pressed` attribute is announced, so the component uses no `aria-live` region for it and avoids over-announcement. Because activating the checked radio changes nothing, nothing is announced, just as with a native radio button. The candidate hears no retraction that did not happen.
- **"Clear answer" button (SC 3.2.4):** A native `<button>` element with descriptive text, not an icon-only control. It must receive focus and be activatable by keyboard. Its label is the one `choiceInteraction` uses for the same function, retracting the whole answer, and it comes from the same i18n key, so a candidate meets one name for one function across the player in every locale. It is not rendered while there is nothing to clear or while the interaction is disabled. Clearing removes it, so focus moves to the first hottext span instead of dropping to the document; under single selection that span is the radio group's Tab stop once nothing is checked.

### Performance

- Extraction and initial render (including DOM post-processing) must complete in under 32 ms for a passage containing up to 20 hottext spans on a mid-range mobile device.
- The `querySelectorAll('hottext')` sweep on every `$effect` re-run is O(n) on DOM size. For typical K-12 passages this is negligible. Items with very large passages (> 500 words) should be profiled separately.

### Cross-platform

- Touch selection (tap to select) must work identically to mouse click. The `onclick` handler covers both.
- On mobile, the passage must reflow into a single column. The `prose max-w-none` classes must not cause horizontal overflow on viewports narrower than 320px.
- On iOS Safari, `cursor: pointer` on non-anchor/button elements may require a `touch-action` workaround. The component sets `cursor: pointer` on each hottext element; iOS honours this via the `onclick` handler.

### Security

- `contentHtml` is rendered via `{@html}` in Svelte. It is sanitized by the item player's `sanitizeHtml()` before reaching the component, which strips `<script>`, `on*` attributes, `<iframe>`, `<base>`, `<meta>`, `<style>`, and unsafe URL schemes. The `<hottext>` custom element tag is preserved because it is unknown and not on the block list.
- The component trusts `contentHtml` as safe HTML; it must not be passed an unsanitized string.
- Event handler wiring (`onclick`, `onkeydown`) is done programmatically in `$effect`, not via `innerHTML`. This means injecting `onclick="..."` attributes in the HTML string has no effect — the sanitizer strips event attributes anyway.

### Internationalization

- Footer label: `interactions.hottext.selected` ("Selected:").
- "Clear answer" button: `interactions.choice.clearAnswer`, the key `choiceInteraction` uses for the same control, so the two cannot drift apart in any locale (WCAG 3.2.4). The former `interactions.hottext.clearSelection` ("Clear Selection") key is removed.
- Container `aria-label`: `interactions.hottext.ariaLabel`.
- Name of an empty span: `accessibility.choiceFallback` ("Choice {index}"), the fallback every interaction uses for a choice with nothing to read. The former per-span state words (`interactions.hottext.selectableState` / `interactions.hottext.selectedState`) are removed: the state is `aria-checked`/`aria-pressed`, not part of the name.
- Refusal message default: `interactions.hottext.maxChoicesReached` ({max} interpolated), shown only when a selection can be refused (`maxChoices>1`); the authored `maxSelectionsMessage` wins when present.
- RTL support: the component does not set a fixed text direction; it inherits from the host. This should be correct for RTL passages as long as the host sets `dir="rtl"`. In the single-select radio group, ArrowLeft and ArrowRight follow the computed inline direction, as native radio buttons do: under RTL, ArrowLeft moves to the next span.

---

## Design decisions

### Hottext elements are post-processed, not rendered as Svelte components

**Decision:** The passage is injected as an HTML string (`{@html contentHtml}`) and hottext spans are enhanced by DOM manipulation in a `$effect` after mount.  
**Rationale:** The alternative — parsing the passage, splitting on `<hottext>` elements, and rendering each chunk as a sequence of text nodes and Svelte `<HottextSpan>` components — requires a custom HTML-to-Svelte-tree parser. Any non-trivial passage (nested block elements, MathML, tables) makes this approach extremely fragile. DOM post-processing is one well-understood function (`querySelectorAll`) and handles all HTML structures.  
**Alternatives considered:** Parse `contentHtml` into a virtual DOM and render as Svelte components. Rejected: too fragile for arbitrary HTML content.  
**Consequences:** ARIA attributes and event handlers on hottext spans are set imperatively, not declaratively. This means they are not tracked by Svelte's reactivity — `updateHottextStyles()` must be called explicitly after every state change. A bug in the update path (e.g., a missing `updateHottextStyles()` call) will leave ARIA state stale. The `$effect` that depends on `selectedIds` calls `updateHottextStyles()` on every selection change, which should catch all cases.

### Single-select hottext is a radio group, not a set of toggle buttons

**Decision:** With `maxChoices=1` the passage container is a `role="radiogroup"` and every span is a `role="radio"` with `aria-checked`. Activating another span replaces the selection, and activating the checked span again (click, tap, Enter, Space) changes nothing and emits nothing. "Clear answer" is the explicit way to retract the answer. The keyboard model is the WAI-ARIA APG radio group pattern (FR-13). With `maxChoices>1` the spans stay `aria-pressed` toggle buttons that deselect on re-activation, as checkboxes do.  
**Rationale:** QTI fixes the response cardinality (`single` for `maxChoices=1`) but does not specify the gesture that deselects a hottext, so this is a UI convention. The player follows the convention candidates already know. A native HTML radio, the APG radio group and this player's own single-choice `choiceInteraction` (native radios plus "Clear answer") all keep the checked option on re-activation. Toggle-off let a double click or a repeated tap retract an answer the candidate meant to keep, a costly slip in a test. The roles have to match that behavior (WCAG 4.1.2). Under toggle-off, single selection was exposed as `aria-pressed` toggle buttons. Keeping that role after removing toggle-off would announce a button the candidate could not unpress. A radio announces exactly what happens: one checked option in a group, which another option replaces. The group is one Tab stop, so a long passage no longer costs a Tab stop per span under single selection.  
**Alternatives considered:** (a) Keep toggle-off for single selection, the earlier behavior. Rejected: it diverges from native radios and `choiceInteraction` and lets one stray activation retract the answer. (b) Keep `aria-pressed` toggle buttons but ignore re-activation. Rejected: the toggle semantics would no longer match the behavior. (c) Use native `<input type="radio">` elements. Rejected: the spans are authored inline in the running text and are enhanced in place (see "Hottext elements are post-processed"), so wrapping them in form controls would change the layout.  
**Consequences:** Enter is kept as an activation key from the earlier button model, although native radios ignore it. Nothing else in the interaction uses Enter, so it only adds a gesture. The arrow keys are handled only while a span has focus; held with Alt, Ctrl or Meta they are left to the browser (Alt+Left is Back) and to assistive technology. Each arrow move checks the newly focused span and emits one `qti-change`, as native radios fire one `change` per move. Under RTL, ArrowLeft and ArrowRight are mirrored. The span's name carries no state word: `aria-checked` alone conveys the state (an empty span is named by its position, AC-E8).

### One "Clear answer" control for both cardinalities

**Decision:** The footer control that retracts the whole answer reads "Clear answer" (`interactions.choice.clearAnswer`) for single and multiple selection alike, replacing "Clear Selection". It follows `choiceInteraction`'s rule: it is shown only while there is an answer and the interaction is enabled, and clearing moves focus to the first hottext span.  
**Rationale:** WCAG 3.2.4 (Consistent Identification) asks for one name for one function across a set of pages, here every item of a test. "Clear Selection" in hottext and "Clear answer" in `choiceInteraction` both retract the whole answer (`null` or `[]`), so they now share the name and the i18n key, and translations cannot drift apart. Multiple selection keeps the control even though each span can be deselected on its own and `choiceInteraction` offers no clear control for checkboxes. Hottext spans are scattered through prose, so clearing several selections one by one means finding each span again; a one-step reset is worth keeping. WCAG 3.2.4 governs how a control is named, not whether every interaction has one, so the extra control in this interaction is consistent with it. Reusing the `interactions.choice.*` key follows existing practice: associate, match and the sortable list read `interactions.choice.correct`, and the elimination tool reads `interactions.choice.eliminateChoice`.  
**Alternatives considered:** Keep "Clear Selection" for multiple selection only. Rejected: the same function would carry two names in one interaction type. Drop the control for multiple selection, to match `choiceInteraction`'s checkboxes. Rejected: it would remove a real convenience without improving consistency. Render the control disabled while the interaction is disabled, the earlier behavior. Rejected in favor of `choiceInteraction`'s rule: a control that cannot do anything is only noise in a read-only view.  
**Consequences:** A disabled or review rendering shows the answer without a clear control. The `interactions.hottext.clearSelection` key was removed from all locales.

### `canSelectMore` gates click handling at interaction time, not in the DOM

**Decision:** With `maxChoices>1`, when `selectedIds.length === maxChoices`, the click handler for unselected spans returns early without emitting. The `selectable` CSS class is removed from unselected spans. With `maxChoices=1` the handler never refuses: activating an unselected span replaces the selection, so unselected spans keep the `selectable` class.  
**Rationale:** Single cardinality follows the radio pattern candidates know from `choiceInteraction`: choosing another option switches the answer instead of requiring a deselection first. Real assessments expect this; refusing the second selection forced an extra step and an error message on every change of mind. Only multiple selection can reach a cap that refuses, and there each span is an `aria-pressed` toggle button whose activation deselects it, which frees a place under the cap. Under single selection the checked span is never toggled off; "Clear answer" is the visible retraction path (see "Single-select hottext is a radio group"). For `maxChoices>1`, disabling `tabindex` on non-selectable spans when the limit is reached would improve accessibility (no focus stops on non-interactive elements) but would require re-sweeping the DOM on every selection change. The current approach keeps non-selected spans keyboard-focusable even when they cannot be selected, with the visual cue of no `selectable` styling. This is a tradeoff: keyboard users can still Tab to spans that cannot be activated, which wastes Tab stops, but preserving focusability avoids the risk of focus being lost or teleported on a selection change.  
**Alternatives considered:** Set `tabindex="-1"` on non-selectable spans when at capacity. Rejected for this implementation; left as a future improvement. Refusing a second selection under `maxChoices=1` (the earlier behavior) was replaced by switching.  
**Consequences:** A keyboard user at a `maxChoices>1` capacity will Tab to inactive spans. The `aria-pressed="false"` state on those spans is accurate (not selected), but there is no ARIA attribute that communicates "cannot be selected right now". A future improvement could use `aria-disabled="true"` on non-selectable spans at capacity.

### `minChoices` is extracted but not forwarded to the component

**Decision:** `standardHottextExtractor` extracts `minChoices` from the XML and includes it in the returned `HottextData` object (when `> 0`), but `HottextInteractionData` does not declare the field, so it is dropped before reaching the component.  
**Rationale:** This is a known gap (consistent with `choiceInteraction`'s handling), not a deliberate design choice. The field exists in the extractor's local type (`HottextData`) but was not added to the shared `HottextInteractionData` type in `interactions.ts`.  
**Alternatives considered:** Add `minChoices?: number` to `HottextInteractionData` and render a "Select at least N" hint. This is the correct end state.  
**Consequences:** Items with `minChoices > 0` will not show a minimum-selection hint to candidates. Submission is not blocked by `minChoices`. This is an authoring-time gap that affects candidates on items that explicitly specify `minChoices`.

### Response emits single string for `maxChoices=1`, array for `maxChoices>1`

**Decision:** When `maxChoices=1`, the `qti-change` event value and the `response` prop value are a bare string (`identifier | null`), not `[identifier]`.  
**Rationale:** This mirrors the QTI spec's cardinality distinction: `maxChoices=1` declares `single` cardinality in the `responseDeclaration`, and a `single` cardinality variable holds one value, not an array. Delivery systems and response-processing code that handles `single` cardinality expect a scalar value. Wrapping it in an array would require unwrapping logic everywhere the response is consumed.  
**Consequences:** Consuming code must branch on `maxChoices` to know the response format. The component handles this in the `handleHottextClick` function and the "Clear answer" handler. The `$effect` that syncs incoming `response` prop also handles both forms.

---

## Data model / contracts

### `HottextInteractionData` (from `@pie-qti/item-player`)

```typescript
interface HottextInteractionData extends BaseInteractionData {
  type: 'hottextInteraction';
  responseId: string;               // from responseIdentifier attribute
  prompt: string | null;            // HTML content of <prompt> child, or null
  maxChoices: number;               // 1 = single cardinality; >1 = multiple cardinality
  contentHtml: HtmlContent;         // sanitized HTML of the entire passage including <hottext> elements
  hottextChoices: Array<{
    identifier: string;             // from hottext identifier attribute; must be unique
    text: string;                   // text content of the hottext element (plain text, not HTML)
  }>;
  // minChoices is NOT present here — see Known gaps
}
```

**Invariants enforced by extractor:**
- `hottextChoices` has at least one entry (error if zero)
- All `identifier` values are non-empty and unique within the interaction (error on duplicate)
- `maxChoices >= 0` (error if negative)
- `minChoices <= maxChoices` when both are defined (error)
- `maxChoices > hottextChoices.length` emits a warning (not an error)

**Invariants not enforced:**
- `minChoices` is not forwarded to the component; no submission-time enforcement
- The `fixed` attribute on individual `<hottext>` elements is not present in `hottextChoices`

### `HottextData` (extractor-internal, from `hottextExtractor.ts`)

This is a superset of `HottextInteractionData` that exists only in the extractor before the data is merged with `BaseInteractionData`. It includes `minChoices?: number`. The discrepancy between this type and `HottextInteractionData` is the root of the minChoices gap.

### Component props

```typescript
interface Props {
  interaction?: HottextInteractionData | string;   // object or JSON string (web component)
  response?: string | string[] | null;             // current response value
  correctResponse?: string | string[] | null;      // shown only to 'scorer' role
  disabled?: boolean;                              // prevents all interaction
  role?: string;                                   // 'candidate' | 'scorer'
  i18n?: I18nProvider;                             // optional localization
  onChange?: (value: string | string[] | null) => void; // Svelte component callback; null on clear (single)
}
```

The component fires a `qti-change` DOM event for web component usage and calls `onChange` for Svelte component usage. Both fire on every selection change.

---

## Acceptance criteria

### Functional

```
AC-1: Single-select: selecting a hottext span updates the response
  Given: an item with hottextInteraction maxChoices=1 at /item-demo/hottext-single
  When: the candidate clicks the hottext span with identifier H2 ("jumps")
  Then: the span has the "selected" CSS class; the footer shows "1 / 3";
        a qti-change event fires with responseIdentifier="RESPONSE" and value="H2"

AC-2: Single-select: selecting a second span deselects the first
  Given: the item from AC-1 with H2 already selected
  When: the candidate clicks H1 ("cat")
  Then: H1 is selected; H2 is deselected; the footer shows "1 / 3";
        qti-change fires with value="H1"; no selection-limit alert appears
  Notes: a radio group, as in choiceInteraction; Enter/Space or an arrow key onto H1 switches the same way.

AC-2a: Single-select: re-activating the selected span keeps it
  Given: the item from AC-1 with H2 already selected
  When: the candidate clicks or taps H2 again, or presses Enter or Space on it
  Then: H2 stays selected (aria-checked="true"); the footer still shows "1 / 3";
        no qti-change fires
  Notes: a radio is never unchecked by activating it (FR-3); "Clear answer" retracts the answer (AC-10a).

AC-3: Single-select correct answer scores 1
  Given: the item from AC-1 with correct answer H2 (MATCH_CORRECT template)
  When: the candidate clicks H2 and submits
  Then: SCORE=1.0, MAXSCORE=1.0

AC-4: Single-select wrong answer scores 0
  Given: the item from AC-1 with correct answer H2
  When: the candidate clicks H1 and submits
  Then: SCORE=0.0, MAXSCORE=1.0

AC-5: Multi-select: each hottext span can be selected independently
  Given: an item with hottextInteraction maxChoices=3 at /item-demo/hottext-multiple
  When: the candidate clicks H2 then H4
  Then: both spans are visually selected; the footer shows "2 / 4";
        qti-change fires twice; the second event value is ["H2","H4"] (array)

AC-6: Multi-select: deselecting a span removes it from the response
  Given: the item from AC-5 with H2 and H4 selected
  When: the candidate clicks H4
  Then: H4 is deselected (aria-pressed="false"); the footer shows "1 / 4";
        qti-change fires with value=["H2"]
  Notes: multi-select spans are toggle buttons, so re-activation deselects, as a checkbox does.

AC-7: maxChoices enforcement blocks over-selection
  Given: the item from AC-5 (maxChoices=3) with 3 spans selected (H1, H2, H4)
  When: the candidate clicks the unselected span H3
  Then: H3 does not become selected; no qti-change event fires;
        H3 does not have the "selectable" CSS class

AC-8: Multi-select all-correct scores 1
  Given: the item at /item-demo/hottext-multiple with correct answers H2 and H4
  When: the candidate selects H2 and H4 and submits
  Then: SCORE=1.0, MAXSCORE=1.0

AC-9: Multi-select partial selection scores 0 (exact match)
  Given: the item from AC-8
  When: the candidate selects only H2 (correct) and omits H4 and submits
  Then: SCORE=0.0, MAXSCORE=1.0
  Notes: the sample items use a MATCH_CORRECT exact-match template; partial credit
         would require MAP_RESPONSE response processing.

AC-10: Clear answer resets a multi-select response
  Given: the item from AC-5 with H2 and H4 selected (footer shows "2 / 4")
  When: the candidate clicks "Clear answer"
  Then: no spans are selected; the footer shows "0 / 4";
        qti-change fires with value=[] (empty array for multi-select);
        the "Clear answer" button disappears and focus moves to the first hottext span

AC-10a: Clear answer resets a single-select response
  Given: the item from AC-1 with H2 selected
  When: the candidate clicks "Clear answer"
  Then: no span is selected; the footer shows "0 / 3";
        qti-change fires with value=null;
        the "Clear answer" button disappears and focus moves to the first hottext span,
        which is now the radio group's Tab stop
  Notes: the label is the one choiceInteraction shows for the same function, in every locale
         (interactions.choice.clearAnswer); no button is shown while nothing is selected.

AC-11: Response prop pre-populates selection on mount
  Given: an item with response=["H4"] passed as prop on mount (multi-select)
  When: the item renders
  Then: H4 appears visually selected; the footer shows "1 / 4";
        no qti-change fires on initial render

AC-12: Prompt is rendered above the passage
  Given: an item whose hottextInteraction has a <prompt> child with text "Click on the verb:"
  When: the item renders
  Then: the prompt text appears above the passage content, before any hottext spans

AC-13: disabled=true blocks all interaction
  Given: an item rendered with disabled=true and a selected span
  When: the candidate clicks or presses keys (Enter, Space, arrows) on any hottext span
  Then: the selection does not change; no qti-change fires; spans display cursor:default
        and carry aria-disabled="true"; the selected span still shows as selected;
        no "Clear answer" button is offered, as in choiceInteraction

AC-14: Scorer role shows correct spans
  Given: an item rendered with role="scorer" and correctResponse=["H2","H4"]
  When: the item renders
  Then: H2 and H4 have the "correct" CSS class (green background);
        other spans do not have the "correct" class

AC-15: Candidate role does not reveal correct spans
  Given: an item rendered with role="candidate" and correctResponse=["H2","H4"]
  When: the item renders
  Then: no span has the "correct" CSS class; H2 and H4 look identical to other spans
```

### Accessibility

```
AC-A1: Single-select: the radio group is one Tab stop
  Given: the item at /item-demo/hottext-single with no selection
  When: the user presses Tab from outside the interaction
  Then: focus lands on the first hottext span (tabindex="0"; every other span has tabindex="-1");
        the next Tab moves focus out of the group
  Notes: with a selected span, Tab lands on that span instead (roving tabindex, FR-13)

AC-A1b: Multi-select: every hottext span is reachable by Tab
  Given: the item at /item-demo/hottext-multiple
  When: the user presses Tab from outside the interaction
  Then: focus lands on the first hottext span;
        successive Tab presses reach each hottext span in document order;
        Tab after the last span moves focus outside the interaction

AC-A2: Space checks or toggles a hottext span
  Given: a hottext span has focus
  When: the user presses Space
  Then: single-select: the span is checked (aria-checked changes from "false" to "true")
        and qti-change fires, or nothing happens if it was already checked;
        multi-select: the span toggles (aria-pressed flips) and qti-change fires;
        the page does not scroll

AC-A3: Enter activates a hottext span
  Given: a hottext span has focus
  When: the user presses Enter
  Then: the span is checked (single-select) or toggled (multi-select); qti-change fires
        unless the single-select span was already checked
  Notes: Enter is kept from the earlier button model. Native radio buttons ignore Enter, so accepting it
         only adds a gesture.

AC-A4: Role and state reflect the cardinality and the selection
  Given: the item at /item-demo/hottext-single with no selection
  When: a screen reader reads each hottext span
  Then: each span is announced as a radio button (role="radio", aria-checked="false"), with no
        aria-pressed; after selection, the span is announced as checked (aria-checked="true")
  Notes: in /item-demo/hottext-multiple each span is a toggle button (role="button",
         aria-pressed="false"/"true"), with no aria-checked

AC-A5: Group container has an accessible label
  Given: any hottext item
  When: a screen reader reads the interaction
  Then: the container div is announced as a radio group (maxChoices=1) or a group (maxChoices>1)
        with label "Text selection interaction" (or the i18n-provided equivalent)

AC-A6: Clear answer button is keyboard-reachable
  Given: the item from AC-A1 with one span selected
  When: the user Tabs through the interaction
  Then: the "Clear answer" button receives focus and can be activated with Space/Enter;
        after activation, focus is on the first hottext span

AC-A7: disabled spans are removed from tab order
  Given: an item rendered with disabled=true
  When: the user presses Tab within the interaction
  Then: no hottext span receives focus (tabindex="-1", aria-disabled="true");
        no "Clear answer" button is rendered

AC-A8: Single-select: arrow keys move and check
  Given: the item at /item-demo/hottext-single with focus on the first hottext span
  When: the user presses ArrowRight or ArrowDown
  Then: focus moves to the next span, which becomes checked; qti-change fires with its identifier;
        ArrowLeft or ArrowUp moves to the previous span; at either end, focus wraps around
  Notes: under dir="rtl", ArrowLeft moves to the next span and ArrowRight to the previous one;
         ArrowUp and ArrowDown are unchanged. With Alt, Ctrl or Meta held, the arrow keys do
         nothing in the interaction. In multi-select, the arrow keys are not handled.
```

### Edge cases

```
AC-E1: All hottext spans fixed (fixed attribute present but no-op)
  Given: a hottext item where all <hottext> elements have fixed="true"
  When: the item renders
  Then: all spans appear as normal selectable elements (fixed has no effect);
        no error or warning is visible to the candidate

AC-E2: maxChoices exceeds total hottext count
  Given: an item with maxChoices=10 and only 3 hottext spans
  When: the item renders
  Then: all 3 spans can be selected without hitting the limit;
        no runtime error occurs;
        the extractor emits a validator warning (not surfaced to the candidate)

AC-E3: maxChoices=0 (unlimited)
  Given: an item with maxChoices=0
  When: the item renders and the candidate selects spans
  Then: all spans can be selected (canSelectMore is true when maxChoices=0 is evaluated);
  Notes: verify component behavior for maxChoices=0 — the derived `canSelectMore` uses
         `selectedIds.length < parsedInteraction.maxChoices`; when maxChoices=0, this
         expression is `selectedIds.length < 0` which is always false and would block
         all selections. This is a potential bug; item authors should not use maxChoices=0
         for hottextInteraction in the current implementation.

AC-E4: Single hottext span in a long passage
  Given: an item with one hottext span in a 200-word passage
  When: the candidate tabs through the item
  Then: the single hottext span is focusable; the passage prose is not interrupted;
        selection and clear work normally

AC-E5: Hottext span with rich HTML content (bold, em)
  Given: a hottext whose displayed text contains <strong> or <em> tags
  When: the item renders
  Then: the formatted text appears inside the hottext span without rendering raw tags;
        selection styling applies to the full span including formatted text

AC-E6: Passage contains multiple block elements (paragraphs, lists)
  Given: an item whose hottextInteraction body contains two <p> elements each with hottext spans
  When: the item renders
  Then: both paragraphs render with correct spacing; hottext spans in both paragraphs are
        keyboard-reachable in document order (by Tab in multi-select, by the arrow keys within
        the single-select radio group)

AC-E7: No interaction data provided
  Given: a pie-qti-hottext web component with no interaction attribute
  When: the component renders
  Then: an error message is displayed (not a blank div); no JavaScript error is thrown

AC-E8: Empty hottext span (no text content)
  Given: a hottext element with no text content (e.g. <hottext identifier="H1"/>)
  When: the item renders
  Then: the span is still selectable (click/key); its accessible name is the localized
        ordinal of its position in reading order ("Choice 1", accessibility.choiceFallback),
        never its identifier, and does not change when it is selected

AC-E9: Response synced to external state change
  Given: the item from AC-5 with H2 selected via user interaction
  When: the parent component externally sets response=[] (e.g. the item player resets state)
  Then: the selection clears; the footer shows "0 / 4"; no qti-change fires
```

---

## Open questions

- [ ] **`maxChoices=0` bug**: The `canSelectMore` derived value is `selectedIds.length < parsedInteraction.maxChoices`. When `maxChoices=0` this is always false, blocking all selections. Is `maxChoices=0` a valid value for `hottextInteraction`? The spec says it means unlimited, but the extractor defaults to `1` when absent. If `0` is a valid authored value, the component needs a guard: `maxChoices === 0 || selectedIds.length < maxChoices`.
- [x] **`maxChoices=1` behavior** (resolved 2026-11-09): single-select hottext is a radio group. Selecting another span replaces the selection, activating the selected span again keeps it, and "Clear answer" retracts the answer, as in `choiceInteraction`. See the decision "Single-select hottext is a radio group, not a set of toggle buttons" above.
- [ ] **`minChoices` gap**: Should `minChoices` be added to `HottextInteractionData` and surfaced as a "Select at least N" footer hint? This is low-effort to add but requires agreement on the UI pattern.
- [ ] **Touch target size for short spans**: Single-word hottext spans (especially short words like "a", "or", "in") may not meet the 24×24 px touch target minimum. Should the component enforce a minimum `min-width` / `min-height` on hottext elements?

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.2.4 hottextInteraction
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-09 (PNP), G-13 (PNP structural labels)
- Component: `packages/default-components/src/plugins/hottext/HottextInteraction.svelte`
- Extractor: `packages/item-player/src/interactions/hottext/extractor.ts`
- Type: `packages/item-player/src/interactions/shared/types.ts` — `HottextInteractionData`, `HottextChoice`
- Extractor tests: `packages/item-player/tests/extraction/extractors/hottextExtractor.test.ts`
- Eval fixtures: `docs/evals/default-components/hottext/evals.yaml`
- Sample items: `apps/demo/src/lib/sample-items.ts` — `HOTTEXT_INTERACTION_SINGLE`, `HOTTEXT_INTERACTION_MULTIPLE`
- A11y fixture: `apps/demo/src/lib/a11y/fixtures/HottextInteractionFixture.svelte`
- Keyboard model: [WAI-ARIA APG radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) (single selection)
- Adjacent PRDs: [choice.md](choice.md) (similar selection/cardinality mechanics), [hotspot.md](hotspot.md) (similar maxChoices pattern on non-list interactions)
