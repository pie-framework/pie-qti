# PRD: Inline Interactions — `textEntryInteraction` and `inlineChoiceInteraction`

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/item-player
  QTI types: textEntryInteraction, inlineChoiceInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/item-player` (extractor + renderer; no separate web component package)  
**Last reviewed:** 2026-04-28

---

## Summary

`textEntryInteraction` and `inlineChoiceInteraction` are the two QTI inline interactions — they appear embedded within the flow of a sentence or paragraph rather than as standalone blocks. `textEntryInteraction` renders as a single-line text input for short-answer or fill-in-the-blank responses. `inlineChoiceInteraction` renders as a dropdown selector. Both are used in cloze (fill-in-the-blank) assessment patterns where a sentence contains one or more response points. An item body may contain multiple instances of each type, each bound to a different `responseIdentifier`.

These interactions differ from every other QTI interaction in this framework in one critical way: they have no dedicated Svelte web component in `@pie-qti/default-components`. Instead, they are rendered directly inside `ItemBody.svelte` in `@pie-qti/item-player` via a placeholder-substitution pipeline.

---

## Background and rationale

### Why both interactions share one PRD

Both interactions are inline — they render inside prose, participate in the same placeholder-substitution rendering pipeline, share the same accessibility challenge (accessible labels in the absence of a visible `<label>` element), and are the only two QTI interactions that bypass the web component registry entirely. Documenting them together reflects how the code treats them and avoids duplicating the rendering-pipeline explanation.

### Why there is no web component

Block-level interactions (choice, match, slider, etc.) are rendered as custom elements (`<pie-qti-choice>`, etc.) because they occupy their own layout context and benefit from shadow DOM style encapsulation. Inline interactions must flow within prose — between words of a sentence. Custom elements default to `display: inline` but shadow DOM roots still create an `innerHTML`-boundary that makes it impossible to inject them into the middle of a serialised HTML string with `{@html}`. The approach taken is:

1. During HTML serialisation (`ItemBody.svelte`, `getItemBodyHtml()`), each `<textEntryInteraction>` and `<inlineChoiceInteraction>` tag is replaced with a sentinel placeholder string (`[TEXTENTRY:responseId]` / `[INLINECHOICE:responseId]`).
2. The `inlineSegments` derived state in `ItemBody.svelte` splits the HTML string on these sentinels, producing an array of alternating `{type: 'html'}` and `{type: 'textEntry'|'inlineChoice'}` segments.
3. The Svelte template iterates the segments: HTML segments are emitted with `{@html}`; interaction segments are emitted as native `<input>` or `<select>` elements.

This avoids the need for a shadow DOM root while preserving full Svelte reactivity for the interaction elements.

### Why these interactions are exempt from the component registry

`ComponentRegistry.getTagName()` is called only for block-level interactions. `ItemBody.svelte` explicitly filters out `textEntryInteraction` and `inlineChoiceInteraction` before dispatching to the registry:

```ts
interactions.filter(
  (i) => i.type !== 'textEntryInteraction' && i.type !== 'inlineChoiceInteraction'
)
```

Custom renderers cannot currently override inline interactions via the component registry. This is a deliberate simplification — extending inline rendering requires modifying `ItemBody.svelte` directly.

### The case-sensitivity trap in `textEntryInteraction` scoring

`textEntryInteraction` produces a `string`-baseType response. The `match` operator in QTI response processing is case-sensitive by default. Authors who write a correct response of `"Paris"` and score with `match` will mark `"paris"` as incorrect. The QTI spec provides `stringMatch` with a `caseSensitive` attribute for lenient matching. This is the single most common scoring authoring error with text entry — a candidate who types the correct answer in the wrong case receives 0 points. When reviewing or authoring text-entry scoring, always check whether `stringMatch caseSensitive="false"` is used.

### Why `expectedLength` drives visual width, not a CSS `size` attribute

The `expectedLength` attribute is a QTI hint for how wide the input should appear (in characters). The implementation maps this to an inline `width` style: `expectedLength * 8` pixels, with a 100 px minimum. This is a heuristic — character widths vary by font — but it matches the common practice of other QTI delivery engines. Using the HTML `size` attribute would require additional CSS interaction to override the browser default metrics and would behave inconsistently across browsers. A 100 px minimum prevents single-character inputs from becoming unusably narrow.

### Why `patternMask` is extracted but not enforced as a live constraint (G-04)

The extractor reads and exposes `patternMask` as a string on `TextEntryInteractionData`. However, the renderer in `ItemBody.svelte` does not wire `patternMask` to the `pattern` attribute of the `<input>`, meaning browsers do not enforce it with their native `:invalid` state or block form submission. This is gap G-04 — see [Known gaps](#known-gaps). When this gap is closed, the fix must also surface an accessible validation message, not just activate CSS `:invalid`.

### Why shuffle does not persist across re-renders for `inlineChoiceInteraction`

`shuffle` is respected at extraction time (the choice order in `InlineChoiceInteractionData.choices` is shuffled once when the extractor runs). The order is then stable for the lifetime of that extracted data object. If the item is re-loaded from XML, the order will differ. This matches the approach used by `choiceInteraction` and is the correct behaviour for stateless rendering — the spec requires a consistent order within a session, not across sessions.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary target); QTI 3.0 (element name mapping in place via `qti-text-entry-interaction` / `qti-inline-choice-interaction`)  
**Spec sections:** §3.2.1 (`inlineChoiceInteraction`), §3.2.2 (`textEntryInteraction`) in `docs/QTI_techguide.md`

---

### `textEntryInteraction`

**Response variable:** `baseType: string` (also `integer` or `float` per spec; the extractor always stores the raw string — coercion is the scoring layer's responsibility), `cardinality: single`

#### Supported attributes

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used as the key in `player.declarations` and in `handleTextEntryInput` |
| `expectedLength` | ✅ Full | Extracted as `number` (default `20`); drives input width as `expectedLength * 8` px, min 100 px |
| `patternMask` | ✅ Extracted, ❌ not enforced | Stored in `TextEntryInteractionData.patternMask`; not wired to `<input pattern>` (G-04) |
| `placeholderText` | ✅ Full | Extracted and rendered as the `placeholder` attribute on the `<input>` |
| `format` | ❌ Not extracted | QTI 2.2 display-format hint; not in `TextEntryData` (G-03) |
| `base` | ❌ Not extracted | Numeric base hint for integer responses; not extracted or used |

#### Known gaps

- **G-03** — `format` attribute not extracted. The extractor does not read `format`. When resolved: add `format?: string` to `TextEntryData`; expose it as a `data-format` attribute on the rendered `<input>`; optionally map known values (`plain`, `preFormatted`) to CSS classes.
- **G-04** — `patternMask` extracted but not enforced as live input constraint. The rendered `<input>` does not carry a `pattern` attribute. When resolved: add `pattern={interaction.patternMask ?? undefined}` to the `<input>`; add an accessible error span wired via `aria-describedby`; activate on `:invalid` CSS state, not on blur-only.

---

### `inlineChoiceInteraction`

**Response variable:** `baseType: identifier`, `cardinality: single`

#### Supported attributes on `inlineChoiceInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId` |
| `shuffle` | ✅ Full | Shuffles `choices` array at extraction time; stable within the data object lifetime |
| `required` | ❌ Not extracted | Spec says: if `true`, candidate must select an option before submission is valid. Not in `InlineChoiceInteractionData`. Unimplemented gap. |

#### Supported child elements and their attributes

| Child / Attribute | Support | Behaviour |
|-------------------|---------|-----------|
| `inlineChoice` (element) | ✅ Full | Each child becomes `{identifier, text}` in the `choices` array |
| `inlineChoice/@identifier` | ✅ Full | Maps to `choice.identifier`; stored as the `value` of the `<option>` |
| `inlineChoice/text()` | ✅ Full | Text content maps to `choice.text` / `<option>` label |
| `inlineChoice/@fixed` | ❌ Not extracted | Prevents shuffle from repositioning this choice. Not extracted. Low-priority gap. |
| `inlineChoice/@templateIdentifier` | ❌ Not extracted | Template-variable-driven visibility. Not extracted. |
| `inlineChoice/@showHide` | ❌ Not extracted | Template-driven show/hide. Not extracted. |
| `label` (child element, QTI 2.2+) | ❌ Not extracted | Placeholder text shown before selection. Not extracted (G-02). |

#### Known gaps

- **G-02** — `<label>` child element not extracted. When an `inlineChoiceInteraction` has a `<label>` child, its text should be used as the placeholder option (the disabled first `<option>` the user sees before selecting). Currently the renderer always shows the i18n string `"Select..."`. When resolved: add `label?: string` to `InlineChoiceData`; use it as the disabled placeholder `<option>` text in `ItemBody.svelte`.

---

## Functional requirements

### Shared

- **FR-1:** An item body containing one or more `textEntryInteraction` or `inlineChoiceInteraction` elements must render each interaction in-flow within the surrounding prose, preserving surrounding text and markup.
- **FR-2:** Each interaction must be bound to its own `responseIdentifier`. Interactions with different `responseIdentifier` values on the same item must not share state.
- **FR-3:** When the `disabled` prop is `true` on `ItemBody`, all inline inputs and selects must be rendered with the `disabled` HTML attribute and must not accept user input.
- **FR-4:** When `role` is `scorer` (or any role with `canViewCorrectResponses: true`), the input/select must display the correct answer value and apply success styling (green border and background tint). The candidate role must never show the correct answer.
- **FR-5:** Response changes must be propagated immediately via the `onResponseChange(responseId, value)` callback on every `input` (text entry) or `change` (inline choice) event.
- **FR-6:** Multiple QTI 3.0 (`qti-text-entry-interaction`, `qti-inline-choice-interaction`) elements must be parsed identically to their QTI 2.x equivalents after element-name normalisation.

### `textEntryInteraction`

- **FR-T1:** The input must render as `<input type="text">` with `display: inline-block` and `vertical-align: baseline`.
- **FR-T2:** Width must be set as `expectedLength * 8` px with a minimum of 100 px.
- **FR-T3:** When `placeholderText` is present in the extracted data, it must appear as the input's `placeholder` attribute.
- **FR-T4:** The response value stored must be the raw string typed by the candidate. No trimming, normalisation, or type coercion is applied by the renderer; coercion is the scoring layer's responsibility.
- **FR-T5:** When `patternMask` is present in the extracted data, it must (once G-04 is resolved) be wired to the `pattern` attribute of the `<input>` and must trigger an accessible validation message when violated.

### `inlineChoiceInteraction`

- **FR-I1:** The interaction must render as a `<select>` with `display: inline-block` and `vertical-align: baseline`.
- **FR-I2:** An empty-value `<option>` using the i18n key `interactions.inline.selectPlaceholder` (fallback `"Select..."`) must always be the first option and represent the unselected state.
- **FR-I3:** Each `inlineChoice` child must render as an `<option>` with `value={choice.identifier}` and label text `{choice.text}`.
- **FR-I4:** When `shuffle` is `true`, the non-fixed choices must appear in the shuffled order produced at extraction time.
- **FR-I5:** The response value stored must be the `identifier` of the selected `inlineChoice`, not the display text.
- **FR-I6:** When the scorer role is active and a correct answer is known, the correct choice must be indicated in the option label with a checkmark suffix (` ✓`) and the correct-answer badge must be shown above the select.

---

## Non-functional requirements

### Accessibility

Inline interactions present a unique accessibility challenge: unlike standalone block interactions, they have no visible `<label>` element adjacent to them. Screen reader users navigating by form control will encounter an `<input>` or `<select>` without a programmatic label unless the author or renderer supplies one.

**Current approach:** Both the `<input>` and `<select>` carry `aria-label` attributes set to `"Text entry {responseId}"` and `"Inline choice {responseId}"` respectively. When the scorer role is active and a correct answer is known, the `aria-label` is extended with `". Correct answer: {value}"`.

**Requirements:**

- **NFR-A1:** Every `<input type="text">` for a `textEntryInteraction` must have an `aria-label` that uniquely identifies it within the item. Using only the `responseIdentifier` is acceptable as a baseline but item authors who provide `placeholderText` with descriptive content should have that content reflected in the label.
- **NFR-A2:** Every `<select>` for an `inlineChoiceInteraction` must have an `aria-label` that uniquely identifies it within the item.
- **NFR-A3:** Keyboard navigation must be fully operable: Tab/Shift-Tab to move between inline interactions; Space/Arrow to operate the dropdown; typing directly into the text input.
- **NFR-A4:** When `patternMask` validation is implemented (G-04), validation errors must be communicated via an `aria-describedby` pointing to an error message span, not only via `:invalid` CSS state.
- **NFR-A5:** WCAG 2.2 SC 1.3.5 (Identify Input Purpose) — for text entry fields where the semantic purpose is discernible (e.g., a field asking for a number), `autocomplete` attributes should be omitted or set to `"off"` to prevent browser auto-fill from injecting incorrect values into assessment inputs.
- **NFR-A6:** Touch targets for the `<input>` (min 100 px wide, `input-sm` height ~32 px) and `<select>` (min 120 px wide, `select-sm` height ~32 px) must meet the WCAG 2.2 SC 2.5.8 minimum target size of 24×24 px. Both currently exceed this threshold.
- **NFR-A7:** Color alone must not be used to indicate the correct-answer state. The `✓` suffix on the correct option label and the `"Correct: {text}"` badge satisfy this requirement for the scorer role.

### Performance

- **NFR-P1:** The regex-based placeholder substitution runs synchronously in a Svelte `$derived.by()`. For items with up to 20 inline interactions (the practical upper bound for a cloze passage), this is negligible. Items with more than 20 inline interactions may introduce perceptible lag — this has not been measured and is an open question.

### Cross-platform

- **NFR-CP1:** The `<input>` and `<select>` must be operable on iOS Safari and Android Chrome. Native `<select>` uses the platform's native picker on iOS, which provides large touch targets but limits custom styling. This is acceptable and preferred over custom JS dropdowns for accessibility reasons.
- **NFR-CP2:** `vertical-align: baseline` alignment of inline interactions must be visually verified across Chrome, Firefox, Safari on desktop and mobile.

### i18n

- **NFR-I1:** The placeholder option text in the inline choice dropdown is localised via `i18n?.t('interactions.inline.selectPlaceholder', 'Select...')`. The `"Select..."` fallback is used when no `i18n` provider is supplied. This string must be present in all supported locale bundles.

---

## Design decisions

### Placeholder-string pipeline instead of a portal or slot approach

**Decision:** Replace inline interaction elements with sentinel strings during HTML serialisation, then split on those sentinels to interleave Svelte-rendered inputs with `{@html}` HTML segments.  
**Rationale:** The fundamental problem is that Svelte components and raw HTML cannot coexist in a single `{@html}` directive — `{@html}` emits a static HTML string with no reactivity. The alternatives are: (a) parse and reconstruct the entire item body as a Svelte component tree (prohibitively expensive for complex item bodies with rich formatting); (b) use a MutationObserver to hydrate interaction elements after `{@html}` renders (brittle, introduces a one-frame flash); (c) the sentinel approach. The sentinel approach is the simplest implementation that preserves Svelte reactivity for the interaction elements while allowing arbitrary HTML content around them.  
**Alternatives considered:** Custom element portal (rejected: shadow DOM boundary incompatible with inline positioning); MutationObserver hydration (rejected: timing complexity, flash of unstyled content); full Svelte template reconstruction (rejected: too costly for the common case).  
**Consequences:** Custom renderers cannot override inline interactions via the component registry. The placeholder regex must be kept in sync between the HTML transformation step (`ItemBody.svelte` lines 85–91) and the segment parser (lines 134–161). If QTI 3.0 element names (`qti-text-entry-interaction`) appear in the raw HTML, they must be normalised to the QTI 2.x form before the regex runs — or the regex must be extended to match both forms. Currently only the QTI 2.x forms are matched by the HTML transformation regex.

### `aria-label` derived from `responseIdentifier`

**Decision:** Use `aria-label="Text entry {responseId}"` and `aria-label="Inline choice {responseId}"` as the accessible name for inline interactions.  
**Rationale:** Inline interactions have no adjacent visible `<label>`. The surrounding prose provides context for sighted users but is not programmatically associated with the form control. The `responseIdentifier` is the only stable, unique identifier available at render time. Using `aria-label` rather than `aria-labelledby` avoids requiring a DOM ID on surrounding text, which may be multi-sentence prose with no obvious wrapping element.  
**Alternatives considered:** `aria-labelledby` pointing to the nearest `<p>` or parent container (rejected: the nearest element may contain multiple inline interactions, making the label non-specific); no label at all (rejected: WCAG 2.2 SC 4.1.2 failure); author-provided label via `placeholderText` (partially adopted: `placeholderText` appears as `placeholder` but is not currently used in the `aria-label`).  
**Consequences:** `responseIdentifier` values like `RESPONSE_1`, `RESPONSE_2` are not meaningful to a screen reader user. Item authors should use descriptive identifiers. This is a known accessibility limitation of the current implementation. A future improvement would combine the preceding sentence text with the identifier to form a richer label.

### No dedicated web component for inline interactions

**Decision:** Inline interactions are rendered as native `<input>` and `<select>` elements directly in `ItemBody.svelte`, not as registered web components.  
**Rationale:** See [Background — Why there is no web component](#why-there-is-no-web-component). The component registry extension point does not apply to these two interaction types.  
**Alternatives considered:** Shadow DOM web component with `display: inline` (rejected: shadow root creates a stacking context that breaks baseline alignment in some browsers; inline custom elements cannot participate in `aria-flowto` natural reading order).  
**Consequences:** There is no `pie-qti-text-entry` or `pie-qti-inline-choice` tag name. Hosts that scrape the DOM for these tag names will not find them. Customising inline interaction appearance requires CSS targeting `.inline-input` / `.inline-select` classes, or modifying `ItemBody.svelte`.

### `select` over custom dropdown for `inlineChoiceInteraction`

**Decision:** Render `inlineChoiceInteraction` as a native HTML `<select>` element.  
**Rationale:** Native `<select>` is fully keyboard-accessible without any JavaScript, is operable by assistive technologies on all target platforms, and uses the native OS picker on mobile (which provides large, accessible touch targets). Custom dropdown implementations (custom list boxes with ARIA roles `combobox` / `listbox`) are significantly more complex to implement correctly and are a known source of accessibility failures.  
**Alternatives considered:** Custom ARIA listbox (rejected: implementation complexity, high risk of accessibility bugs); `<datalist>` (rejected: not a selection from a fixed set — user could type arbitrary text in a `<datalist>`-backed `<input>`).  
**Consequences:** The `<select>` appearance is largely controlled by the OS on mobile. DaisyUI's `select-bordered select-sm` classes provide styling on desktop but are overridden by the native picker on iOS. This is acceptable.

---

## Data model / contracts

### `TextEntryInteractionData`

Defined in `packages/item-player/src/types/interactions.ts`:

```ts
interface TextEntryInteractionData extends BaseInteractionData {
  type: 'textEntryInteraction';
  expectedLength: number;    // characters; default 20
  patternMask: string | null; // regex string; null when not set
  placeholderText: string;    // empty string when not set
}
```

Response value type: `string` (raw, uncoerced).

### `InlineChoiceInteractionData`

```ts
interface InlineChoiceInteractionData extends BaseInteractionData {
  type: 'inlineChoiceInteraction';
  shuffle: boolean;
  choices: Array<{ identifier: string; text: string }>;
}
```

Response value type: `string` (the selected choice `identifier`; empty string when unselected).

### Scorer-role display contract

When `roleCapabilities.canViewCorrectResponses` is `true`:
- `correctAnswer` is read from `correctResponses[responseId]`.
- For text entry: the input value is replaced with `correctAnswer`; `aria-label` is extended with `". Correct answer: {correctAnswer}"`.
- For inline choice: the select value is replaced with `correctAnswer`; each option whose `identifier === correctAnswer` gets a ` ✓` suffix; a `badge-success` badge appears above the select showing `"Correct: {choice.text}"`.

---

## Acceptance criteria

### Functional — `textEntryInteraction`

```
AC-1: Basic text entry response
  Given: An item with a textEntryInteraction (responseIdentifier="RESPONSE1")
  When: The candidate types "Paris" into the input
  Then: onResponseChange is called with ("RESPONSE1", "Paris")
  Notes: No debounce; fires on every input event.

