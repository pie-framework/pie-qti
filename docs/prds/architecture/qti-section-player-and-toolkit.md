# PRD: QTI Section Player and Assessment Toolkit

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/section-player, @pie-qti/assessment-toolkit, @pie-qti/assessment-player, @pie-qti/item-player, @pie-qti/ims-cp-core, @pie-qti/player-elements, @pie-qti/web-component-loaders
  Last reviewed: 2026-06-24
-->

**Status:** draft
**Type:** architecture
**Packages:** `@pie-qti/section-player`, `@pie-qti/assessment-toolkit`, `@pie-qti/assessment-player`, `@pie-qti/item-player`, `@pie-qti/ims-cp-core`, `@pie-qti/player-elements`, `@pie-qti/web-component-loaders`
**Last reviewed:** 2026-06-24

---

## Summary

The QTI section player is the render and composition layer for one active item within a QTI section, or one section-like preview slice, above `@pie-qti/item-player` and below `@pie-qti/assessment-player`. It normalizes QTI 2.1 shared passages, QTI 2.2/3.0 stimulus resources, section/testPart rubric blocks, catalogs, package-relative assets, per-item delivery contexts, and active-item navigation into a neutral section render contract. The companion QTI assessment toolkit is a thin QTI-facing coordination layer for role/view and shared-context semantics that need QTI ownership while avoiding generic `pie-players` projection vocabulary.

---

## Background and rationale

`@pie-qti/item-player` correctly owns single `assessmentItem` rendering. It already handles item-body extraction, item-level rubrics, response deltas, scoring state, PNP/catalog inputs, QTI 3 stimulus delivery context, and item HTML sanitization. It should not grow section, testPart, package, or Composer preview responsibilities.

`@pie-qti/assessment-player` currently owns full-assessment orchestration and also owns section-adjacent layout details inside its Svelte shell. `AssessmentShell.svelte` separates passage rubric blocks from other rubric blocks and chooses split-pane versus vertical layout. `RubricDisplay.svelte` and `TestFeedback.svelte` render shared HTML directly. That has worked for the current assessment shell, but it makes section composition hard to reuse in Composer's QTI preview and creates a security boundary that differs from the item player.

The new section player should extract the reusable section/page composition concept without importing `@pie-qti/assessment-player` backend contracts. `@pie-qti/assessment-player` remains the full-assessment orchestration layer; it adapts its `SecureAssessment` and `SecureSection` data into the neutral section contract and delegates active-section rendering. Composer can later build the same neutral contract server-side from manifest data, `assessmentTest` XML, package files, item XML, package-relative asset URLs, diagnostics, and item-only fallback state.

The toolkit strategy is QTI-native thin reuse. `pie-qti` should not duplicate `pie-players` projection, lifecycle, tool, readiness, session, or score vocabulary. It should import or align with accepted stable `pie-players` contracts where they exist, use QTI-specific contracts where QTI semantics are the source of truth, and clearly label draft or deferred alignment.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, QTI 2.2, and QTI 3.0.
- **Spec section(s):** `assessmentTest`, `testPart`, `assessmentSection`, `assessmentItemRef`, `assessmentStimulus`, `rubricBlock`, catalogs, PNP, navigation mode, submission mode, and item session lifecycle.
- **Supported attributes:** section and item identifiers, section/testPart role or view constraints, navigation mode, submission mode, ordered item references, item source hrefs, section/testPart/item rubric blocks, QTI 2.1 passage-like auxiliary assets, QTI 3 assessment stimulus references, stylesheets, catalogs, and package-relative asset hrefs.
- **Deliberately omitted attributes:** adaptive selection, branch rules, preconditions, time limits, and full simultaneous submission orchestration are not v1 section-player layout responsibilities. They remain owned by the full assessment orchestration layer until a later PRD defines a section runtime model for them.
- **Known divergences from spec:** the v1 section player targets active-item rendering parity with the current assessment shell. It does not initially mean "render every item in a section at once." Multi-item-in-view section rendering is future work and must not be implied by the initial package name.

QTI 2.1 shared passages and QTI 3.0 stimuli enter the render model through different source constructs. QTI 2.1 packages often provide passage-like content through section rubric blocks or auxiliary item/package assets. QTI 3.0 provides first-class `assessmentStimulus` resources that can carry body HTML, stylesheets, and catalog info. The section player must normalize both into `QtiSharedContext` before selecting a layout.

