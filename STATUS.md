# PIE QTI 2.2 Implementation Status

**Last Updated**: 2026-01-12

---

## Overview

High-level implementation status for PIE-QTI. This document is intentionally short; details live in package READMEs and `docs/`.

---

## Status

### QTI 2.x Players — Production-ready

The item player and assessment player are considered production-ready:

- ✅ **Shipped**: QTI 2.2 item player + assessment player
- ✅ **QTI item interactions**: **21/21** QTI 2.2 interaction types supported in the core player
- ✅ **Default UI components**: **17** default interaction web components (`@pie-qti/qti2-default-components`)
  - `textEntryInteraction` + `inlineChoiceInteraction` are rendered as inline interactions
  - `uploadInteraction` + `drawingInteraction` use shared Svelte components (`FileUpload`, `DrawingCanvas`)

### PIE ↔ QTI Transforms — Under active development

The transformation framework and tooling are functional but under active development:

- ✅ **Core transforms**: QTI 2.2 → PIE and PIE → QTI 2.2 transform plugins
- 🚧 **Transform app**: Web UI for upload, analyze, transform, and preview
- 🚧 **CLI**: Command-line batch operations
- 🚧 **IMS Content Packages**: Manifest generation and packaging

---

## Test signal

- ✅ **Default-components evals**: YAML specs in `docs/evals/qti2-default-components/*/evals.yaml` executed by Playwright runner in `packages/qti2-example/tests/playwright/qti2-default-components-evals.pw.ts` (currently **49** cases)
- ✅ **Assessment-player evals**: YAML specs in `docs/evals/qti2-assessment-player/*/evals.yaml` (currently **15** cases)
- ✅ **i18n evals**: YAML specs in `docs/evals/qti2-i18n/*/evals.yaml` testing internationalization across 8 locales (currently **14** cases)
- ✅ **Settings UI evals**: YAML specs in `docs/evals/qti2-settings-ui/*/evals.yaml` testing theme and locale switching UI (currently **7** cases)
- ✅ **Asset loading evals**: YAML specs in `docs/evals/qti2-asset-loading/*/evals.yaml` testing URL resolution and asset loading (currently **3** cases)
- ✅ **Web components evals**: YAML specs in `docs/evals/qti2-web-components/*/evals.yaml` testing configuration passing (currently **4** cases)
- ✅ **Total eval cases**: **92** (up from 64)
- ✅ **Unit tests**: additional coverage exists across packages (see package READMEs and workflows for the authoritative commands)

---

## Intentional non-goals

- ❌ Full QTI rule interpreter for assessment-level outcome processing (use standard templates + pluggable outcome processors)
- ❌ QTI 3.0 features (project targets QTI 2.x)

---

## Deployment

- ✅ GitHub Pages: docs site deployed under `/pie-qti/` and examples deployed under `/pie-qti/examples/` via `.github/workflows/deploy-pages.yml`
  - docs build output: `packages/docs-site/build`
  - examples build output: `packages/qti2-example/build`

---

## Where to look next

- **Project overview**: `README.md`
- **QTI item player**: `packages/qti2-item-player/README.md`
- **Assessment player**: `packages/qti2-assessment-player/README.md`
- **Default interaction UI**: `packages/qti2-default-components/README.md` + `packages/qti2-default-components/STYLING.md`
- **Evals**: `docs/evals/qti2-default-components/README.md`
- **Scoring/response model**: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
