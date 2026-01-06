# @acme/likert-scale-plugin

A QTI 2.2 plugin that provides **Likert scale choice interactions** for educational assessments.

This package currently provides **extraction + validation** for vendor-specific `<likertChoice>` markup. Rendering is still done by whatever **web component** is registered for `choiceInteraction` in your host app (typically `@pie-qti/qti2-default-components`).

## Features

- ✅ **Custom Element Support**: Handles `<likertChoice>` elements within `<choiceInteraction>`
- ✅ **Automatic Scale Detection**: Recognizes agreement, frequency, satisfaction, quality, importance, and likelihood scales
- ✅ **Default Labels**: Provides sensible defaults for empty choice elements
- ✅ **Priority-Based Dispatch**: Higher priority (500) than standard choice extractor (10)
- ✅ **Validation**: Enforces Likert scale constraints (2-7 points, no shuffling, single selection)
- ✅ **Type-Safe**: Full TypeScript support with exported types
- ✅ **UI-agnostic**: Works with the player’s web-component rendering contract

## Installation

```bash
bun add @acme/likert-scale-plugin
# or
npm install @acme/likert-scale-plugin
```

## Quick Start

### Basic Usage

```typescript
import { Player } from '@pie-qti/qti2-item-player';
import { likertScalePlugin } from '@acme/likert-scale-plugin';
import '@pie-qti/qti2-default-components/plugins';
import { registerDefaultComponents } from '@pie-qti/qti2-default-components';

const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="likert-demo" title="Likert Scale Demo">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>

  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>How confident are you with this topic?</prompt>
      <likertChoice identifier="not_confident">Not Confident</likertChoice>
      <likertChoice identifier="somewhat">Somewhat Confident</likertChoice>
      <likertChoice identifier="confident">Confident</likertChoice>
      <likertChoice identifier="very_confident">Very Confident</likertChoice>
      <likertChoice identifier="expert">Expert</likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

const player = new Player({
  itemXml: qtiXml,
  plugins: [likertScalePlugin]
});

// Register default web components (or your own) for rendering
registerDefaultComponents(player.getComponentRegistry());

// Access the extraction registry
const registry = player.getExtractionRegistry();
console.log(registry.hasExtractor('acme:likert-choice')); // true
```

### Direct Extraction

```typescript
import { ExtractionRegistry } from '@pie-qti/qti2-item-player';
import { likertChoiceExtractor } from '@acme/likert-scale-plugin';

const registry = new ExtractionRegistry();
registry.register(likertChoiceExtractor);

// Use registry.extract() on choiceInteraction elements
const result = registry.extract(element, context);

if (result.success) {
  console.log(result.data.metadata.isLikert); // true
  console.log(result.data.metadata.scalePoints); // 5
  console.log(result.data.metadata.scaleType); // 'unknown' (custom labels)
}
```

## QTI XML Format

### Standard Likert Scale

```xml
<choiceInteraction responseIdentifier="RESPONSE">
  <prompt>Rate your experience:</prompt>
  <likertChoice identifier="strongly_disagree">Strongly Disagree</likertChoice>
  <likertChoice identifier="disagree">Disagree</likertChoice>
  <likertChoice identifier="neutral">Neutral</likertChoice>
  <likertChoice identifier="agree">Agree</likertChoice>
  <likertChoice identifier="strongly_agree">Strongly Agree</likertChoice>
</choiceInteraction>
```

### With Default Labels (5-point)

```xml
<choiceInteraction responseIdentifier="RESPONSE">
  <prompt>I understand this concept:</prompt>
  <likertChoice identifier="1"></likertChoice>
  <likertChoice identifier="2"></likertChoice>
  <likertChoice identifier="3"></likertChoice>
  <likertChoice identifier="4"></likertChoice>
  <likertChoice identifier="5"></likertChoice>
</choiceInteraction>
```

Auto-generates labels:
- **1**: "Strongly Disagree"
- **2**: "Disagree"
- **3**: "Neutral"
- **4**: "Agree"
- **5**: "Strongly Agree"

## Scale Type Detection

The extractor automatically detects common Likert scale types based on choice text:

| Scale Type | Keywords | Example |
|------------|----------|---------|
| **Agreement** | agree, disagree, strongly | Strongly Disagree → Strongly Agree |
| **Frequency** | always, never, sometimes, often, rarely | Never → Always |
| **Satisfaction** | satisfied, dissatisfied, happy, unhappy | Very Dissatisfied → Very Satisfied |
| **Quality** | excellent, poor, good, fair | Poor → Excellent |
| **Importance** | important, unimportant, critical, trivial | Not Important → Very Important |
| **Likelihood** | likely, unlikely, probable, improbable | Very Unlikely → Very Likely |

