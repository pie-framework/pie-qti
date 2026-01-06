# Assessment-Level Transformations

Complete guide to transforming PIE assessments to QTI assessmentTests with full preservation of scoring logic, adaptive navigation, and conditional display rules.

## Overview

PIE assessments (multi-item tests) are transformed to QTI 2.2 `<assessmentTest>` elements with complete bidirectional support. All assessment-level features including outcome processing, branch rules, and preconditions are preserved through round-trips.

### Architecture

```
PIE Assessment                QTI assessmentTest
├─ id                        ├─ @identifier
├─ title                     ├─ @title
├─ description               ├─ <testPart>
├─ metadata                  │   ├─ @navigationMode
│   ├─ navigationMode        │   ├─ @submissionMode
│   └─ submissionMode        │   └─ <assessmentSection>
├─ sections[]                │       ├─ <selection>
│   ├─ itemRefs[]            │       ├─ <ordering>
│   │   ├─ identifier        │       └─ <assessmentItemRef>
│   │   ├─ href              │           ├─ <preCondition>
│   │   ├─ weight            │           ├─ <branchRule>
│   │   ├─ branchRule        │           └─ <weight>
│   │   └─ preCondition      ├─ <timeLimits>
│   └─ subsections[]         └─ <outcomeProcessing>
├─ timeLimits
└─ outcomeProcessingXml
```

## Features

### ✅ Preserved Through Round-Trips

1. **Outcome Processing** - Scoring logic (sum, weighted, custom rules)
2. **Branch Rules** - Adaptive navigation (skip sections, exit test early)
3. **Pre-Conditions** - Conditional display (show items only if conditions met)
4. **Time Limits** - Test-level and section-level time constraints
5. **Item Weights** - Weighted scoring for individual items
6. **Navigation Modes** - Linear vs. nonlinear navigation
7. **Submission Modes** - Individual vs. simultaneous submission
8. **Selection Rules** - Random item selection from pools
9. **Ordering Rules** - Item shuffling and randomization
10. **Item Session Controls** - Max attempts, feedback settings, review policies

### 🔄 Round-Trip Guarantee

```typescript
PIE Assessment → QTI assessmentTest → PIE Assessment (lossless)
```

All features are preserved through:
- **outcomeProcessingXml** - Stored as raw XML string, re-inserted on PIE → QTI
- **branchRule** - Array of `{ xml: string }` objects preserved in itemRefs
- **preCondition** - Array of `{ xml: string }` objects preserved in itemRefs

## Basic Usage

### Simple Assessment Transformation

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';

// Define PIE assessment
const pieAssessment = {
  id: 'final-exam-2024',
  title: 'Final Exam - Mathematics',
  description: 'End of year assessment',
  metadata: {
    navigationMode: 'linear',      // Students must answer in order
    submissionMode: 'simultaneous' // All items submitted together
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
          identifier: 'item-1',
          href: 'items/algebra-1.xml',
          required: true,
          weight: 2.0  // This item is worth 2 points
        },
        {
          identifier: 'item-2',
          href: 'items/algebra-2.xml',
          required: true,
          weight: 1.0
        }
      ]
    },
    {
      id: 'section-2',
      identifier: 'section-2',
      title: 'Geometry',
      visible: true,
      fixed: false,
      shuffle: true,  // Shuffle items in this section
      itemRefs: [
        {
          identifier: 'item-3',
          href: 'items/geometry-1.xml',
          required: false,
          weight: 1.5
        }
      ]
    }
  ],
  timeLimits: {
    maxTime: 3600,              // 60 minutes (in seconds)
    allowLateSubmission: false
  }
};

// Transform PIE → QTI
const pieToQti = new PieToQti2Plugin();
const qtiResult = await pieToQti.transform(
  { content: pieAssessment },
  { logger: console }
);
const qtiXml = qtiResult.items[0].content;

// Save as assessmentTest
await fs.writeFile('final-exam.xml', qtiXml);

