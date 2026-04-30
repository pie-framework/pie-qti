# QTI Certification Progress Tracker

Last updated: 2026-04-29 (Milestone 1 static analysis complete)

This document tracks the live status of each certification milestone. Update it whenever:
- A gap is closed (link the PR/commit)
- A test package run is completed
- A checklist workbook is submitted
- A certification is awarded

For strategy rationale and effort estimates see [STRATEGY.md](STRATEGY.md).
For feature-level gap detail see [qti22-gap-analysis.md](qti22-gap-analysis.md) and [qti30-gap-analysis.md](qti30-gap-analysis.md).

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
See [certification-check-qti22-basic.md](certification-check-qti22-basic.md) for the full per-criterion report.

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

**Implementation gaps**: None identified. See [qti22-gap-analysis.md — Basic](qti22-gap-analysis.md#basic-level).

---

## Milestone 2 — QTI 2.2 Advanced DELIVERY

**Overall status**: ⬜ Not started  
**Target date**: —  
**Submitted**: —  
**Certified**: —  
**Prerequisite**: Milestone 1 (QTI 2.2 Basic) must be certified first.

### Open gaps to close before test run

| Gap | Status | PRD | PR / Commit | Notes |
| --- | --- | --- | --- | --- |
| T9 — Full `<outcomeProcessing>` XML interpreter | 🟡 Needs investigation | — | — | Determine if template system satisfies acceptance criteria or if AST work (G-11) is required |
| I18 — MathML v2 rendering | 🔴 Gap confirmed | — | — | `@pie-qti/typeset-katex` bundled but never wired into item-player; MathML renders as raw DOM, not typeset |
| P7 — QTI Metadata delivery | 🔴 Gap confirmed | — | — | No DELIVERY acceptance criteria in README ("no specific criteria at this time") — verify this is a no-op for certification |

### Test execution checklist

| Step | Status | Notes |
|------|--------|-------|
| Close / resolve all gaps above | ⬜ | |
| Run `Advanced Level/Q6 - Gap Match Interaction/` test package | ⬜ | |
| Run `Advanced Level/Q8 - Graphic Gap Match Interaction/` test package | ⬜ | |
| Run `Advanced Level/Q10 - Hotspot/` test package | ⬜ | |
| Run `Advanced Level/Q11 - Hot-text Interaction/` test package | ⬜ | |
| Run `Advanced Level/Q12 - Inline Choice Interaction/` test package | ⬜ | |
| Run `Advanced Level/Q13 - Match Interaction/` test package | ⬜ | |
| Run `Advanced Level/I17 - Composite Item/` test package | ⬜ | |
| Run `Advanced Level/S3 and S4/` test package | ⬜ | |
| Run `Advanced Level/S5 - Rubric Block in Sections/` test package | ⬜ | |
| Run `Advanced Level/T1 - Outcome Declaration/` test package | ⬜ | |
| Run `Advanced Level/T5 - Test Parts - Item Session Control/` test package | ⬜ | |
| Run `Advanced Level/T12 - Sections/` test package | ⬜ | |
| Run `Advanced Level/P7 – QTI Metadata/` test package | ⬜ | |
| Validate XML with member validator | ⬜ | |
| Complete `QTI 2p2 Delivery Certification Checklist.xlsx` (Advanced section) | ⬜ | |
| Submit checklist to 1EdTech | ⬜ | |

---

## Milestone 3 — QTI 3.0 Basic DELIVERY

**Overall status**: ⬜ Not started  
**Target date**: —  
**Submitted**: —  
**Certified**: —  
**Prerequisite**: Milestone 1 (QTI 2.2 Basic) must be certified first.

### Open gaps to close before test run

| Gap | Status | PRD | PR / Commit | Notes |
| --- | --- | --- | --- | --- |
| I19a — Shared Vocabulary Subset CSS class passthrough | ✅ Verified | — | — | Sanitizer uses denylist; `class` attribute passes through untouched (`sanitizer.ts:110–157`) |

### Test execution checklist

| Step | Status | Notes |
|------|--------|-------|
| Close / resolve all gaps above | ⬜ | |
| Run `Basic/Q2 - Choice Interaction/` test package | ⬜ | |
| Run `Basic/Q5 - Extended Text Entry Interaction/` test package | ⬜ | |
| Run `Basic/Q20 - Text Entry Interaction/` test package | ⬜ | |
| Run `Basic/I9b - Response Processing Fixed Template/` test package | ⬜ | |
| Run `Basic/T4 and T7 - Test Structures/` test package | ⬜ | |
| Run `Basic/A1 - Alternate Text for Graphics/` test package | ⬜ | |
| Validate XML with member validator | ⬜ | |
| Complete `QTI 3 Delivery Certification Checklist.xlsx` (Basic section) | ⬜ | |
| Submit checklist to 1EdTech | ⬜ | |

**Implementation gaps**: I19a needs verification. See [qti30-gap-analysis.md — Basic](qti30-gap-analysis.md#basic-level).

---

## Milestone 4 — QTI 3.0 Advanced DELIVERY

**Overall status**: ⬜ Not started  
**Target date**: —  
**Submitted**: —  
**Certified**: —  
**Prerequisite**: Milestone 3 (QTI 3.0 Basic) must be certified first.

### Open gaps to close before test run

| Gap | Status | PRD | PR / Commit | Notes |
| --- | --- | --- | --- | --- |
| T9 — Full `<outcomeProcessing>` XML (same as QTI 2.2 Advanced) | 🟡 Needs investigation | — | — | Shared with Milestone 2; resolved there first |
| I4 — Shared Stimulus import + delivery | 🟡 Needs verification | — | — | Cross-item stimulus body in assessment player |
| I18 — MathML v3 support | 🟡 Needs verification | — | — | v3 required for QTI 3.0 Advanced |
| I19b — Shared Vocabulary FULL CSS class coverage | 🟡 Needs verification | — | — | Audit full class list against item player HTML renderer |

### Test execution checklist

| Step | Status | Notes |
|------|--------|-------|
| Close / resolve all gaps above | ⬜ | |
| Run all `Advanced/` test packages | ⬜ | Includes A13captions_A15glossary, I4 Shared Stimulus, I20 Shared Vocabulary, S3/S4, T1, T5, T12 |
| Validate XML with member validator | ⬜ | |
| Complete `QTI 3 Delivery Certification Checklist.xlsx` (Advanced section) | ⬜ | |
| Submit checklist to 1EdTech | ⬜ | |

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
| 2 | QTI 2.2 Advanced DELIVERY | ⬜ Not started | — |
| 3 | QTI 3.0 Basic DELIVERY | ⬜ Not started | — |
| 4 | QTI 3.0 Advanced DELIVERY | ⬜ Not started | — |
| 5 | QTI 3.0 Elevated Accessibility DELIVERY | ⬜ Not started | — |
