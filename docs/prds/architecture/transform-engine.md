# PRD: Transform Engine & Plugin System

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/transform-core, @pie-qti/transform-types
  Last reviewed: 2026-04-27
-->

**Status:** draft
**Type:** architecture
**Packages:** `@pie-qti/transform-core`, `@pie-qti/transform-types`
**Last reviewed:** 2026-04-27

---

## Summary

The Transform Engine is the central orchestration layer for all content format conversions in the PIE-QTI framework. It accepts content in a source format, detects or validates that format, selects the highest-priority registered plugin that handles the source→target pair, and executes the transformation through a workflow. The engine is format-agnostic: `TransformFormat` is a plain string, so any new format pair can be added by registering a new plugin without modifying the engine. The engine lives in `@pie-qti/transform-core`; all shared type contracts live in `@pie-qti/transform-types` (published as `@pie-qti/transform-types`).

---

## Background and rationale

The framework grew from a need to move content bidirectionally between the PIE authoring format and QTI 2.2 for LMS distribution, with a credible upgrade path to QTI 3.0 and other formats. Several design constraints drove the architecture:

1. **Vendor content is prevalent.** QTI in the wild carries proprietary extensions (custom namespaces, non-standard interaction types, vendor CDN URLs). A single monolithic transformer cannot handle this; vendors must be able to ship their own transformation logic without forking the framework.

2. **Workflows, not bare function calls.** Transformation of a single item involves multiple discrete steps (read, detect, validate, parse, detect vendor, transform, write). Modeling these as a `WorkflowDefinition` with individual `Activity` steps means each step is independently retryable, observable via progress events, and swappable between a lightweight in-memory runner (development/CLI) and a durable workflow engine (production batch jobs) without changing application code.

3. **Batch transformation needs storage; single items do not.** Batches reference items by URI, require a `StorageBackend` to read source content and write output, and may run items concurrently. Single-item transforms accept inline content and need no storage. Making `StorageBackend` optional at the engine level (required at batch time, enforced at runtime rather than type level) keeps the single-item API simple for test and CLI use.

---

## QTI specification alignment

- **Spec versions:** QTI input detection across supported versions; QTI 2.2 remains the primary PIE → QTI export target; QTI 3.0 participates through detection and plugin routing where supported
- **Spec sections:** The engine itself is not QTI-specific; it is a generic plugin bus. QTI compliance is enforced within individual plugins (see `architecture/qti-to-pie.md` and `architecture/pie-to-qti.md`).
- **Known divergences:** The `QtiDetector` maps all QTI 2.x namespace variants (`imsqti_v2p0`, `imsqti_v2p1`, `imsqti_v2p2`) to the single format string `"qti22"`. This is intentional: the differences between 2.0 and 2.2 do not warrant separate plugin pairs for current use cases. QTI 3.0-capable plugins register `sourceFormat: "qti30"` as needed.

---

## Functional requirements

- **FR-1:** The engine MUST accept content as an inline string or object and a `targetFormat` string. `sourceFormat` is optional; the engine detects it if absent.
- **FR-2:** Format detection MUST be performed by the `FormatDetectorRegistry`, which tries registered detectors in descending priority order and returns the first match.
- **FR-3:** Plugin selection MUST be performed by the `PluginRegistry`, which filters plugins by `(sourceFormat, targetFormat)` pair and returns the one with the highest `priority` value. Ties are broken by insertion order (Map iteration, first inserted wins after sort).
- **FR-4:** The engine MUST call `plugin.initialize(options)` before the first `transform` call if the method exists on the plugin.
- **FR-5:** Single-item transforms MUST return a `WorkflowHandle<TransformItemOutput>` that can be polled for status, progress, and result.
- **FR-6:** Batch transforms MUST require a `StorageBackend`; the engine MUST throw synchronously (before starting the workflow) if `storage` is not set.
- **FR-7:** The engine MUST call `plugin.dispose()` on all registered plugins during `dispose()`, then shut down the orchestrator.
- **FR-8:** Custom format detectors MUST be registerable via `engine.registerFormatDetector(detector)` and participate in the same priority-ordered detection chain as built-in detectors.
- **FR-9:** The engine MUST surface transformation progress via `WorkflowHandle.progress()` reflecting the current workflow step.

---

## Non-functional requirements

