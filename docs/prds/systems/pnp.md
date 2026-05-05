# PRD: Personal Needs and Preferences (PNP) Profile

<!--
  Status: current
  Type: system
  Packages: @pie-qti/item-player, @pie-qti/assessment-player, @pie-qti/default-components
  Last reviewed: 2026-04-28
-->

**Status:** current
**Type:** system
**Packages:** `@pie-qti/item-player`, `@pie-qti/assessment-player`, `@pie-qti/default-components`
**Last reviewed:** 2026-04-28

---

## Summary

The PNP (Personal Needs and Preferences) profile is a QTI 3.0 §6.2 mechanism for delivering candidate-specific accessibility accommodations as structured data alongside the assessment. PIE-QTI implements the core PNP surface: six named color schemes applied via a CSS data-attribute on the player root, a per-choice elimination tool in `choiceInteraction` and `orderInteraction`, an extended-time multiplier that scales `timeLimits.maxTime` in the assessment player, and trigger UI with inline popup for on-screen glossary and keyword-translation accommodations (illustrated-glossary renders as `<img>`), plus `qti-catalog-lookup` DOM events for platform-level usages (TTS, signing, braille, audio description). Structured label and braille support are deferred to G-13.

---

## Background and rationale

### Why PNP lives in the QTI spec

Before QTI 3.0, accessibility accommodations were delivery-platform conventions with no portable representation. A student's extended-time accommodation had to be re-configured in each platform separately; there was no way to embed it in the item package so it travelled with the content. QTI 3.0 §6.2 fixes this: a `<personalNeedsProfile>` element in the assessment XML carries the accommodation set, and a conformant player applies it automatically without platform-specific configuration.

In K-12 US assessments, PNP-equivalent accommodations (color schemes, extended time, answer eliminator) are legally required for students with documented disabilities under IDEA §504 and state IEP/504 plans. Embedding them in the QTI package means the accommodation data is auditable — it travels with the item and can be verified at the delivery layer.

### Why these four features and not others

The six color schemes, elimination tool, extended time, and glossary trigger cover the majority of documented K-12 accommodation needs that can be implemented entirely within the delivery player:

- **Color schemes** — the most common visual accessibility accommodation; six named profiles are defined by the QTI 3.0 spec and correspond to established high-contrast and low-vision combinations used in state testing programs.
- **Elimination tool** — standard accommodation in state summative assessments; allows candidates to cross out choices they have already ruled out, reducing cognitive load.
- **Extended time** — the most common accommodation overall (affects ~15% of students with IEPs); needs only a multiplier applied to existing timer logic.
- **Glossary/keyword-translation trigger** — enables just-in-time vocabulary support for ELL students and students with cognitive disabilities; the trigger UI is lightweight and decoupled from the catalog content that backs it.

Features deliberately deferred:
- **Magnification overlay** — browser zoom and OS accessibility meet this need adequately; a player-level overlay adds complexity without meaningful additional coverage.
- **Structured labels** (G-13) — requires specialist ARIA authoring decisions per interaction type; deferred to avoid under-specifying a critical accessibility contract.
- **Braille** (G-13) — content delivery to hardware devices requires a separate integration layer outside the player.
- **Sign language** (G-14) — video delivery is a host-platform capability surfaced via events, not a player UI concern.

### Why CSS data-attribute rather than CSS class for color schemes

The host application and assessment shell may apply their own CSS class names. A class-injection approach risks collisions with the host's styling conventions and requires the player to know which class names are "safe". A single `data-qti-colorscheme` attribute is in a data-attribute namespace the player owns, is easily targeted with `[data-qti-colorscheme="blackwhite"]` attribute selectors, and does not interfere with DaisyUI's `data-theme` mechanism or the host's class list.

### Why elimination does not remove choices from the DOM

Removing an eliminated choice from the DOM would change the response set silently: a candidate who eliminated choice C and then submitted would produce a response that excludes C, which might accidentally match the correct-response set or change the score. The elimination tool is a cognitive aid, not an answer restriction. Eliminated choices must remain in the response variable's eligible set; only the visual presentation (dimming, strikethrough styling) and the `aria-disabled` state should change.

---

## QTI specification alignment

- **Spec version:** QTI 3.0
- **Spec section:** §6.2 — Personal Needs and Preferences

### Supported PNP features

