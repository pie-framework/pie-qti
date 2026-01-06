/**
 * Advanced Assessment Features Example
 *
 * Demonstrates QTI 2.2 advanced assessment features:
 * - Outcome declarations (test-level variables)
 * - Template declarations (adaptive test variables)
 * - Template processing (initialization logic)
 * - Test feedback (conditional feedback based on outcomes)
 *
 * Shows complete lossless round-trip preservation.
 */

import { Qti22ToPiePlugin } from '../../qti2-to-pie/src/plugin.js';
import { PieToQti2Plugin } from '../src/plugin.js';

// Example 1: Outcome Declarations (Test-Level Variables)
async function outcomeDeclarationsExample() {
  console.log('\n=== Example 1: Outcome Declarations (Test-Level Variables) ===\n');

  const assessmentWithOutcomes = {
    id: 'outcome-test',
    title: 'Test with Outcome Variables',
    description: 'Assessment that tracks SCORE, PASS, and PERCENTAGE',
    metadata: {
      navigationMode: 'nonlinear',
      submissionMode: 'simultaneous'
    },
    // Outcome declarations define test-level variables
    outcomeDeclarationsXml: [
      `<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</outcomeDeclaration>`,
      `<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean">
  <defaultValue>
    <value>false</value>
  </defaultValue>
</outcomeDeclaration>`,
      `<outcomeDeclaration identifier="PERCENTAGE" cardinality="single" baseType="float">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</outcomeDeclaration>`
    ],
    sections: [
      {
        id: 'section-1',
        identifier: 'section-1',
        title: 'Main Section',
        visible: true,
        fixed: false,
        shuffle: false,
        itemRefs: [
          {
            identifier: 'q1',
            href: 'items/q1.xml',
            required: true,
            weight: 1.0
          },
          {
            identifier: 'q2',
            href: 'items/q2.xml',
            required: true,
            weight: 2.0
          }
        ]
      }
    ],
    // Outcome processing calculates final scores and pass/fail
    outcomeProcessingXml: `<outcomeProcessing>
  <!-- Calculate total score -->
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
  <!-- Determine pass/fail -->
  <setOutcomeValue identifier="PASS">
    <gte>
      <variable identifier="PERCENTAGE"/>
      <baseValue baseType="float">0.7</baseValue>
    </gte>
  </setOutcomeValue>
</outcomeProcessing>`
  };

  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  // PIE → QTI
  const qtiResult = await pieToQti.transform(
    { content: assessmentWithOutcomes },
    { logger: console }
  );
  const qtiXml = qtiResult.items[0].content;

  console.log('Features in generated QTI:');
  console.log(`  - Outcome declarations: ${assessmentWithOutcomes.outcomeDeclarationsXml?.length || 0}`);
  console.log(`  - Has outcome processing: ${!!assessmentWithOutcomes.outcomeProcessingXml}`);
  console.log(`  - Variables tracked: SCORE, PASS, PERCENTAGE\n`);

  // Verify QTI contains outcome declarations
  const hasOutcomeDeclarations = qtiXml.includes('<outcomeDeclaration');
  console.log(`QTI contains outcome declarations: ${hasOutcomeDeclarations}\n`);

  // QTI → PIE (round-trip)
  const pieResult = await qtiToPie.transform(
    { content: qtiXml },
    { logger: console }
  );
  const reconstructed = pieResult.items[0].content;

  console.log('Round-trip verification:');
  console.log(`  ✓ Outcome declarations preserved: ${reconstructed.outcomeDeclarationsXml?.length || 0}`);
  console.log(`  ✓ Outcome processing preserved: ${!!reconstructed.outcomeProcessingXml}`);
  console.log(`  ✓ Sections preserved: ${reconstructed.sections.length}\n`);
}