---

## Functional requirements

- **FR-1:** `@pie-qti/section-player` MUST define the neutral section input contracts before UI component scaffolding.
- **FR-2:** `QtiSectionModel` MUST include section identity, title, role/view, layout preference, navigation mode, submission mode, ordered item refs, and diagnostics.
- **FR-3:** `QtiSectionItemRef` MUST include item identifier, source path or href, title, `itemXml`, optional response/session snapshot, and optional per-item `ResolvedItemDeliveryContext` from `@pie-qti/ims-cp-core`.
- **FR-4:** `QtiSharedContext` MUST represent QTI 2.1 passage-like auxiliary assets, QTI 2.2/3.0 stimulus resources, section/testPart/item rubric blocks, test feedback, resolved stylesheets, catalog sources, package asset diagnostics, and role/view visibility.
- **FR-5:** `ResolvedQtiSectionComposition` MUST be the normalized render input consumed by section layout components. Layout components should not parse assessment XML or content packages directly.
- **FR-6:** The section player MUST expose resolver hooks for package-relative URL resolution, raw package file loading, HTML/stimulus sanitization, and asset URL policy decisions.
- **FR-7:** The section player MUST expose host events or callbacks for response deltas, active item changes, section snapshot changes, readiness/lifecycle, and framework errors.
- **FR-8:** `@pie-qti/assessment-player` MUST adapt `SecureAssessment`, `SecureSection`, and current item navigation state into the neutral section contract without creating a dependency from `@pie-qti/section-player` back to `@pie-qti/assessment-player`.
- **FR-9:** `@pie-qti/assessment-player` MUST remain the full-assessment orchestration layer for backend sessions, navigation across sections, scoring, submission, persistence, and final results.
- **FR-10:** `@pie-qti/section-player` MUST compose `@pie-qti/item-player` instances or wrappers. It must not duplicate item extraction, item response processing, or item scoring behavior.
- **FR-11:** `@pie-qti/assessment-toolkit` MUST exist only for QTI-specific coordination that does not belong in the generic section player, such as QTI role/view mapping, PNP/catalog context, stimulus/rubric/passage normalization, security propagation, and lifecycle names aligned with stable `pie-players` contracts.
- **FR-12:** `@pie-qti/assessment-toolkit` MUST NOT define competing `pie-players` projection, tool, readiness, score, outcome, or session contracts. It may import accepted stable contracts from the owning `pie-players` package.
- **FR-13:** Browser consumers MUST be able to load the section custom elements without deep imports through `@pie-qti/player-elements` and `@pie-qti/web-component-loaders`.
- **FR-14:** The first public layout custom elements SHOULD be `pie-qti-section-player-splitpane` and `pie-qti-section-player-vertical`.
- **FR-15:** Composer migration MUST be planned as a follow-up that builds a server-side `QtiSectionPreviewContext` before replacing the current item-only QTI preview bridge.
- **FR-16:** Composer QTI preview MUST retain item-only fallback whenever no resolved section, passage, stimulus, or test context is available.

---

## Non-functional requirements

- **Accessibility:** Split-pane and vertical layouts must meet WCAG 2.2 AA. Keyboard resizing, focus movement after navigation, reading order, headings, live announcements, touch targets, and reduced-motion behavior must be testable. Shared passages and rubrics must remain reachable without trapping focus.
- **Performance:** Section normalization should be linear in the number of item refs and shared resources for the active section. Layout changes and response-only updates must not remount item players unnecessarily. Package file resolution should be cached by the host or resolver.
- **Cross-platform:** Layouts must work in desktop and mobile browsers. Split-pane layouts must provide a vertical fallback for narrow viewports and touch users.
- **Security:** QTI shared passage, rubric, stimulus, stylesheet, catalog, asset, and test-feedback content is untrusted input. Every shared-content HTML render sink must use the same sanitizer, URL policy, Trusted Types policy, and parsing limits as item rendering.
- **i18n:** Section navigation labels, passage headings, rubric labels, readiness text, framework errors, and diagnostics must use `@pie-qti/i18n` or host-provided localization rather than hard-coded user-facing strings.

---

## Design decisions

### Contract-first section rendering

