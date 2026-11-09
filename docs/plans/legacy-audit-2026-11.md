# Legacy, Shim and Backwards-Compatibility Audit — pie-qti player packages

**Date**: 2026-11-09
**Worktree**: `/Users/eelco/dev/prj/pie/pie-qti-wt-legacy` (detached at `develop` 64d90f27, clean)
**Mode**: read-only audit, committed as the plan of record for the no-legacy removals (policy: AGENTS.md, "Spec Compliance and No Legacy Code").
**Companion plans**: `docs/plans/player-cleanup-2026-11.md` (phases of record), `docs/SPEC-GAPS-PLAN.md` (policy + gaps).

## Policy

> **Policy (2026-11-09, AGENTS.md / SPEC-GAPS-PLAN.md):** follow the QTI spec wherever it is
> clear, per version. Supporting an older QTI version's *defined* behavior is compliance, not
> legacy — keep. No legacy code: shims, deprecated aliases, ignored parameters, pure-delegation
> wrappers, mirror types, or migration paths for the project's OWN past APIs/formats/behavior →
> remove. No non-spec leniency: reading attributes/elements no QTI version defines → remove
> unless real-world content needs it (evidence required).

Classification used below:

- **A** — our-own back-compat (our past API/format/behavior kept beside its replacement) → remove.
- **B** — non-spec leniency in QTI parsing (not defined by the in-repo XSDs of 2.1
  (`packages/to-pie/schemas/qti/imsqti_v2p1.xsd`), 2.2 (`imsqti_v2p2.xsd`) or 3.0
  (`packages/qti-common/schemas/qti3/imsqti_asiv3p0_v1p0.xsd`)) → removal candidate.
- **C** — spec-defined multi-version or third-party-ecosystem support → keep.
- **D** — duplication rather than legacy → cross-reference the cleanup plan (mostly Phase 4).

### Scope reality check

The scope list names packages that do not exist at this commit: `storage` (session persistence
lives in `packages/assessment-player/src/integration/session-store.ts`), `qti-to-pie` (only
`to-pie` and `pie-to-qti2` exist), `transform-core` (contracts live in `packages/types` /
`@pie-qti/transform-types`), `themes` (packages are `theme` and `theme-daisyui`). All were
audited under their actual names. `web-component-loaders`, `pie-to-qti2`, `test-utils`,
`theme`, `theme-daisyui` produced **zero** marker hits and are clean.

---

## Findings

### Class A — our-own back-compat → remove

