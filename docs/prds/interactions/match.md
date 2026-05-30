# PRD: matchInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: matchInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components` (component), `@pie-qti/item-player` (extractor)  
**Last reviewed:** 2026-04-28

---

## Summary

`matchInteraction` presents two distinct, labelled sets of choices — a source column and a target column — and asks the candidate to pair items across them. Each pair is recorded as a `source target` directed string in a `multiple`-cardinality `directedPair` response variable. The implementation renders a two-column drag-and-drop interface (`MatchDragDrop.svelte`) that also supports keyboard and touch pairing, enforces per-choice reuse limits via `matchMax`, and gates correct-answer display behind the `scorer` role. Two spec attributes that affect pairing constraints — `matchGroup` and `matchMin` — are not yet fully honoured; their gaps are documented in §QTI specification alignment.

---

## Background and rationale

### Why `directedPair` means order matters

The QTI `directedPair` baseType encodes an ordered tuple: the first identifier is always the source (first `simpleMatchSet`) and the second is always the target (second `simpleMatchSet`). This is not cosmetic. Response processing templates (`match_correct`, `map_response`) compare `mapEntry` keys against the response using exact string comparison. A response recorded as `"country1 capital1"` will not match a map entry keyed `"capital1 country1"`. Every place that constructs or compares pair strings — `pairHelpers.ts`, scoring templates, the `correctResponse` XML — must treat the pair as `"sourceIdentifier targetIdentifier"`, not the reverse. This is the primary correctness invariant for this interaction.

### Why two distinct sets instead of one pool

`matchInteraction` always has exactly two `simpleMatchSet` elements. Each choice lives in exactly one set. This structural constraint prevents candidates from pairing two items from the same set (e.g., two capital cities), which would be meaningless for the common "capitals to countries" use case. `associateInteraction` is the correct interaction when any-to-any pairing from a single pool is desired (see `docs/prds/interactions/associate.md`).

### Why even pool sizes reduce guessing

When both sets have the same number of items and `maxAssociations` equals that count, a candidate who knows N-1 correct pairings can determine the Nth by elimination — guessing the last pair is guaranteed. This is expected QTI behaviour for one-to-one matching. Authors who want to prevent elimination guessing should add distractors to one set, making it larger than the other. The player does not enforce equal pool sizes; that is an authoring concern.

### The `maxAssociations=0` trap

The QTI spec defines `maxAssociations=0` as meaning "unlimited" — the same zero-means-unlimited convention used by `maxChoices=0` on `choiceInteraction`. The extractor defaults `maxAssociations` to `1` when the attribute is absent, which is the spec default. Authors who intend unlimited associations should write `maxAssociations="0"`. Authors who write `0` expecting it to mean "allow no associations" are misreading the spec; the component will allow unlimited pairings, not zero. The validator does not emit a warning for `maxAssociations=0` but this convention should be documented in authoring guidance.

### Why the target column only accepts one source per target (by default)

The `createOrUpdatePair` helper in `pairHelpers.ts` removes any existing pair for a target before adding the new one. This implements the common case: each target receives exactly one source. A source can point to multiple targets (if its `matchMax > 1`), but a target can only be paired with one source at a time. This is the correct behaviour when every `simpleAssociableChoice` in the target set has `matchMax=1`. If a target has `matchMax>1` the current UI still allows only one source per target — this is a documented limitation because multiple sources per target is rare in K-12 content and the replacement logic would require disambiguating which prior source to displace.

### Why the keyboard pattern uses a two-step select-then-confirm model

Drag-and-drop is not accessible by default. The keyboard pattern is: Tab to a source item, Space/Enter to "select" it (highlighted, `aria-pressed=true`), Tab to a target, Space/Enter to confirm the pairing. Escape cancels the pending selection. This pattern is intentional and follows the ARIA authoring practices "two-step interaction" approach for associating elements without requiring a virtual cursor or ARIA drag-and-drop attributes, which have inconsistent screen-reader support. An `aria-live="polite"` region announces pairings and cancellations as they happen.

### Why shuffle applies to both sets but is not persisted separately

When `shuffle=true`, the extractor returns `sourceSet` and `targetSet` in a shuffled order derived at parse time. The shuffle order is baked into the extracted data object and is stable for the lifetime of that object. If the item is re-parsed from XML, the order will differ. Shuffle state is not serialised as a separate field; the rendered order is whatever order `sourceSet`/`targetSet` carry. This is consistent with how `choiceInteraction` handles shuffle and is acceptable for stateless delivery.

