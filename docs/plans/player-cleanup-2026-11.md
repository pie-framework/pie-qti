# QTI Player Cleanup — Duplication, Dead Code and Structure

**Status**: Approved 2026-11-08; not started. Execution begins after the current review-fix wave
has landed on `develop`.
**Last reviewed**: 2026-11-08
**Scope**: `packages/assessment-player/`, `packages/section-player/`, `packages/item-player/`,
`packages/default-components/`. The external conformance repo (`pie-qti-conformance`) is not ours
and is not changed by this plan.

A structural review of the four player packages looked for duplicated logic, dead code, god objects
and broken module boundaries. Three independent reviews then checked this plan for factual accuracy
and removal safety, delivery feasibility, and architectural soundness; three more checked it for QTI
compatibility at the item, test and interaction levels. This file is the plan of record and already
includes what those reviews changed.

**Ground rule: no refactor may change QTI-observable behavior** — response values and their lexical
forms, scoring, template processing, outcomes, the item-session lifecycle, feedback, navigation and
submission modes, branching, time limits, or the rendering of QTI 2.x/3.0 content. Intentional
behavior changes are listed explicitly as fixes (Phase 2 and the image-stage sizing rule in
Phase 4), land test-first, and are called out in their changesets.

Line numbers are deliberately omitted: `develop` moves quickly, so each phase re-measures its
targets at the current HEAD before starting.

---

## Findings in brief

- **God objects**: `assessment-player/src/core/AssessmentPlayer.ts` (4,156 lines),
  `assessment-player/src/components/AssessmentShell.svelte` (3,396),
  `item-player/src/core/Player.ts` (2,405).
- **Duplication**: graphic image stage ×7, keyboard pick-up/place ×4, keyboard crosshair ×2, pair
  mechanics re-implemented beside `pairHelpers.ts`, matchGroup blocked targets ×5, capacity rules ×6,
  sr-only CSS ×9, readable-name helpers ×7, `escapeHtml` ×5, clone/freeze ×5, config field lists ×5,
  `mergeDeliveryFields` ×2, name-mapper resolution ×3, PCI internals ×2, registry type→tag maps in two
  packages, section layout shells ×2, attempt-relative feedback rule ×2, `STORAGE_PREFIX` ×2.
- **Dead code**: listed per package in Phase 1.
- **Module boundaries**: raw `../../../<pkg>/src` imports across packages; a
  presentation ↔ components/utils directory cycle in item-player.
- **Existing QTI defects found during review** (not caused by this plan): position-object
  `maxChoices="0"`, associate `maxAssociations` default and enforcement, and graphic-associate
  `matchMax="0"`/`maxAssociations="0"` — all scheduled in Phase 2.

## Decisions from review

- **Documented host-facing APIs are not dead code.** Kept: `reporting/` (QTI Results Reporting,
  spec gap G-26), `scoreAssessmentItem`, `getAssessmentItemIdentifier`, the drawing utils, and
  section-player's `displaySettingsOf`, `applyToolSupports`, `companionMaterialsOf`,
  `companionToolIds`.
- **Removal rule**: an export is unused only if nothing in the repo uses it *and* no README, PRD,
  `docs/QTI_techguide.md`, `BACKEND-INTEGRATION.md`, server-api doc, changeset or SPEC-GAPS entry
  documents it. Each PR lists what it removed and the evidence.
- **Components stay unpublished.** `scripts/publish-policy.json` (`forbiddenPublicExports`) bans
  `./components` and `./shared/components`, and CI enforces it.
- **Kept deliberately separate** (similar shape, different job): client navigation legality vs
  backend branch evaluation; the client's presented-items record vs the backend contract's
  `state.visitedItems`; the submission-policy layer vs the constraint-validation layer; the iframe
  vs PCI-sandbox postMessage protocols (separately versioned wire contracts); the two PCI timeouts;
  the earliest `enforceItemXmlLimits` call; `.sr-only` in document vs shadow scopes; the public
  `ElementExtractor` API.

## Execution model

- **Short-lived PRs into `develop`**, one or more per phase; Phases 4 and 6 split per package.
- **Gates**: start only after the current review-fix wave has landed. Before Phases 4–6, confirm the
  overlapping in-flight branches have merged, or agree a freeze.
- **Move-only first**: decomposition PRs (Phases 5–6) are pure code motion; behavior cleanups follow
  in separate PRs.
