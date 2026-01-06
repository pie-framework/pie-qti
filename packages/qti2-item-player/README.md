# @pie-qti/qti2-item-player

A modern, QTI 2.x compliant assessment item player with role-based rendering and optional backend scoring support.

## Features

- ✅ **21 QTI Interaction Types Supported** - All QTI 2.2 interactions
- ✅ **QTI 2.x Standard Roles** - Candidate, scorer, author, tutor, proctor, testConstructor
- ✅ **Adaptive Items** - Multi-attempt workflow with progressive feedback
- ✅ **Full Keyboard Accessibility** (follows WCAG 2.2 Level AA guidelines)
- ✅ **Client-Side Response Processing** with 45/45 QTI operators
- ✅ **Framework-Agnostic Core** with a **Web Component interaction layer** (default implementations authored in Svelte)
- ✅ **TypeScript** with full type definitions
- ✅ **Minimal Dependencies** (node-html-parser for XML parsing)
- ✅ **Iframe mode (reference)** - Optional host helper + postMessage protocol for iframe-isolated deployments

## Installation

```bash
bun add @pie-qti/qti2-item-player
```

Alternatively:

```bash
npm install @pie-qti/qti2-item-player
```

## Quick Start

### Core Player (Framework-Agnostic)

```typescript
import { Player } from '@pie-qti/qti2-item-player';

// Load QTI XML with role
const qtiXml = `<assessmentItem ...>...</assessmentItem>`;
const player = new Player({
  itemXml: qtiXml,
  role: 'candidate' // QTI 2.x standard role
});

// Get interactions
const interactions = player.getInteractions();
// [{ type: 'choiceInteraction', responseIdentifier: 'RESPONSE', element: ... }]

// Set response
player.setResponse('RESPONSE', 'A');

// Score the item
const result = player.score();
console.log(result.score); // 0.0 to 1.0
console.log(result.outcomes); // { SCORE: 1.0, ... }
```

### Iframe mode (optional, reference)

For deployments that need stronger isolation for **untrusted** QTI, you can run the player inside an iframe and communicate via a versioned `postMessage` protocol.

- Docs: `docs/iframe-mode.md`
- Import: `@pie-qti/qti2-item-player/iframe` (browser-only)

## QTI 2.x Standard Roles

The player implements QTI 2.x standard roles to control rendering behavior:

| Role | Behavior |
|------|----------|
| `candidate` | Test-taker - inputs editable, no correct answers shown |
| `scorer` | Grader - inputs readonly, correct answers shown |
| `author` | Content author - inputs readonly, correct answers shown |
| `tutor` | Instructional mode - inputs readonly, correct answers shown |
| `proctor` | Test administrator - inputs readonly, limited feedback |
| `testConstructor` | Test developer - inputs readonly, correct answers shown |

### Role-Based Rendering

```typescript
// For test-takers (editable inputs)
const player = new Player({
  itemXml: qtiXml,
  role: 'candidate'
});

// For grading/review (readonly, show answers)
const player = new Player({
  itemXml: qtiXml,
  role: 'scorer'
});

// For instructional use (readonly, show answers)
const player = new Player({
  itemXml: qtiXml,
  role: 'tutor'
});
```

## Supported Interaction Types