AC-2: Input width proportional to expectedLength
  Given: An item with textEntryInteraction expectedLength="10"
  When: The item is rendered
  Then: The input element has an inline width style of "80px" (10 * 8) but min-width of 100px applies, so the rendered width is 100px

AC-3: Input width for larger expectedLength
  Given: An item with textEntryInteraction expectedLength="30"
  When: The item is rendered
  Then: The input has an inline width of "240px"

AC-4: placeholderText appears as HTML placeholder
  Given: An item with textEntryInteraction placeholderText="Enter your answer"
  When: The item is rendered
  Then: The input has placeholder="Enter your answer"

AC-5: Empty string when placeholderText absent
  Given: An item with textEntryInteraction that has no placeholderText attribute
  When: The item is rendered
  Then: The input placeholder is the default "..." (the hardcoded placeholder in ItemBody.svelte)

AC-6: Disabled state prevents input
  Given: An item rendered with disabled=true
  When: The textEntryInteraction input is inspected
  Then: The input has the HTML disabled attribute and does not accept input

AC-7: Scorer role shows correct answer
  Given: An item with textEntryInteraction, role="scorer", correctResponse["RESPONSE1"]="Paris"
  When: The item is rendered
  Then: The input value is "Paris"; the input has green border (border-success) and tinted background