// Transform QTI → PIE (lossless round-trip)
const qtiToPie = new Qti22ToPiePlugin();
const pieResult = await qtiToPie.transform(
  { content: qtiXml },
  { logger: console }
);
const reconstructed = pieResult.items[0].content;

// All features preserved!
console.log(reconstructed.sections.length); // 2
console.log(reconstructed.timeLimits.maxTime); // 3600
```

### Generated QTI XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="final-exam-2024"
  title="Final Exam - Mathematics">

  <timeLimits maxTime="3600" allowLateSubmission="false"/>

  <testPart identifier="testPart1" navigationMode="linear" submissionMode="simultaneous">

    <assessmentSection identifier="section-1" title="Algebra" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/algebra-1.xml" required="true" fixed="false">
        <weight identifier="SCORE" value="2.0"/>
      </assessmentItemRef>
      <assessmentItemRef identifier="item-2" href="items/algebra-2.xml" required="true" fixed="false">
        <weight identifier="SCORE" value="1.0"/>
      </assessmentItemRef>
    </assessmentSection>

    <assessmentSection identifier="section-2" title="Geometry" visible="true" fixed="false">
      <ordering shuffle="true"/>
      <assessmentItemRef identifier="item-3" href="items/geometry-1.xml" required="false" fixed="false">
        <weight identifier="SCORE" value="1.5"/>
      </assessmentItemRef>
    </assessmentSection>

  </testPart>
</assessmentTest>
```

## Advanced Features

### Outcome Processing (Scoring Logic)

Preserve custom scoring rules through `outcomeProcessingXml`:

```typescript
const assessmentWithScoring = {
  id: 'scored-test',
  title: 'Test with Custom Scoring',
  sections: [/* ... */],

  // Raw QTI outcomeProcessing XML (preserved through round-trips)
  outcomeProcessingXml: `<outcomeProcessing>
    <!-- Sum all item SCORE values -->
    <setOutcomeValue identifier="SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE"/>
      </sum>
    </setOutcomeValue>

    <!-- Calculate percentage -->
    <setOutcomeValue identifier="SCORE_PERCENTAGE">
      <divide>
        <variable identifier="SCORE"/>
        <baseValue baseType="float">10.0</baseValue>
      </divide>
    </setOutcomeValue>

    <!-- Determine pass/fail -->
    <setOutcomeValue identifier="PASS">
      <gte>
        <variable identifier="SCORE_PERCENTAGE"/>
        <baseValue baseType="float">0.7</baseValue>
      </gte>
    </setOutcomeValue>
  </outcomeProcessing>`
};

// Transform preserves outcomeProcessing exactly as-is
const result = await pieToQti.transform({ content: assessmentWithScoring });
// QTI XML will contain the outcomeProcessing block verbatim
```

#### Common Scoring Patterns

**Sum of Scores:**
```xml
<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>
```

**Weighted Average:**
```xml
<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <divide>
      <sum>
        <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
      </sum>
      <sum>
        <testVariables variableIdentifier="itemWeight"/>
      </sum>
    </divide>
  </setOutcomeValue>
</outcomeProcessing>
```

**Category-Based Scoring:**
```xml
<outcomeProcessing>
  <!-- Score for algebra items -->
  <setOutcomeValue identifier="ALGEBRA_SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE" includeCategory="algebra"/>
    </sum>
  </setOutcomeValue>

  <!-- Score for geometry items -->
  <setOutcomeValue identifier="GEOMETRY_SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE" includeCategory="geometry"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>
```

### Outcome Declarations (Test-Level Variables)

Define test-level variables that track assessment outcomes:

```typescript
const assessmentWithOutcomes = {
  id: 'test-with-outcomes',
  title: 'Test with Outcome Variables',

  // Declare test-level variables
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

  sections: [/* ... */],

  // Outcome processing uses the declared variables
  outcomeProcessingXml: `<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
  <setOutcomeValue identifier="PERCENTAGE">
    <divide>
      <variable identifier="SCORE"/>
      <baseValue baseType="float">10.0</baseValue>
    </divide>
  </setOutcomeValue>
  <setOutcomeValue identifier="PASS">
    <gte>
      <variable identifier="PERCENTAGE"/>
      <baseValue baseType="float">0.7</baseValue>
    </gte>
  </setOutcomeValue>
</outcomeProcessing>`
};
```

**Common outcome variables:**
- `SCORE` - Total test score (float)
- `PASS` - Pass/fail indicator (boolean)
- `PERCENTAGE` - Score as percentage (float)
- `GRADE` - Letter grade (identifier: A, B, C, D, F)
- `COMPLETED` - Test completion status (boolean)

### Template Declarations & Processing (Adaptive Tests)

Enable computer-adaptive testing with template variables:

```typescript
const adaptiveAssessment = {
  id: 'adaptive-test',
  title: 'Computer-Adaptive Test',

  // Declare template variables (initialized before test starts)
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

  // Template processing runs before test starts
  templateProcessingXml: `<templateProcessing>
  <!-- Initialize difficulty to medium -->
  <setTemplateValue identifier="DIFFICULTY">
    <baseValue baseType="integer">2</baseValue>
  </setTemplateValue>

  <!-- Randomize item pool -->
  <setTemplateValue identifier="ITEM_POOL">
    <random>
      <variable identifier="ITEM_POOL"/>
    </random>
  </setTemplateValue>

  <!-- Reset correct count -->
  <setTemplateValue identifier="CORRECT_COUNT">
    <baseValue baseType="integer">0</baseValue>
  </setTemplateValue>
</templateProcessing>`,

  sections: [/* ... */]
};
```

**Use cases:**
- **Item Banking**: Randomize items from pools before test starts
- **Difficulty Adjustment**: Initialize difficulty levels for adaptive navigation
- **State Tracking**: Track student performance across test sections
- **Pool Selection**: Choose items based on template logic

### Test Feedback (Conditional Feedback at Completion)

Show feedback blocks at test completion based on outcome values:

```typescript
const assessmentWithFeedback = {
  id: 'test-with-feedback',
  title: 'Test with Conditional Feedback',

  outcomeDeclarationsXml: [
    '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>',
    '<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"/>'
  ],

  sections: [/* ... */],

  outcomeProcessingXml: `<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
  <setOutcomeValue identifier="PASS">
    <gte>
      <variable identifier="SCORE"/>
      <baseValue baseType="float">7.0</baseValue>
    </gte>
  </setOutcomeValue>
</outcomeProcessing>`,

  // Test feedback shown based on outcome conditions
  testFeedback: [
    {
      identifier: 'pass-feedback',
      outcomeIdentifier: 'PASS',
      showHide: 'show',  // Show when PASS is true
      access: 'atEnd',    // Display at test completion
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
      showHide: 'hide',  // Show when PASS is false
      access: 'atEnd',
      xml: `<testFeedback identifier="fail-feedback" outcomeIdentifier="PASS" showHide="hide" access="atEnd">
  <div class="feedback warning">
    <h3>Keep Practicing</h3>
    <p>You scored <printedVariable identifier="SCORE"/> out of 10.</p>
    <p>Review the material and try again when you're ready.</p>
  </div>
</testFeedback>`
    },
    {
      identifier: 'perfect-feedback',
      outcomeIdentifier: 'SCORE',
      showHide: 'show',  // Shown when SCORE equals 10
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
```

**Feedback attributes:**
- `identifier` - Unique feedback block identifier
- `outcomeIdentifier` - Outcome variable to check
- `showHide` - `show` (when true) or `hide` (when false)
- `access` - `atEnd` (after completion) or `during` (during test)

