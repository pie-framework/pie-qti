# PRD: Item Player Plugin System

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/item-player
  Last reviewed: 2026-08-13
-->

**Status:** draft  
**Type:** architecture  
**Packages:** `@pie-qti/item-player`  
**Last reviewed:** 2026-08-13

---

## Summary

The item player plugin system coordinates `AssessmentItemDefinitionPlugin`, `ExtractionRegistry`, and `ComponentRegistry` inside `@pie-qti/item-player`. Together they allow third-party code to teach the player how to recognize, safely deliver, and render vendor-specific QTI markup without modifying the core. The entry point is the immutable `plugins` array in `AssessmentItemDefinitionConfig`; definition construction freezes the list, validates its entries and dependency order, builds the registries once, installs standard `InteractionModule` extractors and plugins, and seals both registries before any session can open. Plugin objects remain trusted executable adapters rather than deep-frozen plain data.

---

## Background and rationale

### Why the plugin system exists

QTI 2.x defines a closed set of interaction types, but real-world content ecosystems add vendor extensions. Renaissance Learning (and others) produce QTI files that contain custom child elements inside standard interaction containers, or entirely new interaction element names, to encode item types that QTI does not natively support — Likert scales, rating grids, drawing interactions with region analysis, and so on. Without an extension mechanism, the player would either reject these items, silently ignore the custom elements, or require integrators to fork the package. All three outcomes are unacceptable for a platform player.

The plugin system was designed with two constraints: (1) plugins must not be able to break core behavior for interactions they do not handle; (2) adding a plugin must not require any change to the player core. Constraint 1 is enforced through priority-based dispatch with explicit `canHandle` predicates. Constraint 2 is enforced by keeping the plugin interface narrow — plugins register extractors and components; the player core never imports plugin code.

### Why extraction and component registration are separate concerns

When the player encounters a `<choiceInteraction>` containing vendor-specific markup, it needs to answer two independent questions: (1) "what data does this element contain?" (extraction) and (2) "which web component should render this data?" (component selection). Standard extractors and interaction contracts live in `packages/item-player/src/interactions/<interaction>/`. These questions have different answers at different layers of the stack:

- A vendor plugin might register a custom extractor that reads `<likertChoice>` children and produces a `LikertInteractionData` shape. That same plugin might register a custom `acme-likert-element` web component to render it. This is the common case.
- A host might want to use the standard QTI extractor for a `choiceInteraction` but replace the default rendering component with a custom-styled one. In this case, extraction is standard but component selection is overridden.
- In a server-side scoring context (no DOM), extraction is needed but component registration is irrelevant.

If extraction and component registration were a single concern (e.g., a single "renderer" object that both parses and renders), the server-side use case would require importing browser-specific code, and the style-override-only use case would require duplicating extraction logic. Keeping them separate lets each dimension be composed independently. Field meaning remains local, however: a standard `InteractionModule` owns its extractor, placement, and delivery-field classification; a plugin extractor owns the equivalent `delivery` schema for fields it adds.

### Why priority-based dispatch

Multiple extractors or components may claim they can handle the same element type. Priority-based dispatch provides a deterministic resolution rule: the highest-priority entry whose `canHandle()` returns `true` wins. This enables:

- Vendor-specific extractors to run before standard QTI extractors for the same element type. A `choiceInteraction` with `<likertChoice>` children is handled by the vendor extractor (priority 500) before the standard extractor (priority 10) ever evaluates it.
- Multiple vendors to coexist. Each registers at different priorities and uses specific `canHandle()` predicates. There is no global name collision because `canHandle` is a predicate, not an ownership claim.
- Progressive fallback. If no high-priority extractor matches, lower-priority extractors (including the standard ones) are evaluated in sequence.

The alternative — a last-registered-wins or first-registered-wins rule — would make plugin interaction order brittle and would require calling code to know the registration order of all plugins, including transitive dependencies.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.2, QTI 3.0
- **Spec section(s):** QTI 2.2 §14 (customInteraction), which establishes that vendor extensions are permitted within the spec's extension model; the plugin system generalizes this to any interaction type.
- **Supported attributes:** The plugin system does not itself process QTI attributes; that is the responsibility of individual extractors.
- **Known divergences from spec:** None. The plugin system operates entirely within the spec's extension model.