### Why `minAssociations` on the interaction is not extracted

`minAssociations` at the interaction level declares the minimum total number of pairs the candidate must form before the response is considered complete. It is not extracted — neither the extractor's `MatchData` nor the `MatchInteractionData` type has a `minAssociations` field. This is an unimplemented gap. The validator does not enforce it. This is separate from and in addition to the per-choice `matchMin` gap (G-06), which declares per-choice minimum usage count.

---

## QTI specification alignment

**Spec version(s):** QTI 2.1, 2.2 (primary); QTI 3.0 (element name `qti-match-interaction` handled by `canHandle`)  
**Spec section:** §3.1.4 matchInteraction (`docs/QTI_techguide.md`)

### Supported attributes on `matchInteraction`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `responseIdentifier` | ✅ Full | Extracted as `responseId`; used in `qti-change` event payload |
| `shuffle` | ✅ Full | Shuffles choice order within each set at extraction time; stable for the lifetime of the extracted object |
| `maxAssociations` | ✅ Full | Limits total pairs that can be formed; `0` = unlimited per spec; defaults to `1`; enforced in the UI via `matchMax` per source choice |
| `minAssociations` | ❌ Not extracted | Spec: minimum total pairs required; not in `MatchInteractionData`; not enforced at submission |

### Supported attributes on `simpleAssociableChoice`

| Attribute | Support | Behaviour |
|-----------|---------|-----------|
| `identifier` | ✅ Full | Required; deduplicated within each set |
| `matchMax` | ✅ Full | Extracted; controls how many times a source choice can be paired. When `matchMax` pairs for a source are formed, its drag handle is hidden and it cannot be re-selected as a keyboard source |
| `matchMin` | ❌ Gap (G-06) | Extracted but not validated at submission. See Known gaps. |
| `matchGroup` | ❌ Gap (G-01) | Not extracted. See Known gaps. |
| class (CSS classes) | ✅ Partial | Extracted as `classes?: string[]`; passed through in the data model; not applied as CSS classes by the default component |

### Response variable contract

- **baseType:** `directedPair`
- **cardinality:** `multiple`
- **Value format:** an array of strings, each of the form `"sourceIdentifier targetIdentifier"` (source first, target second, space-separated)
- **Null/empty:** `[]` before any pair is created
- **Ordering:** pairs are stored in creation order; response processing templates do not assume any order across pairs (they use set membership, not sequence)

### Standard response processing templates

- **MATCH_CORRECT** — full credit when the response array exactly matches `correctResponse` (all correct pairs present, no extras, considering set equality). Used when every pair must be correct for full credit.
- **MAP_RESPONSE** — partial credit via `mapping` on the `ResponseDeclaration`. Each `mapEntry` key is a `"source target"` string. The scoring engine sums the mapped values for each pair in the response. Unmapped pairs receive `mappingDefault` (typically `0`). This is the standard scoring path for match interactions where each correct pair is worth one point.

### Known gaps

**G-01: `matchGroup` not extracted (`matchExtractor.ts` and `MatchDragDrop.svelte`)**  
The `matchGroup` attribute on `simpleAssociableChoice` is a space-separated list of identifiers. When present, a choice may only be paired with a choice that shares at least one group identifier. For example, a source choice with `matchGroup="science"` may only be matched to target choices that also declare `"science"` in their `matchGroup`. The extractor currently ignores this attribute; `AssociableChoice` has no `matchGroup` field; the UI therefore allows any source to be paired with any target. For items authored without `matchGroup`, this is correct. For items that use `matchGroup` to prevent nonsensical pairings in larger pools, all pairings remain available and the authored constraint is silently violated. Tracked as G-01 in `docs/SPEC-GAPS-PLAN.md`.

**G-06: `matchMin` not validated at submission (`matchExtractor.ts`, response validation)**  
`matchMin` on a `simpleAssociableChoice` declares the minimum number of times that choice must appear in the response. The extractor reads it and it is present in the data model object returned by the extractor's `extract()` method (as a field on each choice in `sourceSet`/`targetSet`). However, `MatchInteractionData.sourceSet` uses the `AssociableChoice` interface, which does not include `matchMin`. The validator in `matchExtractor.ts` does not check submission-time compliance. If `matchMin=1` for a source choice, the player will not prevent submission of an incomplete response. Tracked as G-06 in `docs/SPEC-GAPS-PLAN.md`.

