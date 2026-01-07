# @pie-qti/element-schemas

JSON schemas for PIE element validation. This package contains schemas extracted from PIE element packages for use in validation without requiring the full element packages as dependencies.

## Usage

```typescript
import { loadSchema, loadAllSchemas } from '@pie-qti/element-schemas';

// Load a specific schema
const mcSchema = await loadSchema('multiple-choice');

// Load all schemas
const allSchemas = await loadAllSchemas();
// Returns Map: '@pie-element/multiple-choice' => schema object
```

## Available Schemas

- `multiple-choice` - Multiple choice questions
- `extended-text-entry` - Extended text entry questions

## Keeping Schemas Up-to-Date

Schemas are synced from the [pie-elements](https://github.com/pie-framework/pie-elements) repository.

### Prerequisites

Ensure `pie-elements` is checked out as a sibling directory:

```bash
cd /path/to/projects
git clone https://github.com/pie-framework/pie-elements.git
```

### Sync Schemas

To update schemas from pie-elements:

```bash
bun --filter @pie-qti/element-schemas sync
```

This will:
1. Read schemas from `pie-elements/packages/*/docs/pie-schema.json`
2. Copy them to `src/schemas/`
3. Update `schema-versions.json` with version metadata
4. Skip schemas that haven't changed (based on content hash)

### Check for Updates

To check if local schemas are up-to-date:

```bash
bun --filter @pie-qti/element-schemas check-updates
```

This is useful in CI to detect schema drift.

## Schema Versions

The `schema-versions.json` file tracks:
- Source package version
- Content hash (SHA-256)
- Sync timestamp
- Source file path

Example:
```json
{
  "multiple-choice": {
    "version": "7.2.1",
    "schemaHash": "abc123def456",
    "syncedAt": "2025-12-24T10:00:00Z",
    "sourcePath": "/path/to/pie-elements/packages/multiple-choice/docs/pie-schema.json"
  }
}
```

## Adding New Elements

To add a new PIE element schema:

1. Add the element name to `ELEMENTS_TO_SYNC` in `scripts/sync-schemas.ts`
2. Add the element type to `AVAILABLE_SCHEMAS` in `src/index.ts`
3. Run `bun --filter @pie-qti/element-schemas sync` to pull the schema
4. Commit the new schema file and updated metadata

## CI Integration

Example GitHub Action to check for schema drift:

```yaml
name: Check PIE Schemas
on: [push, pull_request]
jobs:
  check-schemas:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Clone pie-elements
        run: git clone --depth 1 https://github.com/pie-framework/pie-elements.git ../pie-elements
      - name: Check schema versions
        run: bun --filter @pie-qti/element-schemas check-updates
```