| Feature | `PnpProfile` field | Notes |
|---------|-------------------|-------|
| Color scheme | `display.colorScheme` | Six named values from spec table; `'default'` removes the attribute |
| Elimination tool | `cognitive.eliminationTool` | Applied to `choiceInteraction` and `orderInteraction` |
| Extended time | `content.extendedTime` | Multiplies `timeLimits.maxTime`; `Infinity` removes limit |
| Glossary on screen trigger | `content.glossaryOnScreen` | Opens an inline popup with catalog content |
| Keyword translation trigger | `content.keywordTranslation` | Opens an inline popup using the requested language |

### Deliberately omitted / deferred features

| Feature | Reason |
|---------|--------|
| `magnification` | Browser/OS zoom is sufficient; overlay deferred |
| `structuredLabelSupport` | Per-interaction ARIA work; tracked as G-13 |
| `braille` | Hardware integration; tracked as G-13 |
| `signLanguageInterpretation` | Video player is host responsibility; tracked as G-14 |
| `timingControl` / `pauseControl` | UI for these requires assessment-level integration beyond timer multiplication; tracked separately |

### Known gaps

**G-09 — PNP profile support:** Implemented in commit `fa8fa97` (2026-04-28). Color schemes, elimination tool, extended time, glossary/keyword-translation triggers and popups are all shipped. Remaining deferred items: magnification overlay (browser zoom sufficient), structured labels (G-13), braille routing (G-13), sign language video (G-14).

---

## Functional requirements

- **FR-1:** `PlayerConfig` must accept an optional `pnp?: PnpProfile` field. When absent, all PNP code paths must be completely inert — no DOM changes, no event listeners added, no effect on QTI 2.x items.
- **FR-2:** `player.updatePnp(partial: Partial<PnpProfile>)` must merge the partial into the current profile and re-apply all PNP effects without re-parsing or re-rendering the item.
- **FR-3:** `parsePnpXml(xml: string | Element): PnpProfile | null` must parse a `<personalNeedsProfile>` element from a QTI 3.0 assessment XML fragment and return a `PnpProfile`, or `null` if the element is absent.
- **FR-4:** `applyPnpToRoot(rootEl: HTMLElement, pnp: PnpProfile): void` must set `data-qti-colorscheme` on `rootEl` to the active scheme name when a non-default scheme is present, and remove the attribute when `colorScheme` is `'default'` or absent.
- **FR-5:** When `pnp.cognitive.eliminationTool` is `true`, every `simpleChoice` in a `choiceInteraction` and every orderable item in an `orderInteraction` must render a toggle button that marks/unmarks that choice as eliminated. The button must be visible, labelled, and keyboard-operable.
- **FR-6:** An eliminated choice must receive the `data-eliminated` attribute and `aria-disabled="true"`. Its response-variable eligibility must not change — it must remain selectable and its identifier must be included in or excluded from the response exactly as if the elimination state did not exist.
- **FR-7:** When `pnp.content.extendedTime.active` is `true`, the assessment player must multiply `timeLimits.maxTime` by `pnp.content.extendedTime.multiplier` before initialising `TimeManager`. A multiplier of `Infinity` must result in no time limit being set at all (equivalent to `maxTime` absent).
- **FR-8:** When `pnp.content.glossaryOnScreen` is `true`, the item body renderer must locate every element carrying `data-catalog-idref` and decorate it with an accessible trigger button. Activating the trigger must look up the catalog entry via `getCatalogEntry(idref, 'glossary-on-screen')` and open an inline focus-trapped popup containing the catalog HTML. For `illustrated-glossary` entries the popup renders an `<img>`.
- **FR-9:** When `pnp.content.keywordTranslation.active` is `true`, the same trigger-plus-popup mechanism applies using `usage = 'keyword-translation'` and `lang = pnp.content.keywordTranslation.languageCode`.
- **FR-10:** For `tts-pronunciation`, `signing-definition`, `braille-text`, `audio-description`, and `extended-description` entries, the player must fire a `qti-catalog-lookup` `CustomEvent` on the root player element with `{ bubbles: true, composed: true }` and `detail: { idref: string; usage: string; html: string | null }`. The player must not render any popup for these platform-level usages.
- **FR-11:** The iframe postMessage protocol must be extended with a `SET_PNP` message type so that hosts using the iframe embedding mode can push PNP updates mid-session.
- **FR-12:** `parsePnpXml` must silently ignore unknown child elements; it must not throw on forward-compatible QTI 3.0 PNP features not yet defined in `PnpProfile`.

