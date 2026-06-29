# PRD: choiceInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: choiceInteraction
  Last reviewed: 2026-04-27
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-27

---

## Summary

`choiceInteraction` is the QTI interaction type for single-select (radio button) and multiple-select (checkbox) questions. It is the most common interaction in K-12 assessments. The implementation renders `simpleChoice` elements extracted from QTI XML as labelled radio buttons or checkboxes, emits `qti-change` events on every selection change, and supports inline feedback visibility and scorer-role correct-answer highlighting.

---

## Background and rationale

`choiceInteraction` is the workhorse of K-12 assessment: nearly every standardized test and formative assessment includes it. Getting this interaction right sets the quality bar for all others.

**Why radio vs. checkbox is determined by `maxChoices`**: The QTI spec ties the interaction type to the response cardinality — `maxChoices=1` produces a `single`-cardinality `identifier` response (one answer); `maxChoices>1` or `maxChoices=0` (unlimited) produces a `multiple`-cardinality response (a set of answers). Rendering radio buttons for `maxChoices=1` and checkboxes for all other values is the direct, spec-mandated mapping: radios enforce mutual exclusion at the browser level, which is the correct constraint for `single` cardinality. We do not add custom JavaScript to enforce single-selection for radio buttons because the browser already does it, and overriding native behaviour introduces accessibility risk.

**Why `maxChoices=0` means unlimited (not zero)**: The QTI spec explicitly defines `0` as meaning "no upper bound on the number of selections". This is an authoring footgun — item authors who intend "no limit" write `0`, but authors who have not read the spec carefully may write `0` when they mean to write the pool size. The extractor emits a warning when `maxChoices=0` is encountered; the validator also warns when `maxChoices > choices.length`, since both conditions suggest authoring errors. The component renders checkboxes for `maxChoices=0` without enforcing any upper bound, which is spec-correct.