**Complex feedback example:**
```typescript
testFeedback: [
  {
    identifier: 'grade-a-feedback',
    outcomeIdentifier: 'PERCENTAGE',
    showHide: 'show',
    access: 'atEnd',
    xml: `<testFeedback identifier="grade-a-feedback" outcomeIdentifier="PERCENTAGE" showHide="show" access="atEnd">
  <div class="feedback excellent">
    <h2>Grade: A (90%+)</h2>
    <p>Score: <printedVariable identifier="SCORE"/> out of <printedVariable identifier="MAX_SCORE"/></p>
    <p>Percentage: <printedVariable identifier="PERCENTAGE"/>%</p>
    <ul>
      <li>Algebra: <printedVariable identifier="ALGEBRA_SCORE"/></li>
      <li>Geometry: <printedVariable identifier="GEOMETRY_SCORE"/></li>
    </ul>
  </div>
</testFeedback>`
  }
]
```

### Branch Rules (Adaptive Navigation)

Control test flow based on conditions:

```typescript
const adaptiveAssessment = {
  id: 'adaptive-test',
  title: 'Adaptive Mathematics Test',
  sections: [
    {
      id: 'screening',
      identifier: 'screening',
      title: 'Screening Section',
      visible: true,
      fixed: false,
      shuffle: false,
      itemRefs: [
        {
          identifier: 'screener-1',
          href: 'items/screener.xml',
          required: true,

          // Exit test if student scores below threshold
          branchRule: [
            {
              xml: `<branchRule target="EXIT_TEST">
  <lt>
    <variable identifier="SCORE"/>
    <baseValue baseType="integer">3</baseValue>
  </lt>
</branchRule>`
            }
          ]
        },
        {
          identifier: 'advanced-1',
          href: 'items/advanced.xml',
          required: true,

          // Skip to bonus section if student excels
          branchRule: [
            {
              xml: `<branchRule target="bonus-section">
  <gte>
    <variable identifier="SCORE"/>
    <baseValue baseType="integer">9</baseValue>
  </gte>
</branchRule>`
            }
          ]
        }
      ]
    },
    {
      id: 'bonus-section',
      identifier: 'bonus-section',
      title: 'Bonus Questions',
      visible: true,
      fixed: false,
      shuffle: false,
      itemRefs: [
        {
          identifier: 'bonus-1',
          href: 'items/bonus.xml',
          required: false
        }
      ]
    }
  ]
};
```

#### Common Branch Patterns

**Exit Test Early:**
```xml
<branchRule target="EXIT_TEST">
  <baseValue baseType="boolean">true</baseValue>
</branchRule>
```

**Skip to Specific Section:**
```xml
<branchRule target="section-2">
  <match>
    <variable identifier="difficulty_level"/>
    <baseValue baseType="identifier">advanced</baseValue>
  </match>
</branchRule>
```

**Conditional Branching:**
```xml
<branchRule target="remedial-section">
  <lt>
    <variable identifier="SCORE"/>
    <baseValue baseType="integer">5</baseValue>
  </lt>
</branchRule>
```

### Pre-Conditions (Conditional Display)

Show items only when conditions are met:

```typescript
const conditionalAssessment = {
  id: 'conditional-test',
  title: 'Test with Prerequisites',
  sections: [
    {
      id: 'basics',
      identifier: 'basics',
      title: 'Basic Questions',
      visible: true,
      fixed: false,
      shuffle: false,
      itemRefs: [
        {
          identifier: 'basic-1',
          href: 'items/basic-1.xml',
          required: true
        },
        {
          identifier: 'advanced-1',
          href: 'items/advanced-1.xml',
          required: false,

          // Only show if student passed basic question
          preCondition: [
            {
              xml: `<preCondition>
  <gte>
    <variable identifier="basic-1.SCORE"/>
    <baseValue baseType="float">0.8</baseValue>
  </gte>
