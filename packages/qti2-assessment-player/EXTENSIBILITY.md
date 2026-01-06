# Assessment Player Extensibility Analysis

This document evaluates the current extensibility mechanisms and proposes potential enhancements for the QTI 2.2 Assessment Player.

## Current Extensibility Points

### 1. **Interaction Rendering (Item Player Level)** ✅ IMPLEMENTED

**Mechanism**: Item-player plugins + registries (`QTIPlugin`, `ComponentRegistry`, `ExtractionRegistry`)

**What can be extended**:
- Custom renderers for any QTI interaction type
- Override default rendering behavior
- Add support for custom interactions

**Example**: Provide a `QTIPlugin` to the underlying item player to register custom extractors and/or custom web components.

**Strengths**:
- Simple, proven pattern (Map-based lookup)
- No over-engineering
- Well-documented in PLUGGABILITY.md
- Works seamlessly across item and assessment players

### 2. **Event Listeners (Assessment Player Level)** ✅ IMPLEMENTED

**Mechanism**: Event listener pattern with unsubscribe functions

**Available Events**:
- `onItemChange(index, total)` - Item navigation
- `onSectionChange(index, total)` - Section navigation
- `onResponseChange(responses)` - Response updates
- `onComplete()` - Assessment completion
- `onTimeWarning(remainingSeconds)` - Time warning threshold
- `onTimeExpired()` - Time limit reached
- `onTimeTick(remaining, elapsed)` - Timer updates (every second)
- `onStateSaved(timestamp)` - State persistence
- `onStateRestored(timestamp)` - State restoration

**Example**:
```typescript
const player = new AssessmentPlayer({ assessment });

// Subscribe to events
const unsubscribe = player.onItemChange((index, total) => {
  console.log(`Navigated to item ${index + 1} of ${total}`);
});

// Unsubscribe when done
unsubscribe();
```

**Strengths**:
- Clean unsubscribe pattern
- Multiple listeners per event
- No memory leaks

### 3. **Configuration Callbacks** ✅ IMPLEMENTED

**Mechanism**: Optional callback functions in `AssessmentPlayerConfig`

**Available Callbacks**:
- `onItemChange(index, total)` - Single callback (simpler than listener)
- `onSectionChange(index, total)`
- `onResponseChange(responses)`
- `onComplete()`
- `onStateSaved(timestamp)`
- `onStateRestored(timestamp)`

**Note**: Config callbacks are simpler for single handlers, event listeners better for multiple subscribers.

### 4. **State Persistence Backend** ✅ IMPLEMENTED

**Mechanism**: `onBackendSave` callback in `PersistenceConfig`

**Example**:
```typescript
const persistenceManager = new StatePersistenceManager({
  sessionId: 'session-123',
  assessmentId: 'assessment-456',
  onBackendSave: async (state: PersistableState) => {
    await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(state)
    });
  },
  onSaveSuccess: (state) => console.log('Saved'),
  onSaveError: (error) => console.error('Save failed', error)
});
```

**Strengths**:
- Optional (client-side by default)
- Graceful fallback to localStorage
- Clear separation of concerns

### 5. **Extended Text Editor** ✅ IMPLEMENTED

**Mechanism**: `extendedTextEditor` config option

**Options**:
- `'tiptap'` - Rich text with math support
- `'textarea'` - Lightweight plain text

**Extensibility**: Could be enhanced to accept custom editor factory.

---

## Potential Extensibility Gaps & Proposals

### Gap 1: **Custom Navigation Logic** ⚠️ LIMITED

**Current State**: Navigation controlled by `NavigationManager` (linear/nonlinear modes only)

**Use Cases That Can't Be Addressed**:
- Adaptive assessments (branch based on performance)
- Prerequisite items (must complete A before accessing B)
- Content-based branching (different paths based on responses)
- Custom navigation rules

**Proposal**: Navigation hooks or strategy pattern

