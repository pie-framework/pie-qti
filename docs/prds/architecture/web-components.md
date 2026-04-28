# PRD: Web Component Infrastructure

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/default-components, @pie-qti/player-elements, @pie-qti/web-component-loaders
  Last reviewed: 2026-04-27
-->

**Status:** draft
**Type:** architecture
**Packages:** `@pie-qti/default-components`, `@pie-qti/player-elements`, `@pie-qti/web-component-loaders`
**Last reviewed:** 2026-04-27

---

## Summary

Three packages form the web component layer of the QTI player:

- **`@pie-qti/default-components`** — Svelte 5 components compiled as custom elements (`customElement: true`), one per QTI interaction type. Each component lives in `src/plugins/<type>/`. The package also exports `registerDefaultComponents(registry)` to wire the custom element tag names into the item player's `ComponentRegistry`.
- **`@pie-qti/player-elements`** — Vanilla custom elements (`QtiItemPlayerElement`, `QtiAssessmentPlayerElement`) that mount and manage Svelte player components. These are the public-facing HTML elements that host applications drop into a page.
- **`@pie-qti/web-component-loaders`** — A single idempotent loader function (`loadPieQtiPlayerElements`) that dynamically imports and awaits registration of the player elements. Safe to call from multiple entry points without double-registering.

---

## Background and rationale

### Why web components (framework-agnostic, Shadow DOM encapsulation)

QTI assessments are embedded in many different host environments: React SPAs, Angular apps, plain HTML, and LMS platforms that impose their own CSS. The item player's core logic is framework-agnostic TypeScript; interaction rendering needs to be equally agnostic.

Web components with Shadow DOM satisfy both requirements:
1. A `<pie-qti-choice>` element can be placed in a React, Angular, or plain HTML page without any framework adapter.
2. Shadow DOM prevents the host's CSS (which may include global resets, normalise stylesheets, or LMS-injected rules) from leaking into the interaction UI.

The alternative — shipping a React component library — would exclude non-React hosts and require a separate Vue, Angular, or vanilla adapter. Svelte's `customElement` compilation option produces standard web components while keeping authoring ergonomics high.

### Why Svelte's customElement compilation rather than a runtime wrapper

Svelte 5 components compiled with `<svelte:options customElement="tag-name"/>` produce self-contained custom elements: the Svelte runtime is bundled with the component, the Shadow DOM is created automatically, and reactive props map to attributes where appropriate. This avoids a manual `connectedCallback/disconnectedCallback` boilerplate for each interaction.

The player-level elements (`QtiItemPlayerElement`, `QtiAssessmentPlayerElement`) do not use Svelte's custom element compilation because they require programmatic lifecycle management: they mount and unmount full Svelte component trees imperatively via `mount`/`unmount`, and they bridge attribute changes to Svelte props via `#syncState()`. This distinction is intentional: interaction components are self-contained, player elements are orchestrators.

### Why `parseJsonProp` is needed (HTML attribute vs Svelte prop duality)

Svelte components compiled as custom elements receive complex data in two ways:

1. **JS property assignment** (framework usage): `element.interaction = { responseId: 'R1', choices: [...] }` — the value is a live JavaScript object.
2. **HTML attribute** (template/server-rendered usage): `<pie-qti-choice interaction='{"responseId":"R1",...}'>` — the value is a serialised JSON string.

Svelte does not automatically JSON-parse attribute strings into typed props. Every component prop that can be complex data must call `parseJsonProp<T>(prop)` in a `$derived()` to handle both cases. If a component omits this call, it silently receives a raw string when set via an HTML attribute, producing broken behavior that is difficult to diagnose because it works fine in Svelte-to-Svelte usage.

