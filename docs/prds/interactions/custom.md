# PRD: customInteraction / Portable Custom Interaction (PCI)

<!--
  Status: current
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type (interactions only): customInteraction / qti-portable-custom-interaction
  Last reviewed: 2026-07-13
-->

**Status:** current
**Type:** interaction
**Packages:** `@pie-qti/default-components`, `@pie-qti/item-player`
**Last reviewed:** 2026-07-13

---

## Summary

`customInteraction` is the QTI 2.x escape hatch for non-standard interaction types whose rendering and response logic fall outside the QTI specification. In QTI 3.0 this role is taken over by the Portable Custom Interaction (PCI) specification, which standardises the module interface and state-management contract so that custom interactions can move between conformant players without platform-specific integration.

PIE-QTI supports both forms:

- **Opaque QTI 2.x `customInteraction`** — rendered by `CustomInteractionFallback.svelte` with a warning banner and manual textarea for best-effort response collection. The raw XML and all attributes are preserved for debugging.
- **QTI 2.x PCI** — a `customInteraction` wrapping a namespaced `pci:portableCustomInteraction` is detected and routed to the portable renderer. The first external script in `pci:instance` is exposed to the host resolver, while the script-free instance markup is used as the DOM scaffold.
- **QTI 3.0 `qti-portable-custom-interaction`** — handled by `portableCustomExtractor` and rendered by `pie-qti-portable-custom`. `PciHost` asks an explicit host-supplied resolver for the primary or fallback module and manages the full `initialize` / `getResponse` / `setResponse` / `disable` / `enable` / `destroy` lifecycle. The player never imports an authored URL on its own.

---

## Background and rationale

### The fundamental tension: proprietary vs. portable

In QTI 2.x, `customInteraction` was intentionally opaque. The spec defined the element, required a `responseIdentifier`, and left everything else — markup structure, JavaScript behaviour, response format — to the delivery platform. Two platforms serving the same item with a `customInteraction` would each render it their own way, or not at all. This was the accepted trade-off: authors gained capability (arbitrary interaction types) at the cost of interoperability.

QTI 3.0 resolved this with PCI. A `qti-portable-custom-interaction` element carries its module code (`primary-path`/`fallback-path` ES module URLs), its initial DOM scaffold (`qti-interaction-markup`), and its static configuration (`qti-pci-properties`) inside the item package. Any conformant QTI 3.0 player that implements the `IMSGLOBAL.PCI` module interface can run it. The standard removes the platform-coupling that made 2.x custom interactions a portability dead end.

### Why the QTI 2.x fallback is a warning, not an error

A delivery framework that aborts item rendering when it encounters an unexecutable interaction type gives candidates no recourse. The fallback design makes two pragmatic choices:

1. **Show the item, acknowledge the gap.** A warning banner tells the candidate (and the item author in development) that this specific interaction is not executed. The rest of the item — prompt text, other interactions, response processing — still functions.
2. **Collect a manual string as a best-effort response.** A textarea allows the candidate to type an answer. This response is persisted through the normal `qti-change` / response-variable pathway. Scoring will almost certainly produce zero (custom interactions seldom have response processing templates that match a raw string), but the response is stored and can be reviewed by a human scorer or passed to an `externalScored` workflow.

The alternative — rendering an error state or skipping the element — would break item presentation for items that include a `customInteraction` alongside standard interactions, and would lose any candidate input permanently.

### When authors should use `customInteraction` vs. standard interactions

`customInteraction` is appropriate only when no standard QTI interaction type can express the required pedagogy. Examples include:

- Specialised science tools (chemistry editors, graphing calculators, circuit simulators)
- Drag-and-arrange UIs with domain rules that go beyond `orderInteraction` or `matchInteraction`
- Interactive multimedia responses (video annotation, audio recording)

Authors using an opaque QTI 2.x `customInteraction` must accept the fallback warning UI since there is no module interface to dispatch to. QTI 2.x PCI wrappers and QTI 3.0 PCI elements can execute when the embedding host supplies an explicit trusted module resolver.

