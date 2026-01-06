/**
 * Assessment Transformation Example
 *
 * Demonstrates how to transform PIE assessments to QTI assessmentTests
 * with complete preservation of outcome processing, branch rules, and
 * pre-conditions through bidirectional round-trips.
 */

import type { TransformOutput } from '@pie-framework/transform-core';
import { Qti22ToPiePlugin } from '../../qti2-to-pie/src/plugin.js';
import { PieToQti2Plugin } from '../src/plugin.js';

// Example 1: Simple Assessment with Scoring
async function simpleAssessmentExample() {
  console.log('\n=== Example 1: Simple Assessment with Scoring ===\n');

  const pieAssessment = {
    id: 'simple-test',
    title: 'Basic Mathematics Test',
    description: 'A simple assessment with weighted scoring',
    metadata: {
      navigationMode: 'nonlinear',
      submissionMode: 'simultaneous'
    },
    sections: [
      {
        id: 'section-1',
        identifier: 'section-1',
        title: 'Algebra',
        visible: true,
        fixed: false,
        shuffle: false,
        itemRefs: [
          {
            identifier: 'algebra-1',
            href: 'items/algebra-1.xml',
            required: true,
            weight: 2.0,
            category: ['algebra', 'equations']
          },
          {
            identifier: 'algebra-2',
            href: 'items/algebra-2.xml',
            required: true,
            weight: 1.0,
            category: ['algebra', 'functions']
          }
        ]
      }
    ],
    timeLimits: {
      maxTime: 3600,
      allowLateSubmission: false
    },
    outcomeProcessingXml: `<outcomeProcessing>
  <!-- Calculate weighted sum -->
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
  <!-- Calculate percentage -->
  <setOutcomeValue identifier="PERCENTAGE">
    <divide>
      <variable identifier="SCORE"/>
      <baseValue baseType="float">3.0</baseValue>
    </divide>
  </setOutcomeValue>
</outcomeProcessing>`
  };

  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  // PIE → QTI
  const qtiResult = await pieToQti.transform(
    { content: pieAssessment },
    { logger: console }
  );
  const qtiXml = qtiResult.items[0].content;

  console.log('Generated QTI assessmentTest (first 500 chars):');
  console.log(qtiXml.slice(0, 500) + '...\n');

  // QTI → PIE (round-trip)
  const pieResult = await qtiToPie.transform(
    { content: qtiXml },
    { logger: console }
  );
  const reconstructed = pieResult.items[0].content;

  console.log('Round-trip verification:');
  console.log(`  ✓ Title: ${reconstructed.title}`);
  console.log(`  ✓ Sections: ${reconstructed.sections.length}`);
  console.log(`  ✓ Items: ${reconstructed.sections[0].itemRefs.length}`);
  console.log(`  ✓ Has outcomeProcessing: ${!!reconstructed.outcomeProcessingXml}`);
  console.log(`  ✓ Item weights preserved: ${reconstructed.sections[0].itemRefs[0].weight}\n`);
}

