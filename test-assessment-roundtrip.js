// Test assessment-level round-trip: PIE → QTI → PIE
import { PieToQti2Plugin } from './packages/pie-to-qti2/src/plugin.js';
import { Qti22ToPiePlugin } from './packages/qti2-to-pie/src/plugin.js';

const pieToQti = new PieToQti2Plugin();
const qtiToPie = new Qti22ToPiePlugin();

const logger = {
  debug: () => {},
  info: console.log,
  warn: console.warn,
  error: console.error
};

console.log('=== Testing Assessment Round-Trip ===\n');

// Original PIE assessment with outcomeProcessing
const originalAssessment = {
  id: 'test-assessment-1',
  title: 'Sample Assessment',
  description: 'A test assessment',
  metadata: {
    navigationMode: 'linear',
    submissionMode: 'simultaneous'
  },
  sections: [
    {
      id: 'section-1',
      identifier: 'section-1',
      title: 'Section 1',
      visible: true,
      fixed: false,
      shuffle: false,
      itemRefs: [
        {
          identifier: 'item-1',
          href: 'item-1.xml',
          required: true,
          weight: 1.0,
          branchRule: [
            { xml: '<branchRule target="EXIT_TEST"><baseValue baseType="boolean">true</baseValue></branchRule>' }
          ],
          preCondition: [
            { xml: '<preCondition><baseValue baseType="boolean">true</baseValue></preCondition>' }
          ]
        },
        {
          identifier: 'item-2',
          href: 'item-2.xml',
          required: false,
          weight: 2.0
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
  </outcomeProcessing>`,
  timeLimits: {
    maxTime: 3600,
    allowLateSubmission: false
  }
};

console.log('1. Original PIE Assessment:');
console.log(`   - id: "${originalAssessment.id}"`);
console.log(`   - title: "${originalAssessment.title}"`);
console.log(`   - sections: ${originalAssessment.sections.length}`);
console.log(`   - items: ${originalAssessment.sections[0].itemRefs.length}`);
console.log(`   - has outcomeProcessing: ${!!originalAssessment.outcomeProcessingXml}`);
console.log(`   - has branchRules: ${!!originalAssessment.sections[0].itemRefs[0].branchRule}`);
console.log(`   - has preConditions: ${!!originalAssessment.sections[0].itemRefs[0].preCondition}\n`);

// Transform PIE → QTI
const qtiResult = await pieToQti.transform(
  { content: originalAssessment },
  { logger }
);
const qtiXml = qtiResult.items[0].content;

console.log('2. After PIE → QTI:');
console.log(`   - Format: ${qtiResult.items[0].format}`);
const hasOutcomeProcessing = qtiXml.includes('<outcomeProcessing>');
const hasBranchRule = qtiXml.includes('<branchRule');
const hasPreCondition = qtiXml.includes('<preCondition');
console.log(`   - Has outcomeProcessing: ${hasOutcomeProcessing}`);
console.log(`   - Has branchRule: ${hasBranchRule}`);
console.log(`   - Has preCondition: ${hasPreCondition}\n`);

// Show a snippet of the QTI
console.log('   QTI XML snippet (last 800 chars):');
const snippet = qtiXml.slice(-800);
const lines = snippet.split('\n');
lines.forEach(line => console.log(`   ${line}`));
console.log();

// Transform QTI → PIE
const pieResult = await qtiToPie.transform(
  { content: qtiXml },
  { logger }
);
const reconstructed = pieResult.items[0].content;

console.log('3. After QTI → PIE:');
console.log(`   - Format: ${pieResult.items[0].format}`);
console.log(`   - id: "${reconstructed.id}"`);
console.log(`   - title: "${reconstructed.title}"`);
console.log(`   - sections: ${reconstructed.sections.length}`);
console.log(`   - items: ${reconstructed.sections[0].itemRefs.length}`);
console.log(`   - has outcomeProcessing: ${!!reconstructed.outcomeProcessingXml}`);
console.log(`   - has branchRules: ${!!reconstructed.sections[0].itemRefs[0].branchRule}`);
console.log(`   - has preConditions: ${!!reconstructed.sections[0].itemRefs[0].preCondition}\n`);

console.log('4. Verification:');
// Note: qti2-to-pie generates a new UUID for id, but preserves identifier separately
const identifierPreserved = reconstructed.identifier === originalAssessment.id;
const titleMatches = reconstructed.title === originalAssessment.title;
const sectionCountMatches = reconstructed.sections.length === originalAssessment.sections.length;
const itemCountMatches = reconstructed.sections[0].itemRefs.length === originalAssessment.sections[0].itemRefs.length;
const outcomeProcessingPreserved = !!reconstructed.outcomeProcessingXml;
const branchRulesPreserved = !!reconstructed.sections[0].itemRefs[0].branchRule;
const preConditionsPreserved = !!reconstructed.sections[0].itemRefs[0].preCondition;

console.log(`   ✓ Identifier preserved (in identifier field): ${identifierPreserved}`);
console.log(`   ✓ Title preserved: ${titleMatches}`);
console.log(`   ✓ Section count preserved: ${sectionCountMatches}`);
console.log(`   ✓ Item count preserved: ${itemCountMatches}`);
console.log(`   ✓ outcomeProcessing preserved: ${outcomeProcessingPreserved}`);
console.log(`   ✓ branchRules preserved: ${branchRulesPreserved}`);
console.log(`   ✓ preConditions preserved: ${preConditionsPreserved}\n`);

const allPassed = identifierPreserved && titleMatches && sectionCountMatches &&
                  itemCountMatches && outcomeProcessingPreserved &&
                  branchRulesPreserved && preConditionsPreserved;

if (allPassed) {
  console.log('✅ All assessment-level features preserved through round-trip!');
} else {
  console.log('❌ Some features were not preserved correctly');
  console.log(`   identifier: expected "${originalAssessment.id}", got "${reconstructed.identifier}"`);
  process.exit(1);
}