`parseJsonProp` also handles the string `"null"` (which HTML attributes can't represent as `null`) and non-JSON strings (which are returned as-is, covering string identifiers like `role`).

### Why `qti-change` fires from the root `<div>` rather than the input element

The `qti-change` CustomEvent carries `{ responseId, value }` and must bubble across the Shadow DOM boundary to reach the host (the `composed: true` flag handles this). Dispatching from the input element would work, but:

1. Interaction components may contain multiple input elements (e.g., checkboxes for multiple-choice). Choosing which input fires the event is ambiguous.
2. The `responseId` in `qti-change` is not an attribute of any native input; it is a QTI concept that lives in the interaction data. Firing from a semantically neutral root `<div>` makes clear that this is a component-level event, not a native input event.
3. Consumers that listen for `qti-change` on the custom element's host do not need to filter by input identity.

The pattern in every interaction component is:
```svelte
let rootElement: HTMLDivElement | undefined = $state();
// ...
<div bind:this={rootElement} part="root" ...>
// ...
rootElement.dispatchEvent(createQtiChangeEvent(responseId, value));
```

### Why `ShadowBaseStyles` fallback exists

Shadow DOM prevents DaisyUI/Tailwind CSS loaded in the host document from reaching components. The components use DaisyUI class names (`btn`, `badge`, `alert`, `form-control`, etc.) for layout and interactive affordances.

`ShadowBaseStyles.svelte` provides a minimal re-implementation of these class names inside Shadow DOM using CSS custom properties with safe fallback values. The custom properties (`--color-primary`, `--color-base-content`, etc.) are inherited through Shadow DOM from the host's `:root` or any ancestor, so a host that has DaisyUI installed will automatically theme the components correctly. A host without DaisyUI falls back to readable hardcoded values.

The component is included via `<ShadowBaseStyles />` at the top of each interaction component's markup. This renders nothing visible; it only injects a `<style>` block.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.2 / 3.0
- **Spec section(s):** §4 assessmentItem interaction rendering; QTI 3.0 §7 web component rendering model
- **Known divergences:** QTI 3.0 defines a `qti-change` event contract with specific detail shape; this implementation follows that contract (`{ responseId, value, timestamp }`). The `composed: true` flag is not mentioned in QTI 2.2 but is required for Shadow DOM use.

---

## Functional requirements

- **FR-1:** Each interaction component SHALL register itself as a custom element when its module is imported (side-effectful import of `src/plugins/<type>/<Type>Interaction.svelte`).
- **FR-2:** `registerDefaultComponents(registry)` SHALL register the tag name for every interaction type supported by `@pie-qti/default-components`.
- **FR-3:** Every interaction component SHALL accept its primary data prop either as a JavaScript object or as a JSON-serialised string, producing identical behavior in both cases.
- **FR-4:** Every interaction component SHALL dispatch a `qti-change` CustomEvent with `{ responseId: string, value: unknown, timestamp: number }` from the root element when the candidate's response changes.
- **FR-5:** `qti-change` SHALL have `bubbles: true` and `composed: true` so it crosses the Shadow DOM boundary.
- **FR-6:** `qti-change` SHALL not be dispatched when `role !== 'candidate'` (e.g., scorer or preview mode where the interaction is display-only).
- **FR-7:** Every interaction component SHALL include `<ShadowBaseStyles />` to provide usable styling when the host does not load DaisyUI.
- **FR-8:** Every interaction component SHALL expose a `part="root"` on its outermost element, and `part="option"`, `part="label"`, `part="input"`, `part="text"` (or equivalent semantic part names) for host-side CSS customisation via `::part()`.
- **FR-9:** `QtiItemPlayerElement` SHALL expose JS property setters and getters for `itemXml`, `identifier`, `title`, `role`, `responses`, `security`, and `extendedTextEditor`, in addition to the equivalent kebab-case HTML attributes.
- **FR-10:** `QtiItemPlayerElement` SHALL dispatch a `response-change` event with `{ responseId, value, responses }` when the mounted player reports a response change.
- **FR-11:** `QtiItemPlayerElement` SHALL dispatch a `ready` event (microtask-queued) after `connectedCallback`.
- **FR-12:** `loadPieQtiPlayerElements()` SHALL be idempotent: calling it N times SHALL result in exactly one dynamic import and SHALL resolve only after both `pie-qti-item-player` and `pie-qti-assessment-player` custom elements are defined.
- **FR-13:** Interaction components SHALL use `typesetAction` to trigger host-provided math typesetting after render and on DOM mutations.
- **FR-14:** Interaction components in `disabled` state SHALL render non-interactive (native input elements with `disabled`, no `qti-change` events).

---

## Non-functional requirements

- **Accessibility:** All interaction components must meet WCAG 2.2 Level AA. Keyboard navigation must follow ARIA patterns for the interaction type (radio group for single-choice, checkbox group for multiple-choice, etc.). Focus management must survive Svelte reactivity updates without losing focus. Touch targets must be at minimum 44×44 CSS pixels.
- **Performance:** Components must not block the main thread during render. Math typesetting is deferred to `requestAnimationFrame` via `typesetAction`. Shadow DOM construction is handled by the browser natively. Components should not import large dependencies beyond what Vite tree-shakes.
- **Cross-platform:** Must work on desktop (mouse + keyboard) and mobile (touch). `touchDragHelper` provides mobile-compatible drag support for drag-and-drop interactions.
- **Security:** HTML content from QTI item bodies (prompts, choice text) is rendered via `{@html ...}`. The item player's sanitiser is responsible for cleaning this content before it reaches the component; components do not re-sanitise.
- **i18n:** Component UI strings are sourced from the `I18nProvider` prop. All user-visible labels must go through `i18n.t(key)` with a hardcoded English fallback string.

---

## Design decisions

### Svelte `customElement` for interaction components; manual `HTMLElement` for player elements

**Decision:** Interaction components use `<svelte:options customElement="tag-name"/>`. Player elements extend `HTMLElement` directly.
**Rationale:** Interaction components are self-contained UI units with a simple props-in/events-out contract. Svelte's custom element compilation handles lifecycle correctly for this case. Player elements need to programmatically mount and unmount full Svelte component trees (which are not themselves custom elements) and must translate DOM attribute changes to Svelte reactive props. The `BaseSvelteMountElement` base class provides a reusable `connectedCallback`/`disconnectedCallback` + `mount`/`unmount` pattern.
**Alternatives considered:** Compile everything as Svelte custom elements. Rejected because the player components have complex async state sync that does not map cleanly to attribute-change callbacks.
**Consequences:** Player elements manage their own `<div style="display:contents">` container and are responsible for calling `unmount()` on `disconnectedCallback` to avoid memory leaks.

### Two-step loading: import side-effect + registry registration

**Decision:** Loading default components requires two separate steps:
  1. Import `@pie-qti/default-components/plugins` (side effect: registers custom elements with `customElements`).
  2. Call `registerDefaultComponents(registry)` (associates tag names with interaction types in the player's `ComponentRegistry`).
**Rationale:** The `customElements.define()` call is a browser-global side effect. Separating it from the `ComponentRegistry` call keeps the registry logic testable in Node.js (no browser globals needed) and allows the component bundle to be loaded lazily while the registry is configured eagerly.
**Alternatives considered:** Single-call registration that does both steps; auto-registration on import of the main entry point.
**Consequences:** Callers who forget either step get different failure modes: missing `customElements.define` → browser throws "unknown element" warnings; missing `registerDefaultComponents` → player falls back to its default element selection (which may be nothing, since no components are registered).

### `parseJsonProp` as explicit call, not an automatic Svelte transform

**Decision:** Each component explicitly calls `parseJsonProp<T>` in `$derived()` for every prop that can be complex data.
**Rationale:** Making it explicit makes the dual-mode contract visible at the call site. An automatic transform (e.g., a preprocessor that wraps every prop) would be invisible and harder to debug.
**Alternatives considered:** Svelte preprocessor; custom store; property decorator.
**Consequences:** New interaction components must remember to call `parseJsonProp` for complex props. Omitting it is a silent bug that only manifests when the component is used as an HTML custom element rather than a Svelte component.

### `::part()` API as the only supported host-side CSS hook

**Decision:** Components expose named `part` attributes on structural elements. No CSS custom properties are exposed for layout (only for theming tokens from the host's DaisyUI config).
**Rationale:** Shadow DOM blocks all external selectors except `::part()`. Exposing CSS variables for layout would require every component to document dozens of variables. A small, stable set of `part` names covering the major structural elements provides a clean extension surface.
**Alternatives considered:** `::slotted()` for host-provided content; CSS custom property API per component; open Shadow DOM (no encapsulation).
**Consequences:** Host-side CSS customisation is limited to structural elements that have an explicit `part` attribute. Components must be careful not to rename or remove parts once published.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| New interaction component | Svelte component with `<svelte:options customElement="tag-name"/>` | Create `src/plugins/<type>/` directory with `<Type>Interaction.svelte` and `index.ts`; import in `src/plugins/index.ts`; register in `registerDefaultComponents` | Add `textEntryInteraction` as `pie-qti-text-entry` |
| Override interaction component | `ComponentRegistry.register()` with higher priority | Call `registry.register(type, { tagName, priority: 10, canHandle: () => true })` after `registerDefaultComponents` | Replace `pie-qti-choice` with a custom rendition for a specific deployment |
| Host math typesetting | `(root: HTMLElement) => void \| Promise<void>` | Pass `typeset` prop to any interaction component | `typeset: (el) => KaTeX.renderMathInElement(el)` |
| Host CSS theming | CSS custom properties on `:root` or ancestor | Set `--color-primary`, `--color-base-content`, etc. | DaisyUI theme switching via `data-theme` attribute |
| Host CSS structural customisation | `::part()` | Write `pie-qti-choice::part(label) { ... }` | Custom border radius on choice labels |
| Player element `security` prop | `PlayerSecurityConfig` | Set `security` property or `security-json` attribute on `<pie-qti-item-player>` | Configure HTML sanitisation and URL policy |

---

## Data model / contracts

### `qti-change` event detail

Defined in `@pie-qti/item-player/web-components` as `QTIChangeEventDetail`:

```typescript
interface QTIChangeEventDetail {
  responseId: string;   // QTI response identifier (non-empty, required)
  value: unknown;       // The response value (string, string[], number, etc. — type depends on interaction)
  timestamp: number;    // Date.now() at dispatch time
}
```

The event is constructed by `createQtiChangeEvent(responseId, value)` in `src/shared/utils/eventHelpers.ts`. If `responseId` is empty or undefined, the function throws before constructing the event.

### Interaction component props contract

Every interaction component exposes at minimum:

| Prop | Type | Notes |
|------|------|-------|
| `interaction` | `InteractionData \| string` | Primary QTI interaction data; always goes through `parseJsonProp` |
| `response` | varies by type `\| string` | Current candidate response; bindable |
| `correctResponse` | varies by type `\| string \| null` | Set by scorer role; null = not shown |
| `disabled` | `boolean` | Disables all input |
| `role` | `string` | QTI role: `'candidate'`, `'scorer'`, `'testConstructor'` |
| `i18n` | `I18nProvider` | Translation provider from `@pie-qti/i18n` |
| `typeset` | `(el: HTMLElement) => void` | Host math typesetting callback |
| `outcomeValues` | `Record<string, any>` | Used by `processFeedbackInline` for inline feedback display |

### `BaseSvelteMountElement` lifecycle contract

`QtiItemPlayerElement` and `QtiAssessmentPlayerElement` extend this class.

- `connectedCallback()` → `_mountOrUpdate()` → `mount(this.Component, { target: container, props: getProps() })`
- `attributeChangedCallback()` → updates private fields → `#syncState()` → `_mountOrUpdate()`
- `disconnectedCallback()` → `unmount(instance)` → removes container div

The container `div` uses `display: contents` so it does not affect layout.

`#syncState()` is an async method with a sequence counter to drop superseded rapid attribute changes: if `syncState` is called twice before the first resolves, the first is discarded.

---

## Acceptance criteria

### Functional

```
AC-1: Web component registration on import
  Given: '@pie-qti/default-components/plugins' is imported
  When: customElements.get('pie-qti-choice') is called
  Then: The result is the ChoiceInteraction custom element class (not undefined)

AC-2: qti-change bubbles across Shadow DOM
  Given: A <pie-qti-choice> element is mounted in a page with a valid interaction
         AND a listener is attached to the element itself (not inside the shadow root)
  When: The candidate clicks a radio button
  Then: The listener receives a 'qti-change' event
        AND event.detail.responseId is the interaction's responseId
        AND event.detail.value is the selected choice identifier

AC-3: parseJsonProp — JSON string attribute
  Given: <pie-qti-choice interaction='{"responseId":"R1","choices":[]}'>
  When: The component renders
  Then: It renders without error and treats interaction as the parsed object

AC-4: parseJsonProp — JS object property
  Given: element.interaction is set to a JavaScript object { responseId: 'R1', choices: [] }
  When: The component renders
  Then: Identical behavior to AC-3

AC-5: ShadowBaseStyles provides usable rendering without DaisyUI
  Given: A host page with no Tailwind/DaisyUI CSS loaded
         AND a <pie-qti-choice> element mounted with valid data
  When: The page is rendered
  Then: Buttons are visible with borders, choices have legible text, no unstyled raw HTML

AC-6: Host theming via CSS custom properties
  Given: The host sets --color-primary: oklch(55% 0.24 142) on :root (green primary)
  When: A <pie-qti-choice> renders
  Then: The focused radio button accent color reflects the custom primary color

AC-7: ::part() customisation
  Given: The host CSS contains: pie-qti-choice::part(label) { background: yellow; }
  When: A <pie-qti-choice> renders
  Then: Each choice label has a yellow background

AC-8: Disabled state blocks qti-change
  Given: A <pie-qti-choice> with disabled={true}
  When: The candidate attempts to click a radio button
  Then: The radio input is not focusable/clickable
        AND no qti-change event is dispatched

AC-9: QtiItemPlayerElement attribute → prop bridge
  Given: <pie-qti-item-player role="scorer"> in HTML
  When: The element connects
  Then: The mounted Svelte component receives role="scorer"
        AND if the role attribute changes to "candidate", the component updates within one frame

AC-10: loadPieQtiPlayerElements idempotency
  Given: loadPieQtiPlayerElements() is called three times concurrently from three modules
  When: All three promises resolve
  Then: customElements.get('pie-qti-item-player') is defined exactly once
        AND the dynamic import for '@pie-qti/player-elements/register' is executed exactly once

AC-11: response-change event from player element
  Given: A <pie-qti-item-player> with a valid QTI item XML
  When: The embedded interaction fires a qti-change event
  Then: The player element dispatches a response-change CustomEvent at the element boundary
        AND event.detail.responses contains all current responses keyed by responseId
```

### Accessibility

```
AC-A1: Keyboard navigation — choiceInteraction (single)
  Given: A pie-qti-choice with maxChoices=1 and three options
  When: Tab focuses the first radio input AND arrow keys are pressed
  Then: Focus moves between radio inputs in group
        AND the focused radio is selected (arrow-key-selects radio semantics)

AC-A2: Focus ring visible on focus-visible
  Given: A <pie-qti-choice> without host focus-ring overrides
  When: A choice label receives keyboard focus (focus-visible)
  Then: An outline is visible with at least 2px width at 3:1 contrast ratio

AC-A3: ARIA role and labelling
  Given: A pie-qti-choice with a prompt text
  When: Inspecting the accessibility tree
  Then: Each radio/checkbox has an accessible name from its label text
        AND the group has a role="group" or role="radiogroup" with an accessible name
```

### Edge cases

```
AC-E1: interaction prop is null or undefined
  Given: <pie-qti-choice> with no interaction prop set
  When: The component renders
  Then: An error message is shown inside the component (not an uncaught exception)
        AND no qti-change event is dispatched

AC-E2: typesetAction with no typeset function
  Given: A <pie-qti-choice> without a typeset prop
  When: The component renders
  Then: No error is thrown; raw math notation remains in place (no crash)

AC-E3: QtiItemPlayerElement disconnectedCallback cleans up
  Given: A <pie-qti-item-player> that was connected and mounted a Svelte component
  When: The element is removed from the DOM
  Then: The Svelte component is unmounted (unmount() called)
        AND no residual event listeners remain from the mounted component
```

---

## Open questions

- [ ] `textEntryInteraction` and `inlineChoiceInteraction` are currently handled as inline renderers inside `ItemRenderer` rather than as separate custom elements. Should they be promoted to standalone web components for consistency? What are the implications for inline-within-content rendering?
- [ ] The `ShadowBaseStyles` component duplicates a subset of DaisyUI class definitions. When DaisyUI 5 changes its class names (it is moving to `btn-primary` → `btn btn-primary` semantics in some versions), these need to be kept in sync. Is there a test or CI check that catches this drift?
- [ ] `QtiAssessmentPlayerElement` attributes and events are not documented here (the source was not fully read). This PRD should be extended with that element's contract once reviewed.

---

## Related

- QTI spec: QTI 3.0 rendering model; ARIA authoring practices (radiogroup, checkbox group)
- Implementation: `packages/default-components/src/`, `packages/player-elements/src/`, `packages/web-component-loaders/src/`
- Adjacent PRDs: `architecture/item-player.md`, `systems/theming.md`, `systems/accessibility.md`
- Existing docs: `packages/default-components/STYLING.md`, `docs/ARCHITECTURE.md` (Theming & styling section)