---

## Functional requirements

- **FR-1:** A plugin implementing `registerExtractors()` must be called with the definition-owned `ExtractionRegistry` before any session can open.
- **FR-2:** A plugin implementing `registerComponents()` must be called with the `ComponentRegistry` before the first render, so that its component is available when the player resolves tag names.
- **FR-3:** An extractor's `canHandle()` must be evaluated in descending priority order among all extractors registered for the same element type. The first extractor whose `canHandle()` returns `true` is used.
- **FR-4:** If no registered extractor's `canHandle()` returns `true` for a given element, `ExtractionRegistry.extract()` must return `{ success: false, error: ExtractionError }`, not throw.
- **FR-5:** If an extractor's `extract()` throws, `ExtractionRegistry.extract()` must catch the exception and return `{ success: false, error: ExtractionError }` with the original error as `cause`.
- **FR-6:** If an extractor provides a `validate()` method, it must be called after a successful `extract()`. Validation errors must convert the result to `{ success: false }`. Validation warnings must be surfaced as `{ success: true, warnings: [...] }`.
- **FR-7:** Registering two extractors with the same `id` must throw synchronously with a message identifying the duplicate id. This makes duplicate registration errors fail fast during development.
- **FR-8:** `ExtractionRegistry.unregister(id)` must remove the extractor from both the id map and the type buckets and return `true`; calling it with an unknown id must return `false`.
- **FR-9:** If plugin registration throws, definition construction must fail; no partially compiled definition may be returned.
- **FR-10:** A plugin with unsatisfied `dependencies` must throw before either of its registration methods is called.
- **FR-11:** Definition construction must register standard extractors and definition plugins before sealing its registries. All sessions opened from that definition share the sealed, immutable registry descriptors. After `seal()`, `register`, `unregister`, and `clear` must throw; changing the plugin/module set requires a new definition.
- **FR-12:** `ElementExtractor.delivery` must classify plugin-produced HTML and URL fields by path
  and URL use. The delivery pipeline must merge that schema with the standard delivery fields for the
  authored interaction kind (independent of `outputType`), enforce the configured sanitizer/URL
  policy, freeze the delivered graph, and memoize it for the session.
- **FR-13:** `ExtractionUtils.getHtmlContent()` and `getPrompt()` must apply the active `PlayerSecurityConfig` at extraction ingress. They return sanitized strings; only the final delivery pipeline may optionally create `TrustedHTML`.

---

## Non-functional requirements

- **Performance:** Type-based indexing limits the `canHandle()` scan to extractors registered for the authored element type. The live session memoizes the finalized `BaseInteractionData[]`, so repeat presentation does not repeat parsing, extraction, or delivery finalization.
- **Security:** Plugin code runs with the same trust level as application code — plugins are integrator-owned. The framework does not sandbox it. Extractors use configured `getHtmlContent()` / `getPrompt()` for ingress and declare rich/URL fields in `delivery`; the common finalizer owns sanitizer, URL policy, optional Trusted Types creation, and freezing.
- **Cross-platform:** `ExtractionRegistry` has no browser DOM dependency. `ComponentRegistry` can store tag mappings in Node.js/Bun/Deno; when `autoRegister` is enabled with a `componentClass`, it defines the element only if `globalThis.customElements` exists and otherwise safely defers registration. Server-side scoring plugins normally omit component registration because no renderer is needed.
- **i18n:** No i18n requirements specific to the plugin system. Individual extractors and components are responsible for internationalizing their own output if needed.

---

## Design decisions

### Registration timing: definition/session construction, not render-time

