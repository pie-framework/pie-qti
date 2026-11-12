# QTI Player Cleanup — Decision Record

**Status**: Landed — Phases 0–7 executed 2026-11-08 → 2026-11-10, closed with a final review round
and the full verification suite. This file is condensed to the decisions and outcomes; the full
working plan lives in git history (branch-merge history on `develop` from `d697ed83` to `8f76acd7`).
**Last reviewed**: 2026-11-11
**Scope**: `packages/assessment-player/`, `packages/section-player/`, `packages/item-player/`,
`packages/default-components/`, `packages/player-elements/`, `packages/qti-processing/`.
The external conformance repo (`pie-qti-conformance`) pins published packages and is unaffected.

Companion records: [`legacy-audit-2026-11.md`](legacy-audit-2026-11.md) (no-legacy removals,
resolved), [`../SPEC-GAPS-PLAN.md`](../SPEC-GAPS-PLAN.md) (policy + remaining gaps).

---

## What the work was

A structural cleanup of the four player packages plus the shared processing package: god objects
decomposed, duplication collapsed to single sources, dead code and non-QTI leniency removed, module
boundaries repaired — followed by a focused fix wave for the QTI/WCAG/UX defects the cleanup's
reviews surfaced.

**Ground rule, held throughout:** no refactor may change QTI-observable behavior. Intentional
behavior changes are exactly the listed fixes, landed test-first with changeset notes (beta
prerelease; "Breaking:" notes where hosts must migrate).

## Structure: god objects decomposed (move-only)

- **item-player `Player.ts`: 2,653 → 1,289 lines.** The engine moved to `core/declarations/`,
  `core/processing/` (with the `TYPE_VALIDATION_ENTRIES` goldens), `core/rendering/`,
  `core/serialization/`, `pci/` (session hosts) and `catalog/`. Six test-only façade methods were
  removed (`suspendAttempt`/`endAttempt`/`scoreAttempt`/`getCorrectResponse`/`getSessionState`/
  `getTemplateVariables` as Player methods — the `ItemSession.dispatch()` commands remain). Safety
  nets first: 37 per-session invariants, a validation golden (`UPDATE_VALIDATION_GOLDEN=1`), a
  response-validation memoization test. Perf: extended-text base cached per identifier;
  `validateResponses` memoized by response revision.
- **assessment-player `AssessmentPlayer.ts`: 4,524 → 4,105 lines; `AssessmentShell.svelte`:
  3,397 → 2,837.** Pure policy modules (navigation policy, submission policy, exit boundaries,
  scope locks, review views, time policy, template defaults, pause, autosave, feedback, formatTime,
  session records, typed player events) never take the transition lock; `AssessmentSessionCoordinator`
  is the sole session-state writer; the shell's dialogs are child components; display settings are a
  module; `createPlayerConnection` replaces `initialize()`. Pinning tests landed before the moves.
- **section-player:** one shared `SectionLayout` for the vertical and split-pane layouts.

## Duplication → one source

- item-player: `escapeHtml`, clone/freeze (`cloneValue`/`deepFreezeInPlace`/`frozenSnapshot`),
  `mergeDeliveryFields`, name mappers, PCI module paths, `responseIdentifier` lookup,
  `DEFAULT_COMPONENT_TAGS_BY_TYPE` (registry derived, `catalogPopup` separate), the spec lookup-table
  parser (moved into qti-processing).
- default-components shared layer (never importing from `plugins/`, pinned by graph tests):
  `ImageStage` (7 stages), the keyboard crosshair (2), `createPickUpPlace` (4), pair helpers
  (move-aware), matchGroup blocking (5), capacity rules with 0 = unlimited (6+), `choiceAccessibleName`
  readable names (6+), `createAnnouncer` (14), one `.sr-only` source injected into document and
  shadow roots (12+), one stroke icon set (9 inline copies), `InteractionProps<T>` for all 20 plugins,
  `radioGroup`, web-component prop helpers.
- assessment-player/section-player: the feedback helper, `formatTime`, one `STORAGE_PREFIX`.
- Module boundaries: one workspace-only alias map (`tsconfig.workspace-aliases.json`) replaced raw
  cross-package `src` imports; item-player's presentation ↔ components cycle broken;
  `check-deps.mjs` enforces the map.

