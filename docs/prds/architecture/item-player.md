# PRD: QTI Item Player

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

`@pie-qti/item-player` is the core rendering and scoring engine for one QTI `assessmentItem`. Its interface is `createAssessmentItemDefinition(config)`, which captures immutable XML and delivery configuration, followed by `definition.openSession(options)`, which creates the one authoritative mutable `ItemSession` for an attempt. The session accepts domain commands, exposes immutable state/transition views and a render-neutral presentation, and can serialize state for persistence or later restoration. Browser, assessment, standalone custom-element, and DOM-free server paths all use this ownership model.

---

## Background and rationale

### Why framework-agnostic

When the player was designed, the default interactions were authored in Svelte 5, but potential integrators include React apps, Angular apps, plain JS shells, and server-rendered pages. Coupling the core engine to Svelte would make all of those impossible without forking. The solution is a layered module boundary: (1) an immutable assessment-item definition owns source and configuration; (2) one live `ItemSession` owns all mutable QTI variables and processing; (3) extraction produces typed, frozen `InteractionData`; and (4) presentation produces a render-neutral `ItemPresentation` consumed by Svelte or another adapter. Extractor implementations and contracts remain in `packages/item-player/src/interactions/<interaction>/`; `packages/item-player/src/interactions/modules.ts` catalogs each standard `InteractionModule` with its extractor, placement, and delivery-field classification. Svelte builds the default web components, but the core session has no Svelte dependency.

### Why definition and session are separate

The item XML, plugin set, security policy, and processing configuration are definition-lifetime inputs; responses, outcomes, attempts, duration, and lifecycle status are session-lifetime state. `createAssessmentItemDefinition()` snapshots the former, and `openSession()` creates the latter. An active item has exactly one live session. Assessment-player, section composition, and the item renderer all reach that same object rather than synchronizing mutable copies. `serialize()` returns a `SerializedItemSessionState` handoff value; restoration creates a new live session after validating the item identifier. Serialized state is never a second live authority.

### Why web components as the rendering contract

The browser adapter communicates with interaction UIs via three mechanisms: element creation by tag name, property assignment for presentation data, and the bubbling `qti-change` CustomEvent for response mutations. The event is translated into an `ItemSession.dispatch(...)` command; components do not own response state. This is intentionally the narrowest browser seam. Web components are the cross-framework rendering primitive, while `ItemSession` remains equally usable by a headless adapter.

The consequence is that the `ComponentRegistry` maps `InteractionData` to a tag name, not to a component constructor. The core never imports any component class. This means a vendor that wants to replace the default `choiceInteraction` renderer only needs to register a tag name at priority > 0 and ensure the custom element is defined before the item is rendered.

### Why iframe isolation is opt-in

Iframe isolation adds meaningful complexity: a versioned postMessage protocol, a host helper, and an integrator-owned runtime page. For the common case — trusted QTI authored in-house or from a known vendor — that complexity has no payoff. Forcing isolation on all deployments would be paternalistic and would break patterns like same-DOM typesetting, custom scrolling behavior, and CSS theming through the host document.

The player instead ships conservative same-DOM guardrails by default (HTML sanitization, URL policy, `<object>`/`<iframe>` disabled) and provides iframe mode as `@pie-qti/item-player/iframe`, a separate entry point that avoids any runtime cost when not used. The security model PRD (`docs/prds/architecture/security.md`) documents the residual risk of same-DOM embedding and makes clear that origin isolation is the only complete mitigation for untrusted third-party QTI.

### Why the AST response processor

The `@pie-qti/qti-processing` package compiles `<responseProcessing>`, `<outcomeProcessing>`, and `<templateProcessing>` XML into a typed AST during definition construction (`buildResponseProcessingAst`, `buildOutcomeProcessingAst`, `buildTemplateProcessingAst`). Sessions share those immutable programs and execute them through `execProgram`.