**`minAssociations` not extracted**  
`minAssociations` on the interaction element is not in `MatchData` or `MatchInteractionData` and is not enforced. Not tracked as a numbered gap in `SPEC-GAPS-PLAN.md` at the time of writing but is equivalent in severity to `minChoices` on `choiceInteraction`.

---

## Functional requirements

- **FR-1:** Render two parallel columns: a source column (left, labelled) and a target column (right, labelled). Source items are draggable; target items are drop zones.
- **FR-2:** When a source is dragged onto a target, create a directed pair `"sourceId targetId"` and add it to the response array. If the target already has a source paired to it, replace that pairing.
- **FR-3:** When a source has reached its `matchMax` limit (all allowed pairings formed), remove its drag affordance and prevent it from being selected as a keyboard source.
- **FR-4:** Provide a clear (✕) button on each matched source to remove all pairings for that source. The button must be visible only in interactive (non-disabled) mode.
- **FR-5:** On each pairing change, emit a `qti-change` CustomEvent from the root element with `{ responseIdentifier, value: string[] }` where `value` is the full current pairs array.
- **FR-6:** Accept a `response` prop (`string[]`) and reflect existing pairs on mount without emitting `qti-change`.
- **FR-7:** When `disabled=true`, suppress all interaction: no drag, no keyboard pairing, no clear buttons. Existing pairs remain visible.
- **FR-8:** When `shuffle=true`, render source and target items in the shuffled order provided by the extractor (shuffling is done at extraction time, not render time).
- **FR-9:** When `role='scorer'` and `correctResponse` is provided, highlight correct pairings with a success (green) colour and show "Correct" badges. Do not reveal correct answers to any other role.
- **FR-10:** Render the `prompt` HTML content above the matching grid when present.
- **FR-11:** On mobile viewports (≤640px), stack the source and target columns vertically rather than side-by-side, and support touch drag-and-drop via the `touchDrag` action.
- **FR-12:** In the absence of `matchGroup` (G-01), any source may be paired with any target. Do not apply any pairing restriction based on unextracted attributes.

---

## Non-functional requirements

- **Accessibility:** Each source item and each target item must be a focusable `<button>`. Source buttons must have `aria-pressed` indicating keyboard selection state. Source buttons must carry a comprehensive `aria-label` that includes: the item text, any current match ("Matched with X"), and selection state. Target buttons must carry an `aria-label` including: the item text and either "Matched with Y" or "Available for matching". An `aria-live="polite"` region must announce pairings and cancellations as they occur. A visually hidden instruction block must explain the two-step keyboard workflow. Focus must not be programmatically moved after a pairing; the user continues tabbing through the grid.
- **Touch targets:** Each source and target button must have a minimum height of 60px CSS (`min-h-[60px]`). The clear (✕) button must be at least 24×24px. WCAG 2.2 SC 2.5.8 requires 24×24px for all targets; the 60px minimum row height satisfies this with margin.
- **Performance:** Extraction and rendering for a 5×5 matching grid (25 choices total) must complete in under 16 ms on a mid-range mobile device. The grid is a static layout with no virtual scrolling.
- **Cross-platform:** Touch drag must use the `touchDrag` Svelte action from `@pie-qti/qti-common`. The stacked single-column layout at ≤640px must make tap-to-pair functional without requiring physical drag.
- **i18n:** The following string keys must be provided to the `i18n` provider or fall back to the default English strings:
  - `interactions.match.sourceItemsLabel` → `"Source items to match"`
  - `interactions.match.targetItemsLabel` → `"Target items for matching"`
  - `interactions.match.dragFromHere` → `"Drag from here:"`
  - `interactions.match.dropHere` → `"Drop here:"`
  - `interactions.match.dragInstruction` → `"Press Space or Enter to match"`
  - `interactions.match.dropTarget` → `"Drop item here"`
  - `interactions.choice.correct` → `"Correct"` (shared key with choiceInteraction)
