# PRD: Catalog System (Glossary and Accessibility Content)

<!--
  Status: current
  Type: system
  Packages: @pie-qti/item-player, @pie-qti/default-components
  Last reviewed: 2026-04-28
-->

**Status:** current
**Type:** system
**Packages:** `@pie-qti/item-player`, `@pie-qti/default-components`
**Last reviewed:** 2026-04-28

---

## Summary

The QTI 3.0 catalog system (§6.3) provides a structured store of per-term accessibility and translation content embedded in QTI items. An item may contain a `<qti-catalog-info>` element holding named `<qti-card>` entries, each with typed content entries (`glossary-on-screen`, `keyword-translation`, `illustrated-glossary`, `tts-pronunciation`, `signing-definition`, `braille-text`, `audio-description`, `extended-description`). In the item body, elements marked with `data-catalog-idref` link to a catalog card by identifier. PIE-QTI implements catalog parsing (`CatalogIndex` builder), a `player.getCatalogEntry()` lookup API, an in-player `CatalogPopup` component for on-screen usages (glossary and illustrated glossary), and event-based forwarding for platform-level usages (TTS, signing, braille, audio description). Catalog activation is gated on the PNP profile (G-09): glossary and keyword-translation content only appear when `pnp.content.glossaryOnScreen` or `pnp.content.keywordTranslation.active` is true. Shared external catalog files (G-15) and braille hardware routing (G-13) are deferred.

---

## Background and rationale

### Why catalogs exist

State K-12 assessments are required to provide vocabulary support for English Language Learner (ELL) students and students with cognitive disabilities, without giving unfair advantages. A glossary that explains the meaning of a domain-specific word used in a science question — "photosynthesis" — is an approved accommodation; one that explains the answer is not. The QTI catalog mechanism standardizes this: item authors annotate specific terms with `data-catalog-idref`, and the catalog entry at that identifier carries the approved support content. The delivery player shows the content only when the student's PNP profile requests it.

Before QTI 3.0, this vocabulary scaffolding was always platform-specific: content authors annotated terms and separately configured which students got which glossary. The QTI catalog embeds both the annotation and the content in the item itself, making the glossary portable across delivery platforms and reducing the operational burden of per-platform accommodation management.

### Why eight usage types

The eight usage types map onto different delivery capabilities with different platform dependencies:

| Usage type | Who delivers it |
|-----------|----------------|
| `glossary-on-screen` | Player renders inline popup |
| `keyword-translation` | Player renders inline popup |
| `illustrated-glossary` | Player renders inline popup (with `<img>`) |
| `tts-pronunciation` | Host TTS engine (event-based) |
| `signing-definition` | Host video player (event-based) |
| `braille-text` | Host braille hardware driver (event-based) |
| `audio-description` | Host audio player (event-based) |
| `extended-description` | Host or player popup (event-based) |

The player owns the on-screen visual usages (`glossary-on-screen`, `keyword-translation`, `illustrated-glossary`) because they require only DOM manipulation and CSS. The platform-level usages require capabilities the player cannot assume: a TTS engine, a braille display, a video renderer. These are surfaced as `qti-catalog-lookup` events so the host can wire them without the player needing to know what host capability exists.

### Why glossary is gated on PNP

Showing glossary pop-ups to all students would compromise test validity — a student who did not request the accommodation could use it to look up every term. The PNP gating ensures only students with the `glossaryOnScreen` or `keywordTranslation` accommodation active see the trigger UI. Items with `data-catalog-idref` but no PNP activation render as plain text. This is the same model used in paper-based testing: a glossary booklet is only distributed to students whose IEPs specify it.

### Why the popup is in `default-components`, not `item-player`

`item-player` is a framework package with no DOM rendering opinion. `CatalogPopup` is a concrete UI component — it needs CSS, focus management, and DOM structure. Placing it in `default-components` alongside other interaction components is consistent with the package boundary: `item-player` provides data and lifecycle, `default-components` provides UI. The player instantiates `CatalogPopup` via the component registry (the same mechanism used for interaction components), making it replaceable by hosts that want a custom popup design.

### Language fallback algorithm

QTI catalog cards are per-identifier, not per-language. Each card can have multiple `<qti-card-entry>` elements for different languages (via `xml:lang`). The lookup algorithm applies three-level fallback:

