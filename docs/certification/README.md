# QTI Certification Documentation

This folder contains strategy and progress tracking for obtaining 1EdTech QTI conformance certification.
It is the authoritative reference for what certification means, which path we intend to pursue,
and what work remains before each submission.

## Files

| File | Purpose | Update when… |
|------|---------|--------------|
| [OVERVIEW.md](OVERVIEW.md) | What the 1EdTech certification program is, how it works, what versions/levels/capabilities exist | Program rules change or new QTI version is released |
| [STRATEGY.md](STRATEGY.md) | Recommended certification path, business rationale, effort estimates, sequencing | Priorities shift, resourcing changes, a certification is achieved |
| [PROGRESS.md](PROGRESS.md) | Live tracker: where we are in the certification process, open gaps, submitted checklists | After every sprint that touches a certification milestone |
| [PUBLIC_COVERAGE_MATRIX.md](PUBLIC_COVERAGE_MATRIX.md) | Public clean-room QTI Advanced DELIVERY coverage matrix | Public certification-facing tests or fixtures change |

## How to use this folder

1. **Starting a certification sprint**: read STRATEGY.md to confirm the target level, then use
   PROGRESS.md to scope the remaining work.
2. **Filing a PRD for a gap**: use the gap ID (e.g. T9, A-8) as the reference in the PRD title.
3. **After closing a gap**: update PROGRESS.md with the implementation and verification evidence.
4. **Before merging certification-facing changes**: run `bun run test:certification:public`.
5. **Submitting for certification**: use the private `pie-qti-conformance` project for official
   1EdTech package execution and checklist evidence. Public CI must not read that private repo.

## Related resources

- Public clean-room gate: `bun run test:certification:public`
- Public coverage matrix: [PUBLIC_COVERAGE_MATRIX.md](PUBLIC_COVERAGE_MATRIX.md)
- Official test packages: private sibling project only; do not commit official ZIP/XML artifacts here
- Official spec docs: `/Users/eelco.hillenius/dev/prj/pie/qti-documentation/`
- Online validator: https://membervalidator3.1edtech.org/
- 1EdTech conformance page: https://www.1edtech.org/standards/qti/conformance
- Spec gap plan (implementation): [../SPEC-GAPS-PLAN.md](../SPEC-GAPS-PLAN.md)
