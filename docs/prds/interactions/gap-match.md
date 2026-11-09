# PRD: gapMatchInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: gapMatchInteraction
  Last reviewed: 2026-11-07
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor, type)  
**Last reviewed:** 2026-11-07

---

## Summary

`gapMatchInteraction` is the QTI interaction type for cloze-style reading-comprehension questions: the candidate sees a stimulus passage with inline blank slots (`<gap>` elements) and a separate pool of draggable text labels (`<gapText>` elements). The candidate associates each label with a gap by dragging it, dropping it, or clicking to select-and-place. The response is a set of directed pairs, each recording which label filled which gap.

This is distinct from `matchInteraction` (a grid of row-column pairings) and `associateInteraction` (undirected pairings between a flat pool of choices). In `gapMatchInteraction` the direction is always `gapText → gap`, the gaps are embedded inside flowing prose, and the label pool is displayed separately from the stimulus. The asymmetry matters for scoring: the response type is `directedPair`, not `pair`, because the two elements of each pairing play different semantic roles.

---

## Background and rationale

**Why gaps live inside the stimulus and labels live in a separate pool**: The pedagogical intent is different from `matchInteraction`. A gap-match item tests whether a candidate can reconstruct a complete sentence or paragraph — they must read the surrounding text to decide which label fits. Placing the labels outside the prose forces the candidate to engage with context rather than pattern-match a grid. The QTI spec encodes this structurally: `<gap>` elements appear inside block content (inside the `<itemBody>` or inside a `<prompt>` block); `<gapText>` elements are children of the `<gapMatchInteraction>` element, outside the stimulus. The extractor must handle both structural patterns (see [Extractor: two-structure problem](#extractor-two-structure-problem)).

**Why `directedPair` and not `pair`**: QTI uses `pair` when two identifiers are interchangeable (as in `associateInteraction`) and `directedPair` when order matters. For gap matching, the first element of each pair is always a `gapText` identifier and the second is always a `gap` identifier. Reversing the order would represent a semantically different (and invalid) mapping. Response-processing templates, mapping lookups, and `correctResponse` declarations all depend on this ordering being consistent. The implementation encodes this as the string `"gapTextId gapId"` (space-separated), which is the standard QTI serialisation for a `directedPair` value.

**Why the label pool should be larger than the number of gaps**: If the pool contains exactly as many labels as gaps, a candidate who has filled all but one gap correctly can deduce the last answer by elimination without reading the passage. K-12 assessment design guidelines recommend providing at least one or two distractors beyond the number of gaps so that every answer requires genuine comprehension. The spec does not enforce this, and neither does the implementation — it is an authoring responsibility — but item authors and validators should be aware of it.

**Why `matchMax=1` makes a label single-use**: `matchMax` on `gapText` controls how many gaps a label can fill simultaneously. `matchMax=1` (the default) means the label can appear in at most one gap at a time; selecting it for a new gap removes it from the previously filled gap (move semantics). `matchMax=0` means unlimited — the label can be placed in every gap without restriction. Values `>1` set an explicit ceiling. The component enforces this at interaction time, not at submit time, providing immediate visual feedback.

**Why the drag-and-drop is implemented imperatively rather than with Svelte templating**: The `<gap>` elements appear inline within arbitrary HTML prose — inside `<p>`, `<blockquote>`, `<table>` cells, or wherever the author placed them. There is no practical way to express this as Svelte template structure because the gap positions are data-driven, not predictable at component definition time. The extractor converts each `<gap>` element to a `[GAP:id]` placeholder string and the component's `renderPromptWithGaps()` function replaces those placeholders with live `<button>` elements after mounting. Event listeners are tracked and cleaned up in a `cleanupFunctions` array to prevent memory leaks on re-render.

**Why gaps are `<button>` elements and not `<input>` or `<select>`**: Gaps receive drop events (drag-and-drop) and click events (click-to-clear). A native `<select>` dropdown would be more accessible in some respects but would not support drop events without additional scripting, and its visual appearance inside prose text is harder to control cross-browser. A `<button>` can receive both pointer and keyboard events, can be styled to match the surrounding text flow, and allows precise ARIA labelling. The keyboard interaction model (Tab to reach, Enter/Space to clear, focus-visible ring) follows the button pattern from the ARIA Authoring Practices Guide.

**Why gapImg shares the palette with gapText**: The QTI spec defines both `<gapText>` (text labels) and `<gapImg>` (image labels) as valid gap choices for `gapMatchInteraction`. The extractor delivers `<gapImg>` choices as `gapImages`, and the component renders them as image tiles named by their alt text in the same palette, with the same placement rules as words. Image labels placed on a background image instead of into prose are `graphicGapMatchInteraction` (see its PRD).

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name mapping in place via `qti-gap-match-interaction`)  
**Spec section:** §3.1.5 gapMatchInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `gapMatchInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used in `qti-change` event payload |
| `shuffle` | ✅ Full | Shuffles the `gapTexts` palette order at extraction time, seeded from the item session GUID; stable for the whole session, including across re-renders and reloads |

### Supported attributes on `gapText`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required; deduplicated; forms the first element of each `directedPair` response value |
| `matchMax` | ✅ Full | Extracted as `number`; default `1`; `0` = unlimited; `>0` = ceiling; enforced at interaction time (move vs. multi-use) |
| `matchMin` | ✅ Full (G-06) | Delivered when `> 0`; `Player.validateResponses()` reports the response incomplete while the label is used fewer times |
| `matchGroup` | ✅ Full (G-01) | Delivered as `gapTexts[]`/`gapImages[].matchGroup`: the gaps this label may fill. Applied with the gap's own `matchGroup` by the shared rule (see Resolved gaps) |
| class (CSS classes) | ✅ Partial | Extracted as `classes?: string[]`; not used to filter targets in the default component |

### Supported attributes on `gap`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required; deduplicated; forms the second element of each `directedPair` response value |
| `matchGroup` | ✅ Full (G-01) | Delivered as `gapMatchGroups[gapId]`: the labels this gap accepts. Read wherever the gap sits (prompt or body content), as `matchGroup` (QTI 2.x) or `match-group` (QTI 3.0) |
| `required` | ❌ Not extracted | Spec: when `true`, the gap must be filled for a valid response. Not extracted. Treated as optional by the component. |

### Response variable contract

- **baseType:** `directedPair`
- **cardinality:** `multiple`
- **Value format:** array of `"gapTextId gapId"` strings, one per filled gap. Each string is a space-separated directed pair where the first token is the `gapText` identifier and the second is the `gap` identifier. Example: `["W1 G1", "W2 G2", "W3 G3"]`.
- **Null/empty:** `[]` before any gap is filled.
- **Ordering:** array order is not semantically significant; response processing treats this as an unordered set.

### Standard response processing templates

- **MAP_RESPONSE** — the primary template for gap-match items. Each `directedPair` value (`"W1 G1"`, `"W2 G2"`, etc.) is a `mapKey` in the `<mapping>` on the `responseDeclaration`. Each correctly filled gap maps to a point value (typically `1.0`); unfilled gaps and wrong pairings use `mappingDefault` (typically `0.0`). Partial credit is inherent: a candidate who fills two of three gaps correctly receives 2/3 of the total score.
- **MATCH_CORRECT** — all-or-nothing; correct only when every gap is filled with the correct label and no extra pairs are present. Rarely used for gap-match because partial credit is usually pedagogically appropriate.
- Custom `responseCondition` branching is valid and can encode per-gap weighting or penalties.

### Known gaps

None against the specification.

### Resolved gaps

- **`gap required` (fixed 2026-11-09):** QTI defines `required` on `<gap>`: "If true then this gap must be filled by the candidate in order to form a valid response to the interaction" (QTI 2.1 gap; QTI 3.0 §5.55.5, default false). The extractor delivers the required gaps as `requiredGaps`, and `Player.validateResponses()` reports the response incomplete while a required gap is not the target of a pair. The default component does not mark required gaps yet; authors state the requirement in the prompt.

- **G-01 (`matchGroup`, Done):** QTI 2.2 and 3.0 define `matchGroup` on `gapText`, `gapImg` and `gap` as "a list of the identifiers for the objects that can be matched with" it (QTI 2.2.4 ASI Information Model, Tables 5.39.4, 5.37.4, 5.36.4; QTI 3.0, Tables 5.58.4, 5.56.4, 5.55.4). The component decides every placement with `isMatchGroupCompatible` from `@pie-qti/item-player`, the rule `Player.validateResponses()` applies: while a label is held or dragged, the gaps that refuse it are `aria-disabled`, say so in their name, do not accept a drag, and refuse the placement (a held label stays held and the refusal is announced). The rule accepts a pairing when either reading allows it: the specification's (the label and the gap name each other) or the shared-group-label reading some content uses (shared token; a side without `matchGroup` is unrestricted). `matchGroup` no longer makes other labels unavailable once one is placed: it constrains label–gap pairs only.
- **G-06 (`matchMin`, Done):** `Player.validateResponses()` counts each label's appearances and reports the response incomplete while any label is below its `matchMin`.
- **`gapImg`:** extracted as `gapImages` and rendered in the palette (see Background).

---

## Functional requirements

- **FR-1:** Render a visually distinct palette area containing all `gapText` labels as interactive buttons.
- **FR-2:** Render the stimulus passage (from `promptText`) as HTML, with each `[GAP:id]` placeholder replaced by a live drop-target button inline within the text.
- **FR-3:** Support drag-and-drop placement: a candidate may drag a label from the palette and drop it onto a gap button.
- **FR-4:** Support click-to-clear: clicking a filled gap button removes the label from that gap and returns it to the palette (or re-enables it) without requiring drag.
- **FR-5:** Enforce `matchMax` at interaction time: when a label with `matchMax=1` is placed in a new gap, it is simultaneously removed from any gap it previously occupied (move semantics). When `matchMax=0`, the label remains available regardless of how many gaps it fills.
- **FR-6:** Reflect used labels visually: a label that has reached its `matchMax` limit is visually disabled (dimmed, not draggable, `aria-disabled`). A label with `matchMax=0` is never disabled.
- **FR-7:** On each state change, emit a `qti-change` CustomEvent from the root element with `{ responseIdentifier, value: string[] }` where `value` is the current array of `"gapTextId gapId"` pairs.
- **FR-8:** Accept a `response` prop (string array) and reflect the current pairings as filled gap labels and palette state on initial render and whenever the prop changes.
- **FR-9:** When `disabled=true`, all gap targets and palette labels must be non-interactive. No drag-and-drop, no clicks, no state changes. Visually communicated via opacity and `aria-disabled`.
- **FR-10:** When `shuffle=true`, present palette labels in a shuffled order, stable for the lifetime of the rendered item.
- **FR-11:** When `role='scorer'` and `correctResponse` is provided, display the correct label text inside each gap with a green success style. Do not reveal correct answers for `role='candidate'` or any other non-scorer role.
- **FR-12:** Render the optional `prompt` HTML content (above the palette and passage) when present.
- **FR-13:** When `parsedInteraction` is null or undefined, render an error state rather than a blank or broken layout.

---

## Non-functional requirements

### Accessibility

WCAG 2.2 Level AA is mandatory.

- **Keyboard alternative to drag-and-drop (WCAG 2.1 SC 2.1.1):** Implemented as a pick-up flow (K-02): Tab to a palette label and press Enter/Space to pick it up, Tab to a gap and press Enter/Space to place it; Escape cancels and returns focus to the label. Each step is announced in a polite live region. The same select-then-place flow serves single-pointer and touch users.
- **Accessible names for gaps (WCAG 1.3.1):** Each gap button has a translated `aria-label` with its reading-order position, never the gap identifier (which can leak the answer): empty gaps → "Blank 2 of 4. Drop an answer here." (or "Select to place {word} here." while a label is held); filled gaps → "Blank 2 of 4, filled with {word}. Select to clear." A gap whose `matchGroup` refuses the held label adds "Not compatible with the selected word.", and the scorer view adds the correct answer.
- **Accessible name for palette (WCAG 1.3.1):** The palette container has `role="group"` with `aria-label="Available words to place"`. This groups the labels so screen-reader users understand the purpose of the button cluster.
- **Touch targets (WCAG 2.2 SC 2.5.8):** Palette label buttons and gap target buttons must each present a minimum 44×44 CSS px tap target on mobile.
- **Focus visibility (WCAG 2.4.11):** Gap buttons and palette buttons must display a 2px focus-visible outline that meets 3:1 contrast with the surrounding background.
- **Disabled state communication (WCAG 4.1.2):** When `disabled=true`, gap buttons must carry `aria-disabled="true"`. Palette labels that have reached `matchMax` must also carry `aria-disabled="true"` and `disabled` attribute.
- **Drag-and-drop alternative (WCAG 2.5.7 — Level AA in WCAG 2.2):** All drag-and-drop functionality must have a pointer-equivalent alternative (already met by the click-to-clear and the intended select-then-place keyboard pattern).
- **Reading order (WCAG 1.3.2):** Screen readers must encounter the palette before the passage, so users understand what labels are available before reaching the gaps. The DOM order in the component (`palette` before `text`) achieves this.

### Performance

- Extraction and rendering must complete in under 50 ms for items with up to 10 gaps and 15 labels on a mid-range mobile device (2 GHz single-core).
- The `renderPromptWithGaps()` function is called on every response change (to keep gap labels in sync). It operates on a `<template>` element and replaces only the placeholder `<span>` elements, avoiding a full DOM rewrite. For passages up to ~5 kB of HTML this is imperceptible; authors should be warned against extremely long passages (> 20 kB).
- Cleanup of drag event listeners is mandatory on re-render (already implemented via `cleanupFunctions`). Memory leaks in this function would accumulate with every candidate interaction.

### Cross-platform

- Drag-and-drop uses the HTML Drag and Drop API (`dragstart`, `dragenter`, `dragover`, `dragleave`, `drop`). This API is not available on iOS Safari without workarounds. The click-based fallback (click gap to clear) must work on all platforms. A full pointer-event or touch-event alternative for placing labels is required for mobile parity. **This is an open gap** — currently there is no touch-drag implementation.
- Gap buttons must remain inline with the surrounding text at all viewport widths. The minimum gap width (`min-width: 6.25rem`) must not cause line overflow on narrow screens. Test at 320px viewport width.

### i18n

The following strings must be translateable via the `I18nProvider`:

| i18n key | Default |
|----------|---------|
| `interactions.gapMatch.availableLabel` | `"Available words to place"` |
| `interactions.gapMatch.blankGapAriaLabel` | `"Blank {gapId}. Drop an answer here."` |
| `interactions.gapMatch.filledGapAriaLabel` | `"Blank {gapId}, filled with {word}. Click to clear."` |
| `interactions.gapMatch.removeWord` | `"Remove word"` |
| `common.errorNoData` | `"No interaction data provided"` |

### Security

Label text (`gapText.text`) and stimulus HTML (`promptText`) are rendered via `{@html}` and `innerHTML` respectively. Both must be sanitized upstream by the item player's HTML sanitizer before reaching the component. The component trusts these values as safe HTML.

---

## Design decisions

### Extractor: two-structure problem

**Decision:** Support both authoring patterns — `<gap>` elements inside a `<prompt>` child and `<gap>` elements directly in the interaction body (without `<prompt>`).  
**Rationale:** Real-world QTI content from different authoring tools places gaps in different locations. TAO and QTIWorks authoring tools typically use a `<prompt>` wrapper; other tools omit it. The spec allows both; supporting only one would break real item banks.  
**Alternatives considered:** Require `<prompt>`; reject items without it. Rejected: too many existing items would fail.  
**Consequences:** The extractor has two code paths for building `promptText`. Both strip `<gapText>` content and replace `<gap>` elements with `[GAP:id]` placeholders. The path without `<prompt>` strips the outer `<gapMatchInteraction>` tags and all `<gapText>` blocks from the raw HTML, which is fragile if author-added attributes or mixed content introduce edge cases. Whenever an item fails to render gaps correctly, this path is the first place to investigate.

### Gap targets as imperative `<button>` elements

**Decision:** Create gap `<button>` elements imperatively in `renderPromptWithGaps()` rather than using a Svelte template.  
**Rationale:** Gap positions are embedded in arbitrary authored HTML. The stimulus text may contain nested elements (tables, lists, block quotes) and gaps can appear anywhere within that structure. Svelte templates cannot splice reactive elements into arbitrary third-party HTML strings. The only safe approach is to parse the HTML into a `<template>` element, walk the DOM for placeholder `<span>` elements, and replace them with programmatically created `<button>` elements.  
**Alternatives considered:** Use a custom renderer that parses the HTML into a virtual DOM. Rejected: significant complexity with no performance advantage; introduces a dependency on a DOM-diffing library or a hand-rolled HTML parser.  
**Consequences:** The `renderPromptWithGaps()` function must be called whenever `parsedInteraction`, `pairs`, `correctPairs`, or `isShowingCorrect` changes. It runs a DOM write on every selection, which is acceptable for the typical item size (< 20 gaps). The `$effect()` in the component subscribes to all four dependencies.

### Move semantics for `matchMax=1` labels

**Decision:** When a `matchMax=1` label is placed in a new gap, it is automatically removed from any gap it previously occupied.  
**Rationale:** The QTI spec says `matchMax` caps the number of times a label appears in the response. For `matchMax=1`, having the same label in two gaps simultaneously would violate the constraint. Move semantics (rather than blocking the placement) give the candidate the most flexible interaction: they can change their mind by dragging to a new gap without first having to clear the old one.  
**Alternatives considered:** Block the placement and show an error. Rejected: disruptive UX, especially on mobile where accidental mis-drops are common.  
**Consequences:** The `handleGapChange` function removes all existing pairs for both the target gap (ensuring one label per gap) and the source label (when `matchMax` is reached). This must not inadvertently clear a `matchMax=0` label from all gaps.

### `matchMax=0` means unlimited (never disabled)

**Decision:** A `gapText` with `matchMax=0` is never marked as `used` and can be placed into every gap simultaneously.  
**Rationale:** QTI spec §3.1.5 explicitly states `matchMax=0` means "no upper bound". This is the same semantics as `maxChoices=0` on `choiceInteraction`.  
**Alternatives considered:** Treat `0` as "must appear zero times" (i.e. blocked). Rejected: contradicts the spec; would break real items.  
**Consequences:** Items using `matchMax=0` require more careful `correctResponse` and response-processing authoring, since the label could appear in many gaps. The scoring must map each specific `"labelId gapId"` pair, not just the presence of `labelId`.

### Palette "remove" button for used labels

**Decision:** When a label with `matchMax=1` is placed, a separate ✕ button appears beside it in the palette to allow clearing all placements of that label.  
**Rationale:** The gap button click already clears the placement for one specific gap. But if a candidate wants to retract a label entirely (without choosing which gap to click), the palette remove button is more direct. It also makes the "this label is in use" state actionable.  
**Alternatives considered:** Clicking the palette label itself when already placed — difficult UX (ambiguous intent) and the label is `disabled` when at `matchMax`, making it unclickable.  
**Consequences:** The palette layout must accommodate the inline button pair. Screen readers must announce the remove button's purpose distinctly from the label itself.

### Scorer mode replaces gap content with correct labels

**Decision:** In `role='scorer'` mode, each gap is rendered with the correct label text (from `correctResponse`) even if the candidate left it blank. The gap receives a green success style.  
**Rationale:** Item reviewers (human scorers, teachers reviewing results) need to see the complete correct answer overlaid on the passage, not just the candidate's response. Showing both simultaneously in the same gap position would be ambiguous.  
**Alternatives considered:** Show candidate response alongside correct response with distinct colours. Considered but deferred — too complex for the current UI layout; scorer mode is primarily used for review, not side-by-side comparison.  
**Consequences:** When `role='scorer'`, the component ignores `pairs` for gaps where a correct answer exists and shows the correct word instead. The `isShowingCorrect` derived value gates this rendering path.

---

## Data model / contracts

### `GapMatchInteractionData` (from `@pie-qti/item-player`)

```typescript
interface GapMatchInteractionData extends BaseInteractionData {
  type: 'gapMatchInteraction';
  responseId: string;         // from responseIdentifier attribute
  shuffle: boolean;           // shuffle applied at extraction time
  prompt: string | null;      // HTML content of <prompt> child, or null
  gapTexts: Array<{
    identifier: string;       // gapText identifier
    text: string;             // text content of the gapText element
    matchMax: number;         // 0 = unlimited; >= 1 = ceiling
    matchMin?: number;        // present when > 0
    matchGroup?: string[];    // present when authored: the gaps this label may fill
  }>;
  gapImages?: Array<{         // gapImg choices; same placement rules as gapTexts
    identifier: string; src: string; alt: string; matchMax: number;
    matchMin?: number; matchGroup?: string[]; width?: number; height?: number;
  }>;
  gaps: string[];             // gap identifiers, in reading order
  gapMatchGroups?: Record<string, string[]>; // per gap identifier, when authored: the labels it accepts
  promptText: string;         // HTML string with [GAP:id] placeholders replacing <gap> elements
}
```

`gaps` is the plain identifier list the extractor delivers; a compile-time check in the extractor proves the delivered data satisfies this contract. The component derives each gap's position from the `[GAP:id]` markers in `promptText`.

**Invariants enforced by the extractor's `validate()` method:**
- At least one `gapText` must exist (error if zero).
- At least one `gap` must exist in `promptText` (error if zero).
- All `gapText.identifier` values are non-empty and unique within the interaction (error on duplicate).
- All `gap` identifier values are non-empty and unique (error on duplicate).
- `matchMax >= 0` for all `gapText` entries (error if negative).

**Invariants NOT enforced:**
- The number of gaps vs. the number of labels (no warning when `gaps.length >= gapTexts.length`).
- `gap.required` is enforced by response validation, not by the component: a response that leaves a required gap empty is incomplete (see Resolved gaps).

### Response value format

Each element of the `string[]` response is a space-separated directed pair: `"gapTextIdentifier gapIdentifier"`. Both tokens are the `identifier` attribute values exactly as authored. The pair is always in `gapText-first` order. Example for a three-gap item with all gaps filled:

```json
["W1 G1", "W2 G2", "W3 G3"]
```

Partial response (one gap unfilled):

```json
["W1 G1", "W3 G3"]
```

Empty (no gaps filled): `[]`

---

## Acceptance criteria

### Functional

```
AC-1: Palette renders all gapText labels
  Given: an item with gapMatchInteraction containing gapTexts W1 ("photosynthesis"), W2 ("energy"), W3 ("oxygen"), W4 ("water")
  When: the item is rendered at /item-demo/gap-match
  Then: all four labels appear as buttons in the palette area; each button is enabled and draggable

AC-2: Stimulus renders with inline gap targets
  Given: the item from AC-1 with three <gap> elements (G1, G2, G3) in the passage
  When: the item renders
  Then: three blank gap buttons appear inline within the passage text; they have dashed borders and non-empty aria-labels; the surrounding prose text is intact

AC-3: Drag-and-drop places a label in a gap
  Given: the item from AC-1 with all gaps empty
  When: the user drags W1 ("photosynthesis") and drops it onto gap G1
  Then: G1 button displays "photosynthesis"; a qti-change event fires with value containing "W1 G1"; W1 is visually disabled in the palette

AC-4: Click-to-clear removes a label from a gap
  Given: the item from AC-1 with W1 placed in G1
  When: the user clicks the G1 gap button
  Then: G1 is empty again (dashed, blank); qti-change fires with value not containing "W1 G1"; W1 is re-enabled in the palette

AC-5: matchMax=1 moves label (does not duplicate)
  Given: the item from AC-1 with W1 placed in G1
  When: the user drags W1 and drops it onto G2
  Then: G2 shows "photosynthesis"; G1 is empty; qti-change fires with value containing "W1 G2" and not "W1 G1"

AC-6: matchMax=0 label can fill multiple gaps simultaneously
  Given: an item where W1 has matchMax=0
  When: the user places W1 in G1 and then also drags W1 to G2
  Then: both G1 and G2 show the W1 text; W1 remains enabled in the palette; qti-change fires with both "W1 G1" and "W1 G2" in the value

AC-7: Palette remove button clears all placements of a label
  Given: an item with W1 (matchMax=1) placed in G1
  When: the user clicks the ✕ remove button next to W1 in the palette
  Then: G1 is empty; W1 is re-enabled and draggable; qti-change fires with W1 absent from value

AC-8: Full correct response scores maximum
  Given: the item at /item-demo/gap-match (W1→G1, W2→G2, W3→G3 correct)
  When: the user fills G1=W1, G2=W2, G3=W3 and submits
  Then: SCORE=3.0, MAXSCORE=3.0

AC-9: Partial correct response gives partial credit
  Given: the item at /item-demo/gap-match
  When: the user fills G1=W1, G2=W2 and leaves G3 empty, then submits
  Then: SCORE=2.0, MAXSCORE=3.0

AC-10: All incorrect response scores zero
  Given: the item at /item-demo/gap-match
  When: the user fills G1=W2, G2=W3, G3=W1 (all wrong) and submits
  Then: SCORE=0.0, MAXSCORE=3.0

AC-11: disabled=true prevents all interaction
  Given: the item from AC-1 with disabled=true
  When: the user attempts to drag W1, drop on G1, or click any gap or palette button
  Then: no state changes; no qti-change events fire; all buttons appear with reduced opacity and cursor:not-allowed

AC-12: response prop reflects pre-filled state on mount
  Given: an item rendered with response=["W1 G1", "W3 G3"]
  When: the item mounts
  Then: G1 shows "photosynthesis", G3 shows "oxygen", G2 is empty; W1 and W3 are disabled in the palette; W2 is enabled; no qti-change event fires on mount

AC-13: shuffle=true presents labels in non-authored order
  Given: an item with shuffle=true and four gapTexts in authored order W1, W2, W3, W4
  When: the item is rendered twice in the same session (same extracted data)
  Then: the palette order is the same on both renders; it differs from authored order in most cases (shuffle is stable)

AC-14: scorer role shows correct answers in all gaps
  Given: an item with correct response ["W1 G1", "W2 G2", "W3 G3"] and role="scorer"
  When: the item renders with no candidate response
  Then: all three gaps show the correct label text with green success styling; palette remove buttons are absent; no gap is blank

AC-15: candidate role does not reveal correct answers
  Given: the same item with role="candidate" and correctResponse populated
  When: the item renders
  Then: all gaps are blank (or show candidate selections); no green highlight or correct-answer text appears on any gap

AC-16: Optional prompt renders above palette
  Given: an item with a <prompt> element containing the instruction text
  When: the item renders
  Then: the prompt HTML appears above the palette as a bold paragraph; it renders HTML (bold, italic) correctly without raw tags

AC-17: No interaction data shows error state
  Given: the component rendered with interaction=undefined
  When: the DOM is inspected
  Then: an error alert is displayed; no palette or gap elements are rendered; no JS errors occur
```

### Accessibility

```
AC-A1: Empty gap buttons have meaningful aria-labels
  Given: the item from AC-1 with all gaps empty
  When: a screen reader inspects each gap button
  Then: each gap announces as "Blank [gapId]. Drop an answer here." (or the i18n equivalent)

AC-A2: Filled gap buttons announce current content and clear action
  Given: the item with W1 placed in G1
  When: a screen reader inspects the G1 button
  Then: G1 announces as "Blank G1, filled with photosynthesis. Click to clear." (or i18n equivalent)

AC-A3: Palette group is announced as a group with accessible label
  Given: the item rendered
  When: a screen reader navigates to the palette
  Then: the group role is announced with the label "Available words to place" (or i18n equivalent) before the individual buttons

AC-A4: Disabled palette labels are announced as disabled
  Given: the item with W1 (matchMax=1) already placed in a gap
  When: a screen reader navigates to W1 in the palette
  Then: W1 is announced as disabled or unavailable; it is not focusable via Tab (because disabled=true on the button)

AC-A5: Focus-visible ring meets contrast
  Given: the item rendered with the default theme
  When: a gap button or palette button receives keyboard focus
  Then: a visible 2px outline appears; its contrast ratio against the surrounding background is at least 3:1 (WCAG 2.4.11)

AC-A6: Touch targets meet 44x44 minimum
  Given: the item rendered at 375px viewport width
  When: each palette label button and each gap button is measured
  Then: every tap target is at least 44×44 CSS px

AC-A7: Disabled interaction is conveyed via aria-disabled on gaps
  Given: the item rendered with disabled=true
  When: a screen reader inspects any gap button
  Then: the button announces aria-disabled="true" or equivalent; it still receives focus (aria-disabled, not HTML disabled, so it remains in the tab order for review)

AC-A8: Palette labels are keyboard-reachable
  Given: the item rendered without disabled
  When: the user presses Tab repeatedly from the start of the component
  Then: all palette labels receive focus in order; each can be activated with Enter or Space (currently activates nothing — note: this is the gap identified in Non-functional requirements; this AC documents the current reachability, not the full select-then-place flow)
```

### Edge cases

```
AC-E1: Item with more gaps than labels renders without error
  Given: an item with 3 gapTexts and 4 gaps
  When: the item renders
  Then: all gaps are present and blank; no JS error occurs; the extra unfillable gap renders with normal empty styling

AC-E2: Item with exactly as many labels as gaps renders with full pool
  Given: an item with 3 gapTexts and 3 gaps
  When: the item renders
  Then: all three labels and all three gaps are present; no warning appears in the DOM or console

AC-E3: matchMax=2 allows two placements, blocks a third
  Given: an item where W1 has matchMax=2 and there are 4 gaps
  When: the user places W1 in G1 and W1 in G2
  Then: W1 shows as disabled in the palette; placing W1 in G3 is not possible (button disabled, drag rejected)

AC-E4: Replacing a filled gap displaces the previous label
  Given: the item with W1 in G1
  When: the user drags W2 onto G1
  Then: G1 shows W2; W2 becomes disabled (if matchMax=1); W1 is re-enabled; qti-change fires with "W2 G1" and not "W1 G1"

AC-E5: Gap identifiers containing special characters
  Given: an item with a gap identifier containing hyphens (e.g. "gap-01")
  When: the label is placed in that gap
  Then: the pair "W1 gap-01" appears in the response; no parsing error occurs

AC-E6: HTML content in stimulus preserves formatting after gap injection
  Given: an item where the passage contains <strong>, <em>, and a nested <ul> around gap elements
  When: the item renders
  Then: the formatted text is intact; gap buttons appear at the correct inline positions; no tags appear as literal text

AC-E7: matchGroup refuses a pairing neither side allows (G-01)
  Given: gapText W1 with matchGroup="G1", gap G2 with matchGroup="W2"
  When: the candidate picks up W1 (or drags it)
  Then: G2 is aria-disabled and its name adds "Not compatible with the selected word."; placing W1 there
        adds no pair and keeps W1 held; G1 accepts W1 ("W1 G1")

AC-E8: matchGroup on the gap constrains too, and placed labels never block other labels
  Given: gapText W3 with matchGroup="G1 G2", gap G2 with matchGroup="W2"; W4 and W5 share matchGroup="set"
  When: W3 is picked up; separately, W4 is placed and then W5 is picked up
  Then: G2 refuses W3 (G2 does not name W3, and they share no token); W5 stays available after W4 is placed
  Notes: player.validateResponses() accepts exactly the pairs the UI allows (isMatchGroupCompatible)
```

---

## Open questions

- [ ] **Touch/mobile drag-and-drop**: The HTML Drag and Drop API does not fire `dragstart`/`drop` on iOS Safari. Is there a pointer-events or touch-events fallback planned? Until resolved, mobile candidates can only clear gaps, not fill them via drag.
- [ ] **Large pool performance**: At what label count does `renderPromptWithGaps()` become perceptibly slow? Should a threshold trigger a different rendering strategy (e.g. virtual list for the palette)?

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.1.5
- Response processing and scoring: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-01 (`matchGroup`, Done), G-06 (`matchMin` validation, Done)
- Shared pairing rule: `packages/item-player/src/core/matchGroups.ts` (`isMatchGroupCompatible`), used through `packages/default-components/src/shared/utils/matchGroupUtils.ts`
- Component: `packages/default-components/src/plugins/gap-match/GapMatchInteraction.svelte`
- Extractor: `packages/item-player/src/interactions/gap-match/extractor.ts`
- Types: `packages/item-player/src/interactions/shared/types.ts` — `GapMatchInteractionData`
- Evals: `docs/evals/default-components/gap-match/evals.yaml`
- Adjacent PRDs: [match.md](match.md) (shares the `matchGroup`/`matchMin` rules), [associate.md](associate.md) (shares `directedPair`/`pair` semantics), [graphic-gap-match.md](graphic-gap-match.md) (image-based variant; uses `gapImg`)
