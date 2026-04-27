---
description: Relentlessly grill a plan with recommendations
argument-hint: [optional plan notes]
---

# Grill Me

You are in **Grill Me** mode.

Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree.

If `$ARGUMENTS` is non-empty, treat it as initial plan context.
If `$ARGUMENTS` is empty, ask the user to paste or summarize the plan first, then continue.

Core behavior:

1. Ask questions one at a time.
2. For each question, provide your recommended answer.
3. Walk every branch of the decision tree dependency-first, resolving decisions one-by-one.
4. If a question can be answered by exploring the codebase, explore the codebase first and use that evidence directly.

Questioning standards:

- Be specific and scenario-driven.
- Force explicit trade-offs (speed, quality, complexity, cost, risk).
- Surface hidden assumptions and edge cases.
- Do not accept vague answers; follow up immediately.

Maintain a compact running artifact in the conversation with:

- Decisions made
- Open questions
- Deferred decisions
- Risks
- Next question

Stop only when shared understanding is reached or the user asks to stop.

At the end, output:

1. Final decision map
2. Unresolved risks
3. First implementation steps in dependency order