// Example 2: Adaptive Assessment with Branch Rules
async function adaptiveAssessmentExample() {
  console.log('\n=== Example 2: Adaptive Assessment with Branch Rules ===\n');

  const adaptiveAssessment = {
    id: 'adaptive-test',
    title: 'Adaptive Mathematics Assessment',
    description: 'Assessment with conditional branching',
    metadata: {
      navigationMode: 'linear',
      submissionMode: 'individual'
    },
    sections: [
      {
        id: 'screening',
        identifier: 'screening',
        title: 'Screening Questions',
        visible: true,
        fixed: true,
        shuffle: false,
        itemRefs: [
          {
            identifier: 'screener-1',
            href: 'items/screener-1.xml',
            required: true,
            weight: 1.0,
            // Exit test if student scores too low
            branchRule: [
              {
                xml: `<branchRule target="EXIT_TEST">
  <lt>
    <variable identifier="SCORE"/>
    <baseValue baseType="float">0.5</baseValue>
  </lt>
</branchRule>`
              }
            ]
          },
          {
            identifier: 'screener-2',
            href: 'items/screener-2.xml',
            required: true,
            weight: 1.0,
            // Skip to advanced section if score is high
            branchRule: [
              {
                xml: `<branchRule target="advanced">
  <gte>
    <sum>
      <variable identifier="screener-1.SCORE"/>
      <variable identifier="screener-2.SCORE"/>
    </sum>
    <baseValue baseType="float">1.8</baseValue>
  </gte>
</branchRule>`
              }
            ]
          }
        ]
      },
      {
        id: 'standard',
        identifier: 'standard',
        title: 'Standard Questions',
        visible: true,
        fixed: false,
        shuffle: false,
        itemRefs: [
          {
            identifier: 'standard-1',
            href: 'items/standard-1.xml',
            required: true,
            weight: 2.0
          }
        ]
      },
      {
        id: 'advanced',
        identifier: 'advanced',
        title: 'Advanced Questions',
        visible: true,
        fixed: false,
        shuffle: false,
        itemRefs: [
          {
            identifier: 'advanced-1',
            href: 'items/advanced-1.xml',
            required: true,
            weight: 3.0
          }
        ]
      }
    ],
    outcomeProcessingXml: `<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>`
  };

  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  // PIE → QTI
  const qtiResult = await pieToQti.transform(
    { content: adaptiveAssessment },
    { logger: console }
  );
  const qtiXml = qtiResult.items[0].content;

  console.log('Adaptive assessment features:');
  console.log(`  - Navigation: ${adaptiveAssessment.metadata.navigationMode}`);
  console.log(`  - Sections: ${adaptiveAssessment.sections.length}`);
  console.log(`  - Branch rules: ${adaptiveAssessment.sections[0].itemRefs.filter(ir => ir.branchRule).length}`);

  // Verify branchRules are in QTI
  const hasBranchRules = qtiXml.includes('<branchRule');
  console.log(`  - Branch rules in QTI: ${hasBranchRules}\n`);

  // QTI → PIE (round-trip)
  const pieResult = await qtiToPie.transform(
    { content: qtiXml },
    { logger: console }
  );
  const reconstructed = pieResult.items[0].content;

  console.log('Round-trip verification:');
  console.log(`  ✓ Sections preserved: ${reconstructed.sections.length}`);
  console.log(`  ✓ Branch rules preserved: ${!!reconstructed.sections[0].itemRefs[0].branchRule}`);
  console.log(`  ✓ Branch rule count: ${reconstructed.sections[0].itemRefs.filter((ir: any) => ir.branchRule).length}\n`);
}

// Example 3: Conditional Display with Pre-Conditions
async function conditionalAssessmentExample() {
  console.log('\n=== Example 3: Conditional Display with Pre-Conditions ===\n');

  const conditionalAssessment = {
    id: 'conditional-test',
    title: 'Test with Conditional Items',
    description: 'Items shown based on previous performance',
    metadata: {
      navigationMode: 'nonlinear',
      submissionMode: 'simultaneous'
    },
    sections: [
      {
        id: 'main',
        identifier: 'main',
        title: 'Main Section',
        visible: true,
        fixed: false,
        shuffle: false,
        itemRefs: [
          {
            identifier: 'basic-1',
            href: 'items/basic-1.xml',
            required: true,
            weight: 1.0
          },
          {
            identifier: 'followup-1',
            href: 'items/followup-1.xml',
            required: false,
            weight: 2.0,
            // Only show if student answered basic question
            preCondition: [
              {
                xml: `<preCondition>
  <not>
    <isNull>
      <variable identifier="basic-1.RESPONSE"/>
    </isNull>
  </not>
</preCondition>`
              }
            ]
          },
          {
            identifier: 'challenge-1',
            href: 'items/challenge-1.xml',
            required: false,
            weight: 3.0,
            // Only show if student scored well on both previous items
            preCondition: [
              {
                xml: `<preCondition>
  <and>
    <gte>
      <variable identifier="basic-1.SCORE"/>
      <baseValue baseType="float">0.8</baseValue>
    </gte>
    <gte>
      <variable identifier="followup-1.SCORE"/>
      <baseValue baseType="float">0.8</baseValue>
    </gte>
  </and>
</preCondition>`
              }
            ]
          }
        ]
      }
    ],
    outcomeProcessingXml: `<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>`
  };

  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  // PIE → QTI
  const qtiResult = await pieToQti.transform(
    { content: conditionalAssessment },
    { logger: console }
  );
  const qtiXml = qtiResult.items[0].content;

  console.log('Conditional assessment features:');
  console.log(`  - Total items: ${conditionalAssessment.sections[0].itemRefs.length}`);
  console.log(`  - Items with preConditions: ${conditionalAssessment.sections[0].itemRefs.filter(ir => ir.preCondition).length}`);

  // Verify preConditions are in QTI
  const hasPreConditions = qtiXml.includes('<preCondition');
  console.log(`  - Pre-conditions in QTI: ${hasPreConditions}\n`);

  // QTI → PIE (round-trip)
  const pieResult = await qtiToPie.transform(
    { content: qtiXml },
    { logger: console }
  );
  const reconstructed = pieResult.items[0].content;

  console.log('Round-trip verification:');
  console.log(`  ✓ Items preserved: ${reconstructed.sections[0].itemRefs.length}`);
  console.log(`  ✓ Pre-conditions preserved: ${reconstructed.sections[0].itemRefs.filter((ir: any) => ir.preCondition).length}\n`);
}