**Decision:** Define `QtiSectionModel`, `QtiSectionItemRef`, `QtiSharedContext`, `ResolvedQtiSectionComposition`, resolver hooks, and event details before creating layout elements.
**Rationale:** Current assessment-player layout data is tied to backend contracts and Svelte shell state. A neutral contract allows the same section renderer to serve assessment-player and Composer preview without importing backend implementation types.
**Alternatives considered:** Extract current Svelte components first and retrofit contracts later.
**Consequences:** The initial implementation must spend time on types and adapter tests before visible UI extraction. That cost is intentional because package cycles would be harder to unwind later.

### Active-item parity first

**Decision:** The v1 section player renders one active item plus shared section context, matching current `@pie-qti/assessment-player` behavior.
**Rationale:** The current assessment shell already navigates one active item. Preserving that behavior reduces migration risk and lets section-player extraction focus on shared context, layout, security, and package boundaries.
**Alternatives considered:** Render every item in the section at once.
**Consequences:** The term "section player" must not be used to promise multi-item-in-view rendering until a later PRD accepts the runtime, scoring, focus, and performance implications.

### QTI-native thin reuse

**Decision:** `@pie-qti/assessment-toolkit` owns only QTI-specific semantics and consumes stable `pie-players` contracts where they are accepted.
**Rationale:** `pie-players` owns generic runtime and projection vocabulary. Duplicating those contracts in `pie-qti` would create drift and make QTI-specific requirements leak upstream.
**Alternatives considered:** Port the `pie-players` assessment toolkit into `pie-qti` with new type names.
**Consequences:** Some toolkit details must remain deferred until upstream contracts are stable. The PRD should name those deferrals rather than inventing replacement vocabulary.

### Public security boundary before renderer extraction

**Decision:** Before moving any shared HTML renderer into `@pie-qti/section-player`, expose a reusable QTI shared-content security surface. The initial implementation uses the public `@pie-qti/item-player/security` subpath; a package-neutral `@pie-qti/qti-security` extraction remains a possible future follow-up.
**Rationale:** `@pie-qti/item-player` has internal `sanitizeHtml`, `sanitizeResourceUrl`, parsing-limit, and Trusted Types utilities, while assessment-player shared HTML renderers currently use direct HTML sinks. Section-player extraction would otherwise preserve or spread that gap.
**Alternatives considered:** Keep section shared-content sanitization private to the section player.
**Consequences:** Section-player and assessment-player shared passage, rubric, stimulus, and test-feedback render sinks use the public item-player security surface instead of deep-importing item-player internals. The preferred long-term direction is still a package-neutral security surface so item-player and section-player cannot diverge.

### Assessment player adapts, section player renders

**Decision:** `@pie-qti/assessment-player` maps its backend-oriented model into the section contract and delegates active-section rendering.
**Rationale:** The assessment player already owns backend sessions, section navigation, submission, scoring, and final results. The section player should not know about `BackendAdapter`, `SecureAssessment`, or persistence.
**Alternatives considered:** Move assessment-player backend contracts into the section-player package.
**Consequences:** Adapter code remains in `@pie-qti/assessment-player` or a QTI toolkit helper. `@pie-qti/section-player` can be embedded by Composer without constructing a full assessment backend.

### Composer migration is server-context first

**Decision:** Composer must build `QtiSectionPreviewContext` on the server before switching the QTI tab from item-only preview to section preview.
**Rationale:** Composer's current QTI path resolves one item XML string. Section preview requires manifest resources, test XML, item-to-section mapping, package files, resolved item XML for each section item, package-relative asset URLs, and diagnostics.
**Alternatives considered:** Extend `QtiItemPreview.svelte` with client-side package fetches.
**Consequences:** Composer integration stays a follow-up outside this repo. This PRD defines the expected context and fallback behavior so Composer can migrate without reshaping `pie-qti` packages again.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
| ---------------- | --------------- | ------------ | --------- |
| Section input contract | `QtiSectionModel` | Hosts provide a neutral section model and ordered item refs | `assessment-player` maps `SecureSection` into `QtiSectionModel` |
| Item ref contract | `QtiSectionItemRef` | Provide per-item XML and optional delivery/session state | Composer resolves all sibling item XML for a selected section |
| Shared context contract | `QtiSharedContext` | Normalize passages, stimuli, rubrics, catalogs, stylesheets, feedback, and diagnostics | QTI 3 stimulus body and stylesheet refs become shared context entries |
| Composition resolver | `resolveQtiSectionComposition(...)` | Convert host/package inputs into layout-ready data | Assessment-player calls it after navigation state changes |
| Package resolver hooks | `QtiSectionRuntimeHostContract` | Resolve package-relative URLs and load raw files | Composer maps `href` values to raw-file API URLs |
| Security policy | QTI shared-content security API | Sanitize shared HTML and asset URLs before render sinks | Split-pane passage content uses the same URL allow/block policy as item bodies |
| Layout custom elements | `pie-qti-section-player-splitpane`, `pie-qti-section-player-vertical` | Embed section layouts without deep Svelte imports | Composer loads the split-pane CE when shared context exists |
| Lifecycle/error bridge | DOM events and callbacks | Surface readiness, active item changes, snapshots, and framework errors | Host listens for `framework-error` and section snapshot changes |

