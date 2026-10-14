# PRD: Personal Needs and Preferences (PNP) Profile

<!--
  Status: current
  Type: system
  Packages: @pie-qti/item-player, @pie-qti/assessment-player, @pie-qti/default-components
  Last reviewed: 2026-10-12
-->

**Status:** current
**Type:** system
**Packages:** `@pie-qti/item-player`, `@pie-qti/assessment-player`, `@pie-qti/default-components`
**Last reviewed:** 2026-10-12

---

## Summary

The PNP (Personal Needs and Preferences) profile is a per-candidate AfA PNP 3.0 document, QTI 3's profile of IMS Access for All, that the host delivers to the player at session start. Content never carries it. PIE-QTI parses the document and implements the core PNP surface: a named color scheme written as the `data-qti-colorscheme` attribute on the player root (no package ships the scheme rulesets yet, so the host stylesheet must supply them), a per-choice elimination tool in `choiceInteraction` and `orderInteraction`, an extended-time multiplier that scales `timeLimits.maxTime` in the assessment player, and trigger UI with inline popup for on-screen glossary and keyword-translation accommodations (illustrated-glossary renders as `<img>`), plus `qti-catalog-lookup` DOM events for platform-level usages (TTS, signing, braille, audio description). Structured label and braille support are deferred to G-13.

---

## Background and rationale

### PNP as per-candidate data

QTI 3 splits accessibility between content and candidate. Content carries the alternatives: catalogs of glossary entries, translations, signing and braille, bound to the body by `data-catalog-idref`. The candidate's AfA PNP 3.0 document, root `access-for-all-pnp` in the namespace `http://www.imsglobal.org/xsd/qtiv3p0/imsafa3p0pnp_v1p0`, selects among them and grants tools. It is a portable record of the candidate's accommodations, exchanged between systems singly or in bulk records files keyed by `person-sourced-id`, and never part of an item, section or test.

In K-12 US assessments, PNP-equivalent accommodations (color schemes, extended time, answer eliminator) are legally required for students with documented disabilities under IDEA §504 and state IEP/504 plans. Holding them in one standard per-candidate record lets every delivery system apply the same accommodations and verify them at the delivery layer.

A test carrying a profile element, an AfA `access-for-all-pnp` or the `personalNeedsProfile` some exports invent, converts without it: to-pie reports it as `QTI_PNP_IN_CONTENT`.

### Why these four features and not others

The color schemes, elimination tool, extended time, and glossary trigger cover the majority of documented K-12 accommodation needs that can be implemented entirely within the delivery player:

- **Color schemes** — the most common visual accessibility accommodation; AfA's `color-theme` vocabulary names fourteen themes, established high-contrast and low-vision combinations used in state testing programs.
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

