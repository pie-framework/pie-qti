# QTI Certification Strategy

Last reviewed: 2026-04-29

---

## TL;DR

Pursue DELIVERY certification in this order:

1. QTI 2.2 Basic (near-zero gaps — submit now)
2. QTI 3.0 Basic (same feature set, marginal additional work)
3. QTI 2.2 Advanced (T9 `<outcomeProcessing>` is the main gap)
4. QTI 3.0 Advanced (incremental from Advanced)
5. QTI 3.0 Elevated Accessibility (long-term; aligns with Renaissance WCAG mandate)

Do not pursue EXPORT, AUTHORING, or PCI certification at this time.

---

## Background

pie-qti is a delivery engine, not an authoring tool. The certification capability that proves
our value to customers and content publishers is **DELIVERY**. DELIVERY certification subsumes
IMPORT certification (same level), so both are covered by a single submission.

The QTI 2.x and 3.0 delivery landscapes are separate but overlapping. Our architecture is
version-agnostic — we share a single parser, extractor, and response processing engine across
QTI 2.1, 2.2, and 3.0. This means certifying in both versions costs little more than
certifying in one.

---

## Recommended certification path

### Step 1: QTI 2.2 Basic — DELIVERY

**Effort**: Low (1–2 weeks of test execution + submission paperwork)  
**Prerequisite**: None  
**Status**: No implementation gaps found (see [qti22-gap-analysis.md](qti22-gap-analysis.md))

Why first:
- Validates the core interoperability claim. "QTI 2.2 Basic Certified" is the minimum bar
  expected by most content publishers and LMS vendors.
- All required features are implemented and tested.
- Running the official test packages is the main remaining work — this doubles as a
  regression test suite we should run regularly anyway.

What to do:
1. Run all packages in `qti-conformance/qti2.2/Basic Level/` through the item player and
   assessment player.
2. Verify every acceptance criterion in each README against the DELIVERY column.
3. Fill in `QTI 2p2 Delivery Certification Checklist.xlsx`.
4. Submit to 1EdTech.

---

### Step 2: QTI 3.0 Basic — DELIVERY

**Effort**: Low (run the QTI 3.0 Basic test packages; one new feature to verify: I19a)  
**Prerequisite**: None (can run in parallel with Step 1)  
**Status**: One feature to verify — see [qti30-gap-analysis.md](qti30-gap-analysis.md)

Why:
- Same interaction set as QTI 2.2 Basic. Our version-agnostic architecture means the QTI 3.0
  kebab-case element names are already handled by the name mapper.
- QTI 3.0 is the future. Having QTI 3.0 Basic certified alongside QTI 2.2 Basic signals
  forward compatibility.
- The only addition over QTI 2.2 Basic is I19a (Shared Vocabulary Subset) — CSS class
  handling we believe is already in place.

What to do:
1. Verify I19a Shared Vocabulary Subset delivery (CSS class passthrough).
2. Run all packages in `qti-conformance/qti3.0/Basic/` through the players.
3. Fill in `QTI 3 Delivery Certification Checklist.xlsx` (Basic section).
4. Submit.

---

### Step 3: QTI 2.2 Advanced — DELIVERY

**Effort**: Medium (T9 outcomeProcessing gap; MathML verification; 2–4 weeks)  
**Prerequisite**: QTI 2.2 Basic certification (Step 1)  
**Status**: 2–3 gaps to investigate — see [qti22-gap-analysis.md](qti22-gap-analysis.md)

Why:
- Advanced covers the interactions used in most real-world K-12 item banks (GapMatch,
  Hotspot, Match, etc.). Basic is a necessary milestone, but Advanced is the level that
  matters for competitive differentiation.
- Most features are already implemented. The main risk is T9 (full `<outcomeProcessing>` XML
  interpreter at assessment level — currently we use a template system).

Main gaps to resolve before submission:
- **T9**: Investigate whether the 4 scoring templates (total_score, weighted_score,
  percentage_score, pass_fail) satisfy the acceptance criteria, or whether full XML AST
  evaluation is required. File a PRD if AST work is needed (references G-11 in SPEC-GAPS-PLAN).
