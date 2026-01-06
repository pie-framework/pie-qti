/**
 * Example: Creating and Using a Custom PIE → QTI Generator
 *
 * This example demonstrates how to:
 * 1. Create a custom generator for a new PIE element type
 * 2. Register it with the plugin
 * 3. Use it to transform PIE items to QTI
 */

import type { PieItem } from '@pie-framework/transform-types';
import {
  BaseGenerator,
  buildResponseDeclaration,
  GeneratorContext,
  GeneratorResult,
  generateIdentifier,
  PieToQti2Plugin,
  QtiBuilder,
} from '../src/index.js';

// ============================================================================
// Step 1: Create a Custom Generator
// ============================================================================

/**
 * Custom generator for a slider/number-line element
 *
 * PIE Model Structure:
 * {
 *   element: '@mycompany/slider',
 *   prompt: 'Select the correct value',
 *   min: 0,
 *   max: 100,
 *   step: 1,
 *   correctValue: 50
 * }
 */
class SliderGenerator extends BaseGenerator {
  readonly id = '@mycompany/slider';
  readonly name = 'Slider';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.info(context, 'Generating slider as customInteraction');

    // Extract model properties with defaults
    const min = model.min ?? 0;
    const max = model.max ?? 100;
    const step = model.step ?? 1;
    const correctValue = model.correctValue;

    // Validate
    if (correctValue !== undefined && (correctValue < min || correctValue > max)) {
      this.warn(context, `Correct value ${correctValue} is outside range [${min}, ${max}]`);
    }

    // Generate identifiers
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build response declaration
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'single',
      baseType: 'integer',
      correctResponse: correctValue !== undefined ? [String(correctValue)] : undefined,
    });

    // Build custom interaction with slider metadata
    const sliderConfig = {
      min,
      max,
      step,
      orientation: model.orientation || 'horizontal',
    };

    const interaction = QtiBuilder.createCustomInteraction(
      responseId,
      this.id,
      sliderConfig
    );

    // Build prompt
    const prompt = model.prompt ? QtiBuilder.createPrompt(model.prompt) : '';
    const itemBody = prompt ? `${prompt}\n    ${interaction}` : interaction;

    // Generate QTI
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Slider Item',
      pieElement: this.id,
    });

    // Track warnings
    const warnings: string[] = [];
    if (model.orientation && model.orientation !== 'horizontal') {
      warnings.push(`Slider orientation '${model.orientation}' requires PIE player support`);
    }

    return this.createResult(qti, warnings);
  }
}

// ============================================================================
// Step 2: Register and Use the Custom Generator
// ============================================================================

// Create plugin instance
const plugin = new PieToQti2Plugin();

// Register the custom generator
plugin.registerGenerator(
  new SliderGenerator(),
  100, // priority
  false // don't override existing
);

console.log('✅ Registered custom slider generator');

// ============================================================================
// Step 3: Transform a PIE Item with the Custom Element
// ============================================================================

const sliderPieItem: PieItem = {
  id: 'slider-item-1',
  uuid: 'uuid-slider-1',
  config: {
    id: 'uuid-slider-1',
    models: [
      {
        id: '1',
        element: '@mycompany/slider',
        prompt: 'What percentage represents half?',
        min: 0,
        max: 100,
        step: 1,
        correctValue: 50,
        title: 'Percentage Slider',
      },
    ],
    elements: {
      '@mycompany/slider': '1.0.0',
    },
  },
};

// Logger for transformation
const logger = {
  debug: (msg: string) => console.log('[DEBUG]', msg),
  info: (msg: string) => console.log('[INFO]', msg),
  warn: (msg: string) => console.warn('[WARN]', msg),
  error: (msg: string) => console.error('[ERROR]', msg),
};

// Transform PIE → QTI
async function transformExample() {
  console.log('\n📦 Transforming PIE item with custom slider element...\n');

  const result = await plugin.transform(
    { content: sliderPieItem },
    { logger }
  );

  const qtiXml = result.items[0].content as string;

  console.log('\n✅ Transformation complete!\n');
  console.log('Generated QTI XML:');
  console.log('─'.repeat(80));
  console.log(qtiXml);
  console.log('─'.repeat(80));

  // Check metadata
  if (result.metadata) {
    console.log('\n📊 Metadata:');
    console.log('  Generator ID:', (result.metadata as any).generatorId);
    console.log('  Generator Version:', (result.metadata as any).generatorVersion);
    console.log('  Processing Time:', result.metadata.processingTime, 'ms');
    if ((result.metadata as any).warnings) {
      console.log('  Warnings:', (result.metadata as any).warnings);
    }
  }

  // Verify PIE extension is embedded
  if (qtiXml.includes('<pie:sourceModel>')) {
    console.log('\n✅ PIE source model embedded for lossless round-trip');
  } else {
    console.log('\n⚠️  Warning: PIE source model not embedded');
  }
}

// ============================================================================
// Step 4: Example of Overriding a Built-in Generator
// ============================================================================

/**
 * Custom multiple-choice generator that adds vendor-specific attributes
 */
class VendorMultipleChoiceGenerator extends BaseGenerator {
  readonly id = '@pie-element/multiple-choice';
  readonly name = 'Vendor Multiple Choice';
  readonly version = '2.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.info(context, 'Generating vendor-enhanced multiple-choice');

    // Use standard generation logic (simplified for example)
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Add vendor-specific logic here
    const vendorMetadata = {
      vendorId: 'mycompany',
      itemDifficulty: model.difficulty || 'medium',
      tags: model.tags || [],
    };

    this.debug(context, `Vendor metadata: ${JSON.stringify(vendorMetadata)}`);

    // Generate with vendor extensions (simplified)
    const qti = '<!-- Vendor-enhanced QTI would go here -->';

    return this.createResult(qti, [
      'Using vendor-enhanced multiple-choice generator',
    ]);
  }
}

// Create plugin with custom registry for override example
function overrideExample() {
  console.log('\n\n🔧 Example: Overriding Built-in Generator\n');

  const customPlugin = new PieToQti2Plugin();

  // Override the built-in multiple-choice generator
  customPlugin.registerGenerator(
    new VendorMultipleChoiceGenerator(),
    200, // Higher priority than built-in (100)
    true // Override existing
  );

  console.log('✅ Overridden built-in multiple-choice generator with vendor version');
  console.log('   Priority: 200 (higher than built-in 100)');

  // Check what's registered
  const registry = customPlugin.getRegistry();
  console.log('\nRegistered element types:');
  for (const type of registry.getRegisteredTypes()) {
    const gen = registry.getGenerator(type);
    console.log(`  - ${type} → ${gen?.name} v${gen?.version}`);
  }
}

// ============================================================================
// Run Examples
// ============================================================================

if (import.meta.main) {
  transformExample()
    .then(() => {
      overrideExample();
      console.log('\n✨ Examples complete!\n');
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