## Extracted Data Structure

```typescript
interface LikertInteractionData {
  choices: LikertChoiceData[];
  shuffle: false;                    // Always false for Likert scales
  maxChoices: 1;                     // Always 1 (single selection)
  prompt: string | null;
  metadata: {
    isLikert: true;
    scalePoints: number;             // 2-7 (validated)
    scaleType: 'agreement' | 'frequency' | 'satisfaction' | 'quality' |
               'importance' | 'likelihood' | 'unknown';
  };
}

interface LikertChoiceData {
  identifier: string;
  text: string;
  classes: string[];                 // Always includes 'likert-choice'
  fixed: true;                       // Always true (no shuffling)
  metadata: {
    likertIndex: number;             // 0-based position
    scalePoints: number;
    scaleType: string;
  };
}
```

## Validation Rules

The extractor validates:

✅ **Scale Size**: 2-7 choices (optimal Likert scale range)
✅ **No Shuffling**: `shuffle` must be `false`
✅ **Single Selection**: `maxChoices` must be `1`
✅ **Required Identifiers**: All choices must have identifiers

## Rendering (web components)

The `@pie-qti/qti2-item-player` renders interactions as **custom elements** (web components). This plugin currently does **not** register a custom element; it only affects extraction (it adds metadata/validation for Likert choices).

If you want a dedicated Likert UI, create/register a custom element for `choiceInteraction` with a higher-priority `canHandle()` predicate (e.g. when `data.metadata?.isLikert === true`) and map it via the player’s `ComponentRegistry`.

## API Reference

### Plugin Export

```typescript
export const likertScalePlugin: QTIPlugin
```

The main plugin object. Pass to `Player` constructor's `plugins` array.

### Extractor Export

```typescript
export const likertChoiceExtractor: ElementExtractor<LikertInteractionData>
```

The core extractor. Can be registered directly with `ExtractionRegistry`.

**Properties:**
- `id`: `'acme:likert-choice'`
- `priority`: `500` (higher than standard `qti:choice-interaction` at `10`)
- `elementTypes`: `['choiceInteraction']`

### Type Exports

```typescript
export type { LikertChoiceData, LikertInteractionData }
```

## Development

### Building

```bash
bun run build
```

### Testing

```bash
bun test
```

**Test Coverage:**
- 20 unit tests (extractor logic, validation, scale detection)
- 5 integration tests (plugin registration, priority dispatch, registry integration)
- 100% code coverage

### Project Structure

```
packages/acme-likert-plugin/
├── src/
│   ├── extractors/
│   │   ├── likertChoiceExtractor.ts    # Core extraction logic
│   │   └── index.ts
│   ├── plugin.ts                       # Plugin registration
│   └── index.ts                        # Main entry point
├── tests/
│   ├── setup.ts                        # Test environment setup
│   ├── extractors/
│   │   └── likertChoiceExtractor.test.ts
│   └── integration/
│       └── plugin-integration.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

### Priority-Based Dispatch

The plugin registers a high-priority extractor (500) that takes precedence over the standard choice extractor (10):

1. **User creates** `<choiceInteraction>` with `<likertChoice>` children
2. **ExtractionRegistry** finds all extractors for `choiceInteraction`
3. **Sorts by priority** (highest first): Likert (500) → Standard (10)
4. **Calls `canHandle()`** on each extractor in priority order
5. **Likert extractor** detects `<likertChoice>` children and returns `true`
6. **Registry uses** Likert extractor (standard extractor never called)

### No DOM Transformation

Unlike the old `ElementDetectionPipeline` approach, this plugin:
- ✅ **No XML rewriting** - `<likertChoice>` stays as `<likertChoice>`
- ✅ **Clean separation** - Plugin logic isolated from core
- ✅ **Type-safe** - Full TypeScript inference
- ✅ **Testable** - Easy to unit test in isolation

## Examples

See the [QTI Examples app](../qti2-example) for live demos:

```bash
cd packages/qti2-example
bun run dev
```

Navigate to `/plugin-demo` to see Likert scale interactions in action.

## License

MIT

## Related

- [@pie-qti/qti2-item-player](../qti2-item-player) - Core QTI player
- [Extraction System Documentation](../../docs/PLUGIN_BASED_EXTRACTION_SPEC.md)
- [Plugin Guide](../../docs/PLUGIN_GUIDE.md)
