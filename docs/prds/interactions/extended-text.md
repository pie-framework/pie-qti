# PRD: extendedTextInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type (interactions only): extendedTextInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components`, `@pie-qti/item-player`  
**Last reviewed:** 2026-04-28

---

## Summary

`extendedTextInteraction` is the QTI interaction type for multi-line free-text entry. It is the standard vehicle for short-answer, constructed-response, and essay items in K-12 assessments. The PIE-QTI implementation renders the interaction as a rich-text editor (`RichTextEditor.svelte`, backed by TipTap) rather than a plain `<textarea>`. The response variable has baseType `string` and cardinality `single`. Machine scoring via `patternMask` is supported at the extraction level but not yet enforced as a live input constraint (see G-04 below). Human scoring via instructor rubric is the expected path for most deployed items.

---

## Background and rationale

### Why a rich-text editor instead of a plain textarea

The QTI spec allows `format="plain"`, `format="preFormatted"`, and `format="xhtml"`. The spec intent is that the delivery engine uses `format` as a hint about what the candidate should produce, not a strict constraint on what the widget renders. This framework makes a deliberate choice: all three format values are served by the same TipTap-based rich-text editor. The rationale:

1. **K-12 assessment requirements.** Constructed-response items for grades 3-12 frequently require inline math expressions. A plain `<textarea>` cannot render KaTeX math in the editor. Once you need math, you need a rich-text editor regardless of `format`.
2. **Toolbar is minimal.** The current toolbar exposes Bold, Italic, Insert Inline Math, and Insert Block Math. It deliberately omits tables, images, lists, and other advanced elements that are off-scope for constructed-response K-12 items. This is a product constraint, not a spec limit.
3. **`format="xhtml"` is not a rich WYSIWYG.** The QTI spec says `format="xhtml"` means the candidate response is expected to be a fragment of valid XHTML. The full scope of a real XHTML editor (block elements, embeds, tables) is vastly more complex than what K-12 items require. The current TipTap configuration (StarterKit without `codeBlock`, Mathematics extension) satisfies science and math stem requirements without approaching full XHTML-editor complexity. If an item author sets `format="xhtml"` today, the candidate receives the same TipTap editor as `format="plain"` — functionally identical.

### `expectedLength` and `expectedLines` are display hints, not enforced limits

The QTI spec is explicit: `expectedLength` is the expected character count and `expectedLines` is the expected number of lines — both are sizing hints for the delivery engine, not constraints on what the candidate may enter. This implementation maps `expectedLines` to the editor's `minHeight` (number of lines × 24px per line, floored at 200px). No maximum character enforcement is implemented. Items that genuinely require a hard character limit must implement that limit outside the QTI item (e.g. test platform policy) or via `patternMask` as a format validator.

### Machine scoring vs. human scoring

Most deployed extended-text items are human-scored. The QTI spec supports this by setting `externalScored="human"` on the `outcomeDeclaration` for `SCORE`. When this is set, the response processing rules typically assign `SCORE = 0` automatically — the score placeholder is filled by an external scoring system (LMS, rubric engine, human grader). The eval fixtures confirm this: all three evals check `SCORE = 0.0` post-submit, and the sample item uses a rubric.

Machine scoring is possible via `patternMask` (regex validation) combined with `stringMatch` or `patternMatch` operators in response processing. This is appropriate for narrow constructed-response items with a small set of acceptable answers (e.g. a chemistry formula). Machine scoring for open-ended essay items is not a QTI-native concern.

### Scorer role and correct-response display

The component accepts a `role` prop. When `role="scorer"`, it renders the correct response value beneath the editor (if one is declared). This is used in review/grading workflows where an instructor sees both the candidate's response and the model answer side-by-side. The editor itself remains non-editable when `disabled=true`, which the item player sets when rendering in scorer role.

### QTI 3.0 kebab-case mapping

