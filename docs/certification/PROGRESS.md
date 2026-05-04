# QTI Certification Progress Tracker

Last updated: 2026-05-04 (QTI 3.0 Advanced implementation verification complete: I18 MathML v3 patched/tested, deterministic automated tests added, all 20 Advanced packages load through the demo conformance page; member validator + checklist + submission remain external certification operations)

This document tracks the live status of each certification milestone. Update it whenever:
- A gap is closed (link the PR/commit)
- A test package run is completed
- A checklist workbook is submitted
- A certification is awarded

For strategy rationale and effort estimates see [STRATEGY.md](STRATEGY.md).
This file is the source of truth for remaining certification work and historical gap status.

Elective level (QTI 2.2 and QTI 3.0) is not being pursued. See [STRATEGY.md](STRATEGY.md).

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🔵 | In progress |
| 🟡 | Blocked / needs investigation |
| ✅ | Complete |
| 🏆 | Certified |

---

## Milestone 1 — QTI 2.2 Basic DELIVERY

**Overall status**: 🔵 In progress — automated tests pass, member validator + checklist pending  
**Target date**: —  
**Submitted**: —  
**Certified**: —

### Static analysis (2026-04-29)

All DELIVERY criteria verified against codebase. No implementation gaps found.

| Feature | Static analysis | Notes |
| --- | --- | --- |
| Q2 single cardinality | ✅ Pass | `choiceExtractor.ts`, `Player.ts:1307–1343` |
| Q2 multiple cardinality | ✅ Pass | Same path; empty array = valid empty Multiple container |
| Q5 Extended Text | ✅ Pass | `extendedTextExtractor.ts`, `Player.ts:1341–1342` |
| Q20 Text Entry | ✅ Pass | `textEntryExtractor.ts`, same coercion path |
| I9b match_correct template | ✅ Pass | `qti-processing` AST + evaluator |
| I9b map_response template | ✅ Pass | Per-identifier mapping; default=0 for unmapped |
| I0/I1/I2/I7/I8 (item root, declarations, body, HTML) | ✅ Pass | Implicit — required for Q2/Q5/Q20/I9b to work; `Player.ts:128–133` |
| A1 Alternate text for graphics | ✅ Pass | `sanitizer.ts` — `alt` never stripped |
| T4/T7 Test Part + Section structure | ✅ Pass | `AssessmentPlayer.ts:142–143` |
| T14 Record & Restore Responses | ✅ Pass | `AssessmentPlayer.ts:288,344–373` — `itemResponses` persisted; `restoreState()` rehydrates |
| P1/P4 Test/Item Instances (IMS CP) | ✅ Pass | Manifest parsing + item extraction in assessment player |

### Test execution checklist

