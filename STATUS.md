# PIE QTI Project Status

**Last updated**: 2026-07-13

This is the short project snapshot. Package READMEs, `docs/`, and the CI
workflows are the authoritative sources for detailed behavior.

## Current Status

### QTI Players

The core player packages are pre-1.0 and have broad clean-room coverage, but the
2026-07 architecture/conformance review found blockers that prevent a general
"all valid QTI" or certification-ready claim. See `docs/SPEC-GAPS-PLAN.md`.

- `@pie-qti/item-player` registers extractors for all 21 standard QTI 2.2
  interaction names. Schema-valid position-object delivery, parts of QTI 3 HTML
  vocabulary handling, PCI lifecycle integration, record cardinality, and exact
  standard response-template semantics remain open.
- `@pie-qti/assessment-player` sequences QTI assessment tests, sections, item
  refs, item session control, rubric blocks, and response submission.
- `@pie-qti/default-components` supplies the default web-component renderers.
- `textEntryInteraction` and `inlineChoiceInteraction` are first-class inline
  interactions rendered in item-body flow.
- Interaction code is organized under
  `packages/item-player/src/interactions/<interaction>/`, with compatibility
  barrels preserving older import paths.

### QTI 3.0

QTI 3.0 naming infrastructure and broad standard interaction delivery are implemented.

- Version detection supports QTI 2.x and QTI 3.0 item/test roots.
- Element and attribute mapping handles QTI 3.0 kebab-case names and `qti-`
  prefixed element names.
- Standard item interactions share the QTI 2.2 extraction/rendering path where
  semantics align.
- QTI 3.0 Shared Vocabulary classes are preserved for rendering behavior.
- Personal Needs and Preferences and Catalog / Glossary support are implemented
  at the player layer. Portable Custom Interaction extraction/host primitives
  exist, but the production renderer and response lifecycle are not connected.

### Certification Readiness

The public repository uses clean-room certification coverage only.

- Public certification gate: `bun run test:certification:public`.
- Public coverage fixtures and matrix live under `docs/certification/` and the
  package test fixtures.
- Official 1EdTech conformance package execution is intentionally outside this
  public repository and belongs in the private conformance runner.
- The current private runner is useful smoke coverage, not semantic proof: several
  paths pass on construction/no-throw, permit manual-required results, or bypass
  browser interaction through direct response APIs.
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

The non-browser public certification gate passed on 2026-07-13. The browser gate
could not run in that review environment because Playwright's managed Chromium
binary was absent; this was an environment launch failure, not a product assertion
result. `verify:publish:quick` also exposed a Node-10-only ATTW reporting/gate issue.

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
- Domain terms: `CONTEXT.md`
