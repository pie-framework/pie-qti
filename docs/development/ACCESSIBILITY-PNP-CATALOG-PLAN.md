# Accessibility, PNP & Catalog — Implementation Plan

> **Status:** draft, open for review.
> **Scope:** QTI-native implementations of PNP profile support (G-09),
> catalog parsing and glossary rendering (G-10), and PCI module lifecycle
> (G-08). These are implemented directly in this project, optimised for QTI
> semantics and the QTI player architecture, without dependency on or
> duplication from `pie-players`.
> **Related gaps:** G-08, G-09, G-10, G-13, G-14, G-15 in
> `docs/SPEC-GAPS-PLAN.md`. This document is the milestone-level plan;
> SPEC-GAPS-PLAN remains the authoritative per-gap brief for individual tasks.

## 0. Design principles

**P1 — QTI-native, not PIE-derived.**
PNP, catalogs, and PCI are implemented against the QTI 3.0 / APIP spec
directly. Data shapes are defined by the spec, not borrowed from
`pie-players`. This avoids coupling the QTI player to the PIE player's
architectural choices (tool registry, coordinator, resolver contracts).

**P2 — Self-contained packages with clean public APIs.**
Each feature lives in a focused module (`pnp/`, `catalog/`, `pci/`) that
exports a typed public API. The item player and assessment player import
these modules; default-components may also consume them. Nothing leaks
internal implementation across package boundaries.

**P3 — Event-driven extension points for host capabilities.**
The player handles what the spec assigns to the player (parse, apply CSS,
render triggers, open popups). Capabilities the spec assigns to the
platform (video rendering, TTS engine, braille routing) are surfaced as
custom DOM events so the host can wire them. The player never assumes
a host capability is present.

**P4 — QTI 2.x items are unaffected.**
All new code paths activate only when a QTI 3.0 item or an explicit
`PlayerConfig` option is present. No regressions to the production-ready
QTI 2.x surface.

## 1. Feature scope

### In scope (this milestone)

| Feature | Spec ref | SPEC-GAPS gap |
|---------|----------|---------------|
| PNP profile parsing and application (color schemes, elimination tool, extended time, glossary trigger) | §6.2 | G-09 |
| Catalog extractor — `<qti-catalog-info>` → `CatalogIndex` | §6.3 | G-10 |
| Glossary popup rendering — `data-catalog-idref` → `CatalogPopup` | §6.3 | G-10 |
| PCI module lifecycle — load, initialize, getResponse, setResponse, disable, enable, destroy | §6.1 | G-08 |
| QTI 3.0 PNP XML parsing from assessment manifest | §6.2 | G-09 |
| Catalog usage types: `glossary-on-screen`, `keyword-translation`, `illustrated-glossary`, `tts-pronunciation`, `signing-definition`, `braille-text`, `audio-description`, `extended-description` | §6.3 | G-10 |

### Deferred (documented in SPEC-GAPS-PLAN Tier 3)

- Structured label / ARIA injection (G-13)
- Sign language video player (G-14) — event emitted; host provides player
- Shared / external catalog files from IMS manifest (G-15)
- Braille hardware routing (G-13) — `getCatalogEntry` exposes data; host routes it

## 2. Architecture

### 2.1 Package layout

All new modules live inside existing packages to avoid dependency graph
changes:

```
packages/item-player/src/
├── pnp/
│   ├── types.ts          — PnpProfile interface (spec §6.2 shape)
│   ├── applyPnp.ts       — pure fn: PnpProfile + rootEl → CSS + classes
│   └── parsePnpXml.ts    — parse <personalNeedsProfile> from QTI XML
│
├── catalog/
│   ├── types.ts          — CatalogIndex, CatalogCard, CatalogEntry types
│   ├── catalogExtractor.ts — parse <qti-catalog-info> → CatalogIndex
│   └── catalogLookup.ts  — getCatalogEntry(index, idref, usage, lang?)
│
└── pci/
    ├── PciHost.ts        — module load + lifecycle wrapper
    └── types.ts          — PciModule interface (initialize/getResponse/etc.)

packages/default-components/src/
└── catalog/
    └── CatalogPopup.svelte — accessible tooltip/dialog for catalog entries
```

