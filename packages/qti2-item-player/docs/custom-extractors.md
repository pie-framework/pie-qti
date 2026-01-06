# Custom Extractors Guide

This guide shows you how to create custom extractors for vendor-specific QTI extensions or custom interaction types.

## Table of Contents

- [Overview](#overview)
- [ElementExtractor Interface](#elementextractor-interface)
- [Priority System](#priority-system)
- [Creating a Custom Extractor](#creating-a-custom-extractor)
- [Validation](#validation)
- [Plugin Packaging](#plugin-packaging)
- [Complete Example: ACME Likert Plugin](#complete-example-acme-likert-plugin)
- [Best Practices](#best-practices)
- [Testing](#testing)

## Overview

The ExtractionRegistry provides a flexible, priority-based system for extracting data from QTI XML elements. Custom extractors allow you to:

- Handle vendor-specific QTI extensions
- Override standard extraction behavior
- Add validation logic
- Support custom interaction types

## ElementExtractor Interface

Every extractor implements the `ElementExtractor<TData>` interface:

```typescript
interface ElementExtractor<TData = any> {
  /** Unique identifier (e.g., 'vendor:custom-choice') */
  id: string;

  /** Human-readable name */
  name: string;

  /** Priority for evaluation (higher = checked first) */
  priority: number;

  /** QTI element types this extractor handles */
  elementTypes: string[];

  /** Optional description for debugging */
  description?: string;

  /** Predicate to determine if this extractor can handle the element */
  canHandle(element: QTIElement, context: ExtractionContext): boolean;

  /** Extract data from the element */
  extract(element: QTIElement, context: ExtractionContext): TData;

  /** Optional validation of extracted data */
  validate?(data: TData): ValidationResult;
}
```

## Priority System

Extractors are evaluated in priority order (highest first):

| Priority Range | Usage | Example |
|----------------|-------|---------|
| **1000+** | System-level | Reserved for internal use |
| **500-999** | Vendor-specific | ACME custom interactions |
| **100-499** | Third-party plugins | Community plugins |
| **10-99** | Standard QTI | Built-in QTI 2.2 extractors |
| **0-9** | Fallback | Generic handlers |

**Example:**
```typescript
// Vendor extractor (evaluated first)
const acmeLikertExtractor: ElementExtractor<LikertData> = {
  id: 'acme:likert-choice',
  name: 'ACME Likert Scale',
  priority: 500,  // Vendor range
  elementTypes: ['choiceInteraction'],
  canHandle: (element, context) => {
    return context.utils.hasChildWithTag(element, 'acmeLikertScale');
  },
  // ... extract logic
};

// Standard extractor (evaluated second)
const standardChoiceExtractor: ElementExtractor<ChoiceData> = {
  id: 'qti:choice-interaction',
  name: 'QTI Standard Choice',
  priority: 10,  // Standard range
  elementTypes: ['choiceInteraction'],
  canHandle: (element, context) => {
    return context.utils.hasChildWithTag(element, 'simpleChoice');
  },
  // ... extract logic
};
```

## Creating a Custom Extractor

### Step 1: Define Your Data Type

```typescript
interface LikertData {
  scale: number;         // 1-10
  labels: {
    left: string;
    right: string;
  };
  choices: Array<{
    identifier: string;
    value: number;
    text: string;
  }>;
  prompt: string | null;
}
```

### Step 2: Implement the Extractor

```typescript
import type { ElementExtractor, ExtractionContext, QTIElement } from '@pie-qti/qti2-item-player';

export const acmeLikertExtractor: ElementExtractor<LikertData> = {
  id: 'acme:likert-choice',
  name: 'ACME Likert Scale',
  priority: 500,
  elementTypes: ['choiceInteraction'],
  description: 'Extracts ACME custom likert scale interactions',

  canHandle(element: QTIElement, context: ExtractionContext): boolean {
    // Check for vendor-specific element
    return context.utils.hasChildWithTag(element, 'acmeLikertScale');
  },

  extract(element: QTIElement, context: ExtractionContext): LikertData {
    const { utils } = context;

    // Extract likert scale configuration
    const likertElement = utils.querySelector(element, 'acmeLikertScale');
    const scale = utils.getNumberAttribute(likertElement, 'scale', 5);
    const leftLabel = utils.getAttribute(likertElement, 'leftLabel', 'Strongly Disagree');
    const rightLabel = utils.getAttribute(likertElement, 'rightLabel', 'Strongly Agree');

    // Extract choices
    const choiceElements = utils.getChildrenByTag(element, 'simpleChoice');
    const choices = choiceElements.map((choice) => ({
      identifier: utils.getAttribute(choice, 'identifier'),
      value: utils.getNumberAttribute(choice, 'value', 1),
      text: utils.getHtmlContent(choice),
    }));

    // Extract prompt
    const prompt = utils.getPrompt(element);

    return {
      scale,
      labels: {
        left: leftLabel,
        right: rightLabel,
      },
      choices,
      prompt,
    };
  },

  validate(data: LikertData) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate scale
    if (data.scale < 2 || data.scale > 10) {
      errors.push('Likert scale must be between 2 and 10');
    }

    // Validate choices match scale
    if (data.choices.length !== data.scale) {
      warnings.push(`Number of choices (${data.choices.length}) does not match scale (${data.scale})`);
    }

    // Validate choice values
    for (const choice of data.choices) {
      if (choice.value < 1 || choice.value > data.scale) {
        errors.push(`Choice value ${choice.value} is outside scale range (1-${data.scale})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};
```

### Step 3: Register the Extractor

```typescript
import { createExtractionRegistry } from '@pie-qti/qti2-item-player';

const registry = createExtractionRegistry();

// Register your custom extractor
registry.register(acmeLikertExtractor);

// Now use the registry
const result = registry.extract(element, context);
```

## Validation

The `validate()` method is optional but recommended. It returns a `ValidationResult`:

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: string[];    // Blocking errors (extraction failed)
  warnings?: string[];  // Non-blocking issues
}
```

**When to use validation:**

- **Errors**: Data is malformed and cannot be used (missing required fields, invalid values)
- **Warnings**: Data is usable but may have issues (deprecated attributes, unusual values)

**Example:**
```typescript
validate(data: MyData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field check
  if (!data.identifier) {
    errors.push('identifier is required');
  }

  // Range check
  if (data.maxChoices < 1) {
    errors.push('maxChoices must be at least 1');
  }

  // Deprecated feature warning
  if (data.usesDeprecatedFeature) {
    warnings.push('This feature is deprecated in QTI 3.0');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
```

## Plugin Packaging

Package your extractor as a QTI plugin for easy distribution:

```typescript
import type { QTIPlugin } from '@pie-qti/qti2-item-player';

export const acmeLikertPlugin: QTIPlugin = {
  name: '@acme/qti-likert-plugin',
  version: '1.0.0',
  description: 'ACME custom likert scale interactions',
  dependencies: [],  // Other plugin names if needed

  registerExtractors(registry) {
    registry.register(acmeLikertExtractor);
  },

  registerComponents(registry) {
    // Register web components for rendering
    registry.register('choiceInteraction', {
      name: 'acme-likert-choice',
      priority: 500,
      canHandle: (data) => {
        // Type guard to check if data is LikertData
        return 'scale' in data && 'labels' in data;
      },
      tagName: 'acme-likert-element'
    });
  },

  lifecycle: {
    onRegister(context) {
      console.log('ACME Likert plugin registered');
    },

    onBeforeRender(context) {
      // Setup before rendering
    },

    onAfterRender(context) {
      // Cleanup after rendering
    },

    onUnregister() {
      console.log('ACME Likert plugin unregistered');
    }
  }
};
```

### Using a Plugin

```typescript
import { Player } from '@pie-qti/qti2-item-player';
import { acmeLikertPlugin } from '@acme/qti-likert-plugin';

const player = new Player({
  role: 'candidate',
  plugins: [acmeLikertPlugin]
});

await player.parse(qtiXml);
```

## Complete Example: ACME Likert Plugin

Here's a complete, production-ready example:

### File Structure
```
@acme/qti-likert-plugin/
├── src/
│   ├── extractor.ts        # Likert extractor
│   ├── component.ts        # Web component
│   ├── types.ts            # TypeScript types
│   ├── plugin.ts           # Plugin definition
│   └── index.ts            # Public API
├── tests/
│   ├── extractor.test.ts
│   └── component.test.ts
├── package.json
└── README.md
```

### types.ts
```typescript
export interface LikertData {
  scale: number;
  labels: {
    left: string;
    right: string;
  };
  choices: Array<{
    identifier: string;
    value: number;
    text: string;
  }>;
  prompt: string | null;
}
```

### extractor.ts
```typescript
import type { ElementExtractor, ExtractionContext, QTIElement } from '@pie-qti/qti2-item-player';
import type { LikertData } from './types';

export const acmeLikertExtractor: ElementExtractor<LikertData> = {
  id: 'acme:likert-choice',
  name: 'ACME Likert Scale',
  priority: 500,
  elementTypes: ['choiceInteraction'],
  description: 'Extracts ACME custom likert scale interactions',

  canHandle(element: QTIElement, context: ExtractionContext): boolean {
    return context.utils.hasChildWithTag(element, 'acmeLikertScale');
  },

  extract(element: QTIElement, context: ExtractionContext): LikertData {
    const { utils } = context;

    const likertElement = utils.querySelector(element, 'acmeLikertScale')!;
    const scale = utils.getNumberAttribute(likertElement, 'scale', 5);

    const choiceElements = utils.getChildrenByTag(element, 'simpleChoice');
    const choices = choiceElements.map((choice) => ({
      identifier: utils.getAttribute(choice, 'identifier'),
      value: utils.getNumberAttribute(choice, 'value', 1),
      text: utils.getHtmlContent(choice),
    }));

    return {
      scale,
      labels: {
        left: utils.getAttribute(likertElement, 'leftLabel', 'Strongly Disagree'),
        right: utils.getAttribute(likertElement, 'rightLabel', 'Strongly Agree'),
      },
      choices,
      prompt: utils.getPrompt(element),
    };
  },

  validate(data: LikertData) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.scale < 2 || data.scale > 10) {
      errors.push('Likert scale must be between 2 and 10');
    }

    if (data.choices.length !== data.scale) {
      warnings.push(`Number of choices (${data.choices.length}) does not match scale (${data.scale})`);
    }

    for (const choice of data.choices) {
      if (choice.value < 1 || choice.value > data.scale) {
        errors.push(`Choice value ${choice.value} is outside scale range`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};
```

### plugin.ts
```typescript
import type { QTIPlugin } from '@pie-qti/qti2-item-player';
import { acmeLikertExtractor } from './extractor';

export const acmeLikertPlugin: QTIPlugin = {
  name: '@acme/qti-likert-plugin',
  version: '1.0.0',
  description: 'ACME custom likert scale interactions',

  registerExtractors(registry) {
    registry.register(acmeLikertExtractor);
  },

  registerComponents(registry) {
    registry.register('choiceInteraction', {
      name: 'acme-likert-choice',
      priority: 500,
      canHandle: (data) => 'scale' in data && 'labels' in data,
      tagName: 'acme-likert-element'
    });
  },

  lifecycle: {
    onRegister() {
      console.log('[ACME Likert] Plugin registered');
    }
  }
};
```

### index.ts
```typescript
export { acmeLikertPlugin } from './plugin';
export { acmeLikertExtractor } from './extractor';
export type { LikertData } from './types';
```

### Usage
```typescript
import { Player } from '@pie-qti/qti2-item-player';
import { acmeLikertPlugin } from '@acme/qti-likert-plugin';

const player = new Player({
  role: 'candidate',
  plugins: [acmeLikertPlugin]
});

await player.parse(`
  <assessmentItem>
    <itemBody>
      <choiceInteraction responseIdentifier="RESPONSE">
        <acmeLikertScale scale="5" leftLabel="Strongly Disagree" rightLabel="Strongly Agree"/>
        <prompt>Rate your satisfaction with our product:</prompt>
        <simpleChoice identifier="C1" value="1">1</simpleChoice>
        <simpleChoice identifier="C2" value="2">2</simpleChoice>
        <simpleChoice identifier="C3" value="3">3</simpleChoice>
        <simpleChoice identifier="C4" value="4">4</simpleChoice>
        <simpleChoice identifier="C5" value="5">5</simpleChoice>
      </choiceInteraction>
    </itemBody>
  </assessmentItem>
`);

// Render will automatically use ACME likert component
const renderer = player.createRenderer(document.getElementById('container')!);
renderer.render();
```

## Best Practices

### 1. Use Specific canHandle() Predicates

```typescript
// ❌ BAD - too broad
canHandle(element, context) {
  return element.rawTagName === 'choiceInteraction';
}

// ✅ GOOD - specific check
canHandle(element, context) {
  return (
    element.rawTagName === 'choiceInteraction' &&
    context.utils.hasChildWithTag(element, 'acmeLikertScale')
  );
}
```

### 2. Use Appropriate Priorities

- **500-999**: Vendor-specific extractors (your custom QTI extensions)
- **100-499**: Third-party plugins (community packages)
- **10-99**: Standard QTI extractors (built-in)

### 3. Always Validate Critical Data

```typescript
validate(data) {
  const errors: string[] = [];

  // Required fields
  if (!data.identifier) {
    errors.push('identifier is required');
  }

  // Type checks
  if (typeof data.maxChoices !== 'number') {
    errors.push('maxChoices must be a number');
  }

  // Range checks
  if (data.maxChoices < 1) {
    errors.push('maxChoices must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

### 4. Use ExtractionUtils Helpers

Don't reinvent the wheel - use the provided utilities:

```typescript
extract(element, context) {
  const { utils } = context;

  // ✅ Use helpers
  const choices = utils.getChildrenByTag(element, 'simpleChoice');
  const prompt = utils.getPrompt(element);
  const shuffle = utils.getBooleanAttribute(element, 'shuffle');
  const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);

  // ❌ Don't manually parse
  const choicesManual = element.childNodes.filter(n => n.rawTagName === 'simpleChoice');
}
```

### 5. Handle Missing Data Gracefully

```typescript
extract(element, context) {
  const { utils } = context;

  // ✅ Provide defaults
  const title = utils.getAttribute(element, 'title', 'Untitled');
  const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);
  const prompt = utils.getPrompt(element); // Returns null if missing

  // ✅ Optional fields
  const description = utils.getAttribute(element, 'description', '');
  return {
    title,
    maxChoices,
    prompt,
    ...(description ? { description } : {}),
  };
}
```

### 6. Write Comprehensive Tests

```typescript
import { describe, test, expect } from 'bun:test';
import { acmeLikertExtractor } from './extractor';
import { createTestContext, parseQTI } from '../test-utils';

describe('acmeLikertExtractor', () => {
  test('extracts basic likert scale', () => {
    const xml = `
      <choiceInteraction responseIdentifier="RESPONSE">
        <acmeLikertScale scale="5"/>
        <simpleChoice identifier="C1" value="1">1</simpleChoice>
        <simpleChoice identifier="C2" value="2">2</simpleChoice>
      </choiceInteraction>
    `;
    const element = parseQTI(xml);
    const context = createTestContext(element);

    const result = acmeLikertExtractor.extract(element, context);

    expect(result.scale).toBe(5);
    expect(result.choices).toHaveLength(2);
  });

  test('validates scale range', () => {
    const data = { scale: 15, labels: { left: 'A', right: 'B' }, choices: [], prompt: null };
    const validation = acmeLikertExtractor.validate!(data);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Likert scale must be between 2 and 10');
  });
});
```

## Testing

### Unit Tests

Test your extractor in isolation:

```bash
bun test tests/extraction/extractors/myExtractor.test.ts
```

### Integration Tests

Test with the full registry:

```typescript
import { createExtractionRegistry, createExtractionContext } from '@pie-qti/qti2-item-player';
import { myExtractor } from './myExtractor';

test('custom extractor integrates with registry', () => {
  const registry = createExtractionRegistry();
  registry.register(myExtractor);

  const element = parseQTI('<myInteraction/>');
  const context = createExtractionContext(element, 'RESPONSE', element, new Map(), {});

  const result = registry.extract(element, context);

  expect(result.success).toBe(true);
});
```

### End-to-End Tests

Test with the full Player:

```typescript
import { Player } from '@pie-qti/qti2-item-player';
import { myPlugin } from './myPlugin';

test('plugin works with Player', async () => {
  const player = new Player({
    role: 'candidate',
    plugins: [myPlugin]
  });

  await player.parse(qtiXml);
  const interactions = player.getInteractions();

  expect(interactions).toHaveLength(1);
  expect(interactions[0].type).toBe('myInteraction');
});
```

## Resources

- **TypeScript Definitions**: See `src/extraction/types.ts` for all type definitions
- **Built-in Extractors**: See `src/extraction/extractors/` for 21 examples
- **Example Plugin**: See `packages/acme-likert-plugin/` for a complete working example
- **Player API**: See `README.md` for Player documentation