- **Changesets**: one per PR, patch bump with explicit "Breaking:" migration notes (beta prerelease,
  fixed version group of 20 packages — a major bump would mean 2.0.0 for all of them after 1.0.0).
- **Checks on every PR**: `bun run lint:fix`, `bun run build`, `bun run typecheck`, `bun run check`,
  `bun run test` (turbo runs each package's own script, including component tests and
  assessment-player's preload), `bun run verify:publish:quick`, and `bun run check:doc-links` when
  docs change. Also `bun run test:certification:public` in Phases 1, 2 and 6; `bun run test:e2e`
  and `bun run test:a11y` in Phases 2–6; manual desktop/mobile and accessibility spot-checks of
  changed interactions.

## Phase 0 — Test typecheck safety net

- item-player: add `tsconfig.test.json` (extends `tsconfig.json`, `noEmit`, `rootDir: "."`, covers
  `src` and `tests`; exclude or shim tests that import `.svelte`) and chain it into `typecheck` the
  way section-player does (`tsc --noEmit && tsc -p ./tsconfig.test.json --noEmit`). `tsconfig.json`
  is the build config, so tests must not be added there. Fix the errors this surfaces (including the
  stale `VariableDeclaration` imports) in their own PR.
- assessment-player: the same, before Phase 5.

## Phase 1 — Dead code removal

- **assessment-player**: remove `session-store.removeSession`;
  `ItemSessionController.resetItem/clear/validateItem/canNavigateAway`, the
  `AssessmentSessionCoordinator.canNavigateAway` wrapper and their tests (no production callers;
  `canNavigateAway` gates navigation, contradicting QTI's "gate submission, not navigation" — the
  live `submissionGate` and item-player constraint validation implement `allowSkipping` and
  `validateResponses` correctly); `TimeTrackingState.currentSectionStartTime`; the ignored `rng`
  config (its changeset repeats the migration already in the changelog: pass the seed to
  `new ReferenceBackendAdapter({ rng })`); the ignored `getItemSessionInfo` parameter;
  undocumented, externally unused exports.
  Keep the methods the conformance runner calls: `create`, `getCurrentItem`,
  `updateResponseForItem`, `getNavigationState`, `next`, `submit`, `navigateTo`, `destroy`.
- **section-player**: remove the unused `@pie-players/pie-calculator-desmos` and
  `@pie-players/tts-client-server` dependencies together with their allowlist entries in
  `scripts/publish-policy.json`; remove `hasDisplaySettingsChanged` if undocumented.
- **item-player**: remove `Player.syncPciDisabledState`, `getTrustedTypesPolicyName`,
  `getExtractionRegistry`, `applySessionState`; `AssessmentItemDocument.detectVersion`;
  `QTIReadyEvent`, `QTIErrorEvent`, `QTISelectionChangeEvent` (never dispatched);
  `isSuccessResult`/`isErrorResult` (root exports — note in the changeset); `InteractionType`; the
  unused declaration types in `types/index.ts`; `LiveItemSession`'s optional-`prepared` branch; the
  `PciHost` string overload. Fix the stale comment in `pnp/types.ts`.
- **default-components**: remove `isSourcePaired`/`isTargetPaired`; stop exporting
  `MIN_TARGET_PX`/`parseCoords`; remove Choice's no-op `structuredLabelSupport` (Match keeps its
  own).
- **External conformance repo** (`pie-qti-conformance`): not ours, and not changed by this plan. It
  pins the published `@pie-qti/*` packages at `0.1.21`, where `AssessmentPlayer.create({ rng })`
  still seeds the draw, so nothing here reaches it until its maintainers upgrade. The seeding move
  to `new ReferenceBackendAdapter({ rng })` is already in the assessment-player changelog. Keep the
  player methods its runner calls stable (listed above).

## Phase 2 — Behavioral fixes (test-first)

Each item changes QTI-observable behavior on purpose, lands with its tests written first, and
carries a changeset note.

1. **`isShowingCorrect`.** Use the shell semantics (`role === 'scorer' && parsedCorrectResponse !==
   undefined`) everywhere via `createInteractionShell`. Today the inline `!== null` copies put scorer
   views of items without a correct response into correct-answer mode. Test per component: role
   (candidate/scorer) × correct response (present/absent); scorer + absent means no correct-answer
   mode and normal emissions; interactivity stays governed only by `disabled`.
2. **Accessible names.** Shared helper: authored label, else a localized ordinal, never the
   identifier. Fix associate, match and the gap-match image fallback now; the other copies move in
   Phase 4. Test: a textless associate choice and an alt-less `gapImg` get non-empty names that
   contain no identifier.