---

## Data model / contracts

The first implementation should define contracts close to the following shapes. Exact names may change during implementation, but any change must preserve the invariants listed here.

```ts
export type QtiSectionLayoutPreference = 'split-pane' | 'vertical' | 'auto';

export interface QtiSectionModel {
  identifier: string;
  title?: string;
  role?: 'candidate' | 'scorer' | 'author' | 'proctor' | 'tutor' | 'testConstructor';
  view?: string[];
  layoutPreference?: QtiSectionLayoutPreference;
  navigationMode?: 'linear' | 'nonlinear';
  submissionMode?: 'individual' | 'simultaneous';
  itemRefs: QtiSectionItemRef[];
  sharedContext?: QtiSharedContext;
  diagnostics?: QtiSectionDiagnostic[];
}
```

`QtiSectionModel` is host-facing. It describes what the section player may render, not how a full assessment backend stores state. Hosts may synthesize a section-like model for preview as long as diagnostics identify missing test/section semantics.

```ts
export interface QtiSectionItemRef {
  identifier: string;
  sourcePath?: string;
  href?: string;
  title?: string;
  itemXml: string;
  responses?: Record<string, unknown>;
  sessionSnapshot?: SerializedItemSessionState;
  deliveryContext?: ResolvedItemDeliveryContext;
  diagnostics?: QtiSectionDiagnostic[];
}
```

Each item ref can carry both `itemXml` and per-item `ResolvedItemDeliveryContext`. That context is the existing bridge for QTI 3 stimulus refs, stylesheets, catalog sources, media assets, and delivery-context validation messages. The section player must pass it through to `@pie-qti/item-player` instead of re-parsing QTI 3 stimulus XML.

```ts
export interface QtiSharedContext {
  passages: QtiSharedHtmlBlock[];
  stimuli: QtiSharedStimulus[];
  rubricBlocks: QtiSharedHtmlBlock[];
  testFeedback: QtiSharedHtmlBlock[];
  stylesheets: QtiResolvedStylesheetRef[];
  catalogSources: QtiResolvedCatalogSource[];
  assetDiagnostics: QtiSectionDiagnostic[];
}
```

Shared HTML blocks must carry source, scope, role/view, content kind, and sanitized HTML state. Raw HTML may exist only before the security boundary. Layout components must consume sanitized or Trusted Types-compatible content.

```ts
export interface ResolvedQtiSectionComposition {
  section: QtiSectionModel;
  activeItem: QtiSectionItemRef;
  activeItemIndex: number;
  sharedContext: QtiSharedContext;
  layout: 'split-pane' | 'vertical';
  canPrevious: boolean;
  canNext: boolean;
  snapshot: QtiSectionSnapshot;
  diagnostics: QtiSectionDiagnostic[];
}
```

`ResolvedQtiSectionComposition` is the layout-ready form. It is where role/view filtering, passage/stimulus grouping, layout selection, and diagnostics are resolved.

```ts
export interface QtiSectionRuntimeHostContract {
  resolvePackageUrl?(href: string, context: QtiPackageResolveContext): string | null;
  readPackageFile?(href: string, context: QtiPackageResolveContext): Promise<string | Uint8Array | null>;
  sanitizeSharedHtml?(html: string, context: QtiSharedHtmlSanitizeContext): string;
  sanitizeAssetUrl?(href: string, context: QtiAssetUrlPolicyContext): string | null;
  onResponseDelta?(event: QtiSectionResponseDeltaEvent): void;
  onActiveItemChange?(event: QtiSectionActiveItemChangeEvent): void;
  onSnapshotChange?(snapshot: QtiSectionSnapshot): void;
  onFrameworkError?(error: QtiSectionFrameworkError): void;
}
```

