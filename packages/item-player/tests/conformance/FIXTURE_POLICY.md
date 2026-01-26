# Fixture sourcing & licensing policy

This conformance suite is intended to be **redistributable** with this repository.

## What we will include in-repo
- **Minimal, purpose-built QTI XML** authored by us to exercise specific features/operators.
- **Upstream fixtures only when**:
  - the upstream repository explicitly permits redistribution (e.g., MIT/Apache-2.0/BSD), and
  - we record provenance in `manifest.json`.

## What we will NOT include in-repo
- Vendor content packages or item banks without explicit redistribution rights.
- 1EdTech/IMS certification test packages or other member-only assets.
- Anything with unclear or missing licensing.

## Required metadata for any non-trivial fixture
Add `manifest.json` with:
- `source` (project name or “internal”)
- `upstreamUrl` (if applicable)
- `license` (SPDX identifier if known)
- `notes` (what QTI feature/operator/bug it covers)

## Review checklist for new fixtures
- Is licensing clear and compatible?
- Is the fixture minimal (no extra interactions/assets)?
- Does `cases.json` assert only what matters (avoid brittle assertions)?
- Does it have deterministic behavior (seed where needed)?