</preCondition>`
            }
          ]
        },
        {
          identifier: 'challenge-1',
          href: 'items/challenge-1.xml',
          required: false,

          // Only show if student completed both previous items
          preCondition: [
            {
              xml: `<preCondition>
  <and>
    <isNull>
      <variable identifier="basic-1.RESPONSE"/>
    </isNull>
    <isNull>
      <variable identifier="advanced-1.RESPONSE"/>
    </isNull>
  </and>
</preCondition>`
            }
          ]
        }
      ]
    }
  ]
};
```

#### Common Pre-Condition Patterns

**Always Show:**
```xml
<preCondition>
  <baseValue baseType="boolean">true</baseValue>
</preCondition>
```

**Show After Previous Item Answered:**
```xml
<preCondition>
  <not>
    <isNull>
      <variable identifier="previous-item.RESPONSE"/>
    </isNull>
  </not>
</preCondition>
```

**Show Based on Score:**
```xml
<preCondition>
  <gte>
    <variable identifier="previous-item.SCORE"/>
    <baseValue baseType="float">0.7</baseValue>
  </gte>
</preCondition>
```

### Item Selection (Item Banking)

Randomly select items from pools:

```typescript
const itemBankAssessment = {
  id: 'randomized-test',
  title: 'Test with Item Banking',
  sections: [
    {
      id: 'algebra-pool',
      identifier: 'algebra-pool',
      title: 'Algebra Questions',
      visible: true,
      fixed: false,
      shuffle: false,

      // Select 3 items randomly from pool of 10
      selection: {
        select: 3,
        withReplacement: false
      },

      itemRefs: [
        { identifier: 'algebra-1', href: 'items/algebra-1.xml', required: false },
        { identifier: 'algebra-2', href: 'items/algebra-2.xml', required: false },
        { identifier: 'algebra-3', href: 'items/algebra-3.xml', required: false },
        { identifier: 'algebra-4', href: 'items/algebra-4.xml', required: false },
        { identifier: 'algebra-5', href: 'items/algebra-5.xml', required: false },
        { identifier: 'algebra-6', href: 'items/algebra-6.xml', required: false },
        { identifier: 'algebra-7', href: 'items/algebra-7.xml', required: false },
        { identifier: 'algebra-8', href: 'items/algebra-8.xml', required: false },
        { identifier: 'algebra-9', href: 'items/algebra-9.xml', required: false },
        { identifier: 'algebra-10', href: 'items/algebra-10.xml', required: false }
      ]
    }
  ]
};
```

### Item Session Controls

Configure item-level behavior:

```typescript
const controlledAssessment = {
  id: 'controlled-test',
  title: 'Test with Item Controls',
  sections: [
    {
      id: 'practice',
      identifier: 'practice',
      title: 'Practice Section',
      visible: true,
      fixed: false,
      shuffle: false,
      itemRefs: [
        {
          identifier: 'practice-1',
          href: 'items/practice-1.xml',
          required: true,

          itemSessionControl: {
            maxAttempts: 3,           // Allow 3 attempts
            showFeedback: true,        // Show feedback after submission
            allowReview: true,         // Allow reviewing answers
            showSolution: false,       // Don't show solutions
            allowComment: false,       // No comments
            allowSkipping: true,       // Allow skipping
            validateResponses: true    // Validate before submission
          },

          timeLimits: {
            maxTime: 300,             // 5 minutes per item
            allowLateSubmission: false
          }
        }
      ]
    }
  ]
};
```

## Complete Example: Comprehensive Assessment