## Removals (details: the changesets and the legacy audit)

- **Dead code (cleanup Phase 1 + legacy audit A1–A9):** unused controller methods and events, the
  ignored `rng` config (host-facing API unchanged; conformance-repo methods kept stable), the
  deprecated `tryResolveImagePath`, the `vendor-extensions.ts` re-export shim, the `searchMetaData`
  read paths, the select-point object-points tolerance, the PCI keyed-record input form, the
  `TimeManager` singular-threshold field, the string `FinalizeAssessmentResponse.feedback`.
- **Non-QTI leniency (legacy audit B1–B5 + the class-B addendum):** mapping-level `caseSensitive`,
  ISO-duration XML literals (PCI JSON keeps ISO — spec-driven), `roundingMode` case variants, the
  randomInteger/randomFloat child-expression form, the `<console>` statement.
- **Non-QTI processing elements:** fourteen builder cases no version defines (`isNotNull`,
  `notEqual`, `allN`, the five stats aliases, `mod`, `isTypeOf`, `mapOutcome` + `<mapping>` on
  outcome declarations, `setResponseValue`, `lookupTable`, `record`) plus the `preCondition`
  expression, each with its AST node and evaluator branch, pinned by a test that they throw like
  unknown elements; `xi:include` stays (XInclude, spec-referenced). Fixtures rewritten to spec
  spellings, goldens regenerated; official fixtures and third-party content never used any of them.
- **Locale keys with no remaining reader** (all locales): the hottext/order/choice state words,
  graphic-gap-match hints, `expandPassage`/`collapsePassage`, position-object `objectUsage` keys.
- Interface members that described attributes/fields that do not exist (`AssociateData.minSelectionsMessage`,
  `GraphicOrderData.minSelectionsMessage`, `gapTexts[].inputWidth`, the never-rendered
  `firstColumnHeader` delivery field) and the invented `customInteractionIdentifierType` PCI
  spelling (item player and the `to-pie` converter).

## Intentional behavior fixes (test-first, changesets)

**Cleanup Phase 2:** `isShowingCorrect` shell semantics everywhere; accessible names never contain
identifiers; `InteractionValueMap` retyped to what components actually emit; the backend branch
decision (`nextItemIdentifier`) followed on unchanged responses with sequence safety, through
`followBranch`, live and restored alike, including simultaneous parts; position-object
`maxChoices="0"` unlimited; associate `maxAssociations` defaults to 1 (Breaking) and is enforced;
graphic-associate `matchMax="0"`/`maxAssociations="0"` mean unlimited (a capacity of 0 that makes an
interaction unusable is not an acceptable reading).

**Exact string comparison** (with the Arabic folding opt-in via `stringComparison`): strings compare
exactly, NFC, per QTI 3.0 §6.9; string responses are stored exactly as typed (the at-rest trim that
corrupted typed spaces is gone — a padded string answer therefore scores distinct from its unpadded
form; numbers and identifiers still trim).

**Final review round (2026-11-10)** — three parallel reviews (QTI spec against the in-repo XSDs;
WCAG 2.2 AA + UX in a real browser; section/item shells), 37 findings, all confirmed ones fixed:

- **Item element session integrity (Critical):** any property write used to re-create the item
  session (shuffle re-rolled mid-answer, templates re-randomized while typing, submitted feedback
  wiped, adaptive attempts reset). Sessions now re-open only on a true definition-fixed change;
  detach/reattach keeps the session; stale responses degrade to a diagnostic.
- **Typed spaces (Critical):** string responses stored verbatim (see above).
- **Standalone feedback default** now follows QTI `itemSessionControl@showFeedback` (false) —
  hosts opt in with `showFeedback`/`show-solution` (Breaking).
- **QTI 3 `<picture>`/`<img>` interaction images** accepted everywhere `<object>` was; position-object
  reads all three (it used to fail the whole item on `<img>`); `fixed` honored under shuffle
  (gap choices: QTI 2.1 only, the only version defining it); xs:boolean `"1"` reads as on;
  `matchMin` enforced on gapImg/hotspots; gapImg `objectLabel` and graphic-gap-match `hotspotLabel`
  announced; QTI 3 min/max selection messages read under the exact names each element defines.