The QTI 3.0 tag name is `qti-extended-text-interaction` (kebab-case) with attribute names like `response-identifier`, `expected-lines`, `expected-length`, `placeholder-text`, `pattern-mask`, `min-strings`, `max-strings`. The `Qti3AttributeNameMapper` in `@pie-qti/qti-common` handles the canonical-to-kebab and kebab-to-canonical conversions. The extractor handles both `extendedTextInteraction` (QTI 2.x) and `qti-extended-text-interaction` (QTI 3.0) in its `canHandle` predicate.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, QTI 2.2, QTI 3.0
- **Spec section(s):** §3.2.3 extendedTextInteraction (see `docs/QTI_techguide.md`)

### Supported attributes

| Attribute | QTI version | Status | Behavior |
|-----------|-------------|--------|----------|
| `responseIdentifier` | 2.x / 3.0 | Supported | Binds to the response variable declared by `responseDeclaration`. Extracted as `responseId` in `ExtendedTextInteractionData`. |
| `expectedLines` | 2.x / 3.0 | Supported (display hint) | Sets the editor's `minHeight` as `expectedLines × 24px`, floored at 200px. Does not enforce a line count limit. Default: 3. |
| `expectedLength` | 2.x / 3.0 | Supported (display hint) | Stored in `ExtendedTextInteractionData.expectedLength`. No character limit is enforced in the UI. Default: 200. |
| `placeholderText` | 2.x / 3.0 | Supported | Passed to TipTap `Placeholder` extension. Rendered via `::before` pseudo-element when the editor is empty. Default: `"Enter your response..."`. |
| `format` | 2.2 / 3.0 | Partially supported | Extracted and stored. All three values (`plain`, `preFormatted`, `xhtml`) render the same TipTap editor; no format-specific rendering distinctions are implemented. Unknown values emit a validator warning. Default: `"plain"`. |
| `patternMask` | 2.x / 3.0 | Extracted, not enforced | Parsed at attribute-mapping level (QTI 3.0 `pattern-mask`). **Not present in `ExtendedTextInteractionData`** — the extractor does not yet forward `patternMask` to the component. See gap G-04. |

### Unsupported / omitted attributes

| Attribute | Reason for omission |
|-----------|---------------------|
| `minStrings` | Only relevant for `cardinality="multiple"` multi-part responses. Multi-part cardinality is not implemented; all responses are `single` cardinality `string`. |
| `maxStrings` | Same as `minStrings`. |
| `stringIdentifier` | Used to bind individual strings in `record` cardinality responses. `record` cardinality is not implemented. |
| `base` | Specifies numeric base for integer responses. Numeric base types are not used in the extended-text player; they apply to formula-entry items handled differently by the to-pie transformer. |

### Known gaps

**G-04: `patternMask` extracted at the QTI 3.0 attribute-mapper level but not forwarded to the Svelte component.**

- `patternMask` is recognized and mapped by `Qti3AttributeNameMapper` (QTI 3.0 `pattern-mask` → `patternMask`).
- However, `ExtendedTextInteractionData` (the typed interface used by the Svelte component) does not include a `patternMask` field.
- The `standardExtendedTextExtractor` does not extract `patternMask` — it is silently dropped.
- The component therefore cannot enforce the regex constraint as a live input validation message.
- **Spec intent:** `patternMask` should block submission or surface an accessible error when input does not match the regex.
- **Required fix:** Add `patternMask?: string | null` to `ExtendedTextInteractionData`. Update the extractor to read the attribute (as `textEntryExtractor` already does). Wire the field in the Svelte component: when `patternMask` is set, validate the editor content on change/blur and surface an `aria-describedby`-linked error message for non-matching input.
- **Tracked in:** `docs/SPEC-GAPS-PLAN.md` §G-04.

---

## Functional requirements