**Decision:** The plugin list is frozen in `AssessmentItemDefinitionConfig`. Definition construction installs its entries into definition-owned registries, snapshots registered extractor/component descriptors, seals the registries, and only then permits a session to open. Registration errors propagate from definition construction. Sessions share those immutable registries while keeping all extracted, shuffled, response, and lifecycle state session-local. The plugin objects themselves remain trusted executable adapters.
**Rationale:** Delivery must be stable for the lifetime of a live session so its memoized interaction graph, shuffled order, and component selection cannot drift between renders.
**Alternatives considered:** Lazy plugin loading (plugins loaded on first `canHandle()` check) — rejected because it requires async APIs in a synchronous dispatch loop.  
**Consequences:** Definition plugins are registered synchronously once per definition. Plugins that need async setup complete it before definition creation. Registry mutation after sealing throws and requires a new definition.

### Delivery schema is part of the extractor contract

**Decision:** `ElementExtractor.delivery` declares every plugin field that crosses an HTML or
resource-URL sink. Standard classification remains beside each authored `InteractionModule`; the
pipeline merges the authored-type schema with the selected extractor's schema even when
`outputType` routes to a different renderer.
**Rationale:** Plugin authors know the meaning and shape of their fields, while the framework owns the security implementation. This keeps classification local without duplicating sanitizer or URL-policy code.
**Alternatives considered:** A central field-name switch, renderer-side heuristics, or requiring plugins to return `TrustedHTML`.
**Consequences:** `getHtmlContent()` and `getPrompt()` provide configured ingress sanitation, but rich output fields still require a delivery declaration. The finalizer sanitizes/validates again at egress, optionally creates `TrustedHTML`, freezes the graph, and the live session memoizes it.

### Extractor IDs are globally unique within a registry instance

**Decision:** Registering an extractor with an `id` that already exists in the registry throws immediately.  
**Rationale:** Silent overwrites would make the registration order matter invisibly. If two independently-developed plugins both try to register `qti:choice-interaction`, one would silently win and the other's logic would never run. Throwing on duplicate IDs forces the conflict to be resolved explicitly — either by the plugin using a namespaced id (`vendor:choice-interaction`) or by unregistering the existing extractor first.  
**Alternatives considered:** Last-registered-wins (silent overwrite); first-registered-wins (silent no-op). Both hide registration conflicts.  
**Consequences:** Plugin authors must namespace their extractor ids (`acme:likert-choice`, not `likert-choice`). The player's own standard extractors use the `qti:` namespace; plugins should use their own vendor namespace.

### Priority semantics are bands, not absolute values

**Decision:** The priority field is a number with documented bands: 1000+ for system-reserved, 500–999 for vendor-specific, 100–499 for third-party plugins, 10–99 for standard QTI, 0–9 for fallbacks.  
**Rationale:** Using exact numbers would require all plugin authors to coordinate to avoid collisions, which is impossible in a distributed ecosystem. Bands give each tier a large enough space that two independently-developed vendor plugins (both in the 500–999 range) can coexist if their `canHandle()` predicates are disjoint. When two extractors at the same priority both return `canHandle()` = `true`, the dispatch is first-registered-wins within that priority level; this is documented as undefined behavior and the situation should be avoided by making predicates more specific.  
**Alternatives considered:** A string-based priority tier (`'vendor' | 'plugin' | 'standard' | 'fallback'`) — rejected because it provides no way to order within a tier; two vendors would have no way to express relative precedence.  
**Consequences:** Plugin authors should document their intended priority in their plugin README so
hosts can reason about ordering. The primary definition API does not accept preconfigured mutable
registries; resolving a conflict requires changing plugin IDs/priorities or the immutable plugin list,
then compiling a new definition. Direct registries remain public for focused extractor tests and
tooling, not for mutating a compiled definition.

### ComponentRegistry uses delivered interaction data, not parser elements, for canHandle

**Decision:** `ComponentConfig.canHandle` receives the fully delivered `BaseInteractionData` object, including vendor payload fields, not the raw QTI element or element type string.
**Rationale:** Component selection often depends on extracted metadata that is not in the element type alone. For example, selecting a star-rating component instead of the standard choice component requires knowing that the interaction's choices have a `isLikert: true` flag — information only available after extraction. Passing the raw element to `canHandle` would require component-level re-parsing of the XML.  
**Alternatives considered:** Passing `(elementType, data)` to allow filtering by type before inspecting data — the type is already available as `data.type`, so the separate argument is redundant.  
**Consequences:** `ComponentRegistry` dispatch runs after extraction, not before. An interaction that fails extraction is never routed to any component. This is the correct behavior — there is nothing renderable for a failed extraction.

