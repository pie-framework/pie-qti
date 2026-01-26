# QTI 3.0 Code Reusability Analysis

**Summary:** You can reuse **60-70%** of the PIE-QTI codebase for QTI 3.0 support, with the core processing engine being highly reusable but UI components and transformers requiring significant rework.

---

## Quick Answer by Layer

| Layer | Reusability | What Can Be Reused | What Needs Rewriting |
|-------|-------------|-------------------|---------------------|
| **Processing Engine** | 90-100% | ✅ All 45+ operators<br>✅ AST evaluator<br>✅ Runtime types<br>⚠️ Element name matching needs parameterization | Element name matching (1000 lines) |
| **Transform Framework** | 95-100% | ✅ Plugin architecture<br>✅ Registry<br>✅ Orchestration | Specific QTI 2→PIE/PIE→QTI 2 plugins (~4000 lines) |
| **Assessment Player** | 85-90% | ✅ Navigation logic<br>✅ Session management<br>✅ Timing<br>✅ State persistence | Switch to QTI 3 item player |
| **Utilities** | 95-100% | ✅ Sanitization<br>✅ URL policy<br>✅ Performance monitoring | None |
| **UI Components** | 20-30% | ✅ Component architecture<br>✅ Registry pattern | 21 new extractors (~3000 lines)<br>All interaction components |
| **Transformation Plugins** | 5-10% | ✅ Plugin structure | 30+ new transformers (~4000 lines) |

---

## Detailed Breakdown

### 1. Core Processing Engine (qti-processing package) - **90-100% Reusable**

#### ✅ Fully Reusable Without Changes

**Response Processing Operators** - All 45+ operators work identically:
- Mathematical: `sum`, `product`, `divide`, `power`, `mod`, etc.
- Logical: `and`, `or`, `not`, `match`, `equal`, `member`, etc.
- Statistical: `mean`, `sampleVariance`, `sampleSD`, `popVariance`, etc.
- String: `substring`, `stringMatch`, `patternMatch`
- Container: `ordered`, `multiple`, `index`, `delete`, etc.

**Why reusable:** Operators work on abstract `QtiValue` types with no version-specific logic.

```typescript
// Example: sum operator - works for both QTI 2.x and 3.0
function sumOperator(values: QtiValue[]): QtiValue {
  // Pure data transformation, no element name dependencies
  return values.reduce((acc, val) => acc + toNumber(val), 0);
}
```

**Runtime Type System** - 100% compatible:
- `BaseType` enum (identifier, boolean, integer, float, string, etc.)
- `Cardinality` enum (single, multiple, ordered, record)
- Value coercion and declaration context
- Variable resolution

**XML Traversal Utilities** - Already namespace-aware:
```typescript
// Uses localName instead of tagName - works with any namespace
childElements(element)
findDescendants(element, predicate)
getAttr(element, name)
```

#### ⚠️ Needs Parameterization (~1000 lines)

**AST Building** - Currently hardcodes QTI 2.x element names:

```typescript
// Current approach (QTI 2.x)
const tag = (localName(el) || '').toLowerCase();
switch (tag) {
  case 'choiceinteraction':      // QTI 2.x camelCase
  case 'responseprocessing':
  case 'setoutcomevalue':
  // ...
}
```

**Required change:** Add element name mapper abstraction:

```typescript
// Proposed for multi-version support
interface ElementNameMapper {
  normalize(elementName: string): string;
  // QTI 2.x: 'choiceInteraction' → 'choiceInteraction'
  // QTI 3.0: 'choice-interaction' → 'choiceInteraction'
}

const tag = mapper.normalize(localName(el) || '');
switch (tag) {
  case 'choiceInteraction':  // Normalized semantic name
  // Works for both versions
}
```

**Effort:** 2-3 weeks to add abstraction layer and update AST builder.

---

### 2. Transform Framework (core package) - **95-100% Reusable**

#### ✅ Entire Architecture Reusable

The transform engine is **completely format-agnostic**:

```typescript
// Plugin interface uses string format identifiers
interface TransformPlugin {
  id: string;
  sourceFormat: string;  // e.g., 'qti22', 'qti30', 'pie'
  targetFormat: string;
  canHandle(content: string, options: Options): boolean;
  transform(content: string, options: Options): Promise<Result>;
}

// Registry supports any format combination
engine.registerPlugin(qti22ToPiePlugin);
engine.registerPlugin(qti30ToPiePlugin);  // Just add new plugin
engine.registerPlugin(pieToQti30Plugin);
```

