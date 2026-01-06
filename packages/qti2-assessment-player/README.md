# @pie-qti/qti2-assessment-player

QTI 2.x Assessment Player - Multi-item test player with navigation, sections, and rubric blocks.

## Features

- ✅ **Multi-item assessments** - Support for complete QTI assessmentTest structures
- ✅ **Navigation modes** - Linear (sequential) and nonlinear (free navigation)
- ✅ **Sections & hierarchy** - Nested sections with navigation
- ✅ **Rubric blocks** - Reading passages, instructions, and rubrics
- ✅ **Progress tracking** - Visual progress indicators
- ✅ **Section menu** - Quick navigation between sections
- ✅ **Outcome Processing** - QTI 2.x scoring with total/weighted/percentage/pass-fail templates
- ✅ **Test Feedback** - Conditional feedback based on outcome variables
- ✅ **Time Limits** - Assessment-level countdown timers with warnings and auto-submission
- ✅ **Item Session Control** - Max attempts, review/skip controls, response validation
- ✅ **State Persistence** - Auto-save with resume capability and optional backend integration
- ✅ **Selection & Ordering** - Random item selection and shuffling per QTI 2.x spec
- ✅ **QTI 2.x Standard Roles** - Candidate, scorer, tutor, author, proctor, testConstructor
- ✅ **Backend Integration** - Optional secure backend API (client-side by default)
- ✅ **Svelte 5 components** - Modern reactive UI
- ✅ **TypeScript** - Full type safety

## Installation

```bash
bun add @pie-qti/qti2-assessment-player
```

## Usage

### Basic Usage with Svelte

```svelte
<script lang="ts">
	import AssessmentShell from '@pie-qti/qti2-assessment-player/components/AssessmentShell.svelte';
	import type { QtiAssessmentTest } from '@pie-qti/qti2-assessment-player';

	const assessment: QtiAssessmentTest = {
		identifier: 'my-assessment',
		title: 'Sample Assessment',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				sections: [
					{
						identifier: 'section-1',
						title: 'Section 1',
						questionRefs: [
							{
								identifier: 'q1',
								itemXml: '...' // QTI item XML
							}
						]
					}
				]
			}
		]
	};
</script>

<AssessmentShell
	{assessment}
	config={{
		role: 'candidate',
		showSections: true,
		allowSectionNavigation: true,
		showProgress: true,
		onComplete: () => {
			console.log('Assessment completed!');
		}
	}}
/>
```

### Programmatic Usage (JavaScript/TypeScript)

```typescript
import { AssessmentPlayer } from '@pie-qti/qti2-assessment-player';

const player = new AssessmentPlayer({
	assessment: myAssessment,
	role: 'candidate',
	navigationMode: 'nonlinear',
	showSections: true,
	allowSectionNavigation: true,
});

// Navigate to first item
await player.navigateTo(0);

// Get navigation state
const navState = player.getNavigationState();
console.log(`Item ${navState.currentIndex + 1} of ${navState.totalItems}`);

// Get current rubric blocks (passages)
const rubrics = player.getCurrentRubricBlocks();

// Navigate next/previous
await player.next();
await player.previous();

// Navigate to section
await player.navigateToSection('section-1');

// Submit assessment
const results = await player.submit();
console.log('Total score:', results.totalScore, '/', results.maxScore);
```

## Assessment Format

The player uses a QTI 2.x-compliant JSON format:

```typescript
interface QtiAssessmentTest {
	identifier?: string;
	title?: string;
	testParts?: TestPart[];
}

interface TestPart {
	identifier: string;
	navigationMode: 'linear' | 'nonlinear';
	submissionMode: 'individual' | 'simultaneous';
	sections: AssessmentSection[];
}

interface AssessmentSection {
	identifier: string;
	title?: string;
	visible?: boolean;
	rubricBlocks?: RubricBlock[];
	questionRefs?: QuestionRef[];
	sections?: AssessmentSection[]; // Nested sections
}

interface QuestionRef {
	identifier: string;
	href?: string; // URL to item XML
	title?: string;
	itemXml?: string; // Loaded item XML (convenience property)
}

interface RubricBlock {
	view: string[]; // QTI roles: ['candidate', 'scorer', 'author', 'tutor', 'proctor', 'testConstructor']
	use?: 'passage' | 'instructions' | 'rubric';
	content: string; // HTML content
}
```

