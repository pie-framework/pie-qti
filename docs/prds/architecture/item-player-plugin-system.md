# PRD: Item Player Plugin System

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/item-player
  Last reviewed: 2026-04-27
-->

**Status:** draft  
**Type:** architecture  
**Packages:** `@pie-qti/item-player`  
**Last reviewed:** 2026-04-27

---

## Summary

The item player plugin system is a set of three coordinated extension mechanisms inside `@pie-qti/item-player`: the `QTIPlugin` interface, the `ExtractionRegistry`, and the `ComponentRegistry`. Together they allow third-party code to teach the player how to recognize and render vendor-specific QTI markup without modifying the player core. The primary entry point is the `plugins` array in `PlayerConfig`; a plugin declares what it can extract and what web components it provides, and the player calls the plugin's registration methods at construction time. `ExtractionRegistry` and `ComponentRegistry` are also available as standalone injection points for callers who do not need full plugin packaging.

---

## Background and rationale

### Why the plugin system exists

QTI 2.x defines a closed set of interaction types, but real-world content ecosystems add vendor extensions. Renaissance Learning (and others) produce QTI files that contain custom child elements inside standard interaction containers, or entirely new interaction element names, to encode item types that QTI does not natively support — Likert scales, rating grids, drawing interactions with region analysis, and so on. Without an extension mechanism, the player would either reject these items, silently ignore the custom elements, or require integrators to fork the package. All three outcomes are unacceptable for a platform player.

The plugin system was designed with two constraints: (1) plugins must not be able to break core behavior for interactions they do not handle; (2) adding a plugin must not require any change to the player core. Constraint 1 is enforced through priority-based dispatch with explicit `canHandle` predicates. Constraint 2 is enforced by keeping the plugin interface narrow — plugins register extractors and components; the player core never imports plugin code.

### Why extraction and component registration are separate concerns

When the player encounters a `<choiceInteraction>` containing vendor-specific markup, it needs to answer two independent questions: (1) "what data does this element contain?" (extraction) and (2) "which web component should render this data?" (component selection). These questions have different answers at different layers of the stack:

- A vendor plugin might register a custom extractor that reads `<likertChoice>` children and produces a `LikertInteractionData` shape. That same plugin might register a custom `acme-likert-element` web component to render it. This is the common case.
- A host might want to use the standard QTI extractor for a `choiceInteraction` but replace the default rendering component with a custom-styled one. In this case, extraction is standard but component selection is overridden.
- In a server-side scoring context (no DOM), extraction is needed but component registration is irrelevant.

If extraction and component registration were a single concern (e.g., a single "renderer" object that both parses and renders), the server-side use case would require importing browser-specific code, and the style-override-only use case would require duplicating extraction logic. Keeping them separate lets each dimension be composed independently.

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

- **FR-1:** A plugin implementing `registerExtractors()` must be called with the `ExtractionRegistry` before the first `getInteractionData()` call, so that its extractor is available when the player processes interactions.
- **FR-2:** A plugin implementing `registerComponents()` must be called with the `ComponentRegistry` before the first render, so that its component is available when the player resolves tag names.
- **FR-3:** An extractor's `canHandle()` must be evaluated in descending priority order among all extractors registered for the same element type. The first extractor whose `canHandle()` returns `true` is used.
- **FR-4:** If no registered extractor's `canHandle()` returns `true` for a given element, `ExtractionRegistry.extract()` must return `{ success: false, error: ExtractionError }`, not throw.
- **FR-5:** If an extractor's `extract()` throws, `ExtractionRegistry.extract()` must catch the exception and return `{ success: false, error: ExtractionError }` with the original error as `cause`.
- **FR-6:** If an extractor provides a `validate()` method, it must be called after a successful `extract()`. Validation errors must convert the result to `{ success: false }`. Validation warnings must be surfaced as `{ success: true, warnings: [...] }`.
- **FR-7:** Registering two extractors with the same `id` must throw synchronously with a message identifying the duplicate id. This makes duplicate registration errors fail fast during development.
- **FR-8:** `ExtractionRegistry.unregister(id)` must remove the extractor from both the id map and the type buckets and return `true`; calling it with an unknown id must return `false`.
- **FR-9:** Plugin errors in `lifecycle.onRegister` must roll back the plugin registration (remove from `plugins` map) and re-throw, so a failed plugin leaves no partial state.
- **FR-10:** A plugin with unsatisfied `dependencies` must throw before `lifecycle.onRegister` is called.

