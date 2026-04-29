# QTI 3.0 DELIVERY — Gap Analysis

Last reviewed: 2026-04-29  
Capability: DELIVERY (subsumes IMPORT at the same level)  
Source: `qti-conformance/qti3.0/` (updated March 2025 for v3.0.1)  
Checklist workbook: `qti-conformance/qti3.0/QTI 3 Delivery Certification Checklist.xlsx`

Status key: ✅ Done · ⚠️ Needs verification · ❌ Gap · — N/A for delivery

pie-qti uses a version-agnostic architecture: a name mapper translates QTI 3.0 kebab-case
elements (`qti-assessment-item`, `qti-choice-interaction`, …) to the same internal model
used for QTI 2.x. This means all QTI 2.2 features carry over unless otherwise noted.

---

## Basic Level

### Items — Basic (QTI 3.0 additions over QTI 2.2 Basic)

QTI 3.0 Basic requires the same features as QTI 2.2 Basic (see [qti22-gap-analysis.md](qti22-gap-analysis.md)),
plus:

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| I19a | QTI Shared Vocabulary Subset | ⚠️ Needs verification | Shared Vocabulary uses CSS class names on HTML elements (e.g. `class="qti-label"`) to mark semantic roles. Verify that the item player passes these CSS classes through to the rendered DOM without stripping them, and that the basic subset classes are listed and supported. Check `qti-conformance/qti3.0/Basic/Q2 - Choice Interaction/` README for specific I19a acceptance criteria. |

All other Basic features carry over from QTI 2.2 and are ✅ Done.

**Basic DELIVERY verdict: One item to verify (I19a). Low effort. Run official Basic test
packages and check CSS class passthrough.**

---

## Advanced Level

Requires Basic certification as prerequisite. QTI 3.0 Advanced = QTI 2.2 Advanced + additions below.

QTI 2.2 Advanced gaps (T9, I18, P7) also apply here — see [qti22-gap-analysis.md](qti22-gap-analysis.md).

### Items — Advanced (QTI 3.0 additions over QTI 2.2 Advanced)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| I4 | Shared Stimulus | ⚠️ Needs verification | A `<qti-shared-stimulus-body>` (or `<stimulusBody>`) is a reusable passage referenced by multiple items in a section. Verify that the assessment player can load a shared stimulus from the manifest, display it alongside the item body, and that the stimulus content does not repeat for each item (or does repeat, per the test package requirements). Check `qti-conformance/qti3.0/Advanced/I4 Shared Stimulus/` README. |
| I18 | MathML v2 AND v3 | ⚠️ Needs verification | QTI 3.0 Advanced requires both MathML v2 and v3. Confirm the rendering library (KaTeX or MathJax) in use supports MathML 3 input. If not, upgrade or add a fallback. |
| I19b | Shared Vocabulary FULL | ⚠️ Needs verification | Full vocabulary extends the subset from Basic with additional CSS class names. Audit `qti-conformance/qti3.0/Advanced/I20 Shared Vocabulary CSS/` for the complete class list and confirm all classes pass through the item player without being stripped or remapped. |
| A15 | Glossary on-screen | ✅ Done | CatalogPopup component; `glossary-on-screen` catalog usage type; triggered by `data-catalog-idref` on inline elements |
| A30a | Magnification | ✅ Done | PNP color-scheme / CSS transform zoom; 400% verified |
| A42a | Text-appearance (text and background color) | ✅ Done | PNP 6 color schemes; candidate can change at any time |

**Advanced DELIVERY verdict: 3 features need verification (I4, I18 v3, I19b full). Low–medium
effort. Most of the hard work (response processing, interaction rendering) is already certified
at the QTI 2.2 Advanced level.**

### Gaps requiring PRDs (Advanced)

| Gap | PRD scope | Effort |
|-----|-----------|--------|
| I4 — Shared Stimulus | Verify/implement shared stimulus load from manifest; display in assessment player | S–M |
| I18 — MathML v3 | Upgrade/confirm math library; add test coverage for MathML 3 expressions | S |
| I19b — Shared Vocabulary FULL | Audit class list; add missing classes to passthrough allow-list | S |

---

## Elective Features

Not required for Basic or Advanced. Included for completeness.

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| Q15 | Order Interaction | ✅ Done | |
| Q19 | Slider Interaction | ✅ Done | |
| Q16 | PCI (Portable Custom Interaction) | ✅ Done | Full ES module lifecycle (G-08) |
| A3b | Inline data-ssml | ❌ Not implemented | SSML speech synthesis markup on text nodes; browser TTS integration not built |
| I6 | Stylesheet | ✅ Done | |
| Media Interaction | Media Interaction | ✅ Done | |

---

## Elevated Accessibility Level

