# QTI 3 Stage 5 Manual Accessibility Checklist

This checklist records manual assistive-technology evidence for the clean-room
browser fixtures in this repository. It must not include official 1EdTech
conformance assets, screenshots, raw logs, or private package names.

## Fixture Scope

- `apps/demo/src/lib/a11y/fixtures/PnpCatalogStimulusFixture.svelte`
- `apps/demo/tests/playwright/qti3-stage5-a11y.pw.ts`
- `apps/demo/src/lib/a11y/fixtures/AssessmentTimerFixture.svelte`
- `apps/demo/tests/playwright/assessment-a11y-behavior.pw.ts`

## Required Manual Runs

### NVDA With Chrome

- Status: not run
- Date:
- Tester:
- Environment:
- PNP/catalog/stimulus fixture:
  - Tab reaches glossary and host-support triggers in meaningful reading order.
  - Trigger names are announced distinctly, including the catalog usage and term text.
  - Enter or Space opens the glossary popup for the shared-stimulus term.
  - Escape dismisses the popup and returns focus to the trigger.
  - Disabling and re-enabling glossary support does not duplicate triggers or lose focusability.
  - Host-routed catalog support emits only after user activation; no automatic audible support starts.
  - Shared-stimulus content is announced once and before the item interaction.
  - Correct-response identifiers and source stylesheet paths are not exposed through names or descriptions.
- Timer fixture:
  - Timer has an understandable role/name/value announcement.
  - Warning state is announced without moving focus.
  - Expiry state is announced assertively and does not create a keyboard trap.
  - Controls remain reachable at 200% zoom and at 320px width.
- Notes:

### VoiceOver With Safari

- Status: not run
- Date:
- Tester:
- Environment:
- PNP/catalog/stimulus fixture:
  - Control navigation reaches glossary and host-support triggers in meaningful reading order.
  - Trigger names are announced distinctly, including the catalog usage and term text.
  - Return opens the glossary popup for the shared-stimulus term.
  - Escape dismisses the popup and returns focus to the trigger.
  - Disabling and re-enabling glossary support does not duplicate triggers or lose focusability.
  - Host-routed catalog support emits only after user activation; no automatic audible support starts.
  - Shared-stimulus content is announced once and before the item interaction.
  - Correct-response identifiers and source stylesheet paths are not exposed through names or descriptions.
- Timer fixture:
  - Timer has an understandable role/name/value announcement.
  - Warning state is announced without moving focus.
  - Expiry state is announced assertively and does not create a keyboard trap.
  - Controls remain reachable at 200% zoom and at 320px width.
- Notes:

## Automation Already Covering This Area

- `bun run --cwd apps/demo test:e2e -- tests/playwright/qti3-stage5-a11y.pw.ts`
- `bun run --cwd apps/demo test:e2e -- tests/playwright/assessment-a11y-behavior.pw.ts`
- `bun run --cwd apps/demo test:a11y`

Manual signoff is required before Stage 6 because automated tests do not prove
screen-reader announcement quality.