Lifecycle vocabulary should align with stable `pie-players` concepts where they are public and accepted. The section layout host should surface one canonical readiness/error channel for a section cohort, with `framework-error` for framework failures. QTI-specific response, active-item, and snapshot events may use `qti-section-*` names until an accepted cross-player projection contract exists.

### Composer preview context

Composer should build a server-side context before rendering the section player:

```ts
export interface QtiSectionPreviewContext {
  selectedItemId: string;
  selectedItemSourcePath?: string;
  assessmentTestXml?: string;
  section: QtiSectionModel;
  itemsByHref: Record<string, QtiSectionItemRef>;
  packageAssetBaseHref: string;
  diagnostics: QtiSectionDiagnostic[];
  itemOnlyFallback: {
    itemXml: string;
    sourceLabel?: string;
    sourcePath?: string;
  };
}
```

Composer must derive this from manifest resources, `assessmentTest` XML, package file reads, item source paths, QTI 2.1 item-relative passage assets, QTI 3 stimulus delivery context, package-relative asset URLs, optional qti-prime item XML, and diagnostics. If no usable section context exists, Composer should render the existing item-only preview.

---

## Implementation plan

### Phase 0: Define contracts before package scaffolding

- Create contract files for `QtiSectionModel`, `QtiSectionItemRef`, `QtiSharedContext`, `ResolvedQtiSectionComposition`, section diagnostics, resolver hooks, snapshot events, active item events, and framework errors.
- Add tests that assert `QtiSectionItemRef.deliveryContext` accepts `ResolvedItemDeliveryContext` from `@pie-qti/ims-cp-core`.
- Define the assessment-player adapter boundary without importing `assessment-player` types into `section-player`.

### Phase 1: Expose shared-content security

- Add a public reusable security surface before moving shared renderers.
- Reuse or extract `PlayerSecurityConfig`, `UrlPolicyConfig`, parsing limits, Trusted Types policy handling, `sanitizeHtml`, and `sanitizeResourceUrl`.
- Add malicious-content fixtures for script tags, event handler attributes, `srcdoc`, blocked URL schemes, nested passage assets, stimulus stylesheets, and split-pane/vertical variants.
- Update `architecture/security.md` when the public security API is implemented.

### Phase 2: Scaffold `@pie-qti/section-player`

- Add `packages/section-player/package.json`.
- Add `packages/section-player/src/index.ts`.
- Add `packages/section-player/src/contracts/layout-contract.ts`.
- Add `packages/section-player/src/contracts/runtime-host-contract.ts`.
- Add split-pane and vertical Svelte layout components after the contracts and security API exist.
- Keep layout components XML-agnostic; they consume `ResolvedQtiSectionComposition`.

### Phase 3: Extract reusable section UI

- Move or share `SplitPaneResizer.svelte`, `RubricDisplay.svelte`, `ItemRenderer.svelte`, and related accessibility/focus behavior from `@pie-qti/assessment-player`.
- Preserve assessment-player behavior first.
- Sanitize every shared passage/rubric/stimulus/test-feedback render sink before using HTML rendering.

### Phase 4: Introduce QTI assessment toolkit contracts

- Add `@pie-qti/assessment-toolkit` only where QTI-specific coordination is needed.
- Include QTI role/view mapping, PNP/catalog context, stimulus/rubric/passage normalization, security propagation, and lifecycle/error alignment.
- Import stable `pie-players` contracts only from stable public paths. Do not depend on `runtime/internal` symbols or draft projection exports.

### Phase 5: Delegate assessment-player section rendering

- Keep `packages/assessment-player/src/core/AssessmentPlayer.ts` as the full-assessment orchestration layer.
- Adapt current navigation state, current item, current rubric blocks, responses, section metadata, and per-item delivery context into `ResolvedQtiSectionComposition`.
- Replace split-pane/rubric/item rendering in `AssessmentShell.svelte` with the section player while preserving navigation, focus, i18n, typeset, security, PNP, and submission behavior.

### Phase 6: Expose browser entrypoints