## Backend Integration

**By default**, the player runs 100% client-side with no backend required. This is perfect for demos, development, and non-critical assessments.

**For production**, integrate with a secure backend for:
- Server-side scoring (prevent score manipulation)
- Role-based data filtering (hide correct answers from candidates)
- Persistent session storage
- Authentication and authorization

### Quick Start

```typescript
import { ReferenceBackendAdapter } from '@pie-qti/qti2-assessment-player/integration';

// Development/demo mode - uses localStorage
const adapter = new ReferenceBackendAdapter();

const player = new AssessmentPlayer({
  backend: adapter,
  assessmentId: 'test-001',
  candidateId: 'student-123'
});
```

### Production Implementation

Implement the `BackendAdapter` interface for your backend:

```typescript
import type { BackendAdapter } from '@pie-qti/qti2-assessment-player/integration';

class MyBackendAdapter implements BackendAdapter {
  async initSession(request) {
    const response = await fetch('/api/qti/sessions/init', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(request)
    });
    return response.json();
  }

  async submitResponses(request) {
    // Server performs scoring and returns results
    const response = await fetch('/api/qti/responses/submit', {
      method: 'POST',
      body: JSON.stringify(request)
    });
    return response.json();
  }

  // ... implement other methods
}
```

**See [BACKEND-INTEGRATION.md](./BACKEND-INTEGRATION.md) for complete implementation guide.**

## QTI 2.x Standard Roles

The player implements QTI 2.x standard roles to control behavior:

| Role | Behavior |
|------|----------|
| `candidate` | Test-taker - inputs editable, no correct answers shown |
| `scorer` | Grader - inputs readonly, correct answers shown |
| `author` | Content author - inputs readonly, correct answers shown |
| `tutor` | Instructional mode - inputs readonly, correct answers shown |
| `proctor` | Test administrator - inputs readonly, limited feedback |
| `testConstructor` | Test developer - inputs readonly, correct answers shown |

```typescript
// For test-takers
<AssessmentShell {assessment} config={{ role: 'candidate' }} />

// For grading/review
<AssessmentShell {assessment} config={{ role: 'scorer' }} />
```

## Time Limits

QTI 2.x supports time limits at assessment, test part, section, and item levels. The player provides:

- **Countdown timer** - Displays remaining time to candidates
- **Warning threshold** - Alert before time expires (default: 60 seconds)
- **Auto-submission** - Automatically submits when time expires (configurable)
- **Late submission** - Optional allow submission after time expires

### Usage

```typescript
const assessment: QtiAssessmentTest = {
	identifier: 'timed-test',
	timeLimits: {
		maxTime: 3600, // 1 hour in seconds
		allowLateSubmission: false // Auto-submit when time expires
	},
	testParts: [/* ... */]
};

const player = new AssessmentPlayer({
	assessment,
	timeWarningThreshold: 300 // Warn at 5 minutes remaining
});

// Listen for time events
player.onTimeWarning((remainingSeconds) => {
	console.log(`Warning: ${remainingSeconds} seconds remaining`);
});

player.onTimeExpired(() => {
	console.log('Time expired!');
});

player.onTimeTick((remaining, elapsed) => {
	console.log(`${remaining}s remaining, ${elapsed}s elapsed`);
});

// Pause/resume timer (e.g., for breaks)
player.pauseTimer();
player.resumeTimer();

// Check time status
const remaining = player.getRemainingTime(); // seconds or null if no limit
const elapsed = player.getElapsedTime(); // seconds
const isExpired = player.isTimeExpired(); // boolean
```

### AssessmentTimer Component

Visual timer component that displays countdown:

```svelte
<script>
	import { AssessmentTimer } from '@pie-qti/qti2-assessment-player/components';
</script>

<AssessmentTimer
	{player}
	showElapsed={false}
	position="top-right"
/>
```

**Props:**
- `player: AssessmentPlayer` - The assessment player instance
- `showElapsed?: boolean` - Show elapsed time instead of remaining (default: false)
- `position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'` - Timer position

## Item Session Control

QTI itemSessionControl determines how candidates interact with items:

| Setting | Description |
|---------|-------------|
| `maxAttempts` | Maximum submission attempts (0 = unlimited) |
| `showFeedback` | Show feedback after submission |
| `showSolution` | Show correct answers |
| `allowReview` | Allow returning to submitted items |
| `allowSkipping` | Allow skipping items without answering |
| `validateResponses` | Require valid responses before navigation |

### Usage

```typescript
const assessment: QtiAssessmentTest = {
	testParts: [{
		identifier: 'part-1',
		navigationMode: 'nonlinear',
		submissionMode: 'individual',
		itemSessionControl: {
			maxAttempts: 3, // 3 attempts per item
			showFeedback: true,
			showSolution: false,
			allowReview: true,
			allowSkipping: false, // Must answer before moving
			validateResponses: true
		},
		sections: [/* ... */]
	}]
};

// Get session info for current item
const info = player.getItemSessionInfo();
console.log(`Can submit: ${info.canSubmit}`);
console.log(`Attempts remaining: ${info.remainingAttempts}`);
console.log(`Attempt count: ${info.attemptCount}`);
console.log(`Show feedback: ${info.showFeedback}`);
console.log(`Can skip: ${info.canSkip}`);
```

### ItemSessionInfo Component

Visual display of session control information:

```svelte
<script>
	import { ItemSessionInfo } from '@pie-qti/qti2-assessment-player/components';
</script>

<ItemSessionInfo
	{player}
	position="inline"
	showDetails={true}
/>
```

**Props:**
- `player: AssessmentPlayer` - The assessment player instance
- `position?: 'inline' | 'floating'` - Display mode (default: 'inline')
- `showDetails?: boolean` - Show detailed session information (default: false)

## State Persistence

The assessment player supports automatic state persistence for save/resume functionality. This allows candidates to continue their assessment across sessions.

### Capabilities

- **Auto-save**: Automatic debounced saves (default: 2000ms)
- **State capture**: Current item, responses, session states, time tracking
- **Storage fallback**: localStorage → sessionStorage → memory
- **Resume capability**: Restore exact position and state
- **Optional backend**: Integrate with server-side storage

### Basic Usage

Enable state persistence by providing a `sessionId`:

```typescript
const player = new AssessmentPlayer({
	assessment: myAssessment,
	role: 'candidate',

	// State persistence config
	sessionId: 'candidate-123-assessment-456', // Unique session identifier
	enableAutoSave: true, // Default: true when sessionId provided
	autoSaveDelay: 2000, // Debounce delay in ms (default: 2000)
	storage: 'localStorage', // 'localStorage' | 'sessionStorage' | 'memory'

	// Callbacks
	onStateSaved: (timestamp) => {
		console.log('State saved at:', new Date(timestamp));
	},
	onStateRestored: (timestamp) => {
		console.log('State restored from:', new Date(timestamp));
	}
});

// Check if saved state exists
const hasSaved = await player.hasSavedState();

// Load and resume from saved state
if (hasSaved) {
	const restored = await player.loadSavedState();
	console.log('Resumed assessment:', restored);
}

// Manually trigger immediate save (bypasses debounce)
await player.forceSaveState();

// Get last save timestamp
const lastSave = player.getLastSaveTime();

// Clear saved state
await player.clearSavedState();
```

### Backend Integration

Integrate with your backend for server-side persistence:

```typescript
import { StatePersistenceManager } from '@pie-qti/qti2-assessment-player';
import type { PersistableState } from '@pie-qti/qti2-assessment-player';

const persistenceManager = new StatePersistenceManager({
	sessionId: 'candidate-123-assessment-456',
	assessmentId: 'my-assessment',
	autoSave: true,
	autoSaveDelay: 2000,
	storage: 'localStorage', // Fallback if backend fails

	// Optional backend save callback
	onBackendSave: async (state: PersistableState) => {
		await fetch('/api/assessment/save', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(state)
		});
	},

	onSaveSuccess: (state) => {
		console.log('Saved at:', state.savedAt);
	},

	onSaveError: (error) => {
		console.error('Save failed:', error);
	}
});

// Update state (triggers auto-save)
persistenceManager.updateState({
	assessmentId: 'my-assessment',
	currentItemIndex: 5,
	visitedItems: [0, 1, 2, 3, 4, 5],
	responses: { 'RESPONSE_1': 'answer' },
	itemSessionStates: {},
	savedAt: Date.now()
});

// Load state
const savedState = await persistenceManager.load();

// Manual save
await persistenceManager.forceSave();

// Pause/resume auto-save (useful during navigation transitions)
persistenceManager.pauseAutoSave();
persistenceManager.resumeAutoSave();

// Cleanup
persistenceManager.destroy();
```

