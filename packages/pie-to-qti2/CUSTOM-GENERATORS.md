# Custom Generator Guide

This guide explains how to create and register custom PIE → QTI generators for extending the transformation capabilities.

## Architecture Overview

The `@pie-qti/pie-to-qti2` package uses a **pluggable generator architecture** that allows you to:

1. Create custom generators for new PIE element types
2. Override built-in generators with custom implementations
3. Add vendor-specific transformations
4. Extend QTI generation with custom logic

## Core Concepts

### Generator

A generator is responsible for transforming a specific PIE element type (e.g., `@pie-element/multiple-choice`) into QTI XML.

### Registry

The registry manages all available generators and routes PIE models to the appropriate generator based on element type and priority.

### Priority

When multiple generators can handle the same element type, the one with the highest priority is used.

---

## Creating a Custom Generator

### Step 1: Implement the Generator Interface

```typescript
import { BaseGenerator, GeneratorContext, GeneratorResult } from '@pie-qti/pie-to-qti2';
import { QtiBuilder } from '@pie-qti/pie-to-qti2';

export class MyCustomGenerator extends BaseGenerator {
  readonly id = '@mycompany/my-custom-element';
  readonly name = 'My Custom Element';
  readonly version = '1.0.0';

  // Optional: Customize element type detection
  canHandle(model: any): boolean {
    return model.element === this.id;
  }

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model, logger } = context;

    // Your custom transformation logic here
    this.info(context, 'Generating custom QTI');

    // Build QTI XML (example)
    const qti = QtiBuilder.createAssessmentItem(
      pieItem.id,
      [], // response declarations
      '<customInteraction>...</customInteraction>',
      { title: model.title, pieElement: this.id }
    );

    return this.createResult(qti);
  }
}
```

### Step 2: Register the Generator

#### Option A: Register with Plugin Instance

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import { MyCustomGenerator } from './my-custom-generator.js';

const plugin = new PieToQti2Plugin();
const generator = new MyCustomGenerator();

plugin.registerGenerator(
  generator,
  100, // priority (higher = preferred)
  false // override existing generator?
);
```

#### Option B: Register with Default Registry

```typescript
import { defaultRegistry } from '@pie-qti/pie-to-qti2';
import { MyCustomGenerator } from './my-custom-generator.js';

defaultRegistry.register({
  generator: new MyCustomGenerator(),
  priority: 100,
  override: false,
});
```

#### Option C: Use Custom Registry

```typescript
import {
  PieToQti2Plugin,
  GeneratorRegistry,
  registerBuiltInGenerators
} from '@pie-qti/pie-to-qti2';
import { MyCustomGenerator } from './my-custom-generator.js';

// Create custom registry
const registry = new GeneratorRegistry();

// Register built-in generators
registerBuiltInGenerators(registry);

// Add your custom generator
registry.register({
  generator: new MyCustomGenerator(),
  priority: 150, // Higher than built-ins (100)
});

// Create plugin with custom registry
const plugin = new PieToQti2Plugin({ registry });
```

---

## BaseGenerator Helper Methods

The `BaseGenerator` class provides useful helper methods:

### Logging

```typescript
this.info(context, 'Info message');
this.warn(context, 'Warning message');
this.debug(context, 'Debug message');
```

### Creating Results

```typescript
// Result without warnings
return this.createResult(qtiXml);

// Result with warnings
return this.createResult(qtiXml, [
  'Feature X is not standard QTI',
  'Using custom extension for Y'
]);
```

### Element Name Extraction

```typescript
const elementName = this.getElementName('@pie-element/multiple-choice');
// Returns: 'multiple-choice'
```

---

## Complete Example: Custom Calculator Generator

```typescript
import {
  BaseGenerator,
  GeneratorContext,
  GeneratorResult,
  QtiBuilder,
  buildResponseDeclaration,
  generateIdentifier,
} from '@pie-qti/pie-to-qti2';

/**
 * Generator for custom calculator element
 */
export class CalculatorGenerator extends BaseGenerator {
  readonly id = '@mycompany/calculator';
  readonly name = 'Calculator';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.info(context, 'Generating calculator customInteraction');

    // Validate model
    if (!model.prompt) {
      this.warn(context, 'No prompt provided for calculator');
    }