| Step | Status | Notes |
|------|--------|-------|
| Run `Basic Level/Q2 - Choice Interaction/single-cardinality/` test package | ✅ | Automated: `qti22_basic_q2_single` fixture (D51–D55) + live runner (`run-conformance-packages.test.ts`) |
| Run `Basic Level/Q2 - Choice Interaction/multiple-cardinality/` test package | ✅ | Automated: `qti22_basic_q2_multiple` fixture (D1–D7) + live runner |
| Run `Basic Level/Q5 - Extended Text Entry Interaction/baseType-string/` test package | ✅ | Automated: `qti22_basic_q5` fixture (D1–D2) + live runner |
| Run `Basic Level/Q20 - Text Entry Interaction/baseType-string/` test package | ✅ | Automated: `qti22_basic_q20` fixture (D1–D2) + live runner |
| Run `Basic Level/I9b - Response Processing Fixed Template/match-correct-identifier/` test package | ✅ | Automated: `qti22_basic_i9b_match_correct` fixture + live runner |
| Run `Basic Level/I9b - Response Processing Fixed Template/map-response-identifier/` test package | ✅ | Automated: `qti22_basic_i9b_map_response` fixture (D1–D11) + live runner |
| Run `Basic Level/T4 and T7 - Test Structures/` test package | ✅ | Automated: `conformance-qti22-basic.test.ts` (T4-D1/D2, T7-D1/D2, T14-D1) + live runner |
| Run `Basic Level/A1 - Alternate Text for Graphics/` test package | ⬜ | Manual — verify alt attribute passthrough in rendered HTML |
| Validate XML with member validator (https://membervalidator3.1edtech.org/) | ⬜ | Manual — upload official test package ZIPs |
| Complete `QTI 2p2 Delivery Certification Checklist.xlsx` | ⬜ | Manual — after member validator pass |
| Submit checklist to 1EdTech | ⬜ | Manual — after checklist complete |

**Implementation gaps**: None identified.

---

## Milestone 2 — QTI 2.2 Advanced DELIVERY

**Overall status**: 🔵 In progress — all test packages verified (automated + visual), member validator + checklist pending  
**Target date**: —  
**Submitted**: —  
**Certified**: —  
**Prerequisite**: Milestone 1 (QTI 2.2 Basic) must be certified first.

### Open gaps to close before test run

| Gap | Status | PRD | PR / Commit | Notes |
| --- | --- | --- | --- | --- |
| T9 — Full `<outcomeProcessing>` XML interpreter | ✅ Implemented | — | develop | `ReferenceBackendAdapter.runOutcomeProcessing()` — parses XML, runs `buildOutcomeProcessingAst` + `execProgram` with `testVariables` support |
| S1 — Section-level `itemSessionControl` | ✅ Implemented | — | develop | `AssessmentPlayer.getEffectiveItemSessionControl()` — three-level merge (section → testPart → defaults); applied on `navigateTo()` |
| S9 — `assessmentSectionRef` external file resolution | ✅ Implemented | — | develop | `ReferenceBackendAdapter.parseAssessmentTestXml()` — resolves `href` via `fileResolver` callback |
| I18 — MathML v2 rendering | ✅ Implemented | — | develop | `@pie-qti/typeset-katex` wired into `ItemPlayer.svelte` via `effectiveTypeset = typeset ?? typesetMathInElement` |
| P7 — QTI Metadata delivery | 🟡 Needs verification | — | — | No DELIVERY acceptance criteria in README ("no specific criteria at this time") — verify this is a no-op for certification |

### Test execution checklist

| Step | Status | Notes |
|------|--------|-------|
| Close / resolve all gaps above | ✅ | T9, S1, S9, I18 implemented; P7 verified no delivery criteria |
| Run `Advanced Level/T1 - Outcome Declaration/` test package | ✅ | Automated: `conformance-qti22-advanced.test.ts` (T1-D1, T9-D1 ×3) |
| Run `Advanced Level/T5 - Test Parts - Item Session Control/` test package | ✅ | Automated: `conformance-qti22-advanced.test.ts` (T5-D1 ×3) |
| Run `Advanced Level/T12 - Sections/` test package | ✅ | Automated: T12-D1, T2-D1, S1-D1/D2, S9-D1 (14 tests) |
| Run `Advanced Level/Q6 - Gap Match Interaction/` test package | ✅ | Automated: `qti22_advanced_q6_gap_match` fixture (D1/D2 ×6 cases) |
| Run `Advanced Level/Q8 - Graphic Gap Match Interaction/` test package | ✅ | Visual: official ZIP via conformance page — UK airport PNG renders, 6 gap images + 3 rect hotspots (b9ee1de) |
| Run `Advanced Level/Q10 - Hotspot/` test package | ✅ | Visual: official ZIP via conformance page — UK cities PNG (circles), polygon shapes SVG (plants.svg) all render (b9ee1de) |
| Run `Advanced Level/Q11 - Hot-text Interaction/` test package | ✅ | Visual: official ZIP via conformance page — single + multiple cardinality, selection/counter works |
| Run `Advanced Level/Q12 - Inline Choice Interaction/` test package | ✅ | Automated: `qti22_advanced_q12_inline_choice` fixture (D1/D3/D4/D5 ×6 cases) |
| Run `Advanced Level/Q13 - Match Interaction/` test package | ✅ | Automated: `qti22_advanced_q13_match` fixture (D2/D3/D4 ×5 cases) |
| Run `Advanced Level/I17 - Composite Item/` test package | ✅ | Automated: `qti22_advanced_i17_i9a_composite` fixture (I17-D1, I9-D1/D2/D3/D11 ×11 cases) |
| Run `Advanced Level/S3 and S4/` test package | ✅ | No DELIVERY criteria in README (EXPORT/IMPORT/AUTHORING only) — N/A for delivery cert |
| Run `Advanced Level/S5 - Rubric Block in Sections/` test package | ✅ | Automated: `conformance-qti22-advanced.test.ts` S5-D1/D2/D3 + getCurrentRubricBlocks() per-section (5 tests) |
| Run `Advanced Level/P7 – QTI Metadata/` test package | ✅ | Visual: official ZIP renders "Unattended Luggage" choice item; README confirms no specific delivery criteria |
| Validate XML with member validator | ⬜ | Manual — upload official test package ZIPs |
| Complete `QTI 2p2 Delivery Certification Checklist.xlsx` (Advanced section) | ⬜ | Manual — after member validator pass |
| Submit checklist to 1EdTech | ⬜ | Manual — after checklist complete |

---

## Milestone 3 — QTI 3.0 Basic DELIVERY

**Overall status**: 🔵 In progress — Shared Vocabulary gaps closed; automated extractor tests pass; visual run + member validator pending  
**Target date**: —  
**Submitted**: —  
**Certified**: —  
**Prerequisite**: Milestone 1 (QTI 2.2 Basic) must be certified first.

### Open gaps closed (2026-05-03)

| Gap | Status | PR / Commit | Notes |
| --- | --- | --- | --- |
| I19a — Shared Vocabulary CSS class passthrough (sanitizer) | ✅ Verified | — | `class` attribute passes through untouched (`sanitizer.ts:110–157`) |
| Q2 — `qti-labels-*` / `qti-orientation-*` interaction classes | ✅ Implemented | develop | `choiceExtractor.ts` extracts `interactionClasses`; `ChoiceInteraction.svelte` spreads them onto root element |
| Q5 — `qti-height-lines-N` interaction classes | ✅ Implemented | develop | `extendedTextExtractor.ts` extracts `interactionClasses`; `ExtendedTextInteraction.svelte` spreads + adds CSS for `--qti-min-height` |
| Q20 — `qti-input-width-N` interaction classes | ✅ Implemented | develop | `textEntryExtractor.ts` extracts `interactionClasses`; `ItemBody.svelte` applies `qti-input-width-N` class + CSS `ch`-unit rules |
| Q20 — `data-patternmask-message` | ✅ Implemented | develop | Extracted to `patternMaskMessage` in `TextEntryInteractionData`; used as custom `oninvalid` message in `ItemBody.svelte` |

### Test execution checklist

| Step | Status | Notes |
|------|--------|-------|
| Close / resolve all gaps above | ✅ | All gaps closed; 11 automated extractor tests pass (`conformance-qti3-basic.test.ts`) |
| Run `Basic/Q2 - Choice Interaction/` test package | ⬜ | Manual — load via conformance page; verify label classes render |
| Run `Basic/Q5 - Extended Text Entry Interaction/` test package | ⬜ | Manual — verify `qti-height-lines-3/6/15` controls textarea height |
| Run `Basic/Q20 - Text Entry Interaction/` test package | ⬜ | Manual — verify `qti-input-width-N` controls input width; `data-patternmask-message` on violation |
| Run `Basic/I9b - Response Processing Fixed Template/` test package | ⬜ | |
| Run `Basic/T4 and T7 - Test Structures/` test package | ⬜ | |
| Run `Basic/A1 - Alternate Text for Graphics/` test package | ⬜ | Manual — verify alt attribute passthrough in rendered HTML |
| Validate XML with member validator | ⬜ | Manual — upload official test package ZIPs |
| Complete `QTI 3 Delivery Certification Checklist.xlsx` (Basic section) | ⬜ | Manual — after member validator pass |
| Submit checklist to 1EdTech | ⬜ | Manual — after checklist complete |

**Implementation gaps**: All known gaps closed.

---

## Milestone 4 — QTI 3.0 Advanced DELIVERY

**Overall status**: 🔵 In progress — implementation + demo package verification complete; member validator + checklist pending  
**Target date**: —  
**Submitted**: —  
**Certified**: —  
**Prerequisite**: Milestone 3 (QTI 3.0 Basic) must be certified first.

### Open gaps to close before test run

| Gap | Status | PRD | PR / Commit | Notes |
| --- | --- | --- | --- | --- |
| T9 — Full `<outcomeProcessing>` XML (same as QTI 2.2 Advanced) | ✅ Implemented | — | develop | Shared with Milestone 2; `ReferenceBackendAdapter.runOutcomeProcessing()` now executes assessment-level XML |
| I4 — Shared Stimulus import + delivery | ✅ Implemented | — | — | extractStimulusRefsFromItemXml + loadStimulusContent in package-processor; ItemBody.svelte injects at data-stimulus-idref or prepends |
| I18 — MathML v3 support | ✅ Verified | — | — | QTI 3.0 Advanced MathML appears in Q5/Q6/Q12; `@pie-qti/typeset-katex` now recurses through `mstyle` and normalizes common MathML operators; covered by `packages/typeset-katex/tests/mathml.test.ts` |
| I19b/I20 — Shared Vocabulary FULL CSS class coverage | ✅ Implemented | — | — | qti-shared-vocabulary.css with ~100 utility classes; imported in app.css |
| Q2/Q5/Q6/Q8/Q10/Q11/Q12/Q13 — Advanced SV behavioral features | ✅ Implemented | — | — | qti-input-control-hidden, qti-orientation-*, qti-choices-stacking-N, qti-counter-down/up, qti-match-tabular, qti-selections-dark/light, etc. |
| All 20 conformance ZIPs + conformance page section | ✅ Implemented | — | — | static/conformance/qti30-advanced/ + conformance-packages.ts |

### Test execution checklist

| Step | Status | Notes |
|------|--------|-------|
| Close / resolve all gaps above | ✅ | I18 MathML v3 verified/patched; QTI 3.0 assessment parsing, QTI 3.0 template filenames, A15 catalog parsing, A13 media/track asset resolution, and Q6 `qti-gap` extraction defects fixed during verification |
| Run deterministic QTI 3.0 Advanced automated tests | ✅ | `bun test packages/typeset-katex/tests/mathml.test.ts`; `bun test packages/assessment-player/tests/conformance-qti30-advanced.test.ts`; `bun test packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts` |
| Run all `Advanced/` test packages | ✅ | 2026-05-04 browser pass through `/conformance`; all 20 QTI 3.0 Advanced ZIPs loaded without page errors or console errors |
| Validate XML with member validator | ⬜ | External/manual — requires 1EdTech member-validator access and uploading official ZIPs |
| Complete `QTI 3 Delivery Certification Checklist.xlsx` (Advanced section) | ⬜ | External/manual — workbook not present in repo; complete after member validator pass |
| Submit checklist to 1EdTech | ⬜ | External/manual — after checklist complete |

### QTI 3.0 Advanced package run evidence (2026-05-04)

| Package | Feature | Result | Evidence |
| --- | --- | --- | --- |
| `q30adv-q2-single` | Q2 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-q2-multiple` | Q2 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-q5-extended-text` | Q5 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-q6-gap-match` | Q6 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-q8-graphic-gap-match` | Q8 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-q10-hotspot` | Q10 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-q11-hottext` | Q11 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-q12-inline-choice` | Q12 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-q13-match` | Q13 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-i4-shared-stimulus` | I4 | ✅ Pass | Demo conformance page opened first item; item body rendered; focused automated test covers stimulus ref/docking markers |
| `q30adv-i17-composite-item` | I17 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-i20-shared-vocabulary` | I20 | ✅ Pass | Demo conformance page opened first item; item body rendered; focused automated test covers Shared Vocabulary class preservation |
| `q30adv-a13-a15-captions-glossary` | A13/A15 | ✅ Pass | Demo conformance page opened first item; item body rendered; media/caption assets resolved without 404s after fix |
| `q30adv-p7-metadata-lom` | P7 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-p7-metadata-qti` | P7 | ✅ Pass | Demo conformance page opened first item; item body rendered |
| `q30adv-s3-s4-selection-ordering` | S3/S4 | ✅ Pass | Demo conformance page opened assessment XML viewer |
| `q30adv-s5-rubric-block` | S5 | ✅ Pass | Demo conformance page opened assessment XML viewer; focused automated test covers section rubric blocks |
| `q30adv-t1-outcome-declaration` | T1/T9 | ✅ Pass | Demo conformance page opened assessment XML viewer; focused automated test covers SCORE_TOTAL outcome processing |
| `q30adv-t5-item-session-control` | T5 | ✅ Pass | Demo conformance page opened assessment XML viewer; focused automated test covers unlimited maxAttempts |
| `q30adv-t12-sections` | T12/T2/S1/S9 | ✅ Pass | Demo conformance page opened assessment XML viewer; focused automated test covers time limits, section controls, sectionRef resolution |

---

## Milestone 5 — QTI 3.0 Elevated Accessibility DELIVERY

**Overall status**: ⬜ Not started  
**Target date**: —  
**Submitted**: —  
**Certified**: —  
**Prerequisite**: Milestone 4 (QTI 3.0 Advanced) must be certified first.

### Open gaps to close before test run

| Gap | Status | PRD | PR / Commit | Notes |
| --- | --- | --- | --- | --- |
| A-9 — Audio-description catalog delivery | ⬜ | — | — | |
| A-13b — Captions (track) delivery + toggle | ⬜ | — | — | |
| A-29 — Long-description visually-hidden rendering | ⬜ | — | — | |
| A-36 — Sign-language video presentation | ⬜ | — | — | |
| A-41 — Tactile content presentation | ⬜ | — | — | |
| A-44 — Transcript presentation | ⬜ | — | — | |
| A-8 — Answer masking | ⬜ | — | — | |
| A-11 — PNP-driven breaks | ⬜ | — | — | |
| A-40b — Computer-read-aloud / TTS routing | ⬜ | — | — | |

### Test execution checklist

| Step | Status | Notes |
|------|--------|-------|
| Close all gaps above | ⬜ | |
| Run `Elevated Accessibility/QTI3_ARIA.xml` delivery criteria (A-2a) | ⬜ | |
| Run `Elevated Accessibility/qti3_example_asl.xml` delivery criteria (I-4, A-29, A-36, A-41) | ⬜ | |
| Run `Elevated Accessibility/qti3_example_video.xml` delivery criteria (A-9, A-13b, A-15, A-44) | ⬜ | |
| Verify delivery system criteria: A-6, A-8, A-11, A-30a, A-40a, A-40b, A-42a | ⬜ | |
| Validate XML with member validator | ⬜ | |
| Complete `QTI 3 Delivery Certification Checklist.xlsx` (Elevated Accessibility section) | ⬜ | |
| Submit checklist to 1EdTech | ⬜ | |

---

## Summary table

| # | Milestone | Status | Certified date |
|---|-----------|--------|----------------|
| 1 | QTI 2.2 Basic DELIVERY | 🔵 In progress | — |
| 2 | QTI 2.2 Advanced DELIVERY | 🔵 In progress | — |
| 3 | QTI 3.0 Basic DELIVERY | 🔵 In progress | — |
| 4 | QTI 3.0 Advanced DELIVERY | 🟡 In progress | — |
| 5 | QTI 3.0 Elevated Accessibility DELIVERY | ⬜ Not started | — |
