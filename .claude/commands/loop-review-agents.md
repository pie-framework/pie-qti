---
description: Run repeated consensus-based review agent rounds.
argument-hint: [changes|last-commit|plan|target]
disable-model-invocation: true
---

# Loop Review Agents Command

Run the `loop-review-agents` skill now.

If `$ARGUMENTS` is non-empty, treat it as the review target. If `$ARGUMENTS` is empty, infer the target from the current context: current changes, last commit, accepted plan, PRD, or other active work.

Launch three independent reviewers per round, coordinate their findings, apply only qualifying consensus feedback, and keep the coordinator ledger until the loop reaches a stop condition.
