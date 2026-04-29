# QTI Certification Documentation

This folder contains strategy and gap analysis for obtaining 1EdTech QTI conformance certification.
It is the authoritative reference for what certification means, which path we intend to pursue,
and what work remains before each submission.

## Files

| File | Purpose | Update when… |
|------|---------|--------------|
| [OVERVIEW.md](OVERVIEW.md) | What the 1EdTech certification program is, how it works, what versions/levels/capabilities exist | Program rules change or new QTI version is released |
| [STRATEGY.md](STRATEGY.md) | Recommended certification path, business rationale, effort estimates, sequencing | Priorities shift, resourcing changes, a certification is achieved |
| [qti22-gap-analysis.md](qti22-gap-analysis.md) | Feature-by-feature gap analysis for QTI 2.2 DELIVERY | Implementation work closes a gap, or testing reveals a new one |
| [qti30-gap-analysis.md](qti30-gap-analysis.md) | Feature-by-feature gap analysis for QTI 3.0 DELIVERY | Same as above |
| [PROGRESS.md](PROGRESS.md) | Live tracker: where we are in the certification process, open gaps, submitted checklists | After every sprint that touches a certification milestone |

## How to use this folder

1. **Starting a certification sprint**: read STRATEGY.md to confirm the target level, then use
   the relevant gap analysis file to scope the remaining engineering work.
2. **Filing a PRD for a gap**: use the gap ID (e.g. T9, A-8) as the reference in the PRD title.
3. **After closing a gap**: update the Status column in the gap analysis file and note the
   commit/PR that closed it.
4. **Submitting for certification**: follow the process in OVERVIEW.md; use test packages from
   `../../../qti-conformance/` and the checklist workbooks from the same repo.

## Related resources

- Official test packages: `/Users/eelco.hillenius/dev/prj/pie/qti-conformance/`
- Official spec docs: `/Users/eelco.hillenius/dev/prj/pie/qti-documentation/`
- Online validator: https://membervalidator3.1edtech.org/
- 1EdTech conformance page: https://www.1edtech.org/standards/qti/conformance
- Spec gap plan (implementation): [../SPEC-GAPS-PLAN.md](../SPEC-GAPS-PLAN.md)