| ID | Location | What it accepts | Evidence nothing produces it | Removal plan | Size | Conflicts |
|----|----------|-----------------|------------------------------|--------------|------|-----------|
| A1 | `packages/assessment-player/src/core/TimeManager.ts:20-24,234`; `AssessmentPlayer.ts:563`; `packages/player-elements/src/public/api.ts:375` | `TimeManagerConfig.warningThreshold` (singular), documented "Kept for compatibility; merged into `warningThresholds`" | Singular is the old field; the public host-facing option `timeWarningThreshold` (singular) is *not* deprecated and stays. Only AssessmentPlayer maps it, to the singular TimeManager field. | Rewire `AssessmentPlayer.ts:563` to seed `warningThresholds: [config.timeWarningThreshold \|\| 60, ...(config.timeWarningThresholds ?? [])]`; delete the singular field + the `thresholds.add(... ?? 60)` line + its doc. Public API unchanged → changeset note not required, but note the internal rewire. | ~8 lines, 1 package | None (Phase 1 does not touch TimeManager) |
| A2 | `packages/assessment-player/src/integration/api-contract.ts:571-572`; `AssessmentPlayer.ts:417,1840-1841,3655` | `FinalizeAssessmentResponse.feedback?: string` — "legacy: single string; prefer outcomes + assessment.testFeedback" — rendered as a synthetic `testFeedback` entry via `AssessmentPlayer.legacyFeedback` | Documented in-contract as legacy. Current contract path is `outcomes` + `assessment.testFeedback`; the reference adapter and docs use outcomes. `SubmitItemResponse.feedback` (array, api-contract.ts:460) is a current feature — do not touch. | Delete the contract field, the `legacyFeedback` field, the fallback at 1840-1841 and the assignment at 3655. **Breaking** wire-contract change: backends that answered a single string must move to `outcomes`. Changeset "Breaking:" note; update BACKEND-INTEGRATION docs if it mentions it. | ~8 lines + doc, 1 package (api-contract is re-exported; check downstream importers) | None in flight; Phase 5 touches finalize paths — land before Phase 5 pinning tests |
| A3 | `packages/assessment-player/src/integration/ReferenceBackendAdapter.ts:743-747,760,769-774` | `buildTestItems` fallback for "sessions stored before item test states existed": when `itemScores` has the item but `itemTestStates` does not, reconstructs variables from scores and infers correctness via `hasAnyResponse` on stored responses | `itemTestStates` is written on **every** submit (line 370) together with the score; a current-format `StoredSession` can never have one without the other. Only pre-beta sessions lack it. Storage has no format-version field at all (`session-store.ts:52-64` is plain `JSON.parse`). | Remove the `legacy` branch: `responded: presented && itemState?.responded === true`, always spread `correct`/`incorrect`. Then the adapter's private `hasAnyResponse` shim (lines 170-171) has **zero callers** — delete it too (this completes the Phase 3 shim removal). Consider making `StoredSession.itemTestStates` required (its remaining optionality is the legacy case). Changeset note: saved sessions from beta builds no longer restore scored-but-stateless items; per policy, acceptable pre-1.0. | ~14 lines, 1 package | **Phase 3** already removes `hasAnyResponse` — do A3 first (or together) so the shim dies as plain dead code rather than needing a replacement call site |
| A4 | `packages/section-player/src/tools/section-tool-config.ts:67-86,125` | `liftLegacyProviderKeys` maps the pre-1.0 toolkit TTS provider shape (string `provider`, nested `settings`, `validateEndpoint`) onto the 1.0 shape (`backend`, `serverProvider`, top-level settings) | The doc names it "the pre-1.0 toolkit shape mapped onto the 1.0 one"; nothing in-repo produces the old shape (grep: only this function reads it). | Delete the function; `resolveSectionTtsProviderConfig` uses the host record directly. **Breaking** for hosts still passing the old shape — changeset "Breaking:" note (the 1.0 shape was already the documented one). | ~22 lines incl. doc, 1 package | None |
| A5 | `packages/ims-cp-browser/src/image-resolver.ts:71-138`; exported at `src/index.ts:21` | `tryResolveImagePath` — `@deprecated` since the resolution moved to `@pie-qti/ims-cp-core` (`buildPackageFileIndex`/`resolvePackageReference`) | Zero callers in-repo (internal or apps); the deprecated JSDoc itself names the replacement. | Delete the function and the index export. Changeset note (exported, though dead). | ~70 lines, 1 package | None |
| A6 | `packages/to-pie/src/types/vendor-extensions.ts` (whole file); re-exported at `src/index.ts:128`; consumed internally by `src/plugin.ts:33`, `src/vendor-extension-runtime.ts:8`; 2 test imports | Pure re-export shim: "preserves the historical import path for to-pie consumers" after contracts moved to `@pie-qti/transform-types` | The doc says the types "now live" in transform-types; the shim holds zero declarations. | Repoint the 3 internal imports (and the 2 test imports) at `@pie-qti/transform-types`; delete the file and the index re-export block. **Breaking** for external importers of `@pie-qti/to-pie` type paths — changeset "Breaking:" note. Verify `to-pie/package.json` keeps/replaces the `transform-types` dependency. | ~22 lines + 5 import rewires, 2 packages | None |
| A7 | `packages/ims-cp-core/src/utils/qti-xml.ts:137-138`; `packages/to-pie/src/utils/metadata-extraction.ts:34-35`; `packages/to-pie/src/utils/manifest-lom.ts:107-129`; `packages/types/src/transform/pie-lom.ts:23-24` (constant `PIE_LOM_LEGACY_EXTENSION_SOURCE`) | PIE items' metadata bag read under its pre-rename name `searchMetaData` (`sourceModel.extensions ?? sourceModel.searchMetaData`), and LOM `taxonPath/source` prefix `pie:searchMetaData:` accepted beside the current `pie:extension:` ("read on import, never written") | The doc itself: packages "exported before the bag was named `extensions`"; nothing in-repo writes either old form (grep: only readers). Writer is `pie-to-qti2`, which writes `extensions`/`pie:extension:` only. | Drop the `?? sourceModel.searchMetaData` fallbacks; collapse `readLom` to the single current prefix; delete the constant + its doc in `packages/types` (types is outside the listed scope — same workspace, one PR). Changeset note: packages exported before the rename import without their extensions metadata. | ~16 lines across 3 packages | None |
| A8 | `packages/default-components/src/plugins/select-point/SelectPointInteraction.svelte:98-104` (inside `parsePoints`) | Inbound response points accepted as `{x, y}` objects beside the canonical `"x y"` strings | Nothing produces objects: the component emits `"x y"` (line 169-174), `InteractionValueMap` (cleanup plan Phase 2 fix 3) types selectPoint as `"x y" \| string[]`, no fixture/test feeds objects. Components are unpublished (`publish-policy.json` bans `./components`), so no external producer exists. | Remove the object branch of `parsePoints`; strings only. | ~6 lines, 1 package | Overlaps Phase 4's shared image-point helper — do in the Phase 4 PR or just before it |
| A9 | `packages/item-player/src/pci/qtiVariableJson.ts:73-75,146-152`; test `__tests__/qtiVariableJson.test.ts:147` | PCI variable JSON input accepts the project's **earlier name-keyed record form** `{"record": {"<field>": {...}}}` beside the spec array form | The writer (`toQtiVariableJson`/`recordToJson`, lines 102-107) emits only the spec array form (PCI v1.0 Appendix A, adopted by QTI 3.0); the doc calls the keyed form "earlier"; only the tolerance test feeds it. | Remove the keyed branch (`recordFromJson`'s `isPlainObject(record)` path) and the test. Changeset note: PCI modules seeded with a keyed-record state must move to the spec form. | ~10 lines + test, 1 package | None |

