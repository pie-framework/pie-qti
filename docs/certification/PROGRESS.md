# QTI Certification Progress Tracker

Last updated: 2026-04-29

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

**Overall status**: ⬜ Not started  
**Target date**: —  
**Submitted**: —  
**Certified**: —

| Step | Status | Notes |
|------|--------|-------|
| Run `Basic Level/Q2 - Choice Interaction/` test package | ⬜ | |
| Run `Basic Level/Q5 - Extended Text Entry Interaction/` test package | ⬜ | |
| Run `Basic Level/Q20 - Text Entry Interaction/` test package | ⬜ | |
| Run `Basic Level/I9b - Response Processing Fixed Template/` test package | ⬜ | |
| Run `Basic Level/T4 and T7 - Test Structures/` test package | ⬜ | |
| Validate XML with member validator (https://membervalidator3.1edtech.org/) | ⬜ | |
| Complete `QTI 2p2 Delivery Certification Checklist.xlsx` | ⬜ | |
| Submit checklist to 1EdTech | ⬜ | |

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
| I18 — MathML v2 rendering | 🟡 Needs verification | — | — | Confirm math library is bundled and tested |
| P7 — QTI Metadata delivery | 🟡 Needs verification | — | — | Run test package; check if metadata display criteria require UI changes |

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
| I19a — Shared Vocabulary Subset CSS class passthrough | 🟡 Needs verification | — | — | Check item player HTML renderer does not strip QTI shared vocab classes |

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
| 1 | QTI 2.2 Basic DELIVERY | ⬜ Not started | — |
| 2 | QTI 2.2 Advanced DELIVERY | ⬜ Not started | — |
| 3 | QTI 3.0 Basic DELIVERY | ⬜ Not started | — |
| 4 | QTI 3.0 Advanced DELIVERY | ⬜ Not started | — |
| 5 | QTI 3.0 Elevated Accessibility DELIVERY | ⬜ Not started | — |