### canHandle() errors in registries are logged and skipped, not re-thrown

**Decision:** If `canHandle()` throws, the registry logs a warning and moves to the next extractor or component, rather than propagating the exception.  
**Rationale:** A plugin bug in one `canHandle()` predicate should not prevent all other interactions in the same item from rendering. The defensive fallback ensures partial rendering over complete failure. The warning log is sufficient for development-time debugging.  
**Alternatives considered:** Re-throwing (makes one plugin bug take down the entire item); silently skipping without logging (makes debugging impossible).  
**Consequences:** Plugin authors must not assume that a `canHandle()` exception will propagate visibly. They should test `canHandle()` separately and not use exceptions as a control flow mechanism inside it.

---

## Extension points

| Extension point | Interface/type | Location | Notes |
|----------------|---------------|----------|-------|
| Definition plugin entry point | `AssessmentItemDefinitionPlugin` | `packages/item-player/src/core/AssessmentItemDefinition.ts` | Implement synchronous `registerExtractors` and/or `registerComponents`. Pass in `AssessmentItemDefinitionConfig.plugins[]`; dependencies must precede dependents. |
| Element extractor | `ElementExtractor<TPayload, TOutputType>` | `packages/item-player/src/extraction/types.ts` | Implement `id`, `name`, `priority`, `elementTypes`, `canHandle`, `extract`, optional `outputType`, and `delivery` for rich/URL fields. Optional `validate`. |
| Extraction context utilities | `ExtractionUtils` | `packages/item-player/src/extraction/types.ts` | Use configured `getHtmlContent()` / `getPrompt()` for rich fields and parser-neutral helpers for traversal. |
| Delivery schema | `InteractionDeliverySchema` | `packages/item-player/src/extraction/deliveryTypes.ts` | Declare paths with `htmlField(...)` and `urlField(use, ...)`; shared finalization enforces them. |
| Web component renderer | `ComponentConfig<TData>` | `packages/item-player/src/core/ComponentRegistry.ts` | Register per interaction type with a tag name and optional auto-registration. |

---

## Data model / contracts

### `AssessmentItemDefinitionPlugin`

```
packages/item-player/src/core/AssessmentItemDefinition.ts
```

- `kind: 'assessment-item-definition-plugin'`, `name`, and semantic `version` are required.
- `dependencies` names must refer to plugins that occur earlier in the definition's immutable plugin list. Missing, duplicate, and malformed plugins fail definition construction.
- `registerExtractors` and `registerComponents` are synchronous and run exactly once per compiled definition before both registries are sealed.
- The contract is synchronous. Complete asynchronous setup before definition construction.

### `ElementExtractor<TPayload, TOutputType>`

```
packages/item-player/src/extraction/types.ts
```

- `elementTypes` must use QTI 2.x camelCase element names (e.g., `'choiceInteraction'`, not `'qti-choice-interaction'`). The registry normalizes to canonical lowercase form internally and maps QTI 3.0 kebab-case names during lookup, so a single extractor registration covers both QTI 2.x and 3.0.
- `canHandle()` must be fast. The registry calls it in a tight loop for every element of the matching type. Avoid DOM queries inside `canHandle`; use `context.utils.hasChildWithTag()` (O(direct-children)) not `querySelectorAll` (O(subtree)).
- `extract()` returns a plain payload object and must not mutate the element. The payload excludes framework-owned identity; after extraction the pipeline creates `DeliveredInteraction<TOutputType, TPayload>` by writing `type` and the authored `responseId` last.
- `outputType` optionally selects a renderer-facing interaction type different from the authored
  element name. It does not change which standard delivery schema applies. Payload-provided `type`
  and `responseId` values cannot override framework routing.