- **Security:** Choice text is rendered via `{@html}` in `MatchDragDrop.svelte`. Content must be sanitized upstream by the item player's HTML sanitizer before reaching the component. The component trusts `sourceSet[*].text` and `targetSet[*].text` as safe HTML.
- **Style isolation:** The component is compiled as a custom element with shadow DOM. Internal DaisyUI classes fall back to explicit CSS custom property values for environments without DaisyUI. The `::part()` API exposes `grid`, `source-column`, `target-column`, `source-heading`, `target-heading`, `source-item`, `source-clear`, `target` for host-page customisation.

---

## Design decisions

### Target accepts only one source even when target's `matchMax > 1`

**Decision:** `createOrUpdatePair` removes any existing source from a target before adding the new one, regardless of the target's `matchMax`. A target always ends up with exactly one source paired to it in the UI.  
**Rationale:** The UI pattern — a drop zone that shows a single paired item — assumes one-source-per-target. Supporting multiple sources per target would require visual disambiguation (e.g., a list inside the target zone) and new UX for replacing only one of several occupants. K-12 match items virtually always use `matchMax=1` on targets. Implementing the more complex multi-source-per-target layout is deferred until an actual item requires it.  
**Alternatives considered:** Append sources into the target zone (a list). Rejected: adds visual complexity and doesn't match the DaisyUI card aesthetic.  
**Consequences:** If an item sets `matchMax>1` on a target choice, candidates can only pair one source to it via the UI. The pair string is still emitted correctly; the constraint is only a UI limitation.

### Source column enforces `matchMax` via drag and keyboard guard

**Decision:** When `matchedTargets.length >= source.matchMax`, the source button's `draggable` attribute is removed and `canDragMore` is `false`, which also suppresses the `DragHandle` icon and prevents keyboard selection.  
**Rationale:** The spec requires `matchMax` to be enforced by the delivery engine, not by response processing. Enforcing it in the UI gives immediate, clear feedback without requiring a post-submission error state.  
**Alternatives considered:** Allow the drag but reject the drop. Rejected: a drag that silently fails is a poor UX and an accessibility problem (no feedback).  
**Consequences:** A source item at its `matchMax` appears inert. The candidate must clear an existing pairing before re-pairing the source.

### Pairs array is appended-to, not replaced

**Decision:** `createOrUpdatePair` appends new pairs; it does not reset the entire response array on each pairing.  
**Rationale:** This supports many-to-many configurations (one source → multiple targets) correctly. It also means that clearing one pairing (via the ✕ button or `removePairBySource`) removes only the targeted pair(s) without affecting other pairings.  
**Consequences:** The response array grows as pairings are created. Duplicate pair prevention (the `!newPairs.includes(newPair)` check in `createOrUpdatePair`) is necessary to prevent a source from appearing twice with the same target on rapid interaction.

### Two-column grid collapses to single column at ≤640px

**Decision:** The `qti-match-grid` CSS uses `grid-template-columns: 1fr 1fr` above 640px and `1fr` below, stacking source above target on narrow viewports.  
**Rationale:** Side-by-side columns at 375px (iPhone SE) would give each column ~175px — too narrow for typical choice text. Stacking preserves readability. On touch devices, candidates can scroll to see both sets before pairing.  
**Consequences:** On narrow viewports, the mental model is "scroll down to see targets", which requires more spatial reasoning than a side-by-side layout. Items with short choice text may benefit from a horizontal layout even on mobile; this can be achieved via `::part(grid)` override by the host.

### `MatchInteractionData` uses `AssociableChoice` which does not include `matchMin`

**Decision:** The `AssociableChoice` interface (used for both source and target sets in `MatchInteractionData`) currently only has `identifier`, `text`, and `matchMax`. The extractor's `MatchData` also omits `matchMin`.  
**Rationale:** `matchMin` is extracted by the extractor at parse time (via `getNumberAttribute`) into the local choice shape but then discarded before returning from `extract()`, because `AssociableChoice` has no `matchMin` field. This gap was preserved because `matchMin` validation is a separate, deferred work item (G-06).  
**Consequences:** Even if G-06 is fixed in the validation layer, the type contract must be updated to include `matchMin` before validation can be performed downstream.

---

## Data model / contracts

### `MatchInteractionData` (from `@pie-qti/item-player`)

Source: `packages/item-player/src/interactions/shared/types.ts`

