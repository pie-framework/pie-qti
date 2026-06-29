# PRD: hottextInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: hottextInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`hottextInteraction` is the QTI interaction type for inline text-selection questions. The candidate reads a passage containing marked-up `<hottext>` spans — words or phrases embedded in flowing prose — and clicks (or taps) to select them. The implementation extracts the entire passage as sanitized HTML, preserving the `<hottext>` custom elements inside it, then renders the passage in a content div where those elements are progressively enhanced with click handlers, keyboard bindings, and ARIA attributes. The response is a set of `identifier` strings, one per selected hottext span.

---

## Background and rationale

**Why hottext is fundamentally different from list-based interactions**: In `choiceInteraction`, `orderInteraction`, and `matchInteraction`, the candidate's choices are presented as a discrete list separated from the stimulus. In `hottextInteraction`, the selectable elements live inside the stimulus itself — inside flowing prose. This changes nearly every aspect of the implementation:

- The interaction element wraps the entire passage, not just a list of choices. The extractor must treat the whole element body as content HTML, not enumerate child `<simpleChoice>` elements.
- The custom `<hottext>` elements are non-standard HTML. They survive the HTML parser as unknown elements and must be discovered via `querySelectorAll('hottext')` after the content is injected into the DOM.
- Reading order must be preserved exactly as authored. There is no shuffle attribute and no reordering — the text must appear in exactly the authored sequence.
- Keyboard navigation through clickable spans embedded in paragraph text is harder to make accessible than a discrete list. The Tab order passes through every hottext span in document order, which can be a large number of stops in a long passage.

**Why `maxChoices=1` produces a string response, not a one-element array**: The QTI spec defines the `hottextInteraction` response variable as `single` cardinality when `maxChoices=1` and `multiple` cardinality when `maxChoices>1`. The component encodes this: when `maxChoices=1` it emits a bare identifier string (or `null`); when `maxChoices>1` it emits an `string[]`. This mirrors how `choiceInteraction` handles the radio vs. checkbox distinction. Delivery system code that processes responses must branch on the response type; the extractor's `maxChoices` value is the canonical signal.

**Why `maxChoices=0` is not treated as "unlimited"**: Unlike `choiceInteraction`, the `hottextInteraction` spec defines `maxChoices` default as `1` (not `0`). The QTI spec states `0` means unlimited for both interaction types, but practically all real K-12 `hottextInteraction` items use a fixed positive value. The extractor defaults `maxChoices` to `1` when the attribute is absent, consistent with the spec default. The validator emits a warning when `maxChoices > hottext count`, which catches the most common authoring errors.

**Why hottext elements are not shuffled**: The QTI spec does not define a `shuffle` attribute on `hottextInteraction`. The position of each hottext span within the prose is fixed by the author's intent — rearranging them would alter the meaning of the text. This is unlike `choiceInteraction` where the choices are semantically independent options.

**Why the `fixed` attribute on `<hottext>` is not extracted**: The QTI spec defines a `fixed` attribute on `hottext` elements, analogous to `fixed` on `simpleChoice`. Its purpose is to mark spans that should not be shuffled when a hypothetical `shuffle` attribute exists on the interaction — but since `hottextInteraction` has no `shuffle`, `fixed` is meaningless in practice. It is not extracted and has no effect on rendering.

**Why content is injected as raw HTML via `{@html}`**: The passage may contain arbitrary HTML — `<em>`, `<strong>`, `<a>`, block elements, MathML, tables — along with `<hottext>` elements that are non-standard. Building a Svelte template that handles all valid QTI content structures is not tractable. Injecting the sanitized HTML string and then post-processing the DOM via `querySelectorAll` is the only practical approach. The security risk is mitigated by the item player's HTML sanitizer, which strips `<script>`, event handlers, iframes, and dangerous URL schemes before the string reaches the component. See the security PRD for the full sanitizer policy.

**Why hottext progressive enhancement happens inside a `$effect`**: The component renders `{@html parsedInteraction.contentHtml}`, which injects the passage including raw `<hottext>` elements. Svelte's reactivity does not understand custom elements inside injected HTML — only DOM APIs can reach them. The `$effect` that runs after `contentElement` is bound does the `querySelectorAll('hottext')` sweep, attaches onclick/onkeydown handlers, and sets `role`, `tabindex`, and `aria-pressed`. This is a one-time setup effect; subsequent selection changes update ARIA state via a separate `updateHottextStyles()` call rather than re-running the full setup.