- **Accessibility:** Not applicable — the engine runs server-side; it has no UI surface.
- **Performance:** Single-item transforms must complete within the 2-minute activity timeout enforced by the orchestrator. Batch transforms must respect `maxConcurrent` (default 5) to avoid overwhelming storage or downstream services.
- **Cross-platform:** Runs in Node.js 20.19+ and Bun. No browser-specific APIs.
- **Security:** The engine does not sanitize content. Sanitization is the responsibility of individual plugins. The engine must not execute content it receives (no `eval`, no dynamic imports from content).
- **i18n:** Not applicable at the engine level.

---

## Design decisions

### TransformFormat is a plain string, not an enum

**Decision:** `TransformFormat = string`.
**Rationale:** An enum would require the engine package to be updated whenever a new format pair is added — even for purely external vendor plugins. A plain string allows any plugin to declare its own format tokens (`"qti30"`, `"learnosity"`, `"moodle-xml"`) without touching core. The engine never interprets format strings; it only uses them for equality matching between plugin declarations and caller requests.
**Alternatives considered:** A string-literal union (`"qti22" | "pie" | ...`) would provide IDE autocomplete but blocks extensibility. A symbol-keyed registry was considered but adds serialization complexity.
**Consequences:** Format strings are unvalidated. Mistyped format strings produce a clean "no plugin found" error rather than a compile-time failure. Document canonical format tokens in this PRD and in plugin READMEs to compensate.

---

### WorkflowOrchestrator is injectable, defaulting to InMemoryOrchestrator

**Decision:** `TransformEngine` accepts an optional `WorkflowOrchestrator` in its constructor and defaults to `InMemoryOrchestrator` when none is supplied.
**Rationale:** `InMemoryOrchestrator` runs all activities in the current process with no external dependencies — ideal for CLI, tests, and local reference harnesses. Production batch pipelines may need a durable orchestrator (e.g., Temporal) that survives process restarts and distributes work across workers. By programming to the `WorkflowOrchestrator` interface, the engine is oblivious to which engine is running.
**Alternatives considered:** Hardcoding `InMemoryOrchestrator` was rejected because it would require forking the engine for production use. An environment-variable-based switch inside the engine was rejected because it couples infrastructure decisions to library code.
**Consequences:** Callers that need progress tracking, cancellation, or durability must supply an orchestrator implementation. The `InMemoryOrchestrator`'s `sleep()` uses `setTimeout` (not workflow-safe) and heartbeats are no-ops — document this limitation for users who intend to migrate to Temporal.

---

### Storage is optional for single transforms, required for batch

**Decision:** `StorageBackend` is an optional constructor parameter, settable via `setStorage()`. `transformBatch` throws at runtime if storage is absent.
**Rationale:** Batch items are referenced by URI (`storage://…`), so the engine must be able to read from and write to a backend. Single-item transforms receive inline content and produce an in-memory result — no storage needed. Enforcing storage at the type level for single transforms would require callers to supply a no-op backend, which is boilerplate with no value.
**Alternatives considered:** Always requiring storage (rejected: excessive ceremony for tests/CLI); two separate engine classes (rejected: complicates the API surface for callers who do both).
**Consequences:** The runtime check in `transformBatch` is an `Error` throw before the workflow starts — it is not a typed compile-time failure. Callers that call `transformBatch` must ensure `setStorage` has been called or pass storage in the constructor.

---

### Static priority dispatch — no canHandle cascade at the engine level

**Decision:** `PluginRegistry.findPlugin` picks the highest-priority plugin by `(sourceFormat, targetFormat)` pair and returns it unconditionally. The engine does not call `canHandle` on lower-priority plugins if the top candidate's `canHandle` returns false.
**Rationale:** The `TRANSFORMATION-ENGINE.md` documentation shows a `canHandle` cascade in the selection algorithm, but the actual `PluginRegistry.findPlugin` implementation returns `candidates[0]` (highest priority) without cascading. This is the deliberate production behavior. The engine calls the selected plugin's `canHandle` internally (via the workflow activities), but if the top plugin cannot handle the input, the workflow fails rather than transparently falling back to a lower-priority plugin. Transparent fallback would make plugin selection non-deterministic and hard to reason about in multi-vendor environments; an explicit error is preferable.
**Alternatives considered:** Full cascade (try each plugin in priority order until one handles) — rejected because it silently swallows mis-detection in higher-priority vendor plugins. The `findCompatiblePlugins` method on `PluginRegistry` exists for diagnostic use but is not called by the engine's main path.
**Consequences:** Vendor plugins must have accurate `canHandle` implementations. A vendor plugin that always returns `true` from `canHandle` but is registered at high priority will shadow all lower-priority plugins for that format pair. The `priority` tiers (1–99 fallback, 100–499 normal, 500–999 vendor, 1000+ framework internal) are a convention documented here and in the vendor plugin guide — not enforced by the engine.