AC-8: Multiple text entries are independent
  Given: An item body with two textEntryInteractions: responseIdentifier="BLANK1" and responseIdentifier="BLANK2"
  When: The candidate types "cat" into BLANK1 and "dog" into BLANK2
  Then: onResponseChange fires ("BLANK1","cat") for the first and ("BLANK2","dog") for the second; neither value appears in the other input
```

### Functional — `inlineChoiceInteraction`

```
AC-9: Inline choice response on selection
  Given: An item with inlineChoiceInteraction (responseIdentifier="RESPONSE1") with choices A, B, C
  When: The candidate selects choice B
  Then: onResponseChange is called with ("RESPONSE1", "B") where "B" is the identifier (not the display text)

AC-10: Placeholder option present and unselected by default
  Given: An item with inlineChoiceInteraction rendered with no prior response
  When: The select element is inspected
  Then: The first option has value="" and is selected; its text is the i18n placeholder "Select..." (or locale equivalent)

AC-11: All choices present as options
  Given: An item with inlineChoiceInteraction containing three inlineChoice children (id=A, id=B, id=C)
  When: The item is rendered
  Then: The select has 4 options: the placeholder plus one for each choice, in extraction order

AC-12: Shuffle reorders choices
  Given: An item with inlineChoiceInteraction shuffle="true" with choices A, B, C, D
  When: The item is parsed and rendered multiple times (re-loading from XML each time)
  Then: The order of non-placeholder options differs between at least some loads (probabilistic; passes with overwhelming probability across 5+ loads)