1. Exact match on `xml:lang` (e.g. `en-US`)
2. Language-prefix match (e.g. `en` matches `en-US`, `en-GB`)
3. Entry with no `xml:lang` attribute (language-neutral fallback)

This mirrors the language negotiation algorithm used by HTTP `Accept-Language` and is the pattern established by APIP 1.0. It ensures ELL students with a regional language code (`es-MX`) will receive content authored for `es` when no exact match exists.

---

## QTI specification alignment

- **Spec version:** QTI 3.0
- **Spec section:** §6.3 — Catalog

### Supported elements

| QTI 3.0 element | Camelcase mapping | Notes |
|----------------|-------------------|-------|
| `<qti-catalog-info>` | `cataloginfo` | Extracted at item-parse time; builds `CatalogIndex` |
| `<qti-catalog>` | `catalog` | Direct child of assessment item or standalone |
| `<qti-card>` | `card` | Identified by `identifier` attribute |
| `<qti-card-entry>` | `cardentry` | Has `usage` and `xml:lang` attributes |
| `<qti-html-content>` | `htmlcontent` | Inner HTML is the glossary/translation content |
| `<qti-file-href>` | `filehref` | `src` attribute is a URL to a media resource |
| `data-catalog-idref` | `dataCatalogIdref` | HTML attribute on term elements in the item body |

All six element names are already registered in `CATALOG_ELEMENTS` in `packages/qti-common/src/element-mapper/qti3-element-mappings.ts`.

### Supported usage types

All eight types defined in QTI 3.0 §6.3 are parsed and stored in `CatalogIndex`. The table below documents delivery behavior per type:

| Usage type | Popup rendered by player | Event fired | Notes |
|-----------|--------------------------|-------------|-------|
| `glossary-on-screen` | Yes | No | Requires `pnp.content.glossaryOnScreen = true` |
| `keyword-translation` | Yes | No | Requires `pnp.content.keywordTranslation.active = true`; filters by `languageCode` |
| `illustrated-glossary` | Yes (as `<img>`) | No | Content is an image URL; `html` field is used as `<img src>` |
| `tts-pronunciation` | No | Yes | Host TTS engine |
| `signing-definition` | No | Yes | Host video player |
| `braille-text` | No | Yes | Host braille hardware; G-13 tracks data routing |
| `audio-description` | No | Yes | Host audio player |
| `extended-description` | No | Yes | May be rendered by host as a text popup |

### Deliberately omitted / deferred features

| Feature | Reason |
|---------|--------|
| Shared/external catalog files from IMS manifest (`catalogXml` with manifest resolution) | G-15, deferred; infrastructure is planned (`PlayerConfig.catalogXml`) but manifest-level linking requires IMS CP support |
| Braille hardware routing | G-13, deferred; `getCatalogEntry()` exposes the `braille-text` content; host routes it |
| Sign language video player | G-14, deferred; event fires; host provides player |
| `qti-companion-materials-info` | Different from catalog; not in scope for G-10 |

### Known gaps

**G-10 — Catalog system (Done, Tier 2):** The core catalog parser, lookup API, glossary/keyword-translation popup path, and platform-level lookup events are implemented. See `docs/SPEC-GAPS-PLAN.md §G-10` for the historical action list and remaining deferred items.

**G-15 — Shared/external catalog files from IMS manifest (Deferred, Tier 3):** `PlayerConfig.catalogXml` is supported for host-provided shared catalog XML. Manifest-level catalog discovery and resolution are not implemented.

---

## Functional requirements