---

## Non-functional requirements

- **Performance:** `ExtractionRegistry.findExtractor()` must check a `WeakMap` cache for repeat lookups (O(1)). Type-based indexing must limit the `canHandle()` scan to extractors registered for the element's type rather than all registered extractors (O(M) where M is extractors for that type, not O(N) total).
- **Security:** Plugin code runs with the same trust level as application code — plugins are integrator-owned. The framework does not sandbox plugin extractors. Extractors that inject HTML into returned data must use the same sanitizer and URL policy utilities available in `ExtractionContext` to avoid creating new XSS injection paths.
- **Cross-platform:** `ExtractionRegistry` and `ComponentRegistry` have no DOM dependencies and work in Node.js/Bun/Deno. `ComponentRegistry.register()` calls `customElements.define()` when `autoRegister` is true and `componentClass` is provided; this path is browser-only and will throw in non-browser environments. Plugins that target server-side scoring should not pass `componentClass` in their `ComponentConfig`.
- **i18n:** No i18n requirements specific to the plugin system. Individual extractors and components are responsible for internationalizing their own output if needed.

---

## Design decisions

### Registration timing: constructor-time, not render-time

**Decision:** Plugins' `registerExtractors()` and `registerComponents()` are called inside the `Player` constructor, before any parsing or extraction takes place.  
**Rationale:** `getInteractionData()` needs all extractors available on its first call — there is no lazy registration phase. Similarly, a component registry must be complete before the first `getTagName()` call. Deferring registration to render time would require callers to explicitly sequence plugin initialization before each render, which is error-prone.  
**Alternatives considered:** Lazy plugin loading (plugins loaded on first `canHandle()` check) — rejected because it requires async APIs in a synchronous dispatch loop.  
**Consequences:** Plugins are registered synchronously; async plugin initialization (e.g., loading a remote component definition) is not supported in the base `QTIPlugin` interface. Plugins that need async setup should complete it before passing the plugin instance to `PlayerConfig`.

### Extractor IDs are globally unique within a registry instance

**Decision:** Registering an extractor with an `id` that already exists in the registry throws immediately.  
**Rationale:** Silent overwrites would make the registration order matter invisibly. If two independently-developed plugins both try to register `qti:choice-interaction`, one would silently win and the other's logic would never run. Throwing on duplicate IDs forces the conflict to be resolved explicitly — either by the plugin using a namespaced id (`vendor:choice-interaction`) or by unregistering the existing extractor first.  
**Alternatives considered:** Last-registered-wins (silent overwrite); first-registered-wins (silent no-op). Both hide registration conflicts.  
**Consequences:** Plugin authors must namespace their extractor ids (`acme:likert-choice`, not `likert-choice`). The player's own standard extractors use the `qti:` namespace; plugins should use their own vendor namespace.

### Priority semantics are bands, not absolute values

**Decision:** The priority field is a number with documented bands: 1000+ for system-reserved, 500–999 for vendor-specific, 100–499 for third-party plugins, 10–99 for standard QTI, 0–9 for fallbacks.  
**Rationale:** Using exact numbers would require all plugin authors to coordinate to avoid collisions, which is impossible in a distributed ecosystem. Bands give each tier a large enough space that two independently-developed vendor plugins (both in the 500–999 range) can coexist if their `canHandle()` predicates are disjoint. When two extractors at the same priority both return `canHandle()` = `true`, the dispatch is first-registered-wins within that priority level; this is documented as undefined behavior and the situation should be avoided by making predicates more specific.  
**Alternatives considered:** A string-based priority tier (`'vendor' | 'plugin' | 'standard' | 'fallback'`) — rejected because it provides no way to order within a tier; two vendors would have no way to express relative precedence.  
**Consequences:** Plugin authors should document their intended priority in their plugin README so hosts can reason about ordering. If two plugins conflict, the host can adjust by passing pre-configured registries rather than plugin arrays.

