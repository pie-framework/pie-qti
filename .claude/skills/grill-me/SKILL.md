---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

# Grill Me

Interview me relentlessly about every aspect of this plan until we reach a shared understanding.

Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

## Operating Rules

1. Ask exactly one high-leverage question at a time.
2. Include a recommended answer for that question.
3. If the question can be answered from the codebase, inspect the codebase first and use evidence from it.
4. Keep walking dependency-first through the design tree until shared understanding is reached.
5. Keep a compact running state:
   - decisions made
   - open questions
   - deferred decisions
   - risks
   - next question

## End Condition

Stop when shared understanding is reached or the user asks to stop, then provide:

1. final decision map
2. unresolved risks
3. first implementation steps in dependency order