- **FR-1:** After parsing a QTI 3.0 item, the player must call `extractCatalog()` on the item root and store the resulting `CatalogIndex` internally. This must happen before any item body rendering.
- **FR-2:** `extractCatalog(itemRoot: Element, mapper: ElementNameMapper): CatalogIndex` must parse all `<qti-catalog-info>` and `<qti-catalog>` children of the item root, building a `Map<string, CatalogCard>` keyed by card `identifier`.
- **FR-3:** For each `<qti-card>`, all `<qti-card-entry>` children must be read. For each entry: `usage` from the `usage` attribute; `lang` from the `xml:lang` attribute (absent if not set); `html` from the inner HTML of a `<qti-html-content>` child, or from the `src` attribute of a `<qti-file-href>` child.
- **FR-4:** All eight catalog usage types must be stored: `glossary-on-screen`, `keyword-translation`, `illustrated-glossary`, `tts-pronunciation`, `signing-definition`, `braille-text`, `audio-description`, `extended-description`. Unknown usage values must be stored as-is (forward-compatible).
- **FR-5:** `player.getCatalogEntry(idref: string, usage: string, lang?: string): string | null` must be a public player method. It must apply the three-level language fallback: exact `xml:lang` match, then language-prefix match, then no-`xml:lang` entry. It must return `null` when the identifier is not found or when no entry matches the requested usage.
- **FR-6:** If `PlayerConfig.catalogXml` is provided, the player must parse it as a standalone catalog XML string and merge it into the item-level `CatalogIndex`. Item-level entries must take precedence over shared entries when both define the same card identifier.
- **FR-7:** When `pnp.content.glossaryOnScreen` is true, the item body renderer must find every `[data-catalog-idref]` element in the rendered item body and mount an accessible trigger button. Activating the trigger must open a focus-trapped inline popup populated with the result of `getCatalogEntry(idref, 'glossary-on-screen')`.
- **FR-8:** When `pnp.content.keywordTranslation.active` is true, the same trigger mechanism applies using `usage = 'keyword-translation'` and `lang = pnp.content.keywordTranslation.languageCode`. If no matching entry is found for the requested language, the trigger must still render (and the popup content may be empty or fall back to the no-lang entry).
- **FR-9:** For `illustrated-glossary` entries, the popup must render the `html` value as an `<img src="...">` with an `alt` attribute derived from the term's visible text.
- **FR-10:** For `tts-pronunciation`, `signing-definition`, `braille-text`, `audio-description`, and `extended-description` entries, the player must fire a `qti-catalog-lookup` `CustomEvent` (same event used by PNP trigger UI) with `detail: { idref, usage, html }`. The player must not render any popup for these usages.
- **FR-11:** `CatalogPopup.svelte` must be a Svelte component in `packages/default-components/src/catalog/` that accepts `content: string`, `label: string`, and `onClose: () => void` props, for use by host applications. The player's own popup is implemented as a vanilla-JS `mountPopup()` function in `applyGlossaryTriggers.ts`; both must implement equivalent accessibility behavior (focus trap, Escape to close, `role="dialog"`).
- **FR-12:** When `pnp` is absent or neither `glossaryOnScreen` nor `keywordTranslation.active` is true, no trigger buttons must appear on `[data-catalog-idref]` elements, regardless of whether a catalog is present.

---

## Non-functional requirements

- **Accessibility:** `CatalogPopup` must use `role="dialog"` with `aria-label` set from the `label` prop. It must be focus-trapped: Tab and Shift+Tab cycle within the popup; Escape closes it and returns focus to the trigger that opened it. The trigger button must have `aria-label="Show definition: [term text]"` (or the localized equivalent). The popup must be keyboard-dismissable without mouse interaction. Illustrated-glossary `<img>` elements must have a non-empty `alt` attribute.
- **Performance:** `extractCatalog` runs once at item-parse time and produces an in-memory `Map`. `getCatalogEntry` is a synchronous map lookup with O(n) scan over a card's entries (n ≤ 8 typical); it must not cause perceptible latency. Popup mounting must not block the main thread.
- **Cross-platform:** `CatalogPopup` must be usable on touch devices: dismissable by tapping outside it (if practical) and by activating a visible close button within it. The popup must not overflow the viewport on 375px-wide screens.
- **Security:** `html` values from `<qti-html-content>` must be passed through the same HTML sanitizer used by the item body renderer before being set as `innerHTML` in `CatalogPopup`. Unsanitized catalog HTML must never reach the DOM. `<qti-file-href>` `src` URLs must pass the URL policy configured in `PlayerSecurityConfig.urlPolicy`.
- **i18n:** The trigger button label (`"Show definition"`) and the popup close button label (`"Close"`) must be sourced from the `@pie-qti/i18n` provider under keys `accessibility.catalog.showDefinition` and `accessibility.catalog.close`. English defaults are acceptable fallbacks.

---

## Design decisions

### Event forwarding for platform-level usages

**Decision:** For `tts-pronunciation`, `signing-definition`, `braille-text`, `audio-description`, and `extended-description`, the player fires a `qti-catalog-lookup` event and renders no UI. The host provides the delivery capability.