**Why the footer count shows selected vs. total hottext count**: K-12 test candidates benefit from knowing how many spans they can still select. Showing `n / total_hottext_count` gives a clear signal: when both numbers are equal the candidate has selected everything; the "Clear Selection" button is the primary affordance for reducing the count. The denominator uses `hottextChoices.length` (total hottext spans), not `maxChoices`, because showing `n / maxChoices` would be confusing when `maxChoices < total spans`.

**Pedagogical note**: `hottextInteraction` is most effective with 2–4 selectable spans embedded in a short passage (2–4 sentences). Longer passages with many selectable spans create cognitive fatigue and make keyboard navigation tedious. Item authors should also avoid spans that are adjacent or overlapping, since touch targets become hard to distinguish. The PRD does not enforce these guidelines programmatically but they inform the acceptance criteria.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place)  
**Spec section:** §3.2.4 hottextInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `hottextInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | Full | Extracted as `responseId`; used in `qti-change` event payload |
| `maxChoices` | Full | Enforced at selection time: once `selectedIds.length === maxChoices`, further selections are blocked until a deselection occurs. Default `1` when absent. |
| `minChoices` | Partial — extracted, not surfaced | Extracted by `standardHottextExtractor` (conditionally included in `HottextData` when `> 0`) and validated structurally. **Not present in `HottextInteractionData`** and not surfaced to the component, so no "minimum required" UI hint is shown. See Known gaps. |

### Supported attributes on `<hottext>`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | Full | Required. Used as the value stored in the response when this span is selected. Must be unique within the interaction. |
| `fixed` | Not extracted | Spec: prevents this span from being shuffled. `hottextInteraction` has no `shuffle` attribute, so `fixed` is meaningless. Not extracted; has no effect. |
| `templateIdentifier` | Not extracted | Links the hottext element's visibility to a `TemplateDeclaration` variable. Not implemented. |
| `showHide` | Not extracted | Companion to `templateIdentifier`. Not implemented. |
| CSS `class` attribute | Partial | Extracted as `classes?: string[]` in `HottextData`; not carried forward into `HottextInteractionData` or the component. |

### Response variable contract

- **baseType:** `identifier`
- **Cardinality:** `single` when `maxChoices=1`; `multiple` when `maxChoices>1`
- **Value format (single):** a bare identifier string matching one `<hottext>` element, or `null` when nothing is selected
- **Value format (multiple):** `string[]` of identifier strings in selection order (not sorted by document order), or `[]` when nothing is selected
- **Clearing:** the "Clear Selection" button resets to `null` (single) or `[]` (multiple) and fires a `qti-change` event

### Standard response processing templates

- **MATCH_CORRECT** — correct when `RESPONSE` equals `correctResponse`. Used for `maxChoices=1` (single identifier match).
- **MAP_RESPONSE** — partial credit via `mapping` on the `ResponseDeclaration`. Each hottext identifier maps to a point value. Used for multi-select partial credit where some spans are worth more than others.
- Custom `responseCondition` branching is valid; the multiple-select fixture uses an exact set match (`<match>` with `multiple` cardinality).
- **`containsAll` / `isNull` operators** are commonly used with `multiple` cardinality hottext responses in custom response processing.

### Known gaps

- **`minChoices` not surfaced to the component**: `minChoices` is extracted by `standardHottextExtractor` and present in the local `HottextData` type (in the extractor file), but `HottextInteractionData` (in `packages/item-player/src/interactions/shared/types.ts`) does not include the field. The component therefore cannot render a "Select at least N" hint or gate submission. This is analogous to the `choiceInteraction` `minChoices` gap. Not tracked under a named gap item in `docs/SPEC-GAPS-PLAN.md` but consistent with the pattern described by G-06.
- **`fixed` on `<hottext>` not extracted**: As noted above, this is a deliberate no-op because `hottextInteraction` has no shuffle.
- **`templateIdentifier`/`showHide` not implemented**: Template-variable-driven conditional span visibility is not supported (consistent with all other interactions in this codebase).
- **G-09 (PNP)**: When `pnp.cognitive.eliminationTool` is enabled, candidates should be able to dismiss non-selectable spans from consideration. Not implemented.

---

## Functional requirements

- **FR-1:** Render the interaction content HTML inside a `role="group"` container. The `<hottext>` elements within the HTML must be keyboard-focusable and mouse-clickable.
- **FR-2:** When a candidate clicks or activates (Enter/Space) an unselected hottext span and the selection count is below `maxChoices`, add the span's identifier to the response and visually mark the span as selected.
- **FR-3:** When a candidate clicks or activates a selected hottext span, remove its identifier from the response and visually revert the span to unselected.
- **FR-4:** When the selection count equals `maxChoices`, clicking an unselected span must have no effect (the span is not selected, no event fires). The `selectable` visual cue must be removed from unselected spans in this state.
- **FR-5:** When `maxChoices=1`, the response value emitted is a bare identifier string (or `null` on clear). When `maxChoices>1`, the response value emitted is `string[]`.
- **FR-6:** On each selection change, emit a `qti-change` CustomEvent with `{ responseIdentifier, value }` from the root element. The event must bubble.
- **FR-7:** Accept a `response` prop and reflect it as the initial selection state without firing a `qti-change` event on mount.
- **FR-8:** When `disabled=true`, all hottext spans must be non-interactive (`cursor: default`, `tabindex="-1"`). The "Clear Selection" button must also be disabled.
- **FR-9:** When `role='scorer'` and `correctResponse` is provided, visually mark correct hottext spans with the `correct` class (green background). Do not reveal correct answers to any other role.
- **FR-10:** Display a footer showing `selected / total_hottext_count` and a "Clear Selection" button that appears only when at least one span is selected.
- **FR-11:** Render the optional `<prompt>` HTML above the passage content when present.
- **FR-12:** When no `interaction` data is provided, render a localized error message instead of an empty div.

---

## Non-functional requirements

### Accessibility

WCAG 2.2 Level AA is mandatory for all assessment interactions.

- **Keyboard operability (SC 2.1.1):** Every hottext span must receive focus via Tab in document order. Space and Enter must activate the focused span. A user must be able to complete the interaction entirely by keyboard without using a mouse.
- **Focus visible (SC 2.4.7 / 2.4.11):** Focused hottext spans must have a visible focus indicator that meets contrast and size requirements. The browser's default `:focus` ring is not sufficient for custom elements; the implementation must explicitly style `:focus-visible` or provide a substitute.
- **Name, role, value (SC 4.1.2):** Each `<hottext>` element receives `role="button"`, `aria-pressed="true/false"`, and an `aria-label` of `"Selectable text: <text content>"`. The `aria-pressed` attribute is updated on every selection change so screen readers announce the toggle state. The container receives `role="group"` with an `aria-label` identifying it as the selection area.
- **Touch targets (SC 2.5.8):** On mobile viewports, hottext spans must meet the 24×24 CSS px minimum target size. The implementation adds `padding: 2px 4px` inline, which may not be sufficient for very short spans (single characters or punctuation). Item authors should avoid single-character hottext spans.
- **Reading order (SC 1.3.2):** The prose reading order must not be altered by the interaction framework. The content HTML is injected verbatim; no reordering occurs.
- **User select disabled on spans (CSS `user-select: none`):** To prevent accidental text selection when clicking quickly, hottext spans have `user-select: none`. This is acceptable for the span itself but must not disable text selection in surrounding prose (WCAG SC 1.4.12 requires text reflow support, not selection disablement).
- **Screen reader announcement:** When a span is toggled, the change in `aria-pressed` causes screen readers to announce the new state. The component does not use `aria-live` regions for this — the `aria-pressed` pattern is sufficient and avoids over-announcement.
- **"Clear Selection" button:** Must be a native `<button>` element with descriptive text ("Clear Selection"), not an icon-only control. It must receive focus and be activatable by keyboard.

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

- The footer label "Selected:" is not currently passed through the `i18n` provider. This is a gap — it should use `i18n?.t('interactions.hottext.selected', 'Selected:')`.
- The "Clear Selection" button label should use `i18n?.t('interactions.hottext.clearSelection', 'Clear Selection')`.
- The container `aria-label` uses `i18n?.t('interactions.hottext.ariaLabel') ?? 'Text selection interaction'`.
- The `aria-label` on individual hottext spans is hardcoded as `"Selectable text: {textContent}"`. The prefix "Selectable text:" should be externalized to the i18n provider.
- RTL support: the component does not set a fixed text direction; it inherits from the host. This should be correct for RTL passages as long as the host sets `dir="rtl"`.

---

## Design decisions

### Hottext elements are post-processed, not rendered as Svelte components

**Decision:** The passage is injected as an HTML string (`{@html contentHtml}`) and hottext spans are enhanced by DOM manipulation in a `$effect` after mount.  
**Rationale:** The alternative — parsing the passage, splitting on `<hottext>` elements, and rendering each chunk as a sequence of text nodes and Svelte `<HottextSpan>` components — requires a custom HTML-to-Svelte-tree parser. Any non-trivial passage (nested block elements, MathML, tables) makes this approach extremely fragile. DOM post-processing is one well-understood function (`querySelectorAll`) and handles all HTML structures.  
**Alternatives considered:** Parse `contentHtml` into a virtual DOM and render as Svelte components. Rejected: too fragile for arbitrary HTML content.  
**Consequences:** ARIA attributes and event handlers on hottext spans are set imperatively, not declaratively. This means they are not tracked by Svelte's reactivity — `updateHottextStyles()` must be called explicitly after every state change. A bug in the update path (e.g., a missing `updateHottextStyles()` call) will leave ARIA state stale. The `$effect` that depends on `selectedIds` calls `updateHottextStyles()` on every selection change, which should catch all cases.

### `canSelectMore` gates click handling at interaction time, not in the DOM

**Decision:** When `selectedIds.length === maxChoices`, the click handler for unselected spans returns early. The `selectable` CSS class is removed from unselected spans.  
**Rationale:** Disabling `tabindex` on non-selectable spans when the limit is reached would improve accessibility (no focus stops on non-interactive elements) but would require re-sweeping the DOM on every selection change. The current approach keeps non-selected spans keyboard-focusable even when they cannot be selected, with the visual cue of no `selectable` styling. This is a tradeoff: keyboard users can still Tab to spans that cannot be activated, which wastes Tab stops, but preserving focusability avoids the risk of focus being lost or teleported on a selection change.  
**Alternatives considered:** Set `tabindex="-1"` on non-selectable spans when at capacity. Rejected for this implementation; left as a future improvement.  
**Consequences:** A keyboard user at capacity will Tab to inactive spans. The `aria-pressed="false"` state on those spans is accurate (not selected), but there is no ARIA attribute that communicates "cannot be selected right now". A future improvement could use `aria-disabled="true"` on non-selectable spans at capacity.

### `minChoices` is extracted but not forwarded to the component

**Decision:** `standardHottextExtractor` extracts `minChoices` from the XML and includes it in the returned `HottextData` object (when `> 0`), but `HottextInteractionData` does not declare the field, so it is dropped before reaching the component.  
**Rationale:** This is a known gap (consistent with `choiceInteraction`'s handling), not a deliberate design choice. The field exists in the extractor's local type (`HottextData`) but was not added to the shared `HottextInteractionData` type in `interactions.ts`.  
**Alternatives considered:** Add `minChoices?: number` to `HottextInteractionData` and render a "Select at least N" hint. This is the correct end state.  
**Consequences:** Items with `minChoices > 0` will not show a minimum-selection hint to candidates. Submission is not blocked by `minChoices`. This is an authoring-time gap that affects candidates on items that explicitly specify `minChoices`.

### Response emits single string for `maxChoices=1`, array for `maxChoices>1`

**Decision:** When `maxChoices=1`, the `qti-change` event value and the `response` prop value are a bare string (`identifier | null`), not `[identifier]`.  
**Rationale:** This mirrors the QTI spec's cardinality distinction: `maxChoices=1` declares `single` cardinality in the `responseDeclaration`, and a `single` cardinality variable holds one value, not an array. Delivery systems and response-processing code that handles `single` cardinality expect a scalar value. Wrapping it in an array would require unwrapping logic everywhere the response is consumed.  
**Consequences:** Consuming code must branch on `maxChoices` to know the response format. The component handles this in the `handleHottextClick` function and the "Clear Selection" handler. The `$effect` that syncs incoming `response` prop also handles both forms.

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
  onChange?: (value: string | string[]) => void;   // Svelte component callback
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
        qti-change fires with value="H1"
  Notes: because maxChoices=1, clicking when at capacity deselects the previous selection
         implicitly — the current implementation blocks selection when at capacity,
         meaning the candidate must deselect H2 first before H1 can be selected.
         Verify actual behavior matches documented behavior.

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
  Then: H4 is deselected; the footer shows "1 / 4";
        qti-change fires with value=["H2"]

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

AC-10: Clear Selection button resets the response
  Given: the item from AC-5 with H2 and H4 selected (footer shows "2 / 4")
  When: the candidate clicks "Clear Selection"
  Then: no spans are selected; the footer shows "0 / 4";
        qti-change fires with value=[] (empty array for multi-select);
        the "Clear Selection" button disappears

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
  Given: an item rendered with disabled=true
  When: the candidate clicks or presses keys on any hottext span
  Then: no span becomes selected; no qti-change fires; spans display cursor:default;
        the "Clear Selection" button is present but has the HTML disabled attribute

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
AC-A1: All hottext spans are reachable by Tab
  Given: the item at /item-demo/hottext-single
  When: the user presses Tab from outside the interaction
  Then: focus lands on the first hottext span;
        successive Tab presses reach each hottext span in document order;
        Tab after the last span moves focus outside the interaction

AC-A2: Space activates a hottext span
  Given: a hottext span has focus
  When: the user presses Space
  Then: the span is selected (aria-pressed changes from "false" to "true");
        qti-change fires

AC-A3: Enter activates a hottext span
  Given: a hottext span has focus
  When: the user presses Enter
  Then: the span is selected; qti-change fires
  Notes: Enter is handled in addition to Space to match button activation conventions

AC-A4: aria-pressed reflects selection state
  Given: the item at /item-demo/hottext-single with no selection
  When: a screen reader reads each hottext span
  Then: each span is announced with role="button" and aria-pressed="false";
        after selection, the span is announced with aria-pressed="true"

AC-A5: Group container has an accessible label
  Given: any hottext item
  When: a screen reader reads the interaction
  Then: the container div is announced as a group with label "Text selection interaction"
        (or the i18n-provided equivalent)

AC-A6: Clear Selection button is keyboard-reachable
  Given: the item from AC-A1 with one span selected
  When: the user Tabs through the interaction
  Then: the "Clear Selection" button receives focus and can be activated with Space/Enter

AC-A7: disabled spans are removed from tab order
  Given: an item rendered with disabled=true
  When: the user presses Tab within the interaction
  Then: no hottext span receives focus (tabindex="-1");
        the "Clear Selection" button is disabled and skipped
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
        keyboard-reachable in document order

AC-E7: No interaction data provided
  Given: a pie-qti-hottext web component with no interaction attribute
  When: the component renders
  Then: an error message is displayed (not a blank div); no JavaScript error is thrown

AC-E8: Empty hottext span (no text content)
  Given: a hottext element with no text content (e.g. <hottext identifier="H1"/>)
  When: the item renders
  Then: the span is still selectable (click/key);
        aria-label falls back to the identifier string ("Selectable text: H1")

AC-E9: Response synced to external state change
  Given: the item from AC-5 with H2 selected via user interaction
  When: the parent component externally sets response=[] (e.g. the item player resets state)
  Then: the selection clears; the footer shows "0 / 4"; no qti-change fires
```