```typescript
interface NavigationStrategy {
  canNavigateTo(fromIndex: number, toIndex: number, context: NavigationContext): boolean;
  getNextIndex(currentIndex: number, context: NavigationContext): number | null;
  getPreviousIndex(currentIndex: number, context: NavigationContext): number | null;
  getAvailableItems(currentIndex: number, context: NavigationContext): number[];
}

interface NavigationContext {
  responses: Record<string, unknown>;
  itemResults: Map<string, ItemResult>;
  visitedItems: number[];
  assessment: QtiAssessmentTest;
}

// Usage
const player = new AssessmentPlayer({
  assessment,
  navigationStrategy: new AdaptiveNavigationStrategy({
    branchingRules: [
      { ifScore: '>= 80%', then: 'skip-remedial-items' },
      { ifScore: '< 50%', then: 'require-tutorial' }
    ]
  })
});
```

**Priority**: Medium (branching is Priority 7 in approved list)

### Gap 2: **Scoring Plugins** ⚠️ LIMITED

**Current State**: Basic scoring via `calculateItemScore()` and `calculateMaxScore()` methods

**Use Cases That Can't Be Addressed**:
- Custom scoring algorithms
- Partial credit strategies
- IRT-based scoring
- Complex rubric scoring
- Portfolio scoring across items

**Proposal**: Scoring strategy interface

```typescript
interface ScoringStrategy {
  scoreItem(responses: InteractionResponse, correctResponses: any, itemXml: string): ItemScore;
  scoreAssessment(itemResults: ItemResult[], assessment: QtiAssessmentTest): AssessmentScore;
  calculatePartialCredit?(responses: any, expected: any): number;
}

interface ItemScore {
  score: number;
  maxScore: number;
  feedback?: string;
  details?: any;
}

// Usage
const player = new AssessmentPlayer({
  assessment,
  scoringStrategy: new IRT_ScoringStrategy({
    model: '3PL',
    calibration: itemCalibrationData
  })
});
```

**Priority**: Medium-High (detailed scoring is Priority 5)

### Gap 3: **Feedback Rendering** ⚠️ LIMITED

**Current State**: Basic feedback display in item player, assessment-level feedback not implemented

**Use Cases That Can't Be Addressed**:
- Custom feedback templates
- Conditional feedback based on performance
- Rich media feedback (video, interactive)
- Personalized feedback messages
- Feedback localization

**Proposal**: Feedback renderer interface

```typescript
interface FeedbackRenderer {
  renderItemFeedback(result: ItemResult, container: HTMLElement): void;
  renderAssessmentFeedback(results: AssessmentResults, container: HTMLElement): void;
  renderConditionalFeedback(condition: string, content: string, container: HTMLElement): void;
}

// Usage
const player = new AssessmentPlayer({
  assessment,
  feedbackRenderer: new CustomFeedbackRenderer({
    template: 'detailed',
    includeCorrectAnswers: true,
    showExplanations: true
  })
});
```

**Priority**: Medium (assessment feedback is Priority 6)

### Gap 4: **Selection & Ordering Rules** ❌ NOT IMPLEMENTED

**Current State**: Not implemented (static item lists only)

**Use Cases That Can't Be Addressed**:
- Random item pools
- Item bank sampling
- Shuffle items/sections
- Fixed vs. random positioning
- Stratified sampling

**Proposal**: Implementation of QTI selection/ordering rules

```typescript
// This should be implemented per QTI 2.2 spec, not as a plugin
interface SelectionRule {
  select: number;
  withReplacement?: boolean;
  fromBank?: string;
}

interface OrderingRule {
  shuffle?: boolean;
  fixed?: string[]; // Item IDs that should not be shuffled
}

// Already defined in types, needs implementation in SectionManager
```

**Priority**: High (Priority 4 in approved list)

### Gap 5: **Time Management Hooks** ✅ MOSTLY COVERED

**Current State**: Callbacks for warnings, expiration, ticks

**Potential Enhancement**: Pause/resume hooks

```typescript
interface TimeManagementHooks {
  onPause?: () => void;
  onResume?: () => void;
  onTimeAdjustment?: (adjustment: number) => void; // For accommodations
}
```

**Priority**: Low (current implementation is sufficient)

### Gap 6: **Custom Item Loading** ⚠️ LIMITED

**Current State**: Items loaded via `itemXml` property in `QuestionRef`