**Rationale:** TTS engines, braille hardware drivers, and video players are platform-level capabilities that vary by deployment context. A school district might use a specific TTS vendor; an assessment platform might have its own sign-language video infrastructure. The player cannot and should not bundle or assume any of these. Emitting an event with the catalog content passes the data to whoever is equipped to act on it; event-driven extension points are the boundary for host-owned capabilities.

**Alternatives considered:** Bundling a basic audio player for `tts-pronunciation` — rejected because it would force a TTS engine dependency into the player, increasing bundle size, and would likely be replaced by the host anyway.

**Consequences:** Without a host listener, platform-level catalog lookups are silently ignored. This is accepted: the data is available in the catalog; the player's job is to surface it, not to deliver it. Hosts integrating platform-level usages must listen to `qti-catalog-lookup` and act on the appropriate `usage` values.

---

### Vanilla-JS popup in `item-player`; `CatalogPopup.svelte` for host apps

**Decision:** The in-player popup for on-screen catalog usages is a vanilla-JS `mountPopup()` function in `packages/item-player/src/catalog/applyGlossaryTriggers.ts`. `CatalogPopup.svelte` in `packages/default-components/src/catalog/` is a separate Svelte component provided for host applications, not used internally by the player.

**Rationale:** `applyGlossaryTriggers.ts` lives in the framework-agnostic item-player layer. A vanilla-JS popup (`document.createElement`, `role="dialog"`, Tab-trap event listener) satisfies the accessibility requirements with no direct dependency on the default Svelte component package. `CatalogPopup.svelte` is provided as a convenience for host applications that want a declaratively-mountable Svelte component with the same UX.

**Alternatives considered:** Instantiating `CatalogPopup.svelte` from `item-player` via the component registry — rejected because `item-player` deliberately has no Svelte dependency; introducing one via the registry would couple the framework package to a UI framework.

**Consequences:** The player's popup has no Svelte reactivity and no DaisyUI styling. Its CSS classes (`qti-catalog-popup`, `qti-catalog-popup__header`, etc.) must be styled at the document level by the host if custom branding is needed. Hosts that want full design control can ignore the built-in popup and instead listen to `qti-catalog-lookup` events to mount their own popup.

---

### Language fallback algorithm

**Decision:** `getCatalogEntry` applies three levels in order: exact `xml:lang` match → language-prefix match → no-`xml:lang` entry. If none match, return `null`.

**Rationale:** This is the algorithm specified in APIP 1.0 (the predecessor accessibility spec that QTI 3.0 catalog inherits from) and mirrors HTTP `Accept-Language` negotiation. It ensures that a student with locale `es-MX` receives content authored for `es` when no `es-MX` entry exists, rather than receiving no content at all. The no-lang fallback ensures language-neutral items (e.g. a math diagram with a text description in no particular language) are always served.

**Alternatives considered:** Exact match only — rejected because item authors frequently author translations at the language level (`es`) not the locale level (`es-MX`), so exact-only would produce many false misses in practice.

**Consequences:** When multiple no-lang entries exist for the same usage (invalid per spec but possible in practice), the first encountered is returned. `extractCatalog` stores entries in document order, making this deterministic.

---

### Illustrated-glossary renders as `<img>`

**Decision:** When a `<qti-file-href>` element provides the entry content, the catalog stores its `src` URL in the `html` field; `CatalogPopup` renders it as `<img src="..." alt="...">`.

**Rationale:** Illustrated glossaries are a QTI 3.0 named usage type with clear semantics: an image, not markup. Storing the URL in the `html` field (rather than a separate `src` field) keeps the `CatalogEntry` interface uniform — all entries have an `html` string — and `CatalogPopup` detects the illustrated-glossary usage type to decide the rendering mode.

**Alternatives considered:** Adding a separate `src?: string` field to `CatalogEntry` — rejected because it would require every consumer to handle both `html` and `src`, and the distinction can be inferred from the `usage` value.

**Consequences:** The `html` field for `illustrated-glossary` entries contains a URL string, not HTML markup. Code that reads `getCatalogEntry()` and expects HTML for all usages must check `usage === 'illustrated-glossary'` before trying to set `innerHTML`.

---

### Catalog activation requires PNP