### Class B — non-spec leniency in QTI parsing → removal candidates

All checked against the three in-repo XSDs (QTI 2.1, 2.2, 3.0 ASI).

| ID | Location | What it accepts | XSD evidence | Real-world evidence in repo | Removal plan | Size | Conflicts |
|----|----------|-----------------|--------------|----------------------------|--------------|------|-----------|
| B1 | `packages/item-player/src/core/Player.ts:2092,2114,2132` (`parseMapping`); `packages/qti-processing/src/runtime/types.ts:41-49` (`Mapping.caseSensitive`); `packages/qti-processing/src/eval/evaluator.ts:85,103` (`findMappingEntry`) | Mapping-**level** `caseSensitive` attribute on `<mapping>`, used as the default for entries without their own | **None.** `Mapping.Type` (2.1 line 6347, 2.2 line 12814) has only `lowerBound`/`upperBound`/`defaultValue`; `MappingDType` (3.0 line 4673) only `lower-bound`/`upper-bound`/`default-value`. `caseSensitive` exists on `mapEntry`/`qti-map-entry` only. The types.ts doc claiming "QTI attribute on `<mapping>`" is factually wrong. | Nothing; this is the round-8 item. QTI 3.0's own docs say entries default to case-insensitive, which the entry-level code already implements. | Delete the mapping-level read and field; entries default to `'false'` (spec) when absent. No changeset (QTI-observable only for items that were invalid). | ~14 lines, 2 packages | Phase 6 decomposes Player.ts — land B1 before that or move the fix into it |
| B2 | `packages/qti-processing/src/runtime/value.ts:89-105,127-159` (`parseDurationSeconds` + `parseIsoDurationSeconds`) | ISO 8601 / xs:duration literals (`PT1H`) where QTI defines duration as a float in seconds | Durations are `xs:double`/`NonNegativeDouble` everywhere: 2.1 `minTime/maxTime.TimeLimits.Attr` (lines 721-727), 2.2 `NonNegativeDouble.Type`, 3.0 `NonNegativeDoubleDType` (line 8606). **Caveat:** the same parser is required at the PCI boundary — `packages/item-player/src/pci/qtiVariableJson.ts:198-238` implements PCI v1.0 Appendix A variable JSON, whose duration encoding *is* ISO 8601 (`"PT90S"`), and its decoder calls `parseDurationSeconds`. | Only the project's own fixtures use ISO in XML: `tests/conformance/fixtures/baseTypes_all/item.xml:93` (`PT1H`), `responseProcessing_inside_duration_statsOperator/item.xml` (`PT1S`/`PT2S`), plus unit tests `qti-processing/tests/duration.test.ts`, `item-player/tests/core/duration-seconds.test.ts`. | Split, don't just delete: keep `parseDurationSeconds` for the PCI JSON decode (spec-driven), but make the **XML lexical path** (`coerceBaseValue`'s `case 'duration'`, `value.ts:191`) accept only the xsd:double form; rewrite the two fixtures to seconds floats; update both duration tests. Changeset: items with ISO-duration XML literals no longer parse as durations (they were invalid XML). | ~35 lines net (PCI decoder intact), 2 packages + fixtures | None |
| B3 | `packages/qti-processing/src/ast/build.ts:693-710` (`equalRounded`) | `roundingMode` singular/case variants: `decimalplace`, `decimalplaces`, `significantfigure`, any case | 2.1 `roundingMode.EqualRounded.Attr` (line 1268) enumerates exactly `decimalPlaces`/`significantFigures` with default `significantFigures`; 2.2 identical (line 7505); 3.0 `EqualRoundedDType` same. The comment's justification ("for compatibility with QTI 2.1") is wrong — the 2.1 XSD defines it. | Only the project's own fixture uses the singular form: `tests/conformance/fixtures/responseProcessing_equalRounded_tolerance/item.xml:15` (`significantFigure`). | Strict enum match; fix the fixture spelling. Changeset note (invalid XML previously tolerated). | ~8 lines + fixture, 2 packages (fixture lives in item-player tests) | None |
| B4 | `packages/qti-processing/src/ast/build.ts:1039-1066` (`randomInteger`, `randomFloat`) | A "legacy child-expression form": 2-3 child expressions instead of `min`/`max`/`step` attributes | All three versions define them as **empty** elements: `RandomInteger.Type` extends `EmptyPrimitiveType.Type` with attribute groups (2.1 line 9317, 2.2 line 16462, 3.0 `RandomIntegerDType` line 8487); same for `RandomFloat`. | Comment says "older/variant content" but no in-repo fixture or sample uses the child form (grep of fixtures/tests: attribute form only). | Remove the child-expression branches; keep the attribute form + required-attr errors. Changeset note. | ~24 lines, 1 package | qti-processing AST tests exercise randomInteger — verify none uses the child form before removing (none found) |
| B5 | `packages/qti-processing/src/ast/build.ts:291-299` (`<console>`); test `tests/index-and-console-processing.test.ts:94-133` | A `<console>` statement in `responseProcessing`, treated as a no-op ("Diagnostic/vendor trace marker found in legacy fixtures") | `<console>` appears in none of the three XSDs (grep: zero matches). | No fixture uses it anywhere: only the tolerance test itself. (Orchestrator check: the `pie-qti-conformance` repo has no `<console>` in any fixture; its only match is its built bundle, which embeds this repo's parser.) | Remove the `case 'console'` arm (it then throws as unknown, matching the strictness at line 301-304); delete/trim the test. Changeset note. | ~9 lines + ~40 test lines, 1 package | None |

### Class C — keep (spec-defined multi-version / third-party ecosystem)

| ID | Location | Why it stays |
|----|----------|--------------|
| C1 | `packages/item-player/src/core/responseProcessingTemplates.ts`; `Player.ts:1571-1629` | `match_correct`, `map_response`, `map_response_point`, `no_response_processing` are the QTI standard rptemplates; `cc2_match`, `cc2_match_basic`, `cc2_map_response`, `cc2_map_response_point`, `match_nothing` are **official IMS template files** — fixtures are sourced from `https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/` (`tests/fixtures/official-response-processing-templates/CC2_match.xml:2`). Keep. Comment fix only: the inline "QTI 2.1 compatibility" notes at `Player.ts:1591,1622` are mislabeled — these are the official QTI 3.0 rptemplate set, not 2.1 compat. |
| C2 | `packages/item-player/src/interactions/media/extractor.ts:6` | "legacy QTI 2.1 `<object>`" = QTI 2.1's defined way to carry media (no `mediaInteraction` until 2.2). Per-version compliance → keep. |
| C3 | `packages/item-player/src/core/Player.ts:827-836` (`getAttrMapped`); `packages/player-elements/src/qti/parseAssessmentTest.ts:60` | QTI 2.x camelCase ↔ QTI 3.0 dash-case attribute mapping. Spec per version → keep. |
| C4 | `packages/qti-common/src/accessibility/apip.ts`, `markup.ts`; `packages/item-player/src/catalog/catalogLookup.ts:63-84` (`USAGE_ALIASES`) | APIP 1.0 → QTI 3 catalog mapping per 1EdTech's APIP-to-QTI-3 migration guide; usage aliases cover APIP-derived catalogs against QTI 3 usage names. Third-party ecosystem support → keep. |
| C5 | `packages/qti-common/src/version-detection/detectQtiVersion.ts:150-203` | Version detection incl. QTI 2.0 and namespace-tolerant fallbacks ("legacy document-wide check" = detection *strategy* for third-party content, not our old format). → keep. |
| C6 | `packages/i18n/src/core/direction.ts:37` | BCP-47 legacy subtags (`iw`/Hebrew). Language-tag standards handling, not our API. → keep. i18n otherwise clean: fallbacks are the standard en-US fallback locale + accessibility label fallbacks; **no renamed-key alias tables exist**. |
| C7 | `packages/item-player/src/pci/amdLoader.ts`, `resolutionConfig.ts` | The `shim` here is RequireJS-style config for non-AMD third-party PCI scripts — a feature, not a legacy shim. → keep. |
| C8 | `packages/item-player/src/core/sanitizer.ts:325` | Deprecated *HTML* background attributes in untrusted content. → keep. |
| C9 | `packages/default-components/src/shared/utils/webComponentHelpers.ts` (`parseJsonProp`) | Web-component attributes are strings; JSON-string parsing is the attribute bridge, not back-compat. → keep. All observedAttributes lists are dash-case only — **no old attribute/event names found** in player-elements, web-component-loaders or item-player elements. |
| C10 | `packages/item-player/src/core/Player.ts:1861-1885,1925-1942` | Serialized-state optional fields (`defaultValue`, `correctResponse`): optionality has a non-legacy reason (variables with no default / no correct response serialize without them). The "older-snapshot"/"older builds" comments can be reworded once A3-style cleanups land, but the code stays. |
| C11 | `packages/ims-cp-core/src/qti-heuristics.ts`, `packages/ims-cp-browser/src/image-resolver.ts` (lenient path resolution) | Deliberate, configurable, logged heuristics for real-world content-package path resolution (not QTI parsing). A documented feature with diagnostics → keep (revisit only with evidence of misuse). |
| C12 | `packages/player-elements/src/public/api.ts:349-356` (`rng`) | The element-level `rng` is **functional** — it seeds `new ReferenceBackendAdapter({ rng })` (`QtiAssessmentPlayerElement.ts:689`). Only the headless assessment-player `rng` is the deprecated ignored one (Phase 1). After Phase 1 lands, reword this doc comment (it references "the deprecated, ignored rng"); the field stays. |
| C13 | `packages/assessment-player/src/integration/api-contract.ts:289-290` (`SecureItemRef.deliveryContext`) | "Additive; itemXml remains the compatibility path" — both shapes are *current*: `itemXml` is produced by the reference adapter, `deliveryContext` by `qti-test-parser.ts:350`. Dual-shape with two live producers ≠ legacy. → keep. |

### Class D — duplication, not legacy (cross-reference the cleanup plan)

| ID | Location | Note |
|----|----------|------|
| D1 | `packages/item-player/src/server.ts:76,262` (`ServerSerializedItemSessionState`, `_ServerStateCompatibility`) | Mirror types nothing enforces — already on the cleanup plan's Deferred list (Phase 4-adjacent). Not re-planned here. |
| D2 | `packages/to-pie/src/plugin.ts:484-506,655-667` ("legacy-vendor-transformer" trace ids; "old method" `extractExtensions` fallback) | The class-based `VendorTransformer` API is the *current* plugin API (the deliberate `acme-likert-plugin` demo uses it); the config-driven extractor is the richer new path with the generic extractor as its default fallback. This is layering, not back-compat → keep behavior; optional comment/trace-label cleanup ("legacy") in a docs PR. |
| D3 | Phase 1/3 items | assessment-player ignored `rng` config + `getItemSessionInfo` param, item-player dead methods/exports, default-components no-op `structuredLabelSupport` (`ChoiceInteraction.svelte:33-38` — the only "kept for API compatibility" prop found in default-components), `ReferenceBackendAdapter.hasAnyResponse`, toolkit inline tool filter: all already owned by the committed plan; not re-audited. |

---

## Recommended removal sequence

Prerequisite: the current review-fix wave has landed (per the cleanup plan's execution model).
Every PR: one changeset, `lint:fix` + `typecheck` + `check` + affected tests; "Breaking:" notes
where a public/wire contract narrows.

1. **PR 1 — qti-processing strictness** (B1's qti-processing half, B3, B4, B5, B2-XML half):
   ~90 lines net removed across `ast/build.ts`, `runtime/value.ts`, `runtime/types.ts`,
   `eval/evaluator.ts` + fixture/test updates (2 fixtures live under item-player's conformance
   fixtures — same PR). B5 has no external content to coordinate (see its row).
2. **PR 2 — item-player parseMapping + PCI record form** (B1's item-player half, A9): ~24 lines.
   Independent of PR 1 (different files), but lands happily after it.
3. **PR 3 — assessment-player session/wire cleanup** (A1, A2, A3): ~30 lines. **Do A3 before or
   with the plan's Phase 3**, so the `hasAnyResponse` shim is deleted once, as dead code. Before
   Phase 5 (which pins finalize paths — A2 changes one).
4. **PR 4 — section-player tool config** (A4): ~22 lines. Breaking changeset for old-shape hosts.
5. **PR 5 — packaging shims** (A5, A6, A7): ~110 lines across ims-cp-browser, to-pie, ims-cp-core,
   types. Single PR because A7 and A6 both touch the to-pie/types boundary.
6. **PR 6 — default-components point parsing** (A8): ~6 lines; land together with (or just
   before) Phase 4's shared image-point helper so `parsePoints` moves once.
7. **Docs-only PR** (no code): C1 comment fix (CC2 = QTI 3.0 rptemplates, not "2.1
   compatibility"), C12 doc-comment reword after Phase 1, D2 trace-label rewording, and the
   `Player.ts:1871,1938` "older-snapshot" comment rewording after A3.

PRs 1-6 are mutually independent except the two noted orderings (A3↔Phase 3, A2↔Phase 5, A8↔Phase 4).

## Deliberately left (with reasoning)

- **PCI variable JSON ISO-8601 duration encoding** (`qtiVariableJson.ts:231-238`) and the
  `parseDurationSeconds` core (B2): required by the PCI v1.0 Appendix A binding (an external
  spec), not our invention. Only the XML-lexical leniency is removed (see B2).
- **CC2_\*/match_nothing templates** (C1): official IMS files; removing them would break real
  converted/official content.
- **IMS-CP lenient heuristics** (C11): configurable, diagnosable, default-on features for
  third-party package content — a product decision, not legacy. Flagged for the policy owner in
  case "no non-spec leniency" should extend to CP resolution; no evidence of harm in-repo.
- **`SecureItemRef.itemXml` + `deliveryContext` dual shape** (C13): two live producers.
- **Duplications** in D1/D3: owned by the committed plan; parallel removal would collide.
- **`acme-likert-plugin`**: excluded by scope (deliberate vendor demo plugin).

## Verification

Findings were verified by reading source and the three in-repo XSDs at this commit; line numbers
are exact at 64d90f27. No builds, installs or test runs were executed; the working tree contains
only this untracked file.