### State Structure

The `PersistableState` interface captures all necessary data:

```typescript
interface PersistableState {
  assessmentId: string;
  currentItemIndex: number;
  visitedItems: number[];
  responses: Record<string, unknown>;
  itemSessionStates: Record<string, {
    attemptCount: number;
    isAnswered: boolean;
    isSubmitted: boolean;
    lastSubmissionTime?: number;
  }>;
  timeTracking?: {
    startedAt: number;
    totalElapsed: number;
    itemTimes: Record<string, number>;
    sectionTimes: Record<string, number>;
  };
  savedAt: number;
}
```

## Selection & Ordering

The assessment player supports QTI 2.x selection and ordering rules for creating randomized assessments and item pools.

### Selection Rules

Randomly select a subset of items from a pool:

```typescript
const assessment: QtiAssessmentTest = {
  identifier: 'random-assessment',
  title: 'Random Item Assessment',
  testParts: [{
    identifier: 'part-1',
    navigationMode: 'nonlinear',
    submissionMode: 'individual',
    sections: [{
      identifier: 'item-pool',
      title: 'Question Pool',

      // Selection rule: Pick 5 items from pool of 10
      selection: {
        select: 5, // Number of items to select
        withReplacement: false // Don't allow same item twice (default)
      },

      questionRefs: [
        // Pool of 10 items - 5 will be randomly selected
        { identifier: 'q1', itemXml: '...' },
        { identifier: 'q2', itemXml: '...' },
        { identifier: 'q3', itemXml: '...' },
        // ... 7 more items
      ]
    }]
  }]
};

// Optional: Provide seed for consistent randomization
const player = new AssessmentPlayer({
  assessment,
  randomSeed: 12345 // Same seed = same item selection
});
```

**Selection Options:**
- `select: number` - Number of items to select from the pool
- `withReplacement?: boolean` - Allow selecting same item multiple times (default: false)
- `fromBank?: string` - Reference to external item bank (not yet implemented)

**Behavior:**
- If `select >= pool size`, all items are included
- Without replacement: Fisher-Yates shuffle, take first N items
- With replacement: Can select same item multiple times

### Ordering Rules

Shuffle items while optionally keeping some in fixed positions:

```typescript
const assessment: QtiAssessmentTest = {
  testParts: [{
    identifier: 'part-1',
    navigationMode: 'nonlinear',
    submissionMode: 'individual',
    sections: [{
      identifier: 'section-1',
      title: 'Mixed Questions',

      // Ordering rule: Shuffle items except fixed ones
      ordering: {
        shuffle: true,
        fixed: ['intro-question', 'summary-question'] // Keep these in place
      },

      questionRefs: [
        { identifier: 'intro-question', fixed: true, itemXml: '...' }, // Always first
        { identifier: 'q1', itemXml: '...' }, // Will be shuffled
        { identifier: 'q2', itemXml: '...' }, // Will be shuffled
        { identifier: 'q3', itemXml: '...' }, // Will be shuffled
        { identifier: 'summary-question', fixed: true, itemXml: '...' } // Always last
      ]
    }]
  }]
};
```

**Ordering Options:**
- `shuffle?: boolean` - Shuffle items (default: false)
- `fixed?: string[]` - Item identifiers that should not be shuffled

**Per-Item Fixed Flag:**
Items can also be marked as fixed directly:

```typescript
questionRefs: [
  { identifier: 'q1', fixed: true, itemXml: '...' }, // Won't shuffle
  { identifier: 'q2', itemXml: '...' } // Will shuffle
]
```

### Combined Selection & Ordering

You can use both rules together:

```typescript
sections: [{
  identifier: 'random-shuffled-pool',

  // First select 10 items from pool of 20
  selection: {
    select: 10,
    withReplacement: false
  },

  // Then shuffle the selected items
  ordering: {
    shuffle: true,
    fixed: ['anchor-item'] // But keep anchor item in place
  },

  questionRefs: [
    { identifier: 'anchor-item', fixed: true, itemXml: '...' },
    // ... 19 more items in pool
  ]
}]
```

