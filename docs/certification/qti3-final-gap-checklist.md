# QTI 3 Final Gap Checklist

This checklist is the Stage 6 handoff artifact. It records public clean-room
evidence now and leaves published-package/private conformance fields pending
until affected `@pie-qti/*` packages are published and the private
`pie-qti-conformance` project consumes those published versions.

Do not paste official 1EdTech XML, ZIP contents, screenshots, raw private logs,
or private fixture identifiers into this file.

## Current Gate Status

- Public certification gate: passed after publishing `0.1.7`.
- Local package version: prepared at `0.1.7`.
- Full fixed-versioning check: passed.
- `bun run verify:publish:quick`: passed.
- `bun run check:npm-auth`: passed.
- Package publish: `@pie-qti/*` `0.1.7` packages published.
- Private conformance: `pie-qti-conformance` full delivery workflow passed
  against published `0.1.7` packages.
- Manual AT signoff: checklist created; execution pending.

## Affected Publishable Packages

The repository uses lockstep fixed versioning for publishable `@pie-qti/*`
packages, so the local `0.1.7` version prep updates all publishable packages:

- `@pie-qti/assessment-player`
- `@pie-qti/default-components`
- `@pie-qti/demo-vendor-extensions`
- `@pie-qti/element-schemas`
- `@pie-qti/i18n`
- `@pie-qti/ims-cp-browser`
- `@pie-qti/ims-cp-core`
- `@pie-qti/ims-cp-node`
- `@pie-qti/item-player`
- `@pie-qti/logger`
- `@pie-qti/pie-to-qti2`
- `@pie-qti/player-elements`
- `@pie-qti/qti-common`
- `@pie-qti/qti-processing`
- `@pie-qti/storage`
- `@pie-qti/test-utils`
- `@pie-qti/to-pie`
- `@pie-qti/transform-cli`
- `@pie-qti/transform-core`
- `@pie-qti/transform-types`
- `@pie-qti/typeset-katex`
- `@pie-qti/web-component-loaders`

`apps/demo` changes are public evidence/demo changes and are not published as
`@pie-qti/*` packages. `apps/docs` and `apps/transform` package metadata was
versioned by Changesets, but they are private apps and are not npm-published.

## Pre-Publish Checklist

- [x] Confirm no unrelated working-tree changes are included in the release scope.
- [x] Run focused unit and browser evidence gates.
- [x] Run `bun run test:certification:public`.
- [x] Run `bun run verify:publish:quick`.
- [x] Run source-leakage scan for private conformance names, official asset paths,
  screenshots, raw logs, and sibling project fixture identifiers.
- [x] Create and review release changesets/versions for affected packages.
- [x] Confirm npm auth with `bun run check:npm-auth`.
- [x] Publish affected packages.

## Private Conformance Checklist

- [x] Update `pie-qti-conformance` to consume the published package versions.
- [x] Run private official conformance there, not in this repository.
- [ ] Translate any failures into sanitized feature-level findings.
- [ ] Add or update public clean-room fixtures for each confirmed behavior gap.
- [ ] Fix `pie-qti`, publish follow-up packages, and rerun private conformance.

## Feature Status

| Feature area | Public evidence | Private published-package status | Intentional divergence | Residual risk |
| --- | --- | --- | --- | --- |
| Resolved per-item delivery context | Unit coverage and public matrix rows updated | Passed private delivery workflow against published `0.1.7` packages | None recorded | Continue monitoring expanded official-package edge cases |
| Effective time limits and itemSessionControl precedence | Unit/browser evidence and public matrix rows updated | Passed private delivery workflow against published `0.1.7` packages | None recorded | Manual AT timer signoff pending |
| Backend-authoritative timing enforcement | Adapter contract coverage updated | Passed private delivery workflow against published `0.1.7` packages | None recorded | Server integration environments still need rollout validation |
| PNP/access-for-all display and content supports | Parser/apply tests, catalog tests, browser PNP fixture, and manual checklist updated | Passed private delivery workflow against published `0.1.7` packages | Host-routed supports remain user-initiated; no automatic assistive behavior is triggered by the player | Manual AT signoff pending |
| Shared stimulus runtime delivery | Parser, renderer, stylesheet, catalog, and browser fixture coverage updated | Passed private delivery workflow against published `0.1.7` packages | None recorded | Continue monitoring official-package visual parity |
| Stylesheet and asset scoping | Package-relative path gates, unsafe CSS blocking, scoped CSS unit/browser checks updated | Passed private delivery workflow against published `0.1.7` packages | Unsafe remote/CSS-loading behavior is blocked by default | Official stylesheet compatibility passed automated workflow; manual visual review still useful |
| Scoped catalog delivery | Stimulus-scoped catalog lookup, language fallback, host event, and browser checks updated | Passed private delivery workflow against published `0.1.7` packages | Host-defined supports are emitted as sanitized events for the host to handle | Manual AT signoff pending |
| Browser-visible PNP/catalog UI | Stage 5 Playwright coverage and manual AT checklist updated | Passed private delivery workflow against published `0.1.7` packages | Automation does not claim screen-reader announcement quality | Manual AT signoff pending |
| Accessible timer UI | Browser warning/expiry, focus preservation, and narrow viewport coverage updated | Passed private delivery workflow against published `0.1.7` packages | None recorded | Reduced-motion/contrast manual evidence pending |

## Final Acceptance

Stage 6 is complete only after:

- [x] Published packages pass public gates.
- [x] Private conformance passes in `pie-qti-conformance` against published package
  versions.
- [x] The feature status table above is updated with private status, intentional
  divergences, and residual risks.
- [ ] Manual AT evidence is either signed off or explicitly deferred with linked
  follow-up.