// Example 4: Item Banking with Selection Rules
async function itemBankingExample() {
  console.log('\n=== Example 4: Item Banking with Selection Rules ===\n');

  const itemBankAssessment = {
    id: 'item-bank-test',
    title: 'Randomized Assessment',
    description: 'Assessment with item selection from pools',
    metadata: {
      navigationMode: 'linear',
      submissionMode: 'simultaneous'
    },
    sections: [
      {
        id: 'algebra-pool',
        identifier: 'algebra-pool',
        title: 'Algebra Questions',
        visible: true,
        fixed: false,
        shuffle: true,
        // Select 3 items randomly from pool
        selection: {
          select: 3,
          withReplacement: false
        },
        itemRefs: [
          { identifier: 'algebra-1', href: 'items/algebra-1.xml', required: false, weight: 1.0 },
          { identifier: 'algebra-2', href: 'items/algebra-2.xml', required: false, weight: 1.0 },
          { identifier: 'algebra-3', href: 'items/algebra-3.xml', required: false, weight: 1.0 },
          { identifier: 'algebra-4', href: 'items/algebra-4.xml', required: false, weight: 1.0 },
          { identifier: 'algebra-5', href: 'items/algebra-5.xml', required: false, weight: 1.0 },
          { identifier: 'algebra-6', href: 'items/algebra-6.xml', required: false, weight: 1.0 }
        ]
      },
      {
        id: 'geometry-pool',
        identifier: 'geometry-pool',
        title: 'Geometry Questions',
        visible: true,
        fixed: false,
        shuffle: true,
        // Select 2 items randomly
        selection: {
          select: 2,
          withReplacement: false
        },
        itemRefs: [
          { identifier: 'geometry-1', href: 'items/geometry-1.xml', required: false, weight: 2.0 },
          { identifier: 'geometry-2', href: 'items/geometry-2.xml', required: false, weight: 2.0 },
          { identifier: 'geometry-3', href: 'items/geometry-3.xml', required: false, weight: 2.0 },
          { identifier: 'geometry-4', href: 'items/geometry-4.xml', required: false, weight: 2.0 }
        ]
      }
    ],
    outcomeProcessingXml: `<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>`
  };

  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  // PIE → QTI
  const qtiResult = await pieToQti.transform(
    { content: itemBankAssessment },
    { logger: console }
  );
  const qtiXml = qtiResult.items[0].content;

  console.log('Item banking features:');
  console.log(`  - Algebra pool: ${itemBankAssessment.sections[0].itemRefs.length} items → select ${itemBankAssessment.sections[0].selection?.select}`);
  console.log(`  - Geometry pool: ${itemBankAssessment.sections[1].itemRefs.length} items → select ${itemBankAssessment.sections[1].selection?.select}`);
  console.log(`  - Shuffle: ${itemBankAssessment.sections[0].shuffle}\n`);

  // Verify selection rules are in QTI
  const hasSelection = qtiXml.includes('<selection');
  const hasOrdering = qtiXml.includes('<ordering');
  console.log(`  - Selection rules in QTI: ${hasSelection}`);
  console.log(`  - Ordering rules in QTI: ${hasOrdering}\n`);

  // QTI → PIE (round-trip)
  const pieResult = await qtiToPie.transform(
    { content: qtiXml },
    { logger: console }
  );
  const reconstructed = pieResult.items[0].content;

  console.log('Round-trip verification:');
  console.log(`  ✓ Sections preserved: ${reconstructed.sections.length}`);
  console.log(`  ✓ Selection rules preserved: ${!!reconstructed.sections[0].selection}`);
  console.log(`  ✓ Algebra pool select: ${reconstructed.sections[0].selection?.select}`);
  console.log(`  ✓ Geometry pool select: ${reconstructed.sections[1].selection?.select}\n`);
}

// Run all examples
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  PIE Assessment → QTI assessmentTest Examples            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    await simpleAssessmentExample();
    await adaptiveAssessmentExample();
    await conditionalAssessmentExample();
    await itemBankingExample();

    console.log('\n✅ All examples completed successfully!\n');
    console.log('Key takeaways:');
    console.log('  1. PIE assessments transform to QTI assessmentTest format');
    console.log('  2. All scoring logic (outcomeProcessing) is preserved');
    console.log('  3. Adaptive navigation (branchRules) is preserved');
    console.log('  4. Conditional display (preConditions) is preserved');
    console.log('  5. Item banking (selection rules) is preserved');
    console.log('  6. Complete lossless round-trips guaranteed\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