### 2.2 Data shapes

**`PnpProfile`** — matches QTI 3.0 §6.2:
```typescript
interface PnpProfile {
  display?: {
    colorScheme?: 'default' | 'blackwhite' | 'whitenav' | 'blackcream' | 'yellowblue' | 'medgray';
    magnification?: number;       // CSS zoom factor; 1.0 = default
  };
  content?: {
    glossaryOnScreen?: boolean;
    keywordTranslation?: { active: boolean; languageCode: string };
    extendedTime?: { active: boolean; multiplier: number };
  };
  cognitive?: {
    eliminationTool?: boolean;
  };
}
```

**`CatalogIndex`** — lightweight map, no external dependencies:
```typescript
type CatalogIndex = Map<string, CatalogCard>;

interface CatalogCard {
  entries: CatalogEntry[];
}

interface CatalogEntry {
  usage:    | 'glossary-on-screen'
            | 'keyword-translation'
            | 'illustrated-glossary'
            | 'tts-pronunciation'
            | 'signing-definition'
            | 'braille-text'
            | 'audio-description'
            | 'extended-description'
            | string;
  lang?:    string;   // xml:lang value (e.g. 'en-US', 'es')
  html:     string;   // inner HTML of <qti-html-content>, or src URL for media
}
```

**`PciModule`** — the contract that a loaded PCI ES module must export:
```typescript
interface PciModule {
  initialize(dom: HTMLElement, config: Record<string, string>, boundTo: PciBoundTo): void;
  getResponse(): unknown;
  setResponse(value: unknown): void;
  disable(): void;
  enable(): void;
  destroy(): void;
}

interface PciBoundTo {
  onReady(): void;
  onResponseChange(value: unknown): void;
}
```

### 2.3 Player integration points

`PlayerConfig` gains three new optional fields:

```typescript
interface PlayerConfig {
  // ... existing fields ...
  pnp?: PnpProfile;
  catalogXml?: string;    // standalone shared catalog (for G-15 later)
  pciBaseUrl?: string;    // base URL for resolving PCI module paths
}
```

`Player` gains two new public methods:

```typescript
player.updatePnp(partial: Partial<PnpProfile>): void;
player.getCatalogEntry(idref: string, usage: string, lang?: string): string | null;
```

## 3. Implementation sequence

Each PR ships green at HEAD and must not break any QTI 2.x eval cases.

---

### PR 1 — PNP types, XML parser, and CSS application

Establishes the PNP module; no visible UI yet.

**`packages/item-player/src/pnp/types.ts`**
- Define `PnpProfile` interface as above.
- Export from `packages/item-player/src/index.ts`.

**`packages/item-player/src/pnp/parsePnpXml.ts`**
- `parsePnpXml(xml: string | Element): PnpProfile`
- Reads `<personalNeedsProfile>` (QTI 3.0) or `<pnp>` (legacy).
- Maps child elements to `PnpProfile` fields.
- Unknown elements are silently ignored (forward-compatible).

**`packages/item-player/src/pnp/applyPnp.ts`**
- `applyPnpToRoot(rootEl: HTMLElement, pnp: PnpProfile): void`
- Sets `data-qti-colorscheme` attribute on `rootEl` to the active scheme
  name. CSS in default-components targets `[data-qti-colorscheme="blackwhite"]`
  etc. (keeps logic out of JS).
- Removes the attribute when scheme is `'default'` or undefined.

**`packages/item-player/src/core/Player.ts`**
- Add `pnp?: PnpProfile` to `PlayerConfig`.
- After item parse, call `applyPnpToRoot(playerRoot, config.pnp)`.
- Expose `player.updatePnp(partial)` — merges and re-applies.

**Tests:**
- `parsePnpXml` parses each color scheme name correctly
- `parsePnpXml` ignores unknown elements
- `applyPnpToRoot` sets the correct attribute; removes it for 'default'
- `player.updatePnp` re-applies without re-parsing the item

---

### PR 2 — PNP: elimination tool and extended time

Visible changes to interaction components and assessment player.

**`packages/default-components/src/plugins/choice-interaction/`**
- When `pnp.cognitive.eliminationTool` is true (passed via component
  props from player), render an "eliminate" toggle button alongside each
  `simpleChoice`.