---

## Non-functional requirements

- **Accessibility:** The elimination toggle button must have a visible label derived from the choice text (e.g. `aria-label="Eliminate: [choice text]"` when not eliminated; `"Restore: [choice text]"` when eliminated). The button must have a minimum touch target of 44×44 CSS pixels. The `data-eliminated` attribute must be reflected via `aria-disabled="true"` so screen readers announce the eliminated state. All six color scheme combinations must pass WCAG 1.4.3 minimum contrast (4.5:1 for normal text, 3:1 for large text) against their intended backgrounds — CSS for these schemes must be validated as part of the theming deliverable.
- **Performance:** `applyPnpToRoot` performs a single DOM attribute write; it must not trigger a full component re-render. `updatePnp` must be callable repeatedly during an assessment session (e.g. on each item navigation) without accumulated cost.
- **Cross-platform:** The elimination toggle button must be usable on touch devices (tap target, no hover dependency). Color schemes must be verified on mobile viewports (375px minimum).
- **Security:** `parsePnpXml` must not evaluate any script content from the XML input. It processes only named structural elements (`<personalNeedsProfile>`, `<colorScheme>`, etc.) and reads their text/attribute values; it must not `innerHTML`-inject any parsed content.
- **i18n:** The elimination button label strings (`"Eliminate"` / `"Restore"`) must be sourced from the `@pie-qti/i18n` provider under keys `accessibility.pnp.eliminate` and `accessibility.pnp.restore`. English defaults are acceptable fallbacks.

---

## Design decisions

### CSS data-attribute for color scheme over class injection

**Decision:** `applyPnpToRoot` sets `data-qti-colorscheme="<scheme>"` on the player root element; CSS rules target `[data-qti-colorscheme="blackwhite"] { ... }`.

**Rationale:** CSS class injection risks collisions with the host page's class conventions. A data-attribute is in a namespace the player controls, is easily audited, and does not conflict with DaisyUI's `data-theme` system or the accessibility system's existing `data-theme="high-contrast"` pattern.

**Alternatives considered:** Inline `style` attribute for CSS custom property overrides (rejected — properties would need to be duplicated per-scheme; hard to audit; harder for host to override).

**Consequences:** The six color scheme CSS rulesets must be shipped in `@pie-qti/default-components` and scoped to the player root element's attribute. The host cannot suppress the scheme by removing a class; it must override via higher-specificity CSS or remove the attribute directly.

---

### Elimination ≠ removal from response set

**Decision:** Eliminated choices remain in the DOM, remain selectable, and remain in the response variable's eligible set. Only visual presentation and `aria-disabled` change.

**Rationale:** The elimination tool is a cognitive strategy aid. Removing an eliminated choice from the DOM would silently change what the candidate can select, potentially altering scores. In QTI response processing, a choice that is not present in the response variable is indistinguishable from one that was never offered — this would be a scoring bug. The spec is clear that elimination is a presentation-layer accommodation.

**Alternatives considered:** Disabling the choice input (preventing selection) — rejected for the same scoring-integrity reason; a candidate who eliminates a choice may still want to reconsider.

**Consequences:** The `onChange` callback and `qti-change` event must still fire when the candidate selects or deselects an eliminated choice. The elimination state is UI-only and must not be persisted in the session response variable.

---

### `multiplier: Infinity` as the unlimited-time sentinel

**Decision:** `extendedTime.multiplier = Infinity` means no time limit. `AssessmentPlayer` treats this as equivalent to `timeLimits.maxTime` being absent.

**Rationale:** A consistent numeric sentinel avoids a separate boolean field. `Number.isFinite(Infinity)` is `false`, making the check trivial. Using a very large integer (e.g. `999999`) would work but introduces an arbitrary magic number and could still trigger expiry in edge cases.

**Alternatives considered:** A separate `extendedTime.unlimited: boolean` flag — rejected as redundant with the multiplier.

**Consequences:** `TimeManager` must guard its `maxTimeSeconds` initialisation with a `Number.isFinite(multipliedTime)` check before passing to the timer.

---

### Inline popup for on-screen usages; events for platform-level usages

**Decision:** For `glossary-on-screen`, `keyword-translation`, and `illustrated-glossary` entries, `applyGlossaryTriggers` (in `item-player`) looks up the catalog entry and mounts a vanilla-JS focus-trapped popup adjacent to the trigger. For `tts-pronunciation`, `signing-definition`, `braille-text`, and `audio-description` entries, the player fires a `qti-catalog-lookup` event and renders no popup.

