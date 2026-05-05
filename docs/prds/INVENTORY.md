# PRD Inventory

This directory contains Product Requirements Documents (PRDs) for the PIE-QTI framework.

## What PRDs are for

PRDs are the canonical source of *why* — why a feature works the way it does, what constraints shaped it, what the acceptance criteria are, and how it fits the broader system. They complement the code (which says *what*) and the QTI spec (which says *what the standard requires*).

They are the successor to `docs/evals/`, which was too lean and required an AI runner to be useful. PRDs carry the full context: rationale, constraints, edge cases, and testable acceptance criteria that can feed manual QA, Playwright tests, or AI-assisted verification.

## Directory structure

```
docs/prds/
├── INVENTORY.md          ← this file
├── TEMPLATE.md           ← starting point for any new PRD
├── interactions/         ← one PRD per QTI interaction type
│   ├── choice.md
│   ├── order.md
│   └── ...
├── architecture/         ← subsystem PRDs (how it works, why, extension points)
│   ├── item-player.md
│   ├── assessment-player.md
│   ├── transform-engine.md
│   ├── response-processing.md
│   └── ...
└── systems/              ← cross-cutting concerns and integrations
    ├── i18n.md
    ├── theming.md
    ├── accessibility.md
    ├── ims-content-packages.md
    └── ...
```

---

## Interaction PRDs (`interactions/`)

One PRD per QTI interaction type implemented in `@pie-qti/default-components`.

| File | QTI Type | Component | Status |
|------|----------|-----------|--------|
| `interactions/choice.md` | `choiceInteraction` | `pie-qti-choice` | draft |
| `interactions/order.md` | `orderInteraction` | `pie-qti-order` | draft |
| `interactions/match.md` | `matchInteraction` | `pie-qti-match` | draft |
| `interactions/associate.md` | `associateInteraction` | `pie-qti-associate` | draft |
| `interactions/gap-match.md` | `gapMatchInteraction` | `pie-qti-gap-match` | draft |
| `interactions/graphic-gap-match.md` | `graphicGapMatchInteraction` | `pie-qti-graphic-gap-match` | draft |
| `interactions/hotspot.md` | `hotspotInteraction` | `pie-qti-hotspot` | draft |
| `interactions/hottext.md` | `hottextInteraction` | `pie-qti-hottext` | draft |
| `interactions/extended-text.md` | `extendedTextInteraction` | `pie-qti-extended-text` | draft |
| `interactions/slider.md` | `sliderInteraction` | `pie-qti-slider` | draft |
| `interactions/select-point.md` | `selectPointInteraction` | `pie-qti-select-point` | draft |
| `interactions/graphic-order.md` | `graphicOrderInteraction` | `pie-qti-graphic-order` | draft |
| `interactions/graphic-associate.md` | `graphicAssociateInteraction` | `pie-qti-graphic-associate` | draft |
| `interactions/position-object.md` | `positionObjectInteraction` | `pie-qti-position-object` | draft |
| `interactions/media.md` | `mediaInteraction` | `pie-qti-media` | draft |
| `interactions/end-attempt.md` | `endAttemptInteraction` | `pie-qti-end-attempt` | draft |
| `interactions/upload.md` | `uploadInteraction` | `pie-qti-upload` | draft |
| `interactions/drawing.md` | `drawingInteraction` | `pie-qti-drawing` | draft |
| `interactions/custom.md` | `customInteraction` / `qti-portable-custom-interaction` | `pie-qti-custom` | current |
| `interactions/inline-interactions.md` | `textEntryInteraction`, `inlineChoiceInteraction` | inline renderers | draft |

Each interaction PRD answers:
- What does this interaction do (QTI spec summary, in plain language)?
- What are the response variable semantics (baseType, cardinality, correct response)?
- What QTI attributes are supported / deliberately omitted?
- What are the accessibility requirements specific to this interaction?
- What does correct/incorrect/partial scoring look like?
- What are the known edge cases and their expected behavior?
- What are the acceptance criteria (testable, human- or AI-runnable)?

---

## Architecture PRDs (`architecture/`)

Subsystem-level PRDs covering how major packages work and how to extend them.

| File | Subsystem | Packages | Status |
|------|-----------|----------|--------|
| `architecture/item-player.md` | QTI Item Player | `@pie-qti/item-player` | draft |
| `architecture/assessment-player.md` | Assessment Shell | `@pie-qti/assessment-player` | draft |
| `architecture/transform-engine.md` | Transform Engine & Plugin System | `@pie-qti/transform-core`, `@pie-qti/transform-types` | draft |
| `architecture/qti-to-pie.md` | QTI → PIE Transform | `@pie-qti/to-pie` | draft |
| `architecture/pie-to-qti.md` | PIE → QTI Transform | `@pie-qti/pie-to-qti2` | draft |
| `architecture/response-processing.md` | Response Processing Engine | `@pie-qti/qti-processing` | draft |
| `architecture/web-components.md` | Web Component Infrastructure | `@pie-qti/default-components`, `@pie-qti/player-elements` | draft |
| `architecture/item-player-plugin-system.md` | Item Player Plugin / Extension API | `@pie-qti/item-player` | draft |
| `architecture/vendor-extensions.md` | Vendor Transform Extensions | `@pie-qti/to-pie` vendor hooks | draft |
| `architecture/ims-content-packages.md` | IMS Content Package Support | `@pie-qti/ims-cp-*` | draft |
| `architecture/storage.md` | Pluggable Storage Backends | `@pie-qti/storage` | draft |
| `architecture/security.md` | Security Model (sanitization, iframe isolation, Trusted Types) | `@pie-qti/item-player` | draft |

Each architecture PRD answers:
- What problem does this subsystem solve?
- What are the key design decisions and their rationale?
- What are the public extension points (registries, interfaces, hooks)?
- How does it interact with adjacent subsystems?
- What are the constraints (performance, security, standards compliance) and why?
- What does "correctly extended" look like (acceptance criteria for integration)?

---

## Systems PRDs (`systems/`)

Cross-cutting concerns that span multiple packages.

| File | Concern | Status |
|------|---------|--------|
| `systems/i18n.md` | Internationalization (locale switching, RTL, pluralization, lazy loading) | current |
| `systems/theming.md` | Theming and visual customization (DaisyUI, CSS variables, `::part()`) | current |
| `systems/accessibility.md` | Accessibility baseline (WCAG 2.2 AA, assessment-specific patterns) | current |
| `systems/pnp.md` | QTI 3.0 Personal Needs and Preferences profile (color schemes, elimination tool, extended time, glossary triggers) | current |
| `systems/catalog.md` | QTI 3.0 Catalog system (glossary, keyword translation, illustrated glossary, platform-level usages) | current |
| `systems/navigation-modes.md` | QTI navigation modes (linear/nonlinear) and submission modes | current |
| `systems/math-typesetting.md` | Math rendering (KaTeX adapter, host-provided `typeset()`) | current |
| `systems/cli.md` | CLI tool (batch transform, analyze, discover) | current |
| `systems/transform-app.md` | Internal/reference transform harness (upload → analyze → transform → preview) | reference |

---

## Writing a new PRD

1. Copy `TEMPLATE.md` to the appropriate subdirectory.
2. Use the `prd-author` Claude skill — it will interview you about missing context before drafting.
3. Use the `prd-reviewer` Claude skill to validate the draft before merging.

## Keeping PRDs current

- When implementation changes in a way that affects acceptance criteria or design rationale, update the PRD in the same PR.
- Use the `prd-reviewer` skill to catch stale PRDs during code review.
- Status column: `planned` → `draft` → `current` → `needs-update`.
