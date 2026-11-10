# QTI Player Cleanup — Decision Record

**Status**: Landed — Phases 0–7 executed 2026-11-08 → 2026-11-10, closed with a final review round
and the full verification suite. This file is condensed to the decisions and outcomes; the full
working plan lives in git history (branch-merge history on `develop` from `d697ed83` to `8f76acd7`).
**Last reviewed**: 2026-11-10
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
  readable names (6+), `createAnnouncer` (11), one `.sr-only` source injected into document and
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