### Why two extractors rather than one

`standardCustomExtractor` (priority 10) handles only the opaque QTI 2.x case: it captures raw XML, attributes, and prompt but does nothing with the content. `portableCustomExtractor` (priority 20) handles both a direct QTI 3.0 `qti-portable-custom-interaction` and a QTI 2.x `customInteraction` containing a namespaced PCI payload. Extractor dispatch respects `canHandle()`, so the wrapper is routed to PCI while an ordinary custom interaction keeps the generic fallback.

---

## QTI specification alignment

- **Spec versions:** QTI 2.1 / 2.2 (§3.4.6); QTI 3.0 (§6.1)
- **QTI 2.x spec section:** §3.4.6 — `customInteraction`
- **QTI 3.0 spec section:** §6.1 — Portable Custom Interactions (PCI)

### QTI 2.x `customInteraction`

| Attribute | Support | Notes |
| --------- | ------- | ----- |
| `responseIdentifier` | Supported | Mapped to `responseId` in `CustomInteractionData`; drives the `qti-change` event and response-variable binding |
| `class` | Preserved (raw) | Stored in `rawAttributes`; in QTI 2.x, `class` is the primary mechanism for platform identification (e.g. `myPlatform.chemEditor`). Not acted upon — no plugin dispatch based on class value. |
| Arbitrary vendor attributes | Preserved (raw) | All attributes are extracted as `rawAttributes: Record<string, string>` |
| Child element content | Serialised | The full element `outerHTML` is stored as `xml: string`; no child parsing beyond `<prompt>` |
| `<prompt>` child | Supported | Extracted as `prompt: string \| null` and rendered in the fallback warning block |

### QTI 3.0 `qti-portable-custom-interaction`

Extracted by `portableCustomExtractor` (priority 20) into `ExtractedPci`. `PciHost` manages the module lifecycle.

| Attribute / child | Support | Notes |
| ----------------- | ------- | ----- |
| `response-identifier` | Supported | Read by both camelCase and hyphenated forms; stored as `responseIdentifier` in `ExtractedPci` |
| `custom-interaction-type-identifier` | Supported | Stored as `customInteractionTypeIdentifier` in `ExtractedPci`; logged but not used for dispatch |
| `<qti-interaction-modules>` / `<qti-interaction-module>` | Supported | `primaryPath` and `fallbackPath` extracted and passed to `PciHost` |
| `<qti-interaction-markup>` | Supported | Inner HTML extracted as `markup`; passed to `PciHost.initialize()` as the DOM scaffold |
| `<qti-pci-properties>` / `<qti-pci-property>` | Supported | Key/value pairs parsed into `config: Record<string, string>`; passed to `module.initialize()` |

### QTI 2.x Portable Custom Interaction wrapper

| Attribute / child | Support | Notes |
| ----------------- | ------- | ----- |
| Outer `customInteraction@responseIdentifier` | Supported | Retained as the response-variable binding |
| Inner `pci:portableCustomInteraction@customInteractionIdentifierType` | Supported | Stored as `customInteractionTypeIdentifier` |
| `<pci:instance>` | Supported | Script elements are removed from the mounted scaffold before it reaches `innerHTML` |
| First external `<script src>` in `<pci:instance>` | Supported | Passed as an authored path to the host resolver; inline scripts are never executed |

### PCI module lifecycle

`PciHost` (`packages/item-player/src/pci/PciHost.ts`) manages the full QTI 3.0 PCI contract:

1. `load()` — passes the resolved primary path and authored-path context to the host's `moduleResolver`, falling back to `fallback-path` when present. Throws `PciModuleResolverRequiredError` when execution has not been explicitly enabled and `PciLoadError` if resolution or interface validation fails.
2. `initialize(dom)` — calls `module.initialize(dom, config, boundTo)` once the DOM scaffold is mounted. `boundTo.onResponseChange` fires whenever the module reports a new response value.
3. `getResponse()` — delegates to `module.getResponse()`.
4. `setResponse(value)` — delegates to `module.setResponse(value)` (session restore).
5. `disable()` / `enable()` — called on role/state transitions.
6. `destroy()` — called on player teardown; releases the module reference.