- **Spec version:** QTI 3.0, with [AfA PNP 3.0](https://www.imsglobal.org/spec/afa/v3p0/info) as its candidate profile
- **Spec section:** QTI 3 implementation guide §5, Personal Needs and Preferences; schema [`imsqtiv3p0_afa3p0pnp_v1p0.xsd`](https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqtiv3p0_afa3p0pnp_v1p0.xsd)

### Supported PNP features

`pnpProfileFromAfa` maps these AfA features onto `PnpProfile`. A feature counts when the profile names it or one of its activation sets (`activate-at-initialization-set`, `activate-as-option-set`) lists it, unless `prohibit-set` lists it.

| AfA feature | `PnpProfile` field | Notes |
|-------------|-------------------|-------|
| `text-appearance` › `color-theme` | `display.colorScheme` | Theme terms map onto scheme names below; `'default'` removes the attribute |
| `magnification` | `display.magnification` | `all-content`'s `zoom-amount`, else `text`'s |
| `answer-masking` | `cognitive.eliminationTool` | Applied to `choiceInteraction` and `orderInteraction` |
| `additional-testing-time` | `content.extendedTime` | `time-multiplier` multiplies `timeLimits.maxTime`; `unlimited` is `Infinity`, which removes the limit |
| `glossary-on-screen` | `content.glossaryOnScreen` | Opens an inline popup with catalog content |
| `keyword-translation` (`xml:lang`) | `content.keywordTranslation` | Opens an inline popup using the requested language |
| `sbac-glossary-illustration`, an extension element | `content.illustratedGlossary` | Opens the illustrated glossary popup |
| `additional-directions`, `audio-description`, `braille`, `high-contrast`, `keyboard-directions`, `linguistic-guidance`, `long-description`, `sign-language`, `simplified-graphics`, `simplified-language-portions`, `spoken`, `tactile`, `transcript` | `content.catalogSupports[<feature>]` | QTI 3's predefined card supports; each enables the catalog support of that name, with the feature's `xml:lang` as its language |

| AfA `color-theme` | Scheme |
|-------------------|--------|
| `default`, `default-reverse` | `default`, `defaultreverse` |
| `high-contrast`, `high-contrast-reverse` | `blackwhite`, `whiteblack` |
| `black-rose`, `rose-black` | `blackrose`, `roseblack` |
| `yellow-blue`, `blue-yellow` | `yellowblue`, `blueyellow` |
| `medgray-darkgray`, `darkgray-medgray` | `mgraydgray`, `dgraymgray` |
| `black-cyan`, `cyan-black` | `blackcyan`, `cyanblack` |
| `black-cream`, `cream-black` | `blackcream`, `creamblack` |

AfA leaves a theme's exact colors to the delivery system, so `high-contrast` takes black on white and its reverse white on black. An `ext:` theme, and a bare `<color-theme/>` that asks only for the ability to choose, set no scheme.

### Tool supports

The record `parseAfaPnpXml` returns is the JSON form pie-players' `createPersonalNeedsProfileFromAfa` takes, so a host running the pie-players toolkit hands it over unchanged. That adapter grants each AfA feature as a tool id, the term camelCased except where a packaged tool carries the capability under its own id, per pie-players' [support-id table](https://github.com/pie-framework/pie-players/blob/develop/packages/assessment-toolkit/docs/TOOL_REGISTRY.md#support-ids):

| AfA term | pie-players tool id |
|----------|---------------------|
| `calculator-on-screen` | `calculator` |
| `spoken` with `reading-type` `computer-read-aloud` | `textToSpeech` |
| `spoken` with `reading-type` `screen-reader`, AfA's default | `screenReader`, which withholds read-aloud |
| `answer-masking` | `answerEliminator` |
| `dictionary-on-screen` | `dictionary` |
| `line-reader` | `lineReader` |
| `sign-language` | `signLanguage` |
| `transcript` | `transcript` |

[AfA PNP 3.0 records](https://github.com/pie-framework/pie-players/blob/develop/packages/assessment-toolkit/docs/PNP_CONFIGURATION.md#afa-pnp-30-records) gives every feature's disposition there.

### Deliberately omitted / deferred features

| Feature | Reason |
|---------|--------|
| `magnification` | Parsed into `display.magnification`; browser/OS zoom is sufficient, overlay deferred |
| Structured labels | Per-interaction ARIA work; tracked as G-13 |
| `braille` | Hardware integration; tracked as G-13. The catalog support fires `qti-catalog-lookup` for the host |
| `sign-language` | Video player is host responsibility; tracked as G-14. The catalog support fires `qti-catalog-lookup` for the host |
| `additional-testing-time` › `fixed-minutes` | `extendedTime` holds a multiplier only; the record carries the minutes for the host |
| Timing and pause control | UI for these requires assessment-level integration beyond timer multiplication; tracked separately |
| Tool supports (`calculator-on-screen`, `spoken`, `line-reader`, …) | The host's tools, through the record (Tool supports above) |

### Known gaps

**G-09 — PNP profile support:** Implemented in commit `fa8fa97` (2026-04-28). Elimination tool, extended time, glossary/keyword-translation triggers and popups are shipped. Color schemes set `data-qti-colorscheme` on the player root; the scheme rulesets do not ship yet (see the CSS ownership open question). Remaining deferred items: magnification overlay (browser zoom sufficient), structured labels (G-13), braille routing (G-13). Sign language video is host-owned: G-14 delivers it through `qti-catalog-lookup`.

---

## Functional requirements

- **FR-1:** `AssessmentItemDefinitionConfig` must accept an optional `pnp?: PnpProfile` field. When absent, all PNP code paths must be completely inert — no DOM changes, no event listeners added, no effect on QTI 2.x items.
- **FR-2:** `session.dispatch({ action: 'updatePnp', profile })` must merge `profile` into the current PNP state and re-apply all PNP effects without re-parsing the item.
- **FR-3:** `parsePnpXml(xml: string | Element): PnpProfile` must parse an AfA PNP 3.0 document, an `access-for-all-pnp` element or the first one inside an `access-for-all-pnp-record`, into a `PnpProfile`, and return an empty profile when the input holds none. `parseAfaPnpXml` returns the whole record, or `null`, and `pnpProfileFromAfa` maps a record onto `PnpProfile`.
- **FR-4:** `applyPnpToRoot(rootEl: HTMLElement, pnp: PnpProfile): void` must set `data-qti-colorscheme` on `rootEl` to the active scheme name when a non-default scheme is present, and remove the attribute when `colorScheme` is `'default'` or absent.
- **FR-5:** When `pnp.cognitive.eliminationTool` is `true`, every `simpleChoice` in a `choiceInteraction` and every orderable item in an `orderInteraction` must render a toggle button that marks/unmarks that choice as eliminated. The button must be visible, labelled, and keyboard-operable.
- **FR-6:** An eliminated choice must receive the `data-eliminated` attribute and `aria-disabled="true"`. Its response-variable eligibility must not change — it must remain selectable and its identifier must be included in or excluded from the response exactly as if the elimination state did not exist.
- **FR-7:** When `pnp.content.extendedTime.active` is `true`, the assessment player must multiply `timeLimits.maxTime` by `pnp.content.extendedTime.multiplier` before initialising `TimeManager`. A multiplier of `Infinity` must result in no time limit being set at all (equivalent to `maxTime` absent).
- **FR-8:** When `pnp.content.glossaryOnScreen` is `true`, the item body renderer must locate every element carrying `data-catalog-idref` and decorate it with an accessible trigger button. Activating the trigger must look up the catalog entry via `getCatalogEntry(idref, 'glossary-on-screen')` and open an inline focus-trapped popup containing the catalog HTML. For `illustrated-glossary` entries the popup renders an `<img>`.
- **FR-9:** When `pnp.content.keywordTranslation.active` is `true`, the same trigger-plus-popup mechanism applies using `usage = 'keyword-translation'` and `lang = pnp.content.keywordTranslation.languageCode`.
- **FR-10:** For `tts-pronunciation`, `signing-definition`, `braille-text`, `audio-description`, and `extended-description` entries, the player must fire a `qti-catalog-lookup` `CustomEvent` on the root player element with `{ bubbles: true, composed: true }` and `detail: { idref: string; usage: string; html: string | null }`. The player must not render any popup for these platform-level usages.
- **FR-11:** The iframe postMessage protocol must be extended with a `SET_PNP` message type so that hosts using the iframe embedding mode can push PNP updates mid-session.
- **FR-12:** `parsePnpXml` must not throw on AfA features `PnpProfile` has no field for, and `parseAfaPnpXml` must keep them in the record, extension elements under `extensions`, so the host can act on them.

---

## Non-functional requirements

- **Accessibility:** The elimination toggle button must have a visible label derived from the choice text (e.g. `aria-label="Eliminate: [choice text]"` when not eliminated; `"Restore: [choice text]"` when eliminated). The button must have a minimum touch target of 44×44 CSS pixels. The `data-eliminated` attribute must be reflected via `aria-disabled="true"` so screen readers announce the eliminated state. Every color scheme must pass WCAG 1.4.3 minimum contrast (4.5:1 for normal text, 3:1 for large text) against their intended backgrounds — CSS for these schemes must be validated as part of the theming deliverable.
- **Performance:** `applyPnpToRoot` performs a single DOM attribute write. The `updatePnp` session command must be callable repeatedly during an assessment session (e.g. on each item navigation) without accumulated listeners or parsing work.
- **Cross-platform:** The elimination toggle button must be usable on touch devices (tap target, no hover dependency). Color schemes must be verified on mobile viewports (375px minimum).
- **Security:** `parsePnpXml` must not evaluate any script content from the XML input. It reads element names, text and attribute values of the AfA document; it must not `innerHTML`-inject any parsed content.
- **i18n:** The elimination button label strings (`"Eliminate"` / `"Restore"`) must be sourced from the `@pie-qti/i18n` provider under keys `accessibility.pnp.eliminate` and `accessibility.pnp.restore`. English defaults are acceptable fallbacks.

---

## Design decisions

### CSS data-attribute for color scheme over class injection

**Decision:** `applyPnpToRoot` sets `data-qti-colorscheme="<scheme>"` on the player root element; CSS rules target `[data-qti-colorscheme="blackwhite"] { ... }`.

**Rationale:** CSS class injection risks collisions with the host page's class conventions. A data-attribute is in a namespace the player controls, is easily audited, and does not conflict with DaisyUI's `data-theme` system or the accessibility system's existing `data-theme="high-contrast"` pattern.

**Alternatives considered:** Inline `style` attribute for CSS custom property overrides (rejected — properties would need to be duplicated per-scheme; hard to audit; harder for host to override).

**Consequences:** The color scheme CSS rulesets must ship in a PIE-QTI package, scoped to the player root element's attribute; which package is an open question, and none ships them yet. The host cannot suppress the scheme by removing a class; it must override via higher-specificity CSS or remove the attribute directly.

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

**Why vanilla JS, not `CatalogPopup.svelte`:** `applyGlossaryTriggers.ts` lives in the framework-agnostic item-player layer. A vanilla-JS popup satisfies the requirement without depending on the default Svelte component package. `CatalogPopup.svelte` exists in `default-components` as a separate offering for host applications that want a declaratively-mounted Svelte component with the same behavior.

**Alternatives considered:** Coupling trigger to event-only and relying on G-10 to render the popup — was the original plan but rejected when G-09 and G-10 were implemented together, since the event-only path would leave the on-screen usages inoperable until a host listener was added.

**Consequences:** The popup is rendered using `document.createElement` and appended to the DOM. It does not participate in Svelte reactivity. Its CSS classes (`qti-catalog-popup`, etc.) must be styled at the document level if the host wants branded styling.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| `AssessmentItemDefinitionConfig.pnp` | `PnpProfile` | Pass while compiling a definition; provides initial PNP state to its sessions | `createAssessmentItemDefinition({ itemXml, pnp: { display: { colorScheme: 'blackwhite' } } })` |
| `ItemSession.dispatch()` | `{ action: 'updatePnp'; profile: Partial<PnpProfile> }` | Dispatch while a session is active to update accommodations | Update color scheme when a student changes preference |
| `applyPnpToRoot()` | `(rootEl: HTMLElement, pnp: PnpProfile) => void` | Exported utility; call directly if embedding the player root in a custom shell | Apply scheme to a custom outer wrapper element |
| `parsePnpXml()` | `(xml: string \| Element) => PnpProfile` | Parse a candidate's AfA PNP 3.0 document | Feed the parsed profile into `AssessmentItemDefinitionConfig.pnp` |
| `parseAfaPnpXml()` | `(xml: string \| Element) => AfaPnpRecord \| null` | Read the whole AfA record, keyed by AfA terms | Hand it to pie-players' `createPersonalNeedsProfileFromAfa` for the toolkit's tools |
| `pnpProfileFromAfa()` | `(record: AfaPnpRecord) => PnpProfile` | Map a record already held as JSON | Build the item player's profile from a stored record |
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
     * Named color scheme; AfA color-theme terms map onto it.
     * 'default' removes the data-qti-colorscheme attribute.
     */
    colorScheme?:
      | 'default' | 'defaultreverse' | 'blackwhite' | 'whiteblack'
      | 'blackrose' | 'roseblack' | 'yellowblue' | 'blueyellow'
      | 'mgraydgray' | 'dgraymgray' | 'blackcyan' | 'cyanblack'
      | 'blackcream' | 'creamblack' | 'whitenav' | 'medgray';
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
    /** Show illustrated glossary supports when catalog entries provide them. */
    illustratedGlossary?: boolean;
    /** Enable host-routed catalog supports, by usage name. */
    catalogSupports?: CatalogSupportPreferences;
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
- The `updatePnp` command performs a shallow merge at the top level (`display`, `content`, `cognitive`) and a deep merge one level deeper (so dispatching `{ action: 'updatePnp', profile: { content: { glossaryOnScreen: true } } }` does not clear `content.extendedTime`).
- The `data-qti-colorscheme` attribute must be the only PNP-owned attribute on the player root. Future PNP attributes must use the same `data-qti-` prefix.

---

## Acceptance criteria

### Color schemes

**AC-1: Default scheme — no attribute**
```
Given: A definition/session is created with no pnp config (or pnp.display.colorScheme = 'default')
When: The player root element is inspected
Then: No data-qti-colorscheme attribute is present on the root element
```

**AC-2: Named scheme applied**
```
Given: A definition/session is created with pnp: { display: { colorScheme: 'blackwhite' } }
When: The player root element is inspected
Then: data-qti-colorscheme="blackwhite" is set on the root element
```

**AC-3: Every named scheme accepted without error**
```
Given: Definitions/sessions are created successively with each named color scheme
  ('blackwhite', 'whitenav', 'blackcream', 'yellowblue', 'medgray', 'default', …)
When: Each instance's root element is inspected
Then: Each instance has the corresponding data-qti-colorscheme attribute value
  (or no attribute for 'default')
  AND no JavaScript error is thrown for any scheme name
```

**AC-4: Mid-session scheme update via the session command**
```
Given: A session is running with pnp: { display: { colorScheme: 'blackwhite' } }
When: session.dispatch({ action: 'updatePnp', profile: { display: { colorScheme: 'yellowblue' } } }) is called
Then: data-qti-colorscheme="yellowblue" is set on the root element
  AND the item is not re-parsed or re-rendered (no flicker)
```

**AC-5: Scheme cleared via the session command**
```
Given: A session presentation has data-qti-colorscheme="blackwhite" set
When: session.dispatch({ action: 'updatePnp', profile: { display: { colorScheme: 'default' } } }) is called
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

**AC-20: Maps a color theme**
```
Given: <access-for-all-pnp xmlns="http://www.imsglobal.org/xsd/qtiv3p0/imsafa3p0pnp_v1p0">
         <text-appearance><color-theme>high-contrast</color-theme></text-appearance>
       </access-for-all-pnp>
When: parsePnpXml() is called with this document
Then: The result is { display: { colorScheme: 'blackwhite' } }
```

**AC-21: Returns an empty profile when no AfA profile is present**
```
Given: An XML string with no access-for-all-pnp element
When: parsePnpXml() is called
Then: {} is returned AND no error is thrown
  AND parseAfaPnpXml() returns null
```

**AC-22: Keeps unmapped features in the record**
```
Given: An access-for-all-pnp holding <calculator-on-screen calculator-type="scientific"/>
  and an extension element <kxz:kxztesting-illustrated-glossary-on-screen/>
When: parsePnpXml() and parseAfaPnpXml() are called
Then: parsePnpXml() returns {} AND no error is thrown
  AND parseAfaPnpXml() returns { 'calculator-on-screen': { 'calculator-type': 'scientific' },
    extensions: { 'kxztesting-illustrated-glossary-on-screen': {} } }
```

**AC-23: Maps additional testing time**
```
Given: <additional-testing-time><time-multiplier>1.5</time-multiplier></additional-testing-time>
When: parsePnpXml() is called
Then: result.content.extendedTime = { active: true, multiplier: 1.5 }
  AND <unlimited/> in its place gives multiplier Infinity
```

**AC-24: Honors prohibit-set**
```
Given: An access-for-all-pnp holding <glossary-on-screen/> and
  <prohibit-set><glossary-on-screen/></prohibit-set>
When: parsePnpXml() is called
Then: result.content?.glossaryOnScreen is undefined
```

---

### QTI 2.x items unaffected

**AC-24: No PNP side-effects on QTI 2.x item without config**
```
Given: A QTI 2.x assessmentItem is loaded with no pnp in AssessmentItemDefinitionConfig
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

**AC-E1: updatePnp command partial merge preserves unspecified fields**
```
Given: A session with pnp: { display: { colorScheme: 'blackwhite' }, content: { extendedTime: { active: true, multiplier: 1.5 } } }
When: session.dispatch({ action: 'updatePnp', profile: { display: { colorScheme: 'yellowblue' } } }) is called
Then: data-qti-colorscheme is updated to 'yellowblue'
  AND content.extendedTime is unchanged (still active with multiplier 1.5)
```

**AC-E2: Empty PnpProfile has no effect**
```
Given: A definition/session is created with pnp: {}
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

- [ ] **Color scheme CSS ownership:** The CSS rulesets for `[data-qti-colorscheme=...]` must be specified somewhere. Should they live in `@pie-qti/default-components` (alongside the interaction styles) or in `@pie-qti/item-player` (alongside the `applyPnpToRoot` logic)? The constraint is that the CSS must be applied to interactions inside Shadow DOM; the current DaisyUI theme CSS uses `::part()` to pierce shadow boundaries for known parts.
- [ ] **Elimination state persistence across item navigation:** If a student navigates away from an item and returns, should their elimination marks be preserved? The response variable is preserved (that's the standard session state mechanism); elimination marks are UI-only. Storing them requires a separate PNP session state channel not currently defined.
- [ ] **orderInteraction elimination UX:** The `orderInteraction` uses a drag-and-drop + keyboard reordering UI (`SortableList`). Where exactly should the eliminate button appear relative to a draggable row, and how should the button interact with the drag affordance? This detail needs UX review before implementation.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §6.2 (PNP profile); [AfA PNP 3.0](https://www.imsglobal.org/spec/afa/v3p0/info)
- pie-players: [support ids](https://github.com/pie-framework/pie-players/blob/develop/packages/assessment-toolkit/docs/TOOL_REGISTRY.md#support-ids), the AfA term to tool id mapping
- Spec gap: `docs/SPEC-GAPS-PLAN.md` §G-09 (Done, Tier 2)
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