- **FR-1:** The component must render an editable rich-text area when `disabled=false`.
- **FR-2:** The component must render a non-editable (read-only) rich-text area when `disabled=true`.
- **FR-3:** The editor minimum height must be derived from `expectedLines × 24px`, with a floor of 200px. When `expectedLines` is absent or zero, the minimum height must be 200px.
- **FR-4:** When `placeholderText` is non-empty, the placeholder must be visible when the editor content is empty and must disappear as soon as the candidate begins typing.
- **FR-5:** Every keystroke that changes editor content must dispatch a `qti-change` custom event (bubbling) from the host element, carrying the current HTML string as the response value.
- **FR-6:** The `onChange` callback prop (used in Svelte embedding) must also be called on every content change.
- **FR-7:** When `role="scorer"` and a non-null `correctResponse` is provided, the component must display the correct response below the editor in a visually distinct container.
- **FR-8:** The extractor must accept both `extendedTextInteraction` (QTI 2.x) and `qti-extended-text-interaction` (QTI 3.0 kebab-case) element names.
- **FR-9:** The extractor must apply default values when attributes are absent: `expectedLines=3`, `expectedLength=200`, `format="plain"`, `placeholderText=""`.
- **FR-10:** The extractor must emit a validation error if `expectedLines < 1` or `expectedLength < 1`. It must emit a validation warning (not error) for an unrecognized `format` value.
- **FR-11:** The toolbar must include Bold, Italic, Insert Inline Math, and Insert Block Math controls. All toolbar controls must be disabled when the editor is not editable.
- **FR-12:** The math editor (MathLive modal) must open when the user activates Insert Inline Math or Insert Block Math. Confirming the modal must insert a KaTeX-rendered math node at the cursor. Cancelling must return focus to the editor without modification.
- **FR-13:** When the `response` prop is updated externally while the editor is not focused, the editor content must update to reflect the new value without triggering a `qti-change` event.
- **FR-14:** When the `response` prop is updated externally while the editor is focused (active editing), the external update must be silently ignored to prevent clobbering in-progress input.

---

## Non-functional requirements

### Accessibility

- **WCAG 2.2 Level AA** is mandatory for all assessment interactions.
- The TipTap editor div must have `role="textbox"`, `aria-multiline="true"`, and `aria-label` set to the placeholder text (or a localized label from i18n). These are set via TipTap's `editorProps.attributes`. If the placeholder text is empty, the `aria-label` must fall back to the i18n key `interactions.extendedText.placeholder`.
- Toolbar buttons must have `aria-label` attributes sourced from i18n keys (`interactions.extendedText.bold`, `interactions.extendedText.italic`, `interactions.extendedText.insertInlineMath`, `interactions.extendedText.insertBlockMath`). Button labels must not rely on visual icon alone.
- The correct-response panel (scorer role) must be reachable by keyboard and have sufficient color contrast. The current implementation uses `bg-success bg-opacity-10 border-success` DaisyUI classes — contrast must be verified against all 32 supported themes.
- When G-04 (`patternMask`) is implemented: the validation error message must be associated to the editor via `aria-describedby`. The error must appear on blur (not on every keystroke) to avoid ARIA live-region spam. An `aria-live="polite"` region must announce the error when it appears.
- The MathLive modal (triggered by toolbar math buttons) must trap focus while open and return focus to the triggering toolbar button on close (both confirm and cancel paths).
- Touch targets for toolbar buttons must be at least 44×44px on mobile per WCAG 2.5.8 (Target Size, Minimum).

### Performance

- TipTap with StarterKit + Mathematics loads lazily as part of the `@pie-qti/default-components` bundle. No further code-splitting is required at this level; the item player handles lazy plugin loading.
- The editor must not re-create the TipTap instance when `disabled`, `value` (from external update while unfocused), or `editable` changes — only when the mount element (`el`) changes. This prevents expensive editor teardown/init on every prop update.

### Cross-platform

- The editor must be usable on iOS Safari (touch) and Android Chrome. The TipTap `contenteditable` div is used for this; browser virtual keyboards should open naturally without extra handling.
- The toolbar must wrap (`flex-wrap: wrap`) on narrow viewports so buttons do not overflow horizontally.
- The editor container must not set a fixed `height` — only `min-height` — so the editor expands naturally on mobile as the candidate types.

### Security