- **Section player:** a DOCTYPE/oversized item no longer takes the section down; display settings
  raise the PNP as a floor and stay reversible across the documented persist-and-resume contract;
  stacking keeps focus; the splitter reports achievable positions; test feedback renders with a
  persistent live region; section elements gained typed `qti-section-framework-error` /
  `qti-section-display-settings` / `qti-section-item-pane-ready` events, `display-settings`,
  `focusActiveItem()`, and composition validation.
- **Item element surface:** a typed bubbling `error` event with a localized candidate message
  (`ready` fires on success only, Breaking); the role attribute renamed to `qti-role` (it used to
  write an invalid ARIA token; Breaking); order/graphic-order confirm buttons named by their visible
  label (2.5.3); select-point removal announcements survive the focus move (4.1.3); position-object
  palette names contain their visible text (2.5.3); graphic-associate reflows at 320 px (1.4.10),
  labels wrap under text spacing (1.4.12), elimination toggles meet 3:1 (1.4.11).

## Accepted / parked

Recorded in this file's history and the plan's parked sections, summarized:

- **Assessment player: parked, then finished** (work stopped by decision after Phase 5; the five
  recorded findings were scheduled and fixed on 2026-11-10: the timer/review toggle states are
  announced exactly once, the scope-expiry hop and the whole-test expiry both serialize behind
  in-flight transitions, core no longer imports `integration/test-navigation.ts` (the delivery-rules
  walk moved to `core/testStructure.ts`, pinned), the dialog action styles have one injected source,
  and the players' modules ship once in player-elements' bundle).
- **Accepted limits** (2026-11-10): object-typed element options compare by reference (rebuilding an
  equal `security`/`pnp` each render re-opens the session); a permanently removed element keeps its
  session until page unload; section elements have no `showFeedback` pass-through; persisted-display
  fingerprint limits; the tool bar's `data:` stylesheet marker reports under strict CSP `style-src`;
  `SectionLayout` does not deep-validate direct-Svelte compositions (elements do); graphic-associate
  labels break mid-word at 320 px; PCI has no demo fixture (browser review did not exercise it);
  non-English `item.submitError` strings lack native-speaker review; component splits beyond the
  shared-module extraction (PositionObject, GraphicGapMatch internals), section spoken-catalog
  parsing vs item's, `TimeManager` tick restructuring and hottext's imperative DOM work remain
  deferred.
- **Documented non-implementation:** order `data-choices-container-width`, `mediaInteraction@coords`,
  tabular match (`data-first-column-header`); deliberate extension ledgered: `title` on textEntry/
  inlineChoice.

## Verification at close (2026-11-10, `develop` `8f76acd7`)

- Full gate after every merge: install, biome, typecheck (incl. test tsconfigs), svelte-check, i18n,
  doc-links, deps, unit + component tests, build, 409 e2e — GREEN throughout.
- `verify:certification` (public coverage matrix, incl. its browser evidence subset) — PASS.
- Dedicated a11y suite (`component-fixtures-a11y`, `assessment-a11y-behavior`, `qti3-stage5-a11y`,
  `a11y-regression`) — 75/75.
- Cross-browser tagged specs (webkit + firefox) — 52/52.
- `verify:publish:quick` (fixed versioning, metadata, publish policy, exports, pack smoke,
  sourcemaps, deps, dist deps, publish surface, custom-element define safety across 26 packages) — OK.
- Docs sweep for removed APIs found no stale references.

---

## Round-2 structural review (2026-11-11)

Six read-only reviewers swept the repo for what the cleanup missed: module boundaries, god
objects, duplication, rot. Every previously verified invariant held (the transition lock, the
sole session-state writer, core↛integration, the workspace-alias boundaries, the one-source
claims). The confirmed findings, fixed test-first on `fix/r2-*` branches, gated per merge:

- **default-components:** gap-match and graphic-gap-match kept private live regions, so two
  identical messages in a row announced once (WCAG 4.1.3) — both migrated to the shared
  announcer; the six graphic interactions' stage-image handshake (states, missing-dimensions
  predicates that had already drifted, warn-once effect, scale/frame derivations) is one
  `createStageImage` module; the shared→plugins graph pin now covers every shared module and
  side-effect/dynamic imports.
- **qti-processing:** the never-read `OperatorRegistry` left the public API (Breaking — the
  evaluator only ever consulted `EvalEnv.customOperators`); the ~55 duplicated hit-test
  geometry helpers in the `inside`/`mapResponsePoint` arms hoisted to module scope, with both
  arms pinned by tests before the move.
- **player-elements:** `public/api.ts` now re-exports the runtime element declarations instead
  of hand-mirrors that had already drifted — the assessment map was missing the autosave
  events, the section map three of its four events plus `focusActiveItem`/`displaySettings`,
  and the published element/config interfaces several runtime-accepted fields; a drift-pin test
  walks the runtime dispatches against the published maps.
- **converters:** `passage-reusability` is one module in ims-cp-core consumed by to-pie (the
  drifted untyped-`<object>` reading unified on the stricter extension check — Breaking note;
  generated IDs unchanged); pie-to-qti2's round-trip example repaired (broken since the to-pie
  rename) and its 684-line dead example deleted; the two private `escapeXml` copies replaced
  with qti-common's `escapeXmlAttribute` (byte-identical output, goldens unchanged).
- **item-player:** the definition-fixed session inputs are one descriptor (`session-inputs.ts`)
  consumed by the element setters and the component guards alike, with lockstep tests flipping
  every input and asserting the re-open/survive semantics — the two lists had been maintained
  by hand with nothing pinning them together.
- **assessment-player:** `NavigationManager` unexported (Breaking; hosts use the player's
  navigation methods); the shell-only `showSections`/`allowSectionNavigation`/`showProgress`
  options default in exactly one place (the shell) instead of two drifting sites; the shell's
  sr-only chrome has one injected source with computed-hidden coverage (the component-local
  copies had drifted).

The demo app's mixed module identities (bare dist imports beside the src-aliased component
entries) were investigated and the fix **reverted**. Pinning every entry to source removed the
dual copies but destabilized the dev-server e2e suite: a string-alias prefix bug took the
interaction registry down (`…/src/index.ts/plugins`, ENOTDIR), and after anchoring the aliases,
adding the missing `/plugins` pin, `optimizeDeps.include` and server warmup, the suite still
dropped 3–5 functional tests per run under full parallelism while the unpinned config ran
409/409 clean on the same tree. The demo-only duplication stays accepted for now, guarded by
the `Symbol.for` error brand; the durable fix is serving the e2e suite from the built app (the
no-host-css srcdoc frames import dev-only `/@id/` URLs, so that move is its own task).

Parked from the round-2 fix wave (moderate, unscheduled): hotspot and graphic-gap-match bind
`renderedWidth` without `reportWidth`, so their marker scaling is inert; player-elements' api.ts
still hand-mirrors the section data-model family (drift-pinned, not yet derived); the stale 2.x
`QtiDetector` copy in transform-core; `evalExpr` as a 1,600-line function with per-call closure
rebuilding; `@pie-qti/theme` and `@pie-qti/source-profiles` have no in-repo consumers; two
`escapeText` intra-package copies remain in qti-common.

---

## Round-3 review loop (2026-11-11)

Round 3 swept six fresh lenses: async/lifecycle races, error-handling rot, Svelte 5 reactivity
misuse, injection/input paths, package & infra rot, plus a hard evidence audit of the parked
round-2 moderates. Every serious claim was re-verified at HEAD before fixing. All seven fix
branches (`fix/r3-*`) merged one at a time, each behind a full GREEN gate (409 e2e):

- **Async/lifecycle:** `createPlayerConnection.initialize()` had no staleness guard after
  `AssessmentPlayer.create()`, so a shell unmounted mid-creation adopted an orphaned player
  whose timer ran forever (generation counter added); the assessment element's local-backend
  load re-checked `#loadSeq` only after the first await, so a superseded parse could still
  register the wrong assessment, replace an injected backend and mount after disconnect
  (second recheck added, pinned by a deliberately interleaved race test).
