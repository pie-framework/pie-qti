---
name: grill-with-docs
description: Use when the user asks to "grill me", "stress-test this plan", harden a design, resolve terminology, or decide whether CONTEXT.md or a PRD should capture durable QTI/PIE domain knowledge.
disable-model-invocation: true
---

# Grill With Docs

Interview the user until the plan is clear enough to implement, and capture durable terminology or decisions only when they genuinely crystallize.

## Operating Mode

1. Restate the plan briefly.
2. Build a decision tree across goals, QTI/PIE contracts, package boundaries, data/state, UX/accessibility, tests, certification, rollout, and operations.
3. Resolve upstream decisions before downstream ones.
4. Ask exactly one primary question per turn.
5. Include a concise recommended answer and rationale with each question.
6. Explore the codebase first when the answer can be found there.
7. Track each branch as `decided`, `open`, `blocked`, or `accepted-risk`.

## Project Sources

- Check `CONTEXT.md` for canonical project terminology before introducing new terms.
- Check `docs/prds/` when the plan touches a documented interaction, architecture subsystem, or cross-cutting concern.
- Check `docs/certification/public-coverage-matrix.json` and the `certification-checker` skill when the plan affects public certification coverage.
- Use the `qti-domain-expert`, `pie-domain-expert`, `accessibility-reviewer-assessments`, or `api-design-reviewer` skills when the decision needs their domain lens.
- If `docs/adr/` exists in the future, consider it only for hard-to-reverse architecture decisions; otherwise prefer PRDs and `CONTEXT.md`.

## Domain Awareness

- Challenge overloaded QTI/PIE terms immediately, especially `item`, `response`, `score`, `session`, `plugin`, and `conformance`.
- Propose a canonical term when the user uses vague language.
- Use concrete assessment scenarios to expose edge cases and concept boundaries.
- Cross-check claims against code when the code can answer them.
- Keep QTI, PIE, player runtime, package, and host-application concepts distinct.

## Documentation Capture

- Update `CONTEXT.md` lazily when a domain term is resolved and worth preserving.
- Keep `CONTEXT.md` as domain language and relationship context; do not include implementation notes or scratch-pad details.
- Recommend a PRD update when the decision changes requirements, acceptance criteria, public contracts, or rationale covered by `docs/prds/`.
- Do not create glossary, PRD, or ADR files just to satisfy the workflow; no durable term or decision means no doc update.

## Session Output

Maintain this structure as the conversation progresses:

- **Resolved Decisions**: choice and rationale.
- **Open Decisions**: unresolved blockers.
- **Dependency Map**: `decision -> depends on`.
- **Risks and Mitigations**: top risks with fallback.
- **Docs To Update**: `CONTEXT.md`, PRD path, certification matrix, or none.
- **Ready Check**: explicit yes/no on whether implementation can begin.