- The editor stores and emits raw HTML. HTML stored in the response variable must be sanitized before display in any review/grading UI outside the component's `contenteditable` context. This component does not sanitize on its own — sanitization is the host application's responsibility.
- The `format="xhtml"` value does not imply that arbitrary XHTML input is allowed or safe. The TipTap StarterKit restricts the allowed node types at the schema level; nodes outside the schema (e.g. `<script>`) are stripped on paste.

### i18n

- All user-visible strings (toolbar labels, placeholder fallback, error messages) must be sourced from `@pie-qti/i18n` via the `i18n` prop.
- The `i18n` prop is optional; every `i18n?.t(key, fallback)` call must provide a hardcoded English fallback so the component renders correctly without an i18n provider.
- RTL language support: the TipTap editor inherits document direction. No explicit RTL handling is currently implemented beyond CSS inheritance.

---

## Design decisions

### TipTap over native `<textarea>`

**Decision:** Use TipTap (a ProseMirror wrapper) as the editing surface rather than a native `<textarea>`.  
**Rationale:** K-12 science and math items require inline math rendering. A `<textarea>` cannot render KaTeX inside the editing surface. Once math is required, a ProseMirror-based editor is the minimum viable solution. TipTap provides a well-maintained abstraction over ProseMirror with a Svelte-compatible imperative API.  
**Alternatives considered:** `contenteditable` div with a custom math-insertion layer (rejected: too much custom node management); Quill (rejected: less active maintenance, weaker TypeScript story); CodeMirror (rejected: optimized for code, not prose).  
**Consequences:** The response value emitted is HTML (ProseMirror serializes to HTML), not plain text. Response-processing rules that use `stringMatch` must account for HTML tags unless the item system strips them before comparison. The to-pie transformer stores the raw HTML string; the `@pie-element/extended-text-entry` PIE element handles HTML rendering in review/scoring mode.

### Single editor for all `format` values

**Decision:** All three `format` values (`plain`, `preFormatted`, `xhtml`) use the same TipTap editor configuration.  
**Rationale:** Differentiating `plain` (e.g. a monospace textarea with no formatting) from `xhtml` (a rich editor with block elements) would require conditional rendering logic and two distinct editor configurations. For K-12 items in scope, the distinction does not materially affect candidate experience — items do not rely on monospace rendering or explicit XHTML authoring. Implementing `format`-aware rendering is deferred until a concrete item requirement forces it.  
**Alternatives considered:** Rendering `format="plain"` as a native `<textarea>`, rendering `format="preFormatted"` as a monospace `<textarea>`. These are not blocked by the architecture — they would require a conditional in `ExtendedTextInteraction.svelte` and a format-aware `minHeight` calculation.  
**Consequences:** Items authored with `format="xhtml"` expecting a full XHTML editor (e.g. with image embeds or table insertion) will not see those features. This is a known, documented out-of-scope decision.

### Editor state management: no re-creation on prop change

**Decision:** The TipTap `Editor` instance is created once when the mount element (`el`) is available and destroyed when the component unmounts. Subsequent prop changes (`editable`, `value`) are applied imperatively via `editor.setEditable()` and `editor.commands.setContent()`.  
**Rationale:** Creating a new TipTap editor is expensive (ProseMirror schema instantiation, plugin setup, DOM mutation). Re-creating on every `disabled` toggle or external `value` update would cause visible flickering and lose undo history.  
**Consequences:** The `$effect` that handles external `value` updates must not overwrite in-progress edits (guarded by `editor.isFocused`) and must not fire a `qti-change` event for the programmatic update (guarded by `isProgrammaticUpdate` flag and the `lastEmitted` tracking variable). Future engineers modifying this loop should read the comments carefully.

### `minStrings` / `maxStrings` / `record` cardinality are out of scope