**Decision:** No trigger buttons appear on `[data-catalog-idref]` elements unless `pnp.content.glossaryOnScreen` or `pnp.content.keywordTranslation.active` is true. The catalog is always parsed (G-10), but the trigger UI is only rendered when the PNP profile activates it (G-09).

**Rationale:** Showing vocabulary aids to students who have not requested them compromises test validity and creates clutter for students who do not need it. The PNP profile is the authoritative record of which accommodations a student is entitled to.

**Alternatives considered:** Always showing glossary triggers when a catalog is present — rejected because it bypasses the accommodation-control mechanism that is legally required in state assessments.

**Consequences:** A correctly configured catalog will produce no visible UI unless a matching PNP profile is provided. Testing catalog UI requires combining a catalog fixture with a PNP config.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| `PlayerConfig.catalogXml` | `string` (standalone catalog XML) | Pass a shared catalog XML string; merged with item-level catalog; item-level entries win on collision | Load an assessment-level glossary XML and pass it to each item player |
| `player.getCatalogEntry()` | `(idref: string, usage: string, lang?: string) => string \| null` | Call directly from host code to retrieve catalog content | Implement a custom glossary dialog that populates from `getCatalogEntry()` |
| `qti-catalog-lookup` event | `CustomEvent<{ idref: string; usage: string; html: string \| null; languageCode?: string }>` | Listen on the player root for platform-level usages | Wire `tts-pronunciation` to the host TTS engine |
| `CatalogPopup` host component | `packages/default-components/src/catalog/CatalogPopup.svelte` | Use in host app for declarative Svelte popup; or listen to `qti-catalog-lookup` events and mount any custom popup | Provide a branded popup with additional context information |

---

## Data model / contracts

### `CatalogIndex`, `CatalogCard`, `CatalogEntry`

Defined in `packages/item-player/src/catalog/types.ts`:

```typescript
/**
 * Top-level map keyed by card identifier (the value of <qti-card identifier="...">).
 */
export type CatalogIndex = Map<string, CatalogCard>;

export interface CatalogCard {
  entries: CatalogEntry[];
}

export interface CatalogEntry {
  /**
   * One of the eight QTI 3.0 usage types, or an unknown string for forward-compatibility.
   * For 'illustrated-glossary' entries, html contains the image URL, not HTML markup.
   */
  usage:
    | 'glossary-on-screen'
    | 'keyword-translation'
    | 'illustrated-glossary'
    | 'tts-pronunciation'
    | 'signing-definition'
    | 'braille-text'
    | 'audio-description'
    | 'extended-description'
    | string;
  /**
   * xml:lang value from the entry element (e.g. 'en-US', 'es').
   * Absent for language-neutral entries.
   */
  lang?: string;
  /**
   * Inner HTML of <qti-html-content>, or src URL for <qti-file-href> (illustrated-glossary).
   * Sanitized before insertion into the DOM.
   */
  html: string;
}
```

### `qti-catalog-lookup` event (extended)

The same event fired by the PNP trigger UI (G-09) is reused for catalog-lookup results from platform-level usages. The `html` field is added when the player has resolved catalog content:

```typescript
interface QtiCatalogLookupDetail {
  /** The data-catalog-idref value on the triggered term element. */
  idref: string;
  /** Catalog usage type. */
  usage: string;
  /**
   * Resolved catalog content (HTML string or image URL for illustrated-glossary).
   * null if no entry matched for this usage.
   */
  html: string | null;
  /** Language code, present for keyword-translation and when language filtering was applied. */
  languageCode?: string;
}
```

### Invariants

- A `CatalogIndex` is always a plain `Map`; it is not serializable directly but individual entries are plain objects safe to include in `postMessage` payloads.
- `extractCatalog` always returns a `Map` (empty if no catalog elements found); it never returns `null`.
- `getCatalogEntry` is a pure function of `(CatalogIndex, idref, usage, lang)` — no side effects, no events fired.
- The `html` field of a `CatalogEntry` contains either sanitized HTML markup (for text usages) or a URL string (for `illustrated-glossary`). It never contains raw unsanitized user-supplied markup after extraction.
- `CatalogPopup` is responsible for safely rendering `html`: it must use the player's sanitizer, not `innerHTML` directly.

---

## Acceptance criteria

### Catalog parsing