- Add section custom element registration to `packages/player-elements/src/constants.ts`, `packages/player-elements/src/define.ts`, `packages/player-elements/src/index.ts`, and the relevant element wrapper files.
- Update `packages/web-component-loaders/src/index.ts` and `packages/web-component-loaders/README.md` so hosts can load section player custom elements without deep imports.
- Add demo routes in `apps/demo` that exercise the initial split-pane section-with-passage custom element and the vertical active-item custom element. QTI 3 stimulus and malicious shared-content demo cases remain follow-up coverage beyond the initial browser entrypoint smoke tests.

### Phase 7: Plan Composer integration

- Add a Composer server resolver for `QtiSectionPreviewContext`.
- Parse test XML to locate the selected item's containing section when possible.
- Resolve all section item XML, not only the selected item.
- Preserve qti-prime item override behavior while defining diagnostics for missing qti-prime test shells.
- Render the section player when shared section context exists; otherwise retain `QtiItemPreview.svelte` item-only fallback.

### Phase 8: Test in layers

- Contract tests for section model normalization and CE exports.
- Unit tests for QTI 2.1 passage normalization and QTI 3 stimulus/catalog/style delivery context pass-through.
- Security tests for shared HTML sanitization in split-pane and vertical layouts.
- Component tests for split-pane keyboard resizing, focus management, mobile vertical fallback, and role/view filtering.
- Regression tests proving `@pie-qti/assessment-player` still renders current passages, rubrics, item players, navigation, and test feedback through the new section player.
- Demo-backed Playwright coverage in `apps/demo`.
- Composer follow-up tests for item-to-section resolution, multi-test ambiguity diagnostics, package-relative asset URLs, and item-only fallback.

---

## Acceptance criteria

### Functional

- **AC-1:** Given the planned section player package, when its public contracts are reviewed, then `QtiSectionModel`, `QtiSectionItemRef`, `QtiSharedContext`, and `ResolvedQtiSectionComposition` are defined before layout components depend on them.
- **AC-2:** Given a section item ref with QTI 3 stimulus refs, when the section composition is resolved, then the per-item `ResolvedItemDeliveryContext` is passed through to `@pie-qti/item-player` without re-parsing or discarding stylesheets and catalog sources.
- **AC-3:** Given QTI 2.1 passage-like content from section rubric blocks or package assets, when the section composition is resolved, then it appears in `QtiSharedContext.passages` with source diagnostics and role/view visibility.
- **AC-4:** Given current `@pie-qti/assessment-player` active-item navigation, when it is adapted to the section player, then the same active item, current responses, passage split-pane state, non-passage rubrics, and navigation controls remain visible.
- **AC-5:** Given a section player implementation, when `@pie-qti/assessment-player` consumes it, then `@pie-qti/section-player` does not import `BackendAdapter`, `SecureAssessment`, or `SecureSection`.
- **AC-6:** Given browser hosts importing `@pie-qti/web-component-loaders`, when player elements are loaded, then `pie-qti-section-player-splitpane` and `pie-qti-section-player-vertical` can be registered without deep Svelte imports.
- **AC-7:** Given Composer has only an item XML string and no usable section context, when the QTI preview tab renders, then it uses the existing item-only fallback behavior.
- **AC-8:** Given Composer has manifest data, test XML, package files, and item XML for a selected item inside a section, when `QtiSectionPreviewContext` is built, then it includes section metadata, ordered item refs, resolved item XML, package-relative asset URLs, shared context, and diagnostics.

### Accessibility

- **AC-A1:** Given a split-pane section with passage content, when a keyboard user focuses the resizer, then arrow-key resizing works, focus remains visible, and the reading order is still passage before active item.
- **AC-A2:** Given a mobile viewport or touch-only device, when a section with shared passage content renders, then the layout falls back to a vertical flow with touch targets of at least 44 by 44 CSS pixels for interactive controls.
- **AC-A3:** Given active-item navigation changes, when the next or previous item becomes active, then focus and live announcements match the existing assessment-player behavior.
- **AC-A4:** Given role-filtered rubric blocks, when the section renders for candidate role, then scorer/proctor-only content is not exposed to screen readers or visible layout.

### Security

- **AC-S1:** Given shared passage, rubric, stimulus, or test-feedback HTML containing `<script>`, event handler attributes, `srcdoc`, or blocked URL schemes, when the section renders it, then unsafe content is removed or neutralized before reaching any HTML render sink.
- **AC-S2:** Given item-player and section-player use the same `PlayerSecurityConfig`, when the host blocks an asset URL scheme, then both item content and shared section content enforce the same URL decision.
- **AC-S3:** Given Trusted Types are enabled by the host CSP and configured by security policy, when shared HTML is rendered, then section-player uses the shared Trusted Types handling rather than assigning unsanitized strings.