- `delivery?: InteractionDeliverySchema` declares output fields that reach HTML or URL sinks. Paths may contain `'*'` to visit array items or record values. HTML fields use `htmlField(...)`; URL fields use `urlField(use, ...)`, where `use` selects the URL-policy context.
- `validate()` receives the return value of `extract()`. Returning `{ valid: false }` causes the registry to return a failure result without calling any other handler for the same element. Returning `{ valid: true, warnings: [...] }` surfaces warnings without blocking the extraction result.
- The id convention is `namespace:element-type`, e.g. `acme:likert-choice`, `qti:choice-interaction`. The standard extractors all use the `qti:` prefix.

### `ExtractionContext`

```
packages/item-player/src/extraction/types.ts
```

- `dom` is the root parsed document element (from node-html-parser). It is used for document-wide queries inside extractors.
- `declarations` is a snapshot of the item's `responseDeclaration` / `outcomeDeclaration` map at extraction time, keyed by identifier. Extractors use it to read `cardinality` and `baseType` for their response variable.
- `utils` wraps parser traversal with a stable, version-agnostic helper surface. Extractors must use it rather than calling parser-specific APIs directly. `getHtmlContent()` and `getPrompt()` use `config.security` and return ingress-sanitized strings; `getTextContent()` is for fields that are semantically plain text.
- `config` is the narrow immutable `ExtractionConfig` (role, security, and QTI version mappers). Extractors must not mutate it.

### `ComponentConfig<TData>`

```
packages/item-player/src/core/ComponentRegistry.ts
```

- `tagName` must contain a hyphen (web component spec requirement). The registry validates this at registration time and throws if violated.
- `componentClass` is optional. When provided with `autoRegister !== false`, the registry calls `customElements.define(tagName, componentClass)` at registration time. If the tag name is already defined in `customElements`, registration is skipped silently.
- `canHandle(data)` receives delivered interaction data whose `type` is the extractor's `outputType`, or the normalized authored type when `outputType` is omitted. A vendor component that handles a specific subtype should check the declared output type and vendor-specific fields on the data object.
- `priority` 0 is the intended priority for default/fallback renderers. The standard default components (`@pie-qti/default-components`) use priority 0. Vendor components should use priority > 0.

## Acceptance criteria

### Functional

```
AC-1: Definition plugin is registered before session delivery
  Given: An AssessmentItemDefinition created with plugins: [acmeLikertPlugin]
         and an itemXml containing a choiceInteraction with likertChoice children
  When: definition.openSession().present() is called
  Then: Returns one interaction with the extracted LikertInteractionData shape
        (including metadata.isLikert === true)
        The standard choice extractor (priority 10) is not used
```

```
AC-2: Priority dispatch — vendor extractor wins over standard extractor
  Given: Two extractors registered for 'choiceInteraction': acme:likert-choice (priority 500)
         and qti:choice-interaction (priority 10)
         An element with <likertChoice> children for which acme:likert-choice.canHandle() returns true
  When: registry.findExtractor(element, context) is called
  Then: Returns the acme:likert-choice extractor, not qti:choice-interaction
```

```
AC-3: Standard extractor used when vendor canHandle() returns false
  Given: Two extractors registered for 'choiceInteraction': acme:likert-choice (priority 500)
         and qti:choice-interaction (priority 10)
         An element with <simpleChoice> children (no likertChoice) so acme's canHandle() returns false
  When: registry.findExtractor(element, context) is called
  Then: Returns the qti:choice-interaction extractor
```

```
AC-4: Failed extraction returns ExtractionResult with success=false
  Given: An ExtractionRegistry with one extractor whose canHandle() always returns true
         but whose extract() always throws
  When: registry.extract(element, context) is called
  Then: Returns { success: false, error: ExtractionError }
        The error.cause is the original thrown error
        No exception propagates to the caller
```

```
AC-5: Duplicate extractor id throws at registration time
  Given: An ExtractionRegistry with extractor id='acme:likert-choice' already registered
  When: registry.register({ id: 'acme:likert-choice', ... }) is called again
  Then: Throws synchronously with a message containing the duplicate id
```