```typescript
interface AssociableChoice {
  identifier: string;   // from simpleAssociableChoice identifier attribute
  text: string;         // HTML content of simpleAssociableChoice
  matchMax: number;     // from matchMax attribute; defaults to 1
  classes?: string[];   // CSS classes from the element, when present
}

interface MatchInteractionData extends BaseInteractionData {
  type: 'matchInteraction';
  responseId: string;          // from responseIdentifier attribute
  shuffle: boolean;            // shuffled order applied at extraction time
  maxAssociations: number;     // 0 = unlimited; defaults to 1
  prompt: string | null;       // HTML content of <prompt> child, or null
  sourceSet: AssociableChoice[]; // items from first simpleMatchSet
  targetSet: AssociableChoice[]; // items from second simpleMatchSet
}
```

**Invariants enforced by extractor:**
- `sourceSet` has at least one entry (error if empty)
- `targetSet` has at least one entry (error if empty)
- All `identifier` values in `sourceSet` are non-empty and unique within the set (error on duplicate)
- All `identifier` values in `targetSet` are non-empty and unique within the set (error on duplicate)
- `maxAssociations >= 0` (error if negative)

**Invariants not enforced (gaps):**
- `minAssociations` is not in the type; not enforced at submission
- `matchMin` per choice is not in `AssociableChoice`; not enforced at submission (G-06)
- `matchGroup` per choice is not in `AssociableChoice`; pairing restrictions not enforced (G-01)

**Fallback behaviour:** If the XML has no `simpleMatchSet` children (malformed), the extractor falls back to treating all `simpleAssociableChoice` descendants as both source and target sets. This preserves functional display of badly-structured content at the cost of violating the two-set structural constraint.

### Response format

The response is `string[]` where each element is `"sourceIdentifier targetIdentifier"`.

Example for a 3-pair match:
```
["capital1 country1", "capital2 country2", "capital3 country3"]
```

The response variable is declared in the QTI XML as:
```xml
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
  <correctResponse>
    <value>capital1 country1</value>
    <value>capital2 country2</value>
    <value>capital3 country3</value>
  </correctResponse>
</responseDeclaration>
```

`mapEntry` keys in a `mapping` block must also use the `"source target"` format:
```xml
<mapping defaultValue="0">
  <mapEntry mapKey="capital1 country1" mappedValue="1"/>
  <mapEntry mapKey="capital2 country2" mappedValue="1"/>
  <mapEntry mapKey="capital3 country3" mappedValue="1"/>
</mapping>
```

---

## Acceptance criteria

### Functional

```
AC-1: Basic pairing via drag-and-drop
  Given: a match-interaction item with 3 sources and 3 targets, maxAssociations=3
  When: the candidate drags source1 onto target1
  Then: a pair "source1 target1" appears in the response; the source button shows the matched target label;
        the target zone shows the matched source label; a qti-change event fires with the updated array

AC-2: Replacing a pairing by dragging a new source onto an occupied target
  Given: "source1 target1" is already paired
  When: the candidate drags source2 onto target1
  Then: the response now contains "source2 target1" and no longer contains "source1 target1";
        qti-change fires with the updated array

AC-3: Clearing a pairing via the ✕ button
  Given: "source1 target1" is paired
  When: the candidate clicks the ✕ button next to source1
  Then: the pair "source1 target1" is removed from the response; the target zone returns to its empty state;
        qti-change fires with the updated array

AC-4: Full-credit submission with MATCH_CORRECT
  Given: a match-interaction item at /item-demo/match-interaction with 3 correct pairs
  When: the candidate creates all 3 correct pairings and submits
  Then: SCORE=3.0, MAXSCORE=3.0

AC-5: Partial credit via MAP_RESPONSE
  Given: the same item with MAP_RESPONSE scoring, each correct pair worth 1 point
  When: the candidate forms 2 correct pairs and 1 incorrect pair and submits
  Then: SCORE=2.0, MAXSCORE=3.0

AC-6: Zero score for all incorrect pairs
  Given: the same item
  When: the candidate forms 3 incorrect pairs and submits
  Then: SCORE=0.0, MAXSCORE=3.0

AC-7: matchMax=1 enforced on source
  Given: an item where all sources have matchMax=1, and source1 is already paired with target1
  When: the candidate attempts to drag source1 to target2
  Then: source1's drag handle is hidden; the drag is not initiated; source1 cannot be keyboard-selected

AC-8: matchMax=2 allows source to pair with two targets
  Given: an item where source1 has matchMax=2 and there are at least 2 available targets
  When: the candidate pairs source1 with target1, then pairs source1 with target2
  Then: the response contains both "source1 target1" and "source1 target2"

AC-9: disabled=true suppresses all interaction
  Given: the item rendered with disabled=true
  When: the candidate attempts to drag, keyboard-select, or clear any pair
  Then: no response change occurs; no qti-change event fires; all buttons appear visually disabled (opacity)

AC-10: Pre-existing response reflected on mount
  Given: the item rendered with response=["capital1 country1", "capital2 country2"]
  When: the component mounts
  Then: source1 and source2 show their matched targets; no qti-change event fires on mount

AC-11: scorer role shows correct pairings
  Given: the item rendered with role="scorer" and correctResponse=["capital1 country1", ...]
  When: the item renders
  Then: each correct source shows a green border and the matched target label; "Correct" badges appear;
        no interaction is possible (disabled in scorer mode)

AC-12: candidate role never reveals correct answers
  Given: the item rendered with role="candidate" and correctResponse populated
  When: the item renders
  Then: no green borders, no "Correct" badges appear; source and target items appear in their default state

AC-13: prompt renders above the grid
  Given: an item whose matchInteraction has a <prompt> child with HTML content
  When: the item renders
  Then: the prompt HTML appears above the two-column grid

AC-14: shuffle=true produces consistent order within a session
  Given: an item with shuffle=true
  When: the item is extracted and rendered twice using the same extracted data object
  Then: the source and target order is identical both times (shuffle is stable at extraction time)

AC-15: maxAssociations=3 limits total pairs
  Given: an item with maxAssociations=3 and 4 sources and 4 targets
  When: the candidate forms 3 pairs
  Then: all remaining source items become non-draggable and non-keyboard-selectable (maxAssociations reached)
  Notes: This is a per-source matchMax enforcement proxy. The UI relies on per-source matchMax to
         enforce the total. An item should set matchMax appropriately to make maxAssociations enforceable.
```