**Processing Order:**
1. Selection is applied first (if specified)
2. Ordering is applied to the selected items (if specified)
3. Fixed items maintain their relative positions

### Random Seed

Control randomization for reproducibility or testing:

```typescript
// Different candidates get different randomizations
const player = new AssessmentPlayer({
  assessment,
  randomSeed: candidateId // Each candidate gets unique seed
});

// Or generate session-specific seed
const sessionSeed = Date.now();
const player = new AssessmentPlayer({
  assessment,
  randomSeed: sessionSeed // Same items for whole session
});
```

**Seed Behavior:**
- Default: `Date.now()` (different each time)
- Same seed = same item selection and order
- Used internally for consistency (resume preserves order)
- Uses Linear Congruential Generator (LCG) for seeded randomness

### Use Cases

**1. Item Pools**
```typescript
// Create large pool, select subset per candidate
selection: { select: 20 }, // From pool of 100
questionRefs: [...100 items...]
```

**2. Randomized Exams**
```typescript
// Shuffle all questions to prevent cheating
ordering: { shuffle: true }
```

**3. Fixed Start/End**
```typescript
// Instructions first, reflection last, shuffle middle
ordering: {
  shuffle: true,
  fixed: ['instructions', 'reflection']
}
```

**4. Practice Mode**
```typescript
// Random subset, shuffled order, new each time
selection: { select: 10 },
ordering: { shuffle: true }
// No randomSeed = different each load
```

**5. Consistent Test Forms**
```typescript
// Same questions for all candidates taking "Form A"
randomSeed: 'form-a'.hashCode(), // Consistent seed
selection: { select: 50 },
ordering: { shuffle: true }
```

## Outcome Processing & Scoring

The assessment player implements QTI 2.x outcome processing for aggregating item scores into assessment-level outcomes.

### Scoring Templates

The `outcomeProcessing.template` field determines how item scores are combined:

#### Total Score (Default)

Simple sum of all item scores.

```typescript
const assessment: QtiAssessmentTest = {
  identifier: 'test-1',
  outcomeProcessing: {
    template: 'total_score' // or omit for default
  },
  testParts: [/* ... */]
};

// Results:
// SCORE = sum of item scores
// MAXSCORE = sum of item max scores
```

#### Weighted Score

Applies weights to individual items. Use `weight` property on `questionRef` to specify item weights (default: 1).

```typescript
const assessment: QtiAssessmentTest = {
  identifier: 'test-1',
  outcomeProcessing: {
    template: 'weighted_score'
  },
  testParts: [{
    identifier: 'part-1',
    navigationMode: 'nonlinear',
    submissionMode: 'simultaneous',
    sections: [{
      identifier: 'section-1',
      questionRefs: [
        {
          identifier: 'q1',
          weight: 2, // Worth 2x other items
          itemXml: '...'
        },
        {
          identifier: 'q2',
          weight: 1,
          itemXml: '...'
        },
        {
          identifier: 'q3',
          weight: 3, // Worth 3x other items
          itemXml: '...'
        }
      ]
    }]
  }]
};

// Results:
// SCORE = (q1.score * 2) + (q2.score * 1) + (q3.score * 3)
// MAXSCORE = (q1.maxScore * 2) + (q2.maxScore * 1) + (q3.maxScore * 3)
```

#### Percentage Score

Calculates percentage of total possible points (0-100).

```typescript
const assessment: QtiAssessmentTest = {
  outcomeProcessing: {
    template: 'percentage_score'
  }
};

// Results:
// SCORE = (total earned / total possible) * 100
// MAXSCORE = 100
// PERCENTAGE = same as SCORE
```

#### Pass/Fail

Determines pass/fail based on a threshold.

```typescript
const assessment: QtiAssessmentTest = {
  outcomeDeclarations: [
    {
      identifier: 'PASSING_THRESHOLD',
      baseType: 'float',
      cardinality: 'single',
      defaultValue: 0.7 // 70% threshold
    }
  ],
  outcomeProcessing: {
    template: 'pass_fail'
  }
};

// Results:
// SCORE = total earned points
// MAXSCORE = total possible points
// PASSED = true/false (based on threshold)
// PERCENTAGE = percentage score
```