**Why `minChoices` is not extracted or enforced**: The QTI spec defines `minChoices` as a validation hint — the number of choices the candidate must select before the response is considered complete. This attribute is present in the spec but is absent from `ChoiceInteractionData` and not extracted by the choice extractor. This is an unimplemented gap, not an intentional omission. See [Known gaps](#known-gaps). Other interactions (e.g. `selectPointInteraction`) do extract and surface `minChoices`.

**Why `shuffle` does not re-randomize on each render**: The QTI spec requires `shuffle` to produce a consistent random order for a given item session — not a new random order each time the item is rendered. The current implementation shuffles at extraction time (when the item is first parsed), which means the order is stable for the lifetime of the extracted data object. If the item is re-loaded from XML, the order will differ. This is the correct approach for stateless rendering but means shuffle state is not persisted separately from the extracted data.

**Why `feedbackInline` is filtered through `heuristics`**: Some imported QTI content includes `feedbackInline` elements directly inside `simpleChoice` text. The QTI spec allows this, but the content was authored for a specific delivery engine that may have rendered it differently. The `heuristicsConfig.feedbackTextFormatting` flag enables a post-processing pass (`processFeedbackInline`) that strips or conditionally shows inline feedback based on `outcomeValues`. This is a best-effort compatibility feature for imported content, not a core spec requirement.

**Why correct-answer highlighting is role-gated**: The `role` prop controls whether `correctResponse` is visible. Only the `scorer` role sees the correct-answer badge and green highlight. The `candidate` role never sees the correct response during interaction, even if `correctResponse` is populated — exposing it would violate the QTI spec's `rubricBlock` role semantics and undermine assessment integrity.

**Why the component uses shadow DOM**: All default components use Svelte's `customElement` compilation target, which produces a web component with shadow DOM. Shadow DOM provides style encapsulation so host-page CSS cannot accidentally style assessment content. The `::part()` API (`root`, `option`, `label`, `input`, `text`) allows intentional host customisation without leaking arbitrary styles into the assessment. DaisyUI classes are used internally but fall back gracefully via CSS custom properties when DaisyUI is not loaded.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place)  
**Spec section:** §3.1.1 choiceInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `choiceInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used as radio `name` attribute and in `qti-change` event payload |
| `shuffle` | ✅ Full | Shuffles choice order at extraction time; stable for the lifetime of the extracted object |
| `maxChoices` | ✅ Full | `1` → radio buttons; `>1` or `0` → checkboxes; `0` triggers a validator warning |
| `minChoices` | ❌ Not extracted | Spec defines this as a completeness constraint. Not in `ChoiceInteractionData`; not enforced. See Known gaps. |
| `orientation` | ❌ Not extracted | Visual hint (`horizontal`/`vertical`). Not in `ChoiceInteractionData`. The component always renders vertically. Low priority since most K-12 content doesn't use it. |

### Supported attributes on `simpleChoice`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required; deduplicated; used as radio/checkbox value and in response |
| `fixed` | ❌ Not extracted | Spec: when `shuffle=true`, `fixed=true` choices retain their authored position. Not extracted or preserved. If `shuffle=true` and any choice is `fixed`, the fixed choice may be reordered. See Known gaps. |
| `templateIdentifier` | ❌ Not extracted | Links choice to a `TemplateDeclaration` for conditional visibility. Not implemented. |
| `showHide` | ❌ Not extracted | Companion to `templateIdentifier`. Not implemented. |
| class (CSS classes) | ✅ Partial | Extracted as `classes?: string[]` on each choice; passed through to host for custom renderer detection. Not rendered as CSS classes in the default component. |

### Response variable contract

- **baseType:** `identifier`
- **cardinality:** `single` when `maxChoices=1`; `multiple` when `maxChoices>1` or `0`
- **Value format (single):** a single `identifier` string matching one `simpleChoice`
- **Value format (multiple):** an array of `identifier` strings, in selection order (not sorted)
- **Null/empty:** `null` before any selection (single); `[]` before any selection (multiple)

### Standard response processing templates

- **MATCH_CORRECT** — correct when `RESPONSE` equals `correctResponse`. Used for `maxChoices=1`.
- **MAP_RESPONSE** — partial credit via `mapping` on the `ResponseDeclaration`. Each choice identifier maps to a point value; `mappingDefault` applies to unmapped identifiers (default 0.0). Used for multi-select partial credit.
- Custom `responseCondition` branching is also valid and common.

### Known gaps

- **G-09 (PNP elimination tool):** Implemented for `choiceInteraction`; when `pnp.cognitive.eliminationTool` is enabled, each choice can be visually eliminated without removing it from the response pool.
- **G-13 (PNP structural labels):** When `pnp.structuredLabelSupport` is enabled, interaction prompts should carry additional ARIA group role and label markup for screen-reader clarity. Not implemented. Tracked in `docs/SPEC-GAPS-PLAN.md`.
- **`minChoices` not enforced:** The spec requires the player to treat the response as incomplete if fewer than `minChoices` identifiers are selected. Not extracted or validated.
- **`fixed` on `simpleChoice` not honoured:** When `shuffle=true` and any choice has `fixed=true`, those choices should remain in their authored position. Currently all choices are eligible for shuffling.
- **`templateIdentifier`/`showHide` not implemented:** Template-variable-driven conditional choice visibility is not supported.

---

## Functional requirements

- **FR-1:** When `maxChoices=1`, render choices as mutually exclusive radio buttons within a named group. Selecting one deselects all others.
- **FR-2:** When `maxChoices>1` or `maxChoices=0`, render choices as independent checkboxes.
- **FR-3:** On each selection change, emit a `qti-change` CustomEvent with `{ responseIdentifier, value }` from the root element. The event must bubble.
- **FR-4:** Accept a `response` prop (string for single, string[] for multiple) and reflect it as checked state without requiring a re-render of the whole component.
- **FR-5:** When `disabled=true`, all inputs must be non-interactive. Disabled state must be visually distinct.
- **FR-6:** When `shuffle=true`, present choices in a shuffled order. The order must be stable (not re-randomised on re-render).
- **FR-7:** When `role='scorer'` and `correctResponse` is provided, visually distinguish correct choices (green highlight, badge). Do not reveal correct answers to any other role.
- **FR-8:** Render `feedbackInline` elements inside choice text conditionally based on `outcomeValues` when `heuristics.feedbackTextFormatting` is enabled.
- **FR-9:** Render the `prompt` HTML content above the choice list when present.

---

## Non-functional requirements

- **Accessibility:** Each choice must be a native `<input type="radio">` or `<input type="checkbox">` wrapped in a `<label>`. The label must contain both the input and the choice text so the entire label is clickable. Radio inputs sharing the same `name` attribute form an ARIA radio group. Touch targets must be at least 44×44 CSS px (WCAG 2.2 SC 2.5.8). The component must be operable by keyboard: Tab to reach the group, arrow keys to navigate within radio groups, Space to toggle checkboxes.
- **Performance:** Extraction and rendering must complete in under 16 ms for up to 10 choices on a mid-range mobile device. Shadow DOM means no layout recalculation from host-page style changes.
- **Cross-platform:** Touch selection (tap to choose) must work identically to mouse click. The interaction must be usable on both portrait and landscape mobile orientations.
- **i18n:** The "Correct" badge label is translated via the `i18n` provider under key `interactions.choice.correct`. Falls back to the string `'Correct'` when no provider is supplied.
- **Security:** Choice text is rendered via `{@html}`. Content is sanitized upstream by the item player's HTML sanitizer before reaching the component. The component trusts the `interaction.choices[*].text` values as safe HTML.

---

## Design decisions

### Radio vs. checkbox is driven by `maxChoices`, not by the ResponseDeclaration cardinality

**Decision:** Use `maxChoices === 1` (extracted from the interaction element) to decide radio vs. checkbox — not the cardinality of the `ResponseDeclaration`.  
**Rationale:** The component receives the extracted `ChoiceInteractionData`, which includes `maxChoices` directly. Looking up the `ResponseDeclaration` cardinality would require the component to reach into the item player's variable system, coupling the default component to the player's internal state. `maxChoices=1` implies `single` cardinality by the QTI spec, so reading `maxChoices` is equivalent and keeps the component self-contained.  
**Alternatives considered:** Read `cardinality` from a passed `ResponseDeclaration`. Rejected: adds coupling and requires an additional prop.  
**Consequences:** If a non-conformant QTI item declares `maxChoices=1` with `multiple` cardinality (which is invalid per spec), the component will render radios and produce a single-string response, which will mismatch the declared cardinality. This is an authoring error and the extractor's validator will flag `maxChoices` inconsistencies.

### Props accept both parsed objects and JSON strings

**Decision:** `interaction`, `response`, `correctResponse`, and `i18n` are each parsed with `parseJsonProp` before use.  
**Rationale:** When the component is used as a native web component (via HTML attributes), all prop values arrive as strings. When used as a Svelte component inside the item player, they arrive as typed objects. `parseJsonProp` handles both transparently. Without this, the web component usage would require a separate wrapper component.  
**Consequences:** There is a small runtime cost of attempting JSON.parse on every render for the web component case. This is negligible for the number of choices involved.

### `qti-change` events are dispatched from the root `<div>`, not the `<input>`

**Decision:** Events are dispatched from the root element (`bind:this={rootElement}`), not the individual `<input>` elements.  
**Rationale:** Web components with shadow DOM have event retargeting: events from inside the shadow root are retargeted to the host element when they cross the shadow boundary. However, custom events with `composed: true` need to originate from inside the shadow root to be retargetable correctly. Dispatching from the root `<div>` inside the shadow root, rather than from the `<input>`, means the payload (responseIdentifier + value) is already assembled and the event type is `qti-change`, not the native `change` event. This gives the item player a consistent, interaction-agnostic event API regardless of which component type fired it.

---

## Data model / contracts

### `ChoiceInteractionData` (from `@pie-qti/item-player`)

```typescript
interface ChoiceInteractionData extends BaseInteractionData {
  type: 'choiceInteraction';
  responseId: string;           // from responseIdentifier attribute
  shuffle: boolean;             // shuffled order applied at extraction time
  maxChoices: number;           // 1 = single (radio), >1 or 0 = multiple (checkbox)
  prompt: string | null;        // HTML content of <prompt> child, or null
  choices: Array<{
    identifier: string;         // from simpleChoice identifier attribute
    text: HtmlContent;          // HTML content of simpleChoice (may contain MathML, feedbackInline)
    classes?: string[];         // CSS classes from simpleChoice element (for custom renderers)
  }>;
  interactionClasses?: string[]; // CSS classes from choiceInteraction element (for custom renderer detection)
}
```

**Invariants enforced by extractor:**
- `choices` has at least one entry (error if zero)
- All `identifier` values are non-empty and unique within the interaction (error on duplicate)
- `maxChoices >= 0` (error if negative)

**Invariants that are NOT enforced (gaps):**
- `minChoices` is not in the type and not checked
- `fixed` per choice is not in the type
- The number of selected choices vs `maxChoices` is not validated at response-collection time

---

## Acceptance criteria

### Functional

```
AC-1: Single-select renders as radio buttons
  Given: an item with choiceInteraction maxChoices=1 and 4 simpleChoices (A, B, C, D)
  When: the item is rendered at /item-demo/simple-choice
  Then: four radio inputs are visible, each with a label containing the choice text
  Notes: inputs must share the same name attribute (the responseIdentifier)

AC-2: Selecting a radio updates the response and fires qti-change
  Given: the item from AC-1 is rendered
  When: the user clicks choice A
  Then: choice A appears checked; a qti-change event fires with value="ChoiceA"

AC-3: Selecting a second radio deselects the first
  Given: the item from AC-1 with choice A already selected
  When: the user clicks choice B
  Then: choice B is checked; choice A is unchecked; qti-change fires with value="ChoiceB"

AC-4: Multi-select renders as checkboxes
  Given: an item with choiceInteraction maxChoices=3 and 4 simpleChoices
  When: the item is rendered
  Then: four checkbox inputs are visible (not radio); each is independently togglable

AC-5: Multiple selections accumulate in the response
  Given: the item from AC-4 with no selections
  When: the user checks A, then checks B
  Then: qti-change fires twice; the second event value is ["ChoiceA","ChoiceB"] (or equivalent array)

AC-6: Unchecking a checkbox removes it from the response
  Given: the item from AC-4 with A and B checked
  When: the user unchecks A
  Then: qti-change fires with value=["ChoiceB"]

AC-7: disabled=true prevents interaction
  Given: the item from AC-1 with disabled=true
  When: the user attempts to click any choice
  Then: no choice becomes selected; no qti-change event fires; inputs appear visually disabled

AC-8: Correct scoring with MATCH_CORRECT
  Given: the item from AC-1 with correct answer ChoiceA (MATCH_CORRECT template)
  When: the user selects ChoiceA and submits
  Then: SCORE=1.0, MAXSCORE=1.0

AC-9: Wrong answer scores zero
  Given: the item from AC-1
  When: the user selects ChoiceD and submits
  Then: SCORE=0.0, MAXSCORE=1.0

AC-10: Partial credit via MAP_RESPONSE
  Given: the item at /item-demo/partial-credit with MAP_RESPONSE scoring
  When: the user selects a partially-correct choice (ChoiceB) and submits
  Then: SCORE=2.0, MAXSCORE=3.0

AC-11: MathML renders correctly in choice text
  Given: the item at /item-demo/math-inline with MathML in choice labels
  When: the item renders and math typesetting has run
  Then: math symbols are visible and correctly formatted; no raw XML tags appear

AC-12: Prompt is rendered above choices
  Given: an item whose choiceInteraction has a <prompt> child
  When: the item renders
  Then: the prompt HTML appears above the first choice
```

### Accessibility

```
AC-A1: Radio group keyboard navigation
  Given: the single-select item from AC-1 rendered without a pre-selected value
  When: the user presses Tab to reach the radio group
  Then: focus lands on the first radio; arrow keys move focus between radios; Space/Enter selects

AC-A2: Checkbox keyboard operation
  Given: the multi-select item from AC-4
  When: the user Tabs to each checkbox
  Then: Space toggles the checked state; the qti-change event fires accordingly

AC-A3: Label click activates the input
  Given: any choice item
  When: the user clicks the label text (not the input itself)
  Then: the corresponding input becomes checked/unchecked

AC-A4: Touch target size
  Given: any choice item rendered on a 375px viewport
  When: each choice option is inspected
  Then: the clickable area is at least 44×44 CSS px per WCAG 2.2 SC 2.5.8

AC-A5: Disabled state is conveyed
  Given: the item rendered with disabled=true
  When: a screen reader reaches a choice input
  Then: the input is announced as disabled
```

### Edge cases

```
AC-E1: maxChoices=0 renders checkboxes (unlimited)
  Given: an item with maxChoices=0
  When: the item renders
  Then: checkboxes appear; any number of choices can be selected without error

AC-E2: Single choice pool (1 simpleChoice)
  Given: an item with one simpleChoice
  When: the item renders
  Then: one radio or checkbox appears without errors; the interaction is functional

AC-E3: Choice text with HTML (bold, italic, images)
  Given: a simpleChoice whose text contains <strong> and <em> tags
  When: the item renders
  Then: the formatted text appears in the label without rendering raw tags

AC-E4: Response prop reflects pre-set value on mount
  Given: an item with response="ChoiceB" passed on mount (single-select)
  When: the item renders
  Then: ChoiceB appears pre-checked; no qti-change event fires on initial render

AC-E5: Scorer role shows correct answers
  Given: the item rendered with role="scorer" and correctResponse="ChoiceA"
  When: the item renders
  Then: ChoiceA has a green highlight and a "Correct" badge; other choices are normal

AC-E6: Candidate role does not reveal correct answers
  Given: the item rendered with role="candidate" and correctResponse="ChoiceA"
  When: the item renders
  Then: no choice has a correctness indicator; ChoiceA looks identical to other choices
```

---

## Open questions

- [ ] Should `minChoices` be extracted and surfaced as a validation hint in the component (e.g. "Select at least N options")? Currently not implemented. The spec intends this as a completeness constraint that delivery engines should surface.
- [ ] Should `fixed` on `simpleChoice` be extracted? Deferred because most K-12 content doesn't use it, but "None of the above" items authored with `fixed=true` will be shuffled incorrectly if `shuffle=true`.
- [ ] Should `orientation=horizontal` be honoured with a CSS grid or flex layout? Deferred; most items are vertical.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.1.1
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-09 (PNP elimination tool), G-13 (structural labels)
- Component: `packages/default-components/src/plugins/choice/ChoiceInteraction.svelte`
- Extractor: `packages/item-player/src/interactions/choice/extractor.ts`
- Type: `packages/item-player/src/interactions/shared/types.ts` — `ChoiceInteractionData`
- Adjacent PRDs: [order.md](order.md) (shares shuffle pattern), [hottext.md](hottext.md) (similar selection mechanics), [match.md](match.md) (matchGroup/matchMin gaps)