### Accessibility

```
AC-A1: Keyboard source selection
  Given: the item rendered without a pre-existing response
  When: the user Tabs to a source button and presses Space
  Then: the button shows aria-pressed=true; an aria-live announcement says "[item] selected.
        Navigate to a target and press Space or Enter to match."

AC-A2: Keyboard pairing completion
  Given: source1 is keyboard-selected (aria-pressed=true)
  When: the user Tabs to target1 and presses Space
  Then: the pair "source1 target1" is added to the response; an aria-live announcement says
        "[source1 text] matched with [target1 text]"; source1's aria-pressed returns to false

AC-A3: Keyboard Escape cancels selection
  Given: source1 is keyboard-selected
  When: the user presses Escape
  Then: source1's aria-pressed returns to false; an aria-live announcement says "Selection cancelled";
        no pairing is created

AC-A4: aria-label on source reflects match state
  Given: source1 is paired with target1
  When: a screen reader reads source1's button
  Then: the announced label includes both the source text and "Matched with [target1 text]"

AC-A5: aria-label on target reflects availability
  Given: target1 is not yet paired
  When: a screen reader reads target1's button
  Then: the announced label includes the target text and "Available for matching"

AC-A6: Keyboard instructions are present in DOM
  Given: any instance of the match interaction
  When: the page DOM is inspected
  Then: a visually hidden element with id="match-instructions" contains the full keyboard workflow
        description; the grid region references it via aria-describedby

AC-A7: Touch target size
  Given: the item rendered on a 375px viewport
  When: each source and target button is measured
  Then: each button has at least 60px height; the clear button is at least 24×24px

AC-A8: Focus not stolen after pairing
  Given: source1 is keyboard-selected and the user presses Space on target1 to create a pair
  When: the pairing completes
  Then: focus remains on target1; the user can continue Tabbing without unexpected focus movement

AC-A9: Disabled inputs convey state to assistive technology
  Given: the item rendered with disabled=true
  When: a screen reader navigates to any source or target button
  Then: the button is announced as disabled (HTML disabled attribute present)
```

### Gap behaviour (G-01: `matchGroup` not extracted)

