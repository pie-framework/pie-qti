# PCI Runtime Engine and Sandbox — Decision Record

**Status**: Landed — phases 1–3 and the sandboxed engine on 2026-10-17, under the
[completeness goal](version-1-0-2026-10.md). This file is condensed to the decisions and the data
behind them; the full implementation plan lives in git history (PRs #337–#342, merged 2026-10-17).
**Last reviewed**: 2026-10-18
**Scope**: `packages/item-player/src/pci/`,
`packages/item-player/src/interactions/portable-custom/`,
`packages/item-player/src/iframe/`,
`packages/pci-runner/`,
`packages/default-components/src/plugins/portable-custom/`

Turned Portable Custom Interaction support from a host-gated escape hatch into a
spec-conformant runtime, and decided where PCI code executes. The interaction
PRD in [`../prds/interactions/custom.md`](../prds/interactions/custom.md)
describes current behavior; this document records what was decided and why.

---

## What landed

1. **Spec contract adoption.** `registry.ts` installs `qtiCustomInteractionContext`,
   `PciHost` instantiates through `getInstance`, responses cross the boundary as QTI
   variable JSON (`qtiVariableJson.ts`), restore re-seeds state, and
   `configuration.status` is derived from role and attempt state. Third-party
   spec-authored PCIs run after this phase and not before it.
2. **AMD loader and module resolution.** `amdLoader.ts` implements `define`/`require`
   with serialized evaluations, shims, and `urlArgs`; `resolutionConfig.ts` parses the
   RequireJS-shaped config and probes the defined default locations;
   `ExtractedPci.modules` carries every authored `qti-interaction-module` entry.
3. **Conformance evidence (in-repo).** Clean-room fixtures
   (`packages/item-player/tests/conformance/pci/`) authored from the specification
   drive the full delivery path over real module files: registration, AMD dependency
   wiring, `getInstance` state seeding, QTI variable JSON, `onready`/`ondone`,
   `getState()` restore, and fallback resolution. Browser-level evidence in the
   private runner attaches to the next published candidate.
4. **Sandboxed engine (Option C).** `SandboxedPciSession` runs the module in
   `<iframe sandbox="allow-scripts">` behind `PciHost`'s shared response-ownership
   state machine; `@pie-qti/pci-runner` builds the deployable runner page
   (CSP-hardened, fixed file names); the `pie-qti-pci-sandbox` protocol carries
   init/instantiate/lifecycle/response-change/resize with mutual origin locking;
   `PciConfiguration.moduleResolver` is required for the page realm and unused under
   `sandbox`, with `createAllowlistPciModulePolicy` as the sandbox-side allow-list.

The one operational step that follows a release is the runner-origin deployment
(`https://qti.pie-framework.org`); until then the engine is fully testable in-repo
and against any origin a host deploys the runner to.

## Execution realm

Per-PCI sandboxed iframe from a cookieless runner origin (Option C), opt-in via
`PciConfiguration.sandbox`; page-realm execution remains available behind an
explicit host `moduleResolver`. Options A (page realm only), B (whole-player
cross-origin iframe), D (retired), and E (worker/ShadowRealm) were evaluated and
rejected — the analysis lives in git history.

---

## Driver: Measured, Then Re-Driven By Completeness

**Update 2026-10-17:** phases 1–4 are **landed**. The project goal is now
feature completeness and a proper 1.0
([`version-1-0-2026-10.md`](version-1-0-2026-10.md)), so spec-shaped PCI must
run for its own sake; the intake measurement below remains valid data but no
longer decides scope. Phases 1–3 gate the 1.0 acceptance criterion that a
third-party spec-authored PCI runs unmodified; phase 4 shipped on the same track
as opt-in hardening and gates nothing.

The original 2026-08-17 measurement, retained for the record:

| Corpus | PCI signal |
| ------ | ---------- |
| Partner third-party corpus — ~17,175 package candidates, ~598,000 items, ~709,000 interactions | PCI appears in the long tail only, with no count. An earlier scan found 11,090 QTI 2.1 packages, 83 QTI 2.2, **no QTI 3.0 packages** |
| Known-PIE subset — 416,304 inputs | 30 `customInteraction`, **zero** `portableCustomInteraction`, 36 in the whole custom/graph/drawing/upload/PCI-like risk bucket |
| Local standards/conformance corpus — ~2,901 profiled documents | 60 `customInteraction`, 49 PCI-signal documents |

The 49 PCI-signal documents sit in the standards corpus, which the source
explicitly treats as conformance material rather than partner-intake realism.
Real intake carries roughly 30 custom interactions in 598,000 items, and they are
the opaque QTI 2.x kind, not portable ones.

The zero-known-PIE count invites a selection-effect objection — PCI content would
be blocked before becoming PIE, so a subset of successful conversions would
undercount it. The version strata answer that: standardized PCI is a QTI 3.0
construct and the partner scan found no QTI 3.0 packages at all, so the rule that
blocks unsupported QTI 3.0 constructs is firing on approximately nothing.

**Superseded decision (2026-08-17):** PCI relevance was held to track QTI 3.0
adoption in partner content rather than PCI itself, with the
opaque-`customInteraction` fallback as proportionate handling. **2026-10-17:**
superseded by the completeness goal — the fallback remains the behavior until
phase 1 lands, not a resting state.

PCI certification follows the same flip: the 2026-08-17 finding — official suite
commit `b058156` ships no PCI packages while Cito holds Delivery-PCI and
Import-PCI — remains true, so the test-content source needs scoping with 1EdTech.
Under the completeness goal that scoping is now part of the 1.0 certification
push rather than an unasked question. Submission strategy lives in the private
conformance project.

What already landed stands on its own merits and is unaffected: the response
ownership fix corrected a live defect, and `createAllowlistPciModuleResolver`
makes the existing host path usable by anyone who does meet a PCI.

---

## Principal Risk

No conformance oracle. Official suite commit `b058156` ships no PCI packages, so
phases 1 and 2 were implemented against specification prose with no official
content to check against, and the first authoritative feedback arrives from
1EdTech during a submission. The in-repo mitigation (2026-10-17) is the
clean-room conformance suite: fixtures authored from the specification exercise
registration, restore-by-state, `ondone`, and fallback resolution over real
module files. What in-repo evidence cannot close is the same-reading risk — the
fixtures were written from the same reading of the spec that produced the
implementation — so testing against a third-party PCI authored to the
specification remains the outstanding mitigation, with official content to be
scoped with 1EdTech.

## Decisions Closed

**PIE Elements are not projected into the PCI contract** (2026-08-17). Exposing
each PIE Element as a conformant PCI module would make the PIE catalogue portable
to third-party players, and `@pie-qti/pie-to-qti2` would emit
`qti-portable-custom-interaction` where it currently emits an opaque QTI 2.x
`customInteraction` that no other player can run.

Rejected because it complicates PIE for a benefit PIE does not need. Distribution
is already solved by CDN-loaded web components sharing a `pie-context` singleton —
the coupling that forced the lockstep `@pie-players/*` pin — and a PCI module must
be self-contained JavaScript at a URL inside the package, so projection would
duplicate that shared runtime in every module of every package. The payoff is
third-party players consuming Renaissance content, which is not a current need:
no host publishes QTI today.

This closes only the outbound direction. PCI *host* support is unaffected and
proceeds on its own track; the two were being conflated.

**Update 2026-10-17 — re-opened for reconsideration, sequenced after phases
1–3.** The completeness goal
([`version-1-0-2026-10.md`](version-1-0-2026-10.md)) retires the "no host
publishes QTI today" rationale. The technical objections stand (a projected
module must be self-contained JavaScript, and nothing can consume it until
conformant hosts exist), so reconsideration is sequenced behind the host
runtime: once phases 1–3 land, re-evaluate whether `@pie-qti/pie-to-qti2`
should emit `qti-portable-custom-interaction` for PIE-backed interactions.