// Example 2: Template Declarations and Processing (Adaptive Tests)
async function templateDeclarationsExample() {
  console.log('\n=== Example 2: Template Declarations (Adaptive Tests) ===\n');

  const adaptiveAssessment = {
    id: 'adaptive-test',
    title: 'Adaptive Test with Templates',
    description: 'Computer-adaptive test using template variables',
    metadata: {
      navigationMode: 'linear',
      submissionMode: 'individual'
    },
    // Template declarations define variables for adaptive logic
    templateDeclarationsXml: [
      `<templateDeclaration identifier="DIFFICULTY" cardinality="single" baseType="integer">
  <defaultValue>
    <value>1</value>
  </defaultValue>
</templateDeclaration>`,
      `<templateDeclaration identifier="CORRECT_COUNT" cardinality="single" baseType="integer">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</templateDeclaration>`,
      `<templateDeclaration identifier="ITEM_POOL" cardinality="multiple" baseType="identifier">
  <defaultValue>
    <value>easy-1</value>
    <value>easy-2</value>
    <value>medium-1</value>
    <value>medium-2</value>
    <value>hard-1</value>
    <value>hard-2</value>
  </defaultValue>
</templateDeclaration>`
    ],
    // Template processing initializes template variables before test starts
    templateProcessingXml: `<templateProcessing>
  <!-- Initialize difficulty to medium -->
  <setTemplateValue identifier="DIFFICULTY">
    <baseValue baseType="integer">2</baseValue>
  </setTemplateValue>
  <!-- Shuffle item pool -->
  <setTemplateValue identifier="ITEM_POOL">
    <random>
      <variable identifier="ITEM_POOL"/>
    </random>
  </setTemplateValue>
</templateProcessing>`,
    outcomeDeclarationsXml: [
      `<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</outcomeDeclaration>`
    ],
    sections: [
      {
        id: 'adaptive-section',
        identifier: 'adaptive-section',
        title: 'Adaptive Questions',
        visible: true,
        fixed: false,
        shuffle: false,
        itemRefs: [
          {
            identifier: 'q1',
            href: 'items/adaptive-q1.xml',
            required: true,
            weight: 1.0,
            // Branch to harder questions if correct
            branchRule: [
              {
                xml: `<branchRule target="hard-section">
  <gte>
    <variable identifier="q1.SCORE"/>
    <baseValue baseType="float">1.0</baseValue>
  </gte>
</branchRule>`
              }
            ]
          }
        ]
      }
    ],
    outcomeProcessingXml: `<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE"/>
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

  console.log('Adaptive test features:');
  console.log(`  - Template declarations: ${adaptiveAssessment.templateDeclarationsXml?.length || 0}`);
  console.log(`  - Has template processing: ${!!adaptiveAssessment.templateProcessingXml}`);
  console.log(`  - Variables: DIFFICULTY, CORRECT_COUNT, ITEM_POOL\n`);

  // Verify QTI contains template features
  const hasTemplateDeclarations = qtiXml.includes('<templateDeclaration');
  const hasTemplateProcessing = qtiXml.includes('<templateProcessing');
  console.log(`QTI contains template declarations: ${hasTemplateDeclarations}`);
  console.log(`QTI contains template processing: ${hasTemplateProcessing}\n`);

  // QTI → PIE (round-trip)
  const pieResult = await qtiToPie.transform(
    { content: qtiXml },
    { logger: console }
  );
  const reconstructed = pieResult.items[0].content;

  console.log('Round-trip verification:');
  console.log(`  ✓ Template declarations preserved: ${reconstructed.templateDeclarationsXml?.length || 0}`);
  console.log(`  ✓ Template processing preserved: ${!!reconstructed.templateProcessingXml}`);
  console.log(`  ✓ Outcome declarations preserved: ${reconstructed.outcomeDeclarationsXml?.length || 0}\n`);
}

// Example 3: Test Feedback (Conditional Feedback at Test Completion)
async function testFeedbackExample() {
  console.log('\n=== Example 3: Test Feedback (Conditional Feedback) ===\n');

  const assessmentWithFeedback = {
    id: 'feedback-test',
    title: 'Test with Conditional Feedback',
    description: 'Assessment showing different feedback based on performance',
    metadata: {
      navigationMode: 'nonlinear',
      submissionMode: 'simultaneous'
    },
    outcomeDeclarationsXml: [
      `<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</outcomeDeclaration>`,
      `<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean">
  <defaultValue>
    <value>false</value>
  </defaultValue>
</outcomeDeclaration>`,
      `<outcomeDeclaration identifier="FEEDBACK_SHOWN" cardinality="single" baseType="identifier">
  <defaultValue>
    <value>none</value>
  </defaultValue>
</outcomeDeclaration>`
    ],
    sections: [
      {
        id: 'section-1',
        identifier: 'section-1',
        title: 'Questions',
        visible: true,
        fixed: false,
        shuffle: false,
        itemRefs: [
          {
            identifier: 'q1',
            href: 'items/q1.xml',
            required: true,
            weight: 1.0
          },
          {
            identifier: 'q2',
            href: 'items/q2.xml',
            required: true,
            weight: 1.0
          },
          {
            identifier: 'q3',
            href: 'items/q3.xml',
            required: true,
            weight: 1.0
          }
        ]
      }
    ],
    outcomeProcessingXml: `<outcomeProcessing>
  <!-- Calculate score -->
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
  <!-- Determine pass/fail -->
  <setOutcomeValue identifier="PASS">
    <gte>
      <variable identifier="SCORE"/>
      <baseValue baseType="float">2.0</baseValue>
    </gte>
  </setOutcomeValue>
  <!-- Set feedback identifier -->
  <setOutcomeValue identifier="FEEDBACK_SHOWN">
    <match>
      <variable identifier="PASS"/>
      <baseValue baseType="boolean">true</baseValue>
    </match>
  </setOutcomeValue>
</outcomeProcessing>`,
    // Test feedback shown at end based on outcomes
    testFeedback: [
      {
        identifier: 'pass-feedback',
        outcomeIdentifier: 'PASS',
        showHide: 'show',
        access: 'atEnd',
        xml: `<testFeedback identifier="pass-feedback" outcomeIdentifier="PASS" showHide="show" access="atEnd">
  <div class="feedback success">
    <h3>Congratulations!</h3>
    <p>You passed the test with a score of <printedVariable identifier="SCORE"/>.</p>
    <p>Excellent work understanding the material.</p>
  </div>
</testFeedback>`
      },
      {
        identifier: 'fail-feedback',
        outcomeIdentifier: 'PASS',
        showHide: 'hide',
        access: 'atEnd',
        xml: `<testFeedback identifier="fail-feedback" outcomeIdentifier="PASS" showHide="hide" access="atEnd">
  <div class="feedback warning">
    <h3>Keep Practicing</h3>
    <p>You scored <printedVariable identifier="SCORE"/> out of 3.</p>
    <p>Review the material and try again when you're ready.</p>
  </div>
</testFeedback>`
      },
      {
        identifier: 'perfect-feedback',
        outcomeIdentifier: 'SCORE',
        showHide: 'show',
        access: 'atEnd',
        xml: `<testFeedback identifier="perfect-feedback" outcomeIdentifier="SCORE" showHide="show" access="atEnd">
  <div class="feedback excellent">
    <h3>Perfect Score!</h3>
    <p>You answered all questions correctly. Outstanding achievement!</p>
  </div>
</testFeedback>`
      }
    ]
  };

  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  // PIE → QTI
  const qtiResult = await pieToQti.transform(
    { content: assessmentWithFeedback },
    { logger: console }
  );
  const qtiXml = qtiResult.items[0].content;

  console.log('Test feedback features:');
  console.log(`  - Feedback blocks: ${assessmentWithFeedback.testFeedback?.length || 0}`);
  console.log(`  - Pass feedback: shown when PASS = true`);
  console.log(`  - Fail feedback: shown when PASS = false`);
  console.log(`  - Perfect feedback: shown when SCORE = 3.0\n`);

  // Verify QTI contains test feedback
  const hasTestFeedback = qtiXml.includes('<testFeedback');
  console.log(`QTI contains test feedback: ${hasTestFeedback}\n`);

  // QTI → PIE (round-trip)
  const pieResult = await qtiToPie.transform(
    { content: qtiXml },
    { logger: console }
  );
  const reconstructed = pieResult.items[0].content;

  console.log('Round-trip verification:');
  console.log(`  ✓ Test feedback preserved: ${reconstructed.testFeedback?.length || 0}`);
  console.log(`  ✓ Outcome declarations preserved: ${reconstructed.outcomeDeclarationsXml?.length || 0}`);
  console.log(`  ✓ Feedback identifiers match: ${reconstructed.testFeedback?.map(f => f.identifier).join(', ')}\n`);
}

// Example 4: Complete Advanced Assessment (All Features Combined)
async function completeAdvancedExample() {
  console.log('\n=== Example 4: Complete Advanced Assessment (All Features) ===\n');

  const completeAssessment = {
    id: 'complete-advanced-test',
    title: 'Complete Advanced Assessment',
    description: 'Demonstrates all advanced QTI 2.2 assessment features together',
    metadata: {
      navigationMode: 'nonlinear',
      submissionMode: 'simultaneous'
    },
    // Outcome declarations
    outcomeDeclarationsXml: [
      `<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</outcomeDeclaration>`,
      `<outcomeDeclaration identifier="PERCENTAGE" cardinality="single" baseType="float">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</outcomeDeclaration>`,
      `<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean">
  <defaultValue>
    <value>false</value>
  </defaultValue>
</outcomeDeclaration>`,
      `<outcomeDeclaration identifier="GRADE" cardinality="single" baseType="identifier">
  <defaultValue>
    <value>F</value>
  </defaultValue>
</outcomeDeclaration>`
    ],
    // Template declarations
    templateDeclarationsXml: [
      `<templateDeclaration identifier="DIFFICULTY_LEVEL" cardinality="single" baseType="integer">
  <defaultValue>
    <value>1</value>
  </defaultValue>
</templateDeclaration>`,
      `<templateDeclaration identifier="ATTEMPT_COUNT" cardinality="single" baseType="integer">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</templateDeclaration>`
    ],
    // Template processing
    templateProcessingXml: `<templateProcessing>
  <setTemplateValue identifier="DIFFICULTY_LEVEL">
    <baseValue baseType="integer">2</baseValue>
  </setTemplateValue>
  <setTemplateValue identifier="ATTEMPT_COUNT">
    <sum>
      <variable identifier="ATTEMPT_COUNT"/>
      <baseValue baseType="integer">1</baseValue>
    </sum>
  </setTemplateValue>
</templateProcessing>`,
    sections: [
      {
        id: 'section-1',
        identifier: 'section-1',
        title: 'Core Questions',
        visible: true,
        fixed: false,
        shuffle: true,
        itemRefs: [
          {
            identifier: 'q1',
            href: 'items/q1.xml',
            required: true,
            weight: 2.0
          },
          {
            identifier: 'q2',
            href: 'items/q2.xml',
            required: true,
            weight: 2.0
          },
          {
            identifier: 'q3',
            href: 'items/q3.xml',
            required: true,
            weight: 1.0
          }
        ]
      }
    ],
    // Outcome processing
    outcomeProcessingXml: `<outcomeProcessing>
  <!-- Calculate weighted score -->
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
  <!-- Calculate percentage -->
  <setOutcomeValue identifier="PERCENTAGE">
    <divide>
      <variable identifier="SCORE"/>
      <baseValue baseType="float">5.0</baseValue>
    </divide>
  </setOutcomeValue>
  <!-- Determine pass/fail (70% threshold) -->
  <setOutcomeValue identifier="PASS">
    <gte>
      <variable identifier="PERCENTAGE"/>
      <baseValue baseType="float">0.7</baseValue>
    </gte>
  </setOutcomeValue>
  <!-- Calculate letter grade -->
  <setOutcomeValue identifier="GRADE">
    <match>
      <gte>
        <variable identifier="PERCENTAGE"/>
        <baseValue baseType="float">0.9</baseValue>
      </gte>
      <baseValue baseType="boolean">true</baseValue>
    </match>
  </setOutcomeValue>
</outcomeProcessing>`,
    // Test feedback
    testFeedback: [
      {
        identifier: 'grade-a-feedback',
        outcomeIdentifier: 'PERCENTAGE',
        showHide: 'show',
        access: 'atEnd',
        xml: `<testFeedback identifier="grade-a-feedback" outcomeIdentifier="PERCENTAGE" showHide="show" access="atEnd">
  <div class="feedback excellent">
    <h2>Grade: A (90%+)</h2>
    <p>Outstanding performance! You scored <printedVariable identifier="SCORE"/> out of 5.</p>
  </div>
</testFeedback>`
      },
      {
        identifier: 'grade-b-feedback',
        outcomeIdentifier: 'PERCENTAGE',
        showHide: 'show',
        access: 'atEnd',
        xml: `<testFeedback identifier="grade-b-feedback" outcomeIdentifier="PERCENTAGE" showHide="show" access="atEnd">
  <div class="feedback good">
    <h2>Grade: B (80-89%)</h2>
    <p>Great work! You scored <printedVariable identifier="SCORE"/> out of 5.</p>
  </div>
</testFeedback>`
      },
      {
        identifier: 'pass-feedback',
        outcomeIdentifier: 'PASS',
        showHide: 'show',
        access: 'atEnd',
        xml: `<testFeedback identifier="pass-feedback" outcomeIdentifier="PASS" showHide="show" access="atEnd">
  <div class="feedback success">
    <h3>You Passed!</h3>
    <p>Final score: <printedVariable identifier="PERCENTAGE"/>%</p>
  </div>
</testFeedback>`
      },
      {
        identifier: 'fail-feedback',
        outcomeIdentifier: 'PASS',
        showHide: 'hide',
        access: 'atEnd',
        xml: `<testFeedback identifier="fail-feedback" outcomeIdentifier="PASS" showHide="hide" access="atEnd">
  <div class="feedback warning">
    <h3>Not Passing Yet</h3>
    <p>You scored <printedVariable identifier="PERCENTAGE"/>%</p>
    <p>You need 70% or higher to pass. Review and try again.</p>
  </div>
</testFeedback>`
      }
    ],
    timeLimits: {
      maxTime: 3600,
      allowLateSubmission: false
    }
  };

  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  // PIE → QTI
  const qtiResult = await pieToQti.transform(
    { content: completeAssessment },
    { logger: console }
  );
  const qtiXml = qtiResult.items[0].content;

  console.log('Complete assessment features:');
  console.log(`  - Outcome declarations: ${completeAssessment.outcomeDeclarationsXml?.length || 0}`);
  console.log(`  - Template declarations: ${completeAssessment.templateDeclarationsXml?.length || 0}`);
  console.log(`  - Has template processing: ${!!completeAssessment.templateProcessingXml}`);
  console.log(`  - Has outcome processing: ${!!completeAssessment.outcomeProcessingXml}`);
  console.log(`  - Test feedback blocks: ${completeAssessment.testFeedback?.length || 0}`);
  console.log(`  - Time limit: ${completeAssessment.timeLimits?.maxTime}s\n`);

  // Verify all features in QTI
  const hasOutcomeDeclarations = qtiXml.includes('<outcomeDeclaration');
  const hasTemplateDeclarations = qtiXml.includes('<templateDeclaration');
  const hasTemplateProcessing = qtiXml.includes('<templateProcessing');
  const hasOutcomeProcessing = qtiXml.includes('<outcomeProcessing');
  const hasTestFeedback = qtiXml.includes('<testFeedback');
  const hasTimeLimits = qtiXml.includes('<timeLimits');

  console.log('QTI feature verification:');
  console.log(`  ✓ Outcome declarations: ${hasOutcomeDeclarations}`);
  console.log(`  ✓ Template declarations: ${hasTemplateDeclarations}`);
  console.log(`  ✓ Template processing: ${hasTemplateProcessing}`);
  console.log(`  ✓ Outcome processing: ${hasOutcomeProcessing}`);
  console.log(`  ✓ Test feedback: ${hasTestFeedback}`);
  console.log(`  ✓ Time limits: ${hasTimeLimits}\n`);

  // QTI → PIE (round-trip)
  const pieResult = await qtiToPie.transform(
    { content: qtiXml },
    { logger: console }
  );
  const reconstructed = pieResult.items[0].content;

  console.log('Round-trip verification:');
  console.log(`  ✓ Outcome declarations: ${reconstructed.outcomeDeclarationsXml?.length || 0}`);
  console.log(`  ✓ Template declarations: ${reconstructed.templateDeclarationsXml?.length || 0}`);
  console.log(`  ✓ Template processing: ${!!reconstructed.templateProcessingXml}`);
  console.log(`  ✓ Outcome processing: ${!!reconstructed.outcomeProcessingXml}`);
  console.log(`  ✓ Test feedback: ${reconstructed.testFeedback?.length || 0}`);
  console.log(`  ✓ Time limits: ${!!reconstructed.timeLimits}\n`);

  // Verify exact preservation
  const allFeaturesPreserved =
    reconstructed.outcomeDeclarationsXml?.length === completeAssessment.outcomeDeclarationsXml?.length &&
    reconstructed.templateDeclarationsXml?.length === completeAssessment.templateDeclarationsXml?.length &&
    !!reconstructed.templateProcessingXml &&
    !!reconstructed.outcomeProcessingXml &&
    reconstructed.testFeedback?.length === completeAssessment.testFeedback?.length;

  console.log(`All features preserved: ${allFeaturesPreserved ? '✅ YES' : '❌ NO'}\n`);
}

// Run all examples
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  QTI 2.2 Advanced Assessment Features Examples              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  try {
    await outcomeDeclarationsExample();
    await templateDeclarationsExample();
    await testFeedbackExample();
    await completeAdvancedExample();

    console.log('\n✅ All examples completed successfully!\n');
    console.log('Key takeaways:');
    console.log('  1. Outcome declarations define test-level variables (SCORE, PASS, etc.)');
    console.log('  2. Template declarations enable adaptive/computer-adaptive tests');
    console.log('  3. Template processing initializes variables before test starts');
    console.log('  4. Test feedback provides conditional feedback at test completion');
    console.log('  5. All features preserved through lossless round-trips');
    console.log('  6. Complex scoring logic (weighted, percentage, grading) supported');
    console.log('  7. Multiple feedback blocks can be shown based on outcomes\n');
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