**Priority-based plugin selection** means QTI 2.x and 3.0 plugins can coexist peacefully.

#### ❌ Transformation Plugins Need Rewriting (~4000 lines)

While the **framework** is reusable, the **specific plugins** are not:

**to-pie plugin** - Hardcoded for QTI 2.x:
```typescript
// transformers/multiple-choice.ts
const choiceInteraction = itemBody.querySelector('choiceInteraction');  // QTI 2.x name
const simpleChoices = utils.getChildrenByTag(element, 'simpleChoice');  // QTI 2.x
const maxChoices = parseInt(choiceInteraction.getAttribute('maxChoices'), 10);  // camelCase
```

**qti3-to-pie plugin** - Would need QTI 3.0 equivalents:
```typescript
// New transformer for QTI 3.0
const choiceInteraction = itemBody.querySelector('qti-choice-interaction');  // QTI 3.0 kebab-case
const simpleChoices = utils.getChildrenByTag(element, 'qti-simple-choice');  // QTI 3.0
const maxChoices = parseInt(choiceInteraction.getAttribute('max-choices'), 10);  // kebab-case attrs?
```

**Required:** Create new plugins:
- `qti3-to-pie` package (~2000 lines)
- `pie-to-qti3` package (~2000 lines)
- 30+ interaction-specific transformers

**Effort:** 6-8 weeks for both plugins.

---

### 3. Assessment Player - **85-90% Reusable**

#### ✅ High-Level Logic Completely Reusable

These components have **no QTI version dependencies**:

**NavigationManager** - Controls linear/nonlinear navigation:
```typescript
class NavigationManager {
  moveToNext(): void;
  moveToPrevious(): void;
  canNavigate(direction: Direction): boolean;
  // Pure state machine logic, no XML dependencies
}
```

**ItemSessionController** - Manages session state:
```typescript
class ItemSessionController {
  trackResponse(response: Response): void;
  getCompletionStatus(): CompletionStatus;
  validateResponse(): ValidationResult;
  // Works with abstract Response objects
}
```

**TimeManager** - Timing and countdown:
```typescript
class TimeManager {
  startTimer(duration: number): void;
  getRemainingTime(): number;
  // No format dependencies
}
```

#### ⚠️ Needs Minor Changes

**AssessmentPlayer** - Main orchestrator:
```typescript
class AssessmentPlayer {
  constructor(
    private itemPlayer: ItemPlayer,  // ← Only version-specific dependency
    private navigation: NavigationManager,
    private session: SessionManager
  ) {}
}
```

**Change needed:** Support both QTI 2.x and 3.0 item players:
```typescript
// Proposed approach
class AssessmentPlayer {
  constructor(
    private itemPlayerFactory: ItemPlayerFactory,  // ← Create appropriate player
    // ... other dependencies
  ) {
    const version = detectVersion(assessmentXml);
    this.itemPlayer = itemPlayerFactory.create(version);
  }
}
```

**Effort:** 1-2 weeks to add version routing.

---

### 4. UI Components & Extractors - **20-30% Reusable**

This is where **most new code** is required.

#### ❌ All 21 Extractors Need QTI 3.0 Versions (~3000 lines)

**Current extractors** are tightly coupled to QTI 2.x element names:

```typescript
// item-player/src/extraction/extractors/choiceExtractor.ts
export const standardChoiceExtractor: ElementExtractor = {
  elementTypes: ['choiceInteraction'],  // ← QTI 2.x name

  canHandle(element, context) {
    return context.utils.hasChildWithTag(element, 'simpleChoice');  // ← QTI 2.x
  },

  extract(element, context) {
    const choices = utils.getChildrenByTag(element, 'simpleChoice');  // ← QTI 2.x
    const maxChoices = utils.getNumberAttribute(element, 'maxChoices', 1);  // ← camelCase
    const shuffle = utils.getBooleanAttribute(element, 'shuffle');

    return {
      type: 'choice',
      choices: choices.map(extractChoice),
      // ...
    };
  }
};
```

**QTI 3.0 equivalent** would need:

```typescript
// qti3-item-player/src/extraction/extractors/choiceExtractor.ts
export const qti3ChoiceExtractor: ElementExtractor = {
  elementTypes: ['qti-choice-interaction'],  // ← QTI 3.0 kebab-case

  canHandle(element, context) {
    return context.utils.hasChildWithTag(element, 'qti-simple-choice');  // ← QTI 3.0
  },

  extract(element, context) {
    const choices = utils.getChildrenByTag(element, 'qti-simple-choice');  // ← QTI 3.0
    const maxChoices = utils.getNumberAttribute(element, 'max-choices', 1);  // ← kebab-case?
    const shuffle = utils.getBooleanAttribute(element, 'shuffle');

    return {
      type: 'choice',  // ← Same normalized output
      choices: choices.map(extractChoice),
      // ...
    };
  }
};
```