- Eliminated choices: add `data-eliminated` attribute; CSS dims them.
  Underlying response value is unchanged (eliminated ≠ unselected).
- Button label: `aria-label="Eliminate [choice text]"` / `"Restore [choice text]"`.
- Same treatment for `orderInteraction`.

**`packages/assessment-player/src/core/AssessmentPlayer.ts`**
- When applying `timeLimits.maxTime`, check `pnp.content.extendedTime`.
  If `active: true`, multiply `maxTime` by `multiplier`.
- `unlimitedTime` convention: `multiplier: Infinity` removes the limit.
- Propagate `pnp` from `AssessmentPlayerConfig` down to each item's
  `PlayerConfig`.

**Tests:**
- Elimination toggle buttons appear when `eliminationTool: true`; absent otherwise
- Eliminated choice gets `data-eliminated`; response not changed
- 60-second limit × 1.5 multiplier = 90 seconds
- `multiplier: Infinity` removes the limit entirely
- QTI 2.x items with no PNP config: no elimination buttons, no time change

---

### PR 3 — Catalog extractor

Parses `<qti-catalog-info>` into a `CatalogIndex`; no UI yet.

**`packages/item-player/src/catalog/types.ts`**
- Define `CatalogIndex`, `CatalogCard`, `CatalogEntry` as above.
- Export from package index.

**`packages/item-player/src/catalog/catalogExtractor.ts`**
- `extractCatalog(itemRoot: Element, mapper: ElementNameMapper): CatalogIndex`
- Walks `<qti-catalog-info>` children (or `<catalogInfo>` for QTI 2.x items
  that happen to carry one).
- For each `<qti-card>`: reads `identifier` attribute, collects child
  `<qti-card-entry>` elements.
- For each entry: reads `usage` and `xml:lang` attributes, reads inner
  HTML from `<qti-html-content>` child (or `<qti-file-href>` src for
  media entries).
- Registers the card in the index by its identifier.

**`packages/item-player/src/catalog/catalogLookup.ts`**
- `getCatalogEntry(index, idref, usage, lang?): string | null`
- Finds cards by idref, then filters by usage.
- Language matching: exact match first, then language-prefix match
  (`en` matches `en-US`), then no-lang entry as final fallback.

**`packages/item-player/src/core/Player.ts`**
- After item parse, run `extractCatalog` on the item root.
- Store as `this._catalogIndex`.
- Expose `player.getCatalogEntry(idref, usage, lang?)`.
- If `config.catalogXml` is provided, parse it as a standalone catalog
  and merge (item-level entries take precedence over shared entries for
  the same identifier).

**Tests:**
- `extractCatalog` parses all seven usage types correctly
- `extractCatalog` handles `xml:lang` variants per card
- `getCatalogEntry` returns exact-language match first
- `getCatalogEntry` falls back to language prefix, then no-lang
- `getCatalogEntry` returns null when identifier not found
- `getCatalogEntry` returns null when usage not found for a known identifier
- Shared catalog merged correctly; item-level wins on collision

---

### PR 4 — Glossary trigger and `CatalogPopup`

Visible glossary UI; depends on PR 1 (PNP) and PR 3 (catalog).

**`packages/default-components/src/catalog/CatalogPopup.svelte`**
- Props: `content: string` (HTML), `label: string`, `onClose: () => void`.
- Renders as a floating panel anchored to its trigger.
- Focus-trapped: Tab cycles within, Escape closes.
- `role="dialog"`, `aria-label` from `label` prop.
- Supports `illustrated-glossary` entries: if content is an `<img>` src
  URL (starts with `http` or `/`), renders an `<img>` with alt from label.

**`packages/item-player/src/core/Player.ts`** (item body post-processing)
- After render, when `pnp.content.glossaryOnScreen` is true, find all
  `[data-catalog-idref]` elements in the rendered item body.
- For each: wrap or annotate with an accessible trigger button
  (`aria-label="Show definition: [visible text]"`).
- On trigger activation: look up `getCatalogEntry(idref, 'glossary-on-screen')`
  and mount a `CatalogPopup` adjacent to the trigger.
