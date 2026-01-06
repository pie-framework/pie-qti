# QTI Response Tracking and Scoring

## Overview

QTI implements a complete client-side state management and scoring system that can operate without backend code. This document explains how our TypeScript implementation handles response tracking, scoring, and state management in the **qti2-item-player** package.

---

## 1. Variable System (The Core)

QTI uses three types of **variables** to track state:

### Variable Types

1. **Response Variables** (`responseDeclaration`)
   - Store candidate's answers
   - Example: `RESPONSE` = `["choiceA"]` for a selected answer
   - Set by interactions when user provides input

2. **Outcome Variables** (`outcomeDeclaration`)
   - Store computed results (scores, feedback identifiers)
   - Example: `SCORE` = `1.0` (correct), `SCORE` = `0.0` (incorrect)
   - Set by response processing rules

3. **Template Variables** (`templateDeclaration`)
   - Used for randomization/templating
   - Set before item is presented to candidate

### Built-in Variables

Every QTI item gets these automatically ([constants.ts:62-93](../packages/qti2-item-player/src/core/constants.ts#L62-L93)):

```typescript
export const BUILTIN_DECLARATIONS: Record<string, VariableDeclaration> = {
  numAttempts: {
    identifier: 'numAttempts',
    value: 0,
    baseType: 'integer',
    cardinality: 'single',
  },
  completionStatus: {
    identifier: 'completionStatus',
    value: 'not_attempted',  // → "unknown" → "incomplete" → "completed"
    baseType: 'string',
    cardinality: 'single',
  },
  duration: {
    identifier: 'duration',
    value: null,
    baseType: 'duration',
    cardinality: 'single',
  },
  $comment: {
    identifier: '$comment',
    value: null,
    baseType: 'string',
    cardinality: 'single',
  },
  $dirty: {
    identifier: '$dirty',
    value: false,
    baseType: 'boolean',
    cardinality: 'single',
  },
};
```

### Variable Properties

Each variable has ([types/index.ts:21-29](../packages/qti2-item-player/src/types/index.ts#L21-L29)):

```typescript
export interface VariableDeclaration {
  identifier: string;        // Variable name (e.g., "RESPONSE", "SCORE")
  baseType: BaseType;        // Data type (see below)
  cardinality: Cardinality;  // single | multiple | ordered | record
  value: any;                // Current value (can be null, single value, or array)
  defaultValue?: any;        // Fallback if value is null
  mapping?: Mapping;         // For map_response scoring
  areaMapping?: AreaMapping; // For map_response_point scoring
}
```

**BaseType** values ([types/index.ts:5-17](../packages/qti2-item-player/src/types/index.ts#L5-L17)):

- `boolean`, `integer`, `float`, `string`
- `identifier` (most common for choice responses)
- `point` (x,y coordinates)
- `pair`, `directedPair` (for match/associate interactions)
- `duration` (ISO 8601 format)
- `file`, `uri`

**Cardinality** values:

- `single`: One value
- `multiple`: Unordered array
- `ordered`: Ordered array
- `record`: Key-value pairs

---

## 2. Response Tracking Flow

### Step 1: User Interacts

When a student clicks/types/drags, the interaction processor updates the response variable ([declarations.ts:90-100](../packages/qti2-item-player/src/core/declarations.ts#L90-L100)):

```typescript
/**
 * Set a variable value in declarations
 */
export function setVariableValue(
  declarations: Record<string, VariableDeclaration>,
  identifier: string,
  value: any
): void {
  const decl = declarations[identifier];
  if (decl) {
    decl.value = value;
  }
}
```

Example from [choiceProcessor.ts](../packages/qti2-item-player/src/processors/choiceProcessor.ts):

```typescript
// When user selects "choiceA" in a multiple choice
const responseIdentifier = interaction.getAttribute('responseIdentifier') || 'RESPONSE';
const maxChoices = parseInt(interaction.getAttribute('maxChoices') || '1', 10);

if (maxChoices === 1) {
  // Single selection: store identifier directly
  setVariableValue(player.declarations, responseIdentifier, 'choiceA');
} else {
  // Multiple selection: store array of identifiers
  setVariableValue(player.declarations, responseIdentifier, ['choiceA', 'choiceB']);
}

// Mark item as dirty (needs UI update)
setVariableValue(player.declarations, '$dirty', true);
```

**Key Points:**

- Response stored immediately in `player.declarations[responseIdentifier]`
- `$dirty` flag set to trigger UI updates
- No scoring happens yet (only on submit)

### Step 2: Submit

When student clicks "Submit", the player processes responses ([Player.ts:446-497](../packages/qti2-item-player/src/core/Player.ts#L446-L497)):

```typescript
/**
 * Process responses and calculate score
 */
public processResponses(): ScoringResult {
  if (!this.dom) {
    return {
      score: 0,
      maxScore: 0,
      completed: false,
      outcomeValues: {},
    };
  }

  // Update completionStatus to 'completed' when processing responses
  setVariableValue(this.declarations, 'completionStatus', 'completed');

  // Execute response processing rules
  const responseProcessing = querySelector(this.dom, 'responseProcessing');
  if (responseProcessing) {
    this.executeResponseProcessing(responseProcessing);
  }

  // Collect outcome values (SCORE, FEEDBACK, etc.)
  const outcomeValues = this.getOutcomeValues();
  const score = Number(outcomeValues.SCORE || 0);
  const maxScore = Number(outcomeValues.MAXSCORE || 1);

  // Evaluate modal feedback based on outcomes
  const modalFeedback = this.getModalFeedback(outcomeValues);

  return {
    score,
    maxScore,
    completed: true,
    outcomeValues,
    modalFeedback,
  };
}
```

---

## 3. Scoring (Response Processing)

### Overview

Response processing transforms **response variables** → **outcome variables** using:
1. **Standard Templates** (most common)
2. **Custom XML Rules** (for complex scoring)

### Standard Templates

QTI defines 6 standard templates (all client-side scorable):

#### 1. `match_correct` (Most Common)

Compares response to correct answer, sets SCORE to 0 or 1:

```xml
<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
```

Equivalent to:
```xml
<responseProcessing>
  <responseCondition>
    <responseIf>
      <match>
        <variable identifier="RESPONSE"/>
        <correct identifier="RESPONSE"/>
      </match>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">1</baseValue>
      </setOutcomeValue>
    </responseIf>
    <responseElse>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">0</baseValue>
      </setOutcomeValue>
    </responseElse>
  </responseCondition>
</responseProcessing>
```

#### 2. `map_response`

Uses a scoring map for partial credit:

```xml
<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
  <correctResponse>
    <value>choiceA</value>
  </correctResponse>
  <mapping defaultValue="0">
    <mapEntry mapKey="choiceA" mappedValue="2"/>    <!-- Best answer -->
    <mapEntry mapKey="choiceB" mappedValue="1"/>    <!-- Partial credit -->
    <mapEntry mapKey="choiceC" mappedValue="0"/>    <!-- Wrong -->
  </mapping>
</responseDeclaration>

<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
```

Implementation note: the current runtime is **AST-based**. `mapResponse` is evaluated as an expression in:

- `packages/qti2-item-player/src/processing/eval/evaluator.ts` (expression evaluation)
- With mapping parsed into declarations by `packages/qti2-item-player/src/core/Player.ts`

#### 3. `map_response_point`

For graphical interactions (hotspots, click-on-image):

```xml
<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="point">
  <areaMapping defaultValue="0">
    <areaMapEntry shape="circle" coords="50,50,10" mappedValue="1"/>
    <areaMapEntry shape="rect" coords="0,0,100,100" mappedValue="0.5"/>
  </areaMapping>
</responseDeclaration>
```

#### 4-6. Other Templates

- `match_correct_unordered` - For order-independent multiple responses
- `match_correct_ordered` - For order-dependent responses
- `map_response_unordered` - Partial credit for multiple selections

### Custom Response Processing

For complex scoring logic:

```xml
<responseProcessing>
  <responseCondition>
    <responseIf>
      <!-- If ALL correct choices selected -->
      <and>
        <member>
          <baseValue baseType="identifier">choiceA</baseValue>
          <variable identifier="RESPONSE"/>
        </member>
        <member>
          <baseValue baseType="identifier">choiceB</baseValue>
          <variable identifier="RESPONSE"/>
        </member>
        <not>
          <member>
            <baseValue baseType="identifier">choiceC</baseValue>
            <variable identifier="RESPONSE"/>
          </member>
        </not>
      </and>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">2.0</baseValue>
      </setOutcomeValue>
    </responseIf>
    <responseElseIf>
      <!-- Partial credit scenarios -->
      <member>
        <baseValue baseType="identifier">choiceA</baseValue>
        <variable identifier="RESPONSE"/>
      </member>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">1.0</baseValue>
      </setOutcomeValue>
    </responseElseIf>
    <responseElse>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">0.0</baseValue>
      </setOutcomeValue>
    </responseElse>
  </responseCondition>
</responseProcessing>
```

### Processing Implementation

```javascript
function responseProcessing(item) {
  item.declarations.numAttempts.value++;

  if (!isAdaptive(item))
    resetOutcomeVariables(item);  // Clear previous scores

  let rpblocks = [...item.getElementsByTagName("responseProcessing")];

  if (rpblocks.length) {
    rpblocks.forEach(rp => {
      execProcessing(rp, processingComplete);  // Execute scoring rules
    });
  }

  return true;
}

function setOutcomeValue(elem) {
  // Gets the variable identifier from the element
  let declarations = getDeclarations(elem);
  let decl = declarations[identifier(elem)];

  if (decl) {
    // Evaluate the child expression (e.g., <baseValue>, <variable>, <mapResponse>)
    let value = execChildren(elem, 0, 1)[0];

    // Store the computed value
    decl.value = coerce(decl, value);  // Type coercion
  }
}
```

### Operators Available

QTI 2.2 provides a rich set of operators for scoring logic. Our implementation includes 45+ operators (see full list in the "Operators Implemented" section of this document or in `packages/qti2-item-player/src/processing/eval/operators.ts`).

**Key operator categories:**

- **Comparison**: `match`, `equal`, `lt`, `lte`, `gt`, `gte`
- **Logic**: `and`, `or`, `not`, `anyN`, `allN`
- **Math**: `sum`, `product`, `subtract`, `divide`, `power`, `round`, `truncate`, `integerDivide`
- **Container**: `member`, `contains`, `index`, `containerSize`, `ordered`, `multiple`, `deleteValue`, `repeat`
- **String**: `stringMatch`, `substring`, `patternMatch`
- **Statistical**: `mean`, `sampleVariance`, `sampleSD`, `popVariance`, `popSD`
- **QTI-Specific**: `mapResponse`, `mapResponsePoint`, `getCorrectResponse`

Example complex scoring:
```xml
<!-- Award points based on how fast they answered -->
<responseCondition>
  <responseIf>
    <and>
      <match>
        <variable identifier="RESPONSE"/>
        <correct identifier="RESPONSE"/>
      </match>
      <durationLT>
        <variable identifier="duration"/>
        <baseValue baseType="duration">PT5S</baseValue> <!-- 5 seconds -->
      </durationLT>
    </and>
    <setOutcomeValue identifier="SCORE">
      <baseValue baseType="float">2.0</baseValue> <!-- Bonus points! -->
    </setOutcomeValue>
  </responseIf>
</responseCondition>
```

---

## 4. State Management in Our Implementation

Our TypeScript implementation stores session state in clean JavaScript objects (not DOM):

```typescript
// Each Player instance has a declarations object
player.declarations = {
  RESPONSE: {
    identifier: 'RESPONSE',
    value: ['choiceA'],
    baseType: 'identifier',
    cardinality: 'multiple',
  },
  SCORE: {
    identifier: 'SCORE',
    value: 0.5,
    baseType: 'float',
    cardinality: 'single',
  },
  numAttempts: { identifier: 'numAttempts', value: 1, baseType: 'integer', cardinality: 'single' },
  completionStatus: { identifier: 'completionStatus', value: 'completed', baseType: 'string', cardinality: 'single' },
  duration: { identifier: 'duration', value: 'PT15S', baseType: 'duration', cardinality: 'single' },
};
```

### Serialization

The player provides methods to get/set all variable state ([Player.ts:380-442](../packages/qti2-item-player/src/core/Player.ts#L380-L442)):

```typescript
// Get current responses
const responses = player.getResponses();
// Returns: { RESPONSE: ['choiceA'] }

// Set responses (for restoring state)
player.setResponse('RESPONSE', ['choiceA']);

// Get outcome values after scoring
const outcomes = player.getOutcomeValues();
// Returns: { SCORE: 0.5, FEEDBACK: 'correct' }

// Get all template variables
const templates = player.getTemplateVariables();
// Returns: { X: 5, Y: 10 }

// Set template variables (for randomization)
player.setTemplateVariables({ X: 5, Y: 10 });
```

The assessment player (for multi-item tests) handles session persistence at a higher level, storing the state of all items in a test.

---

## 5. Integration with Applications

Our player is designed to integrate with web applications:

### Getting Responses

```typescript
import { Player } from '@pie-qti/qti2-item-player';

const player = new Player(qtiXml, config);

// After user interacts with the item
const responses = player.getResponses();
console.log(responses);
// { RESPONSE: ['choiceA', 'choiceB'] }

// Send to your backend
await fetch('/api/save-response', {
  method: 'POST',
  body: JSON.stringify({ itemId: 'item-001', responses }),
});
```

### Processing and Scoring

```typescript
// When ready to score (e.g., user clicks Submit)
const result = player.processResponses();

console.log(result);
// {
//   score: 1,
//   maxScore: 1,
//   completed: true,
//   outcomeValues: { SCORE: 1, MAXSCORE: 1, FEEDBACK: 'correct' },
//   modalFeedback: [
//     {
//       identifier: 'correct_feedback',
//       outcomeIdentifier: 'FEEDBACK',
//       showHide: 'show',
//       content: '<p>Well done!</p>',
//       title: 'Correct!'
//     }
//   ]
// }

// Send score to your backend
await fetch('/api/save-score', {
  method: 'POST',
  body: JSON.stringify({ itemId: 'item-001', ...result }),
});
```

### Adaptive Items (Multi-Attempt)

```typescript
// For adaptive items that allow multiple attempts
const result = player.submitAttempt();

console.log(result);
// {
//   score: 0.5,
//   maxScore: 1,
//   completed: false,
//   outcomeValues: { SCORE: 0.5 },
//   numAttempts: 1,
//   completionStatus: 'incomplete',  // Can try again!
//   canContinue: true
// }

if (result.canContinue) {
  // Show "Try Again" button
  // User can modify their response and resubmit
}
```

---

## 6. What Our QTI 2.2 Player Provides

Our **qti2-item-player** implementation provides a complete client-side scoring system:

### Player API

The `Player` class ([Player.ts](../packages/qti2-item-player/src/core/Player.ts)) provides these key methods:

```typescript
class Player {
  // Set response values (called by interaction processors)
  setResponse(responseId: string, value: any): void;

  // Get all current responses
  getResponses(): Record<string, any>;

  // Process responses and calculate score
  processResponses(): ScoringResult;

  // For adaptive items (multi-attempt)
  submitAttempt(): AdaptiveAttemptResult;

  // Template variable support
  setTemplateVariables(variables: Record<string, any>): void;
  getTemplateVariables(): Record<string, any>;

  // Get outcome values after scoring
  getOutcomeValues(): Record<string, any>;
}
```

### Return Types

```typescript
interface ScoringResult {
  score: number;
  maxScore: number;
  completed: boolean;
  outcomeValues: Record<string, any>;
  modalFeedback?: ModalFeedback[];  // Feedback to display
}

interface AdaptiveAttemptResult extends ScoringResult {
  numAttempts: number;
  completionStatus: CompletionStatus;  // 'not_attempted' | 'unknown' | 'incomplete' | 'completed'
  canContinue: boolean;  // Can submit again?
}

interface ModalFeedback {
  identifier: string;
  outcomeIdentifier: string;
  showHide: 'show' | 'hide';
  content: string;  // HTML to display
  title?: string;
}
```

### Client-Side Scoring Support

Our player supports:

1. ✅ **All 6 standard response processing templates** (`match_correct`, `map_response`, `map_response_point`, etc.)
2. ✅ **Custom response processing rules** (implemented in the AST engine; see [`ast/types.ts`](../packages/qti2-item-player/src/processing/ast/types.ts) and [`eval/evaluator.ts`](../packages/qti2-item-player/src/processing/eval/evaluator.ts))
3. ✅ **Outcome processing** for test-level scoring (in assessment player)
4. ✅ **Feedback rules** (modalFeedback, inline feedback)
5. ✅ **Template processing** for randomization and adaptive items

### Operators Implemented

Our implementation includes a growing set of QTI operators (see the AST engine implementation in [`ast/types.ts`](../packages/qti2-item-player/src/processing/ast/types.ts) and [`eval/evaluator.ts`](../packages/qti2-item-player/src/processing/eval/evaluator.ts)):

**Comparison**: `match`, `equal`, `lt`, `lte`, `gt`, `gte`

**Arithmetic**: `sum`, `subtract`, `product`, `divide`, `power`, `mod`, `truncate`, `round`, `integerDivide`

**Logical**: `and`, `or`, `not`, `anyN`, `allN`

**Container**: `contains`, `member`, `index`, `containerSize`, `ordered`, `multiple`, `deleteValue`, `fieldValue`, `repeat`

**String**: `stringMatch`, `patternMatch`, `substring`

**Statistical**: `mean`, `sampleVariance`, `sampleSD`, `popVariance`, `popSD`, `randomInteger`

**Type Checking**: `isNull`, `isTypeOf`

**Variable Access**: `getVariable`, `getCorrectResponse`

**Response Mapping**: `mapResponse`, `mapResponsePoint`

**Assignment**: `setOutcomeValue`

**Custom**: `customOperator` (for vendor extensions)

---

## Summary

### Key Takeaways

1. **Everything is Client-Side** - QTI can score, track, and manage state entirely in the browser
2. **Variable-Based** - Three types (response, outcome, template) store all state
3. **Declarative Scoring** - XML rules define how responses → scores
4. **45+ Operators** - Rich expression language for complex scoring
5. **Template System** - Standard templates cover 95% of use cases
6. **TypeScript Implementation** - Modern, type-safe architecture

### What We Implemented

- ✅ **Pure TypeScript** - Type-safe declarations, operators, and scoring
- ✅ **Operators** - Implemented in the AST engine ([`ast/types.ts`](../packages/qti2-item-player/src/processing/ast/types.ts), [`eval/evaluator.ts`](../packages/qti2-item-player/src/processing/eval/evaluator.ts))
- ✅ **Functional architecture** - Clean variable management ([declarations.ts](../packages/qti2-item-player/src/core/declarations.ts))
- ✅ **All standard templates** - `match_correct`, `map_response`, `map_response_point`, etc.
- ✅ **Adaptive items** - Multi-attempt support with `completionStatus` tracking
- ✅ **Template variables** - Full support for randomization
- ✅ **Modal feedback** - Outcome-based feedback display
- ✅ **21 interaction types** - Complete QTI 2.2 interaction coverage

### Architecture Benefits

- **No DOM mutation for state** - Variables stored in clean TypeScript objects
- **Type safety** - Full TypeScript types for all variables and operators
- **Functional operators** - Pure functions for all scoring logic
- **Testable** - Clean separation of concerns
- **Modern** - Uses current best practices

---

## References

- **Spec snapshots (local, preferred)**: [SPEC_SNAPSHOTS.md](./SPEC_SNAPSHOTS.md)
- Key Implementation Files:
  - [Player.ts](../packages/qti2-item-player/src/core/Player.ts) - Main player class with response processing
  - [AST builder](../packages/qti2-item-player/src/processing/ast/build.ts) - XML → AST
  - [Evaluator](../packages/qti2-item-player/src/processing/eval/evaluator.ts) - Expression evaluation (`mapResponse`, operators, etc.)
  - [Operator registry](../packages/qti2-item-player/src/processing/eval/operators.ts) - Operator definitions
  - [Executor](../packages/qti2-item-player/src/processing/exec/execute.ts) - Statement execution (`setOutcomeValue`, conditions, exits, etc.)
  - [Runtime context](../packages/qti2-item-player/src/processing/runtime/context.ts) - Declarations + variable state
  - [Runtime values](../packages/qti2-item-player/src/processing/runtime/value.ts) - BaseType/cardinality coercion + normalization
  - [types/index.ts](../packages/qti2-item-player/src/types/index.ts) - TypeScript type definitions
