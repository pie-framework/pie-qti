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
  interaction names. The current tree includes schema-valid position-object
  extraction, QTI 3 foreign-vocabulary pass-through, host-resolved PCI lifecycle,
  typed record cardinality, complete extended-text response shapes, and canonical
  fixed-template behavior for the supported URI set. This is broad coverage, not
  proof that every interaction is candidate-operable in every browser/profile.
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
  at the player layer. Portable Custom Interaction extraction and the production
  lifecycle are connected, but module execution remains disabled until the host
  supplies a resolver; accepted PCI code is trusted page-authority code, not sandboxed.
- Remaining assessment semantics include dynamic preconditions, section/testPart
  branch rules, and sequence-indexed clone materialization for selection with replacement.

### Certification Readiness

The public repository uses clean-room certification coverage only.

- Public certification gate: `bun run test:certification:public`.
- Public coverage fixtures and matrix live under `docs/certification/` and the
  package test fixtures.
- Official 1EdTech conformance package execution is intentionally outside this
  public repository and belongs in the private conformance runner.
- That runner consumes published NPM candidates only. Current working-tree fixes
  cannot be exercised by the official suite until a new candidate is published and
  pinned; prior green evidence applies to the previously published candidate.
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

The complete public certification gate passed on 2026-07-13, including the targeted
Chromium interaction and accessibility suites. `verify:publish:quick` also passes;
its ATTW fallback now handles the same known Node-10 and CSS-resolution diagnostics
as the structured-report path.

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