- **Silent failures (the round's dominant theme):** broken QTI test conditions (branchRule/
  preCondition) evaluated errors to `false` with only a console line, rerouting delivery —
  now reported as coded `testConditionFailed` while NULL keeps reading false per QTI; the
  reference backend reported autosave/submit/finalize success for localStorage writes that
  failed (quota), leaving the whole failed/backoff/`autosave-failed` contract unreachable —
  writes now propagate honest failures; interaction mount failures dropped the interaction
  with a console line while `render-failed` was busy mislabelling response-dispatch failures —
  mounts now alert (`role="alert"`) and dispatch `render-failed`, dispatch failures get
  `response-dispatch-failed`; a manufactured 0/1 scorer result now carries `scoringError`;
  the event emitter isolates listener exceptions and the expiry-hop/busy-flag paths can no
  longer strand delivery; hard submit/finalize failures now also reach `config.onError`
  (documented policy: validation refusals stay inline-only).
- **Section-player:** the persisted splitter position was dead code (an init `$effect` ran
  after `onMount` in the same flush and reset it to 50); the tool bar's ToolkitCoordinator
  snapshot never applied `tools` changes and leaked per remount (update/dispose lifecycle);
  toolkit chunk-load failures and the inner item player's documented `error` event never
  reached `qti-section-framework-error` (bridged; `toolkit-load-failed` code; README now
  documents the event).
- **Injection/input:** catalog entries ending in a filename-like token bypassed `sanitizeHtml`
  via the URL branch and reached `innerHTML` unsanitized (markup-free predicate, shared by
  the fallback popup); the production PCI sandbox connector could never deliver a message in
  either direction (`sandbox="allow-scripts"` makes the frame's origin opaque, which neither
  matches a tuple-origin filter nor a tuple targetOrigin — inbound accepts the opaque
  `"null"` origin behind the contentWindow identity check, outbound posts `'*'`; real-browser
  handshake verification stays open, noted in the changeset); four pie-to-qti2 generators
  interpolated raw ids into `identifier="…"` attributes (prefixed/escaped, goldens unchanged
  for well-formed ids); to-pie re-emitted a decoded `rubricBlock/@class` unescaped; authored
  patterns run against candidate text now stop at a documented 10,000-character subject cap
  (`patternMatch` in qti-processing, `patternMask` validation in item-player).
- **Facade drift:** player-elements' 16 hand-mirrored section data-model interfaces had
  already drifted (missing `assessmentId`/`pnp`/`onDisplaySettingsChange`, plus
  `resourceResolver` the audit caught) — fields fixed and a source-walking drift test now
  covers the whole family; malformed `items-json`/`config-json`/`security-json` attributes
  no longer silently keep stale values (validated, reported via `load-error`, removal clears);
  `parseJsonProp` no longer returns truncated JSON as its object type; to-pie
  `extractExtensions` throws on a corrupt `pie:sourceModel` instead of silently dropping the
  author's extensions to QTI metadata — which exposed that its CDATA read had never parsed
  successfully at all (Breaking note).
- **Parked moderates, resolved:** the hotspot/graphic-gap-match `reportWidth` wiring is in
  (marker scaling live, renderScale-pinned tests); the "stale QtiDetector" was reframed — it
  is one intentional, tested detector — but the audit surfaced a real bug beside it:
  `DetectFormatActivity` sniffed `<assessmentItem` before the QTI 3.0 namespace check, so
  live 3.0 content misdetected as 2.2 (now delegates to qti-common's canonical
  `detectQtiVersion`); the three byte-identical `escapeText` copies in qti-common are one
  export; `evalExpr`'s six pure per-call closures are documented for a future hoist (the
  1,300-line function itself stays, its call path is cold); `@pie-qti/theme` and
  `source-profiles` confirmed intentional published integration surfaces (README-declared,
  no in-repo consumers by design).
