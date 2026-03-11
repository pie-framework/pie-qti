# Architecture Review Report

Date: 2026-03-08
Project: `pie-qti`
Process: Two independent architecture reviews + two feedback iterations + coordinated synthesis

## Iteration 1 feedback

### Reviewer A critiques Reviewer B
- **Strong evidence:** B correctly identifies the runtime split-brain risk between `AssessmentPlayer` and `ItemRenderer.svelte` creating separate `Player` instances (`packages/assessment-player/src/core/AssessmentPlayer.ts`, `packages/assessment-player/src/components/ItemRenderer.svelte`).
- **Strong evidence (policy-sensitive):** B's navigation finding is concrete: assessment navigation currently uses an attempt proxy ("has any response") rather than validated response state (`packages/assessment-player/src/core/AssessmentPlayer.ts`, `packages/assessment-player/src/core/ItemSessionController.ts`). This is acceptable when product policy is attempt-based progression.
- **Gap noted by A:** B underweights transform/orchestration correctness risks in `transform-core` (progress reporting, cancellation semantics, child workflow layering) that can break backend reliability before UI concerns.
- **Assumption challenge:** B's "commands = green" may be optimistic if underlying orchestration and type contracts remain weak (`any` boundary leakage flagged by A).
- **Scope critique:** B focuses deeply on assessment runtime but does not account for QTI format policy inconsistencies (including specific hardcoded version mismatches in implementation) that can invalidate inputs before runtime.

### Reviewer B critiques Reviewer A
- **Strong evidence:** A's orchestrator findings are likely critical (progress record capture timing, non-authoritative cancel/terminate) and should be treated as platform-level correctness issues (`packages/core/src/orchestration/in-memory-orchestrator.ts`).
- **Strong evidence:** A correctly flags hardcoded format assumptions and metadata inconsistency in transform flow (`packages/core/src/orchestration/activities/transform-qti-to-pie-activity.ts`, `packages/to-pie/src/plugin.ts`).
- **Gap noted by B:** A's runtime analysis is broad but less explicit about how today's UI call path behaves in practice (notably around attempt-based navigation policy and user progression behavior).
- **Priority critique:** A ranks many risks High; B argues user-facing runtime integrity issues (state authority + navigation-policy clarity) should be elevated alongside orchestration fixes, not after.
- **Assumption challenge:** A's fat web component layer concern is valid, but severity depends on intended deployment model (assumed multi-host embedding).

## Iteration 2 feedback

### Reviewer A revises critique of Reviewer B
- **Revision:** Reclassifies B's navigation/validation point as policy-dependent: not a defect under attempt-based progression, but still a contract-clarity concern for navigation/submit semantics.
- **Revision:** Accepts B's split-brain engine ownership as an immediate architectural defect, not merely maintainability debt.
- **Still contested:** Keeps transform orchestration correctness at top priority because broken workflow observability/cancellation can undermine API trust system-wide.
- **Assumption reduced:** A softens objection on commands = green to green-with-conditions if command semantics are backed by unified state and explicit navigation policy.

### Reviewer B revises critique of Reviewer A
- **Revision:** Accepts A's orchestration concerns as foundational and likely to impact reliability beyond transform internals.
- **Revision:** Agrees format hardcoding/inconsistent source metadata is a blocker for a clear QTI format policy and operational diagnostics.
- **Still contested:** B maintains runtime integration defects should be fixed in the same window as orchestration, not deferred, due to immediate UI behavior risk (even when attempt-based progression is intentional).
- **Assumption reduced:** B agrees A's event-channel duplication concern is strong enough for near-term cleanup, even if multi-instance scenarios are not confirmed.

## Consensus

- **Strong agreement (high evidence):**
  - Architecture is modular at package level (transform vs runtime/player vs processing).
  - Extensibility mechanisms are real and valuable (registries/plugins).
  - Current state has correctness risks, not just code quality issues.
  - Runtime has state/event contract weaknesses (duplicate event channels, ownership ambiguity).
  - Navigation policy must be explicit and consistently enforced (attempt-based vs validity-based) to avoid future ambiguity.
- **Moderate agreement (some assumptions):**
  - Web component layer may be doing too much and should be decomposed.
  - Persistence/time tracking architecture is partially disconnected from primary flow.
- **Shared target direction:**
  - Make one clear state authority per session.
  - Tighten contracts/types at boundaries.
  - Reduce duplicated transformation/mapping logic.

## Contention

- **Priority ordering dispute:**
  - **A view:** Fix transform orchestration correctness first (platform reliability gate).
  - **B view:** Fix runtime split-brain + navigation-policy clarity in parallel because they directly affect user behavior.
- **Severity of edge-layer complexity:**
  - **A:** Fat edge is medium-high architectural risk.
  - **B:** Important, but secondary to state authority and navigation-policy correctness.
