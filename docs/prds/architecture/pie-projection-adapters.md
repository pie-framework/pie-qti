# PRD: PIE Projection Adapters (dormant — decision record)

<!--
  Status: reference
  Type: architecture
  Packages: @pie-qti/to-pie, @pie-qti/pie-to-qti2, @pie-qti/transform-core
  Last reviewed: 2026-11-17
-->

**Status:** reference (dormant — reduced from a full draft PRD on 2026-11-17)
**Type:** architecture
**Packages:** `@pie-qti/to-pie`, `@pie-qti/pie-to-qti2`, `@pie-qti/transform-core`

## Standing constraint

If PIE projection adapter work ever starts, adapters map accepted `pie-players`
shared projection contracts (interaction events, score/outcome projections,
media/evidence metadata, section slices) into QTI/PCI concepts. The boundary
rule is the one durable requirement from the former draft PRD:

> `pie-qti` consumes accepted `pie-players` projection types and never redefines
> parallel event, score, media, evidence, or section-slice contracts in this
> repo. Mappings are labeled lossless, explicitly lossy, unsupported, or
> extension/profile-specific, and no conformance claim is made without a
> validation suite for the claimed behavior.

## Why this is dormant

**2026-10-18:** the outbound direction adjacent to this PRD (projecting PIE
Elements into the PCI contract) was reconsidered after PCI phases 1–4 landed
and re-closed — self-containment would reverse PIE's shared-CDN architecture,
emitted PIE items are scored externally and not semantically self-sufficient,
and no consumer pulls. **2026-11-17:** the former draft's requirements
scaffolding (FRs/ACs/extension points) governed no existing code and depended
on unratified `pie-players` shared-contract PRDs, so it was reduced to this
decision record under the repo's no-legacy policy.

## Decision records

- [`docs/plans/pci-runtime-and-sandbox-2026-08.md`](../../plans/pci-runtime-and-sandbox-2026-08.md)
  ("Decisions Closed")
- [`docs/plans/version-1-0-2026-10.md`](../../plans/version-1-0-2026-10.md)
  ("Re-opened decisions", PIE-into-PCI row)

## Re-open trigger

Re-open this PRD as a full draft when the `pie-players` shared-contract PRDs
(`pie-players/docs/prds/shared-contracts/`) are accepted, or when a named
consumer must run PIE interactions on a host without the PIE CDN.

## Related

- Adjacent PRDs: [`qti-to-pie.md`](qti-to-pie.md), [`pie-to-qti.md`](pie-to-qti.md),
  [`transform-engine.md`](transform-engine.md), [`../interactions/custom.md`](../interactions/custom.md).