The portable renderer mounts the sanitized scaffold, asks the owning `Player` to create a `PciHost`, calls `load()`/`initialize()`, and wires responses into the normal item-player lifecycle. The same `PlayerConfig.pci` object is available as a JS-only `.pci` property on the item and assessment custom elements and is propagated through assessment and section rendering.

### Known gaps

No known disconnected delivery path remains for G-08. PCI execution is deliberately disabled until a host supplies a resolver; that resolver is responsible for package-manifest validation, URL/origin policy, and returning a compatible module. PCI code runs in the page realm, so deployments requiring stronger isolation must host the player in an appropriately sandboxed, cross-origin frame.

---

## Functional requirements

- **FR-1:** When a QTI item contains a `customInteraction` element, the extractor must capture the element's `responseIdentifier`, all attributes as a flat key/value map, the `<prompt>` child content (if present) as HTML, and the complete `outerHTML` of the element as a raw XML string.
- **FR-2:** The fallback component must render a visible warning that identifies an opaque, unsupported `customInteraction`. A QTI 2.x wrapper containing a portable payload must not be routed to this fallback.
- **FR-3:** The fallback component must render the `<prompt>` content (if present) adjacent to the warning so the candidate can read the question context.
- **FR-4:** When an `onChange` callback is provided, the fallback component must render a textarea that allows manual text entry.
- **FR-5:** Text entered in the fallback textarea must propagate through `onChange` and the `qti-change` custom event with the correct `responseId`.
- **FR-6:** An empty or cleared textarea must result in a `null` response value, not an empty string. A `null` value is the correct "unanswered" sentinel in the QTI variable system.
- **FR-7:** The fallback component must render a collapsible "details" panel containing the raw `rawAttributes` JSON and the raw `xml` string. This provides item-author visibility during development without polluting the default candidate view.
- **FR-8:** When `disabled` is `true`, the fallback textarea must be non-interactive (HTML `disabled` attribute set). The warning banner and details panel remain visible.
- **FR-9:** The component must dispatch a `qti-change` CustomEvent on the host element (not on the inner `<div>`) so the event propagates up the shadow-DOM boundary to the item player.
- **FR-10:** The extractor's `validate()` must return a warning (not an error) when the extracted `xml` is empty. Extraction must not fail — an empty custom interaction is unusual but not necessarily malformed at the item level.
- **FR-11:** For QTI 2.x or 3.0 PCI content, the player must instantiate a `PciHost`, call the host-provided resolver from `load()`, call `initialize(dom)` once the sanitized DOM scaffold is mounted, and wire `onResponseChange` to the player's response variable map. No authored module may execute without that explicit resolver.
- **FR-12:** When module resolution or interface validation fails, the portable renderer must catch the error and expose an accessible `role="alert"` error without throwing out the rest of the item. The ordinary `customInteraction` fallback remains available only for non-PCI content.

---

## Non-functional requirements

### Accessibility

The fallback UI carries the full WCAG 2.2 AA responsibility because there is no PCI module to own it. The container must:

- Present the warning banner with sufficient colour contrast (minimum 4.5:1 for normal text, 3:1 for large text) against all supported DaisyUI themes.
- Associate the textarea with its `<label>` using `for`/`id` linkage (not aria-label alone) so screen readers announce the field purpose.
- Provide a keyboard-accessible "Show/Hide details" toggle button (not a `<div>` with a click handler).
- Ensure the manual-response textarea has a minimum touch target of 44×44 CSS pixels on mobile.

When a PCI module is loaded, the module is responsible for its own internal accessibility. The container must:

- Provide a wrapping landmark or labelled region so screen-reader users can navigate to the interaction.
- Manage focus: when the module replaces the fallback UI, focus must not be stranded on a now-removed element.
- Call `module.disable()` when the item enters review/scorer role so the module can set its own `aria-disabled` / `readonly` state internally.

### Performance