**Rationale:** G-09 (PNP trigger UI) and G-10 (catalog parsing) were implemented together in the same milestone. The on-screen usages (`glossary-on-screen`, `keyword-translation`) have everything they need in-player: the catalog index is available, the content is HTML or an image URL, and a vanilla popup requires no external framework dependency. Platform-level usages (`tts-pronunciation`, signing, braille, audio) require capabilities the player cannot assume — TTS engines, braille hardware, video players — so an event is the correct boundary.

**Why vanilla JS, not `CatalogPopup.svelte`:** `item-player` has no Svelte dependency. `applyGlossaryTriggers.ts` is called from `ItemRenderer.ts`, which is framework-agnostic. A vanilla-JS popup satisfies the requirement with no new package dependency. `CatalogPopup.svelte` exists in `default-components` as a separate offering for host applications that want a declaratively-mounted Svelte component with the same behavior.

**Alternatives considered:** Coupling trigger to event-only and relying on G-10 to render the popup — was the original plan but rejected when G-09 and G-10 were implemented together, since the event-only path would leave the on-screen usages inoperable until a host listener was added.

**Consequences:** The popup is rendered using `document.createElement` and appended to the DOM. It does not participate in Svelte reactivity. Its CSS classes (`qti-catalog-popup`, etc.) must be styled at the document level if the host wants branded styling.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| `PlayerConfig.pnp` | `PnpProfile` | Pass at construction; provides initial PNP state | `new Player({ itemXml, pnp: { display: { colorScheme: 'blackwhite' } } })` |
| `player.updatePnp()` | `(partial: Partial<PnpProfile>) => void` | Call at any point during the session to update accommodations | Update color scheme when student changes preference |
| `applyPnpToRoot()` | `(rootEl: HTMLElement, pnp: PnpProfile) => void` | Exported utility; call directly if embedding the player root in a custom shell | Apply scheme to a custom outer wrapper element |
| `parsePnpXml()` | `(xml: string \| Element) => PnpProfile \| null` | Parse `<personalNeedsProfile>` from QTI 3.0 assessment XML | Feed parsed profile into `PlayerConfig.pnp` |
| `qti-catalog-lookup` event | `CustomEvent<{ idref: string; usage: string; html: string \| null }>` | Listen on the player root element to handle platform-level catalog lookups in the host | Route TTS, signing, braille, audio, or extended-description content |
| Iframe `SET_PNP` message | `QtiIframeEnvelope<'SET_PNP', { pnp: PnpProfile }>` | Send from host to iframe runtime to update PNP mid-session | Push PNP from a student settings panel in the host |

---

## Data model / contracts

### `PnpProfile`

Defined in `packages/item-player/src/pnp/types.ts`:

```typescript
export interface PnpProfile {
  display?: {
    /**
     * One of six named color schemes from QTI 3.0 §6.2.
     * 'default' removes the data-qti-colorscheme attribute.
     */
    colorScheme?: 'default' | 'blackwhite' | 'whitenav' | 'blackcream' | 'yellowblue' | 'medgray';
    /**
     * CSS zoom factor. 1.0 = default (no magnification).
     * Deferred — parsed and stored but not applied by this milestone.
     */
    magnification?: number;
  };
  content?: {
    /** Show accessible trigger buttons on data-catalog-idref terms. */
    glossaryOnScreen?: boolean;
    /** Show keyword translation triggers with the given target language. */
    keywordTranslation?: { active: boolean; languageCode: string };
    /** Multiply timeLimits.maxTime by multiplier. Infinity = no limit. */
    extendedTime?: { active: boolean; multiplier: number };
  };
  cognitive?: {
    /** Show per-choice eliminate/restore toggle buttons. */
    eliminationTool?: boolean;
  };
}
```

### `qti-catalog-lookup` event

```typescript
interface QtiCatalogLookupDetail {
  /** The data-catalog-idref value on the triggered term element. */
  idref: string;
  /** Catalog usage type: 'glossary-on-screen' | 'keyword-translation' | ... */
  usage: string;
  /** Language code, present only for keyword-translation triggers. */
  languageCode?: string;
}
```

The event is dispatched with `{ bubbles: true, composed: true }` on the player root element so that hosts using Shadow DOM embedding receive it.