3. **`InteractionValueMap`.** Retype each entry from QTI baseType × cardinality to what the
   `qti-change` event carries (raw component output; the element's `response` is normalized
   separately by `Player.getResponses`): associate/graphicAssociate `string[]` of `"A B"`;
   match/gapMatch/graphicGapMatch `string[]` of `"source target"`; positionObject `string[]` of
   `"x y"`; selectPoint `"x y" | string[]`; hotspot/hottext `string | string[]`; drawing
   `QTIFileResponse`; media `number`; add `| null` wherever a component emits a clear (choice,
   hottext, selectPoint, drawing). Types only, zero runtime diff, with a compile-time assignability
   check per entry. Fix the examples in the position-object and order PRDs.
4. **Backend branch decision (`nextItemIdentifier`).** Today Check Answer submits without following
   branching, and a following Next with unchanged responses skips submission and moves to a locally
   chosen item; simultaneous parts ignore the decision and cross parts without honoring the next
   part's preCondition. The fix:
   - keep the decision per item, from counted submissions only (not hints), stored with that item's
     last-submission record;
   - follow it only while the responses are unchanged and no other counted submission has happened
     since (a sequence number), so testPart rules in nonlinear parts can't go stale;
   - follow it through `followBranch`, so the part-leave, `EXIT_TEST` and finalized guards apply;
   - clear it on start-over and finalize, ignore it once an end reason is set, and make live and
     restored sessions land identically (persist it with the last-submission record, or drop both);
   - in simultaneous parts, read the decision only at the part-crossing call sites from the
     response for the part's last item, never during end-of-test collection (which reuses the
     simultaneous submit path for every item); reject targets inside the part that is ending; honor
     the following part's preCondition.

   Tests first: (1) linear part, maxAttempts=2, item branchRule — Check, then Next unchanged lands
   on the target with no extra backend submit and numAttempts=1; (2) the same after both attempts
   were used through Check; (3) Check, change the answer, Next follows the new decision; (4) hint
   then Next uses only the counted decision; (5) nonlinear part with a testPart rule on the test
   score — check the last item, go back, submit another, return, Next; (6) Check, `getState`,
   `restoreState`, Next — same landing, no extra attempt; (7) a branch target whose testPart
   preCondition is false is skipped; (8) simultaneous part with a testPart branchRule lands on its
   target, a following part with a false preCondition is skipped, a partial-failure retry lands
   correctly, and `EXIT_TEST` still finalizes once without navigating.
5. **position-object `maxChoices="0"`.** QTI and the PRD (AC-E2) define 0 as unlimited, but the
   extractor sets each stage's `matchMax` to `maxChoices` and the component's per-stage checks
   (`canDragStage`, `placeStageAt`) compare against it without treating 0 as unlimited — so every
   object is unplaceable (`canAddMore` already handles 0). Fix the per-stage checks. Tests:
   `maxChoices="0"` places several objects; absent means 1; `2` refuses the third; restoring a saved
   response.
6. **associate `maxAssociations`.** The extractor defaults it to 0 (unlimited) and the component
   enforces nothing; QTI and the PRD default it to 1, and the PRD (FR-5) requires the UI to refuse
   further pairs at the limit. Fix: default 1 for QTI 2 `maxAssociations` and QTI 3
   `max-associations`; enforce the limit in the component with a visible, announced limit state;
   0 means unlimited. Tests: absent gives one pair then refusal; `0` is unlimited; `2` refuses the
   third; pointer and keyboard. Changeset "Breaking:" note: items without the attribute become
   one-pair interactions, per the spec default.
7. **graphic-associate `matchMax="0"` and `maxAssociations="0"`.** Decided: a capacity of 0 means
   no limit — a reading that makes an interaction unusable is not acceptable. Today graphic-associate
   blocks a hotspot with `matchMax="0"` (its hotspot capacity checks) and blocks every association
   with `maxAssociations="0"` (`canAddMore`), and its PRD documents both as "not unlimited". Fix
   both checks and correct the PRD. A sweep of every capacity comparison in default-components
   found no other place where 0 blocks besides position-object (fix 5); the other interactions
   already treat 0 as unlimited. Tests: `0`, absent and `2` for both attributes, pointer and
   keyboard. The Phase 4 capacity helper implements the same rule for every interaction.

## Phase 3 — Module boundaries (publish model unchanged)