AC-13: Scorer role shows correct choice
  Given: An item with inlineChoiceInteraction, role="scorer", correctResponse["RESPONSE1"]="B", choice B has text "France"
  When: The item is rendered
  Then: Choice B's option label is "France ✓"; a success badge above the select reads "Correct: France"

AC-14: Disabled state prevents selection
  Given: An item rendered with disabled=true
  When: The inlineChoiceInteraction select is inspected
  Then: The select has the HTML disabled attribute
```

### Functional — Cloze patterns (shared)

```
AC-15: Mixed inline interactions in one item body
  Given: An item body: "The ___[BLANK1] of France is ___[BLANK2]" where BLANK1 is inlineChoiceInteraction and BLANK2 is textEntryInteraction
  When: The item is rendered
  Then: The select for BLANK1 and the input for BLANK2 both appear inline within the prose; surrounding text is preserved; both interactions are independently operable

AC-16: Inline interactions do not break adjacent text
  Given: An item body with a textEntryInteraction in the middle of a sentence
  When: The item is rendered
  Then: The text before and after the input appears on the same baseline; no line breaks are inserted by the interaction renderer

AC-17: QTI 3.0 element names are handled
  Given: An item using qti-text-entry-interaction and qti-inline-choice-interaction element names
  When: The item is parsed by the extractor
  Then: Both interactions are extracted and rendered identically to their QTI 2.x counterparts