---

## Open questions

- [ ] **`maxChoices=0` bug**: The `canSelectMore` derived value is `selectedIds.length < parsedInteraction.maxChoices`. When `maxChoices=0` this is always false, blocking all selections. Is `maxChoices=0` a valid value for `hottextInteraction`? The spec says it means unlimited, but the extractor defaults to `1` when absent. If `0` is a valid authored value, the component needs a guard: `maxChoices === 0 || selectedIds.length < maxChoices`.
- [ ] **`maxChoices=1` does not auto-deselect**: When `maxChoices=1` and a span is already selected, clicking a different span is blocked (not deselected). Should single-select hottext behave like radio buttons (click automatically switches selection)? The current behavior requires the candidate to explicitly deselect before selecting a different span, which is non-obvious.
- [ ] **`minChoices` gap**: Should `minChoices` be added to `HottextInteractionData` and surfaced as a "Select at least N" footer hint? This is low-effort to add but requires agreement on the UI pattern.
- [ ] **i18n gap**: The "Selected:" label and "Clear Selection" button label are not run through the `i18n` provider. Should they be, and what are the canonical key names?
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
- Adjacent PRDs: [choice.md](choice.md) (similar selection/cardinality mechanics), [hotspot.md](hotspot.md) (similar maxChoices pattern on non-list interactions)
