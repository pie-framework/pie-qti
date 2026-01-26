# Manual Tests

This directory contains manual test scripts for assessment transformations.

## test-assessment-roundtrip.js

Tests assessment-level round-trip transformations: PIE → QTI → PIE

### Prerequisites

1. Build the packages first:
   ```bash
   bun run build
   ```

2. Run from the repository root:
   ```bash
   node packages/pie-to-qti2/tests/manual/test-assessment-roundtrip.js
   ```

### What it tests

- Identifier preservation through round-trip
- Title preservation
- Section count preservation
- Item count preservation
- `outcomeProcessing` XML preservation
- `branchRules` preservation
- `preConditions` preservation

### Note

This is a standalone development/debugging tool, not part of automated CI tests.
For automated integration tests, see `packages/pie-to-qti2/tests/integration/`.
