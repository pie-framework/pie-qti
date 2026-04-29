# 1EdTech QTI Certification Program — Overview

Last reviewed: 2026-04-29  
Source: https://www.1edtech.org/standards/qti/conformance  
Local test suite: `/Users/eelco.hillenius/dev/prj/pie/qti-conformance/`

---

## What certification is

1EdTech (formerly IMS Global) runs a formal conformance certification program for QTI
implementations. Certification is a public statement — listed at imscert.org — that a system
meets the acceptance criteria for a particular version, level, and capability. It signals
interoperability to content publishers, procurement teams, and district IT.

Certification is **not** a code review or a lab audit. It is a self-attested checklist process:
the applicant runs the official test packages through their system, fills in the Excel workbooks,
submits to 1EdTech, and 1EdTech lists the certified system publicly.

---

## Versions

| Version | Status | Notes |
|---------|--------|-------|
| QTI 2.1 | **Expired** | No new certifications after 2023-12-31; all product certs expired 2024-12-31. Do not pursue. Content (item) certifications reportedly still available, but delivery/delivery engine certs are not. |
| QTI 2.2 | **Active** | Current version of the QTI 2.x line (final version: 2.2.2). Active certification program. |
| QTI 3.0 | **Active** | Current major version. Test packages last updated March 2025 for v3.0.1. |

---

## Capability types

Each version and level can be certified for one or more capability types. These are independent
certifications — a system can hold DELIVERY without AUTHORING.

| Capability | Who it applies to | What it proves |
|------------|------------------|---------------|
| **IMPORT** | Any system that ingests QTI content | Can parse, store, and round-trip all content in the test packages without data loss |
| **EXPORT** | Authoring tools and content stores | Can produce valid QTI XML containing all required features |
| **DELIVERY** | Test delivery engines (players) | Must also pass all IMPORT criteria at the same level, plus delivery-specific acceptance criteria (rendering, scoring, navigation) |
| **AUTHORING** | Item/test authoring tools | Must also pass all EXPORT criteria at the same level, plus authoring-specific acceptance criteria (create/edit interactions) |
| **PCI** (QTI 3.0 only) | Platforms that host Portable Custom Interactions | Separate certification track for PCI host environments |

**Dependency rule**: DELIVERY ⊇ IMPORT (same level). AUTHORING ⊇ EXPORT (same level).
Advanced level ⊇ Basic level (prerequisite chain).

pie-qti is a delivery engine. The relevant capability is **DELIVERY**.

---

## Levels and profiles

### QTI 2.2 levels (prerequisite-chained)

```
Basic → Advanced → Elective
```

- **Basic**: Core item and test features. Choice, ExtendedText, TextEntry interactions.
  Fixed-template response processing. Basic test structure (parts, sections).
- **Advanced**: Adds 6 more interactions (GapMatch, GraphicGapMatch, Hotspot, HotText,
  InlineChoice, Match), full response processing, composite items, MathML, rubric blocks,
  outcome processing, selection/ordering.
- **Elective**: Optional features not required for Basic or Advanced: Order, Slider, Media
  interactions; stylesheets; time limits on test parts; results reporting.

### QTI 3.0 levels

```
Basic → Advanced → Elective
                ↘
          Elevated Accessibility  (parallel track, requires Advanced as prerequisite)
```

- **Basic**: Same scope as QTI 2.2 Basic, plus I19a QTI Shared Vocabulary Subset.
- **Advanced**: Same scope as QTI 2.2 Advanced, plus MathML v2/v3, Shared Vocabulary FULL,
  Glossary (A15), Magnification (A30a), Text-appearance (A42a).
- **Elective**: Same as QTI 2.2 Elective, plus PCI (Q16) and inline SSML (A3b).
- **Elevated Accessibility**: Specialized profile targeting assistive technology support.
  Requires Advanced as prerequisite. Covers ARIA, audio-description, captions, sign-language,
  tactile, transcript (via catalog resources), plus delivery behaviors: additional time,
  answer masking, breaks, magnification 400%, screen reader, TTS, text/background color.

---

## Certification process

1. **Obtain the test packages.** The official conformance repository is at
   https://github.com/1EdTech/qti-conformance (member repo). Local checkout:
   `/Users/eelco.hillenius/dev/prj/pie/qti-conformance/`.

2. **Run the test packages through your system.** Import each package and verify every
   acceptance criterion listed in the per-feature README files.

3. **Use the online validator.** The 1EdTech member validator at
   https://membervalidator3.1edtech.org/ checks XML schema conformance for QTI content.
   (Requires 1EdTech member login.)

4. **Fill in the checklist workbook.** Excel workbooks are in the conformance repo:
   - `qti2.2/QTI 2p2 Delivery Certification Checklist.xlsx`
   - `qti3.0/QTI 3 Delivery Certification Checklist.xlsx`
   Each row maps to an acceptance criterion; mark pass/fail with evidence.

5. **Submit to 1EdTech.** Via the certification submission process on the 1EdTech site
   (requires membership). 1EdTech reviews and publishes the result at imscert.org.

6. **Maintain certification.** When a new version of the test suite is released, recertify
   to keep the listing current.

---

## Test suite structure

The local conformance repo mirrors the official structure:

```
qti-conformance/
├── qti2.2/
│   ├── Basic Level/          # Required features for Basic certification
│   │   ├── Q2 - Choice Interaction/
│   │   │   └── README.md     # Acceptance criteria per capability (IMPORT/EXPORT/DELIVERY/AUTHORING)
│   │   └── …
│   ├── Advanced Level/       # Additional features for Advanced certification
│   ├── Elective Features/
│   ├── QTI 2p2 Delivery Certification Checklist.xlsx
│   └── …
└── qti3.0/
    ├── Basic/
    ├── Advanced/
    ├── Elective/
    ├── Elevated Accessibility/
    ├── QTI 3 Delivery Certification Checklist.xlsx
    ├── QTI 3 PCI Certification Checklist.xlsx
    └── …
```

Each feature directory contains:
- `README.md` with acceptance criteria split by capability type
- Example XML files (the conformance test items/tests)
- `imsmanifest.xml` for IMS Content Package delivery

---

## Membership requirement

Accessing the full certification program (submitting results, viewing imscert.org listings,
using the member validator) requires 1EdTech membership. Renaissance Learning is a member.
The conformance GitHub repos are member repos.