```
AC-6: Validation errors block extraction result
  Given: An extractor with validate() that returns { valid: false, errors: ['scale must be 2-7'] }
  When: registry.extract(element, context) is called and extract() succeeds
  Then: Returns { success: false, error: ExtractionError }
        The error message includes the validation error text
```

```
AC-7: Validation warnings do not block extraction result
  Given: An extractor with validate() that returns { valid: true, warnings: ['unusual scale'] }
  When: registry.extract(element, context) is called
  Then: Returns { success: true, data: ..., warnings: ['unusual scale'] }
```

```
AC-8: ComponentRegistry resolves tag name for interaction data with custom component
  Given: A ComponentRegistry with standard-choice (priority 0, canHandle: () => true)
         and acme-likert (priority 500, canHandle: (data) => data.metadata?.isLikert === true) registered for 'choiceInteraction'
         and InteractionData with type='choiceInteraction' and metadata.isLikert=true
  When: registry.getTagName(data) is called
  Then: Returns the tag name registered for acme-likert, not standard-choice
```

```
AC-9: canHandle() error in ExtractionRegistry is logged but does not propagate
  Given: An extractor whose canHandle() throws
         and a second extractor for the same element type whose canHandle() returns true
  When: registry.findExtractor(element, context) is called
  Then: The throwing extractor's error is logged as a warning
        The second extractor is returned
        No exception propagates to the caller
```

```
AC-10: Definition plugin with unsatisfied dependency fails compilation
  Given: pluginB with dependencies: ['pluginA'] and pluginA absent from the earlier plugin list
  When: createAssessmentItemDefinition({ plugins: [pluginB] }) is called
  Then: Throws with a message listing the missing dependency 'pluginA'
        neither registration method is called
```

```
AC-11: Definition registries seal before sessions open
  Given: A definition with standard and plugin extractors
  When: definition construction succeeds
  Then: its extraction and component registries are sealed before any session opens
        register(), unregister(), and clear() throw after sealing
        repeat present() calls reuse the same frozen delivered interaction graph
```

```
AC-12: Plugin rich and URL fields follow its delivery schema
  Given: A plugin extractor whose extract() uses context.utils.getPrompt()
         and returns { prompt, image: { src } }
         with delivery.fields=[htmlField('prompt'), urlField('img', 'image', 'src')]
  When: the prompt contains an event handler and src uses a blocked scheme
  Then: ingress and final egress sanitation remove unsafe markup
        the URL is neutralized by the configured policy
        optional TrustedHTML appears only in the finalized frozen result
```

### Edge cases

```
AC-E1: Extractor elementTypes in QTI 3.0 kebab-case are normalized correctly
  Given: An extractor registered with elementTypes: ['choiceInteraction'] (QTI 2.x form)
         and a QTI 3.0 element with rawTagName 'qti-choice-interaction'
         and the registry constructed with a Qti3ElementNameMapper
  When: registry.findExtractor(element, context) is called
  Then: The extractor is found (QTI 3.0 name maps to the same canonical key as QTI 2.x name)
```

```
AC-E2: ExtractionRegistry.clone() produces an independent registry
  Given: A registry with two registered extractors
  When: cloned = registry.clone() is called
        A new extractor is registered on the original
  Then: cloned.getExtractors() returns only the two original extractors
        The new extractor is not present in the clone
```

```
AC-E3: ComponentRegistry throws when no component matches any canHandle()
  Given: A ComponentRegistry with one component for 'choiceInteraction' whose canHandle() returns false
  When: registry.getTagName(interactionData) is called
  Then: Throws an Error listing the registered components that were evaluated
```

---

## Related

- QTI spec: QTI 2.2 §14 (customInteraction extension model)
- Implementation: `packages/item-player/src/core/AssessmentItemDefinition.ts`, `ComponentRegistry.ts`
- Implementation: `packages/item-player/src/extraction/ExtractionRegistry.ts`, `types.ts`
- Example plugin: `packages/acme-likert-plugin/`
- Extractor how-to guide: `packages/item-player/docs/custom-extractors.md`
- Adjacent PRDs: `architecture/item-player.md`
- Architecture overview: `docs/ARCHITECTURE.md`
