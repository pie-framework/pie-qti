# PRD: [Title]

<!--
  Status: planned | draft | current | needs-update | reference
  Type: interaction | architecture | system
  Packages: @pie-qti/...
  QTI type (interactions only): e.g. choiceInteraction
  Last reviewed: YYYY-MM-DD
-->

**Status:** draft  
**Type:** [interaction | architecture | system]  
**Packages:** `@pie-qti/...`  
**Last reviewed:** YYYY-MM-DD

---

## Summary

One paragraph. What this is, what it does, and why it exists in this framework.

---

## Background and rationale

Why was this built the way it was? What constraints (QTI spec, accessibility, K-12 UX, performance) shaped the design decisions? What alternatives were considered and rejected?

This section is the most important one for future maintainers — it's the context that can't be derived from reading the code.

---

## QTI specification alignment

*(Interaction and architecture PRDs only. Omit for purely system PRDs.)*

- **Spec version(s):** QTI 2.1 / 2.2 / 3.0
  - Use “primary” for the spec edition that owns the section references; supported QTI content is version-normalized unless the PRD states otherwise.
- **Spec section(s):** e.g. §4.1.1 choiceInteraction
- **Supported attributes:** list them
- **Deliberately omitted attributes:** list with reason
- **Known divergences from spec:** list with rationale

---

## Functional requirements

What must this feature/subsystem do? Write as testable statements.

- **FR-1:** ...
- **FR-2:** ...

---

## Non-functional requirements

- **Accessibility:** WCAG 2.2 AA requirements specific to this feature (keyboard nav, ARIA roles, focus management, touch targets).
- **Performance:** Any latency or bundle-size constraints.
- **Cross-platform:** Desktop + mobile (touch) requirements.
- **Security:** Sanitization, isolation, or trust-boundary requirements.
- **i18n:** Localization requirements (labels, RTL, pluralization).

---

## Design decisions

Document significant decisions with rationale. Each entry should be a decision that a future engineer might be tempted to change — and would need to understand *why* it is the way it is.

### [Decision title]

**Decision:** What was decided.  
**Rationale:** Why this was chosen over the alternative(s).  
**Alternatives considered:** What else was considered.  
**Consequences:** What this decision constrains downstream.

---

## Extension points

*(Architecture and system PRDs only.)*

How can this subsystem be extended without modifying its core? List each extension point:

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| ... | ... | ... | ... |

---

## Data model / contracts

*(Architecture PRDs and interaction PRDs.)*

Key types, schemas, or variable contracts. Reference the source files rather than duplicating them, but call out the invariants that aren't obvious from reading the types.

---

## Acceptance criteria

Testable criteria — usable directly for manual QA, Playwright scripting, or AI-assisted verification. Each criterion is a self-contained check with a clear pass/fail condition.

Format each criterion as:
```
AC-N: [scenario]
  Given: [precondition]
  When: [action]
  Then: [expected outcome]
  Notes: [optional: edge cases, timing, known quirks]
```

### Functional

- **AC-1:** ...

### Accessibility

- **AC-A1:** ...

### Edge cases

- **AC-E1:** ...

---

## Open questions

Questions that were not resolved at the time of writing. Remove when resolved; don't leave stale entries.

- [ ] ...

---

## Related

- QTI spec: [link or section reference]
- Implementation: `packages/...`
- Adjacent PRDs: [link to related PRDs]
- Existing docs: [link to any docs/ files that overlap]