**AC-1: Parses all eight usage types**
```
AC-1: Parses all eight usage types
  Given: An item XML containing a <qti-catalog-info> element with cards covering all eight usage types
  When: The player loads the item
  Then: player.getCatalogEntry('cat-id', 'glossary-on-screen') returns the expected HTML
    AND player.getCatalogEntry('cat-id', 'keyword-translation', 'es') returns the Spanish translation
    AND player.getCatalogEntry('cat-id', 'illustrated-glossary') returns a URL string
    AND player.getCatalogEntry('cat-id', 'tts-pronunciation') returns the pronunciation text
    AND player.getCatalogEntry('cat-id', 'signing-definition') returns the signing URL
    AND player.getCatalogEntry('cat-id', 'braille-text') returns the braille text
    AND player.getCatalogEntry('cat-id', 'audio-description') returns the audio description HTML
    AND player.getCatalogEntry('cat-id', 'extended-description') returns the extended description HTML
```

**AC-2: Returns null for unknown identifier**
```
AC-2: Returns null for unknown identifier
  Given: A player with a catalog containing only 'cat-science'
  When: player.getCatalogEntry('cat-unknown', 'glossary-on-screen') is called
  Then: null is returned AND no error is thrown
```

**AC-3: Returns null for unknown usage on known identifier**
```
AC-3: Returns null for unknown usage on known identifier
  Given: A player with a catalog where card 'cat-science' has only a 'glossary-on-screen' entry
  When: player.getCatalogEntry('cat-science', 'tts-pronunciation') is called
  Then: null is returned
```

**AC-4: Language fallback — exact match first**
```
AC-4: Language fallback — exact match first
  Given: A card with entries for lang='en-US', lang='en', and no-lang
  When: player.getCatalogEntry('cat-id', 'glossary-on-screen', 'en-US') is called
  Then: The en-US entry's html is returned
```

**AC-5: Language fallback — prefix match**
```
AC-5: Language fallback — prefix match
  Given: A card with entries for lang='en' and no-lang but no lang='en-US'
  When: player.getCatalogEntry('cat-id', 'glossary-on-screen', 'en-US') is called
  Then: The 'en' entry's html is returned (prefix match)
```

**AC-6: Language fallback — no-lang entry**
```
AC-6: Language fallback — no-lang entry
  Given: A card with only a no-lang entry for usage 'glossary-on-screen'
  When: player.getCatalogEntry('cat-id', 'glossary-on-screen', 'fr') is called
  Then: The no-lang entry's html is returned
```

**AC-7: Shared catalog merged; item-level wins on collision**
```
AC-7: Shared catalog merged; item-level wins on collision
  Given: A player constructed with catalogXml containing card 'cat-shared' with content "shared definition"
    AND an item containing a <qti-catalog-info> card 'cat-shared' with content "item definition"
  When: player.getCatalogEntry('cat-shared', 'glossary-on-screen') is called
  Then: "item definition" is returned (item-level wins)
```

**AC-8: Shared catalog card available when not overridden by item**
```
AC-8: Shared catalog card available when not overridden by item
  Given: A player constructed with catalogXml containing card 'cat-shared' with content "shared definition"
    AND an item with no catalog entry for 'cat-shared'
  When: player.getCatalogEntry('cat-shared', 'glossary-on-screen') is called
  Then: "shared definition" is returned
```

---

### Glossary popup

**AC-9: Trigger buttons render when glossaryOnScreen is true**
```
AC-9: Trigger buttons render when glossaryOnScreen is true
  Given: An item body containing <span data-catalog-idref="cat-photosynthesis">photosynthesis</span>
    AND a catalog entry for 'cat-photosynthesis' with usage 'glossary-on-screen'
    AND pnp: { content: { glossaryOnScreen: true } }
  When: The item renders
  Then: A trigger button is rendered on or adjacent to the "photosynthesis" span
    AND the button has an aria-label that includes the term text
```

**AC-10: Glossary popup opens on trigger activation with correct content**
```
AC-10: Glossary popup opens on trigger activation with correct content
  Given: A glossary trigger button is rendered for 'cat-photosynthesis'
    AND the catalog entry html is "<p>Photosynthesis is the process by which...</p>"
  When: The user activates the trigger button
  Then: A popup appears containing the catalog entry HTML
    AND no qti-catalog-lookup event is fired for this usage
```