```

### Accessibility

```
AC-A1: Text entry has accessible name
  Given: An item with textEntryInteraction responseIdentifier="BLANK_CAPITAL"
  When: The input is inspected with a screen reader or accessibility tool
  Then: The input has an accessible name containing "BLANK_CAPITAL" (via aria-label)

AC-A2: Inline choice has accessible name
  Given: An item with inlineChoiceInteraction responseIdentifier="COUNTRY_SELECT"
  When: The select is inspected
  Then: The select has an accessible name containing "COUNTRY_SELECT" (via aria-label)

AC-A3: Keyboard navigation between inline interactions
  Given: An item body with two inline interactions (one text entry, one inline choice)
  When: The user presses Tab from outside the item body
  Then: Focus moves to the first inline interaction; pressing Tab again moves to the second; Shift-Tab reverses direction

AC-A4: Inline choice keyboard operation
  Given: A focused inlineChoiceInteraction select
  When: The user presses Alt+Down (Windows) or Space (Mac) to open the dropdown
  Then: The native dropdown opens and choice can be made with arrow keys + Enter/Space

AC-A5: Scorer aria-label includes correct answer
  Given: An item with textEntryInteraction, role="scorer", correctResponse="London"
  When: The input is inspected
  Then: The aria-label contains "Correct answer: London"