### Invariants

- `PnpProfile` is always a plain object (no class instance); it is safe to serialize to JSON and pass via `postMessage`.
- All fields are optional; an empty `{}` profile is valid and has no effect.
- `updatePnp` performs a shallow merge at the top level (`display`, `content`, `cognitive`) and a deep merge one level deeper (so `updatePnp({ content: { glossaryOnScreen: true } })` does not clear `content.extendedTime`).
- The `data-qti-colorscheme` attribute must be the only PNP-owned attribute on the player root. Future PNP attributes must use the same `data-qti-` prefix.

---

## Acceptance criteria

### Color schemes

**AC-1: Default scheme — no attribute**
```
Given: A player is constructed with no pnp config (or pnp.display.colorScheme = 'default')
When: The player root element is inspected
Then: No data-qti-colorscheme attribute is present on the root element
```

**AC-2: Named scheme applied**
```
Given: A player is constructed with pnp: { display: { colorScheme: 'blackwhite' } }
When: The player root element is inspected
Then: data-qti-colorscheme="blackwhite" is set on the root element
```

**AC-3: All six named schemes accepted without error**
```
Given: A player is constructed successively with each of the six named color schemes
  ('blackwhite', 'whitenav', 'blackcream', 'yellowblue', 'medgray', 'default')
When: Each instance's root element is inspected
Then: Each instance has the corresponding data-qti-colorscheme attribute value
  (or no attribute for 'default')
  AND no JavaScript error is thrown for any scheme name
```

**AC-4: Mid-session scheme update via updatePnp**
```
Given: A player is running with pnp: { display: { colorScheme: 'blackwhite' } }
When: player.updatePnp({ display: { colorScheme: 'yellowblue' } }) is called
Then: data-qti-colorscheme="yellowblue" is set on the root element
  AND the item is not re-parsed or re-rendered (no flicker)
```

**AC-5: Scheme cleared via updatePnp**
```
Given: A player has data-qti-colorscheme="blackwhite" set
When: player.updatePnp({ display: { colorScheme: 'default' } }) is called
Then: The data-qti-colorscheme attribute is removed from the root element
```

---

### Elimination tool

**AC-6: Elimination buttons appear when enabled**
```
Given: An item with a choiceInteraction containing three simpleChoices
  AND pnp: { cognitive: { eliminationTool: true } }
When: The item renders
Then: An eliminate/restore toggle button is rendered adjacent to each choice
  AND the button has an aria-label containing the choice text
  AND no eliminate buttons appear without pnp.cognitive.eliminationTool = true
```

**AC-7: Eliminating a choice marks it visually and accessibly**
```
Given: The elimination tool is active and a choice is not eliminated
When: The user activates the eliminate button for choice B
Then: Choice B receives the data-eliminated attribute
  AND choice B's input has aria-disabled="true"
  AND the button label changes (e.g. from "Eliminate: B" to "Restore: B")
  AND choice B remains visible in the DOM
```

**AC-8: Eliminated choice remains selectable**
```
Given: Choice B is marked as eliminated (data-eliminated set)
When: The user clicks or keyboard-activates choice B's input
Then: Choice B is selected (or toggled) normally
  AND the onChange callback fires with choice B included
  AND the qti-change event includes choice B in the response value
```

**AC-9: Restoring an eliminated choice**
```
Given: Choice B has data-eliminated set
When: The user activates the restore button for choice B
Then: The data-eliminated attribute is removed from choice B
  AND aria-disabled is removed or set to "false"
  AND the button label reverts to the eliminate label
```

**AC-10: Elimination state not persisted in response variable**
```
Given: The candidate has eliminated choice B and then submitted
When: The submitted response variables are inspected
Then: The elimination state of choice B is not present in any response or session variable
  AND the score is calculated solely on whether the candidate selected choice B, not on elimination state
```

**AC-11: orderInteraction elimination**
```
Given: An orderInteraction with three orderable items AND eliminationTool: true
When: The item renders and the user eliminates one orderable item
Then: The same data-eliminated and aria-disabled pattern applies to the orderable item
  AND the item remains in its position in the order (not removed)
```

---

### Extended time

**AC-12: Time limit multiplied**
```
Given: An assessment with timeLimits.maxTime = 60 (seconds)
  AND pnp: { content: { extendedTime: { active: true, multiplier: 1.5 } } }
When: The TimeManager is initialised by the assessment player
Then: The TimeManager receives maxTime = 90 (60 × 1.5)
  AND the timer counts down from 90 seconds
```