**AC-11: No trigger buttons when glossaryOnScreen is false**
```
AC-11: No trigger buttons when glossaryOnScreen is false
  Given: An item body with data-catalog-idref attributes
    AND pnp: { content: { glossaryOnScreen: false } } (or PNP absent)
  When: The item renders
  Then: No trigger buttons are rendered on any data-catalog-idref element
```

**AC-12: No trigger buttons when catalog has no entry for the term**
```
AC-12: No trigger buttons when catalog has no entry for the term
  Given: An item with data-catalog-idref="cat-missing" where no catalog card exists for 'cat-missing'
    AND pnp: { content: { glossaryOnScreen: true } }
  When: The item renders
  Then: No trigger button appears on the data-catalog-idref element
  Notes: The player must not crash; it must silently skip terms with no matching catalog entry
```

---

### Keyword translation

**AC-13: Keyword translation popup opens with correct language match**
```
AC-13: Keyword translation popup opens with correct language match
  Given: A catalog card with a keyword-translation entry for lang='es' content "fotosíntesis"
    AND pnp: { content: { keywordTranslation: { active: true, languageCode: 'es' } } }
  When: The user activates the trigger for that term
  Then: A popup appears containing "fotosíntesis"
    AND event.detail.usage is "keyword-translation" is NOT fired (popup rendered by player)
```

---

### Illustrated glossary

**AC-14: Illustrated glossary renders as image**
```
AC-14: Illustrated glossary renders as image
  Given: A catalog card with an illustrated-glossary entry where html="/images/photosynthesis.png"
    AND pnp: { content: { glossaryOnScreen: true } }
  When: The user activates the trigger and the popup opens
  Then: The popup contains an <img> element with src="/images/photosynthesis.png"
    AND the img has a non-empty alt attribute derived from the term text
```

---

### Platform-level usages — event dispatch

**AC-15: tts-pronunciation fires qti-catalog-lookup event**
```
AC-15: tts-pronunciation fires qti-catalog-lookup event
  Given: A catalog card with a tts-pronunciation entry
    AND the player root element has a qti-catalog-lookup listener
    AND the PNP glossaryOnScreen is true (trigger rendered)
  When: The user activates the trigger on the annotated term
  Then: A qti-catalog-lookup CustomEvent is dispatched with:
    - event.detail.usage = 'tts-pronunciation'
    - event.detail.idref = the correct idref value
    - event.detail.html = the tts-pronunciation entry html
    AND no popup is rendered by the player
    AND event.bubbles is true AND event.composed is true
```

**AC-16: Platform events fired for all five platform-level usages**
```
AC-16: Platform events fired for all five platform-level usages
  Given: A catalog card with entries for 'tts-pronunciation', 'signing-definition',
    'braille-text', 'audio-description', and 'extended-description'
  When: getCatalogEntry is called for each usage (trigger mechanism or direct call)
  Then: For each platform-level usage, a qti-catalog-lookup event is dispatched
    AND no popup is rendered by the player for any of these usages
```

---

### Accessibility

**AC-A1: CatalogPopup is focus-trapped**
```
AC-A1: CatalogPopup is focus-trapped
  Given: A CatalogPopup is open
  When: A keyboard user presses Tab repeatedly
  Then: Focus cycles through focusable elements within the popup
    AND focus does not leave the popup until it is closed
```

**AC-A2: CatalogPopup closes on Escape and returns focus**
```
AC-A2: CatalogPopup closes on Escape and returns focus
  Given: A CatalogPopup is open; it was opened by activating trigger button T
  When: The user presses Escape
  Then: The popup closes
    AND focus returns to trigger button T
```

**AC-A3: CatalogPopup has role="dialog" with accessible name**
```
AC-A3: CatalogPopup has role="dialog" with accessible name
  Given: A CatalogPopup is rendered with label="Definition: photosynthesis"
  When: A screen reader encounters the popup
  Then: The popup element has role="dialog"
    AND aria-label="Definition: photosynthesis" (or aria-labelledby pointing to a heading with that text)
```

**AC-A4: Trigger button is keyboard operable**
```
AC-A4: Trigger button is keyboard operable
  Given: A glossary trigger button is rendered
  When: A keyboard user tabs to the button and presses Enter or Space
  Then: The popup opens (or the qti-catalog-lookup event fires for platform usages)
    AND focus enters the popup (for on-screen popups)
```