### Outcome Variables

Define custom outcome variables with `outcomeDeclarations`:

```typescript
const assessment: QtiAssessmentTest = {
  outcomeDeclarations: [
    {
      identifier: 'SCORE',
      baseType: 'float',
      cardinality: 'single',
      defaultValue: 0
    },
    {
      identifier: 'MAXSCORE',
      baseType: 'float',
      cardinality: 'single',
      defaultValue: 0
    },
    {
      identifier: 'PASSING_THRESHOLD',
      baseType: 'float',
      cardinality: 'single',
      defaultValue: 0.75
    },
    {
      identifier: 'GRADE_LEVEL',
      baseType: 'string',
      cardinality: 'single',
      defaultValue: 'Not Graded'
    }
  ]
};
```

### Accessing Outcomes

After submission, access outcome variables:

```typescript
const results = await player.submit();

console.log('Total Score:', results.totalScore);
console.log('Max Score:', results.maxScore);
console.log('Item Results:', results.itemResults);

// Access outcome processor directly
const outcomeProcessor = player.getOutcomeProcessor();
const allOutcomes = outcomeProcessor.getOutcomes();
const passed = outcomeProcessor.getOutcome('PASSED');
const percentage = outcomeProcessor.getOutcome('PERCENTAGE');

console.log('All outcomes:', allOutcomes);
console.log('Passed:', passed);
console.log('Percentage:', percentage);
```

### Test Feedback

Display feedback based on outcome conditions:

```typescript
const assessment: QtiAssessmentTest = {
  outcomeProcessing: {
    template: 'pass_fail'
  },
  testFeedback: [
    {
      identifier: 'pass-feedback',
      outcomeIdentifier: 'PASSED',
      showHide: 'show', // Show when PASSED is true
      access: 'atEnd',
      content: '<p>Congratulations! You passed the test.</p>'
    },
    {
      identifier: 'fail-feedback',
      outcomeIdentifier: 'PASSED',
      showHide: 'hide', // Show when PASSED is false
      access: 'atEnd',
      content: '<p>Unfortunately, you did not pass. Please review the material and try again.</p>'
    }
  ]
};

// After submission
const feedback = player.getVisibleFeedback();
for (const fb of feedback) {
  console.log('Feedback:', fb.content);
}
```

### Custom Outcome Processing

The four standard templates (total_score, weighted_score, percentage_score, pass_fail) cover 95%+ of real-world assessment needs. For advanced custom scoring logic, you can provide your own outcome processor:

```typescript
import { OutcomeProcessor, AssessmentPlayer } from '@pie-qti/qti2-assessment-player';
import type { AssessmentPlayerConfig } from '@pie-qti/qti2-assessment-player';

// Option 1: Extend the built-in OutcomeProcessor
class CustomOutcomeProcessor extends OutcomeProcessor {
  processResults(itemResults) {
    // Call parent to get standard scoring
    const results = super.processResults(itemResults);

    // Add your custom logic
    // Example: Bonus points for perfect scores
    const perfectCount = itemResults.filter(r => r.score === r.maxScore).length;
    results.outcomes.SCORE += perfectCount * 5; // 5 bonus points per perfect item
    results.outcomes.BONUS_POINTS = perfectCount * 5;

    return results;
  }
}

// Option 2: Implement your own from scratch
class AdvancedOutcomeProcessor {
  constructor(assessment) {
    this.assessment = assessment;
  }

  processResults(itemResults) {
    // Your completely custom scoring logic
    // Must return an AssessmentResults object
    return {
      outcomes: {
        SCORE: /* your calculation */,
        MAXSCORE: /* your calculation */,
        // ... any custom outcome variables
      },
      feedback: []
    };
  }

  getVisibleFeedback() {
    // Return feedback based on outcomes
    return [];
  }
}

// Use your custom processor
const config: AssessmentPlayerConfig = {
  assessment,
  outcomeProcessor: new CustomOutcomeProcessor(assessment),
  // ... other config
};

const player = new AssessmentPlayer(config);
```