- **I18**: Confirm MathML rendering is active and the math library is bundled.
- **P7**: Run the metadata test package and verify acceptance criteria.

---

### Step 4: QTI 3.0 Advanced — DELIVERY

**Effort**: Low incremental from Step 3 (MathML v3 verification; Shared Vocabulary FULL audit;
Shared Stimulus review)  
**Prerequisite**: QTI 3.0 Basic certification (Step 2)  
**Status**: 3–4 features need verification — see [qti30-gap-analysis.md](qti30-gap-analysis.md)

Why:
- Required for Elevated Accessibility (Step 5).
- Shared Vocabulary FULL and MathML v3 are the main deltas over QTI 2.2 Advanced.
- Glossary (A15), Magnification (A30a), and Text-appearance (A42a) are already implemented
  via the PNP system.

Main gaps to resolve:
- **I18**: MathML v3 (confirm KaTeX/MathJax version supports MathML 3).
- **I19b**: Shared Vocabulary FULL — audit which CSS classes are expected to be recognised
  and whether our passthrough handles all of them.
- **I4 / Shared Stimulus**: Verify cross-item shared stimulus body import and delivery.

---

### Step 5: QTI 3.0 Elevated Accessibility — DELIVERY

**Effort**: High (multiple catalog delivery behaviors; answer masking; TTS — 4–8 weeks of
implementation + test execution)  
**Prerequisite**: QTI 3.0 Advanced certification (Step 4)  
**Strategic fit**: Directly supports Renaissance's WCAG 2.2 AA mandate and K-12 accessibility
procurement requirements (e.g. IDEA, Section 508, state procurement policies)

Why:
- "Elevated Accessibility Certified" is a strong differentiator in K-12 procurement.
- Most of the infrastructure is already in place (catalog system, PNP framework, ARIA
  passthrough, color schemes, magnification).
- The remaining gaps are well-scoped delivery behaviors: presenting sign-language video,
  audio-description, captions, transcript, and tactile content from catalog resources;
  implementing answer masking; formalising PNP-driven breaks; and TTS routing.

Main gaps (each warrants a PRD):
- A-9 Audio-description catalog delivery
- A-13b Captions (HTML `<track>`) delivery
- A-29 Long-description delivery behavior
- A-36 Sign-language video presentation
- A-41 Tactile content presentation
- A-44 Transcript presentation
- A-8 Answer masking
- A-11 PNP-driven breaks
- A-40b Computer-read-aloud / TTS routing

---

## What we are NOT pursuing (and why)

| Capability / Level | Reason to skip |
|--------------------|---------------|
| QTI 2.1 DELIVERY | Expired. No certifications accepted since 2023. |
| EXPORT capability | pie-qti is a delivery engine. The PIE→QTI transform exists but is not a primary product surface. Revisit if we productise the transform. |
| AUTHORING capability | Not an authoring tool. |
| QTI 3.0 PCI certification | Separate program for PCI host environments. Worthwhile only if we market pie-qti as a PCI platform to third-party interaction authors. |
| Elective level | Lower ROI than Elevated Accessibility. Order, Slider, and Media are all implemented but elective certification adds little market value beyond what Advanced already signals. |

---

## Effort estimates

| Milestone | Engineering effort | Notes |
|-----------|-------------------|-------|
| QTI 2.2 Basic DELIVERY | 1–2 weeks | Test execution + paperwork only |
| QTI 3.0 Basic DELIVERY | 0.5–1 week incremental | I19a verification + test execution |
| QTI 2.2 Advanced DELIVERY | 2–4 weeks | T9 gap investigation + potential AST work |
| QTI 3.0 Advanced DELIVERY | 1–2 weeks incremental | MathML v3, Shared Vocabulary audit |
| QTI 3.0 Elevated Accessibility | 4–8 weeks | Catalog delivery behaviors + answer masking + TTS |

Estimates assume one engineer. Actual dates depend on resourcing — fill in when sprints are
scheduled.

---

## Success criteria

A certification is complete when:
1. All acceptance criteria in the relevant DELIVERY README files are marked pass.
2. The checklist workbook is submitted and acknowledged by 1EdTech.
3. The system appears in the imscert.org listings.
4. The gap analysis file in this folder is updated to reflect the certified state.
