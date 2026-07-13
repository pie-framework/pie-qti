# Public QTI Certification Coverage

This folder contains only the public, clean-room certification-facing coverage
docs for `pie-qti`. Official 1EdTech package execution, private evidence
bundles, checklist work, and submission planning live in the private
`pie-qti-conformance` project.

> **Evidence boundary (reviewed 2026-07-13):** a matrix row means the mapped
> project-authored command/test exists and passes. It does not by itself prove
> schema validation, candidate-operable browser delivery, or exact scoring
> semantics. QTI 2.2 S3/S4 now has a raw-XML structure/runtime test; the QTI 3.0
> row remains model-level evidence until an equivalent raw-XML case is added.
> Formal claims require current official-package evidence plus interaction and
> score assertions against published NPM artifacts.

The private runner deliberately installs published package versions only. It cannot validate an
unpublished working tree, workspace link, or local tarball, so the current remediation must first
be released as a candidate and pinned there before official-suite results can be attributed to it.

## Files

| File | Purpose | Update when… |
| ------ | ------- | ------------ |
| [PUBLIC_COVERAGE_MATRIX.md](PUBLIC_COVERAGE_MATRIX.md) | Public clean-room QTI Advanced DELIVERY coverage matrix | Public certification-facing tests or fixtures change |
| [public-coverage-matrix.json](public-coverage-matrix.json) | Machine-readable coverage matrix consumed by `bun run test:certification:public` | Public certification-facing tests or fixtures change |
| [public-coverage-matrix.schema.json](public-coverage-matrix.schema.json) | JSON schema for the public matrix | Matrix structure changes |

## How to use this folder

1. Before merging certification-facing changes, update
   `public-coverage-matrix.json` if coverage changed.
2. Run `bun run test:certification:public`.
3. Keep official 1EdTech ZIP/XML artifacts, screenshots, generated reports, and
   private checklist evidence out of this repository.
4. Use the private `pie-qti-conformance` project for official package execution,
   evidence records, certification progress, and submission planning.

## Related resources

- Public clean-room gate: `bun run test:certification:public`
- Public coverage matrix: [PUBLIC_COVERAGE_MATRIX.md](PUBLIC_COVERAGE_MATRIX.md)
- Official test packages: private conformance project only; do not commit
  official ZIP/XML artifacts here
- Online validator: <https://membervalidator3.1edtech.org/>
- 1EdTech conformance page: <https://www.1edtech.org/standards/qti/conformance>
- Spec gap plan (implementation): [../SPEC-GAPS-PLAN.md](../SPEC-GAPS-PLAN.md)