AC-A6: No color-only correct-answer indicator
  Given: Scorer role, correct answer is shown for inlineChoiceInteraction
  When: A user with a monochrome display or color blindness views the item
  Then: The correct choice is identifiable by the "✓" suffix in the option text, not only by the green color

AC-A7: Touch target size
  Given: An item rendered on a 375px wide mobile viewport
  When: The inline input and select are inspected
  Then: Both have a height of at least 24px and a width of at least 24px (WCAG 2.2 SC 2.5.8 minimum)
```

### Edge cases

```
AC-E1: patternMask extracted but not enforced (documents current behaviour)
  Given: An item with textEntryInteraction patternMask="[0-9]+"
  When: The candidate types "abc" into the input
  Then: The input accepts "abc" without any validation error (current behaviour — G-04 not yet resolved)
  Notes: Once G-04 is resolved, this AC must be updated to expect a validation error.

AC-E2: label child not extracted (documents current behaviour)
  Given: An item with inlineChoiceInteraction containing <label>Choose a country</label>
  When: The item is rendered
  Then: The placeholder option text shows "Select..." (the i18n default), not "Choose a country" (current behaviour — G-02 not yet resolved)
  Notes: Once G-02 is resolved, this AC must be updated to expect "Choose a country".

AC-E3: required attribute not enforced (documents current behaviour)
  Given: An item with inlineChoiceInteraction required="true"
  When: The candidate submits without making a selection
  Then: The submission is not blocked by the player (current behaviour — required is not extracted)

