# PRD: QTI Item Player

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

`@pie-qti/item-player` is the core rendering and scoring engine for a single QTI assessmentItem. It parses QTI 2.2 and 3.0 XML, manages response and outcome variable state, compiles and executes response/outcome/template processing programs, and produces typed `InteractionData` that a framework-agnostic web component layer renders. It ships an optional iframe host helper for deployments that need origin isolation. The class exported as `Player` is the primary integration surface; all extension (custom interactions, vendor markup, custom operators) flows through that one constructor.

---

## Background and rationale

### Why framework-agnostic

When the player was designed, the default interactions were authored in Svelte 5, but potential integrators include React apps, Angular apps, plain JS shells, and server-rendered pages. Coupling the core engine to Svelte would make all of those impossible without forking. The solution is a clear three-layer stack: (1) the core `Player` class never touches the DOM and has no framework imports; (2) the extraction layer turns raw XML into typed POJOs (`InteractionData`); (3) the rendering layer is entirely delegated to web components that the host registers. Standard interaction contracts and extractors live in `packages/item-player/src/interactions/<interaction>/`. Svelte is used to build the *default* web components (`@pie-qti/default-components`), but the player only knows about custom element tag names and the `qti-change` DOM event. Any framework that can produce a custom element can replace any or all of the default components.

### Why web components as the rendering contract

The player communicates with interaction UIs via three mechanisms: element creation by tag name (`document.createElement(tagName)`), property assignment for initial data, and the bubbling `qti-change` CustomEvent for response mutations. This is intentionally the narrowest possible interface. Web components are the only cross-framework primitive with standardized lifecycle callbacks, property-to-attribute reflection, and event bubbling. Using a richer interface (e.g., a React callback tree or a Svelte store) would create hard framework dependencies throughout the rendering path.

The consequence is that the `ComponentRegistry` maps `InteractionData` to a tag name, not to a component constructor. The player never imports any component class. This means a vendor that wants to replace the default `choiceInteraction` renderer only needs to register a tag name at priority > 0 and ensure the custom element is defined in the global registry before the item is rendered.

### Why iframe isolation is opt-in

Iframe isolation adds meaningful complexity: a versioned postMessage protocol, a host helper, and an integrator-owned runtime page. For the common case — trusted QTI authored in-house or from a known vendor — that complexity has no payoff. Forcing isolation on all deployments would be paternalistic and would break patterns like same-DOM typesetting, custom scrolling behavior, and CSS theming through the host document.

The player instead ships conservative same-DOM guardrails by default (HTML sanitization, URL policy, `<object>`/`<iframe>` disabled) and provides iframe mode as `@pie-qti/item-player/iframe`, a separate entry point that avoids any runtime cost when not used. The security audit at `packages/item-player/docs/security-audit.md` documents the residual risk of same-DOM embedding and makes clear that origin isolation is the only complete mitigation for untrusted third-party QTI.

### Why the AST response processor

The `@pie-qti/qti-processing` package compiles `<responseProcessing>`, `<outcomeProcessing>`, and `<templateProcessing>` XML into a typed AST at construction time (`buildResponseProcessingAst`, `buildOutcomeProcessingAst`, `buildTemplateProcessingAst`). The AST is then executed via `execProgram` on each scoring call.

Two alternatives were rejected: (1) interpreting the XML nodes directly on each scoring call — this re-traverses the DOM every time and makes it impossible to serialize or cache the program; (2) generating JavaScript via `eval`/`new Function` — this violates strict CSP and introduces code injection risk. The AST approach produces a serializable, inspectable program that can be executed multiple times without re-parsing and supports all 45 QTI operators without eval.

The `customOperators` config key in `PlayerConfig` is the escape hatch for QTI `<customOperator>` elements. Implementations are registered by operator `class` attribute (preferred) or `definition` URI and run synchronously inside `execProgram`. Because custom operators run inside the scoring engine, they are treated as integrator-trusted code — the player does not sandbox them.

### Why conservative security defaults