    // Generate identifiers
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build response declaration
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'single',
      baseType: 'string',
      correctResponse: model.correctAnswer ? [model.correctAnswer] : [],
    });

    // Build custom interaction with embedded model
    const interaction = QtiBuilder.createCustomInteraction(
      responseId,
      this.id,
      {
        mode: model.calculatorMode || 'scientific',
        allowedOperations: model.allowedOperations || [],
      }
    );

    // Build prompt
    const prompt = model.prompt
      ? QtiBuilder.createPrompt(model.prompt)
      : '';

    const itemBody = prompt
      ? `${prompt}\n    ${interaction}`
      : interaction;

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(
      itemId,
      [responseDecl],
      itemBody,
      {
        title: model.title || 'Calculator Item',
        pieElement: this.id,
      }
    );

    const warnings: string[] = [];
    if (model.calculatorMode && model.calculatorMode !== 'basic') {
      warnings.push(
        `Calculator mode '${model.calculatorMode}' requires PIE player support`
      );
    }

    return this.createResult(qti, warnings);
  }
}

// Factory function (optional, for lazy loading)
export function createCalculatorGenerator(): CalculatorGenerator {
  return new CalculatorGenerator();
}
```

### Using the Calculator Generator

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import { CalculatorGenerator } from './calculator-generator.js';

const plugin = new PieToQti2Plugin();
plugin.registerGenerator(new CalculatorGenerator(), 100);

// Now the plugin can transform calculator elements
const result = await plugin.transform(
  { content: myCalculatorPieItem },
  { logger: console }
);
```

---

## Overriding Built-in Generators

You can override built-in generators to customize their behavior:

```typescript
import {
  PieToQti2Plugin,
  BaseGenerator,
  GeneratorContext,
  GeneratorResult,
} from '@pie-qti/pie-to-qti2';

/**
 * Custom multiple-choice generator with vendor extensions
 */
class VendorMultipleChoiceGenerator extends BaseGenerator {
  readonly id = '@pie-element/multiple-choice';
  readonly name = 'Vendor Multiple Choice';
  readonly version = '2.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    // Your custom logic...
    // Add vendor-specific attributes, different shuffle logic, etc.
    return this.createResult(qtiXml);
  }
}

const plugin = new PieToQti2Plugin();
plugin.registerGenerator(
  new VendorMultipleChoiceGenerator(),
  200, // Higher priority than built-in (100)
  true // Override existing
);
```

---

## Wildcard Generators

Wildcard generators can handle any element type and are useful as fallbacks:

```typescript
import {
  defaultRegistry,
  createCustomInteractionGenerator
} from '@pie-qti/pie-to-qti2';

// Register a wildcard fallback (low priority)
defaultRegistry.registerWildcard(
  createCustomInteractionGenerator,
  -1000 // Very low priority (last resort)
);
```

---

## Advanced: Generator Priorities

Priority determines which generator is selected when multiple can handle the same element:

- **200+**: High priority (vendor overrides)
- **100**: Normal priority (built-in generators)
- **0**: Default priority
- **-1000**: Low priority (fallbacks)

Example with multiple generators:

```typescript
const registry = new GeneratorRegistry();

// Fallback: customInteraction for anything
registry.registerWildcard(createCustomInteractionGenerator, -1000);

// Normal: standard multiple-choice
registry.register({
  generator: createMultipleChoiceGenerator(),
  priority: 100,
});

// Override: vendor-specific multiple-choice with extra features
registry.register({
  generator: new VendorMultipleChoiceGenerator(),
  priority: 200,
  override: true,
});

// The registry will use VendorMultipleChoiceGenerator (priority 200)
```

---

## Testing Your Generator

### Unit Test Example

```typescript
import { describe, test, expect } from 'bun:test';
import { CalculatorGenerator } from './calculator-generator.js';
import type { PieItem } from '@pie-qti/transform-types';

describe('CalculatorGenerator', () => {
  const generator = new CalculatorGenerator();

  test('generates customInteraction for calculator', () => {
    const pieItem: PieItem = {
      id: 'calc-1',
      uuid: 'uuid-1',
      config: {
        id: 'uuid-1',
        models: [{
          id: '1',
          element: '@mycompany/calculator',
          prompt: 'Calculate 2 + 2',
          calculatorMode: 'basic',
        }],
        elements: {},
      },
    };

    const result = generator.generate({
      pieItem,
      model: pieItem.config.models[0],
    });

    expect(result.qti).toContain('customInteraction');
    expect(result.qti).toContain('type="@mycompany/calculator"');
  });
});
```

### Integration Test Example

