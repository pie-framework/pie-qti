# QTI Conformance Fixtures (Item Player)

This directory contains **fixture-driven conformance/regression tests** for `@pie-qti/qti2-item-player`.

## Goals

- Run stable, CI-friendly tests against `Player` behavior using **real QTI XML** fixtures.
- Keep fixtures **reviewable** (XML + JSON cases) and **deterministic** (seeded randomness).
- Track known gaps explicitly via `expect.unsupported`/`expect.warnings` fields (as we evolve).

## Directory layout

```text
tests/conformance/
  fixtures/
    <fixtureId>/
      item.xml
      cases.json
      manifest.json   (optional)
  harness.ts
  run-fixtures.test.ts
  types.ts
```

## `cases.json` format

```json
{
  "id": "choice_match_correct",
  "seed": 12345,
  "cases": [
    {
      "name": "correct",
      "responses": { "RESPONSE": "A" },
      "expect": {
        "outcomes": { "SCORE": 1, "MAXSCORE": 1 }
      }
    }
  ]
}
```

### Fields

- `id` (string, required): fixture identifier (should match folder name).
- `seed` (number, optional): deterministic seed for any random/template operations.
- `cases` (array, required): one or more test cases.

Each case:

- `name` (string, required): test case name.
- `responses` (object, required): response map keyed by response identifiers.
- `xfail` (boolean, optional): marks a known-gap case that is expected to fail today.
- `xfailReason` (string, optional): short explanation of why it is expected to fail.
- `expect` (object, required):
  - `outcomes` (object, optional): expected subset of `result.outcomeValues`.
  - `score` / `maxScore` (number, optional): expected scalar scoring fields.
  - `modalFeedbackIdentifiers` (string[], optional): expected modal feedback identifiers (order-insensitive).
  - `itemBodyContains` (string[], optional): substrings expected in `player.getItemBodyHtml()`.
  - `unsupported` (string[], optional): expected unsupported feature codes (future-proofing).
  - `warnings` (string[], optional): expected warning codes/messages (future-proofing).

## `manifest.json` (optional)

Used for provenance/licensing metadata:

- `source`: upstream project/name
- `upstreamUrl`: where it came from
- `license`: SPDX identifier (when known)
- `notes`: why this fixture exists / what it covers
