# PIE-QTI Default Components — AI Evals

This directory contains **AI-oriented eval sets** for each QTI interaction implementation in `@pie-qti/default-components`. Evals target the demo app with QTI item content normalized by the player.

## Reference Scope

These evals are local, AI-oriented checks for default component behavior. For
QTI terminology and spec context, see [`../../QTI_techguide.md`](../../QTI_techguide.md).

The evals are designed to be:

- **Machine-actionable**: structured steps + explicit expected response/outcome values.
- **Assessment-faithful**: they check the “spirit of the item” (clarity, student-facing UX, plausibility of distractors, avoiding trickiness).
- **Validated against real items**: every eval references a concrete sample item from `@pie-qti/app-demo` (primarily the `item-demo` route).

## How to use these evals

- Use the `@pie-qti/app-demo` app as the target environment.
- For each eval case, navigate to:
  - `/item-demo/{sampleId}`
- Perform the described interactions (click/drag/select/type).
- Submit via the **Submit Answers** button (or observe when submission is intentionally not applicable).
- Verify:
  - **Response values** (what the interaction reports via `qti-change` and what the Player stores)
  - **Outcome values** (typically `SCORE`, sometimes `MAXSCORE`)
  - **UX/spirit checks** (student-friendly prompts, clear affordances, no confusing states)

## Evals format (YAML)

Each interaction has one `evals.yaml` containing multiple eval cases:

- `component`: interaction type + web component tag name
- `examplesApp`: route template used for validation
- `evals[]`: individual eval cases

To create a new eval set, start from the template:

- `docs/evals/default-components/evals.template.yaml`

The schema is intentionally simple and AI-friendly:

- Steps are described using a small set of action types (e.g. `navigate`, `click`, `select`, `drag`, `type`, `submit`).
- Targets are described as **human-friendly locators** with optional `css` hints (AI tools can choose their own selector strategy).
- Expected values are recorded at the **QTI variable level** (responses + outcomes).

## Interaction coverage

This directory includes eval sets for:

- `choiceInteraction` (`pie-qti-choice`)
- `sliderInteraction` (`pie-qti-slider`)
- `orderInteraction` (`pie-qti-order`)
- `matchInteraction` (`pie-qti-match`)
- `associateInteraction` (`pie-qti-associate`)
- `gapMatchInteraction` (`pie-qti-gap-match`)
- `graphicGapMatchInteraction` (`pie-qti-graphic-gap-match`)
- `hotspotInteraction` (`pie-qti-hotspot`)
- `hottextInteraction` (`pie-qti-hottext`)
- `selectPointInteraction` (`pie-qti-select-point`)
- `graphicOrderInteraction` (`pie-qti-graphic-order`)
- `graphicAssociateInteraction` (`pie-qti-graphic-associate`)
- `positionObjectInteraction` (`pie-qti-position-object`)
- `endAttemptInteraction` (`pie-qti-end-attempt`)
- `customInteraction` (`pie-qti-custom`)
- `extendedTextInteraction` (`pie-qti-extended-text`)
- `textEntryInteraction` (`pie-qti-text-entry`)
- `inlineChoiceInteraction` (inline item-body rendering)
- `mediaInteraction` (`pie-qti-media`)
- edge cases under `docs/evals/default-components/edge-cases/`