```typescript
import { describe, test, expect } from 'bun:test';
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { CalculatorGenerator } from './calculator-generator.js';

describe('Calculator Round-Trip', () => {
  test('PIE → QTI → PIE preserves calculator data', async () => {
    // Setup
    const pieToQti = new PieToQti2Plugin();
    pieToQti.registerGenerator(new CalculatorGenerator(), 100);
    const qtiToPie = new Qti22ToPiePlugin();

    const originalPie = { /* calculator PIE item */ };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger: console }
    );
    const qtiXml = qtiResult.items[0].content as string;

    expect(qtiXml).toContain('<pie:sourceModel>');

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml },
      { logger: console }
    );
    const reconstructedPie = pieResult.items[0];

    // Verify lossless
    expect(reconstructedPie.config.models[0].calculatorMode).toBe('basic');
  });
});
```

---

## API Reference

### Types

```typescript
interface PieToQtiGenerator {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  canHandle(model: PieModel): boolean;
  generate(context: GeneratorContext): GeneratorResult | Promise<GeneratorResult>;
}

interface GeneratorContext {
  pieItem: PieItem;
  model: PieModel;
  logger?: Logger;
  [key: string]: any;
}

interface GeneratorResult {
  qti: string;
  metadata?: {
    warnings?: string[];
    unmappedFeatures?: string[];
    [key: string]: any;
  };
}
```

### GeneratorRegistry Methods

```typescript
class GeneratorRegistry {
  register(registration: GeneratorRegistration): this;
  registerWildcard(generator: PieToQtiGenerator | GeneratorFactory, priority?: number): this;
  unregister(elementType: string): boolean;
  findGenerator(model: PieModel): PieToQtiGenerator | null;
  getGenerator(elementType: string): PieToQtiGenerator | null;
  hasGenerator(elementType: string): boolean;
  getRegisteredTypes(): string[];
  clear(): void;
  clone(): GeneratorRegistry;
}
```

### Plugin Methods

```typescript
class PieToQti2Plugin {
  constructor(options?: PieToQti2PluginOptions);
  getRegistry(): GeneratorRegistry;
  registerGenerator(generator: PieToQtiGenerator, priority?: number, override?: boolean): void;
  // ... TransformPlugin methods
}
```

---

## Best Practices

### 1. Use Descriptive IDs
```typescript
// Good
readonly id = '@mycompany/interactive-graph';

// Avoid
readonly id = 'graph';
```

### 2. Validate Model Data
```typescript
generate(context: GeneratorContext): GeneratorResult {
  const { model } = context;

  if (!model.prompt) {
    this.warn(context, 'Missing prompt');
  }

  if (!model.choices || model.choices.length === 0) {
    throw new Error('Choices are required');
  }

  // ... generation logic
}
```

### 3. Document Unmapped Features
```typescript
const warnings: string[] = [];

if (model.vendorSpecificFeature) {
  warnings.push(
    'vendorSpecificFeature is not standard QTI - preserved in PIE extension'
  );
}

return this.createResult(qti, warnings);
```

### 4. Test Round-Trip Transformations
Always verify that your generator supports lossless round-trips by testing PIE → QTI → PIE transformations.

### 5. Use QtiBuilder Utilities
Leverage the built-in utilities for consistent QTI generation:

```typescript
import {
  QtiBuilder,
  buildResponseDeclaration,
  generateIdentifier,
  generateChoiceIdentifier,
} from '@pie-qti/pie-to-qti2';
```

---

## Troubleshooting

### Generator Not Being Used

**Problem**: Your custom generator isn't being selected.

**Solutions**:
1. Check that it's registered: `plugin.getRegistry().hasGenerator('@your/element')`
2. Verify `canHandle()` returns true for your model
3. Check priority - higher priority generators are preferred
4. Ensure the model has the correct `element` field

### Round-Trip Data Loss

**Problem**: Data is lost during PIE → QTI → PIE transformation.

**Solutions**:
1. Ensure PIE sourceModel is embedded (handled automatically by plugin)
2. Use `data-pie-*` attributes for PIE-specific features
3. Test with `extractPieExtension` to verify embedded data

### TypeScript Errors

**Problem**: Type errors when implementing generator.

**Solutions**:
1. Extend `BaseGenerator` for automatic type compliance
2. Use `any` for model types initially, then refine
3. Check import paths match package structure

---

## Examples

See the built-in generators for complete examples:

- [MultipleChoiceGenerator](./src/generators/multiple-choice.ts)
- [ExtendedResponseGenerator](./src/generators/extended-response.ts)
- [ExplicitConstructedResponseGenerator](./src/generators/explicit-constructed-response.ts)
- [CustomInteractionGenerator](./src/generators/custom-interaction.ts)

---

## Support

For questions or issues:

1. Check existing generators in `src/generators/`
2. Review test examples in `tests/`
3. Open an issue on GitHub with your use case