- Replace the raw `../../../<pkg>/src` imports (three in player-elements, including AssessmentShell;
  two in assessment-player) with names from **one** workspace-only alias map read by the
  player-elements and demo vite configs and by tsconfig `paths`. Teach `scripts/check-deps.mjs` the
  map, or keep its exemption. Keep the demo aliases (Playwright e2e runs on vite dev); delete only
  the stale `item-player/components` aliases in player-elements and assessment-player.
- Break item-player's presentation ↔ components/utils directory cycle.
- Single sources:
  - `STORAGE_PREFIX` — keep the value `qti_session_`; resuming saved sessions depends on it.
  - Remove the `ReferenceBackendAdapter.hasAnyResponse` shim (pure delegation).
  - Replace assessment-toolkit's inline tool filter with section-player's (identical when called
    without PNP — call it that way).
  - Export `DEFAULT_COMPONENT_TAGS_BY_TYPE` from item-player and derive default-components' registry
    from it, **excluding `catalogPopup`**, which is registered separately. Tests: derived keys equal
    the 20 interaction types, `catalogPopup` is registered exactly once, tag names are unchanged.

## Phase 4 — Remove duplication (one PR per package)

**default-components**

- **`ImageStage`** for the seven graphic stages, plus a shared image-point helper. The sizing rule
  becomes explicit: declared width/height → natural size → refuse with an authoring diagnostic
  (today's hotspot and graphic-gap-match behavior). For select-point, graphic-order and
  graphic-associate (500×300 default) and position-object (800×600) this changes emitted points for
  images without a declared size. That is QTI-correct (coords, points and areaMapping live in image
  pixel space) but observable, so it lands as its own test-first commit with a changeset note.
  position-object's per-object `objectDimension` fallback and centerPoint logic stay
  per-interaction. Tests: an 800×600 image rendered at 400 CSS px emits identical natural-space
  points and SVG viewBox per interaction; a table test pins each interaction's sizing outcome.
- **Keyboard pick-up/place controller** (gap-match, graphic-gap-match, MatchDragDrop, SortableList):
  preserves matchMax/matchMin (0 = unlimited), one choice per gap, order semantics,
  and matchGroup gating through the shared rule.
- **`KeyboardCrosshair`** (select-point, position-object): rounding stays per interaction
  (select-point rounds at placement, position-object at emission); emitted points are integers
  clamped to the stage; position-object keeps stage capacity, `canAddMore` and Escape-cancel;
  select-point keeps `maxChoices`. Keyboard tests assert identical emissions and refusals before and
  after.
- **Pair helpers**: graphic-gap-match must not adopt `createOrUpdatePair` as-is — it keeps a moved
  label on its old hotspot, while graphic-gap-match always moves it. Build a move-aware helper from
  gap-match's matchMax rule (`handleGapChange`); keep directedPair `"source target"` order; associate
  keeps its unordered pair comparison. Property tests: dropping a matchMax=1 label from H1 onto H2
  leaves exactly `"L H2"`; every emitted pair is in source-target order for its interaction.
- **Blocked targets**: every copy stays on the shared `isMatchGroupCompatible` rule (Player
  validation and the matchGroup alignment use it too); associate's self-exclusion is display-only.
  Golden tests: UI blocking equals validation errors for one-sided, shared-token, mutual and empty
  groups.
- **Capacity and messaging helper**: takes explicit values, treats 0 as unlimited, imposes no
  defaults; a test freezes the extractor defaults so the dedup can't normalize them.
- Remaining readable-name copies move to the Phase 2 helper; one `.sr-only` source injected in both
  document and shadow scopes (drop the seven private copies); shared icons; an announcer helper;
  `InteractionProps<T>`.

**item-player**

- One `escapeHtml` family (every copy escapes double-quoted attribute values and node-html-parser
  attributes arrive decoded, so there is no double-escaping).
- One clone/freeze util: copy ArrayBuffers and typed arrays and never freeze them (`Object.freeze`
  throws on a non-empty `Uint8ClampedArray`, such as a drawing response's `imageData`); keep
  TrustedHTML, File and Blob by identity; never `structuredClone` presentation or extraction data
  (TrustedHTML throws `DataCloneError`). Tests: a Trusted Types presentation; customOperator scoring
  on `imageData` after `state()`, serialize and restore.
- One `mergeDeliveryFields` (both copies are last-wins with the standard policy applied last — keep
  that).
- One name-mapper helper: an unknown version maps to QTI 2.x; explicitly passed mappers win; the
  definition path keeps choosing the attribute mapper from the detected version; the
  `createExtractionUtils()` default stays QTI 2.x.
- PCI: share only `resolveUrl` and entry-module selection (the copies are identical); keep the
  page-realm single-module path on `fallbackPath`; the timeouts stay separate.
- **responseIdentifier lookup**: one helper accepting the union {mapper-native name,
  `responseIdentifier`, `response-identifier`}, case-insensitive on HTML trees. Interaction
  detection stays three parameterized predicates (slot hiding, extraction and diagnostics differ on
  purpose) sharing one vocabulary; `normalizedType` stays byte-identical because it keys the
  sanitization policy. Table-driven test across QTI 2, QTI 3, mixed-version, vendor,
  PCI-in-customInteraction, endAttempt and unbound elements, asserting the extracted,
  slotted/hidden and diagnosed sets.
- **Table parser**: Player's spec-path parser (the one that trims values) moves into qti-processing
  as the single implementation; the name mapper is a required parameter; target values stay lexical
  and are coerced in `lookupOutcomeValue`. (qti-processing's non-QTI `<lookupTable>` expression
  parsing was removed since, in refactor/no-legacy-nonspec-expressions.)
- default-components imports `patternExcludesMinus`/`classExcludesMinus` from item-player; the two
  wrappers (base > 10 and record handling) stay separate.

**assessment-player and section-player**

- Shared section layout module for `SectionPlayerVertical`/`SectionPlayerSplitPane` (role and view
  filtering already happens once, in the composition).
- Feedback helper: `resolveMaxAttempts(settings, adaptive): number | null` plus
  `attemptFeedbackVisible({ showFeedback, maxAttempts, attempts, adaptive })` with the player's
  semantics. The two current rules differ in four ways (unlimited as 0 vs null, live vs projected
  attempt count, the result before the first attempt, the adaptive override) and feed different
  outputs; `getItemSessionInfo().showFeedback` keeps its current semantics unless changed on purpose
  with a changeset note. Table test: showFeedback × maxAttempts (1, 2, unlimited) × attempts ×
  adaptive, checking both outputs.
- `TimeManager.formatTime` moves to a util.

## Phase 5 — assessment-player decomposition (pinning tests first, then move-only)

**Pinning tests before any code moves** (nothing pins these today):

- Submit paths: individual vs simultaneous × backend returns or omits `updatedState` — attempts,
  numAttempts, visitedItems order, itemScores and allowReview afterwards; a failing backend leaves
  state unchanged (individual commits nothing; simultaneous keeps already-accepted items).
- Listener order: item → section → test feedback, synchronous, before the move's promise resolves.
- Timing: submission timing evidence and durations are captured before the item clock stops; a
  simultaneous part is submitted before its clocks stop and the next scopes start; a fake-clock test
  for item maxTime with `allowLateSubmission=false` (Next at the limit minus ε is not expired, and
  leaving doesn't change the recorded time); crossing a simultaneous part's maxTime.
- Gates: the part-leave gate and a minTime refusal make no backend call.
- Element façade: type the AssessmentShell exports that `QtiAssessmentPlayerElement` calls (today
  `any` with optional chaining, which silently no-ops if an export moves) and test each element
  method.

**Shape**: one orchestrator keeps the public façade and owns the transition lock (`runExclusive`,
not reentrant), the current item and the terminal state. Pure policy functions (navigation
legality, submission gate, feedback visibility, exit-boundary resolution, scope locks, review views)
never take the lock. Independent pieces: a typed event emitter replacing the 13 listener sets,
pause, autosave. The timer-driven expiry path keeps today's lock behavior unless a test shows a race.
`AssessmentSessionCoordinator` becomes the only writer of session state, through methods that
reproduce all four submit-path combinations (removing the direct `this.state.*` writes and their
`as any` casts); the state shape sent to backends does not change.

**Kept separate**: client legality checks vs backend branch evaluation (core never imports
`integration/test-navigation.ts`; pure scope helpers are shared through `testStructure.ts`); the
presented-items record vs `state.visitedItems` (rename for clarity; regression test with autosave
off and an `updatedState` listing only submitted items); submission policy vs constraint validation.

**Shell split**: dialogs become child components; `initialize()` becomes a `createPlayerConnection`
composable; display settings move to a module; flags derive from one status object where feasible.

## Phase 6 — item-player decomposition (invariant tests first, then move-only)

- Split `Player.ts` into `declarations/`, `processing/`, `rendering/`, `serialization/`, `pciHost/`
  and `catalog/` behind `ItemSession` and `createAssessmentItemDefinition`; separate compile-time
  from runtime.
- **Per-session invariants** — the definition holds only immutable, source-derived data:
  declarations are deep-cloned per session (template rules mutate them in place); templateDefaults
  apply before template processing and are reused by newTemplate and templateConstraint restarts;
  correct responses are read live from the session; rng, the shuffle seed (`sessionGuid`) and the
  start time are created per session; restore skips template processing; `prepareContentMarkup`
  runs exactly once, on the raw XML (it generates the `ssml-N` idrefs). Tests: session isolation
  with random setCorrectResponse/setDefaultValue; templateDefaults survive newTemplate and a
  constraint restart; shuffle differs per session but is stable across restore; the seed-42 template
  fixtures are unchanged.
- **Test-only Player methods**: migrate tests where the façade has an equivalent (lifecycle through
  `dispatch`, templates through `state()`, diagnostics through `definition.diagnostics`, correct
  responses through a scorer-role `present()`); keep internal test seams for `restoreResponses`,
  `setTemplateVariables`, `getDeclarations`, `getProgress` and `getHintEndAttemptIdentifiers`.
  `docs/certification/public-coverage-matrix.json` references
  `tests/core/item-session-lifecycle.test.ts`, and the item clean-room harness builds `new Player` —
  update both in the same commit and run the certification runner with `--skip-e2e` before and
  after.
- **Validation**: keep today's generic field checks on for every interaction; per-type entries only
  restate today's media, endAttempt and extendedText special cases, keyed on the delivered `type`
  (the extractor's `outputType` — vendor overrides such as acme-likert emit `choiceInteraction` with
  their own data); add no constraints; the public `ElementExtractor` is unchanged. Golden snapshot of
  the validation entries and `isAttempted` across all fixtures (QTI 2 and converted QTI 3),
  acme-likert and a vendor `outputType`.
- **Performance**: cache the extended-text `base` per interaction identifier, never the mutable parse
  tree; memoize only the base `validateResponses`, keyed on response revision and the
  interaction-data cache — the end-attempt gate (`validateAttemptResponses`, before response
  processing) stays separate, serialized `validationMessages` never contain `incomplete`, and
  `canSubmit` stays correct after newTemplate; keep the earliest `enforceItemXmlLimits` on every
  entry path.

## Phase 7 — Finalize

- Update docs for removed APIs (the drawing docs stay) and the PRDs touched by Phase 2
  (position-object, associate, graphic-associate, and the
  `InteractionValueMap` examples).
- Run the full gates plus certification, e2e and a11y; manual desktop/mobile and accessibility
  checks of the changed interactions.
- Condense this file into a decision record (repo convention) and write the final report: removed
  inventory with line counts, fixes, deferred items.

## Deferred

- Component splits beyond the shared-module extraction (PositionObject and GraphicGapMatch
  internals).
- section-player spoken-catalog parsing vs item-player catalog parsing.
- `TimeManager` tick restructuring; hottext's imperative DOM manipulation.

### Assessment player: parked (2026-11-10)

Work on the assessment player stops after Phase 5. Most integrators build their own shell on the
section and item players, so the remaining effort goes to those layers. These findings are
recorded, not scheduled:

- Toggle controls in the shell whose visible label flips while `aria-expanded` also changes: the
  timer show/hide control and the review button.
- The scope-expiry hop (`leaveExpiredScope`) runs outside the transition lock; downstream guards
  compensate and no test shows a race.
- `core/AssessmentPlayer.ts` still imports `integration/test-navigation.ts` for the client's
  delivery-rules walk.
- The shared `.submit-dialog-action` styles are repeated in three dialog components.
- About 7.9 KB of assessment- and section-player modules still ship twice in player-elements (the
  error class identity is safe through its brand).

## Existing code to reuse

- default-components: `pairHelpers.ts`, `createInteractionShell`,
  `matchGroupUtils.isCompatibleMatchGroup`, `confirmationFlow.svelte.ts`,
  `eventHelpers.createQtiChangeEvent`.
- section-player: `display-settings.ts`, `notifyRuntimeHost`.
- assessment-player: `testStructure.ts`.
- qti-common: `detectQtiVersion`. qti-processing: `childElements`, `localName`.
- item-player: the `security/` module.
