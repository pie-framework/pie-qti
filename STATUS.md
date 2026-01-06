# PIE QTI 2.2 Implementation Status

**Last Updated**: 2026-01-06

---

## Overview

High-level implementation status for PIE-QTI. This document is intentionally short; details live in package READMEs and `docs/`.

---

## Status

- ✅ **Shipped**: QTI 2.2 item player + assessment player + QTI↔PIE transforms
- ✅ **QTI item interactions**: **21/21** QTI 2.2 interaction types supported in the core player
- ✅ **Default UI components**: **17** default interaction web components (`@pie-qti/qti2-default-components`)
  - `textEntryInteraction` + `inlineChoiceInteraction` are rendered as inline interactions
  - `uploadInteraction` + `drawingInteraction` use shared Svelte components (`FileUpload`, `DrawingCanvas`)

---

## Test signal

- ✅ **Interaction evals**: YAML specs in `docs/evals/qti2-default-components/*/evals.yaml` executed by Playwright runner in `packages/qti2-example/tests/playwright/qti2-default-components-evals.pw.ts` (currently **49** cases)
- ✅ **Unit/E2E/a11y**: additional coverage exists across packages (see CI workflow and package READMEs for the authoritative counts)

---

## Intentional non-goals

- ❌ Full QTI rule interpreter for assessment-level outcome processing (use standard templates + pluggable outcome processors)
- ❌ QTI 3.0 features (project targets QTI 2.x)

---

## Deployment

- ✅ GitHub Pages: docs site deployed under `/pie-qti` via `.github/workflows/deploy-pages.yml` (build output: `packages/docs-site/build`)

---

## Where to look next

- **Project overview**: `README.md`
- **QTI item player**: `packages/qti2-item-player/README.md`
- **Assessment player**: `packages/qti2-assessment-player/README.md`
- **Default interaction UI**: `packages/qti2-default-components/README.md` + `packages/qti2-default-components/STYLING.md`
- **Evals**: `docs/evals/qti2-default-components/README.md`
- **Scoring/response model**: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