Two alternatives were rejected: (1) interpreting the XML nodes directly on each scoring call — this re-traverses the DOM every time and makes it impossible to serialize or cache the program; (2) generating JavaScript via `eval`/`new Function` — this violates strict CSP and introduces code injection risk. The AST approach produces a serializable, inspectable program that can be executed multiple times without re-parsing and supports all 45 QTI operators without eval.

The `customOperators` key in `AssessmentItemDefinitionConfig` is the escape hatch for QTI `<customOperator>` elements. Implementations are registered by operator `class` attribute (preferred) or `definition` URI and run synchronously inside `execProgram`. Because custom operators run inside the scoring engine, they are treated as integrator-trusted code — the player does not sandbox them.

### Why conservative security defaults

The player defaults to blocking `<object>`, `<embed>`, and `<iframe>` elements, stripping all `on*` event handlers case-insensitively, and blocking protocol-relative URLs. These were not always the defaults: the security audit (commit `a87ca31`) identified real XSS bypass classes in earlier versions including mixed-case `onClick`, `iframe[srcdoc]`, and SVG `xlink:href`. The lesson was that "reasonable" sanitizer defaults are routinely insufficient for attacker-controlled HTML. The current defaults are conservative because the cost of being too strict is a logged warning and a visible gap; the cost of being too permissive is XSS in a product used by K-12 students.