AC-E4: Single-character expectedLength uses minimum width
  Given: An item with textEntryInteraction expectedLength="1"
  When: The item is rendered
  Then: The input has the minimum width of 100px, not 8px

AC-E5: Zero choices in inlineChoiceInteraction (malformed item)
  Given: An inlineChoiceInteraction element with no inlineChoice children
  When: The extractor runs validate()
  Then: The validator returns an error "inlineChoiceInteraction must have at least one choice"; the item may still render with only the placeholder option

AC-E6: Duplicate choice identifiers (malformed item)
  Given: An inlineChoiceInteraction with two inlineChoice elements both having identifier="A"
  When: The extractor runs validate()
  Then: The validator returns an error "Duplicate choice identifier: A"

AC-E7: Response state preserved across re-render
  Given: An item with a textEntryInteraction where the candidate has typed "hello"
  When: The responses prop is updated from outside (e.g., a restored session)
  Then: The input displays "hello" without the candidate re-typing it

AC-E8: Missing interaction data for placeholder
  Given: An item body HTML where a [TEXTENTRY:MISSING_ID] sentinel appears but no interaction with responseId="MISSING_ID" exists in the interactions array
  When: The item is rendered
  Then: The sentinel is silently dropped (not rendered); no crash occurs
```

---

## Open questions

- [ ] **G-03 priority**: The `format` attribute is a display hint. For numeric formats specifically, should the input switch to `type="number"` or remain `type="text"`? Using `type="number"` has known accessibility issues (screen reader announces "spin button"; step arrows clutter the input; leading zeros are stripped). Decision needed before closing G-03.
- [ ] **Accessible label quality**: The current `aria-label` uses only the `responseIdentifier`. For items with identifiers like `RESPONSE_1`, this is not meaningful. Should the renderer attempt to use `placeholderText` as the primary label and `responseIdentifier` as a secondary qualifier? Requires UX review.
- [ ] **QTI 3.0 HTML transformation regex**: The `ItemBody.svelte` placeholder replacement regex only matches QTI 2.x element names (`textEntryInteraction`, `inlineChoiceInteraction`). If element name normalisation has not run before `getItemBodyHtml()`, QTI 3.0 items with `qti-text-entry-interaction` tags will not be substituted and will appear as raw XML text in the rendered output. Confirm whether normalisation always runs before HTML serialisation.
- [ ] **Performance with large cloze passages**: No measurement of the regex + string-split pipeline at 20+ inline interactions. If items with dense cloze (20+ blanks) are in the target content set, this should be benchmarked.

---

## Related

- QTI spec sections: §3.2.1 (`inlineChoiceInteraction`), §3.2.2 (`textEntryInteraction`) — `docs/QTI_techguide.md`
- Spec gaps: G-02, G-03, G-04 — `docs/SPEC-GAPS-PLAN.md`
- Response tracking and scoring: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Rendering implementation: `packages/item-player/src/components/ItemBody.svelte`
- Extractor — text entry: `packages/item-player/src/extraction/extractors/textEntryExtractor.ts`
- Extractor — inline choice: `packages/item-player/src/extraction/extractors/inlineChoiceExtractor.ts`
- Type definitions: `packages/item-player/src/types/interactions.ts` (`TextEntryInteractionData`, `InlineChoiceInteractionData`)
- Standalone renderer (secondary, used in demos): `packages/default-components/src/shared/components/InlineInteractionRenderer.svelte`
- Existing eval: `docs/evals/default-components/text-entry/evals.yaml`
- Adjacent PRD: `docs/prds/interactions/choice.md` (for comparison with a block-level interaction)
- Adjacent PRD: `docs/prds/interactions/extended-text.md` (planned — shares `patternMask` gap G-04)