```
AC-G1: Without matchGroup, any source pairs with any target
  Given: a QTI item whose simpleAssociableChoice elements have matchGroup attributes in the XML
  When: the item is extracted and rendered
  Then: all source-to-target pairings remain available; the UI does not restrict any pairing;
        no error is thrown or logged related to matchGroup

AC-G2: matchGroup attribute produces no visible effect
  Given: two source choices — S1 with matchGroup="animal" and S2 with matchGroup="plant" —
         and two target choices — T1 with matchGroup="animal" and T2 with matchGroup="plant"
  When: the candidate attempts to pair S1 with T2 (mismatched groups)
  Then: the pairing succeeds; "S1 T2" is added to the response; no validation error prevents it
  Notes: This is the expected behaviour given G-01. When G-01 is resolved, this AC should be
         updated: the pairing should be rejected by the UI when matchGroups are incompatible.
```

### Gap behaviour (G-06: `matchMin` not validated)

```
AC-G3: matchMin on source choice does not block submission
  Given: a QTI item where source choice S1 has matchMin="1" in the XML
  When: the candidate submits without pairing S1
  Then: the submission proceeds; the response does not include any pair for S1; no validation
        error is raised; SCORE is computed based on the (incomplete) response
  Notes: This is the expected behaviour given G-06. When G-06 is resolved, this AC should be
         updated: the player should return a validation error indicating S1 has not met its
         minimum usage requirement.

AC-G4: matchMin=0 has no effect (always the current behaviour)
  Given: a QTI item where all source choices have matchMin="0"
  When: the candidate submits with some pairs empty
  Then: the submission proceeds without any matchMin-related validation error
```

### Edge cases

```
AC-E1: Single source and single target
  Given: an item with one source and one target
  When: the candidate pairs them
  Then: the response contains one pair; SCORE matches correctly with the single correct pair

AC-E2: Choice text with HTML (bold, images)
  Given: a simpleAssociableChoice whose text contains <strong> and <img> tags
  When: the item renders
  Then: the formatted content appears inside the button; no raw tags appear in the label text

AC-E3: Malformed XML with no simpleMatchSet elements
  Given: matchInteraction XML with simpleAssociableChoice elements but no simpleMatchSet wrappers
  When: the extractor processes the element
  Then: all choices are used as both source and target (fallback path); no error is thrown;
        the component renders with the full choice list in both columns

AC-E4: No prompt element
  Given: a matchInteraction with no <prompt> child
  When: the item renders
  Then: no prompt area is rendered above the grid; layout is correct without the empty container

AC-E5: Large pool (8 sources, 8 targets)
  Given: an item with 8 sources and 8 targets
  When: the item renders on a desktop viewport
  Then: all 16 buttons are visible and interactive; no layout overflow or clipping occurs;
        the two-column grid accommodates all items

AC-E6: Mobile stacked layout
  Given: the item rendered at 375px viewport width
  When: the layout is inspected
  Then: sources appear in a single full-width column above targets; the grid is single-column

AC-E7: Response prop is null or undefined
  Given: the item rendered without a response prop
  When: the component mounts
  Then: no pairs are shown as matched; no error is thrown; the interaction is fully functional
```

---

## Open questions

- [ ] Should `minAssociations` on the interaction be extracted and surfaced as a submission-time validation hint (e.g., "You must form at least N matches")? Currently not extracted. Equivalent severity to `minChoices` on `choiceInteraction`.
- [ ] Should targets with `matchMax > 1` be able to accept multiple sources? The current one-source-per-target UI constraint is a practical simplification. A real item requiring many-to-one targeting should trigger a design discussion before implementation.
- [ ] Should the `matchMax=0` unlimited convention trigger a validator warning similar to `maxChoices=0` in `choiceInteraction`? Currently no warning is emitted.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.1.4
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-01 (matchGroup not extracted), G-06 (matchMin not validated)
- Component: `packages/default-components/src/plugins/match/MatchInteraction.svelte`
- Shared UI: `packages/default-components/src/shared/components/MatchDragDrop.svelte`
- Pair utilities: `packages/default-components/src/shared/utils/pairHelpers.ts`
- Extractor: `packages/item-player/src/interactions/match/extractor.ts`
- Types: `packages/item-player/src/interactions/shared/types.ts` — `MatchInteractionData`, `AssociableChoice`
- Evals: `docs/evals/default-components/match/evals.yaml`
- Adjacent PRDs: `docs/prds/interactions/choice.md` (shuffle pattern, maxChoices=0 zero-means-unlimited analogy), `docs/prds/interactions/associate.md` (single-pool pairing)