**Decision:** Multi-string and record-cardinality response modes are not implemented.  
**Rationale:** Multi-string mode (multiple separate text boxes mapped to multiple response strings) requires a fundamentally different UI: either multiple editors or a UI that adds/removes text entries. `record` cardinality maps named fields to individual strings. Neither pattern appears in the K-12 item corpus in scope for this project. Implementing them would require a new component design.  
**Alternatives considered:** A dynamic list of editors for `maxStrings > 1`.  
**Consequences:** Items that use `minStrings`, `maxStrings`, or `stringIdentifier` attributes will be silently ignored by the extractor. These attributes should be documented as unsupported, and the extractor validator could emit a warning if they are present.

---

## Data model / contracts

### `ExtendedTextInteractionData` (item-player types)

Defined in `packages/item-player/src/types/interactions.ts`:

```typescript
export interface ExtendedTextInteractionData extends BaseInteractionData {
  type: 'extendedTextInteraction';
  expectedLines: number;      // Default 3; used for editor minHeight
  expectedLength: number;     // Default 200; stored but not enforced in UI
  placeholderText: string;    // Default ""; rendered as TipTap placeholder
  format: string;             // Default "plain"; stored but all values use same editor
}
```

Note: `patternMask` is absent from this interface — it is a known gap (G-04). When G-04 is resolved, `patternMask?: string | null` should be added here.

### `ExtendedTextData` (extractor output)

Defined in `packages/item-player/src/extraction/extractors/extendedTextExtractor.ts`. Structurally identical to `ExtendedTextInteractionData` minus the `type` and `responseId` fields (those are added by the base extraction machinery). The extractor's `validate()` enforces:

- `expectedLines >= 1` (error if violated)
- `expectedLength >= 1` (error if violated)
- `format` is one of `plain | preFormatted | xhtml` (warning if not)

### Response variable contract

```xml
<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string" />
```

The response value stored is an HTML string produced by TipTap's HTML serializer (e.g. `<p>My answer here.</p>`). For items using machine scoring with `patternMask` or `stringMatch`, the response processing engine must strip HTML tags before string comparison, or the item author must account for the HTML wrapping in the regex/match expression.

### Event contract (web component usage)

The component dispatches `qti-change` custom events via `createQtiChangeEvent(responseId, html)`. The event bubbles up through the shadow DOM boundary via the host div. The item player listens for this event to update the response variable store.

---

## Acceptance criteria

### Functional