**Use Cases That Can't Be Addressed**:
- Lazy loading from server
- Item encryption/decryption
- Dynamic item generation
- Item caching strategies

**Proposal**: Item loader interface

```typescript
interface ItemLoader {
  loadItem(itemRef: QuestionRef): Promise<string>; // Returns itemXml
  preloadItems?(itemRefs: QuestionRef[]): Promise<void>;
  cacheStrategy?: 'eager' | 'lazy' | 'on-demand';
}

// Usage
const player = new AssessmentPlayer({
  assessment,
  itemLoader: new RemoteItemLoader({
    baseUrl: '/api/items',
    cache: true,
    decrypt: true
  })
});
```

**Priority**: Low (current approach works, optimization not critical)

### Gap 7: **Validation Hooks** ⚠️ LIMITED

**Current State**: Basic validation in `ItemSessionController.validateItem()`

**Use Cases That Can't Be Addressed**:
- Custom validation rules per interaction
- Cross-item validation
- Business logic validation
- Custom error messages

**Proposal**: Validation strategy interface

```typescript
interface ValidationStrategy {
  validateResponse(responseId: string, value: unknown, context: ValidationContext): ValidationResult;
  validateItem(responses: InteractionResponse, context: ValidationContext): ValidationResult;
  validateBeforeNavigation?(fromIndex: number, toIndex: number): ValidationResult;
}

interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Usage
const player = new AssessmentPlayer({
  assessment,
  validationStrategy: new CustomValidationStrategy({
    rules: {
      'RESPONSE_1': [required(), minLength(10), noHTML()],
      'RESPONSE_2': [required(), isNumber(), range(0, 100)]
    }
  })
});
```

**Priority**: Low-Medium (current validation works for standard cases)

### Gap 8: **UI Component Customization** ⚠️ LIMITED

**Current State**: Svelte components can be imported and used, but no composition/override mechanism

**Use Cases That Can't Be Addressed**:
- Custom progress indicator
- Custom navigation bar
- Custom section menu
- Custom timer display
- Custom rubric display

**Proposal**: Component slot system (Svelte-specific)

```svelte
<AssessmentShell {assessment} {config}>
  <!-- Custom navigation -->
  <svelte:fragment slot="navigation">
    <MyCustomNavigationBar {navState} />
  </svelte:fragment>

  <!-- Custom timer -->
  <svelte:fragment slot="timer">
    <MyCustomTimer remaining={remainingTime} />
  </svelte:fragment>

  <!-- Custom progress -->
  <svelte:fragment slot="progress">
    <MyCustomProgressBar current={currentIndex} total={totalItems} />
  </svelte:fragment>
</AssessmentShell>
```

**Alternative**: Export components separately (already done)

```svelte
<script>
  import { ItemRenderer, RubricDisplay } from '@pie-framework/qti2-assessment-player/components';
  // Build custom layout
</script>

<div class="my-layout">
  <RubricDisplay {blocks} />
  <ItemRenderer {player} />
  <MyCustomNavigation />
</div>
```

**Priority**: Low (current approach allows full customization, just requires manual composition)

### Gap 9: **Accessibility Hooks** ⚠️ LIMITED

**Current State**: Basic accessibility in components, no hooks for customization

**Use Cases That Can't Be Addressed**:
- Screen reader announcements
- Keyboard navigation customization
- Focus management
- Alternative input methods
- Assistive technology integration

**Proposal**: Accessibility adapter interface

```typescript
interface AccessibilityAdapter {
  announceNavigation(fromIndex: number, toIndex: number): void;
  announceTimeWarning(remainingSeconds: number): void;
  announceValidationError(error: string): void;
  configureFocusManagement?(): FocusConfig;
  configureKeyboardNav?(): KeyboardConfig;
}

// Usage
const player = new AssessmentPlayer({
  assessment,
  accessibilityAdapter: new ScreenReaderAdapter({
    verbosity: 'detailed',
    announceAll: true
  })
});
```

**Priority**: Medium (important for compliance, but can be added incrementally)

### Gap 10: **Analytics & Telemetry** ❌ NOT IMPLEMENTED

**Current State**: No built-in analytics

**Use Cases That Can't Be Addressed**:
- Response time tracking
- Interaction patterns
- Performance metrics
- Engagement analytics
- Completion funnels