**AC-13: Multiplier = Infinity removes the limit**
```
Given: An assessment with timeLimits.maxTime = 60
  AND pnp: { content: { extendedTime: { active: true, multiplier: Infinity } } }
When: The TimeManager is initialised
Then: No maxTime is set on the TimeManager
  AND the timer counts up indefinitely without firing the expiry callback
```

**AC-14: Inactive extendedTime is ignored**
```
Given: pnp: { content: { extendedTime: { active: false, multiplier: 1.5 } } }
  AND timeLimits.maxTime = 60
When: The TimeManager is initialised
Then: The TimeManager receives maxTime = 60 (unmodified)
```

**AC-15: No PNP = no time change**
```
Given: An assessment with timeLimits.maxTime = 60
  AND no pnp config
When: The TimeManager is initialised
Then: maxTime = 60 (unmodified)
```

---

### Glossary and keyword translation triggers

**AC-16: Glossary triggers rendered when enabled**
```
Given: An item body containing <span data-catalog-idref="cat-photosynthesis">photosynthesis</span>
  AND pnp: { content: { glossaryOnScreen: true } }
When: The item body renders
Then: An accessible trigger button is rendered on or adjacent to the span
  AND the button has an aria-label referencing the term text
```

**AC-17: Glossary trigger opens inline popup with catalog content**
```
Given: A glossary trigger button is rendered for idref="cat-photosynthesis"
  AND the catalog contains an entry for "cat-photosynthesis" with usage "glossary-on-screen"
When: The user activates the trigger button
Then: A focus-trapped popup appears adjacent to the trigger containing the catalog entry HTML
  AND the popup has role="dialog" and aria-modal="true"
  AND no qti-catalog-lookup event is fired for this glossary-on-screen usage
  AND activating the trigger a second time (or pressing Escape) closes the popup
```

**AC-18: No glossary triggers when glossaryOnScreen is false**
```
Given: An item body containing data-catalog-idref attributes
  AND pnp: { content: { glossaryOnScreen: false } } (or absent)
When: The item renders
Then: No trigger buttons are rendered on data-catalog-idref elements
```

**AC-19: Keyword translation trigger**
```
Given: An item body with data-catalog-idref elements
  AND pnp: { content: { keywordTranslation: { active: true, languageCode: 'es' } } }
When: The user activates a keyword translation trigger
Then: event.detail.usage is "keyword-translation"
  AND event.detail.languageCode is "es"
```

---

### parsePnpXml

**AC-20: Parses color scheme**
```
Given: An XML fragment:
  <personalNeedsProfile>
    <display><colorScheme>blackwhite</colorScheme></display>
  </personalNeedsProfile>
When: parsePnpXml() is called with this fragment
Then: The result is { display: { colorScheme: 'blackwhite' } }
```

**AC-21: Returns null when element absent**
```
Given: An XML string with no <personalNeedsProfile> element
When: parsePnpXml() is called
Then: null is returned AND no error is thrown
```

**AC-22: Ignores unknown elements (forward-compatible)**
```
Given: A <personalNeedsProfile> with an unknown child element <futureFeature>xyz</futureFeature>
When: parsePnpXml() is called
Then: The unknown element is silently ignored
  AND the known fields are still parsed correctly
  AND no error is thrown
```

**AC-23: Parses extendedTime multiplier**
```
Given: <personalNeedsProfile>
         <content><extendedTime active="true" multiplier="1.5"/></content>
       </personalNeedsProfile>
When: parsePnpXml() is called
Then: result.content.extendedTime = { active: true, multiplier: 1.5 }
```

---

### QTI 2.x items unaffected

**AC-24: No PNP side-effects on QTI 2.x item without config**
```
Given: A QTI 2.x assessmentItem is loaded with no pnp in PlayerConfig
When: The item renders and responds normally
Then: No data-qti-colorscheme attribute appears on any element
  AND no eliminate buttons are rendered
  AND no trigger buttons appear on any element
  AND no qti-catalog-lookup events are fired
  AND item behaviour is identical to a player with no PNP code present
```

---

### Accessibility

**AC-A1: Eliminate button has visible and accessible label**
```
Given: A choiceInteraction with eliminationTool: true
When: The rendered DOM is inspected
Then: Each eliminate button has an aria-label that includes the corresponding choice's text
  AND the button is not icon-only (has a visible text label or meaningful aria-label)
```

