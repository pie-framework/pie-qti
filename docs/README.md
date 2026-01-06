# PIE Transform Documentation

This directory contains the **active** documentation for the PIE QTI / transform monorepo.

## Current Documents

### [VENDOR_CUSTOMIZATION_GUIDE.md](./VENDOR_CUSTOMIZATION_GUIDE.md)

Complete guide for implementing vendor-specific QTI transformations in separate packages. Covers:

- Vendor extension system architecture and interfaces
- VendorDetector, VendorTransformer, AssetResolver patterns
- CSS class extraction and metadata handling
- Complete implementation examples (Amplify, ExamView, Wonders/Inspire)
- Testing and best practices

**Status:** Active reference guide
**Last Updated:** 2025-12-31

### [VENDOR_QTI_ANALYSIS.md](./VENDOR_QTI_ANALYSIS.md)

Analysis of real-world vendor QTI content patterns from customer data. Based on analysis of 97 QTI files from multiple vendors including:

- Amplify CKLA (14 files) - Audio in choices, external images
- ExamView/McGraw-Hill (6 files) - CDATA heavy, MathML with S3 fallbacks
- Wonders/Inspire (45+ files) - External stylesheets, obfuscated CSS

**Status:** Reference documentation
**Last Updated:** 2025-12-31

### [PLUGIN_API.md](./PLUGIN_API.md)

Runtime plugin API for the QTI 2.2 Item Player (`@pie-qti/qti2-item-player`). Documents:

- Custom element detection at render time
- Custom interaction renderers
- Lifecycle hooks and data transformers
- Plugin registration and dependency management

**Status:** Active API documentation
**Last Updated:** 2025-12-31

### [BATCH_PROCESSOR_ARCHITECTURE.md](./BATCH_PROCESSOR_ARCHITECTURE.md)

Comprehensive architecture and implementation plan for the QTI Batch Processor web application. This is the primary design document for the web interface that handles:

- QTI package upload (ZIP files and directories)
- Package analysis and structure inspection
- Batch transformation to PIE format
- Preview capabilities (PIE Player)
- Results browsing and export

**Status:** Active design document
**Last Updated:** 2025-12-25

### Other active docs in this folder

- `QTI_2.2_techguide.md` (technical reference)
- `IMS_Content_Packages_techguide.md` (IMS Content Packaging)
- `LOM_techguide.md` (IEEE LOM metadata)
- `QTI_PLAYER_PLUGIN_SYSTEM.md` (player extensibility concepts)
- `QTI_PLAYER_ENCAPSULATION_REVIEW.md` (player integration notes)
- `QTI_EXTENSIONS_INVENTORY.md` (extension inventory)
- `QTI-BACKEND-DESIGN.md` (backend design)
- `QTI-RESPONSE-TRACKING-AND-SCORING.md` (scoring/response tracking)
- `SAMPLES_FEATURE.md` (samples feature)
- `SESSION_MANAGEMENT.md` (session management)

## Quick Links

### For Developers

- **Getting Started:** See main [README.md](../README.md) in repo root
- **Web App Development:** Follow BATCH_PROCESSOR_ARCHITECTURE.md phases
- **CLI Tools:** See `packages/cli/README.md`

### Specs (local snapshots for fast search / LLM use)

We keep **local, greppable snapshots** of key specs so agents and devs can reference them without relying on external browsing:

- **Index**: See [SPEC_SNAPSHOTS.md](./SPEC_SNAPSHOTS.md)

- **QTI 2.2.2 (target) — extracted from official 1EdTech ZIP**:
  - `docs/specs/qti2.2.2/qtiv2p2/imsqti_v2p2_oview.md` (overview, LLM-friendly)
  - `docs/specs/qti2.2.2/qtiv2p2/imsqti_v2p2_impl.md` (implementation guide, LLM-friendly)
  - Minimal local bundle: `docs/specs/qti2.2.2/` (keeps XSDs + standard response processing templates + LLM-friendly `.md` entry points)
  - Original 1EdTech ZIP: `docs/specs/qti2.2.2/qtiv2p2p2.zip`
  - Canonical source page: [`https://www.imsglobal.org/content/question-and-test-interoperability-v222-final`](https://www.imsglobal.org/content/question-and-test-interoperability-v222-final)

### For Understanding the Codebase

1. Start with BATCH_PROCESSOR_ARCHITECTURE.md for overall design
2. Review code in `packages/` for implementation details
3. Check `packages/qti2-to-pie/src/transformers/` for QTI transformation logic
4. See VENDOR_CUSTOMIZATION_GUIDE.md if working with vendor-specific QTI
5. See PLUGIN_API.md if adding custom runtime interactions

## Document Maintenance

### When to Add Documentation

- New major features or architectural decisions
- Breaking changes to APIs or data models
- Integration guides for new components
- Performance optimization strategies

### When to Update This README

- After adding new documentation
- When changing document status (draft → active → archived)
- When reorganizing doc structure

### When to Archive

- Document is superseded by newer design
- Implementation differs significantly from plan
- Historical context only, no longer relevant to current work
