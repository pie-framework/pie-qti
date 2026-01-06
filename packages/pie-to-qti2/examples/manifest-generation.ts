/**
 * Manifest Generation Examples
 *
 * Demonstrates IMS Content Package manifest generation for:
 * - Single item packages
 * - Batch item packages
 * - Assessment packages with items and passages
 * - Complex multi-level package structures
 */

import {
  buildManifest,
  generateAssessmentManifest,
  generateBatchManifest,
  generateManifest,
  generateSingleItemManifest,
} from '../src/generators/manifest-generator.js';
import type { ManifestInput } from '../src/types/manifest.js';

// ============================================================================
// Example 1: Single Item Package
// ============================================================================

console.log('='.repeat(80));
console.log('Example 1: Single Item Package');
console.log('='.repeat(80));

const singleItemManifest = generateSingleItemManifest(
  'item-001',
  'items/item-001.xml',
  [], // No passage dependencies
  new Map(), // Empty passage paths map
  {
    packageId: 'single-item-package',
    metadata: {
      title: 'Single Multiple Choice Item',
      description: 'A standalone multiple choice question',
    },
  }
);

console.log(singleItemManifest);

// ============================================================================
// Example 2: Item with Passage Dependency
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 2: Item with Passage Dependency');
console.log('='.repeat(80));

const passagePaths = new Map<string, string>();
passagePaths.set('passage-science-101', 'passages/passage-science-101.xml');

const itemWithPassageManifest = generateSingleItemManifest(
  'item-002',
  'items/item-002.xml',
  ['passage-science-101'], // Passage dependency
  passagePaths,
  {
    packageId: 'item-with-passage-package',
    metadata: {
      title: 'Reading Comprehension Item',
      description: 'Item with external passage reference',
    },
  }
);

console.log(itemWithPassageManifest);

// ============================================================================
// Example 3: Batch Package with Multiple Items
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 3: Batch Package with Multiple Items');
console.log('='.repeat(80));

const batchItems = [
  {
    id: 'item-math-001',
    filePath: 'items/math/item-math-001.xml',
  },
  {
    id: 'item-math-002',
    filePath: 'items/math/item-math-002.xml',
  },
  {
    id: 'item-math-003',
    filePath: 'items/math/item-math-003.xml',
  },
];

const batchManifest = generateBatchManifest(batchItems, [], {
  packageId: 'math-items-batch',
  metadata: {
    title: 'Math Question Bank',
    description: 'Collection of algebra questions',
  },
});

console.log(batchManifest);

// ============================================================================
// Example 4: Batch Package with Shared Passage
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 4: Batch Package with Shared Passage');
console.log('='.repeat(80));

const batchItemsWithSharedPassage = [
  {
    id: 'item-ela-001',
    filePath: 'items/ela/item-ela-001.xml',
    dependencies: ['passage-shakespeare-excerpt'], // References shared passage
  },
  {
    id: 'item-ela-002',
    filePath: 'items/ela/item-ela-002.xml',
    dependencies: ['passage-shakespeare-excerpt'], // References same passage
  },
  {
    id: 'item-ela-003',
    filePath: 'items/ela/item-ela-003.xml',
    dependencies: ['passage-shakespeare-excerpt'], // References same passage
  },
];

const sharedPassages = [
  {
    id: 'passage-shakespeare-excerpt',
    filePath: 'passages/passage-shakespeare-excerpt.xml',
  },
];

const batchWithPassageManifest = generateBatchManifest(
  batchItemsWithSharedPassage,
  sharedPassages,
  {
    packageId: 'ela-reading-comprehension-batch',
    metadata: {
      title: 'Shakespeare Reading Comprehension',
      description: 'Multiple items based on a single passage',
    },
  }
);

console.log(batchWithPassageManifest);

// ============================================================================
// Example 5: Assessment Package (NEW - Assessment-level manifest)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 5: Assessment Package with Items and Passages');
console.log('='.repeat(80));

const assessmentItems = [
  {
    id: 'item-science-001',
    filePath: 'items/science/item-science-001.xml',
    dependencies: ['passage-photosynthesis'],
  },
  {
    id: 'item-science-002',
    filePath: 'items/science/item-science-002.xml',
    dependencies: ['passage-photosynthesis'],
  },
  {
    id: 'item-science-003',
    filePath: 'items/science/item-science-003.xml',
    dependencies: ['passage-cellular-respiration'],
  },
  {
    id: 'item-science-004',
    filePath: 'items/science/item-science-004.xml',
    // No passage dependency
  },
];

const assessmentPassages = [
  {
    id: 'passage-photosynthesis',
    filePath: 'passages/passage-photosynthesis.xml',
  },
  {
    id: 'passage-cellular-respiration',
    filePath: 'passages/passage-cellular-respiration.xml',
  },
];