**AC-A2: Eliminate button meets touch target size**
```
Given: A choiceInteraction with eliminationTool: true on a 375px viewport
When: The bounding rect of each eliminate button is measured
Then: Width and height are each ≥ 44px
```

**AC-A3: Glossary trigger button is keyboard operable**
```
Given: A glossary trigger button is rendered on a term
When: A keyboard user tabs to the button and presses Enter or Space
Then: The inline popup opens with the catalog content
  AND focus remains on or returns to the trigger button
```

**AC-A4: Eliminated choice state announced by screen reader**
```
Given: A choice has data-eliminated set and aria-disabled="true"
When: A screen reader navigates to the choice
Then: The screen reader announces the choice as disabled (or similar indication of inactivity)
```

---

### Edge cases

**AC-E1: updatePnp partial merge preserves unspecified fields**
```
Given: A player with pnp: { display: { colorScheme: 'blackwhite' }, content: { extendedTime: { active: true, multiplier: 1.5 } } }
When: player.updatePnp({ display: { colorScheme: 'yellowblue' } }) is called
Then: data-qti-colorscheme is updated to 'yellowblue'
  AND content.extendedTime is unchanged (still active with multiplier 1.5)
```

**AC-E2: Empty PnpProfile has no effect**
```
Given: A player is constructed with pnp: {}
When: The item renders
Then: No data-qti-colorscheme is set
  AND no eliminate buttons are rendered
  AND behaviour is identical to pnp absent
```

**AC-E3: Multiple data-catalog-idref elements in one item**
```
Given: An item with three data-catalog-idref spans and glossaryOnScreen: true
When: The item renders
Then: Three separate trigger buttons are rendered, one per span
  AND each opens the catalog entry for the correct idref
```

---

## Open questions

- [ ] **Color scheme CSS ownership:** The six CSS rulesets for `[data-qti-colorscheme=...]` must be specified somewhere. Should they live in `@pie-qti/default-components` (alongside the interaction styles) or in `@pie-qti/item-player` (alongside the `applyPnpToRoot` logic)? The constraint is that the CSS must be applied to interactions inside Shadow DOM; the current DaisyUI theme CSS uses `::part()` to pierce shadow boundaries for known parts.
- [ ] **Elimination state persistence across item navigation:** If a student navigates away from an item and returns, should their elimination marks be preserved? The response variable is preserved (that's the standard session state mechanism); elimination marks are UI-only. Storing them requires a separate PNP session state channel not currently defined.
- [ ] **orderInteraction elimination UX:** The `orderInteraction` uses a drag-and-drop + keyboard reordering UI (`SortableList`). Where exactly should the eliminate button appear relative to a draggable row, and how should the button interact with the drag affordance? This detail needs UX review before implementation.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §6.2 (PNP profile)
- Spec gap: `docs/SPEC-GAPS-PLAN.md` §G-09 (Done, Tier 2)
- Implementation plan: `docs/development/ACCESSIBILITY-PNP-CATALOG-PLAN.md`
- Adjacent PRD: `docs/prds/systems/accessibility.md` — WCAG 2.2 AA baseline (PNP builds on top of it)
- Adjacent PRD: `docs/prds/systems/catalog.md` — catalog content for glossary/keyword-translation triggers
- Adjacent PRD: `docs/prds/interactions/choice.md` — elimination tool UI lives in the choice interaction component
- Adjacent PRD: `docs/prds/systems/theming.md` — color scheme CSS must integrate with DaisyUI/`data-theme`
- Implementation: `packages/item-player/src/pnp/types.ts`, `applyPnp.ts`, `parsePnpXml.ts`
- Implementation: `packages/item-player/src/catalog/applyGlossaryTriggers.ts` (glossary/keyword-translation trigger + vanilla popup)
- Implementation: `packages/assessment-player/src/core/AssessmentPlayer.ts` (extended time wiring)
- Implementation: `packages/assessment-player/src/core/TimeManager.ts` (extended time multiplier)
- Implementation: `packages/default-components/src/plugins/choice/ChoiceInteraction.svelte` (elimination tool)
- Implementation: `packages/default-components/src/plugins/order/OrderInteraction.svelte` (elimination tool)
- Host-app component: `packages/default-components/src/catalog/CatalogPopup.svelte` (Svelte popup for host use)
