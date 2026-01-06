# PIE Item Validation

This package provides validation utilities for PIE items using JSON Schema validation.

## Overview

The validation system validates PIE items against:
1. **Basic structure** - Required fields like `id`, `uuid`, `config`
2. **Element-specific schemas** - JSON schemas from PIE element packages

## Usage

### Basic Structural Validation

For quick validation without schemas:

```typescript
import { validatePieItemStructure } from '@pie-qti/transform-core';

const item = {
  id: 'item-001',
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  config: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    models: [],
    elements: {},
  },
};

const result = validatePieItemStructure(item);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### Schema-Based Validation

For validating against PIE element schemas:

```typescript
import { PieItemValidator } from '@pie-qti/transform-core';

const validator = new PieItemValidator();

// Load schema from schemas package (recommended)
await validator.loadSchemaForElement('@pie-element/multiple-choice');

// Or register schema directly
import { loadSchema } from '@pie-qti/element-schemas';
const schema = await loadSchema('multiple-choice');
validator.registerSchema('@pie-element/multiple-choice', schema);

// Validate an item
const result = validator.validate(pieItem);

if (!result.valid) {
  for (const error of result.errors!) {
    console.error(`${error.path}: ${error.message}`);
  }
}
```

### Validation in Plugins

Plugins can implement the optional `validate()` method:

```typescript
export class Qti22ToPiePlugin implements TransformPlugin {
  private validator: PieItemValidator;

  constructor() {
    this.validator = new PieItemValidator();
    // Load schemas during initialization
  }

  async validate(output: TransformOutput): Promise<ValidationResult> {
    const results = this.validator.validateMany(output.items);

    const errors: ValidationError[] = [];
    for (let i = 0; i < results.length; i++) {
      if (!results[i].valid && results[i].errors) {
        for (const error of results[i].errors) {
          errors.push({
            ...error,
            path: `items[${i}].${error.path}`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
```

## PIE Element Schemas

Schemas are provided by the `@pie-qti/element-schemas` package, which contains JSON schemas synced from PIE element packages:

- **pie-schema.json** - Schema for the PIE item model
- **config-schema.json** - Schema for authoring configuration (future)

Available schemas:

- `multiple-choice` - Multiple choice questions (from @pie-element/multiple-choice v11.4.3)
- `extended-text-entry` - Extended text entry questions (from @pie-element/extended-text-entry v13.4.0)

See the [schemas package README](../schemas/README.md) for information on keeping schemas up-to-date.

## QTI Input Validation

For validating QTI input:

```typescript
import { QtiValidator } from '@pie-qti/qti2-to-pie';

const validator = new QtiValidator();

// Validate QTI XML
const result = await validator.validate(qtiXml);

if (!result.valid) {
  console.error('QTI validation errors:', result.errors);
}
```

Notes:
- The current validator performs **well-formedness + structural checks** and warns on missing QTI 2.2 namespace.
- Full XSD validation is intentionally out of scope for now (it requires resolving/importing the full schema graph).

## Validation Results

All validation functions return a `ValidationResult`:

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

interface ValidationError {
  path: string;        // JSON path to the error (e.g., "config.models[0].choices")
  message: string;     // Human-readable error message
  value?: any;         // The invalid value (optional)
}
```

## CLI Validation

The CLI tool can optionally validate transformations:

```bash
pie-transform transform input.xml -o output.json --validate
```

This will:
1. Transform the QTI to PIE
2. Validate the output against PIE schemas
3. Report any validation errors
4. Exit with error code if validation fails

## Integration Testing

For testing transformations with validation:

```typescript
import { describe, test, expect } from 'bun:test';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { PieItemValidator } from '@pie-qti/transform-core';

describe('QTI to PIE transformation', () => {
  test('should produce valid PIE output', async () => {
    const plugin = new Qti22ToPiePlugin();
    const validator = new PieItemValidator();

    // Load schemas for elements you're testing
    await validator.loadSchema(
      '@pie-element/multiple-choice',
      './schemas/multiple-choice/pie-schema.json'
    );

    const output = await plugin.transform(
      { content: qtiXml },
      { logger: new SilentLogger() }
    );

    // Validate all items
    const results = validator.validateMany(output.items);

    for (let i = 0; i < results.length; i++) {
      expect(results[i].valid).toBe(true);
      if (!results[i].valid) {
        console.log(`Item ${i} validation errors:`, results[i].errors);
      }
    }
  });
});
```

## Best Practices

1. **Load schemas once** - Create validator instances during initialization
2. **Cache schemas** - Don't reload schemas for every validation
3. **Validate in tests** - Always validate transformer output in tests
4. **Report clear errors** - Use validation errors to improve transformations
5. **Version schemas** - Pin to specific PIE element versions

## Performance

- Schema compilation is done once per element type
- Validation is fast (~1ms per item for typical items)
- Use `validateMany()` for batch validation
- Consider async validation for large batches