const assessmentManifest = generateAssessmentManifest(
  'test-biology-unit-1',
  'assessments/test-biology-unit-1.xml',
  assessmentItems,
  assessmentPassages,
  {
    packageId: 'biology-unit-1-test-package',
    metadata: {
      title: 'Biology Unit 1 Test',
      description: 'End of unit assessment covering photosynthesis and cellular respiration',
    },
  }
);

console.log(assessmentManifest);

// ============================================================================
// Example 6: Advanced - Low-level API with ManifestInput
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 6: Advanced - Using Low-level API');
console.log('='.repeat(80));

const advancedInput: ManifestInput = {
  // Passages (listed first in manifest - dependencies)
  passages: [
    {
      id: 'passage-history-wwii',
      filePath: 'passages/history/passage-history-wwii.xml',
    },
    {
      id: 'passage-history-cold-war',
      filePath: 'passages/history/passage-history-cold-war.xml',
    },
  ],

  // Items (middle layer - reference passages)
  items: [
    {
      id: 'item-history-001',
      filePath: 'items/history/item-history-001.xml',
      dependencies: ['passage-history-wwii'],
    },
    {
      id: 'item-history-002',
      filePath: 'items/history/item-history-002.xml',
      dependencies: ['passage-history-wwii'],
    },
    {
      id: 'item-history-003',
      filePath: 'items/history/item-history-003.xml',
      dependencies: ['passage-history-cold-war'],
    },
    {
      id: 'item-history-004',
      filePath: 'items/history/item-history-004.xml',
      dependencies: ['passage-history-cold-war'],
    },
  ],

  // Assessments (top layer - reference items)
  assessments: [
    {
      id: 'test-history-midterm',
      filePath: 'assessments/test-history-midterm.xml',
      dependencies: [
        'item-history-001',
        'item-history-002',
        'item-history-003',
        'item-history-004',
      ],
    },
  ],

  // Package options
  options: {
    packageId: 'history-midterm-package',
    metadata: {
      title: 'History Midterm Exam',
      description: 'Comprehensive midterm covering WWII and Cold War',
    },
  },
};

const advancedManifest = generateManifest(advancedInput);
console.log(advancedManifest);

// ============================================================================
// Example 7: Multiple Assessments in One Package
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 7: Multiple Assessments in One Package');
console.log('='.repeat(80));

const multiAssessmentInput: ManifestInput = {
  passages: [
    {
      id: 'passage-math-algebra',
      filePath: 'passages/math/passage-math-algebra.xml',
    },
    {
      id: 'passage-math-geometry',
      filePath: 'passages/math/passage-math-geometry.xml',
    },
  ],

  items: [
    { id: 'item-algebra-001', filePath: 'items/math/item-algebra-001.xml', dependencies: ['passage-math-algebra'] },
    { id: 'item-algebra-002', filePath: 'items/math/item-algebra-002.xml', dependencies: ['passage-math-algebra'] },
    { id: 'item-geometry-001', filePath: 'items/math/item-geometry-001.xml', dependencies: ['passage-math-geometry'] },
    { id: 'item-geometry-002', filePath: 'items/math/item-geometry-002.xml', dependencies: ['passage-math-geometry'] },
  ],

  assessments: [
    {
      id: 'test-algebra',
      filePath: 'assessments/test-algebra.xml',
      dependencies: ['item-algebra-001', 'item-algebra-002'],
    },
    {
      id: 'test-geometry',
      filePath: 'assessments/test-geometry.xml',
      dependencies: ['item-geometry-001', 'item-geometry-002'],
    },
    {
      id: 'test-combined',
      filePath: 'assessments/test-combined.xml',
      dependencies: ['item-algebra-001', 'item-algebra-002', 'item-geometry-001', 'item-geometry-002'],
    },
  ],

  options: {
    packageId: 'math-assessment-suite',
    metadata: {
      title: 'Math Assessment Suite',
      description: 'Complete package with algebra, geometry, and combined tests',
    },
  },
};

const multiAssessmentManifest = generateManifest(multiAssessmentInput);
console.log(multiAssessmentManifest);

// ============================================================================
// Example 8: Structured Manifest Object (for programmatic use)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 8: Structured Manifest Object (for programmatic use)');
console.log('='.repeat(80));

const structuredInput: ManifestInput = {
  items: [
    {
      id: 'item-001',
      filePath: 'items/item-001.xml',
    },
  ],
  passages: [
    {
      id: 'passage-001',
      filePath: 'passages/passage-001.xml',
    },
  ],
  assessments: [
    {
      id: 'test-001',
      filePath: 'assessments/test-001.xml',
      dependencies: ['item-001'],
    },
  ],
};

// buildManifest returns a structured object instead of XML string
const structuredManifest = buildManifest(structuredInput);

console.log(JSON.stringify(structuredManifest, null, 2));

// ============================================================================
// Running Instructions
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('To run this example:');
console.log('  cd packages/pie-to-qti2');
console.log('  bun run examples/manifest-generation.ts');
console.log('='.repeat(80));