---

### TransformContext uses `any` for storage to avoid circular dependencies

**Decision:** `TransformContext.storage` is typed as `any` rather than `StorageBackend`.
**Rationale:** `TransformContext` lives in `@pie-qti/transform-types`. `StorageBackend` lives in the same package under `/storage`. To avoid a compile-time circular dependency between the transform and storage type modules while keeping them in the same package, the field is typed as `any` with a comment explaining the intended type.
**Consequences:** Plugin authors accessing `context.storage` must cast to `StorageBackend` themselves. This should be fixed by either extracting `StorageBackend` to a separate package or restructuring the type exports — tracked as a known rough edge.

---

## Extension points

| Extension point | Interface/type | How to register | Notes |
|----------------|---------------|----------------|-------|
| New transform plugin (new format pair or vendor override) | `TransformPlugin` (`@pie-qti/transform-types`) | `engine.use(plugin)` | Priority 500–999 for vendor overrides; 100–499 for normal plugins |
| Custom format detector | `FormatDetector` (`@pie-qti/transform-core`) | `engine.registerFormatDetector(detector)` | Higher `priority` value runs first |
| Custom workflow orchestrator | `WorkflowOrchestrator` (`@pie-qti/transform-types`) | Pass to `new TransformEngine(orchestrator, storage)` | Must implement full interface including `on/off` event subscription |
| Custom storage backend | `StorageBackend` (`@pie-qti/transform-types`) | `engine.setStorage(backend)` or constructor | Required for batch; optional for single transforms |
| Plugin lifecycle hooks | Optional methods on `TransformPlugin` | Implement `initialize`, `validate`, `dispose` | Called by the engine at the appropriate lifecycle points |

---

## Data model / contracts

Key source files:
- `packages/types/src/transform/plugin.ts` — `TransformPlugin`, `TransformInput`, `TransformOutput`, `TransformContext`, `TransformFormat`, `ErrorCategory`, `TransformError`
- `packages/types/src/orchestration/orchestrator.ts` — `WorkflowOrchestrator`, `WorkflowHandle`, `WorkflowDefinition`, `Activity`, `WorkflowContext`, `ActivityContext`
- `packages/types/src/storage/index.ts` — `StorageBackend`
- `packages/core/src/registry/plugin-registry.ts` — `PluginRegistry`
- `packages/core/src/registry/format-detector-registry.ts` — `FormatDetector`, `FormatDetectorRegistry`
- `packages/core/src/engine/transform-engine.ts` — `TransformEngine`, `TransformOptions`
- `packages/core/src/orchestration/in-memory-orchestrator.ts` — `InMemoryOrchestrator`
- `packages/core/src/orchestration/workflows/transform-item-workflow.ts` — `TransformItemWorkflow`

**Invariants not obvious from the types:**

- A plugin's `id` must be globally unique across all registered plugins. `PluginRegistry.register` throws if a duplicate `id` is inserted.
- `TransformOutput.items` is always an array, even for single-item transforms. Consumers must index `result.items[0]`.
- `TransformOutputItem.format` is the format of that specific item — it may differ from `TransformOutput.format` in edge cases where a plugin produces mixed outputs (not currently used, but the contract allows it).
- `ErrorCategory.VALIDATION` errors represent caller-fixable input problems. `ErrorCategory.INTERNAL` errors represent bugs. This distinction is intended to route errors to the right team (user-facing message vs. ops alert).
- `WorkflowHandle.result()` resolves to the workflow output on success and rejects with an `Error` on failure. It does not return an error-union type.
- `InMemoryOrchestrator.shutdown()` awaits all running workflows via `Promise.allSettled` — it will not reject even if workflows are failing.
- The default retry policy on `InMemoryOrchestrator` is 3 attempts with 1 second initial interval, 30 second max, coefficient 2 (exponential backoff).

---

## Acceptance criteria

### Functional