```typescript
const comprehensiveAssessment = {
  id: 'comprehensive-exam-2024',
  title: 'Comprehensive Mathematics Exam',
  description: 'Full assessment with all features',

  metadata: {
    navigationMode: 'nonlinear',      // Students can jump between items
    submissionMode: 'simultaneous'    // All submitted together
  },

  sections: [
    {
      id: 'warm-up',
      identifier: 'warm-up',
      title: 'Warm-Up Questions',
      visible: true,
      fixed: true,     // Cannot skip this section
      shuffle: false,

      timeLimits: {
        maxTime: 600,  // 10 minutes for warm-up
        allowLateSubmission: false
      },

      itemRefs: [
        {
          identifier: 'warmup-1',
          href: 'items/warmup-1.xml',
          required: true,
          weight: 0.5,   // Worth less than main questions
          category: ['warmup', 'algebra']
        }
      ]
    },

    {
      id: 'main-assessment',
      identifier: 'main-assessment',
      title: 'Main Assessment',
      visible: true,
      fixed: false,
      shuffle: true,   // Randomize order

      // Select 5 items from pool
      selection: {
        select: 5,
        withReplacement: false
      },

      itemRefs: [
        {
          identifier: 'main-1',
          href: 'items/main-1.xml',
          required: false,
          weight: 2.0,
          category: ['main', 'algebra'],

          itemSessionControl: {
            maxAttempts: 1,
            showFeedback: false,
            allowReview: true,
            allowSkipping: false
          },

          // Exit if score too low
          branchRule: [
            {
              xml: `<branchRule target="EXIT_TEST">
  <lt>
    <variable identifier="SCORE"/>
    <baseValue baseType="float">0.4</baseValue>
  </lt>
</branchRule>`
            }
          ]
        },
        {
          identifier: 'main-2',
          href: 'items/main-2.xml',
          required: false,
          weight: 2.0,
          category: ['main', 'geometry']
        },
        {
          identifier: 'main-3',
          href: 'items/main-3.xml',
          required: false,
          weight: 2.0,
          category: ['main', 'statistics']
        },
        // ... more items ...
      ],

      subsections: [
        {
          id: 'bonus',
          identifier: 'bonus',
          title: 'Bonus Questions',
          visible: true,
          fixed: false,
          shuffle: false,

          itemRefs: [
            {
              identifier: 'bonus-1',
              href: 'items/bonus-1.xml',
              required: false,
              weight: 1.0,
              category: ['bonus'],

              // Only show if main score is high
              preCondition: [
                {
                  xml: `<preCondition>
  <gte>
    <variable identifier="main-1.SCORE"/>
    <baseValue baseType="float">0.8</baseValue>
  </gte>
</preCondition>`
                }
              ]
            }
          ]
        }
      ]
    }
  ],

  timeLimits: {
    maxTime: 5400,    // 90 minutes total
    allowLateSubmission: false
  },

  // Custom scoring logic
  outcomeProcessingXml: `<outcomeProcessing>
    <!-- Calculate raw score -->
    <setOutcomeValue identifier="RAW_SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
      </sum>
    </setOutcomeValue>

    <!-- Calculate category scores -->
    <setOutcomeValue identifier="ALGEBRA_SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE" includeCategory="algebra"/>
      </sum>
    </setOutcomeValue>

    <setOutcomeValue identifier="GEOMETRY_SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE" includeCategory="geometry"/>
      </sum>
    </setOutcomeValue>

    <!-- Calculate percentage -->
    <setOutcomeValue identifier="PERCENTAGE">
      <divide>
        <variable identifier="RAW_SCORE"/>
        <baseValue baseType="float">20.0</baseValue>
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