The player defaults to blocking `<object>`, `<embed>`, and `<iframe>` elements, stripping all `on*` event handlers case-insensitively, and blocking protocol-relative URLs. These were not always the defaults: the security audit (commit `a87ca31`) identified real XSS bypass classes in earlier versions including mixed-case `onClick`, `iframe[srcdoc]`, and SVG `xlink:href`. The lesson was that "reasonable" sanitizer defaults are routinely insufficient for attacker-controlled HTML. The current defaults are conservative because the cost of being too strict is a logged warning and a visible gap; the cost of being too permissive is XSS in a product used by K-12 students.

Parsing limits (`ParsingLimitsConfig`) are opt-in rather than default because they impose hard limits that could break large legitimate items. When rendering content from known-safe authors, the limits add no value and risk false-positive failures. For untrusted deployments, enabling `security.parsingLimits` is strongly recommended in addition to origin isolation.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1 (compatibility), QTI 2.2 (primary), QTI 3.0 (supported)
- **Spec sections:** QTI 2.2 §4 (assessmentItem), §5 (interactions), §6 (response processing), §7 (outcome processing), §8 (template processing), §9 (adaptive items), §13 (view/rubric)
- **Supported attributes:** `adaptive`, `timeDependent` (tracked), `view` (rubricBlock filtering), all `responseDeclaration`/`outcomeDeclaration`/`templateDeclaration` attributes including `defaultValue`, `correctResponse`, `mapping`, `areaMapping`, `matchTable`, `interpolationTable`
- **Deliberately omitted attributes:** `timeDependent` does not gate submission (the player has no built-in timer; time tracking is the assessment shell's responsibility)
- **Known divergences from spec:**
  - QTI 3.0 element names (`qti-choice-interaction`, etc.) and attribute names (`response-identifier`) are automatically detected and normalized at construction time via `ElementNameMapper`/`AttributeNameMapper`; they do not require explicit configuration.
  - `completionStatus` and `numAttempts` are injected as built-in outcome declarations if absent — the spec technically requires items to declare them explicitly; in practice, many authored items omit the declaration.

---

## Functional requirements

- **FR-1:** The player must parse a valid `assessmentItem` XML string and produce interaction data without throwing for any of the 21 supported QTI interaction types.
- **FR-2:** `setResponse(identifier, value)` / `setResponses(map)` must coerce values to the declared `baseType` and `cardinality` of the matching `responseDeclaration`.
- **FR-3:** `processResponses()` must reset outcome variables to their declared defaults before each run (spec-aligned; prevents stale outcomes from a previous attempt bleeding into the next).
- **FR-4:** Template processing must execute once at construction time after declarations are built, before any responses are applied.
- **FR-5:** For adaptive items, `submitAttempt()` must increment `numAttempts` before executing response processing so that `<variable identifier="numAttempts"/>` expressions inside the program reflect the current attempt.
- **FR-6:** `getRubrics()` must filter `<rubricBlock>` elements by the `view` attribute, showing blocks whose `view` list includes the current role (or blocks with no `view` attribute to all roles).
- **FR-7:** `getItemBodyHtml()` must replace `<printedVariable>` elements with the current runtime value of the referenced variable before sanitizing.
- **FR-8:** `getCorrectResponse(id)` must return the correct response only when the role policy grants `canViewCorrectResponses`; callers are responsible for checking role policy — the Player returns the data regardless, and the UI layer uses `getRoleCapabilities()` to decide whether to expose it.
- **FR-9:** `validateResponses(responses)` must check cardinality shape (array vs. single) and required-ness per interaction type without running response processing.
- **FR-10:** For items with `adaptive="true"`, `isCompleted()` must return true only when `completionStatus === 'completed'` as set by the item's own response processing program.

---

## Non-functional requirements

- **Accessibility:** The `Player` class produces no DOM. Accessibility requirements are entirely in the web component layer (`@pie-qti/default-components`). The player does expose `getRoleCapabilities()` so components know whether to render readonly/disabled states.
- **Performance:** The Player constructor parses XML and compiles ASTs once. Subsequent `processResponses()` calls execute the compiled AST and must complete in < 10 ms for items with standard response processing on commodity hardware. `getInteractionData()` re-parses the item XML with node-html-parser on every call; callers should cache the result if the item XML is stable.
- **Cross-platform:** The Player class is environment-agnostic (no DOM API calls). It runs in browsers, Node.js, Bun, and Deno. Only the iframe host helper and the web component auto-registration path (`ComponentRegistry.register` with `componentClass`) require a browser with `customElements`.
- **Security:** See Background/Rationale for the full security model. Key invariants: (1) `<object>` and `<iframe>` are off by default; (2) all HTML returned from `getItemBodyHtml()`, `getRubrics()`, `getModalFeedback()`, and extracted `contentHtml` fields is sanitized and optionally wrapped in TrustedHTML; (3) extracted URL fields go through `sanitizeResourceUrl` before being placed in `InteractionData`.
- **i18n:** The Player accepts an optional `i18nProvider` from `@pie-qti/i18n`. When not provided, a minimal fallback provider that returns translation keys as-is is used. The fallback avoids a hard package dependency on `@pie-qti/i18n` and keeps the player usable in environments where i18n is not needed.

---

## Design decisions

### The Player class is stateful and not reusable across items

**Decision:** `Player` is instantiated once per item. Loading a new item requires constructing a new `Player` with the new `itemXml`.  
**Rationale:** The variable state (`DeclarationMap`), compiled ASTs, and session state are tightly coupled to a single item's XML structure. Resetting all of this cleanly for a new item would require the same work as constructing a new instance.  
**Alternatives considered:** A `reset(itemXml)` method that re-initializes all private fields.  
**Consequences:** Callers that navigate between items must create a new `Player` per item. Session state for a completed item must be captured via `getSessionState()` before the instance is discarded.

### Dual XML parsing: `@pie-qti/qti-processing` parseXml + node-html-parser

**Decision:** The `Player` constructor parses `itemXml` with the XML-aware `parseXml` (from `@pie-qti/qti-processing`) for declarations and response processing. `getInteractionData()` re-parses `itemXml` with `node-html-parser` for extraction.  
**Rationale:** `parseXml` returns a proper `Document` that supports namespace-aware element lookup and attribute coercion, which is required for correct QTI variable semantics. `node-html-parser` is faster and provides a jQuery-like selector API that the extractor utilities expose to `ElementExtractor` implementations. The two parsers serve different purposes and cannot easily be substituted for each other.  
**Alternatives considered:** Using only `node-html-parser` for everything (loses namespace support and correct attribute handling); using only `parseXml` for extraction (requires adapting all extractor utilities to the XML DOM API, which is significantly more verbose).  
**Consequences:** `getInteractionData()` is not free — re-parsing on every call is measurable on large items. Callers should cache the result when the item XML is not changing between calls.

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

**Decision:** `PlayerConfig.rng` accepts an optional RNG override; `PlayerConfig.seed` accepts a numeric seed for deterministic randomness. The default is `Math.random`.  
**Rationale:** Template processing uses `<randomInteger>` and `<randomFloat>` operators that call the RNG. For reproducible test fixtures, for server-side pre-generation of randomized items, and for deterministic test assertions, the RNG must be injectable. Using `Math.random` directly in the processing engine would make all template-randomized items non-reproducible.  
**Alternatives considered:** No injectable RNG (makes randomized items untestable without mocking global Math.random).  
**Consequences:** Server-side scoring with the same seed as client-side rendering will produce identical template variable values, enabling correct verification of template-based items without re-running template processing.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| Custom extractors | `ElementExtractor<TData>` in `ExtractionRegistry` | Pass `extractionRegistry` to `PlayerConfig`, or use `plugins[]` with `registerExtractors()` | `packages/acme-likert-plugin/` |
| Custom interaction renderers | `ComponentConfig` in `ComponentRegistry` | Pass `componentRegistry` to `PlayerConfig`, or use `plugins[]` with `registerComponents()` | Register a custom tag name at priority > 0 for a given interaction type |
| Custom QTI operators | `customOperators` in `PlayerConfig` | Pass a map of operator `class` → implementation function | Used for `<customOperator class="...">` in response processing |
| Full plugin | `QTIPlugin` interface in `Plugin.ts` | Pass in `plugins[]` array; plugin calls `registerExtractors()` and `registerComponents()` | `packages/acme-likert-plugin/src/plugin.ts` |
| i18n | `I18nProvider` from `@pie-qti/i18n` | Pass `i18nProvider` to `PlayerConfig` | Used for player UI strings in web components |
| Math typesetting | `typeset(root: Element) => void` | Passed through Svelte rendering surfaces; called after DOM update | `@pie-qti/typeset-katex` provides `typesetMathInElement` |
| Iframe isolation | `IFramePlayerHost` at `@pie-qti/item-player/iframe` | Import from the `/iframe` entry point; construct with container + runtime URL | See `packages/item-player/docs/iframe-mode.md` |

---

## Data model / contracts

Key types are in `packages/item-player/src/types/index.ts`. The invariants that are not obvious from reading the types:

**`PlayerConfig`:**
- `itemXml` is parsed at construction time; later mutations have no effect.
- `sessionState` is applied after declarations are built but before template processing runs, so template variables can be restored from a saved session.
- `responses` (initial responses) are applied after template processing, ensuring template variables are ready before responses are coerced.
- `componentRegistry` and `extractionRegistry` parameters are typed as `any` in `PlayerConfig` to avoid circular imports at the type level. Cast to `ComponentRegistry` / `ExtractionRegistry` internally.

**`ScoringResult`:**
- `score` is the raw value of the `SCORE` outcome variable (always a `number`; never `null` — defaults to `0`).
- `maxScore` is the raw value of `MAXSCORE` (defaults to `1.0` if null or missing).
- `completed` is `true` for non-adaptive items after any `processResponses()` call; for adaptive items it mirrors `completionStatus === 'completed'`.
- `modalFeedback` contains only the feedback elements whose `showHide` logic evaluates to visible given the current outcome values; it is never null but may be an empty array.

**`AdaptiveAttemptResult`:**
- Extends `ScoringResult`.
- `canContinue` is `true` iff the item is adaptive and not yet completed; always `false` for non-adaptive items.
- Calling `submitAttempt()` after `isCompleted()` returns `true` throws — it is a programming error to submit an already-completed adaptive item.

**`PlayerSecurityConfig` / `UrlPolicyConfig`:**
- `allowDataImages: true` permits `data:image/*` on `<img src>` only. It does not permit data URIs in any other attribute context.
- `allowSvgDataImages: true` additionally permits `data:image/svg+xml`. This is gated separately because inline SVG can contain scripts in some browser contexts.
- `allowObjectEmbeds: true` affects both the sanitizer (allows `<object>` through) and the `mediaInteraction` extraction result (`allowObjectEmbeds` is forwarded to the component).

---

## Acceptance criteria

### Functional

```
AC-1: Construct Player, score a correct choiceInteraction
  Given: An assessmentItem with a choiceInteraction (maxChoices=1), a correctResponse of "A",
         a match_correct responseProcessing template, and MAXSCORE=1.0
  When: new Player({ itemXml, role: 'candidate' }) is constructed,
        player.setResponse('RESPONSE', 'A') is called,
        player.processResponses() is called
  Then: result.score === 1.0, result.completed === true, result.outcomeValues.SCORE === 1.0
```

```
AC-2: Outcome variables reset between processResponses() calls
  Given: A Player with a responseProcessing that sets SCORE to 1.0 only when the answer is correct
  When: player.setResponse('RESPONSE', 'A') (correct) → processResponses() → result1
        player.setResponse('RESPONSE', 'B') (incorrect) → processResponses() → result2
  Then: result1.score === 1.0, result2.score === 0.0 (not 1.0 from the previous run)
```

```
AC-3: Template processing executes at construction time with a seeded RNG
  Given: An assessmentItem with templateProcessing using randomInteger(1, 10)
         and a seed provided in PlayerConfig
  When: new Player({ itemXml, seed: 42 }) is constructed twice
  Then: Both instances return identical values for getTemplateVariables()
```

```
AC-4: Adaptive item numAttempts increments before response processing
  Given: An adaptive assessmentItem with responseProcessing that branches on numAttempts
         (attempt 1: set FEEDBACK=tryagain; attempt 2+: set completionStatus=completed)
  When: submitAttempt() is called (attempt 1)
  Then: result.numAttempts === 1, result.completionStatus !== 'completed',
        result.modalFeedback contains the 'tryagain' block
  When: submitAttempt() is called again (attempt 2)
  Then: result.numAttempts === 2, result.completionStatus === 'completed',
        result.canContinue === false
```

```
AC-5: getRubrics() filters by role
  Given: An assessmentItem with two rubricBlocks: one with view="scorer" and one with view="candidate"
         and role='scorer'
  When: player.getRubrics() is called
  Then: Returns only the rubricBlock with view="scorer"
        The candidate-only block is absent
```

```
AC-6: Session state round-trip
  Given: A Player with responses set and processResponses() called
  When: state = player.getSessionState()
        new Player({ itemXml, role, sessionState: state }) is constructed
  Then: The new player's outcome variables match the saved state without re-running processResponses()
```

```
AC-7: QTI 3.0 item parsed without explicit mapper configuration
  Given: An assessmentItem in QTI 3.0 form (qti-assessment-item, qti-choice-interaction, response-identifier)
  When: new Player({ itemXml, role: 'candidate' }) is constructed
        player.getInteractionData() is called
  Then: Returns interactions with the correct responseId and choices, no errors thrown
  Notes: Version detection is from namespace URI or element name.
```

```
AC-8: Strict compliance mode rejects non-2.2 items when configured
  Given: A QTI 3.0 item and PlayerConfig with strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true }
  When: new Player({ itemXml, role: 'candidate', strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true } }) is constructed
  Then: An error is thrown with a message indicating version mismatch
```

### Security

```
AC-S1: Mixed-case on* event handlers stripped from item body HTML
  Given: An assessmentItem whose itemBody contains <p onClick="alert(1)" oNLoAd="alert(2)">text</p>
  When: player.getItemBodyHtml() is called
  Then: The returned HTML contains no onClick, oNLoAd, or any on* attribute
        The paragraph text is preserved
```

```
AC-S2: <object> embeds blocked by default
  Given: An assessmentItem with a mediaInteraction whose object element has a data= attribute
         and PlayerConfig has no security config (defaults)
  When: player.getInteractionData() is called
  Then: The extracted mediaInteraction data has allowObjectEmbeds === false
```

```
AC-S3: Parsing limits enforce max XML size when enabled
  Given: A PlayerConfig with security.parsingLimits: { enabled: true, maxItemXmlBytes: 1024 }
         and an itemXml string larger than 1024 bytes
  When: new Player({ itemXml, role: 'candidate', security: { parsingLimits: ... } }) is constructed
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
  When: player.processResponses() is called
  Then: Returns score=0, completed=true (non-adaptive), no error thrown
```

```
AC-E2: submitAttempt() after completed adaptive item throws
  Given: An adaptive item where submitAttempt() has set completionStatus=completed
  When: submitAttempt() is called again
  Then: Throws an error with message indicating the item is already completed
```

```
AC-E3: Malformed <mapping> defaults mapEntry to zero without throwing
  Given: A responseDeclaration with a <mapEntry> that has a non-numeric mappedValue attribute
  When: new Player({ itemXml }) is constructed and processResponses() is called
  Then: The map entry's mappedValue coerces to 0 (Number(NaN) = 0), no exception propagates
  Notes: This matches lenient real-world item behavior. Strict compliance mode may log a warning.
```

---

## Open questions

- [ ] `getInteractionData()` re-parses `itemXml` with node-html-parser on every call. The cost is not currently benchmarked on large items (e.g., hottextInteraction with hundreds of hottext elements). Should the result be memoized, and if so, what invalidates the cache?
- [ ] The `i18nProvider` in `PlayerConfig` is typed as `any` to avoid a hard dependency on `@pie-qti/i18n`. When the i18n package is stable, should this be typed properly and listed as a peer dependency?

---

## Related

- QTI spec: QTI 2.2.2 Final — https://www.imsglobal.org/content/question-and-test-interoperability-v222-final
- QTI spec: QTI 3.0 — https://www.imsglobal.org/spec/qti/v3p0/
- Implementation: `packages/item-player/src/core/Player.ts`
- Security model: `packages/item-player/docs/security-audit.md`
- Iframe mode: `packages/item-player/docs/iframe-mode.md`
- Response processing: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Adjacent PRDs: `architecture/item-player-plugin-system.md`, `architecture/response-processing.md`, `architecture/security.md`
- Architecture overview: `docs/ARCHITECTURE.md`