```
AC-1: Single-item transform, format auto-detected
  Given: A TransformEngine with QtiToPiePlugin registered and no sourceFormat specified
  When: engine.transform(qtiXml, { targetFormat: 'pie' }) is called with valid QTI 2.2 XML
  Then: The returned WorkflowHandle resolves to a TransformItemOutput with pieConfig populated
        and metadata.sourceFormat === 'qti22'
  Notes: QtiDetector must detect the namespace; PieDetector must not match XML strings.

AC-2: Plugin priority — vendor plugin overrides standard plugin
  Given: TransformEngine with QtiToPiePlugin (priority 100) and VendorPlugin (priority 500)
         both registered for qti22→pie
  When: engine.transform(content, { targetFormat: 'pie' }) is called
  Then: VendorPlugin.transform is called, not QtiToPiePlugin.transform
  Notes: Verify via spy or mock on both plugins.

AC-3: Unknown format throws before starting workflow
  Given: TransformEngine with no plugins registered
  When: engine.transform(content, { targetFormat: 'pie' }) is called
  Then: The promise rejects with an Error containing 'No plugin found for transformation'

AC-4: Batch transform requires storage
  Given: TransformEngine with no storage set
  When: engine.transformBatch([item1, item2], { targetFormat: 'pie' }) is called
  Then: The promise rejects with an Error containing 'Storage backend required for batch transformation'

AC-5: Plugin initialize is called once
  Given: A plugin with an initialize method
  When: engine.transform is called
  Then: plugin.initialize is called exactly once with the TransformOptions
  Notes: On second call with the same engine instance, initialize is called again
         (engine does not cache initialization state — this is intentional, plugins
          may want to re-initialize with different options).

AC-6: dispose cleans up all plugins and orchestrator
  Given: An engine with two plugins registered, both having dispose methods
  When: engine.dispose() is called
  Then: Both plugin.dispose() methods are called; orchestrator.shutdown() is called;
        engine.getPlugins() returns an empty array afterward.

AC-7: Custom format detector participates in detection
  Given: TransformEngine with a custom detector registered that matches content returning 'myformat'
         and a plugin registered for myformat→pie
  When: engine.transform(content, { targetFormat: 'pie' }) is called with content the custom detector matches
  Then: The plugin is selected and the transform completes successfully.

AC-8: WorkflowHandle.progress() returns current step during execution
  Given: A long-running transform plugin (simulated with a delay)
  When: engine.transform returns the handle and progress() is queried mid-execution
  Then: progress() returns a non-null WorkflowProgress with currentStep set to a non-empty string
        and percentage between 0 and 100 exclusive.
```

### Edge cases

```
AC-E1: Duplicate plugin id throws on registration
  Given: A TransformEngine
  When: engine.use(pluginA) is called twice with plugins sharing the same id
  Then: The second call throws with 'already registered'

AC-E2: Format detection failure is a clean error
  Given: Content that matches no registered detector and no sourceFormat provided
  When: engine.transform(content, { targetFormat: 'pie' }) is called
  Then: The promise rejects with 'Could not detect input format'

AC-E3: Detector error is swallowed, detection continues
  Given: Two detectors: first throws during detect(), second returns 'qti22'
  When: detectFormat is called
  Then: The second detector's result is used; a console.warn is emitted about the first detector failing.

AC-E4: Batch transform default concurrency is 5
  Given: A batch of 10 items and storage set
  When: transformBatch is called without a parallel option
  Then: BatchTransformWorkflow receives maxConcurrent=5 in its input.
```

---

## Open questions

- [ ] Should `PluginRegistry.findPlugin` implement a full `canHandle` cascade as documented in `TRANSFORMATION-ENGINE.md`, or is the current static-priority behavior (return first by priority, no cascade) the intended long-term design? The documentation and implementation diverge — one of them must be updated.
- [ ] `TransformContext.storage` typed as `any` should be resolved. Preferred fix: move `StorageBackend` to its own package (`@pie-qti/storage-types`) so both `transform-types` and downstream can depend on it without circularity.
- [ ] `InMemoryOrchestrator.sleep()` uses `setTimeout`, which is not deterministic in Temporal-style workflow engines. If this code is ever ported to Temporal, `sleep` must be replaced with `workflow.sleep`. Add a code comment.

---

## Related

- QTI spec: http://www.imsglobal.org/question/qtiv2p2/imsqti_v2p2.html
- Implementation: `packages/core/src/`, `packages/types/src/`
- Adjacent PRDs: `architecture/qti-to-pie.md`, `architecture/pie-to-qti.md`, `architecture/storage.md`
- Existing docs: `docs/TRANSFORMATION-ENGINE.md`, `docs/PIE-QTI-TRANSFORMATION-GUIDE.md`, `docs/VENDOR-TRANSFORM-PLUGIN-GUIDE.md`