- The fallback component must add no external asset loads. All styling is via CSS custom properties and scoped `<style>` blocks.
- PCI module loading must not block the rendering of other interactions in the item. `PciHost.load()` is async; the PCI container must show a loading skeleton until `initialize()` resolves.
- PCI modules are third-party code and may be arbitrarily large. The item player delegates module acquisition to the host resolver rather than embedding or fetching authored code itself.

### Cross-platform

- The fallback textarea must be usable on touch devices (adequate tap target, native keyboard invocation).
- The "Show/Hide details" toggle must work with both click and keyboard (Enter/Space) activation.
- PCI modules may render canvas, SVG, or WebGL content; the container must not impose `overflow: hidden` or fixed dimensions that would clip the module's viewport.

### Security

`customInteraction` and PCI are the primary security boundary in the QTI item model. Key constraints:

- **Current (fallback):** The `xml` string is displayed in a `<pre>` block, not injected as HTML. No XSS risk in the fallback path.
- **PCI module loading:** PCI modules are third-party JavaScript and execute with the authority of the realm that returns them. The player never performs an ambient `import()` of an authored path. The embedding host must:
  - supply `PlayerConfig.pci.moduleResolver` as an explicit opt-in;
  - validate the authored path against the content package manifest and enforce its URL/origin policy before returning a module;
  - understand that returning a module is equivalent to script inclusion; delivery platforms requiring stronger isolation must wrap the player in a sandboxed, preferably cross-origin `<iframe>`.
- **`rawAttributes` display:** JSON-serialised attributes are rendered as text content, not innerHTML; no sanitisation is required for the fallback display path.

### i18n

The fallback UI surfaces three localised strings via the `@pie-qti/i18n` provider:

| Key | Default (English) |
| --- | ----------------- |
| `interactions.custom.unsupported` | `'Unsupported customInteraction'` |
| `interactions.custom.manualResponse` | `'Manual response (optional)'` |
| `interactions.custom.placeholder` | `'Enter a manual response (fallback)'` |
| `interactions.custom.attributes` | `'Attributes'` |

The `i18n` prop is optional; all strings have English defaults. RTL layout is handled by the global `dir` attribute on the document root — the fallback component uses `display: grid` without explicit direction, which respects inherited `dir`.

---

## Design decisions

### Using raw XML serialisation instead of structured extraction

**Decision:** The extractor captures `element.outerHTML` as an opaque string rather than recursively parsing the custom element's children into a typed structure.

**Rationale:** The child content of an opaque `customInteraction` is intentionally undefined by the spec. Any attempt to parse it into a typed model would either be too restrictive (failing on vendor-specific markup) or too permissive (a pass-through that adds no value over the raw string). A separate portable extractor handles the defined QTI 2.x PCI and QTI 3.0 PCI structures.

**Alternatives considered:** Recursive HTML parsing into a generic tree; JSON serialisation of the DOM node. Both were rejected as adding complexity with no benefit given the opaque semantics.

**Consequences:** The `xml` field on `CustomInteractionData` is a best-effort debug string, not a contract. Consumers must not parse it programmatically. `PortableCustomInteractionData` is the structured model used for both supported PCI syntaxes.

### Fallback display rather than error state

**Decision:** Encountering an unexecuted `customInteraction` renders a warning UI, not an error boundary. The item continues to render; other interactions on the same item remain interactive.

**Rationale:** In a K-12 delivery context, an item that partially fails should still allow the candidate to attempt the parts that work. Item authors often include `customInteraction` elements in items alongside standard interactions. Throwing an error would break the entire item for an interaction the candidate may not even notice is non-functional.