**Reconsidered and re-closed (2026-10-18, after phases 1–4 landed).** The
reconsideration premise held — a conformant host runtime now exists (this
player, phase 4's runner included) — but a runtime was only one of three
load-bearing conditions, and the other two did not move:

1. **Self-containment is an architecture reversal, not an export flag.** PIE's
   distribution is one CDN-loaded runtime shared by every element on the page
   (the coupling that forced the lockstep `@pie-players/*` pin). A projected
   PCI module must be self-contained JavaScript at a URL inside the package;
   projecting would either duplicate that runtime in every module of every
   package or ship a loader that quietly depends on the PIE CDN — reintroducing
   exactly the dependency the projection is meant to remove.
2. **Emitted PIE items are not semantically self-sufficient today.** The
   fallback generator embeds the PIE model with external scoring and a generic
   string response declaration; the mapping-based QTI scoring approximations
   are documented as lossy. Under the current form that is honest — the PIE
   runtime and scoring service travel with the content. A module labeled
   *portable* claims more interoperability than the semantic mapping delivers:
   a third-party host would run the interaction but score it with guesses.
   Per-element response-shape guarantees against QTI base types are per-element
   engineering, not packaging.
3. **Nothing pulls.** No third-party player or consumer needs PIE content
   runnable without the PIE CDN today. Completeness drove the *player* side of
   PCI (an in-spec player runs any conformant PCI); it does not create a
   consumer for an outbound exporter.

**Reopen trigger:** a named consumer that must run Renaissance-authored PIE
interactions on a host that cannot load the PIE CDN. Until that appears, the
outbound direction stays closed and the PCI *host* side — which shipped — is the
completeness deliverable.

**Sandbox origin: `https://qti.pie-framework.org`** (2026-08-17). Satisfies
Option C's runner-origin requirements — distinct, cookieless, static. Not being
able to set response headers costs only `frame-ancestors`, which mutual origin
locking covers.

---

## Related

- Interaction PRD: [`../prds/interactions/custom.md`](../prds/interactions/custom.md)
- Security model PRD: [`../prds/architecture/security.md`](../prds/architecture/security.md)
- Spec gap G-08: [`../SPEC-GAPS-PLAN.md`](../SPEC-GAPS-PLAN.md)
- QTI reference: [`../QTI_techguide.md`](../QTI_techguide.md) §6.1