- **Infra rot:** the three `tools/cli` scripts ran an undeclared `ts-node` loader against
  deliberately non-executable modules (deleted; the real CLI commands verified by running
  them on fixtures); `docs:preview` targeted a turbo task that did not exist (added,
  persistent task semantics per the installed turbo docs); the three release-incident
  regression test scripts in `scripts/` ran under nothing (root `test:scripts` + CI step);
  the dead local-PIE-players machinery (`@pie-framework` peerDeps, postinstall script,
  bunfig example) deleted; unused dependencies removed from apps/docs (dropping the whole
  player build graph from docs builds), pie-to-qti2 and tools/cli (whose `help` subcommand
  never actually worked even with the plugin installed); demo-vendor-extensions added to
  changesets `ignore`; test-utils gained the typecheck CI skipped.

Recorded, not fixed (moderate, unscheduled): concurrent multi-module PCI loads share one AMD
global realm and can clobber each other (amdLoader/pageRealmSession); the three elements'
error-event detail shapes still lack one documented base; ~80 raw `console.*` calls across
delivery packages with `@pie-qti/logger` used by two files; evalExpr closure hoisting;
per-package `clean`/`lint` script drift outside the root composition; the slack-github-action
version split in workflows; a real-browser PCI sandbox handshake verification.

---

## Round-4 review loop (2026-11-11)

Round 4 swept the last unreviewed lenses — QTI processing logic against the spec (verified
against the 2.1/2.2.4/3.0 info models), the i18n framework and its data, test-suite rot, public
API consistency across the four players, hot-path performance, demo/docs drift. Six fix branches
(`fix/r4-*`), each merged behind a full GREEN gate (409 e2e):