**Note:** The player does NOT include a full QTI rule interpreter for complex `setOutcomeValue`, `responseCondition`, etc. This is an intentional design decision to avoid unnecessary complexity. The pluggable outcome processor architecture allows you to implement any custom scoring logic you need while keeping the core framework simple and maintainable.

### Scoring Use Cases

#### 1. Simple Quiz

```typescript
// Just sum the scores
outcomeProcessing: { template: 'total_score' }
```

#### 2. Weighted Exam

```typescript
// Essay questions worth more than multiple choice
outcomeProcessing: { template: 'weighted_score' }
// Set weight: 5 on essay questionRefs, weight: 1 on MC
```

#### 3. Pass/Fail Certification

```typescript
// Must score 80% to pass
outcomeDeclarations: [
  { identifier: 'PASSING_THRESHOLD', baseType: 'float', cardinality: 'single', defaultValue: 0.8 }
],
outcomeProcessing: { template: 'pass_fail' }
```

#### 4. Grade Levels

```typescript
// Use percentage_score and map to letter grades in your app
outcomeProcessing: { template: 'percentage_score' }
// Then: A = 90-100, B = 80-89, etc.
```

#### 5. Adaptive Feedback

```typescript
// Show different feedback based on score ranges
testFeedback: [
  { outcomeIdentifier: 'HIGH_SCORE', showHide: 'show', content: 'Excellent work!' },
  { outcomeIdentifier: 'MEDIUM_SCORE', showHide: 'show', content: 'Good effort!' },
  { outcomeIdentifier: 'LOW_SCORE', showHide: 'show', content: 'Keep practicing!' }
]
```

## Components

### AssessmentShell

Main component that orchestrates the entire assessment experience.

**Props:**
- `assessment: QtiAssessmentTest` - The assessment data
- `config?: AssessmentPlayerConfig` - Configuration options

### NavigationBar

Navigation controls with progress indicator.

**Props:**
- `navState: NavigationState` - Current navigation state
- `onPrevious?: () => void` - Previous button handler
- `onNext?: () => void` - Next button handler
- `onSubmit?: () => void` - Submit button handler
- `showProgress?: boolean` - Show progress bar (default: true)

### SectionMenu

Dropdown menu for section navigation.

**Props:**
- `sections: Section[]` - List of sections
- `currentSectionIndex?: number` - Active section index
- `onSectionSelect?: (index: number) => void` - Section selection handler
- `disabled?: boolean` - Disable navigation

### RubricDisplay

Displays rubric blocks (passages, instructions).

**Props:**
- `blocks: RubricBlock[]` - Array of rubric blocks
- `collapsed?: boolean` - Initial collapsed state

### ItemRenderer

Renders individual QTI items within the assessment.

**Props:**
- `questionRef: QuestionRef` - Question reference with item XML
- `role?: QTIRole` - QTI 2.x standard role (default: 'candidate')
- `extendedTextEditor?: 'tiptap' | 'textarea'` - Editor type for extended text
- `responses?: Record<string, unknown>` - Response data
- `onResponseChange?: (responseId: string, value: unknown) => void` - Response handler

## Navigation Modes

### Linear Navigation

Sequential navigation only. Students must proceed through items in order but can review previous items.

```typescript
{
	navigationMode: 'linear'
}
```

### Nonlinear Navigation

Free navigation. Students can jump to any item at any time.

```typescript
{
	navigationMode: 'nonlinear'
}
```

## Events

```typescript
player.onItemChange((index, total) => {
	console.log(`Item ${index + 1} of ${total}`);
});

player.onSectionChange((sectionIndex, totalSections) => {
	console.log(`Section ${sectionIndex + 1} of ${totalSections}`);
});

player.onResponseChange((responses) => {
	console.log('Responses:', responses);
});

player.onComplete(() => {
	console.log('Assessment completed!');
});
```

## State Management

Save and restore assessment state for continuity:

```typescript
// Save state
const state = player.getState();
localStorage.setItem('assessment-state', JSON.stringify(state));

// Restore state
const savedState = JSON.parse(localStorage.getItem('assessment-state'));
player.restoreState(savedState);
```

## Styling

Components use DaisyUI classes and can be styled with Tailwind CSS or custom CSS variables.

## Development

```bash
# Build
bun run build

# Watch mode
bun run dev

# Type check
bun run typecheck

# Lint
bun run lint
```

## License

MIT
