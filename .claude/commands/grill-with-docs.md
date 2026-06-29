---
description: Stress-test a QTI/PIE plan and capture durable docs.
argument-hint: [plan-or-context]
---

# Grill With Docs Command

Run the `grill-with-docs` skill now.

If `$ARGUMENTS` is non-empty, treat it as the initial plan context to interrogate.
If `$ARGUMENTS` is empty, ask for the plan first, then begin.

Interview one decision branch at a time, provide a recommended answer with each question, explore the codebase when it can answer the question, and update `CONTEXT.md`, PRDs, or certification docs only when a real term or decision crystallizes.
