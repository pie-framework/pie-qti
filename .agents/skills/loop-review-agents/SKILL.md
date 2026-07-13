---
name: loop-review-agents
description: Use only when the user explicitly asks to run loop-review-agents, invokes /loop-review-agents, or requests repeated independent review rounds over changes, a commit, a plan, a PRD, or another review target.
disable-model-invocation: true
---

# Loop Review Agents

Run repeated three-agent review rounds and apply only consensus findings with clear value. This is an opt-in workflow; do not use it for ordinary reviews unless the user invokes it.

## Review Target

Infer the target from the current context or command arguments:

- current uncommitted changes,
- the last commit or branch diff,
- an accepted implementation plan,
- a PRD or design document,
- another explicit target named by the user.

If the target is genuinely ambiguous, ask one concise clarification before starting.

## Round Workflow

1. Launch three independent reviewers against the same target. Do not share reviewers' same-round outputs with each other.
2. Ask each reviewer to focus on high-signal issues: correctness, contracts, security/privacy, accessibility, data loss, tests/build, release/publishing risk, and user-visible regressions.
3. Merge findings into a coordinator ledger.
4. Apply feedback only when it meets one of these thresholds:
   - at least two reviewers strongly agree on a high-value finding,
   - all three reviewers agree on a medium-value finding.
5. Do not apply taste-only style feedback, unsupported speculation, or findings already rejected in a prior round unless new evidence appears.
6. After applying accepted feedback, run another review round against the updated state.

## Value Levels

- **High value**: likely bug, contract break, security/privacy issue, accessibility issue, data loss, failing test/build, release/publishing risk, or user-visible regression.
- **Medium value**: maintainability, test coverage, documentation, or API clarity issue with concrete impact and agreement across all reviewers.
- **Low value**: style, preference, naming taste, speculative refactor, or change without demonstrated impact.

Treat reviewers as **strongly agreeing** when they identify the same underlying issue, assign similar severity, cite evidence, and point toward compatible fixes.

## Coordinator Ledger

Maintain this ledger during the loop:

- **Round**: review pass number and target reviewed.
- **Applied**: finding, consensus evidence, files changed, and verification performed.
- **Rejected or Deferred**: finding, reviewers who raised it, and rationale.
- **Already Handled**: repeated findings from prior rounds and where they were addressed.
- **Human Review Pointers**: disputed or variable areas the user should inspect if the loop does not converge.

Use the ledger to avoid bouncing between stylistic alternatives across rounds.

## Stop Conditions

- Stop when a round produces no qualifying consensus findings.
- If more than 5 rounds are needed, narrow the remaining review focus and explicitly look for taste or variability churn.
- If 10 rounds complete without convergence, stop. Ask the user to review and report the specific disputed areas, accepted changes, rejected findings, and remaining uncertainty.

## Final Report

Report:

- whether the final state is acceptable as-is,
- rounds completed,
- applied consensus fixes,
- findings rejected or deferred and why,
- verification run or not run,
- human-review pointers if convergence failed.