| QTI Type | Component | Description |
|----------|-----------|-------------|
| `choiceInteraction` | Built-in | Single/multiple choice |
| `textEntryInteraction` | Built-in | Short text input |
| `extendedTextInteraction` | Built-in | Long-form text (essay) |
| `inlineChoiceInteraction` | `InlineInteractionRenderer` | Dropdown in text |
| `orderInteraction` | `SortableList` | Drag to reorder items |
| `matchInteraction` | `MatchDragDrop` | Match items between sets |
| `associateInteraction` | - | Create associations |
| `gapMatchInteraction` | - | Drag items into text gaps |
| `graphicGapMatchInteraction` | `GraphicGapMatch` | Drag labels onto image hotspots |
| `sliderInteraction` | Built-in | Slider input |
| `hotspotInteraction` | - | Click regions on image |
| `uploadInteraction` | `FileUpload` | Upload a file response |
| `drawingInteraction` | `DrawingCanvas` | Draw/annotate on a canvas |
| `customInteraction` | `CustomInteractionFallback` | Fallback display + optional manual response |

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────┐
│  Interaction UI (Web Components)        │
│  - default implementations authored in  │
│    Svelte (`@pie-qti/qti2-default-components`) │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Extraction                              │
│  - Player.getInteractionData()           │
│  - ExtractionRegistry + extractors       │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Core Player (Framework-Agnostic)       │
│  - XML parsing                           │
│  - Response processing                   │
│  - Scoring engine                        │
│  - Role-based behavior                   │
└─────────────────────────────────────────┘
```

## API Reference

### Player Class

```typescript
interface PlayerConfig {
  itemXml: string;
  role?: QTIRole; // 'candidate' | 'scorer' | 'author' | 'tutor' | 'proctor' | 'testConstructor'
  componentRegistry?: ComponentRegistry; // Custom web component registry
  extractionRegistry?: ExtractionRegistry; // Custom extractors
  plugins?: QTIPlugin[]; // Plugin-based extension point
}

class Player {
  constructor(config: PlayerConfig)

  // Get all interactions in the item
  getInteractions(): Array<{
    type: string;
    responseIdentifier: string;
    element: HTMLElement;
  }>

  // Get extracted interaction data (recommended API for UIs)
  getInteractionData(): InteractionData[]

  // Set a response value
  setResponse(identifier: string, value: any): void

  // Get a response value
  getResponse(identifier: string): any

  // Execute response processing and calculate score
  score(): {
    score: number;        // 0.0 to 1.0
    outcomes: Record<string, any>;
    completed: boolean;
  }

  // Get item body HTML
  getItemBodyHtml(): string

  // Get rubric blocks for current role
  getRubricBlocks(): RubricBlock[]
}
```

### Component Props

#### SortableList

```typescript
interface Props {
  items: Array<{ id: string; text: string }>;
  orderedIds: string[];
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  onReorder: (newOrder: string[]) => void;
}
```

#### MatchDragDrop

```typescript
interface Props {
  sourceSet: Array<{ identifier: string; text: string }>;
  targetSet: Array<{ identifier: string; text: string }>;
  pairs: string[]; // "sourceId targetId"
  disabled?: boolean;
  onPairsChange: (newPairs: string[]) => void;
}
```

#### GraphicGapMatch

```typescript
interface Props {
  gapTexts: Array<{ identifier: string; text: string; matchMax: number }>;
  hotspots: Array<{ identifier: string; shape: string; coords: string; matchMax: number }>;
  pairs: string[]; // "gapTextId hotspotId"
  imageData: { type: 'svg' | 'image'; content?: string; src?: string; width: string; height: string };
  disabled?: boolean;
  onPairsChange: (newPairs: string[]) => void;
}
```

## Extensibility

Use plugins/registries (`QTIPlugin`, `ExtractionRegistry`, `ComponentRegistry`) to support vendor extensions or custom rendering.

**Important**: interaction implementations are treated as **web components** by the player. The player creates elements by tag name and communicates via **standard properties** + the bubbling `qti-change` event. Svelte is an implementation detail of the default component package, not a requirement.

For details, see [PLUGGABILITY.md](PLUGGABILITY.md).

## Adaptive Items

The player fully supports QTI 2.2 adaptive items with multi-attempt workflows:

### Basic Adaptive Item

```typescript
import { Player } from '@pie-qti/qti2-item-player';

const player = new Player({
  itemXml: qtiXml, // With adaptive="true"
  role: 'candidate'
});

// Check if item is adaptive
if (player.isAdaptive()) {
  // Submit first attempt
  player.setResponses({ RESPONSE: 'A' });
  const result = player.submitAttempt();

  console.log(result.numAttempts);      // 1
  console.log(result.completionStatus); // 'unknown' or 'completed'
  console.log(result.canContinue);      // true (if not completed)
  console.log(result.modalFeedback);    // Progressive feedback/hints

  // Continue submitting until completed
  while (!player.isCompleted()) {
    player.setResponses({ RESPONSE: nextGuess });
    const nextResult = player.submitAttempt();
    // Show feedback, allow retry
  }
}
```

### Hint Buttons (countAttempt="false")

Adaptive items can have hint buttons that don't increment the attempt counter:

```xml
<endAttemptInteraction responseIdentifier="HINT"
                      title="Request Hint"
                      countAttempt="false"/>