**All 21 interactions** need this treatment:
- Choice, Order, Associate, Match
- Text Entry, Extended Text, Inline Choice
- Gap Match, Hottext, Graphic Order, Graphic Associate, Graphic Gap Match
- Hotspot, Select Point, Position Object
- Slider, Media, Upload, Drawing
- End Attempt, Custom Interaction
- **Plus 2 new in QTI 3.0:** Portable Custom Interaction, Composite Items

#### ✅ Architecture is Reusable

The **registry pattern and extraction framework** can be reused:
- `ExtractionRegistry` - Priority-based extractor selection
- `ComponentRegistry` - Maps extracted data to UI components
- `ExtractionContext` - Shared utilities and state

**Approach:** Create parallel `qti3-item-player` package using same architecture.

**Effort:** 4-6 weeks for 21+ extractors.

---

### 5. Utilities - **95-100% Reusable**

These have **zero format dependencies**:

- `sanitizer.ts` - HTML sanitization with allowlists
- `urlPolicy.ts` - URL validation and whitelisting
- `trustedTypes.ts` - Browser Trusted Types API
- `random.ts` - Seeded random number generation
- `PerformanceMonitor.ts` - Performance tracking
- `parsingLimits.ts` - DoS protection limits

**All can be imported as-is** by QTI 3.0 packages.

---

## Code Volume Analysis

### Existing Codebase (QTI 2.x)

| Package | Lines of Code | Reusability |
|---------|--------------|-------------|
| `qti-processing` (operators, evaluator) | ~5,000 | 90-100% |
| `qti-processing` (AST builder) | ~1,000 | Needs parameterization |
| `item-player` (core logic) | ~2,000 | 85-90% |
| `item-player` (extractors) | ~3,000 | 20-30% (templates only) |
| `qti2-default-components` | ~5,000 | 40-50% (styling reusable) |
| `assessment-player` | ~4,000 | 85-90% |
| `to-pie` plugin | ~2,000 | 5-10% (structure only) |
| `pie-to-qti2` plugin | ~2,000 | 5-10% (structure only) |
| `core` (transform engine) | ~3,000 | 95-100% |
| Utilities | ~2,000 | 95-100% |
| **Total** | **~29,000** | **~60-70% overall** |

### New Code Required for QTI 3.0

| Component | Estimated Lines | Description |
|-----------|----------------|-------------|
| Element name mapper | ~300 | Abstraction layer |
| AST builder updates | ~200 | Parameterize element matching |
| QTI 3.0 extractors (23) | ~3,500 | New extractors for kebab-case |
| QTI 3.0 components | ~2,000 | Update or create new components |
| `qti3-to-pie` plugin | ~2,000 | QTI 3.0 → PIE transformers |
| `pie-to-qti3` plugin | ~2,000 | PIE → QTI 3.0 generators |
| PCI support | ~2,000 | Portable Custom Interactions |
| APIP features | ~1,000 | Catalogs, PNP, accessibility |
| Assessment player updates | ~500 | Version routing |
| Tests | ~5,000 | Unit + E2E tests |
| **Total New Code** | **~18,500** | |

**Ratio:** ~18,500 new / ~29,000 existing = **64% new code required**

---

## Recommended Approach: Parallel Packages

### Package Structure

```
packages/
├── qti-processing/           # SHARED - Extend for both versions
│   ├── src/eval/            # ✅ 100% shared (operators, evaluator)
│   ├── src/runtime/         # ✅ 100% shared (types, context)
│   ├── src/ast/             # ⚠️ Parameterize element matching
│   └── src/xml/             # ✅ 100% shared (traversal)
│
├── item-player/         # Existing - unchanged
├── assessment-player/   # Existing - unchanged
├── to-pie/              # Existing - unchanged
├── pie-to-qti2/              # Existing - unchanged
│
├── qti3-item-player/         # NEW - Clone & modify item-player
├── qti3-assessment-player/   # NEW - Light wrapper using shared logic
├── qti3-to-pie/              # NEW - Create QTI 3.0 transformers
├── pie-to-qti3/              # NEW - Create QTI 3.0 generators
├── qti3-pci/                 # NEW - Portable Custom Interaction support
│
└── core/                     # SHARED - Transform engine (no changes)
```