- **Decision trade-off:**
  - Sequential approach lowers concurrency risk but delays user-facing fixes.
  - Parallel stream approach accelerates risk burn-down but requires tight cross-team coordination and interface freeze.

## Decisions

1. **Run two-track stabilization (decided).**
   - **Track A (core reliability):** orchestrator correctness + transform format contract fixes.
   - **Track B (runtime correctness):** single `Player` authority + navigation-policy contract clarity + event-channel simplification.
2. **Define explicit architecture quality gates before new feature work (decided).**
   - Workflow progress/cancel semantics deterministic.
   - Navigation behavior is explicitly documented and tested as attempt-based progression (any response), unless policy changes.
   - No duplicate handling path for `qti-change`.
3. **Freeze boundary contracts during migration (decided).**
   - No new `any` fields in public boundary DTOs during this period.
4. **Defer major evaluator decomposition unless stabilization completes early (decided).**
   - Keep as phase 2 unless it blocks current correctness goals.
5. **Do not preserve legacy/backward compatibility during this pre-v1 phase (decided).**
   - Optimize for clean contracts and coherent architecture over compatibility shims.
6. **Standardize QTI terminology and API language (decided).**
   - Use version-agnostic `QTI` terminology by default; mention specific versions only where behavior differs.

## Open questions

- Is `InMemoryOrchestrator` the only production path, or just default/dev? (changes risk priority and rollout plan)
- Is `ReferenceBackendAdapter` strictly demo/test, or used in production embedding?
- Is multi-instance embedding a required scenario today? (affects urgency of global event listener cleanup)
- Should navigation policy remain attempt-based across all modes, or vary by assessment mode/config?

## Final report

### Executive view
Both reviews converge on a Yellow architecture: solid modular foundations and extension points, but with critical correctness gaps in orchestration and runtime state contracts. Evidence is strongest around concrete file-level defects (workflow progress/cancel behavior, dual `Player` ownership, and duplicated event channels), plus policy-contract ambiguity around navigation semantics. The recommended path is a time-boxed dual-track stabilization that addresses core reliability and UI correctness in parallel, with contract hardening and explicit release gates.

Pre-v1 constraint: legacy/backward compatibility is intentionally out of scope; architecture choices should favor simplification and internal consistency.

### What both reviews agree on
- Package-level separation is good and strategically aligned.
- Extension architecture (plugins/registries/adapters) is a major strength.
- Current risks are primarily behavioral correctness and contract integrity, not missing architecture.
- Runtime interaction flow is serviceable but fragile where ownership and navigation-policy boundaries blur.
- Contract stabilization is required before scaling features.

### Where they compete
- A emphasizes transform-core/orchestration correctness as first gate.
- B emphasizes runtime split-brain/navigation-policy clarity as immediate UX correctness gate.
- Practical resolution: parallel tracks with synchronized integration milestones.

### Prioritized action plan

- **P0: correctness hotfixes**
  - Fix workflow progress record lifecycle and cancel/terminate semantics in `packages/core/src/orchestration/in-memory-orchestrator.ts`.
  - Remove/align transform format hardcoding + metadata inconsistency in `packages/core/src/orchestration/activities/transform-qti-to-pie-activity.ts` and `packages/to-pie/src/plugin.ts`.
  - Define runtime single-authority ownership rule for `Player` between `AssessmentPlayer.ts` and `ItemRenderer.svelte`.

- **P1: runtime contract integrity**
  - Align `AssessmentPlayer.ts` and `ItemSessionController.ts` around explicit attempt-based gating semantics (or configurable mode), and add tests to lock expected behavior.
  - Eliminate duplicate `qti-change` handling path in `AssessmentShell.svelte`.
  - Add boundary tests for state sync and navigation policy gating.

- **P2: contract hardening**
  - Introduce strict DTOs at public boundaries; prevent new `any` in key interfaces (`transform-engine` and runtime boundary types).
  - Clarify persistence lifecycle integration points (`StatePersistenceManager`, `TimeManager`, adapter methods).
  - Standardize naming/contracts/docs to talk about `QTI` by default, with explicit version qualifiers only for version-specific behavior.

- **P3: structural debt reduction**
  - Reduce duplicated interaction mapping between `ItemRenderer.ts` and `ItemBody.svelte`.
  - Decompose evaluator monolith in `packages/qti-processing/src/eval/evaluator.ts` when correctness and contract gates are met.

### Exit criteria
- Workflow progress/cancel behavior verified deterministic by tests.
- Navigation blocked/allowed according to explicit, tested policy (currently attempt-based progression).
- Single `Player` authority per active item/session in runtime path.
- Event handling path for response updates is singular and observable.
- No new `any` introduced across designated public boundaries.

### Residual risk after plan
- Evaluator complexity remains a medium-term maintainability risk if deferred.
- Web component decomposition remains partially open if scope is constrained to correctness first.