- When `pnp.content.keywordTranslation.active` is true, same mechanism
  but uses `usage: 'keyword-translation'` with `lang: languageCode`.
- For `tts-pronunciation`, `signing-definition`, `braille-text`: emit
  `qti-catalog-lookup` custom event with `{ idref, usage, content }`.
  Host handles these; player does not render UI for platform-level
  capabilities (see P3 in design principles).

**Tests:**
- With `glossaryOnScreen: true` and a catalog entry, trigger buttons appear
- Popup opens on trigger activation, shows correct HTML
- Popup closes on Escape; focus returns to trigger
- With `glossaryOnScreen: false`, no trigger buttons appear
- `illustrated-glossary` entry renders as `<img>`
- `keyword-translation` with matching language code shows translation
- `tts-pronunciation` fires `qti-catalog-lookup` event, does not open popup

---

### PR 5 — PCI module lifecycle

**`packages/item-player/src/pci/types.ts`**
- Define `PciModule` and `PciBoundTo` interfaces as above.
- Export from package index.

**`packages/item-player/src/pci/PciHost.ts`**
- `class PciHost`
  - Constructor: `(data: ExtractedPci, baseUrl: string)`
  - `async load(): Promise<void>` — dynamic `import(primaryPath)`; on
    failure retries `fallbackPath`; throws `PciLoadError` if both fail.
  - `initialize(dom: HTMLElement): void` — calls `module.initialize`.
  - `getResponse(): unknown`
  - `setResponse(value: unknown): void`
  - `disable() / enable() / destroy()`
- Module path resolution: resolves relative to `baseUrl`; absolute URLs
  used as-is.

**`packages/item-player/src/interactions/portable-custom/extractor.ts`**
(higher priority than `standardCustomExtractor` for QTI 3.0 items)
- Detects `qti-portable-custom-interaction` (via element mapper).
- Extracts: `responseIdentifier`, `customInteractionTypeIdentifier`,
  module paths from `<qti-interaction-modules>`, markup from
  `<qti-interaction-markup>`, config from `<qti-pci-properties>`.
- Returns `ExtractedPci` typed object.

**`packages/item-player/src/core/Player.ts`**
- After rendering the item body, for each extracted PCI: instantiate
  `PciHost`, call `load()`, then `initialize(domNode)`.
- Wire `PciHost.getResponse()` into the player's response collection.
- Wire `PciHost.setResponse()` into the player's state-restore path.
- Wire `disable()` / `enable()` to player mode changes.
- Wire `destroy()` to player teardown.
- `PlayerConfig.pciBaseUrl` defaults to `document.baseURI`.

**Test utilities:**
- Add a minimal in-repo test PCI module in `packages/test-utils/fixtures/pci/`
  that echoes its `setResponse` input back through `getResponse`.

**Tests:**
- `PciHost.load()` calls `initialize()` with correct dom, config, boundTo
- `player.getResponse('RESPONSE')` returns value from `PciHost.getResponse()`
- `player.setResponse('RESPONSE', val)` calls `PciHost.setResponse(val)`
- `disable()` called when player role is not candidate
- `destroy()` called on player unmount
- `fallbackPath` used when `primaryPath` fails to load
- `PciLoadError` thrown when both paths fail

---

## 4. Definition of done

- [ ] `PnpProfile` interface exported from `@pie-qti/item-player`
- [ ] Color scheme applied as `data-qti-colorscheme` attribute on player root
- [ ] `player.updatePnp()` works without re-parsing the item
- [ ] Elimination tool buttons appear in `choiceInteraction` when enabled
- [ ] Extended time multiplier applied in assessment player
- [ ] `CatalogIndex` built from `<qti-catalog-info>` for all 7 usage types
- [ ] `player.getCatalogEntry()` public API with language fallback
- [ ] Glossary trigger buttons appear on `[data-catalog-idref]` terms when PNP active
- [ ] `CatalogPopup` is keyboard accessible (focus-trapped, Escape closes)
- [ ] `qti-catalog-lookup` event fired for platform-level catalog usages
- [ ] `PciHost` loads, initialises, and wires response lifecycle
- [ ] All new code paths are no-ops for QTI 2.x items without PNP/catalog/PCI
- [ ] No regressions to any existing eval cases
