# QTI2 Assessment Player — AI Evals

This directory contains **AI-oriented eval sets** for the multi-item assessment player (`@pie-qti/assessment-player`).

These evals complement `docs/evals/qti-default-components`:

- `qti-default-components`: validates **individual interaction components** via `/item-demo/{sampleId}`
- `qti-assessment-player`: validates **assessment-level behaviors** (navigation, section switching, submission modes) via `/assessment-demo`

## What’s covered here

Real eval sets live under `docs/evals/assessment-player/<slug>/evals.yaml`.

- `interaction-showcase/`: baseline coverage for showcase assessment (section switching + simultaneous submit)
- `navigation-rules/`: linear/nonlinear navigation, allowReview/allowSkipping/validateResponses behaviors
- `submission-modes/`: individual vs simultaneous submission; end screen completeness + scoring
- `response-isolation/`: no leaking of `RESPONSE` across items/sections; no prefilled answers
- `section-switching/`: switching sections navigates correctly and preserves in-progress answers
- `persistence-session/`: retake + refresh behaviors (demo should start fresh)
- `event-plumbing/`: assessment shell receives interaction `qti-change` events across interaction types

## How to use these evals

- Use the `@pie-qti/app-demo` app as the target environment.
- For each eval case, navigate to:
  - `/assessment-demo`
- Select the desired sample assessment from the **Sample Assessments** dropdown.
- Perform the described interactions (click/drag/select/type).
- Submit via the **Submit Assessment** button (when applicable).
- Verify:
  - **Assessment results** (total score + per-item score list on the end screen)
  - **Behavioral expectations** (section switching, navigation rules, preserved responses)

## Evals format (YAML)

This directory follows the same convention as `qti-default-components`:

- **Template**: `docs/evals/assessment-player/evals.template.yaml`
- **Real eval sets**: `docs/evals/assessment-player/<assessment-slug>/evals.yaml`

The YAML structure is similar to `qti-default-components` evals, but the `expected` section adds:

- `assessmentResults.totalScore` / `assessmentResults.maxScore`
- `assessmentResults.itemScoresByIdentifier` (per-question score assertions)

These keys are intentionally AI-friendly; runners can validate them via the end screen UI or by reading the player’s stored session state (demo adapter persists to localStorage).


