# QTI2 Default Components — AI Evals

This directory contains **AI-oriented eval sets** for each QTI interaction implementation in `@pie-qti/qti2-default-components`.

## Spec snapshots (local)

See [SPEC_SNAPSHOTS.md](../../SPEC_SNAPSHOTS.md) (QTI **2.2.2** primary reference; supports QTI **2.1–2.2.x** input).

The evals are designed to be:

- **Machine-actionable**: structured steps + explicit expected response/outcome values.
- **Assessment-faithful**: they check the “spirit of the item” (clarity, student-facing UX, plausibility of distractors, avoiding trickiness).
- **Validated against real items**: every eval references a concrete sample item from `@pie-qti/qti2-example` (primarily the `item-demo` route).

## How to use these evals

- Use the `@pie-qti/qti2-example` app as the target environment.
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

- `docs/evals/qti2-default-components/evals.template.yaml`

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
- `mediaInteraction` (`pie-qti-media`)