**AC-A5: Illustrated glossary image has non-empty alt**
```
AC-A5: Illustrated glossary image has non-empty alt
  Given: An illustrated-glossary popup is open
  When: A screen reader encounters the <img> in the popup
  Then: The image has a non-empty alt attribute
    AND the alt value is derived from the term's visible text, not the image URL
```

---

### Edge cases

**AC-E1: Multiple data-catalog-idref elements in one item**
```
AC-E1: Multiple data-catalog-idref elements in one item
  Given: An item with three separate data-catalog-idref spans, each with different idrefs
    AND a catalog with entries for all three AND pnp.content.glossaryOnScreen = true
  When: The item renders
  Then: Three separate trigger buttons appear, one per span
    AND each trigger opens a popup with the correct content for its idref
    AND opening one popup does not affect the others
```

**AC-E2: data-catalog-idref with no catalog present**
```
AC-E2: data-catalog-idref with no catalog present
  Given: An item with data-catalog-idref attributes but no <qti-catalog-info> element
    AND pnp.content.glossaryOnScreen = true
  When: The item renders
  Then: No trigger buttons appear
    AND no JavaScript error is thrown
```

**AC-E3: Empty catalog (no cards)**
```
AC-E3: Empty catalog (no cards)
  Given: An item with a <qti-catalog-info> element containing no <qti-card> children
  When: extractCatalog is called
  Then: An empty CatalogIndex (size 0) is returned AND no error is thrown
```

**AC-E4: Forward-compatible unknown usage type stored and returned**
```
AC-E4: Forward-compatible unknown usage type stored and returned
  Given: A catalog card with a <qti-card-entry usage="future-usage-type"> element
  When: extractCatalog is called
  Then: The entry is stored with usage='future-usage-type'
    AND getCatalogEntry(idref, 'future-usage-type') returns the entry's html
    AND no error is thrown during extraction
```

**AC-E5: QTI 2.x items with no catalog are unaffected**
```
AC-E5: QTI 2.x items with no catalog are unaffected
  Given: A QTI 2.x assessmentItem with no catalog elements
    AND no pnp config
  When: The item loads and renders normally
  Then: No trigger buttons appear
    AND player.getCatalogEntry() returns null for any call
    AND item behaviour is identical to a player with no catalog code present
```

---

## Open questions

- [x] **CatalogPopup positioning strategy:** Resolved — the popup anchors to the trigger element (tooltip/inline style), appended as a child of the wrapper span. Short definitions display inline; longer content scrolls within the popup body.

- [x] **Trigger button visual design for terms with multiple catalog usages:** Resolved — `applyGlossaryTriggers` creates one trigger per active PNP accommodation. If both `glossaryOnScreen` and `keywordTranslation.active` are true, two buttons appear per term. Each button is independently labelled.

- [x] **Platform-level event trigger point:** Resolved — events fire on trigger button activation (same mechanism as glossary). Automatic intersection-observer triggering was deferred; the trigger button is the canonical activation point for this milestone.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §6.3 (Catalog)
- Spec gap: `docs/SPEC-GAPS-PLAN.md` §G-10 (Done, Tier 2)
- Spec gap: `docs/SPEC-GAPS-PLAN.md` §G-15 (shared catalog, Deferred, Tier 3)
- Element mappings (already in place): `packages/qti-common/src/element-mapper/qti3-element-mappings.ts` — `CATALOG_ELEMENTS`
- Adjacent PRD: `docs/prds/systems/pnp.md` — PNP profile; `glossaryOnScreen` and `keywordTranslation` flags gate catalog trigger UI
- Adjacent PRD: `docs/prds/systems/accessibility.md` — WCAG 2.2 AA baseline; CatalogPopup accessibility requirements derive from it
- Implementation: `packages/item-player/src/catalog/types.ts`, `catalogExtractor.ts`, `catalogLookup.ts`
- Implementation: `packages/item-player/src/catalog/applyGlossaryTriggers.ts` (trigger injection + vanilla-JS popup for on-screen usages)
- Implementation: `packages/item-player/src/core/Player.ts` (catalog index storage, `getCatalogEntry()` public method)
- Host-app component: `packages/default-components/src/catalog/CatalogPopup.svelte` (Svelte popup for host use; not used internally by the player)