**Alternatives considered:** Error boundary with stack trace (rejected — too technical for candidates); silent omission (rejected — hides the problem from authors); placeholder text without manual input (rejected — loses the candidate's attempted response).

**Consequences:** Scores for items with custom interactions will be 0 or whatever the `externalScored` pathway returns. Assessment delivery systems using PIE-QTI must be designed to handle zero-scored items with stored string responses.

### Manual textarea for response collection

**Decision:** The fallback provides a textarea for manual string input, wired to the standard `qti-change` / response-variable pathway.

**Rationale:** The response variable for a `customInteraction` must be settable so that: (a) completion status can transition from `not_attempted` to `incomplete`/`completed`; (b) human scorers or external scoring services can receive something to evaluate; (c) the candidate has recourse when the widget is non-functional.

**Alternatives considered:** Read-only fallback with no input (rejected — response variable always null, preventing completion); pre-populated placeholder value (rejected — fabricated responses corrupt scoring data).

**Consequences:** Any manual response may fail standard response processing when it does not match the declared response type. Opaque custom interactions that require specialized behavior still need platform-specific support or external scoring.

### Attributes stored as a flat `Record<string, string>`

**Decision:** All XML attributes — including QTI-standard and vendor-specific ones — are stored as a flat `Record<string, string>`.

**Rationale:** The QTI spec does not enumerate the allowed attributes on `customInteraction` beyond `responseIdentifier` and `class`. Storing everything flat preserves vendor data for debugging and future use without requiring schema changes when new attributes appear.

**Consequences:** The `rawAttributes` map may contain `responseIdentifier` (which is also stored separately as `responseId`). Consumers should use `responseId` (the typed, normalised field) for response-variable binding, not `rawAttributes.responseidentifier`.

---

## Extension points

| Extension point | Interface | How to use | Notes |
| --------------- | --------- | ---------- | ----- |
| PCI module interface | `PciModule` in `packages/item-player/src/pci/types.ts` | Export a default object (or named `getInstance` export) with `initialize`, `getResponse`, `setResponse`, `disable`, `enable`, `destroy` | Every PCI module must implement this interface; `PciHost` calls it at defined lifecycle points |
| `PlayerConfig.pci` / custom-element `.pci` | `PciConfiguration` | Supply `{ baseUrl?, moduleResolver }` as a JavaScript property on `pie-qti-item-player` or `pie-qti-assessment-player` | Secure default is disabled; there is no ambient import or `document.baseURI` default |
| Custom extractor (higher priority) | `ElementExtractor<ExtractedPci>` | Register an extractor with `priority > 20` for `qti-portable-custom-interaction` element type | `portableCustomExtractor` itself follows this pattern; plugin system docs in `docs/prds/architecture/item-player-plugin-system.md` |

### `PciHost` contract

```typescript
// packages/item-player/src/pci/PciHost.ts

export class PciHost {
  constructor(data: ExtractedPci, options?: PciHostOptions);
  /** Resolve the primary/fallback module through the host hook. */
  load(): Promise<void>;
  /** Wire a callback to fire when the module reports a response change. */
  onResponseChange(callback: (responseId: string, value: unknown) => void): () => void;
  /** Mount the PCI inside the given DOM element. Must be called after load() resolves. */
  initialize(dom: HTMLElement): void;
  getResponse(): unknown;
  setResponse(value: unknown): void;
  disable(): void;
  enable(): void;
  destroy(): void;
}
```

### `PciModule` interface (what every PCI module must export)

```typescript
// packages/item-player/src/pci/types.ts

export interface PciBoundTo {
  onReady(): void;
  onResponseChange(value: unknown): void;
}

export interface PciModule {
  initialize(dom: HTMLElement, config: Record<string, string>, boundTo: PciBoundTo): void;
  getResponse(): unknown;
  setResponse(value: unknown): void;
  disable(): void;
  enable(): void;
  destroy(): void;
}
```

---

## Data model / contracts

### `CustomInteractionData`

Defined in `packages/item-player/src/interactions/shared/types.ts`:

```typescript
export interface CustomInteractionData extends BaseInteractionData {
  type: 'customInteraction';
  prompt: string | null;           // HTML content of <prompt> child, if present
  rawAttributes: Record<string, string>; // All XML attributes verbatim
  xml: string;                     // outerHTML of the element (debug/fallback only)
}
```

Invariants:

- `responseId` (from `BaseInteractionData`) is always set — the extractor is called only for elements with a `responseIdentifier` attribute.
- `xml` is best-effort: it uses `element.outerHTML || element.toString()` from `node-html-parser`; the result may differ from the original XML whitespace/quoting but is semantically equivalent.
- `rawAttributes` may contain `responseidentifier` (lowercase, as parsed by node-html-parser). Do not use this for response binding; use `responseId`.
- `prompt` is the innerHTML of the `<prompt>` child, not its text content — it may contain inline HTML (spans, math, images).

### Response variable

The response variable type for `customInteraction` is **not fixed by the spec**. The `responseDeclaration` in the item XML specifies the `baseType` and `cardinality`. Common patterns:

| Use case | baseType | cardinality |
| -------- | -------- | ----------- |
| Free-text response | `string` | `single` |
| Structured JSON blob | `string` | `single` |
| External scored (PCI) | `string` | `single` |
| Numeric result | `float` or `integer` | `single` |

The fallback manual textarea always produces a `string | null` value regardless of the declared baseType. This can fail type-checked response processing; opaque custom interactions commonly need an external-scoring workflow.

### `qti-change` event

The component dispatches `qti-change` on the root `<div>` element (not the shadow host) with `{ bubbles: true, composed: true }`. The event detail is `{ responseId: string, value: string | null }`. See `packages/default-components/src/shared/utils/eventHelpers.ts`.

---

## Acceptance criteria

### Functional — current fallback behaviour

**AC-1: Warning banner renders**
```
Given: An item containing a <customInteraction responseIdentifier="CUST"> element is loaded
When: The item body is rendered
Then: A visible warning element with part="warning" is present in the DOM
  AND it contains the text "Unsupported customInteraction" (or the i18n equivalent)
  AND no JavaScript error is thrown
```

**AC-2: Prompt renders**
```
Given: The customInteraction element contains a <prompt>What is the molecular formula for water?</prompt>
When: The fallback UI renders
Then: The prompt text "What is the molecular formula for water?" is visible within the fallback component
  AND the prompt appears adjacent to or below the warning banner
```

**AC-3: Manual textarea accepts input**
```
Given: The fallback UI is rendered with an onChange callback available
When: The candidate types "H2O" into the fallback textarea
Then: The textarea contains "H2O"
  AND the onChange callback is called with value "H2O"
  AND a qti-change event is dispatched with responseId matching the interaction's responseIdentifier
```

**AC-4: Empty textarea produces null response**
```
Given: The candidate has previously typed "H2O" in the fallback textarea
When: The candidate clears the textarea to empty
Then: The onChange callback is called with value null (not empty string "")
  AND the qti-change event detail.value is null
```

**AC-5: Response persistence on reload**
```
Given: The player restores a previously saved session with RESPONSE = "H2O"
When: The fallback component receives response="H2O" via its prop
Then: The textarea pre-populates with "H2O"
```

**AC-6: Details panel toggle**
```
Given: The fallback UI is rendered
When: The candidate clicks "Show details"
Then: A panel with part="details" becomes visible
  AND it contains a <pre> block with the JSON-serialised rawAttributes
  AND it contains a <pre> block with the raw xml string
When: The candidate clicks "Hide details"
Then: The details panel is no longer visible
```

**AC-7: Attributes preserved in details**
```
Given: The customInteraction element has attributes class="myVendor.editor" data-config="v2"
When: The details panel is opened
Then: The rawAttributes JSON contains "class": "myVendor.editor" and "data-config": "v2"
```

**AC-8: Disabled state disables textarea**
```
Given: The fallback UI is rendered with disabled=true
When: The candidate attempts to interact with the textarea
Then: The textarea has the HTML disabled attribute
  AND keypress events on the textarea produce no change to its value
  AND the warning banner and details toggle remain visible and operable
```

**AC-9: No-data error state**
```
Given: The CustomInteraction.svelte component receives no interaction prop (undefined)
When: The component renders
Then: An error alert is displayed with the text from i18n key 'common.errorNoData'
  AND no JavaScript error is thrown
  AND no textarea is rendered
```

**AC-10: qti-change event bubbles to item player**
```
Given: The pie-qti-custom web component is mounted inside an item player
When: The candidate types in the fallback textarea
Then: A qti-change CustomEvent with bubbles:true and composed:true is dispatched from the root element
  AND the item player's response variable for the responseIdentifier is updated
```

**AC-11: Extractor produces correct structure**
```
Given: A customInteraction element with responseIdentifier="CUST", class="vendorX", and a <prompt>
When: standardCustomExtractor.extract() is called on the element
Then: The result contains xml (non-empty outerHTML string)
  AND rawAttributes contains "class": "vendorX"
  AND prompt contains the prompt HTML
  AND the result type is 'customInteraction'
  AND responseId is "CUST"
```

**AC-12: Extractor warns on empty xml**
```
Given: A customInteraction element with no inner content
When: standardCustomExtractor.validate() is called on the result
Then: valid is true (not false)
  AND warnings contains a string mentioning "no XML content"
```

**AC-13: QTI 2.x and 3.0 PCI content routes to PciHost**
```
Given: An item containing a <qti-portable-custom-interaction> element with a valid primary-path module URL
When: The item is loaded and rendered
Then: portableCustomExtractor produces an ExtractedPci (not a CustomInteractionData)
  AND PciHost.load() calls the configured host resolver
  AND PciHost.initialize() is called with the interaction's DOM container
  AND the fallback warning UI is NOT shown
```

### Accessibility

**AC-A1: Textarea has accessible label**
```
Given: The fallback UI renders the manual-response textarea
When: A screen reader announces focus on the textarea
Then: The textarea is associated with a <label> element via matching for/id attributes
  AND the label text includes "Manual response" (or i18n equivalent)
```

**AC-A2: Warning banner colour contrast**
```
Given: The fallback UI is rendered in the default DaisyUI theme (light)
When: The warning banner text contrast ratio is measured against the background
Then: Text contrast meets WCAG 2.2 AA minimum (4.5:1 for body text, 3:1 for large/bold text)
```

**AC-A3: Details toggle is keyboard operable**
```
Given: Focus is on the "Show details" button
When: The user presses Enter or Space
Then: The details panel toggles open/closed
  AND focus remains on the button (not lost to document body)
```

**AC-A4: Warning banner is announced by screen reader**
```
Given: The fallback UI renders
When: A screen reader navigates to the warning element
Then: The element's role or landmark communicates that this is a status/warning (role="alert" or equivalent)
  AND the unsupported-interaction message is announced
```

**AC-A5: Disabled textarea announces state**
```
Given: The fallback UI renders with disabled=true
When: A screen reader navigates to the textarea
Then: The disabled state is announced (aria-disabled or HTML disabled attribute present)
```

### Edge cases

**AC-E1: customInteraction with no attributes**
```
Given: A <customInteraction responseIdentifier="R1"> element with no other attributes
When: standardCustomExtractor.extract() runs
Then: rawAttributes contains only responseidentifier (or equivalent normalised key)
  AND xml is the serialised element outerHTML
  AND no error is thrown
```

**AC-E2: Nested prompt with inline HTML**
```
Given: A <prompt> containing <em>important</em> markup
When: The fallback component renders
Then: The prompt is rendered as HTML (not escaped text)
  AND the <em> formatting is applied
```

**AC-E3: Very long xml string in details**
```
Given: A customInteraction with a large nested XML body (> 10 KB)
When: The details panel is opened
Then: The <pre> block renders without causing horizontal overflow of the page layout
  AND overflow-x scroll is available within the pre block
```

**AC-E4: Multiple customInteractions in one item**
```
Given: An item containing two <customInteraction> elements with identifiers CUST1 and CUST2
When: The item renders
Then: Two separate fallback UI instances are rendered
  AND each instance shows its own responseId in the textarea's for/id pairing
  AND a change to CUST1's textarea does not affect CUST2's response variable
```

**AC-E5: Response prop is a JSON string (web component usage)**
```
Given: The pie-qti-custom web component receives response as the JSON-stringified value '"H2O"'
When: The component initialises
Then: parseJsonProp deserialises the string
  AND the textarea is populated with H2O (not the JSON-wrapped form '"H2O"')
```

### PCI acceptance criteria

These criteria cover the QTI 3.0 `qti-portable-custom-interaction` and the QTI 2.x portable wrapper paths through `PciHost`.

AC-G1: Module loading
```
Given: An item with portable custom interaction content carrying a valid authored module path
When: The item is loaded by the player
Then: The configured resolver is called with the resolved URL and authored-path context
  AND initialize(domScaffold, config, boundTo) is called once DOM is ready
  AND the fallback warning UI is NOT shown
```

AC-G2: Module fallback on load error
```
Given: The primary-path URL returns a 404 or network error, and a fallback-path is defined
When: The player attempts to load the module
Then: The fallback-path module is loaded instead
  AND initialize is called on the fallback module
  AND no error UI is shown if the fallback load succeeds
```

AC-G3: Module failure is contained
```
Given: Both primary-path and fallback-path fail to load
When: The player handles the error
Then: The portable renderer exposes an accessible error message
  AND no uncaught exception is thrown
```

AC-G4: getResponse called on submit
```
Given: A PCI module is loaded and the candidate has interacted with it
When: The player collects responses (e.g. on submit)
Then: module.getResponse() is called
  AND the returned value is stored in the response variable for the responseIdentifier
```

AC-G5: setResponse called on restore
```
Given: A session is restored with a previously stored PCI response value
When: The player mounts the PCI interaction
Then: module.setResponse(storedValue) is called after initialize
  AND the module reflects the restored state in its UI
```

AC-G6: disable/enable on role change
```
Given: A PCI module is mounted and the player transitions to a non-candidate role (e.g. review)
When: The role change is signalled
Then: module.disable() is called
  AND the module's UI enters a read-only state
When: The player transitions back to candidate role
Then: module.enable() is called
```

AC-G7: destroy on unmount
```
Given: A PCI module is mounted and the item is removed from the DOM
When: The player tears down the item
Then: module.destroy() is called (if the method is present)
  AND no memory leaks or dangling event listeners remain
```

---

## Open questions

- [ ] Should `CustomInteractionData.xml` be renamed `rawXml` to make the "debug/best-effort" semantics clearer now that `ExtractedPci` is the structured type for QTI 3.0? Renaming avoids confusion between the two types.
- [ ] Should the fallback warning be suppressible via a `suppressFallback` prop for delivery contexts where showing an unsupported-interaction warning would be confusing to candidates? (e.g. an embedded preview that only wants to test other interactions in the item.)
- [ ] Should a future resolver adapter provide per-PCI iframe isolation? The current contract deliberately leaves acquisition to the host but executes the returned module in the player realm. Whole-player cross-origin framing remains the supported stronger-isolation boundary.

---

## Related

- QTI spec: `docs/QTI_techguide.md` §3.4.6 (customInteraction), §6.1 (PCI)
- Spec gap: `docs/SPEC-GAPS-PLAN.md` §G-08 — PCI module lifecycle
- Response tracking: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Implementation — PCI host: `packages/item-player/src/pci/PciHost.ts`
- Implementation — PCI types: `packages/item-player/src/pci/types.ts`
- Implementation — PCI extractor: `packages/item-player/src/interactions/portable-custom/extractor.ts`
- Implementation — PCI renderer: `packages/default-components/src/plugins/portable-custom/PortableCustomInteraction.svelte`
- Implementation — component: `packages/default-components/src/plugins/custom/CustomInteraction.svelte`
- Implementation — fallback: `packages/default-components/src/shared/components/CustomInteractionFallback.svelte`
- Implementation — QTI 2.x extractor: `packages/item-player/src/interactions/custom/extractor.ts`
- Implementation — types: `packages/item-player/src/interactions/shared/types.ts` (`CustomInteractionData`)
- Evals: `docs/evals/default-components/custom/evals.yaml`
- Adjacent PRDs: `docs/prds/architecture/item-player-plugin-system.md`, `docs/prds/architecture/security.md`