```

```typescript
// Click hint button (doesn't increment attempts)
player.setResponses({ HINT: true });
const hint = player.submitAttempt(false); // Pass false for countAttempt
console.log(hint.numAttempts); // Unchanged
console.log(hint.modalFeedback); // Hint content
```

### Progressive Feedback Example

```xml
<assessmentItem identifier="adaptive-item" adaptive="true">
  <!-- ... interactions ... -->

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <!-- First attempt: encourage -->
        <lt>
          <variable identifier="numAttempts"/>
          <baseValue baseType="integer">2</baseValue>
        </lt>
        <setOutcomeValue identifier="FEEDBACK">
          <baseValue baseType="identifier">tryagain</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <!-- Second+ attempt: show answer -->
        <setOutcomeValue identifier="FEEDBACK">
          <baseValue baseType="identifier">answer</baseValue>
        </setOutcomeValue>
        <setOutcomeValue identifier="completionStatus">
          <baseValue baseType="identifier">completed</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>

  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="tryagain" showHide="show">
    <p>Try again! You have one more attempt.</p>
  </modalFeedback>

  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="answer" showHide="show">
    <p>The correct answer is C. Here's why...</p>
  </modalFeedback>
</assessmentItem>
```

### API Methods

| Method                                                           | Description                               |
| ---------------------------------------------------------------- | ----------------------------------------- |
| `isAdaptive(): boolean`                                          | Check if item has `adaptive="true"`       |
| `isCompleted(): boolean`                                         | Check if `completionStatus="completed"`   |
| `getNumAttempts(): number`                                       | Get current attempt count                 |
| `submitAttempt(countAttempt?: boolean): AdaptiveAttemptResult`   | Submit attempt with optional counting     |

For complete documentation, see [ADAPTIVE-ITEMS-DESIGN.md](ADAPTIVE-ITEMS-DESIGN.md).

## Accessibility

All components follow WCAG 2.2 Level AA guidelines:

- ✅ **Full keyboard navigation** (Tab, Space, Enter, Arrow keys, Escape)
- ✅ **Screen reader support** with ARIA labels and live regions
- ✅ **Focus management** with visible indicators
- ✅ **Alternative to drag-and-drop** for all interactions

### Keyboard Shortcuts

| Component | Keys | Action |
|-----------|------|--------|
| SortableList | Space/Enter | Grab/drop item |
| | Arrow keys | Move grabbed item |
| | Escape | Cancel |
| MatchDragDrop | Space/Enter | Select source |
| | Tab → Space/Enter | Match to target |
| GraphicGapMatch | Space/Enter | Select label |
| | Tab → Space/Enter | Place on hotspot |

For detailed accessibility analysis, see [WCAG-2.2-COMPLIANCE.md](docs/WCAG-2.2-COMPLIANCE.md).

## Backend Scoring (Optional)

The player supports optional backend scoring for items that require server-side processing:

```typescript
// Check if backend scoring is available
if (player.getItemAttribute('adaptive') === 'true') {
  // Send to backend for scoring
  const response = await fetch('/api/score', {
    method: 'POST',
    body: JSON.stringify({
      itemId: 'item-123',
      responses: player.getAllResponses()
    })
  });

  const result = await response.json();
  // Apply backend scores
  player.applyOutcomes(result.outcomes);
}
```

For details, see [SERVER-API.md](SERVER-API.md).

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint
```

## License

ISC

## Related Packages

- [@pie-qti/qti2-assessment-player](../qti2-assessment-player) - Multi-item test player
- [@pie-qti/qti2-player-elements](../qti2-player-elements) - Web components
- [@pie-qti/qti2-example](../qti2-example) - Demo application
- [@pie-qti/qti2-to-pie](../qti2-to-pie) - QTI to PIE transformer

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Resources

- [QTI 2.x Specification](http://www.imsglobal.org/question/qtiv2p2/imsqti_v2p2.html)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [PIE Framework](https://github.com/pie-framework)
