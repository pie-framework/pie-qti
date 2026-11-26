# Evals

Browser-interaction eval scenarios for the players and demo app, organized as YAML case files
wired to Playwright runners.

## Relationship to the PRDs

PRDs (`docs/prds/INVENTORY.md`) are the canonical source of *why* — rationale, constraints,
acceptance criteria. These eval YAMLs are executable or semi-executable *behavioral scenarios*:
when a suite in `apps/demo/tests/playwright/` loads them, each case runs against the real
components in a browser. Where a PRD and an eval disagree about intended behavior, the PRD wins
and the eval is updated; where you need to know *how a case is driven*, read the runner
(`apps/demo/tests/playwright/eval-helpers.ts` and the `*-evals.pw.ts` suites).

A new eval set is worth adding when the behavior is best pinned as a runnable browser scenario;
the rationale and acceptance criteria still belong in the relevant PRD, cross-linked from it.

## Layout

- `default-components/` — one directory per interaction (`evals.template.yaml` shows the schema)
- `i18n/` — locale switching, fallback, RTL, multilingual items
- `asset-loading/` — asset URL resolution
- `settings-ui/` — settings menu and theme switching

Run them through the demo's Playwright suites (`bun run test:e2e`); the `eval` helper suites load
every `evals.yaml` under this directory.