// Transform and verify
const result = await pieToQti.transform({ content: comprehensiveAssessment });
console.log('Generated QTI assessmentTest:', result.items[0].content);
```

## Testing Round-Trips

Verify that assessment transformations preserve all features:

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';

const pieToQti = new PieToQti2Plugin();
const qtiToPie = new Qti22ToPiePlugin();

// Original assessment
const original = {
  id: 'test-1',
  title: 'Test Assessment',
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
          weight: 2.0,
          branchRule: [
            { xml: '<branchRule target="EXIT_TEST"><baseValue baseType="boolean">true</baseValue></branchRule>' }
          ],
          preCondition: [
            { xml: '<preCondition><baseValue baseType="boolean">true</baseValue></preCondition>' }
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

// PIE → QTI
const qtiResult = await pieToQti.transform({ content: original }, { logger: console });
const qtiXml = qtiResult.items[0].content;

// QTI → PIE
const pieResult = await qtiToPie.transform({ content: qtiXml }, { logger: console });
const reconstructed = pieResult.items[0].content;

// Verify all features preserved
console.assert(reconstructed.title === original.title);
console.assert(reconstructed.sections.length === original.sections.length);
console.assert(!!reconstructed.outcomeProcessingXml);
console.assert(!!reconstructed.sections[0].itemRefs[0].branchRule);
console.assert(!!reconstructed.sections[0].itemRefs[0].preCondition);
console.assert(reconstructed.sections[0].itemRefs[0].weight === 2.0);

console.log('✅ All features preserved through round-trip!');
```

## Best Practices

### 1. Use Stable Identifiers

Always use stable, human-readable identifiers:

```typescript
const assessment = {
  id: 'math-final-2024',           // Good: descriptive and stable
  sections: [
    {
      identifier: 'section-algebra', // Good: semantic identifier
      itemRefs: [
        {
          identifier: 'q1-quadratic',  // Good: describes content
          href: 'items/q1-quadratic.xml'
        }
      ]
    }
  ]
};
```

### 2. Store Complex Logic as XML

For outcome processing, branch rules, and preconditions, store the QTI XML directly:

```typescript
// ✅ Good: Store as XML string
const assessment = {
  outcomeProcessingXml: `<outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum><testVariables variableIdentifier="SCORE"/></sum>
    </setOutcomeValue>
  </outcomeProcessing>`
};

// ❌ Bad: Try to model QTI processing as PIE objects
const assessment = {
  scoring: {
    type: 'sum',
    variable: 'SCORE'
  }
};
```

### 3. Test Round-Trips

Always verify that your assessments survive round-trips:

```bash
# Create test script
node test-assessment-roundtrip.js

# Verify all features preserved
✅ Identifier preserved
✅ Title preserved
✅ Section count preserved
✅ Item count preserved
✅ outcomeProcessing preserved
✅ branchRules preserved
✅ preConditions preserved
```

### 4. Use Categories for Subscores

Leverage QTI categories for subscore reporting:

```typescript
const assessment = {
  sections: [
    {
      itemRefs: [
        {
          identifier: 'algebra-1',
          category: ['algebra', 'equations', 'grade-8']
        }
      ]
    }
  ],
  outcomeProcessingXml: `<outcomeProcessing>
    <setOutcomeValue identifier="ALGEBRA_SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE" includeCategory="algebra"/>
      </sum>
    </setOutcomeValue>
  </outcomeProcessing>`
};
```

### 5. Document Adaptive Logic

Add comments to explain complex branch rules and preconditions:

```typescript
const assessment = {
  sections: [
    {
      itemRefs: [
        {
          identifier: 'screener',
          // Exit test if student scores below 40% (early intervention)
          branchRule: [
            {
              xml: `<branchRule target="EXIT_TEST">
  <!-- Student needs remediation if score < 0.4 -->
  <lt>
    <variable identifier="SCORE"/>
    <baseValue baseType="float">0.4</baseValue>
  </lt>
</branchRule>`
            }
          ]
        }
      ]
    }
  ]
};
```

## Troubleshooting

### Assessment Not Detected

**Problem:** Plugin treats assessment as item and fails with "PIE item has no models"

**Solution:** Ensure assessment has `sections` array:

```typescript
// ❌ Missing sections array
const notAnAssessment = {
  id: 'test',
  title: 'Test'
};

// ✅ Valid assessment
const assessment = {
  id: 'test',
  title: 'Test',
  sections: []  // Required!
};
```

### Outcome Processing Not Preserved

**Problem:** QTI assessmentTest doesn't include `<outcomeProcessing>`

**Solution:** Add `outcomeProcessingXml` property to PIE assessment:

```typescript
const assessment = {
  id: 'test',
  sections: [/* ... */],
  outcomeProcessingXml: `<outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum><testVariables variableIdentifier="SCORE"/></sum>
    </setOutcomeValue>
  </outcomeProcessing>`
};
```

### Branch Rules / Pre-Conditions Not Preserved

**Problem:** QTI doesn't include `<branchRule>` or `<preCondition>` elements

**Solution:** Add as array of XML objects to itemRefs:

```typescript
const assessment = {
  sections: [
    {
      itemRefs: [
        {
          identifier: 'item-1',
          href: 'item-1.xml',
          branchRule: [
            { xml: '<branchRule target="EXIT_TEST">...</branchRule>' }
          ],
          preCondition: [
            { xml: '<preCondition>...</preCondition>' }
          ]
        }
      ]
    }
  ]
};
```

### Invalid QTI Generated

**Problem:** QTI fails validation or doesn't parse correctly

**Solution:** Validate XML snippets before embedding:

```typescript
// Use proper QTI namespace and structure
const xml = `<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>`;

// Test by parsing before using
import { parseXml } from '@pie-qti/xml-utils';
const parsed = parseXml(xml);  // Validates structure
```

## API Reference

### PIE Assessment Interface

```typescript
interface PieAssessment {
  id: string;
  title: string;
  description?: string;

  metadata?: {
    navigationMode?: 'linear' | 'nonlinear';
    submissionMode?: 'individual' | 'simultaneous';
  };

  sections: AssessmentSection[];

  timeLimits?: {
    maxTime?: number;              // Duration in seconds
    allowLateSubmission?: boolean;
  };

  outcomeProcessingXml?: string;   // QTI <outcomeProcessing> XML
}

interface AssessmentSection {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  visible: boolean;
  fixed: boolean;
  shuffle: boolean;

  itemRefs: ItemReference[];
  subsections?: AssessmentSection[];

  selection?: {
    select: number;                // Number of items to select
    withReplacement?: boolean;
  };

  ordering?: {
    shuffle: boolean;
  };

  timeLimits?: {
    maxTime?: number;
    allowLateSubmission?: boolean;
  };
}

interface ItemReference {
  identifier: string;
  href: string;                    // Path to QTI item file
  category?: string[];
  required?: boolean;
  fixed?: boolean;
  weight?: number;

  itemSessionControl?: {
    maxAttempts?: number;
    showFeedback?: boolean;
    allowReview?: boolean;
    showSolution?: boolean;
    allowComment?: boolean;
    allowSkipping?: boolean;
    validateResponses?: boolean;
  };

  timeLimits?: {
    maxTime?: number;
    allowLateSubmission?: boolean;
  };

  branchRule?: Array<{ xml: string }>;     // QTI <branchRule> XML
  preCondition?: Array<{ xml: string }>;   // QTI <preCondition> XML
}
```

## Working Examples

A complete runnable example demonstrating all assessment features is available:

```bash
# Run the comprehensive assessment transformation example
bun run packages/pie-to-qti2/examples/assessment-transformation.ts
```

This example demonstrates:
- Simple assessments with weighted scoring
- Adaptive navigation with branch rules
- Conditional display with pre-conditions
- Item banking with selection rules
- Complete round-trip verification

See [examples/assessment-transformation.ts](../examples/assessment-transformation.ts) for the full source code.

## Related Documentation

- [PIE to QTI 2.2 Plugin README](../README.md)
- [QTI 2.2.2 Compliance](./QTI-COMPLIANCE.md)
- [Manifest Generation](./MANIFEST-GENERATION.md)
- [External Passages](./EXTERNAL-PASSAGES.md)
- [Passage Deduplication](./PASSAGE-DEDUPLICATION.md)

## Support

For questions or issues:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review the [test files](../tests/) for working examples
3. Open an issue on GitHub with your assessment structure and error details
