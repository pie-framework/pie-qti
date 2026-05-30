# Project-Wide Documentation Review

**Status:** active review baseline  
**Last reviewed:** 2026-05-30

This document records the project-wide documentation review baseline. Its purpose is to keep documentation aligned with the current codebase, reduce duplicate authority, and make stale or legacy content visible before it misleads contributors.

## Evidence Hierarchy

When documentation disagrees, use this order:

1. Code, package manifests, public exports, and publish policy.
2. Tests, CI workflows, Playwright coverage, and public certification gates.
3. Canonical trackers: `STATUS.md`, `docs/prds/INVENTORY.md`, `docs/SPEC-GAPS-PLAN.md`, and `docs/certification/public-coverage-matrix.json`.
4. Guides, READMEs, PRDs, eval YAML, and historical plans.

## Documentation Inventory

| Area | Scope | Source of truth | Review action |
| --- | --- | --- | --- |
| Root project docs | `README.md`, `STATUS.md`, `CONTRIBUTING.md`, `UBIQUITOUS_LANGUAGE.md` | `package.json`, `.github/workflows/ci.yml`, package manifests | Keep project status, commands, branch names, package names, and support claims synchronized with CI and manifests. |
| Central guides | Top-level files in `docs/` | Code, PRDs for rationale, public certification policy | Keep these as onboarding and how-to docs; do not let them override PRDs or code for behavior. |
| PRDs | 41 PRDs plus `docs/prds/INVENTORY.md` and `docs/prds/TEMPLATE.md` | Implementation, QTI spec, PRD reviewer rubric | Track status accurately; promote only after a focused review; keep open questions unresolved-only. |
| Certification docs | `docs/certification/*.md`, matrix JSON, schema JSON | `bun run test:certification:public`, clean-room fixtures, private conformance boundary | Keep public evidence clean-room, matrix provenance accurate, and private submission details out of public workflow docs. |
| Eval YAML | 37 `docs/evals/**/evals.yaml` files plus templates | Demo routes and Playwright eval runners | Treat evals as executable or semi-executable behavior scenarios, not the rationale source of truth. |
| Package docs | 25 package manifests, 19 package READMEs, package `docs/` folders | `packages/*/package.json`, `src/index.ts`, `scripts/publish-policy.json` | Validate imports, examples, public API names, side effects, and npm package metadata. |
| App and CLI docs | `apps/demo`, `apps/transform`, `apps/docs`, `tools/cli` | App routes, Playwright config, `tools/cli/oclif.manifest.json` | Keep route links, command names, flags, and app support status current. |
| Process docs | `.github`, `.cursor/rules`, `.claude`, `.changeset` | Current workflows and workspace rules | Review for contributor impact and keep policy docs aligned with public certification constraints. |
| Changelogs | Package, app, and tool changelogs | Release history | Treat as release records only; do not use as architecture or API authority. |

## Fixes Applied In This Review

- Corrected root README references to `@pie-qti/pie-to-qti2`, removed links to missing transform configuration/migration guides, updated the CLI analyze command to `analyze-qti`, and expanded the CI gate summary.
- Updated contributor setup and workflow guidance to use `bun run test`, Bun `>=1.3.11`, `master` as the branch base, current interaction package layout, and the real security PRD.
- Repaired `docs/prds/INVENTORY.md` so IMS Content Package support is listed under architecture, `storage.md` and `security.md` render in the architecture table, evals have an explicit supporting role, and `reference` is a documented status.
- Added PRD discovery and spec-source guidance to `docs/README.md`, removing broken local `docs/specs/` paths and pointing readers to canonical 1EdTech URLs.
- Corrected stale PRD metadata and cross-references in `docs/prds/systems/accessibility.md` and `docs/prds/interactions/match.md`.
- Corrected `docs/evals/**` app metadata from `@pie-qti/qti-example` to `@pie-qti/app-demo` and aligned eval template path names with the actual directories.
- Corrected `docs/certification/public-coverage-matrix.json` fixture provenance for QTI 2.2 Advanced Q2, Q8, Q10, and Q11 rows.
- Indexed all public certification docs in `docs/certification/README.md` with boundary notes.
- Updated transform package and guide examples for current plugin class names, `TransformEngine.use()`, and the handle-based `TransformEngine.transform()` API.
- Rewrote `tools/cli/README.md` command names, flags, and examples against `tools/cli/oclif.manifest.json`.
- Fixed broken app README relative links under `apps/demo` and `apps/transform`.
- Updated stale QTI 2-only wording across root docs, transform guides, player docs, PRDs, eval README files, and package metadata. Default wording now uses plain `QTI` unless a specific version matters.
- Removed obsolete historical/planning docs whose current facts are covered by PRDs, the public certification matrix, or this review baseline.

## Remaining Backlog

### Must Resolve With Project Decision

- License metadata is inconsistent: root `LICENSE` is ISC, while root/package manifests often declare MIT and README footers vary. This should be resolved as a project/legal decision before changing license text.
- Decide whether to restore a policy-compliant local spec snapshot workflow or rely only on external 1EdTech URLs.

### High Priority Cleanup

- Add missing READMEs for publishable packages without one: `packages/core`, `packages/types`, `packages/storage`, `packages/source-profiles`, `packages/qti-processing`, and `packages/default-components`.
- Reconcile transform authority across `docs/TRANSFORMATION-ENGINE.md`, `docs/PIE-QTI-TRANSFORMATION-GUIDE.md`, `docs/VENDOR-TRANSFORM-PLUGIN-GUIDE.md`, `docs/SOURCE-PROFILES.md`, and `docs/prds/architecture/transform-engine.md`.
- Review package README `files` metadata so README files are included in npm tarballs where intended.
- Resolve `packages/i18n/src/components` docs so `LocaleSwitcher` examples do not imply unsupported public exports.

### PRD Follow-Up

- Define promotion criteria for PRD statuses. Many interaction and architecture PRDs are still `draft` even when implementation and tests exist.
- Remove stale `(planned)` labels and resolved `[x]` questions from PRD related/open-question sections.
- Perform focused PRD reviewer passes for the newest architecture PRDs, especially `docs/prds/architecture/qti-to-pie.md` and source-profile related docs.

### Certification Follow-Up

- Add a validator that checks `public-coverage-matrix.json` `fixturePackages` against fixture `manifest.json` `covers` metadata so provenance shifts fail locally.
- Manual assistive-technology signoff remains deferred; do not reintroduce checklist files in this public repo unless they are actively maintained and contain current public evidence.

## Maintenance Rule

Documentation updates are required in the same PR when a change affects any of these surfaces:

- Public package exports, CLI commands, app routes, setup commands, or publish metadata.
- QTI extraction, assessment delivery, response processing, MathML rendering, or browser-visible interaction behavior.
- PRD acceptance criteria, design rationale, or status.
- Public certification coverage, fixtures, matrix rows, or clean-room evidence.
- The transform app support boundary, source-profile behavior, or package-vs-app ownership.

Use plain `QTI` for project-wide, player-wide, component, eval, and generic content references. Use explicit versions only when the version is semantically meaningful, such as QTI 2.2 export, `qti22` route tokens, IMS CP `v2p2` resource types, certification rows, spec citations, or QTI 3.0-only features.

For certification-facing changes, also update `docs/certification/public-coverage-matrix.json` when coverage changes and run `bun run test:certification:public`.
