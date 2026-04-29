# QTI 2.2 DELIVERY — Gap Analysis

Last reviewed: 2026-04-29  
Capability: DELIVERY (subsumes IMPORT at the same level)  
Source: `qti-conformance/qti2.2/`  
Checklist workbook: `qti-conformance/qti2.2/QTI 2p2 Delivery Certification Checklist.xlsx`

Status key: ✅ Done · ⚠️ Needs verification · ❌ Gap · — N/A for delivery

---

## Basic Level

Required before pursuing Advanced. All items and tests must pass.

### Items — Basic

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| I0 | Assessment Item Root | ✅ Done | Namespace/version detection; both 2.1 and 2.2 |
| I1 | Response Declaration | ✅ Done | All base types and cardinalities |
| I2 | Outcome Declaration | ✅ Done | Default values, base types, cardinality |
| I7 | Item Body | ✅ Done | HTML5 QTI subset rendered |
| I8 | HTML5 (QTI Subset) | ✅ Done | Standard block/inline HTML; SVG |
| I9b | Response Processing — Fixed Template | ✅ Done | match_correct, map_response, map_response_point, none |
| P4 | Item Instances | ✅ Done | IMS CP package parsing; item extraction |
| A1 | Alternate text for graphics | ✅ Done | `alt` attribute passthrough on `<img>` |
| Q2 | Choice Interaction | ✅ Done | Single + multiple cardinality; shuffle; fixed choices |
| Q5 | Extended Text Interaction | ✅ Done | expectedLength/expectedLines hints; format attribute |
| Q20 | Text Entry Interaction | ✅ Done | patternMask live validation (G-04); format hint (G-03) |

### Tests — Basic

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| P1 | Test Instances | ✅ Done | IMS CP manifest; test extraction |
| S0 | Section Root | ✅ Done | assessmentSection parse and render |
| S7 | Items in Section | ✅ Done | Item ordering within section |
| T4 | Test Part | ✅ Done | assessmentTestPart; navigation/submission modes |
| T7 | Sections in Test Part | ✅ Done | Nested section support |
| T14 | Record & Restore Responses (Delivery) | ✅ Done | State persistence; localStorage + server adapter |

**Basic DELIVERY verdict: No gaps. Ready to run official test packages and submit.**

Action: Run every package in `qti-conformance/qti2.2/Basic Level/`, verify each delivery
acceptance criterion, complete checklist workbook, submit.

---

## Advanced Level

Requires Basic certification as prerequisite.

### Items — Advanced (additional features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| I9a | Response Processing — Full | ✅ Done | 45+ operators; full AST builder + evaluator |
| I11 | Rubric Block — HTML | ✅ Done | view attribute filtering; candidate/scorer/tutor roles |
| I17 | Composite Items | ✅ Done | Multiple interactions per item body |
| I18 | MathML | ⚠️ Needs verification | Math rendering library present in bundle? Verify which MathML version (v2 required for 2.2). Check `packages/default-components` for math rendering integration. |
| P7 | QTI Metadata | ⚠️ Needs verification | Run `qti-conformance/qti2.2/Advanced Level/P7 – QTI Metadata/` test package; check if delivery acceptance criteria for metadata are met (title, description, subject exposure in UI) |
| Q6 | Gap Match Interaction | ✅ Done | matchMin runtime validation (G-06 closed) |
| Q8 | Graphic Gap Match Interaction | ✅ Done | Image hotspot drop zones |
| Q10 | Hotspot Interaction | ✅ Done | Single + multiple; ellipse/rect/poly shapes |
| Q11 | Hot-text Interaction | ✅ Done | Inline text selection |
| Q12 | Inline Choice Interaction | ✅ Done | Dropdown inline in text; label element (G-02) |
| Q13 | Match Interaction | ✅ Done | Directed pairs; matchGroup filtering (G-01 closed) |

### Tests — Advanced (additional features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| S3 | Selection | ✅ Done | select N items from larger pool; withReplacement |
| S4 | Ordering | ✅ Done | shuffle; fixed item positions; combined selection+ordering |
| S5 | Rubric Block in Sections | ✅ Done | Section-level rubric block display |
| T2 | Assessment Time Limits | ✅ Done | maxTime/minTime; auto-submit on expiry; PNP multiplier |
| T5 | Item Session Control in Test Part | ✅ Done | maxAttempts, allowReview, allowSkip, showFeedback, showSolution |
| T9 | Outcomes Processing | ⚠️ Gap | **Main risk for Advanced certification.** Template system (total_score, weighted_score, percentage_score, pass_fail) handles most real content. Full `<outcomeProcessing>` XML AST interpreter at assessment level is deferred (G-11 in SPEC-GAPS-PLAN). Investigation needed: do the acceptance criteria for T9 require arbitrary XML outcome expressions, or are templates sufficient? Check `qti-conformance/qti2.2/Advanced Level/T1 - Outcome Declaration/` and `qti-conformance/qti2.2/Advanced Level/T5 - Test Parts - Item Session Control/` READMEs. |
| T12 | Multiple Sections in Test Part | ✅ Done | Multiple assessmentSection in one testPart |

**Advanced DELIVERY verdict: 2–3 items need investigation before submission. T9 is the main
risk; I18 and P7 need quick verification runs.**

### Gaps requiring PRDs (Advanced)

| Gap | PRD scope | Effort estimate |
|-----|-----------|----------------|
| T9 — Full `<outcomeProcessing>` XML | Implement assessment-level AST execution (G-11); reuse item-level operator engine | L (3–5 days if needed) |
| I18 — MathML rendering | Verify/document the MathML rendering path; ensure v2 is bundled and tested | S (1 day) |
| P7 — QTI Metadata delivery | Run test package; determine if metadata display acceptance criteria require UI changes | S (1 day) |

---

## Elective Features

Not required for Basic or Advanced certification. Included for reference.

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| Q15 / Q19 | Order Interaction | ✅ Done | Drag-to-reorder + keyboard alternative |
| Q19 | Slider Interaction | ✅ Done | Numeric range slider |
| Media Interaction | Media Interaction | ✅ Done | Audio/video response recording |
| I6 | Stylesheet | ✅ Done | External CSS loading (asset resolver) |
| S3/S4 | Section Selection/Ordering | ✅ Done | Covered by Advanced |
| T6 | Test Part Time Limits | ✅ Done | Time limit at test part level |
| T7 | Nested Sections | ✅ Done | Sections within sections |
| Results Reporting | Results Reporting | ⚠️ Partial | Outcome variables computed; standardised QTI results XML output not yet produced |

Elective certification is not a current priority. See [STRATEGY.md](STRATEGY.md).