### Edge cases

- **AC-E1:** Given a selected item appears in multiple test sections, when Composer builds `QtiSectionPreviewContext`, then it chooses a deterministic section or reports an ambiguity diagnostic while preserving item-only fallback.
- **AC-E2:** Given a section references an item whose XML cannot be loaded, when section composition resolves, then diagnostics identify the missing item and the host can still render available item-only fallback if configured.
- **AC-E3:** Given upstream `pie-players` projection contracts remain draft, when `@pie-qti/assessment-toolkit` is implemented, then it does not define final-looking replacement projection types in `pie-qti`.
- **AC-E4:** Given a simultaneous-submission assessment, when the v1 active-item section player renders it, then scoring/submission behavior remains owned by `@pie-qti/assessment-player` and is not reinterpreted by the section layout.

---

## Open questions

- [ ] When should the initial public `@pie-qti/item-player/security` subpath be extracted into a package-neutral `@pie-qti/qti-security` package, if ever?
- [ ] Which `pie-players` contracts are stable enough for `@pie-qti/assessment-toolkit` v1, and which should remain documented as deferred alignment?
- [ ] Which future standalone section-player demos should cover QTI 3 stimulus resources, malicious shared-content fixtures, and synthetic multi-item sections after the active-item-only baseline is accepted?
- [ ] How should Composer choose between source `assessmentTest` XML and qti-prime-transformed artifacts if qti-prime later emits a transformed test shell?
- [ ] Should Composer section preview load package archives for every QTI-preview-visible status, or only when a lighter test/section resolver confirms section context is needed?

---

## Related

- QTI spec: IMS QTI 2.1, QTI 2.2, and QTI 3.0 assessment test, section, item reference, rubric, stimulus, catalog, navigation, and submission constructs.
- Existing docs: `docs/ARCHITECTURE.md`, `docs/prds/architecture/assessment-player.md`, `docs/prds/architecture/item-player.md`, `docs/prds/architecture/security.md`, `docs/prds/architecture/web-components.md`, `docs/prds/architecture/ims-content-packages.md`.
- Adjacent PRDs: `docs/prds/architecture/pie-projection-adapters.md`.
- Current assessment-player implementation: `packages/assessment-player/src/components/AssessmentShell.svelte`, `packages/assessment-player/src/components/SplitPaneResizer.svelte`, `packages/assessment-player/src/components/RubricDisplay.svelte`, `packages/assessment-player/src/components/ItemRenderer.svelte`, `packages/assessment-player/src/components/TestFeedback.svelte`, `packages/assessment-player/src/core/AssessmentPlayer.ts`, `packages/assessment-player/src/integration/api-contract.ts`, `packages/assessment-player/src/integration/ReferenceBackendAdapter.ts`.
- Current item/security implementation: `packages/item-player/src/core/sanitizer.ts`, `packages/item-player/src/core/urlPolicy.ts`, `packages/item-player/src/core/trustedTypes.ts`, `packages/item-player/src/core/parsingLimits.ts`, `packages/item-player/src/types/index.ts`.
- Current shared-content implementation: `packages/ims-cp-core/src/qti3-shared-content.ts`, `packages/ims-cp-core/src/package-file-resolver.ts`.
- Browser entrypoints: `packages/player-elements/src/index.ts`, `packages/player-elements/src/define.ts`, `packages/player-elements/src/constants.ts`, `packages/web-component-loaders/src/index.ts`, `packages/web-component-loaders/README.md`.
- `pie-players` references: `../pie-players/packages/section-player/ARCHITECTURE.md`, `../pie-players/packages/assessment-toolkit/README.md`.
- Composer follow-up references: `../kds/composer/apps/composer/src/lib/components/qti/QtiItemPreview.svelte`, `../kds/composer/apps/composer/src/routes/(protected)/explore/qti/[runId]/packages/[packageId]/preview/+page.svelte`, `../kds/composer/apps/composer/src/lib/server/qti-preview-resolution.ts`, `../kds/composer/apps/composer/src/lib/server/qti-explore-files.ts`.