Requires Advanced certification as prerequisite. This is a specialised profile; pursuit is
recommended as a longer-term milestone. See [STRATEGY.md](STRATEGY.md) for rationale.

The test packages are in `qti-conformance/qti3.0/Elevated Accessibility/`.
Three example items demonstrate the required features:
- `QTI3_ARIA.xml` — ARIA subset (A-2a)
- `qti3_example_asl.xml` — Catalog resources, long-description, sign-language, tactile
- `qti3_example_video.xml` — Audio-description, captions, glossary, transcript

### IMPORT/EXPORT features (required; also tested in DELIVERY)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| I-4 | Catalog Resources | ✅ Done | Full catalog parse; inline `<qti-catalog>`; `data-catalog-idref` linking; per-item + shared catalog merge |
| A-2a | WAI-ARIA subset | ✅ Done | `aria-describedby`, `aria-hidden`, `aria-label`, `aria-labelledby`, `aria-live`, `role` pass through the HTML renderer without being stripped |
| A-9 | Audio-description | ⚠️ Gap | Catalog entry type `audio-description` is defined in the CatalogSystem. Delivery behavior — presenting the audio-description to candidates with PNP `audio-description` enabled, either as an alternative video or via synchronized audio — is not yet implemented. |
| A-13b | Captions (track support) | ⚠️ Needs verification | HTML5 `<video>` with `<track kind="captions">` should pass through the item body renderer. Verify the track element is not stripped and that captions toggle on/off per A13-EA-D2/D3. |
| A-29 | Long-description | ⚠️ Needs verification | `visually-hidden` CSS class + `aria-describedby` pattern is used in the ARIA example. Verify the delivery player renders `visually-hidden` content as screen-reader-available but not visually displayed (correct CSS). |
| A-36 | Sign-language | ❌ Gap | Catalog entry type `signing-definition` is defined. Delivery behavior — presenting the sign-language video alongside the item for candidates with PNP `sign-language` enabled — is not yet implemented. |
| A-41 | Tactile | ❌ Gap | Catalog entry type `tactile` is defined. Delivery behavior — presenting tactile resource to candidates — is not yet implemented (content type is specialized; likely a file download or braille renderer integration). |
| A-44 | Transcript | ❌ Gap | Catalog entry type `transcript` is defined. Delivery behavior — presenting transcript text inline or on demand for candidates with PNP `transcript` enabled — is not yet implemented. |

### Additional DELIVERY features

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| A-6 | Additional testing time | ✅ Done | PNP `additional-testing-time` multiplier applied to all timers; unlimited time option |
| A-8 | Answer masking | ❌ Gap | Not implemented. Choice interaction responses must be visually and programmatically hidden, with a candidate-controlled toggle. Both PNP-driven default and on-demand modes required. |
| A-11 | Breaks | ⚠️ Gap | Pause/resume exists in the assessment player. PNP `breaks: true` environment flag is not formally checked to enable/disable the break feature. Timer pause on break is likely correct but needs verification against acceptance criteria A11-EA-D1/D2/D3. |
| A-30a | Magnification (all content, 400%) | ✅ Done | PNP zoom; entire test interface can reach 400% |
| A-40a | Screen reader (reading-type: screen-reader) | ✅ Done | WCAG 2.2 AA ARIA compliance; no interference with screen reader |
| A-40b | Computer-read-aloud (reading-type: computer-read-aloud) | ❌ Gap | TTS routing deferred (G-14 in SPEC-GAPS-PLAN). Candidate-initiated text-to-speech of assessment content not implemented. |
| A-42a | Text/background color | ✅ Done | PNP 6 color schemes; candidate can change at any time during session |

### Gaps requiring PRDs (Elevated Accessibility)

| Gap | ID | Effort | Dependencies |
|-----|----|--------|--------------|
| Audio-description catalog delivery | A-9 | M | I-4 (done), PNP (done) |
| Captions track support and toggle | A-13b | S | HTML renderer passthrough |
| Long-description visually-hidden rendering | A-29 | S | CSS; ARIA passthrough |
| Sign-language video presentation | A-36 | M | I-4 (done), PNP (done), video component |
| Tactile content presentation | A-41 | M | I-4 (done), PNP (done) |
| Transcript presentation | A-44 | M | I-4 (done), PNP (done) |
| Answer masking | A-8 | M | Choice interaction; PNP |
| PNP-driven breaks | A-11 | S | Assessment player pause/resume |
| Computer-read-aloud / TTS routing | A-40b | L | G-14; platform TTS API integration |

**Elevated Accessibility verdict: Substantial delivery behavior gaps. Catalog infrastructure is
strong; the missing pieces are the presentation-layer behaviors triggered by PNP entries.
Estimated 4–8 weeks of engineering across all gaps.**