**Proposal**: Analytics adapter interface

```typescript
interface AnalyticsAdapter {
  trackItemView(itemIndex: number, itemIdentifier: string): void;
  trackResponseChange(responseId: string, value: unknown, timeSpent: number): void;
  trackItemSubmit(result: ItemResult, attempts: number): void;
  trackNavigationEvent(from: number, to: number, direction: 'next' | 'previous' | 'jump'): void;
  trackTimeEvent(event: 'warning' | 'expired' | 'pause' | 'resume'): void;
  trackStateEvent(event: 'saved' | 'restored' | 'cleared'): void;
}

// Usage
const player = new AssessmentPlayer({
  assessment,
  analyticsAdapter: new GoogleAnalyticsAdapter({
    trackingId: 'UA-XXXXX-Y',
    userId: 'candidate-123'
  })
});
```

**Priority**: Low-Medium (useful but not critical, can be implemented via existing event listeners)

---

## Summary & Recommendations

### ✅ Well-Covered Extensibility Areas

1. **Interaction Rendering** - Excellent via item-player plugins + registries
2. **Event Listening** - Comprehensive event system
3. **State Persistence** - Clean backend integration
4. **Time Management** - Good callback coverage

### ⚠️ Areas Needing Enhancement

1. **Navigation Logic** (for branching) - Priority: Medium
2. **Scoring Strategies** - Priority: Medium-High
3. **Feedback Rendering** - Priority: Medium
4. **Validation Strategies** - Priority: Low-Medium
5. **Accessibility** - Priority: Medium

### ❌ Missing Features (Not Extensibility Issues)

1. **Selection & Ordering Rules** - Priority: HIGH (implement per QTI spec)
2. **Assessment-level Feedback** - Priority: Medium (implement per QTI spec)

### Recommended Approach

**Phase 1: Complete QTI 2.2 Core Features** (Current Priority)
- Implement selection & ordering rules (Priority 4)
- Implement detailed scoring (Priority 5)
- Implement assessment feedback (Priority 6)
- Consider branching (Priority 7)

**Phase 2: Add Strategic Extension Points** (Future)
- Scoring strategy interface (if detailed scoring reveals need)
- Navigation strategy interface (if branching reveals need)
- Feedback renderer interface (if assessment feedback reveals need)

**Phase 3: Add Nice-to-Have Extensions** (Future)
- Validation strategy interface
- Accessibility adapter interface
- Analytics adapter interface
- Item loader interface

### Design Philosophy

The current extensibility approach is **excellent** and follows best practices:

1. ✅ **Simple registries** - Not over-engineered plugin systems
2. ✅ **Event listeners** - Standard observer pattern
3. ✅ **Optional callbacks** - Clean integration points
4. ✅ **Component exports** - Svelte composition
5. ✅ **Sensible defaults** - Works out of the box

**Recommendation**: Don't add extension points until there's a proven need. The current approach allows most customizations through:
- Event listeners (for observing behavior)
- Item player plugins/registries (for custom extraction/rendering)
- Component composition (for custom UI)
- Callbacks (for backend integration)

This is **sufficient for 95% of use cases**.

### Anti-Patterns to Avoid

❌ **Don't create**:
- Abstract factory patterns
- Plugin lifecycle systems
- Event buses
- Middleware chains
- Dependency injection containers
- Over-abstracted interfaces

✅ **Keep it simple**:
- Map-based registries
- Direct function callbacks
- Event listener pattern
- Component composition
- Optional strategies

---

## Conclusion

The current extensibility mechanisms are **well-designed and sufficient** for most use cases. Before adding new extension points:

1. **Complete the core QTI 2.2 features** (Priorities 4-7)
2. **Evaluate real-world usage** - Do users actually need these extensions?
3. **Start with examples** - Show how to achieve goals with current APIs
4. **Add extension points incrementally** - Only when proven necessary

The priority should be:
1. ✅ **Core QTI functionality** (selection, ordering, feedback)
2. ⏸️ **Strategic extensions** (only if needed after core complete)
3. ⏸️ **Nice-to-have extensions** (only if requested by users)
