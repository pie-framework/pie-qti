# Remediation Plan Synthesis: Plan A + Plan B

## Scope constraints preserved
- Pre-v1: no backward compatibility requirement.
- Navigation is attempt-based progression by design (presence of response/attempt, not validity gating).
- Use generic `QTI` terminology by default; mention specific versions only where behavior differs.
- Plan is technical and implementation-focused.

## A) Cross-review feedback (A->B, B->A)

### A -> B
- B has correct top-level sequencing, but misses key orchestrator mechanics: pre-context execution record creation, terminal-state closure, explicit cancellation/termination events, and deterministic retry-loop cancellation checks.
- B's transform/contract section is too broad; it should explicitly include removing hardcoded source format propagation.
- B's type hardening intent is good, but it lacks explicit high-risk seam targets.
- A's evaluator gating is more actionable than B's general deferment.
- B omits explicit terminology normalization to generic `QTI`.

### B -> A
- A is complete but can broaden scope too early; evaluator decomposition should stay deferred until core/runtime behavior is stable.
- A strongly removes fallback ingress paths; B rightly keeps fallback necessity as an explicit unresolved choice.
- A trends toward early API concretization; B correctly preserves user-facing architecture choices for confirmation.
- A's no-`any` rollout should be constrained by dynamic-boundary decoder patterns to avoid unsafe churn.
- B's do-not-change broad shell decomposition/package naming keeps remediation sharply focused.

## B) Merged technical plan (ordered steps with files and checks)

1. Stabilize orchestrator lifecycle semantics first.
   - Files:
     - `packages/core/src/orchestration/in-memory-orchestrator.ts`
     - `packages/types/src/orchestration/orchestrator.ts`
     - `packages/core/tests/orchestration/in-memory-orchestrator.test.ts`
   - Implementation:
     - Create/store execution record before context creation.
     - Enforce closed terminal states (`cancelled`/`terminated` cannot become `completed`).
     - Emit deterministic terminal events and persist terminate reason.
     - Add cooperative cancellation checks in sleep/retry/backoff loops.
   - Checks:
     - Unit tests: progress visibility, cancel during execution, cancel during retry/backoff, event ordering.
     - `cd packages/core && bun test tests/orchestration/in-memory-orchestrator.test.ts`

2. Make `AssessmentPlayer` the sole runtime owner of active `Player`.
   - Files:
     - `packages/assessment-player/src/core/AssessmentPlayer.ts`
     - `packages/assessment-player/src/components/ItemRenderer.svelte`
     - `packages/assessment-player/src/types/index.ts`
   - Implementation:
     - Remove `Player` construction from `ItemRenderer`.
     - Pass authoritative player/session view from `AssessmentPlayer`.
     - Guarantee one active player lifecycle per item transition.
   - Checks:
     - Lifecycle tests for init/navigate/destroy ownership invariants.
     - Integration checks for response persistence across transitions.

3. Remove duplicate response ingress and keep one default path.
   - Files:
     - `packages/assessment-player/src/components/AssessmentShell.svelte`
     - `packages/item-player/src/components/ItemBody.svelte`
     - `docs/evals/assessment-player/event-plumbing/evals.yaml`
   - Implementation:
     - Keep callback path as canonical ingress.
     - Remove duplicate shell/document-level listeners by default.
     - Treat fallback listener as optional design choice, not baseline behavior.
   - Checks:
     - Event-plumbing integration scenarios verify single update per interaction and persistence.

4. Encode attempt-based navigation semantics explicitly.
   - Files:
     - `packages/assessment-player/src/core/ItemSessionController.ts`
     - `packages/assessment-player/src/core/AssessmentPlayer.ts`
     - `packages/assessment-player/src/integration/api-contract.ts`
   - Implementation:
     - Use attempt semantics (`hasAttempt`) in progression logic and naming.
     - Keep response validation for submit-time handling only.
   - Checks:
     - Unit tests for linear/nonlinear progression with attempted-but-invalid responses still progressing.
     - Integration tests for navigation and response persistence.

5. Fix transform source format propagation and metadata consistency.
   - Files:
     - `packages/core/src/orchestration/activities/transform-qti-to-pie-activity.ts`
     - `packages/core/src/orchestration/workflows/transform-item-workflow.ts`
     - `packages/to-pie/src/plugin.ts`
     - `packages/to-pie/tests/plugin.test.ts`
     - `packages/core/tests/transform-engine.test.ts`
   - Implementation:
     - Pass detected `sourceFormat` into transform activity; remove hardcoded format.
     - Align metadata with actual parsed behavior branch; version labels only where behavior differs.
   - Checks:
     - Contract tests for non-hardcoded source format path.
     - Plugin metadata tests for item/assessment flows.

6. Harden boundary typing at public seams.
   - Files:
     - `packages/types/src/transform/plugin.ts`
     - `packages/assessment-player/src/integration/api-contract.ts`
     - `packages/assessment-player/src/core/AssessmentPlayer.ts`
     - `packages/item-player/src/components/ItemBody.svelte`
     - `packages/item-player/src/core/ItemRenderer.ts`
   - Implementation:
     - Replace `any` at public seams with typed DTOs and response/interaction models.
     - Use `unknown` plus explicit narrowing/decoders at dynamic boundaries.
   - Checks:
     - `bun run typecheck`
     - `cd packages/assessment-player && bun run check`

7. Unify duplicated render planning/mapping logic.
   - Files:
     - `packages/item-player/src/core/ItemRenderer.ts`
     - `packages/item-player/src/components/ItemBody.svelte`
     - `packages/item-player/src/core/interaction-mapping.ts` (new)
     - `packages/item-player/tests/core/interaction-plumbing.test.ts`
   - Implementation:
     - Centralize interaction classification and placeholder mapping in shared utility.
   - Checks:
     - Parity tests asserting equivalent outputs from both render paths.

8. Normalize generic `QTI` naming in shared contracts/docs/logs.
   - Files:
     - `packages/assessment-player/src/integration/api-contract.ts`
     - `packages/assessment-player/src/components/index.ts`
     - `packages/to-pie/src/index.ts`
     - `packages/core/src/orchestration/activities/detect-format-activity.ts`
   - Implementation:
     - Use `QTI` as default term.
     - Keep version-specific labels only in behavior-divergent branches.
   - Checks:
     - Repo scan for misleading version labels in shared surfaces.
     - Keep targeted format-ID assertions where behavior requires it.

9. Keep evaluator decomposition deferred behind parity gate.
   - Files (deferred):
     - `packages/qti-processing/src/eval/evaluator.ts`
     - `packages/qti-processing/src/eval/*`
   - Implementation:
     - Do not decompose in this pass.
     - Re-open only after steps 1-8 are stable and parity fixtures are in place.
   - Checks:
     - If activated later: strict before/after parity verification.

## C) Open decisions list
- Cancel vs terminate as distinct public API outcomes vs unified terminal cancellation model.
- Expose full `Player` to render layer vs narrowed session/view interface.
- Callback-only ingress vs optional debug/global fallback listener.
- Response typing model: JSON-like flexible map vs discriminated unions.
- Attempt policy as immutable default-only behavior vs configurable extension point.
- Evaluator extraction trigger strictness (explicit parity threshold vs opportunistic post-stabilization extraction).