### ComponentRegistry uses the InteractionData shape, not the element type, for canHandle

**Decision:** `ComponentConfig.canHandle` receives the fully-extracted `InteractionData` object, not the raw QTI element or element type string.  
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
| Full plugin entry point | `QTIPlugin` | `packages/item-player/src/core/Plugin.ts` | Implement `registerExtractors` and/or `registerComponents`. Pass in `PlayerConfig.plugins[]`. |
| Element extractor | `ElementExtractor<TData>` | `packages/item-player/src/extraction/types.ts` | Implement `id`, `name`, `priority`, `elementTypes`, `canHandle`, `extract`. Optional `validate`. |
| Extraction context utilities | `ExtractionUtils` | `packages/item-player/src/extraction/types.ts` | Provided to extractors via `context.utils`; do not re-implement DOM traversal manually. |
| Web component renderer | `ComponentConfig<TData>` | `packages/item-player/src/core/ComponentRegistry.ts` | Register per interaction type with a tag name and optional auto-registration. |
| Plugin lifecycle hooks | `PluginLifecycle` | `packages/item-player/src/core/Plugin.ts` | `onRegister`, `onBeforeRender`, `onAfterRender`, `onUnregister`. Use for telemetry and setup. |

---

## Data model / contracts

### `QTIPlugin`

```
packages/item-player/src/core/Plugin.ts
```

- `name` and `version` are required; version must match semver format `\d+\.\d+\.\d+`.
- `dependencies` is an array of other plugin names that must already be registered in the `PluginManager` when this plugin is registered. The player's `Player` constructor does not use `PluginManager` directly — it calls `registerExtractors`/`registerComponents` in a simple loop. `PluginManager` is available separately for hosts that need lifecycle management beyond what the Player constructor provides.
- `registerExtractors` and `registerComponents` are called synchronously and must not be async. If they throw, the error propagates to the `Player` constructor but does not prevent other plugins from registering (each plugin is wrapped in a try/catch in the Player constructor loop).

### `ElementExtractor<TData>`

```
packages/item-player/src/extraction/types.ts
```

- `elementTypes` must use QTI 2.x camelCase element names (e.g., `'choiceInteraction'`, not `'qti-choice-interaction'`). The registry normalizes to canonical lowercase form internally and maps QTI 3.0 kebab-case names during lookup, so a single extractor registration covers both QTI 2.x and 3.0.
- `canHandle()` must be fast. The registry calls it in a tight loop for every element of the matching type. Avoid DOM queries inside `canHandle`; use `context.utils.hasChildWithTag()` (O(direct-children)) not `querySelectorAll` (O(subtree)).
- `extract()` must return a plain object. It must not mutate the element. It may call any `context.utils` method.
- `validate()` receives the return value of `extract()`. Returning `{ valid: false }` causes the registry to return a failure result without calling any other handler for the same element. Returning `{ valid: true, warnings: [...] }` surfaces warnings without blocking the extraction result.
- The id convention is `namespace:element-type`, e.g. `acme:likert-choice`, `qti:choice-interaction`. The standard extractors all use the `qti:` prefix.

### `ExtractionContext`

```
packages/item-player/src/extraction/types.ts
```

- `dom` is the root parsed document element (from node-html-parser). It is used for document-wide queries inside extractors.
- `declarations` is a snapshot of the item's `responseDeclaration` / `outcomeDeclaration` map at extraction time, keyed by identifier. Extractors use it to read `cardinality` and `baseType` for their response variable.
- `utils` wraps node-html-parser's DOM API with a stable, version-agnostic helper surface. Extractors must use `utils` rather than calling node-html-parser APIs directly, to remain compatible with future parser changes.
- `config` is the full `PlayerConfig`. Extractors should read only the fields they need (role, security, QTI version mappers). They must not mutate config.

