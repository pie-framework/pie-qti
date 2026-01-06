/**
 * PIE → QTI Generators
 *
 * Pluggable generator architecture for transforming PIE elements to QTI
 */

export { AssessmentGenerator, createAssessmentGenerator } from './assessment.js';
export { BaseGenerator } from './base-generator.js';
export { CategorizeGenerator, createCategorizeGenerator } from './categorize.js';
export { CustomInteractionGenerator, createCustomInteractionGenerator } from './custom-interaction.js';
export { createDragInTheBlankGenerator, DragInTheBlankGenerator } from './drag-in-the-blank.js';
export { createEbsrGenerator, EbsrGenerator } from './ebsr.js';
export {
  createExplicitConstructedResponseGenerator,
  ExplicitConstructedResponseGenerator,
} from './explicit-constructed-response.js';
export { createExtendedResponseGenerator, ExtendedResponseGenerator } from './extended-response.js';
export { createHotspotGenerator, HotspotGenerator } from './hotspot.js';
export { createImageClozeAssociationGenerator, ImageClozeAssociationGenerator } from './image-cloze-association.js';
export { createInlineDropdownGenerator, InlineDropdownGenerator } from './inline-dropdown.js';
// Manifest generation
export * from './manifest-generator.js';
export { createMatchGenerator, MatchGenerator } from './match.js';
export { createMatchListGenerator, MatchListGenerator } from './match-list.js';
// Built-in generators
export { createMultipleChoiceGenerator, MultipleChoiceGenerator } from './multiple-choice.js';
export { createPassageGenerator, PassageGenerator } from './passage.js';
export { createPlacementOrderingGenerator, PlacementOrderingGenerator } from './placement-ordering.js';
export { defaultRegistry, GeneratorRegistry } from './registry.js';
export { createRubricGenerator, RubricGenerator } from './rubric.js';
export { createSelectTextGenerator, SelectTextGenerator } from './select-text.js';
// Core types and registry
export type {
  GeneratorContext,
  GeneratorFactory,
  GeneratorRegistration,
  GeneratorResult,
  PieToQtiGenerator,
} from './types.js';

import { createAssessmentGenerator } from './assessment.js';
import { createCategorizeGenerator } from './categorize.js';
import { createCustomInteractionGenerator } from './custom-interaction.js';
import { createDragInTheBlankGenerator } from './drag-in-the-blank.js';
import { createEbsrGenerator } from './ebsr.js';
import { createExplicitConstructedResponseGenerator } from './explicit-constructed-response.js';
import { createExtendedResponseGenerator } from './extended-response.js';
import { createHotspotGenerator } from './hotspot.js';
import { createImageClozeAssociationGenerator } from './image-cloze-association.js';
import { createInlineDropdownGenerator } from './inline-dropdown.js';
import { createMatchGenerator } from './match.js';
import { createMatchListGenerator } from './match-list.js';
import { createMultipleChoiceGenerator } from './multiple-choice.js';
import { createPassageGenerator } from './passage.js';
import { createPlacementOrderingGenerator } from './placement-ordering.js';
// Register default generators
import { defaultRegistry } from './registry.js';
import { createRubricGenerator } from './rubric.js';
import { createSelectTextGenerator } from './select-text.js';

/**
 * Register all built-in generators with the default registry
 */
export function registerBuiltInGenerators(registry = defaultRegistry): void {
  // Register core generators
  registry.register({
    generator: createMultipleChoiceGenerator,
    priority: 100,
  });

  registry.register({
    generator: createExtendedResponseGenerator,
    priority: 100,
  });

  registry.register({
    generator: createExplicitConstructedResponseGenerator,
    priority: 100,
  });

  registry.register({
    generator: createInlineDropdownGenerator,
    priority: 100,
  });

  registry.register({
    generator: createSelectTextGenerator,
    priority: 100,
  });

  registry.register({
    generator: createHotspotGenerator,
    priority: 100,
  });

  registry.register({
    generator: createPlacementOrderingGenerator,
    priority: 100,
  });

  registry.register({
    generator: createMatchGenerator,
    priority: 100,
  });

  registry.register({
    generator: createMatchListGenerator,
    priority: 100,
  });

  registry.register({
    generator: createDragInTheBlankGenerator,
    priority: 100,
  });

  registry.register({
    generator: createImageClozeAssociationGenerator,
    priority: 100,
  });

  registry.register({
    generator: createEbsrGenerator,
    priority: 100,
  });

  registry.register({
    generator: createCategorizeGenerator,
    priority: 100,
  });

  registry.register({
    generator: createPassageGenerator,
    priority: 100,
  });

  registry.register({
    generator: createRubricGenerator,
    priority: 100,
  });

  registry.register({
    generator: createAssessmentGenerator,
    priority: 100,
  });

  // Register custom interaction as wildcard fallback (lowest priority)
  registry.registerWildcard(createCustomInteractionGenerator, -1000);
}

// Auto-register built-in generators on module load
registerBuiltInGenerators();