- **Spec correctness (qti-processing):** `substring` was an invented `(string, start, length)`
  extraction in every supported version — the spec defines a boolean containment test with
  `caseSensitive`, so it was rebuilt per spec (Breaking; the conformance fixture that pinned the
  invented shape rewritten to containment, with the spec's operand direction); `patternMatch` no
  longer reads the `caseSensitive` attribute no QTI version defines (Breaking; the fixture now
  teaches case sensitivity via an explicit character class); matchTable rejects non-integer
  sources per spec; malformed processing rules throw like every other malformed rule; authored
  regexes are memoized per pattern+flags (bounded) in qti-processing and qti-common so
  validation stops recompiling per keystroke.
- **Spec correctness (delivery):** `completionStatus` now follows the §5.2.1 transitions
  (`not_attempted` → `unknown` when an attempt begins → `completed`; Breaking note for
  observers); branch targets resolve forward-only on the client path per §5.15 — the client and
  reference resolvers previously disagreed and the client could hop backward to an
  already-presented item (one shared forward-only helper, parity-pinned between both resolvers).
- **Hot-path performance (item-player):** the item body's `present()` — full DOM re-serialize,
  double sanitize, 2–3 parses — ran on every keystroke; it now rebuilds only when content-bearing
  inputs change (outcomes/templates/lifecycle/disabled/PnP plus the response identifiers the
  body actually prints), so typing no longer re-presents at all; the per-dispatch clone/validation
  fan-out dropped to one validation and one shared deeply-frozen transition (per-listener
  typed-array isolation preserved — the drawing-canvas pin still passes); extended text compares
  responses without stringifying the essay per keystroke.
- **i18n:** five keys referenced by player components existed in no locale (a screen-reader error
  announcement among them) — catalogued in all 8 locales (th/ar flagged for native review);
  `check:i18n` gained a consumer scan (every `t('…')`/`translate(…)` literal must exist in the en
  catalog — the scan that would have caught the five) and placeholder-name parity; key parameters
  gained `MessageKey` overloads with a documented string escape, the missing-key warning is no
  longer NODE_ENV-gated, and the README's dead `?? fallback` pattern is corrected.
- **API consistency:** the `QtiPciConfiguration` name collision between item-player and
  player-elements resolved (the facade's host-trust config renamed `QtiPciHostConfiguration`);
  the section facade's arbitrarily-renamed contract types are now 1:1 aliases at the contract
  names with a name-parity drift test (the dropped `toolId` union restored); the assessment
  element gained the five per-item injection properties (`i18n`/`pnp`/`role`/`plugins`/
  `stringComparison`) its siblings already had; the README documents the per-element failure
  channels and codes.
- **Test/docs rot:** test-utils' 17 dead exports (2/3 of the package) deleted with the README
  rewritten against the real surface (Breaking); pci-runner's sleep-racing tests converted to
  bounded poll-until; three vacuous tests now assert; to-pie's README no longer teaches imports
  from the wrong package; CONFIGURATION.md rewritten to the real config surface (the documented
  orchestration config function, file, and nine env vars never existed); ARCHITECTURE.md's
  phantom `packages/storage` removed; the demo Quickstart page linked (was orphaned), the demo
  port and the extractor count corrected; dead demo scripts and helpers deleted.

Recorded, not fixed (needs a design decision or native speakers): response-change detail shapes
and boolean-attribute grammars differ across the three elements (documented, not converged);
`submit()` signatures differ per element; ro/es register mixing and terminology drift need
native-speaker review; locale/placeholder type strictness could go further than the bounded
overloads; the demo a11y fixtures could deduplicate package helpers now that test-utils' surface
is honest.

---

## Round-5 review loop (2026-11-11)

Round 5 audited the renovations themselves (post-refactor integrity), ran a WCAG 2.2 AA pass
over the changed surface, gave the small packages their first dedicated code review, and traced
the cross-package seams the earlier rounds created. Six fix branches (`fix/r5-*`), each merged
behind a full GREEN gate (409 e2e):

- **The round-4 presentation cache froze printed time (caught by two reviewers
  independently):** the context comparison skipped `duration` unconditionally ("renders
  nowhere"), but `duration` is a printable built-in — an item printing
  `<printedVariable identifier="duration"/>` displayed a frozen elapsed time all attempt. The
  cache now compares exactly the context values the markup prints (the same printed-set gating
  the response side already had); the round-4 "typing presents once" guarantee is
  test-pinned unchanged.
- **WCAG 2.2 AA:** hottext's minimum-selection status was visual-only — the only min-choices
  interaction outside the shared hint pattern — and now uses `MinimumRequirementHint` (announced
  politely once per unmet stretch, `aria-describedby` wired while it shows); extended-text now
  wires the hint id into each field's description, the one consumer that didn't; the render-failed
  placeholder border moved from the error fill token (≈2.9:1) to the `*-text` stroke token the
  repo's own convention prescribes; registry-failure interactions (no component registered) now
  stand in with the same `role="alert"` placeholder as mount failures instead of vanishing.
- **pci-runner had the mirror of the round-3 connector bug:** it locked `event.origin` verbatim
  as its outbound targetOrigin, so a host page that is itself opaque (LTI-style sandboxed embed)
  silently dropped the entire bridge — outbound now posts `'*'` for the opaque spelling behind
  the structural `event.source === window.parent` anchor; teardown also stopped leaking empty
  container wrappers.
- **Seams:** section events (failure/delta/display-settings) no longer double-deliver when a
  host uses the composition host contract and DOM listeners together — the host slot wins, the
  callback prop is the documented fallback; the i18n consumer scan learned section-player's
  `interfaceText()` pattern (21 literal sites were invisible to it) and the README documents how
  host catalogs register so their keys pass CI; the assessment element's remaining hand mirrors
  (`QtiPnpProfile`, the PCI family) are 1:1 upstream aliases with compile-time identity pins.
- **Post-refactor consolidation:** the branch-target skip policy collapsed from four encoded
  sites (plus a stale "pure code motion" header) into one `branchLandingOf` classification
  shared by every consumer; AssessmentPlayer's two clone report-once helpers became one
  `reportOnce`; the `qti-role` list/parser is one export (`parseQtiRole`/`isQtiRole`) consumed
  by both elements (the assessment's copy warned unbounded with different fallback semantics).
- **Small packages & dead code:** web-component-loaders no longer cache a rejected import for
  the page lifetime nor keep a hand-duplicated 21-tag list (Breaking: `DEFAULT_INTERACTION_TAGS`
  removed); typeset-katex gets the same retry fix and its editor-ignore class is finally-guarded;
  the logger interface now requires all four levels per its documented console-compatibility
  intent (Breaking; dead `noopLogger`/`consoleLogger` deleted); core's dead `errors.ts`/
  `validator.ts` (17 exports, zero consumers) deleted along with core's phantom-element-schema
  dependency; the two wrong schemas (multiple-choice, match) now validate real to-pie
  transformer output — which exposed that **`@pie-qti/element-schemas` has zero importers
  left in the repo** after the dead validator went (subsequently deleted — see below);
  transform-types' dead storage interfaces removed (Breaking).

Recorded, not fixed: AssessmentPlayer.ts still ~4,260 lines (split parked); ItemBody absorbed
cache-key policy that could migrate to the presenter; `QtiProcessingFragment*` facade mirrors
unpinned; the other 11 element schemas unaudited against transformer output; acme-likert's
teaching example untouched by design; docs/prds storage prose describes aspirational interfaces.

---

## Rounds 6–7: loop closure (2026-11-11)

Round 6 was the structural confirmation pass over the whole tree with fresh eyes. Two of three
reviewers came back clean; the third found real survivors, fixed on `fix/r6-code` + `fix/r6-docs`
(both gated GREEN):

- Three parallel `inferBaseType` implementations fed the same assessment-result report model
  with divergent semantics (one writer emitted every undeclared number as `float`, the other as
  `integer`) — git archaeology showed the drift was born in a single commit. One shared rule now
  backs both report writers (undeclared scalar → boolean/integer/float/string; lists → integer
  only when every present member is whole), with the PCI copy keeping its deliberate `file`
  extension and naming the shared rule (behavior change noted in a changeset: undeclared numbers
  may now write `integer` in results XML).
- A duplicate-choice-identifier validation loop was inlined 13× across 11 interaction
  extractors — one `validateUniqueIdentifiers` helper with byte-identical messages.
- Three divergent serialized-HTML attribute readers (one accepted unpaired quotes and rejected
  empty values) — one `readHtmlAttribute` on the strictest shape.
- Loop-introduced doc rot: the logger README still taught the deleted `consoleLogger`;
  TRANSFORMATION-ENGINE.md still taught the phantom `createTestEngine` and asserted the wrong
  transform result shape; the plan doc's "closures documented for a future hoist" claim is now
  literally true (the parking comment exists at evalExpr).

The loop-audit third of round 6 verified the waves themselves: changesets cover every changed
publishable package with accurate Breaking notes; all 21 gate logs end `409 passed`; the parked
list has not escalated (the demo `Symbol.for` brand is intact, PCI gained no new concurrent load
paths, console.* counts match the record); `@pie-qti/element-schemas` confirmed at exactly zero
importers repo-wide (decision still pending).

Round 7 re-ran the confirmation adversarially against the round-6 fixes themselves and the
remaining axes — **verdict CLEAN**: the baseType unification is sound (null filtering matches
the writers' drop, heterogeneous lists documented and pinned), all 13 extractor sites preserve
messages and order, the strict attribute reader changes nothing for valid markup, no new
parallel helper families, net-negative src growth in the final commits, and the doc fixes match
their sources. The review loop ends here.

With the loop closed, the pending `@pie-qti/element-schemas` decision was taken: **the package
is deleted**. It had zero importers repo-wide, only two of its thirteen schemas aligned with
what the transformers actually emit, four emitted element types had no schema at all, and a
published-but-unwired validator that diverges from reality gives false confidence. It leaves the
fixed-versioning group and the publish-policy workspace roots; npm history is unaffected, and it
can be re-synced from upstream pie-elements later if a real consumer appears. (to-pie's
`packages/to-pie/schemas/` XSDs are unrelated vendored official schemas and stay.)

Beta-release readiness pass (2026-11-12): the pending
`.changeset/element-schemas-transformer-contract.md` changeset still bumped the deleted package
and would have hard-failed `changeset version` (assemble-release-plan throws on unknown
packages) — deleted, and the stale "schema home" pointer in
`transform-core-remove-dead-utils.md` corrected. `changeset status` now assembles: one version
run consumes the 166 pending changesets and moves all 25 fixed-group packages to
1.0.0-beta.5. The two declared `major` bumps and eight `minor`s are inert while `.changeset/pre.json`
is active — verified against the installed @changesets/assemble-release-plan 7.0.0 source: in
pre mode every bump type just increments the prerelease number, and on `changeset pre exit`
packages that took prerelease increments snap to stable with at most a patch.