```
AC-1: Basic response capture
  Given: An item with extendedTextInteraction is loaded in candidate mode (disabled=false)
  When: The candidate types "Photosynthesis converts sunlight into chemical energy." in the editor
  Then: A qti-change event fires with value containing that text (wrapped in <p> tags)
  Notes: Check event.detail.value or event.detail.response depending on createQtiChangeEvent contract.

AC-2: Disabled editor
  Given: An item is rendered with disabled=true
  When: The candidate attempts to click the editor and type
  Then: The editor content does not change; no qti-change event fires

AC-3: expectedLines height scaling
  Given: An item with expectedLines="10"
  When: The component renders
  Then: The editor container has min-height >= 240px (10 × 24px)

AC-4: expectedLines default height
  Given: An item with no expectedLines attribute
  When: The component renders
  Then: The editor container has min-height >= 200px

AC-5: placeholderText display
  Given: An item with placeholderText="Describe your reasoning"
  When: The editor is empty
  Then: The placeholder text "Describe your reasoning" is visible inside the editor via CSS ::before content

AC-6: placeholderText disappears on input
  Given: An item with placeholderText="Describe your reasoning"
  When: The candidate types a single character
  Then: The placeholder text is no longer visible

AC-7: Scorer role shows correct response
  Given: An item with a correctResponse value of "ATP is produced in mitochondria"
  And: role="scorer"
  When: The component renders
  Then: A panel below the editor displays "Correct Answer:" followed by the correct response text

AC-8: Candidate role hides correct response
  Given: An item with a correctResponse value
  And: role="candidate"
  When: The component renders
  Then: No correct-response panel is visible

AC-9: format attribute acceptance
  Given: An item with format="preFormatted"
  When: The component renders
  Then: No error or warning is shown; the same TipTap editor renders as for format="plain"

AC-10: Bold toolbar button
  Given: The editor is editable and focused
  When: The candidate selects text and clicks the Bold (B) toolbar button
  Then: The selected text is wrapped in <strong> in the editor output HTML

AC-11: Italic toolbar button
  Given: The editor is editable and focused
  When: The candidate selects text and clicks the Italic (I) toolbar button
  Then: The selected text is wrapped in <em> in the editor output HTML

AC-12: Insert Inline Math
  Given: The editor is editable
  When: The candidate clicks "Insert Inline Math" and enters LaTeX "x^2" in the MathLive modal and confirms
  Then: A rendered KaTeX inline math node appears at the cursor in the editor

AC-13: MathLive modal cancel
  Given: The MathLive modal is open from clicking Insert Inline Math
  When: The candidate clicks Cancel
  Then: The modal closes and the editor content is unchanged; focus returns to the editor

AC-14: External value update (unfocused)
  Given: The editor is rendered with response="initial content"
  And: The editor is not focused
  When: The response prop is updated programmatically to "updated content"
  Then: The editor displays "updated content"
  And: No qti-change event is fired

AC-15: External value update (focused)
  Given: The editor is focused (candidate is actively typing)
  When: The response prop is updated programmatically
  Then: The editor content is NOT overwritten; the candidate's in-progress text is preserved

AC-16: QTI 3.0 element name
  Given: An item using the QTI 3.0 tag <qti-extended-text-interaction> with kebab-case attributes
  When: The extractor processes the element
  Then: The extracted data has the same shape as a QTI 2.x extendedTextInteraction extraction

AC-17: Extractor defaults
  Given: An <extendedTextInteraction responseIdentifier="RESPONSE" /> with no other attributes
  When: The extractor runs
  Then: expectedLines=3, expectedLength=200, format="plain", placeholderText=""

AC-18: Extractor validation — invalid expectedLines
  Given: Data with expectedLines=0
  When: validate() is called
  Then: valid=false and errors includes "expectedLines must be at least 1"

AC-19: qti-change event on every edit
  Given: An editable component with an event listener on the host
  When: The candidate types three characters in sequence
  Then: Three separate qti-change events fire (one per keystroke), each with the accumulated HTML value

AC-20: Toolbar disabled in read-only mode
  Given: disabled=true
  When: The component renders
  Then: All toolbar buttons have the disabled attribute and cannot be activated via keyboard or click
```

### Accessibility

```
AC-A1: Editor ARIA role
  Given: The component is rendered
  When: Inspecting the TipTap editor div
  Then: The element has role="textbox" and aria-multiline="true"

AC-A2: Editor aria-label
  Given: placeholderText="Enter your essay response"
  When: The component renders
  Then: The TipTap editor div has aria-label="Enter your essay response"

AC-A3: Editor aria-label fallback
  Given: placeholderText is empty and no i18n provider is given
  When: The component renders
  Then: The TipTap editor div has a non-empty aria-label (the hardcoded fallback string)

AC-A4: Toolbar button accessible names
  Given: The component is rendered
  When: Inspecting the four toolbar buttons
  Then: Each has a non-empty aria-label attribute in the user's locale (or English fallback)

AC-A5: Keyboard navigation through toolbar
  Given: The component has keyboard focus
  When: The candidate uses Tab to navigate
  Then: Focus visits each toolbar button in DOM order before reaching the editor

AC-A6: Focus return after MathLive modal close
  Given: The candidate opens the Insert Inline Math modal via keyboard
  When: The candidate presses Escape or activates Cancel
  Then: Focus returns to the "Insert Inline Math" toolbar button

AC-A7: Correct-response panel contrast
  Given: role="scorer" and a correct response is rendered
  When: Evaluating against WCAG 1.4.3 (Contrast, Minimum)
  Then: The "Correct Answer:" label and the response text meet 4.5:1 ratio on all supported DaisyUI themes

AC-A8: Read-only state communicated to assistive technology
  Given: disabled=true
  When: Inspecting the TipTap editor div
  Then: The element has aria-readonly="true" or aria-disabled="true" so screen readers announce the non-editable state
  Notes: TipTap's editable=false may not set these automatically; verify and add via editorProps.attributes if needed.
```