### `ComponentConfig<TData>`

```
packages/item-player/src/core/ComponentRegistry.ts
```

- `tagName` must contain a hyphen (web component spec requirement). The registry validates this at registration time and throws if violated.
- `componentClass` is optional. When provided with `autoRegister !== false`, the registry calls `customElements.define(tagName, componentClass)` at registration time. If the tag name is already defined in `customElements`, registration is skipped silently.
- `canHandle(data)` receives `InteractionData` which always has a `type` field matching the interaction element name (e.g., `'choiceInteraction'`). A vendor component that handles a specific subtype should check for vendor-specific fields on the data object.
- `priority` 0 is the intended priority for default/fallback renderers. The standard default components (`@pie-qti/default-components`) use priority 0. Vendor components should use priority > 0.

### `PluginLifecycle`

```
packages/item-player/src/core/Plugin.ts
```

- `onRegister(context: PluginContext)` is called by `PluginManager.register()` after the plugin is stored. `PluginContext` provides `extractionRegistry`, `componentRegistry`, `dom` (if available), and `config`. The `Player` instance is NOT available here — use `onBeforeRender` if Player access is needed.
- `onBeforeRender(context: RenderContext)` and `onAfterRender(context: RenderContext)` are called by `PluginManager` around render cycles. `RenderContext` extends `PluginContext` with `player: Player`. These hooks are async-safe.
- Lifecycle hooks are not called by the `Player` constructor's plugin loop — that loop only calls `registerExtractors` and `registerComponents`. Lifecycle hooks are only triggered when a `PluginManager` instance is explicitly used and its `callBeforeRenderHooks` / `callAfterRenderHooks` methods are called by the host rendering layer.

---

## Acceptance criteria

### Functional

```
AC-1: Plugin extractor registered before getInteractionData() is called
  Given: A Player constructed with plugins: [acmeLikertPlugin]
         and an itemXml containing a choiceInteraction with likertChoice children
  When: player.getInteractionData() is called
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
AC-10: Plugin with unsatisfied dependency throws at PluginManager.register()
  Given: pluginB with dependencies: ['pluginA'] and pluginA not yet registered in PluginManager
  When: pluginManager.register(pluginB, context) is called
  Then: Throws with a message listing the missing dependency 'pluginA'
        pluginB is not added to the plugin map
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

## Open questions

- [ ] The Player constructor calls `plugin.registerExtractors` and `plugin.registerComponents` in a try/catch that silently swallows errors (to prevent one bad plugin from blocking others). Should plugin errors be surfaced to the caller as warnings rather than being completely silent? There is currently no mechanism to report them short of inspecting the browser console.
- [ ] `ExtractionUtils.getHtmlContent()` returns unsanitized HTML from the element. Plugins that use this to populate fields injected via `{@html}` in Svelte must sanitize the result themselves. Should `getHtmlContent()` accept an optional security config parameter to apply the same sanitizer pipeline used by the Player?
- [ ] The `PluginManager` class is available for hosts that need managed lifecycle, but it is not wired into the `Player` constructor — plugins in `PlayerConfig.plugins[]` have their `registerExtractors`/`registerComponents` methods called directly, bypassing `PluginManager.register()`. This means `lifecycle.onRegister` is never called when plugins are passed through `PlayerConfig`. Clarify or align: either the Player should instantiate a `PluginManager` internally, or the lifecycle docs should prominently note this gap.

---

## Related

- QTI spec: QTI 2.2 §14 (customInteraction extension model)
- Implementation: `packages/item-player/src/core/Plugin.ts`, `PluginManager.ts`, `ComponentRegistry.ts`
- Implementation: `packages/item-player/src/extraction/ExtractionRegistry.ts`, `types.ts`
- Example plugin: `packages/acme-likert-plugin/`
- Extractor how-to guide: `packages/item-player/docs/custom-extractors.md`
- Adjacent PRDs: `architecture/item-player.md`
- Architecture overview: `docs/ARCHITECTURE.md`
