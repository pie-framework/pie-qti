# PIE Transform Documentation

This directory contains the **active** documentation for the PIE QTI / transform monorepo.

## Current Documents

### [TRANSFORMATION-ENGINE.md](./TRANSFORMATION-ENGINE.md)

Complete architecture guide for the QTI transformation framework. Documents:

- Transform engine architecture and component responsibilities
- Plugin system with priority-based selection
- Extensibility points (custom plugins, transformers, asset resolvers)
- Transform process flow and error handling
- Integration with transform app and CLI
- Best practices for plugin development

**Includes:** Architecture diagram (`images/qti-transform-engine.png`)
**Status:** Active architecture documentation
**Last Updated:** 2026-01-24

### [PIE-QTI-TRANSFORMATION-GUIDE.md](./PIE-QTI-TRANSFORMATION-GUIDE.md)

User-facing guide for bidirectional PIE ↔ QTI transformations. Covers:

- Quick start examples (item and assessment transformations)
- Supported PIE elements and QTI interactions
- IMS Content Package generation
- Common patterns and best practices
- Troubleshooting

**Status:** Active user guide
**Last Updated:** 2025-12-31

### [VENDOR-TRANSFORM-PLUGIN-GUIDE.md](./VENDOR-TRANSFORM-PLUGIN-GUIDE.md)

Developer guide for building vendor-specific transform plugins. Includes:

- Plugin interface deep dive
- Vendor detection patterns
- Custom transformers and asset resolution
- Complete working examples
- Testing strategies

**Status:** Active developer guide
**Last Updated:** 2025-12-31

### Other active docs in this folder

- `QTI_techguide.md` (technical reference — covers QTI 2.1, 2.2, and 3.0)
- `IMS_Content_Packages_techguide.md` (IMS Content Packaging)
- `LOM_techguide.md` (IEEE LOM metadata)
- `QTI-RESPONSE-TRACKING-AND-SCORING.md` (scoring/response tracking)
- `QTI-3-MIGRATION-GUIDE.md` (QTI 3.0 support and unified architecture)
- `ARCHITECTURE.md` (overall system architecture)

## Quick Links

### For Developers

- **Getting Started:** See main [README.md](../README.md) in repo root
- **CLI Tools:** See `packages/cli/README.md`

### Specs (local snapshots for fast search / LLM use)

We keep **local, greppable snapshots** of key specs so agents and devs can reference them without relying on external browsing:

- **QTI 2.2.2 (target) — extracted from official 1EdTech ZIP**:
  - `docs/specs/qti2.2.2/qtiv2p2/imsqti_v2p2_oview.md` (overview, LLM-friendly)
  - `docs/specs/qti2.2.2/qtiv2p2/imsqti_v2p2_impl.md` (implementation guide, LLM-friendly)
  - Minimal local bundle: `docs/specs/qti2.2.2/` (keeps XSDs + standard response processing templates + LLM-friendly `.md` entry points)
  - Original 1EdTech ZIP: `docs/specs/qti2.2.2/qtiv2p2p2.zip`
  - Canonical source page: [`https://www.imsglobal.org/content/question-and-test-interoperability-v222-final`](https://www.imsglobal.org/content/question-and-test-interoperability-v222-final)

### For Understanding the Codebase

1. Start with ARCHITECTURE.md for overall design
2. Review code in `packages/` for implementation details
3. Check `packages/to-pie/src/` for QTI → PIE transformation logic
4. Check `packages/item-player/src/core/Plugin.ts` if adding custom runtime interactions

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