### G-04 gap behavior (current state and target state)

```
AC-G04-1: patternMask — current gap (verifies the gap exists)
  Given: An item with patternMask="[0-9]+"
  When: The extractor processes the element
  Then: The extracted ExtendedTextInteractionData does NOT contain a patternMask field
  Notes: This AC documents the known gap. It should FAIL once G-04 is resolved.

AC-G04-2: patternMask — target behavior (verifies fix when G-04 is resolved)
  Given: An item with patternMask="[0-9]+"
  When: The candidate types "abc" and blurs the editor
  Then: An error message is visible near the editor indicating the input does not match the expected format
  And: The error message is associated to the editor via aria-describedby
  Notes: This AC should PASS once G-04 is resolved.

AC-G04-3: patternMask — valid input clears error
  Given: An item with patternMask="[0-9]+" and a validation error is showing after invalid input
  When: The candidate clears the editor and types "42" and blurs
  Then: The error message disappears
  Notes: Requires G-04 fix.
```

### Edge cases

```
AC-E1: Empty response on submit
  Given: The candidate has not typed anything (editor contains only an empty paragraph)
  When: The item is submitted
  Then: The response variable value is either null or the empty-paragraph HTML ("<p></p>"); the item player must handle both gracefully

AC-E2: No interaction data
  Given: The interaction prop is null or undefined
  When: The component renders
  Then: An error message is displayed ("No interaction data provided" or i18n equivalent); no JavaScript exception is thrown

AC-E3: Very large expectedLines
  Given: expectedLines="100"
  When: The component renders
  Then: The editor renders with min-height=2400px; no layout overflow or scroll breakage occurs

AC-E4: HTML paste handling
  Given: The editor is editable
  When: The candidate pastes HTML containing <script>alert(1)</script>
  Then: The script tag is stripped by TipTap's schema; the pasted content contains only text nodes allowed by StarterKit

AC-E5: Math paste via clipboard
  Given: The editor is editable
  When: The candidate pastes a MathML or LaTeX string from outside the editor
  Then: The paste is treated as plain text (no automatic math conversion); the editor does not throw

AC-E6: format="xhtml" — same editor as plain
  Given: An item with format="xhtml"
  When: The component renders
  Then: The same TipTap toolbar and editor appear as for format="plain"; no additional XHTML-specific controls are visible
```

---

## Open questions

- [ ] Should `format="preFormatted"` render the editor with a monospace font (e.g. `font-family: monospace` on `.pie-tiptap`) to signal to the candidate that formatting is significant? There is no spec requirement, but it would be a useful UX hint for code or data entry items.
- [ ] Should `expectedLength` surface a visible character count to the candidate (e.g. "0 / 200 characters")? This is not required by the spec but is common in LMS implementations. If added, the counter must be announced accessibly for screen readers (debounced `aria-live` region).
- [ ] The `format="xhtml"` case is currently silently served as a plain rich-text editor. Should the extractor emit a warning when `format="xhtml"` is detected, since the rendering is not XHTML-compliant?

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.2.3
- Response tracking and scoring: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gap: `docs/SPEC-GAPS-PLAN.md` §G-04 (`patternMask` not enforced)
- Component: `packages/default-components/src/plugins/extended-text/ExtendedTextInteraction.svelte`
- Shared editor: `packages/default-components/src/shared/components/RichTextEditor.svelte`
- Extractor: `packages/item-player/src/extraction/extractors/extendedTextExtractor.ts`
- Type definition: `packages/item-player/src/types/interactions.ts` (`ExtendedTextInteractionData`)
- QTI→PIE transformer: `packages/to-pie/src/transformers/extended-response.ts`
- Eval fixtures: `docs/evals/default-components/extended-text/evals.yaml`
- Adjacent PRD: `docs/prds/interactions/choice.md` (reference PRD for the same framework)