Parsing limits (`ParsingLimitsConfig`) are opt-in rather than default because they impose hard limits that could break large legitimate items. When rendering content from known-safe authors, the limits add no value and risk false-positive failures. For untrusted deployments, enabling `security.parsingLimits` is strongly recommended in addition to origin isolation.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, QTI 2.2, QTI 3.0; QTI 2.2 is the primary edition for section references
- **Spec sections:** QTI 2.2 §4 (assessmentItem), §5 (interactions), §6 (response processing), §7 (outcome processing), §8 (template processing), §9 (adaptive items), §13 (view/rubric)
- **Supported attributes:** `adaptive`, `timeDependent` (tracked), `view` (rubricBlock filtering), all `responseDeclaration`/`outcomeDeclaration`/`templateDeclaration` attributes including `defaultValue`, `correctResponse`, `mapping`, `areaMapping`, `matchTable`, `interpolationTable`
- **Deliberately omitted attributes:** `timeDependent` does not gate submission (the player has no built-in timer; time tracking is the assessment shell's responsibility)
- **Known divergences from spec:**
  - QTI 3.0 element names (`qti-choice-interaction`, etc.) and attribute names (`response-identifier`) are automatically detected and normalized at construction time via `ElementNameMapper`/`AttributeNameMapper`; they do not require explicit configuration.
  - `completionStatus` and `numAttempts` are injected as built-in outcome declarations if absent — the spec technically requires items to declare them explicitly; in practice, many authored items omit the declaration.

---

## Functional requirements

- **FR-1:** `createAssessmentItemDefinition(config)` must validate non-empty item XML and an assessment-item identifier, snapshot definition-lifetime configuration, and return an immutable `AssessmentItemDefinition`.
- **FR-2:** `AssessmentItemDefinition.openSession({ restore, responses, activate })` must create a
  distinct live `ItemSession`; restoration must reject serialized state for a different item
  identifier, response overrides must be applied after restoration, and `activate: true` must resume a
  suspended handoff as an active session.
- **FR-3:** `ItemSession.dispatch({ action: 'setResponse' | 'setResponses', ... })` must coerce values to the declared `baseType` and `cardinality`, update the session revision, and notify subscribers with immutable previous/current views.
- **FR-4:** Response, outcome, template, context, attempt, duration, and lifecycle mutation must be reachable only through the live session. `state()` and transition views are immutable projections.
- **FR-5:** `ItemSession.serialize()` must return immutable `SerializedItemSessionState` suitable for handoff, persistence, and `openSession({ restore })`; callers must not use it to synchronize a second live runtime.
- **FR-6:** Response processing must reset outcome variables to their declared defaults before each run. Template processing must execute after declarations are built and before initial responses are applied.
- **FR-7:** For adaptive items, `dispatch({ action: 'submitAttempt' })` must increment `numAttempts` before response processing so expressions observe the current attempt.
- **FR-8:** `ItemSession.present()` must return a render-neutral `ItemPresentation` derived from the
  current session view, with the definition-fixed role policy applied before correct responses reach
  renderers. Callers cannot override role at presentation time. Direct role-visible item rubrics must
  be exposed as `presentation.directRubrics`, separate from the item-body flow and shared section
  rubrics.
- **FR-9:** Presentation must apply stimulus injection, rubric filtering, feedback expansion, inline planning, and interaction placement before the final body sanitation and optional `TrustedHTML` creation. Policy-checked scoped stylesheet text must remain a separate `scopedCss` field.
- **FR-10:** The package must not publish the private session engine. The root and DOM-free server entries expose definitions, sessions, and command/result contracts.

---

## Non-functional requirements

- **Accessibility:** The definition and session modules produce no DOM. Accessibility behavior lives in the presentation/browser adapters and default interaction components. Role capabilities in `ItemPresentation` determine readonly and correct-response exposure.
- **Performance:** Processing ASTs and sealed interaction registries are compiled once per `AssessmentItemDefinition`. The document's extraction representation is lazy, while each session memoizes and freezes its delivered `InteractionData`; repeat presentation must not reparse or re-extract stable interaction data. Restoration opens a new session over the compiled definition and computes delivery against the restored shuffle identity.
- **Cross-platform:** `AssessmentItemDefinition` and `ItemSession` are framework-agnostic and usable in browsers, Node.js, Bun, and Deno. Only iframe and custom-element adapters require browser APIs.
- **Security:** Rich markup is sanitized when extractor helpers ingest it. Each `InteractionModule` classifies its own HTML and URL delivery fields, and the common delivery pipeline applies the configured sanitizer/URL policy before freezing the output and minting `TrustedHTML` at its final egress. Only the re-sanitized value produced after all body transforms is final presentation `TrustedHTML`. Scoped CSS is policy-checked and transported separately.
- **i18n:** Definitions accept an optional `i18nProvider` from `@pie-qti/i18n`. When absent, a minimal provider returns translation keys as-is.

---

## Design decisions

### Immutable definition and one live session

**Decision:** `AssessmentItemDefinition` owns immutable item inputs; `openSession()` creates the only mutable authority for an attempt. Browser adapters may receive that exact session, but they may not replace it with response snapshots.
**Rationale:** XML/configuration and candidate state have different lifetimes. A narrow command/state/presentation interface keeps extraction, rendering, and assessment orchestration from reaching mutable declaration internals.
**Alternatives considered:** Sharing the private engine, maintaining parallel runtime instances, or synchronizing response maps between assessment and item renderers.
**Consequences:** Navigation serializes and disposes the outgoing live session, then restores a new session when needed.

### `AssessmentItemDocument` hides parser representations

**Decision:** Parsing and traversal are owned by the internal `AssessmentItemDocument` module. Public definition/session interfaces expose no DOM, XPath, `node-html-parser`, or XML-parser node types. Its extraction representation is built lazily and interaction delivery is memoized at session scope.
**Rationale:** Parser choice is an implementation detail with no demonstrated host-side variability. Hiding it creates a deeper module and prevents parser-specific types from becoming a permanent public seam.
**Alternatives considered:** A public parser adapter or exposing raw parser nodes to plugins. Rejected because neither corresponds to a required deployment variation.
**Consequences:** Extractors use the configured `ExtractionContext` helpers. Changing parser internals does not change the definition/session API, and callers do not need to cache interaction data themselves.

### Presentation is the final HTML trust boundary

**Decision:** `ItemSession.present()` captures session data, performs every body transform, sanitizes the result, and only then optionally creates the final presentation `TrustedHTML`. Resolved stylesheet CSS remains separate from the HTML graph.
**Rationale:** Stimulus injection, rubric replacement, feedback expansion, and inline-interaction planning can all change strings after initial parsing. Trusting an earlier string would make later transforms bypass the guarantee. CSS also has a different policy and sink from HTML.
**Alternatives considered:** Minting `TrustedHTML` during parsing or concatenating scoped `<style>` markup into the body string.
**Consequences:** Browser sinks consume branded final body nodes and `scopedCss`; headless consumers can inspect the same render-neutral presentation without a DOM.

### Outcome variables reset to defaults on every processResponses() call

**Decision:** `resetOutcomesToDefault()` is called at the start of every `processResponses()` invocation, with explicit exceptions for `numAttempts` and `completionStatus`.  
**Rationale:** This is the QTI 2.2 spec behavior (§6.3): outcome processing "defines the rules for setting the outcome variables" and implicitly assumes a fresh start for non-session-tracking variables. Without this reset, a previous scoring run's partial outcomes can leak into the next. For example, if a `<setOutcomeValue>` is inside a `<responseIf>` branch that is not taken on the second attempt, the value from the first attempt would persist. The two exceptions (`numAttempts`, `completionStatus`) are session-tracking variables that accumulate across attempts by design.  
**Alternatives considered:** Not resetting (simpler, but violates spec and causes stale-outcome bugs); resetting all variables including `numAttempts`/`completionStatus` (would break adaptive item attempt counting).  
**Consequences:** Any outcome variable not explicitly set by the response processing program will revert to its declared default on every scoring call. This is correct per spec but occasionally surprises integrators who set outcomes externally and expect them to survive a scoring run.

### Security defaults are opt-in to relax, not opt-in to enforce

**Decision:** All security guardrails (sanitizer, URL policy, no embeds) are on by default. Relaxations (allow HTTP URLs, allow `<object>`, allow specific hosts) require explicit `PlayerSecurityConfig` fields.  
**Rationale:** The default deployment surface is a browser rendering content from a CMS. Content authors are not adversaries, but they can be compromised, and QTI content may be imported from third parties. Opt-in enforcement would mean that most deployments — which never explicitly configure security — would run with no guardrails. Opt-in relaxation means a deployment that needs `<object>` for media must consciously acknowledge the risk.  
**Alternatives considered:** Separate "strict" and "lenient" security modes (adds complexity with no benefit over the current defaults).  
**Consequences:** Integrators who need `<object>` embeds or `http:` URLs must set the corresponding config fields explicitly. This has generated support questions; the answer is intentional.

### RNG is injectable and seedable

**Decision:** `AssessmentItemDefinitionConfig` accepts an optional per-session `rngFactory` or numeric `seed`. The default is `Math.random`.
**Rationale:** Template processing uses `<randomInteger>` and `<randomFloat>` operators that call the RNG. For reproducible test fixtures, for server-side pre-generation of randomized items, and for deterministic test assertions, the RNG must be injectable. Using `Math.random` directly in the processing engine would make all template-randomized items non-reproducible.  
**Alternatives considered:** No injectable RNG (makes randomized items untestable without mocking global Math.random).  
**Consequences:** Each `openSession()` receives an independent random stream, so opening or presenting one session cannot advance another session's RNG. Server-side scoring with the same seed as client-side rendering produces identical template variable values. Restoring a serialized session does not execute a throwaway template program before applying its saved template variables.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| Custom extractors | `ElementExtractor<TPayload, TOutputType>` via `AssessmentItemDefinitionPlugin` | Supply plugins to `AssessmentItemDefinitionConfig`; registration completes before the definition-owned registry is sealed | `packages/acme-likert-plugin/` |
| Custom interaction renderers | `ComponentConfig` in `ComponentRegistry` | Register through the definition's plugin set | Register a custom tag name at priority > 0 for a given interaction type |
| Custom QTI operators | `customOperators` in `AssessmentItemDefinitionConfig` | Pass a map of operator `class` → implementation function | Used for `<customOperator class="...">` in response processing |
| Definition plugin | `AssessmentItemDefinitionPlugin` | Pass an immutable, dependency-ordered `plugins[]` array when creating the definition | `packages/acme-likert-plugin/src/plugin.ts` |
| i18n | `I18nProvider` from `@pie-qti/i18n` | Pass `i18nProvider` to the definition config | Used for player UI strings in web components |
| Math typesetting | `typeset(root: Element) => void` | Passed through Svelte rendering surfaces; called after DOM update | `@pie-qti/typeset-katex` provides `typesetMathInElement` |
| Iframe isolation | `IFramePlayerHost` at `@pie-qti/item-player/iframe` | Import from the `/iframe` entry point; construct with container + runtime URL | See `packages/item-player/docs/iframe-mode.md` |

---

## Data model / contracts

Key types are exported from `@pie-qti/item-player`. The invariants that are not obvious from reading the types:

**`AssessmentItemDefinition` / `ItemSession`:**
- `createAssessmentItemDefinition()` snapshots XML, plugins, security, PNP, delivery context, and processing configuration. Mutable extraction/component registries are not part of this primary interface.
- `openSession()` is the only supported way to create a live session. `state()`, transition views, and `serialize()` return immutable snapshots; `dispatch()`, `present()`, `subscribe()`, and `dispose()` are the session operations.
- `ItemSessionView.role` exposes the definition-fixed role for browser adapters; presentation callers
  cannot override it.
- After idempotent disposal, `state()` remains readable as the final immutable view with
  `disposed: true`; dispatch, presentation, subscription, and serialization are rejected.
- `rngFactory`, when supplied, creates one independent random stream per opened session. A restored session receives a stream for future template commands but does not consume it while applying the saved state.
- An injected browser session remains owned by its creator. A standalone item element creates and disposes its own session.
- `getItemSessionBinding()` is an internal browser-adapter capability, not a general-purpose route back to `Player` or parser internals.

**Outcome variable initialization:**
- QTI 2.1 §5.2, carried into 2.2 and 3.0: an outcome declared without a `<defaultValue>` initializes
  to NULL unless its base type is `integer` or `float`, in which case it initializes to 0. Applied at
  parse time, so it also governs the reset before each response-processing run and the `<default>`
  expression. Accumulating processing (`SCORE = sum(SCORE, 1)`) depends on it: from NULL the sum
  propagates NULL and the item never scores.
- Response and template variables are unaffected and keep NULL. An unanswered numeric response must
  stay distinguishable from an answered zero.
- The rule applies to `MAXSCORE` too, so a `MAXSCORE` declared without a default is 0 rather than
  absent, and an item that never assigns it scores against a maximum of zero. That is the
  spec-correct reading of under-specified content; substituting 1 inside response processing would
  make this engine disagree with a conformant one. The player warns once per item, naming the item
  and the remedy, instead of masking it. `@pie-qti/assessment-player` applies the same rule to
  test-level outcome declarations.

**`ScoringResult`:**
- `score` is the raw value of the `SCORE` outcome variable (always a `number`; never `null`). For a
  defaultless numeric `SCORE` the 0 now comes from the variable's own initialization.
- `maxScore` is the raw value of `MAXSCORE`, falling back to `1.0` only when `MAXSCORE` is not
  declared at all — the case the spec leaves open. A declared-but-defaultless `MAXSCORE` reports 0.
- `completed` is `true` for non-adaptive items after any `processResponses()` call; for adaptive items it mirrors `completionStatus === 'completed'`.
- `modalFeedback` contains only the feedback elements whose `showHide` logic evaluates to visible given the current outcome values; it is never null but may be an empty array.

**`AdaptiveAttemptResult`:**
- Extends `ScoringResult`.
- `canContinue` is `true` iff the item is adaptive and not yet completed; always `false` for non-adaptive items.
- Dispatching `{ action: 'submitAttempt' }` after the session is completed throws; submitting an already-completed adaptive item is a programming error.

**`PlayerSecurityConfig` / `UrlPolicyConfig`:**
- `allowDataImages: true` permits `data:image/*` on `<img src>` only. It does not permit data URIs in any other attribute context.
- `allowSvgDataImages: true` additionally permits `data:image/svg+xml`. This is gated separately because inline SVG can contain scripts in some browser contexts.
- `allowObjectEmbeds: true` affects both the sanitizer (allows `<object>` through) and the `mediaInteraction` extraction result (`allowObjectEmbeds` is forwarded to the component).

---

## Acceptance criteria

### Functional

```
AC-1: Open an ItemSession and score a correct choiceInteraction
  Given: An assessmentItem with a choiceInteraction (maxChoices=1), a correctResponse of "A",
         a match_correct responseProcessing template, and MAXSCORE=1.0
  When: definition = createAssessmentItemDefinition({ itemXml, role: 'candidate' })
        session = definition.openSession()
        session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' })
        result = session.dispatch({ action: 'endAttempt' }).result.scoring
  Then: result.score === 1.0, result.completed === true, result.outcomeValues.SCORE === 1.0
```

```
AC-2: Outcome variables reset between scoring commands
  Given: An ItemSession with responseProcessing that sets SCORE to 1.0 only when the answer is correct
  When: session.dispatch({ action: 'setResponses', responses: { RESPONSE: 'A' } })
        result1 = session.dispatch({ action: 'scoreAttempt' }).result.scoring
        session.dispatch({ action: 'setResponses', responses: { RESPONSE: 'B' } })
        result2 = session.dispatch({ action: 'scoreAttempt' }).result.scoring
  Then: result1.score === 1.0, result2.score === 0.0 (not 1.0 from the previous run)
```

```
AC-3: Template processing executes at construction time with a seeded RNG
  Given: An assessmentItem with templateProcessing using randomInteger(1, 10)
         and a seed provided in AssessmentItemDefinitionConfig
  When: two definitions are compiled with { itemXml, seed: 42 }
        one session is opened from each definition
  Then: Both sessions expose identical state().templates values
```

```
AC-4: Adaptive item numAttempts increments before response processing
  Given: An adaptive assessmentItem with responseProcessing that branches on numAttempts
         (attempt 1: set FEEDBACK=tryagain; attempt 2+: set completionStatus=completed)
  When: session.dispatch({ action: 'submitAttempt' }) is called (attempt 1)
  Then: result.numAttempts === 1, result.completionStatus !== 'completed',
        result.modalFeedback contains the 'tryagain' block
  When: session.dispatch({ action: 'submitAttempt' }) is called again (attempt 2)
  Then: result.numAttempts === 2, result.completionStatus === 'completed',
        result.canContinue === false
```

```
AC-5: Item presentation filters direct rubrics by role
  Given: An assessmentItem with two rubricBlocks: one with view="scorer" and one with view="candidate"
         and role='scorer'
  When: session.present().directRubrics is read
  Then: Returns only the rubricBlock with view="scorer"
        The candidate-only block is absent
```

```
AC-5b: ItemSession presentation fixes role and exposes direct rubrics
  Given: A definition compiled with role='candidate' and one direct candidate rubricBlock
  When: session.present() is called
  Then: presentation capabilities use candidate policy
        presentation.directRubrics contains the direct block
        the present() view parameter has no role override
```

```
AC-6: Serialized session state round-trip
  Given: A live ItemSession with responses set and response processing completed
  When: state = session.serialize(); session.dispose()
        restored = definition.openSession({ restore: state })
  Then: restored.state() matches the saved variables and lifecycle without re-running template or response processing
        no second live session is used as a synchronization peer
```

```
AC-7: QTI 3.0 item parsed without explicit mapper configuration
  Given: An assessmentItem in QTI 3.0 form (qti-assessment-item, qti-choice-interaction, response-identifier)
  When: createAssessmentItemDefinition({ itemXml, role: 'candidate' }) compiles it
        a session is opened and session.present().flow is read
  Then: The interaction mount has the correct responseId and choices, with no error thrown
  Notes: Version detection is from namespace URI or element name.
```

```
AC-8: Strict compliance mode rejects non-2.2 items when configured
  Given: A QTI 3.0 item and AssessmentItemDefinitionConfig with strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true }
  When: createAssessmentItemDefinition({ itemXml, role: 'candidate', strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true } }) is called
  Then: An error is thrown with a message indicating version mismatch
```

### Security

```
AC-S1: Mixed-case on* event handlers stripped from item body HTML
  Given: An assessmentItem whose itemBody contains <p onClick="alert(1)" oNLoAd="alert(2)">text</p>
  When: session.present().flow HTML nodes are read
  Then: The finalized HTML contains no onClick, oNLoAd, or any on* attribute
        The paragraph text is preserved
```

```
AC-S2: <object> embeds blocked by default
  Given: An assessmentItem with a mediaInteraction whose object element has a data= attribute
         and AssessmentItemDefinitionConfig has no security config (defaults)
  When: a session presentation's mediaInteraction mount is read
  Then: The extracted mediaInteraction data has allowObjectEmbeds === false
```

```
AC-S3: Parsing limits enforce max XML size when enabled
  Given: An AssessmentItemDefinitionConfig with security.parsingLimits: { enabled: true, maxItemXmlBytes: 1024 }
         and an itemXml string larger than 1024 bytes
  When: createAssessmentItemDefinition({ itemXml, role: 'candidate', security: { parsingLimits: ... } }) is called
  Then: An error is thrown before any XML parsing occurs
```

### Accessibility

```
AC-A1: Role capabilities are exposed for all six QTI roles
  Given: Each of the roles: candidate, scorer, author, tutor, proctor, testConstructor
  When: getRoleCapabilities(role) is called for each
  Then: candidate → isCandidate=true, isReadOnly=false, canViewCorrectResponses=false
        scorer/author/tutor/testConstructor → isCandidate=false, isReadOnly=true, canViewCorrectResponses=true
        proctor → isCandidate=false, isReadOnly=true, canViewCorrectResponses=false
```

### Edge cases

```
AC-E1: Item with no responseProcessing element scores zero without error
  Given: An assessmentItem with an interaction but no <responseProcessing> element
  When: session.dispatch({ action: 'scoreAttempt' }) is called
  Then: Returns score=0, completed=true (non-adaptive), no error thrown
```

```
AC-E2: submitAttempt action after completed adaptive item throws
  Given: An adaptive item where the submitAttempt session command has set completionStatus=completed
  When: session.dispatch({ action: 'submitAttempt' }) is called again
  Then: Throws an error with message indicating the item is already completed
```

```
AC-E3: Malformed <mapping> defaults mapEntry to zero without throwing
  Given: A responseDeclaration with a <mapEntry> that has a non-numeric mappedValue attribute
  When: a definition/session is created and the scoreAttempt session command is dispatched
  Then: The map entry's mappedValue coerces to 0 (Number(NaN) = 0), no exception propagates
  Notes: This matches lenient real-world item behavior. Strict compliance mode may log a warning.
```

---

## Related

- QTI spec: QTI 2.2.2 Final — https://www.imsglobal.org/content/question-and-test-interoperability-v222-final
- QTI spec: QTI 3.0 — https://www.imsglobal.org/spec/qti/v3p0/
- Implementation: `packages/item-player/src/core/AssessmentItemDefinition.ts`, `ItemSession.ts`, `Player.ts`, `packages/item-player/src/document/AssessmentItemDocument.ts`
- Security model: `docs/prds/architecture/security.md`
- Iframe mode: `packages/item-player/docs/iframe-mode.md`
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Adjacent PRDs: `architecture/item-player-plugin-system.md`, `architecture/response-processing.md`, `architecture/security.md`
- Architecture overview: `docs/ARCHITECTURE.md`
