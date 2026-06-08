# PIE QTI Project Status

**Last updated**: 2026-05-04

This is the short project snapshot. Package READMEs, `docs/`, and the CI
workflows are the authoritative sources for detailed behavior.

## Current Status

### QTI Players

The core player packages are pre-1.0 but considered production-ready for the
supported QTI delivery scope.

- `@pie-qti/item-player` renders single QTI items and supports standard QTI
  item interaction types across the supported delivery scope.
- `@pie-qti/assessment-player` sequences QTI assessment tests, sections, item
  refs, item session control, rubric blocks, and response submission.
- `@pie-qti/default-components` supplies the default web-component renderers.
- `textEntryInteraction` and `inlineChoiceInteraction` are first-class inline
  interactions rendered in item-body flow.
- Interaction code is organized under
  `packages/item-player/src/interactions/<interaction>/`, with compatibility
  barrels preserving older import paths.

### QTI 3.0

QTI 3.0 infrastructure and standard interaction delivery are implemented.

- Version detection supports QTI 2.x and QTI 3.0 item/test roots.
- Element and attribute mapping handles QTI 3.0 kebab-case names and `qti-`
  prefixed element names.
- Standard item interactions share the QTI 2.2 extraction/rendering path where
  semantics align.
- QTI 3.0 Shared Vocabulary classes are preserved for rendering behavior.
- Portable Custom Interactions, Personal Needs and Preferences, and Catalog /
  Glossary support are implemented at the player layer.

### Certification Readiness

The public repository uses clean-room certification coverage only.

- Public certification gate: `bun run test:certification:public`.
- Public coverage fixtures and matrix live under `docs/certification/` and the
  package test fixtures.
- Official 1EdTech conformance package execution is intentionally outside this
  public repository and belongs in the private conformance runner.
- The project should remain pre-1.0 until the relevant QTI certification path is
  complete.

### Transformation

The transformation engine remains useful, but is consumed as packages and CLI
tooling rather than a bundled web app.

- Core transformation packages and CLI tooling remain part of the project.
- New product import workflows should be built in host applications, such as a
  CMS, using the transformation packages directly.

### Platform Integration

The players are designed to be embeddable by host applications.

- LTI 1.3 / LTI Advantage implementation is out of scope for this repository.
- Nothing in the player architecture should prevent an LTI tool, LMS, CMS, or
  other host application from embedding the players.
- Host applications own launch, identity, roster, grade passback, persistence,
  and authorization concerns.

## Verification Signal

The current high-signal verification commands are:

- `bun run test`
- `bun run check`
- `bun run typecheck`
- `bun run build`
- `bun run test:certification:public`
- `bun run verify:a11y`
- `bun run verify:apps:deploy`
- `bun run verify:publish:quick`

The full suite was last run successfully as part of the interaction module
refactor on 2026-05-04.

## Intentional Non-Goals

- Implementing an LMS, CMS, or LTI platform in this repository.
- Shipping a supported end-user import product; import workflows belong in host applications such as a CMS.
- Copying official 1EdTech member-only conformance assets into this public repo.
- Treating public clean-room coverage as a substitute for formal certification.

## Deployment

GitHub Pages publishes the docs site and examples via
`.github/workflows/deploy-pages.yml`.

- Docs build output: `apps/docs/build`.
- Demo/examples build output: `apps/demo/build`.

## Where To Look Next

- Project overview: `README.md`
- QTI item player: `packages/item-player/README.md`
- Assessment player: `packages/assessment-player/README.md`
- Default interaction UI: `packages/default-components/README.md`
- Public certification coverage: `docs/certification/README.md`
- Spec-gap tracking: `docs/SPEC-GAPS-PLAN.md`
- Domain terms: `UBIQUITOUS_LANGUAGE.md`