### Shared Packages

Create new shared packages for common logic:

```
packages/
├── qti-common/               # NEW - Version-agnostic logic
│   ├── navigation/          # From assessment player
│   ├── session/             # Session management
│   ├── timing/              # Time management
│   └── utilities/           # Sanitization, URL policy, etc.
│
└── qti-types/                # NEW - Shared TypeScript types
    ├── runtime.ts           # QtiValue, BaseType, Cardinality
    ├── extraction.ts        # Extractor interfaces
    └── components.ts        # Component contracts
```

---

## Development Effort Estimate

### Phase 1: Foundation (2-3 weeks)
- Add element name mapper abstraction
- Parameterize AST builder
- Create `qti-common` package
- **Reusability:** Enables both versions

### Phase 2: QTI 3.0 Item Player (4-6 weeks)
- Clone `item-player` to `qti3-item-player`
- Write 23 new extractors (copy structure, update element names)
- Update components for QTI 3.0
- **Reusability:** ~30% (architecture + utilities)

### Phase 3: Transform Plugins (6-8 weeks)
- Create `qti3-to-pie` package
- Create `pie-to-qti3` package
- Write 30+ transformers
- **Reusability:** ~10% (plugin structure)

### Phase 4: Assessment Player (1-2 weeks)
- Add version routing to assessment player
- Test both versions
- **Reusability:** ~90%

### Phase 5: PCI & APIP (4-6 weeks)
- Implement Portable Custom Interactions
- Add APIP accessibility features
- **Reusability:** 0% (all new)

### Phase 6: Testing & Documentation (2-3 weeks)
- Write tests (can reuse test patterns)
- Documentation
- **Reusability:** ~50% (test infrastructure)

**Total:** ~19-28 weeks (5-7 months) for single developer

---

## Maximizing Reusability: Best Practices

### 1. Extract Shared Logic Early

Move version-agnostic code to shared packages:
```typescript
// Bad: Duplicate in item-player and qti3-item-player
class NavigationManager { ... }

// Good: Share from qti-common
import { NavigationManager } from '@pie-qti/qti-common/navigation';
```

### 2. Use Abstraction Layers

Add version abstraction for element handling:
```typescript
// Element name mapper
interface QtiVersionAdapter {
  getElementName(semanticName: string): string;
  getAttribute(element: Element, semanticName: string): string | null;
}

// QTI 2.x adapter
class Qti2Adapter implements QtiVersionAdapter {
  getElementName(name: string) {
    return toCamelCase(name);  // 'choiceInteraction'
  }
  getAttribute(el: Element, name: string) {
    return el.getAttribute(toCamelCase(name));  // 'maxChoices'
  }
}

// QTI 3.0 adapter
class Qti3Adapter implements QtiVersionAdapter {
  getElementName(name: string) {
    return toKebabCase(name);  // 'choice-interaction'
  }
  getAttribute(el: Element, name: string) {
    return el.getAttribute(toKebabCase(name));  // 'max-choices'
  }
}
```

### 3. Normalize Intermediate Representations

Extractors should produce **version-agnostic data structures**:
```typescript
// Both QTI 2.x and 3.0 extractors produce same output
interface ChoiceInteractionData {
  type: 'choice';
  responseIdentifier: string;
  maxChoices: number;
  shuffle: boolean;
  choices: Choice[];
  // No version-specific fields
}
```

This allows **UI components to be 100% shared**.

### 4. Version Detection at Boundaries

Detect version once at entry point:
```typescript
class ItemPlayer {
  static create(xmlContent: string): ItemPlayer {
    const version = detectQtiVersion(xmlContent);
    const adapter = createAdapter(version);
    return new ItemPlayer(adapter);
  }
}
```

---

## Conclusion

**You can reuse 60-70% of the PIE-QTI codebase**, with the highest reusability in:
- ✅ Core processing engine (90-100%)
- ✅ Transform framework architecture (95-100%)
- ✅ Assessment player logic (85-90%)
- ✅ Utilities (95-100%)

**Least reusable components:**
- ❌ UI extractors (20-30%)
- ❌ Transformation plugins (5-10%)
- ❌ PCI support (0% - new feature)

**Key Strategy:** Create parallel QTI 3.0 packages that **share the processing engine** while implementing new extractors, components, and transformers for QTI 3.0's different element naming conventions.

**Development Time:** ~5-7 months (single developer) to achieve feature parity with QTI 2.x support, with ~35% of effort going to reusable infrastructure improvements.
