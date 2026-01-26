# QTI 3.0 Support Analysis for PIE-QTI

**Document Version:** 1.0
**Date:** January 24, 2026
**Status:** High-level analysis for planning purposes

## Executive Summary

This document analyzes what would be required to add QTI 3.0 support to the PIE-QTI project, which currently provides production-ready QTI 2.x players and PIE ↔ QTI transformation tools.

**Key Findings:**

- **Scope:** QTI 3.0 is a significant revision with 23 interactions (vs 21 in QTI 2.2), integrated APIP accessibility features, and Portable Custom Interactions (PCI)
- **Feasibility:** The PIE-QTI architecture is well-suited for QTI 3 support due to its plugin-based design and separation of concerns
- **Effort Level:** Moderate to substantial - significant new functionality but existing infrastructure can be leveraged
- **Approach:** Parallel implementation allowing QTI 2.x and 3.0 to coexist through the plugin system

---

## 1. What is QTI 3.0?

### Overview

QTI 3.0 (released May 11, 2022 by 1EdTech, formerly IMS Global) is a major revision that consolidates QTI 2.x with APIP (Accessible Portable Item Protocol) into a unified assessment specification. It represents "a definitive set of features" designed to meet market demands without requiring major future revisions.

### Key Characteristics

- **Unified Accessibility:** APIP features integrated directly (no separate spec needed)
- **Enhanced HTML5:** Significantly expanded HTML5 usage beyond QTI 2.2's limited subset
- **Standardized Presentation:** Enumerated CSS classes (prefixed "qti-") for rendering consistency
- **Formal PCI Support:** Portable Custom Interactions as first-class citizens
- **Modern Web Standards:** MathML 3, WAI-ARIA 1.0, SSML 1.1, Ruby markup, bidirectional text

### Version Positioning

QTI 3.0 is **not** a minor upgrade from 2.2 - it's a significant revision with:
- New XSD schemas (separate from 2.x)
- Content Package 1.2 profile (different packaging)
- Limited backward compatibility (items require conversion, not native support)
- Different XML structure and capabilities

---

## 2. Major Differences: QTI 3.0 vs QTI 2.2

### 2.1 Interaction Types

| Aspect | QTI 2.2 | QTI 3.0 | Notes |
|--------|---------|---------|-------|
| **Total Interactions** | 21 | 23 | Two additions |
| **Custom Interactions** | `customInteraction` (best practice) | `customInteraction` + `qti-portable-custom-interaction` (formalized) | PCI is standardized |
| **Composite Items** | Not explicitly supported | Supported | Multiple interactions in single item |

**New in QTI 3.0:**
1. **Portable Custom Interaction (PCI)** - Standardized custom interactions with:
   - AMD Module Resolution system
   - JSON variable binding
   - Communication Bridge API
   - Configuration support

2. **Composite Items** - Formally supported pattern for multiple interactions within one item

**Unchanged Interactions (21 from QTI 2.2):**
- All core interactions carry forward: choice, order, associate, match, text entry, extended text, inline choice, gap match, graphic order, graphic associate, graphic gap match, hottext, hotspot, select point, position object, slider, media, upload, drawing, end attempt, and legacy custom interaction

### 2.2 Accessibility & APIP Integration

| Feature | QTI 2.2 | QTI 3.0 |
|---------|---------|---------|
| **Accessibility Support** | Limited, separate APIP spec | Fully integrated |
| **Personal Needs & Preferences (PNP)** | Via APIP companion spec | Native support |
| **Catalogs** | Not available | Support-specific content activation |
| **Standardized Support Vocabulary** | Not defined | Predefined vocabulary aligned with PNP 3.0 |
| **WAI-ARIA** | Basic support | WAI-ARIA 1.0 comprehensive |
| **TTS Control** | Limited | `data-qti-suppress-tts` and SSML 1.1 |

### 2.3 Item Structure Changes

**QTI 2.2 `<assessmentItem>`:**
```xml
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="item_001"
                title="Sample Item"
                adaptive="false"
                timeDependent="false">
```

**QTI 3.0 `<qti-assessment-item>`:**
```xml
<qti-assessment-item identifier="item_001"           <!-- Required -->
                     title="Sample Item"             <!-- Required -->
                     time-dependent="false"          <!-- Required boolean -->
                     adaptive="false"                <!-- Optional, defaults false -->
                     label="practice_item"           <!-- Optional workflow ID -->
                     xml:lang="en"                   <!-- Recommended -->
                     tool-name="Authoring Tool"      <!-- Optional metadata -->
                     tool-version="1.0">             <!-- Optional metadata -->
```

**Key Changes:**
- Namespace change (no longer using XML namespace URIs in element names)
- Kebab-case element names (`qti-assessment-item` vs `assessmentItem`)
- `time-dependent` now required (was optional)
- New optional attributes: `label`, `tool-name`, `tool-version`
- `xml:lang` elevated to recommended practice

### 2.4 Assessment Test Structure

**Hierarchical Requirements:**

QTI 2.2:
- Test → optional parts → sections → items
- Sections can contain items directly

QTI 3.0:
- Test → **at least one** test-part (required)
- Each part → **at least one** section (required)
- Sections → items or nested sections
- More prescriptive structure

**New Capabilities:**
- Enhanced adaptive testing via `preconditions` and `branch-rules`
- External adaptive algorithm support (IRT-based scoring)
- Context declarations for global scope variables at test level
- Assessment stimulus references for shared passage content

### 2.5 HTML5 and Presentation

**QTI 2.2:**
- Limited HTML5 subset
- Minimal presentation guidance
- Inconsistent rendering across platforms

**QTI 3.0:**
- Significantly expanded HTML5 usage
- Standardized CSS classes with "qti-" prefix:
  - Layout: `qti-layout-row`, `qti-layout-stack`
  - Alignment: `qti-align-center`, `qti-align-right`
  - Text: `qti-text-weight-bold`, `qti-text-italic`
  - Accessibility: `qti-well-known.qti-suppress-tts`
- Data attributes for semantic behavior: `data-qti-*`
- Shared interaction vocabulary for interoperability

### 2.6 Response Processing

**No Fundamental Changes** - Core response processing model remains the same:
- Expression-based scoring logic
- Operator registry pattern
- Template-based and generalized processing modes
- Built-in variables and custom variables

**Minor Enhancements:**
- Better integration with external scoring mechanisms
- IRT-based adaptive algorithm support
- Potentially new operators (spec doesn't detail additions)

### 2.7 Metadata & Packaging

| Aspect | QTI 2.2 | QTI 3.0 |
|--------|---------|---------|
| **Content Packaging** | IMS CP 1.1/1.2 | Content Package 1.2 profile (required) |
| **Metadata Elements** | Limited | 11 elements in qtiMetadata |
| **CASE Alignment** | Not supported | Formal support for competency standards |
| **Manifest Format** | `imsmanifest.xml` | `imsmanifest.xml` (updated schema) |

### 2.8 XML Namespaces & Schemas

**QTI 2.2:**
- Namespace: `http://www.imsglobal.org/xsd/imsqti_v2p2`
- Element style: camelCase (`assessmentItem`, `choiceInteraction`)

**QTI 3.0:**
- New namespace (specific URI not detailed in available docs)
- Element style: kebab-case with `qti-` prefix (`qti-assessment-item`, `qti-choice-interaction`)
- Completely new XSD schemas (not incremental updates)

---

## 3. Current PIE-QTI Architecture Analysis

### 3.1 Strengths for QTI 3 Support

The current PIE-QTI codebase has several architectural advantages that make QTI 3 support feasible:

#### **1. Plugin-Based Transformation System**

```typescript
// From packages/core/
class TransformEngine {
  // Priority-based plugin registry
  registerPlugin(plugin: TransformPlugin): void

  // Can select QTI 2.x OR QTI 3.0 plugin based on source format
  transform(content: string, options: TransformOptions): Promise<Result>
}
```

**Advantage:** QTI 2.x and 3.0 transformation plugins can coexist peacefully. Format detection routes to appropriate plugin.

#### **2. Namespace-Agnostic Element Matching**

```typescript
// Current implementation uses element.localName
if (element.localName === 'choiceInteraction') {
  // Works regardless of namespace
}
```

**Advantage:** Can handle both `<choiceInteraction>` (QTI 2.2) and `<qti-choice-interaction>` (QTI 3.0) with simple name mapping.

#### **3. Operator Registry Pattern**

```typescript
// Response processing is extensible
class OperatorRegistry {
  register(operatorName: string, implementation: OperatorFn): void
  evaluate(operatorName: string, context: Context): Value
}
```

**Advantage:** New QTI 3.0 operators can be added without modifying core evaluation engine.

#### **4. Clean Separation of Concerns**

```
Packages:
├── qti-processing       # Core XML parsing, AST, response processing
├── item-player     # QTI 2.x specific player
├── to-pie          # QTI 2.x → PIE transformation
├── pie-to-qti2          # PIE → QTI 2.x transformation
└── core                 # Format-agnostic transform engine
```

**Advantage:** Can create parallel `qti3-item-player`, `qti3-to-pie`, `pie-to-qti3` packages without disrupting existing functionality.

#### **5. Comprehensive Type Safety**

All packages use strict TypeScript with detailed type definitions.

**Advantage:** Refactoring for QTI 3 support will catch errors at compile time.

#### **6. Component Abstraction**

```typescript
// Web components are decoupled from QTI logic
interface InteractionComponent {
  data: InteractionData    // Format-independent contract
  onResponse: (response: Response) => void
}
```

**Advantage:** Same UI components can render both QTI 2.x and 3.0 content with appropriate data transformations.

### 3.2 Current QTI 2.x Support

**Comprehensive QTI 2.x Implementation:**

| Feature | Status | Notes |
|---------|--------|-------|
| **QTI 2.0** | Limited | Backward compatible, not primary target |
| **QTI 2.1** | Full | Common Cartridge support |
| **QTI 2.2** | Full | Production-ready, 100% compliant |
| **Interactions** | 21/21 | All standard interactions |
| **Response Processing Operators** | 45/45 | Complete |
| **Response Processing Templates** | All | Including CC2 aliases |
| **Adaptive Items** | Yes | Multi-attempt workflow |
| **Accessibility** | WCAG 2.2 AA | Full keyboard navigation, screen readers |

### 3.3 Gap Analysis for QTI 3.0

#### **What Can Be Reused**

✅ **Core Infrastructure:**
- XML parsing wrapper (`@xmldom/xmldom`)
- AST building patterns
- Response processing evaluation engine
- Operator implementations (45 existing operators)
- Storage abstraction layer
- Transform engine and plugin registry
- Web component architecture
- Accessibility implementation (WCAG 2.2 AA)

✅ **UI Components:**
- All 21 existing interaction components (with minor updates)
- Layout and styling framework
- Internationalization system
- Typesetting integration (KaTeX)

✅ **Testing Infrastructure:**
- Unit test framework
- E2E test framework (Playwright)
- Accessibility test suite
- Conformance test patterns

#### **What Needs New Development**

❌ **QTI 3.0-Specific Parsing:**
- New namespace detection and version routing
- Kebab-case element name mapping (`qti-*` elements)
- qtiMetadata element parsing (11 new metadata elements)
- Context declaration parsing at test level
- Assessment stimulus reference parsing
- Catalog mechanism for accessibility content

❌ **Portable Custom Interactions (PCI):**
- `qti-portable-custom-interaction` element support
- AMD Module Resolution system
- JSON variable binding layer
- Communication Bridge API implementation
- PCI module loading and lifecycle
- Configuration system for PCI settings

❌ **Enhanced Item/Test Structure:**
- Stricter test-part/section hierarchy enforcement
- External adaptive algorithm integration
- Enhanced branching rules
- Composite item support

❌ **New Interaction Support:**
- PCI implementation (major new feature)
- Composite item orchestration

❌ **Accessibility Enhancements:**
- PNP 3.0 integration
- Catalog-based support content activation
- Enhanced TTS control (`data-qti-suppress-tts`)
- SSML 1.1 support
- Standardized support vocabulary

❌ **Presentation Layer:**
- "qti-" prefixed CSS class handling
- Standardized shared vocabulary classes
- Layout classes (`qti-layout-*`)
- Alignment classes (`qti-align-*`)
- Data attribute processing (`data-qti-*`)

❌ **Content Packaging:**
- Content Package 1.2 profile support
- Updated `imsmanifest.xml` generation
- CASE metadata alignment

❌ **Transformation Plugins:**
- New `Qti30ToPiePlugin`
- New `PieToQti30Plugin`
- QTI 2.x ↔ 3.0 migration transformers

#### **What Needs Modification**

⚠️ **Element Name Handling:**
- Update matchers for kebab-case (`qti-choice-interaction`)
- Maintain backward compatibility with camelCase
- Version-specific routing logic

⚠️ **Required Attribute Validation:**
- `time-dependent` now required (was optional)
- Test structure validation (at least one part, each part needs section)

⚠️ **Namespace Management:**
- Support both QTI 2.x and 3.0 namespaces
- Version detection and routing

---

## 4. Implementation Strategy

### 4.1 Parallel Package Approach

**Recommended Strategy:** Create new packages alongside existing QTI 2.x packages to minimize risk and maintain stability.

```
New Package Structure:
packages/
├── qti-processing/           # Shared - extend for QTI 3
├── qti3-item-player/         # NEW - QTI 3.0 item player
├── qti3-assessment-player/   # NEW - QTI 3.0 assessment player
├── qti3-to-pie/              # NEW - QTI 3.0 → PIE
├── pie-to-qti3/              # NEW - PIE → QTI 3.0
├── qti3-pci/                 # NEW - Portable Custom Interaction support
├── qti3-default-components/  # NEW or extend qti2-default-components
├── item-player/         # Existing - unchanged
├── to-pie/              # Existing - unchanged
└── pie-to-qti2/              # Existing - unchanged
```

### 4.2 Phased Implementation

#### **Phase 1: Foundation (Core Support)**

**Goal:** Parse and display basic QTI 3.0 items with existing interaction types

**Scope:**
1. **XML Parsing Updates** (`qti-processing`)
   - Add QTI 3.0 namespace detection
   - Implement kebab-case element name mapping
   - Version routing logic (2.x vs 3.0)

2. **Basic Item Player** (`qti3-item-player`)
   - Support 21 existing interaction types in QTI 3.0 format
   - Required attribute validation
   - Role-based rendering

3. **Component Updates** (`qti3-default-components`)
   - Extend existing components or create new versions
   - Add "qti-" CSS class support
   - Data attribute handling

4. **Transform Plugins** (`qti3-to-pie`, `pie-to-qti3`)
   - Basic transformation for existing 21 interactions
   - Metadata mapping
   - Test fixtures and validation

**Deliverables:**
- QTI 3.0 items with standard interactions render correctly
- Bidirectional transformation works for basic items
- Unit tests pass for core functionality

**Estimated Scope:** 3-4 months (2-3 engineers)

#### **Phase 2: Portable Custom Interactions (PCI)**

**Goal:** Full PCI support with standardized module loading

**Scope:**
1. **PCI Framework** (`qti3-pci`)
   - AMD Module Resolution implementation
   - JSON variable binding layer
   - Communication Bridge API
   - PCI lifecycle management
   - Configuration system

2. **Player Integration** (`qti3-item-player`)
   - `qti-portable-custom-interaction` element support
   - Dynamic module loading
   - PCI state management
   - Response collection from PCI

3. **Transform Support** (`qti3-to-pie`, `pie-to-qti3`)
   - PCI metadata preservation
   - Module reference handling
   - Lossless round-trip for PCI items

**Deliverables:**
- PCI items load and function correctly
- Third-party PCI modules integrate cleanly
- PCI configuration options work
- Example PCI implementations for testing

**Estimated Scope:** 4-6 months (2-3 engineers)

#### **Phase 3: Accessibility & APIP Integration**

**Goal:** Full QTI 3.0 accessibility features

**Scope:**
1. **PNP 3.0 Support** (All packages)
   - Predefined support vocabulary
   - Personal Needs & Preferences parsing
   - Accommodation application

2. **Catalog System** (`qti3-item-player`, `qti3-assessment-player`)
   - Support content activation
   - Conditional content rendering
   - Dormant content management

3. **Enhanced TTS Control**
   - `data-qti-suppress-tts` attribute handling
   - SSML 1.1 integration
   - Screen reader optimization

4. **Accessibility Testing**
   - WCAG 2.2 AA conformance
   - PNP profile testing
   - AT compatibility testing

**Deliverables:**
- Full APIP feature support
- Accommodation profiles work correctly
- Accessibility audit passes
- Documentation for accessibility features

**Estimated Scope:** 3-4 months (2 engineers + accessibility specialist)

#### **Phase 4: Assessment Player & Advanced Features**

**Goal:** Complete QTI 3.0 test orchestration

**Scope:**
1. **Assessment Player** (`qti3-assessment-player`)
   - Strict test-part/section hierarchy
   - Enhanced branching rules
   - External adaptive algorithm integration
   - Assessment stimulus references
   - Context declarations at test level

2. **Composite Items**
   - Multiple interaction orchestration
   - Combined scoring
   - Shared state management

3. **Content Packaging**
   - Content Package 1.2 profile
   - Updated manifest generation
   - CASE metadata support

4. **Advanced Transformations**
   - Assessment-level transformations
   - QTI 2.x ↔ 3.0 migration tools
   - Validation and analysis tools

**Deliverables:**
- Multi-item QTI 3.0 assessments work
- Adaptive testing functions correctly
- Content packages generate properly
- Migration tools available

**Estimated Scope:** 4-5 months (2-3 engineers)

#### **Phase 5: Production Hardening**

**Goal:** Production-ready QTI 3.0 support

**Scope:**
1. **Comprehensive Testing**
   - 1000+ test items (matching QTI 2.x coverage)
   - E2E test scenarios
   - Performance testing
   - Cross-browser testing

2. **Documentation**
   - Migration guides
   - API documentation
   - Example library
   - Best practices

3. **Performance Optimization**
   - Bundle size optimization
   - Rendering performance
   - Memory management

4. **Conformance Certification**
   - 1EdTech conformance testing
   - Interoperability testing
   - Certification submission

**Deliverables:**
- Production-ready QTI 3.0 players
- Comprehensive documentation
- Performance benchmarks
- Conformance certification (optional)

**Estimated Scope:** 2-3 months (2 engineers)

### 4.3 Total Effort Estimate

**Summary:**

| Phase | Duration | Team Size | Effort (Engineer-Months) |
|-------|----------|-----------|-------------------------|
| Phase 1: Foundation | 3-4 months | 2-3 engineers | 6-12 EM |
| Phase 2: PCI Support | 4-6 months | 2-3 engineers | 8-18 EM |
| Phase 3: Accessibility | 3-4 months | 2 engineers + specialist | 6-12 EM |
| Phase 4: Assessment Player | 4-5 months | 2-3 engineers | 8-15 EM |
| Phase 5: Production Hardening | 2-3 months | 2 engineers | 4-6 EM |
| **Total** | **16-22 months** | **Variable** | **32-63 EM** |

**Notes:**
- Assumes parallel work where possible
- Actual timeline: 12-18 months with proper resourcing
- Can be reduced with more engineers but has diminishing returns
- Effort can be staged based on business priorities

### 4.4 Risk Mitigation

**Key Risks:**

1. **PCI Complexity**
   - Risk: PCI specification may be ambiguous or incomplete
   - Mitigation: Engage with 1EdTech community, review reference implementations, prototype early

2. **Backward Compatibility**
   - Risk: Changes to shared packages break QTI 2.x support
   - Mitigation: Comprehensive regression tests, parallel package structure, feature flags

3. **Limited QTI 3.0 Content**
   - Risk: Few real-world QTI 3.0 items available for testing
   - Mitigation: Create comprehensive test fixtures, engage with partners for sample content

4. **Specification Ambiguities**
   - Risk: QTI 3.0 spec may have unclear requirements
   - Mitigation: Reference implementation review, community engagement, document interpretations

5. **Effort Underestimation**
   - Risk: Hidden complexity in APIP integration or PCI
   - Mitigation: Phased approach with checkpoints, prototype risky components early

---

## 5. Business Considerations

### 5.1 Market Demand

**Questions to Investigate:**

1. How many partners/clients are requesting QTI 3.0 support?
2. Is there existing QTI 3.0 content in the ecosystem?
3. Are assessment vendors actively authoring in QTI 3.0?
4. What is the adoption timeline for QTI 3.0 in the industry?

**Current State (2026):**
- QTI 3.0 released May 2022 (nearly 4 years ago)
- QTI 2.2 released September 2015 (11 years old)
- Many organizations still using QTI 2.x
- Migration to QTI 3.0 may be slow due to existing content libraries

### 5.2 Value Proposition

**Benefits of QTI 3.0 Support:**

✅ **For Users:**
- Better accessibility (integrated APIP)
- Portable Custom Interactions enable richer item types
- Standardized presentation improves consistency
- Modern HTML5 capabilities

✅ **For PIE-QTI Project:**
- Future-proofing the codebase
- Competitive advantage (modern, open-source QTI 3.0 player)
- Expanded use cases (PCI support opens new possibilities)
- Industry alignment with latest standards

✅ **For Partners:**
- Bidirectional QTI 2.x ↔ 3.0 transformation
- Migration path for content libraries
- Single player for multiple QTI versions
- Open-source visibility into implementation

### 5.3 Alternative Strategies

#### **Option A: Full QTI 3.0 Support (Recommended for Long-Term)**

**Pros:**
- Complete feature parity with QTI 3.0 spec
- Positions PIE-QTI as industry-leading player
- Enables all QTI 3.0 use cases

**Cons:**
- Significant development effort (32-63 EM)
- Long timeline (12-18 months)
- Requires ongoing maintenance for two versions

#### **Option B: Partial QTI 3.0 Support (Quick Win)**

Implement Phase 1 only (foundation):
- 21 existing interactions in QTI 3.0 format
- Basic transformations
- No PCI, no APIP enhancements

**Pros:**
- Faster time-to-market (3-4 months)
- Covers majority of real-world items
- Lower risk and cost

**Cons:**
- Missing key QTI 3.0 features (PCI, APIP)
- Not truly "QTI 3.0 compliant"
- May need rework later for full support

#### **Option C: QTI 2.x → 3.0 Transformation Only**

Build transformation tools without a QTI 3.0 player:
- PIE as the common format
- QTI 2.x → PIE → QTI 3.0 pipeline
- Render via PIE players, export to QTI 3.0

**Pros:**
- Leverages existing PIE infrastructure
- Minimal new development
- Provides migration path for partners

**Cons:**
- Not a true QTI 3.0 player
- Dependent on PIE format
- May lose QTI 3.0-specific features in translation

#### **Option D: Wait and Observe**

Monitor industry adoption before investing:
- Maintain QTI 2.x support
- Evaluate market demand annually
- Implement when customer pressure justifies effort

**Pros:**
- Zero immediate cost
- Clarity on market demand
- May benefit from other implementations' learnings

**Cons:**
- Risk losing competitive advantage
- May face urgent requests without preparedness
- Competitors may capture QTI 3.0 market

### 5.4 Recommendation

**Recommended Strategy: Phased Approach Starting with Option B, Evolving to Option A**

**Year 1:** Implement Phase 1 (Foundation) for quick market entry
- Delivers basic QTI 3.0 support
- Validates architecture and approach
- Responds to immediate partner needs

**Year 2:** Evaluate demand, then implement Phases 2-5 based on:
- Partner feedback and requests
- QTI 3.0 content availability
- PCI ecosystem maturity
- Resource availability

**Rationale:**
- Balanced risk vs. reward
- Provides early value while preserving optionality
- Allows market validation before major investment
- Maintains momentum without overcommitting

---

## 6. Technical Deep-Dives

### 6.1 Portable Custom Interactions (PCI)

PCI is the most complex new feature in QTI 3.0. Understanding it is critical for planning.

#### **What is PCI?**

Portable Custom Interactions allow assessment providers to create custom interaction types that work across different delivery systems. QTI 2.x had `customInteraction`, but it was vendor-specific. QTI 3.0 standardizes the interface.

#### **PCI Architecture**

```
┌────────────────────────────────────────────────┐
│  QTI 3.0 Delivery Engine                      │
│  ┌──────────────────────────────────────────┐ │
│  │  Communication Bridge API                │ │
│  │  - initialize(config)                    │ │
│  │  - getResponse(): Response               │ │
│  │  - setResponse(response): void           │ │
│  │  - on(event, handler): void              │ │
│  └──────────────────────────────────────────┘ │
└─────────────────┬──────────────────────────────┘
                  │
                  │ JSON Variable Binding
                  │
┌─────────────────▼──────────────────────────────┐
│  PCI Module (AMD Format)                       │
│  ┌──────────────────────────────────────────┐ │
│  │  Module Factory                          │ │
│  │  - getInstance(dom, config, state)       │ │
│  │  - Public API:                           │ │
│  │    - render()                            │ │
│  │    - getState(): State                   │ │
│  │    - setState(state): void               │ │
│  │    - destroy()                           │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

#### **QTI 3.0 PCI Element**

```xml
<qti-portable-custom-interaction
    response-identifier="RESPONSE"
    module="https://example.com/pci/likert-scale/v1/module.js">

  <!-- PCI-specific configuration -->
  <qti-portable-custom-interaction-markup>
    <pci-config>
      <scale-min>1</scale-min>
      <scale-max>7</scale-max>
      <labels>
        <label value="1">Strongly Disagree</label>
        <label value="7">Strongly Agree</label>
      </labels>
    </pci-config>
  </qti-portable-custom-interaction-markup>

  <!-- Prompt text -->
  <qti-prompt>Rate your agreement with the statement:</qti-prompt>

</qti-portable-custom-interaction>
```

#### **Implementation Requirements**

**1. Module Loading System:**
```typescript
class PCIModuleLoader {
  // AMD Module Resolution
  async loadModule(moduleUrl: string): Promise<PCIModule>

  // Cache management
  getCached(moduleUrl: string): PCIModule | null

  // Version handling
  resolveVersion(moduleId: string, versionRange: string): string
}
```

**2. Communication Bridge:**
```typescript
interface PCIBridge {
  initialize(config: PCIConfig): Promise<void>
  getResponse(): Response
  setResponse(response: Response): void
  on(event: PCIEvent, handler: EventHandler): void
  emit(event: PCIEvent, data: any): void
  destroy(): void
}
```

**3. JSON Variable Binding:**
```typescript
// Convert QTI variables to JSON for PCI
function bindVariables(qtiVars: QTIVariables): PCIVariables {
  // Map QTI response types to JSON structures
  // Handle: single, multiple, ordered, record, file
}

// Convert PCI response back to QTI variables
function unbindResponse(pciResponse: PCIResponse): QTIResponse {
  // Reverse mapping
}
```

**4. PCI Lifecycle:**
1. Parse `<qti-portable-custom-interaction>` element
2. Load module from URL (AMD)
3. Extract configuration from markup
4. Initialize PCI with config and state
5. Render PCI in DOM
6. Listen for response events
7. Collect response on submission
8. Destroy PCI on cleanup

#### **PCI Challenges**

1. **Security:** Loading external JavaScript modules
2. **Sandboxing:** Isolating PCI code from delivery engine
3. **Version Management:** Handling module versions and dependencies
4. **State Management:** Preserving PCI state across sessions
5. **Error Handling:** Gracefully handling PCI failures
6. **Performance:** Module loading and rendering overhead

#### **PCI Testing Strategy**

- Create reference PCI implementations
- Test with third-party PCI modules
- Security audit for XSS and code injection
- Performance benchmarks
- Compatibility testing across browsers

### 6.2 APIP Integration Deep-Dive

APIP (Accessible Portable Item Protocol) integration is a key differentiator for QTI 3.0.

#### **What APIP Brings**

1. **Personal Needs & Preferences (PNP):**
   - User profiles with accommodation preferences
   - Text-to-speech, braille, sign language, etc.
   - Cognitive support, visual support, motor support

2. **Catalog System:**
   - Alternate content for different accommodations
   - Example: Simplified language version for cognitive support
   - Braille-ready content
   - Sign language videos

3. **Standardized Support Vocabulary:**
   - Predefined keywords for accommodation types
   - Aligned with PNP 3.0 specification
   - Cross-platform compatibility

#### **Implementation in QTI 3.0 Player**

**Accommodation Detection:**
```typescript
interface PNPProfile {
  visualSupport?: {
    colorContrast?: 'high' | 'low'
    fontSize?: 'large' | 'xlarge'
    lineSpacing?: 'expanded'
  }
  auditorySupport?: {
    textToSpeech?: boolean
    signLanguage?: boolean
  }
  cognitiveSupport?: {
    simplifiedLanguage?: boolean
    reducedDistraction?: boolean
  }
}

class AccommodationEngine {
  applyProfile(profile: PNPProfile): void {
    // Activate appropriate content from catalogs
    // Apply styling adjustments
    // Enable TTS if requested
  }
}
```

**Catalog Structure:**
```xml
<qti-assessment-item>
  <!-- Default content -->
  <qti-item-body>
    <qti-choice-interaction>...</qti-choice-interaction>
  </qti-item-body>

  <!-- Alternate content in catalog -->
  <qti-catalog>
    <qti-card support="simplified-language">
      <qti-item-body>
        <qti-choice-interaction>
          <!-- Simpler wording -->
        </qti-choice-interaction>
      </qti-item-body>
    </qti-card>

    <qti-card support="braille-ready">
      <qti-item-body>
        <!-- Braille-optimized content -->
      </qti-item-body>
    </qti-card>
  </qti-catalog>
</qti-assessment-item>
```

**Rendering Logic:**
```typescript
function selectContent(
  defaultContent: Element,
  catalog: Catalog,
  profile: PNPProfile
): Element {
  // Check if profile requires specific support
  const requiredSupport = deriveSupport(profile)

  // Look for matching card in catalog
  const card = catalog.findCard(requiredSupport)

  // Return catalog content if available, else default
  return card?.content ?? defaultContent
}
```

#### **TTS Control**

QTI 3.0 provides fine-grained TTS control:

```html
<!-- Suppress TTS for decorative content -->
<span data-qti-suppress-tts="true">★★★★★</span>

<!-- SSML for pronunciation -->
<qti-pronunciation alphabet="x-sampa">
  t @ ' m eI t @U
</qti-pronunciation>

<!-- Ruby annotation for East Asian languages -->
<ruby>
  <rb>漢字</rb>
  <rt>かんじ</rt>
</ruby>
```

Implementation requires:
- Attribute detection (`data-qti-suppress-tts`)
- SSML 1.1 parsing and rendering
- Ruby markup support
- Integration with TTS engines

### 6.3 Metadata & Packaging

QTI 3.0 introduces enhanced metadata and stricter packaging requirements.

#### **qtiMetadata Elements (11 Total)**

Example structure:
```xml
<qti-assessment-item>
  <qti-metadata>
    <qti-meta-identifier>item_001</qti-meta-identifier>
    <qti-meta-title>Sample Item</qti-meta-title>
    <qti-meta-creator>John Doe</qti-meta-creator>
    <qti-meta-creation-date>2026-01-24</qti-meta-creation-date>
    <qti-meta-subject>Mathematics</qti-meta-subject>
    <qti-meta-keyword>algebra</qti-meta-keyword>
    <qti-meta-keyword>equations</qti-meta-keyword>
    <qti-meta-educational-level>Grade 8</qti-meta-educational-level>
    <qti-meta-typical-age-range>13-14</qti-meta-typical-age-range>
    <qti-meta-language>en-US</qti-meta-language>

    <!-- CASE alignment -->
    <qti-meta-case-framework href="https://example.com/case/math-standards">
      <qti-meta-case-item identifier="8.EE.C.7">
        Solve linear equations in one variable
      </qti-meta-case-item>
    </qti-meta-case-framework>
  </qti-metadata>

  <!-- Item content -->
  <qti-item-body>...</qti-item-body>
</qti-assessment-item>
```

#### **Content Package 1.2 Profile**

QTI 3.0 requires Content Package 1.2 with specific profile:

```xml
<!-- imsmanifest.xml -->
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p2"
          xmlns:qti="http://www.imsglobal.org/xsd/imsqti_v3p0"
          identifier="MANIFEST-001">

  <metadata>
    <schema>QTI Package</schema>
    <schemaversion>3.0</schemaversion>
  </metadata>

  <organizations />

  <resources>
    <resource identifier="ITEM-001"
              type="imsqti_item_xmlv3p0"
              href="items/item_001.xml">
      <file href="items/item_001.xml" />
      <file href="images/diagram.png" />
      <metadata>
        <qti:qtiMetadata>
          <!-- Item-specific metadata -->
        </qti:qtiMetadata>
      </metadata>
    </resource>
  </resources>
</manifest>
```

**Key Differences from QTI 2.x Packaging:**
- Resource type: `imsqti_item_xmlv3p0` (vs `imsqti_item_xmlv2p2`)
- Schema version: `3.0`
- Enhanced metadata structure
- CASE framework references

#### **Implementation Impact**

**For PIE → QTI 3.0 Transformation:**
- Generate `qti-metadata` elements from PIE metadata
- Create Content Package 1.2 manifest
- Include CASE alignments if available
- Handle resource references and file paths

**For QTI 3.0 → PIE Transformation:**
- Parse `qti-metadata` elements
- Extract CASE alignments
- Map to PIE metadata structure
- Preserve for lossless round-trip

---

## 7. Migration Path for Existing Content

### 7.1 QTI 2.x → 3.0 Content Migration

For organizations with large QTI 2.x content libraries, migration is a key concern.

#### **Migration Strategies**

**Strategy A: Automated Transformation with PIE Intermediary**

```
QTI 2.x → PIE → QTI 3.0
```

**Advantages:**
- Leverages existing PIE transformation infrastructure
- PIE provides clean semantic model
- Can apply enhancements during transformation

**Disadvantages:**
- Not all QTI 2.x features may map cleanly to PIE
- Two-step process (more potential for data loss)
- Vendor extensions may not survive round-trip

**Strategy B: Direct QTI 2.x → 3.0 Transformation**

```
QTI 2.x → QTI 3.0 (direct)
```

**Advantages:**
- Single transformation step
- Can preserve vendor extensions
- More control over mapping

**Disadvantages:**
- Requires new transformation logic
- Complex mapping for edge cases
- More development effort

**Strategy C: Hybrid Approach (Recommended)**

```
QTI 2.x → Analyze → Route → Transform → Validate → QTI 3.0
                      ↓
         Standard Items: Direct transform
         Complex Items: Via PIE
         Custom Extensions: Manual review
```

#### **Transformation Mapping**

| QTI 2.2 Element | QTI 3.0 Element | Complexity |
|-----------------|-----------------|------------|
| `<assessmentItem>` | `<qti-assessment-item>` | Simple |
| `<choiceInteraction>` | `<qti-choice-interaction>` | Simple |
| `<responseDeclaration>` | `<qti-response-declaration>` | Simple |
| `<itemBody>` | `<qti-item-body>` | Simple |
| `<prompt>` | `<qti-prompt>` | Simple |
| `<customInteraction>` | `<qti-portable-custom-interaction>` | Complex |
| HTML elements | HTML + qti-* classes | Moderate |
| APIP companion content | Catalogs | Moderate |

#### **Automated Migration Tool Requirements**

```typescript
interface MigrationTool {
  // Analyze QTI 2.x content
  analyze(qti2xContent: string): AnalysisReport

  // Transform with options
  transform(qti2xContent: string, options: MigrationOptions): TransformResult

  // Validate QTI 3.0 output
  validate(qti3Content: string): ValidationReport

  // Generate migration report
  generateReport(results: TransformResult[]): MigrationReport
}

interface MigrationOptions {
  preserveVendorExtensions: boolean
  enhanceAccessibility: boolean // Add APIP features
  standardizePresentiation: boolean // Add qti-* classes
  convertCustomInteractionsToPCI: boolean
}

interface TransformResult {
  success: boolean
  qti3Content?: string
  warnings: Warning[]
  errors: Error[]
  manualReviewRequired: boolean
}
```

#### **Manual Review Scenarios**

Certain QTI 2.x items will require manual intervention:

1. **Complex Custom Interactions:**
   - May need PCI development
   - Behavior may not be portable

2. **Vendor-Specific Extensions:**
   - Assessment vendor logic
   - Proprietary scoring algorithms

3. **Accessibility Gaps:**
   - Items lacking alt text
   - Missing ARIA labels
   - Need catalog content creation

4. **Ambiguous Markup:**
   - Malformed XML
   - Non-standard element usage
   - Unclear authoring intent

### 7.2 Dual-Version Support Strategy

During migration, organizations may need to support both QTI 2.x and 3.0 simultaneously.

#### **Dual-Player Deployment**

```typescript
class QTIPlayerFactory {
  createPlayer(content: string): QTIPlayer {
    const version = detectQTIVersion(content)

    if (version.startsWith('2.')) {
      return new QTI2Player(config)
    } else if (version.startsWith('3.')) {
      return new QTI3Player(config)
    }

    throw new Error(`Unsupported QTI version: ${version}`)
  }
}
```

**Advantages:**
- Seamless content delivery regardless of version
- Gradual migration (no big-bang cutover)
- Fallback to QTI 2.x if QTI 3.0 fails

**Considerations:**
- Increased bundle size (both players)
- Maintenance burden (two codebases)
- Potential user confusion with inconsistent rendering

#### **Shared Component Strategy**

To minimize duplication:

```
packages/
├── qti-common/               # Shared between 2.x and 3.0
│   ├── components/           # Reusable UI components
│   ├── utils/                # Common utilities
│   └── response-processing/  # Shared evaluation logic
├── item-player/         # QTI 2.x specifics
├── qti3-item-player/         # QTI 3.0 specifics
└── qti-player-facade/        # Unified API
```

---

## 8. Open Questions & Research Needed

### 8.1 Technical Questions

1. **PCI Security Model:**
   - What sandboxing is recommended for PCI modules?
   - How to handle malicious or poorly-written PCI code?
   - CSP (Content Security Policy) implications?

2. **PCI Ecosystem:**
   - Are there existing PCI modules available?
   - Who is building PCI modules?
   - What is the distribution/marketplace model?

3. **QTI 3.0 Namespace:**
   - What is the exact namespace URI for QTI 3.0?
   - Are there namespace versioning considerations?

4. **Response Processing Extensions:**
   - Are there new operators in QTI 3.0 not documented?
   - Are QTI 2.x operators deprecated?

5. **Adaptive Algorithm APIs:**
   - What is the interface for "external adaptive algorithms"?
   - Is IRT integration standardized?

6. **Performance Characteristics:**
   - How does QTI 3.0 rendering compare to 2.x?
   - Bundle size implications?

### 8.2 Ecosystem Questions

1. **Industry Adoption:**
   - How many assessment vendors support QTI 3.0 authoring?
   - How many delivery systems support QTI 3.0 rendering?
   - What is the migration timeline for major players?

2. **Content Availability:**
   - How much QTI 3.0 content exists today?
   - Are publishers creating QTI 3.0 items?
   - What is the ratio of QTI 2.x to 3.0 content?

3. **Conformance Testing:**
   - Does 1EdTech offer QTI 3.0 conformance certification?
   - What are the certification requirements?
   - How long does certification take?

4. **Reference Implementations:**
   - Are there open-source QTI 3.0 players?
   - What can we learn from existing implementations?
   - Are there interoperability issues to watch for?

### 8.3 Business Questions

1. **Partner Demand:**
   - Which Renaissance partners are requesting QTI 3.0?
   - What is their urgency level?
   - Are there blocking content deals?

2. **Competitive Landscape:**
   - Do competitors support QTI 3.0?
   - What is their level of support (full, partial)?
   - Is there a competitive advantage to early QTI 3.0 support?

3. **Resource Availability:**
   - Can we allocate 2-3 engineers for 12-18 months?
   - Do we have accessibility expertise in-house?
   - Should we hire contractors or consultants?

4. **ROI Analysis:**
   - What is the expected return on QTI 3.0 investment?
   - How does it support business objectives?
   - What are the opportunity costs?

---

## 9. Recommendations

### 9.1 Immediate Actions (Next 30 Days)

1. **Market Research:**
   - Survey Renaissance partners on QTI 3.0 needs
   - Research industry adoption trends
   - Identify potential early adopters

2. **Technical Prototyping:**
   - Build proof-of-concept QTI 3.0 parser
   - Test element name mapping (kebab-case)
   - Validate namespace detection approach

3. **Competitive Analysis:**
   - Evaluate existing QTI 3.0 implementations
   - Identify gaps in market offerings
   - Assess open-source alternatives

4. **Specification Deep-Dive:**
   - Obtain full QTI 3.0 specification documents
   - Document ambiguities and questions
   - Engage with 1EdTech community

5. **Resource Planning:**
   - Identify engineering team members
   - Assess skill gaps (accessibility, PCI, etc.)
   - Budget for potential contractors

### 9.2 Short-Term Roadmap (3-6 Months)

**If Decision is to Proceed:**

1. **Phase 1 Implementation:**
   - Start QTI 3.0 foundation (basic player)
   - Create test fixtures from spec examples
   - Set up CI/CD for QTI 3.0 packages

2. **Community Engagement:**
   - Join 1EdTech QTI working group
   - Present PIE-QTI at conferences
   - Seek partnership opportunities

3. **Documentation:**
   - Write QTI 3.0 implementation plan
   - Create migration guide for partners
   - Document design decisions

**If Decision is to Wait:**

1. **Monitoring:**
   - Quarterly reviews of QTI 3.0 adoption
   - Track partner requests
   - Watch competitor movements

2. **Preparation:**
   - Refactor shared code for easier QTI 3.0 addition
   - Document known QTI 3.0 requirements
   - Maintain architectural readiness

### 9.3 Strategic Recommendation

**Recommended Path: Conditional Proceed**

**Proceed with Phase 1 (Foundation) IF:**
- At least 3 partners have expressed QTI 3.0 needs
- Content is available for testing
- Team capacity is available (2-3 engineers)

**Wait and Monitor IF:**
- Partner demand is low or speculative
- Resource constraints exist
- QTI 3.0 ecosystem is immature

**Key Decision Criteria:**

1. **Partner Demand** (Weight: 40%)
   - Active requests from partners?
   - Content deals dependent on QTI 3.0?

2. **Resource Availability** (Weight: 30%)
   - Can we staff 2-3 engineers?
   - Acceptable impact on other roadmap items?

3. **Market Readiness** (Weight: 20%)
   - QTI 3.0 content available for testing?
   - Ecosystem mature enough for interoperability?

4. **Competitive Pressure** (Weight: 10%)
   - Risk of losing deals to competitors?
   - Strategic value of early adoption?

**Decision Framework:**

| Score | Action |
|-------|--------|
| 75-100 | Proceed immediately with full commitment |
| 50-74 | Proceed with Phase 1, re-evaluate after |
| 25-49 | Wait 6 months, continue monitoring |
| 0-24 | Defer indefinitely, focus elsewhere |

---

## 10. Conclusion

### Summary of Key Findings

1. **QTI 3.0 is a major revision** with 23 interactions, integrated APIP, and standardized Portable Custom Interactions

2. **PIE-QTI architecture is well-suited** for QTI 3.0 support due to plugin-based design and clean separation of concerns

3. **Effort is substantial but manageable** with 32-63 engineer-months over 12-18 months in phased approach

4. **Portable Custom Interactions (PCI)** represent the most complex new feature requiring AMD module loading, JSON binding, and communication bridge

5. **APIP integration** brings powerful accessibility features through catalogs and Personal Needs & Preferences

6. **Market readiness is unclear** and requires investigation before committing resources

7. **Recommended strategy** is conditional proceed with Phase 1 (foundation) to validate approach and gather feedback

### Next Steps

The immediate priority is answering the business questions around partner demand and resource availability. Technical feasibility is confirmed - the question is business justification.

**Recommended Next Actions:**

1. Partner survey on QTI 3.0 needs (2 weeks)
2. Resource allocation discussion (1 week)
3. Decision on proceed vs. wait (1 week)
4. If proceed: Kick off Phase 1 planning (2 weeks)

This analysis provides the foundation for an informed decision on QTI 3.0 support in PIE-QTI.

---

## Appendix A: QTI 3.0 Resources

### Specifications

- **QTI 3.0 Specification:** https://www.imsglobal.org/spec/qti/v3p0
- **Implementation Guide:** https://www.imsglobal.org/spec/qti/v3p0/impl
- **Shared Vocabulary:** https://www.imsglobal.org/spec/qti/v3p0/guide
- **1EdTech QTI Page:** https://www.1edtech.org/standards/qti

### Related Standards

- **APIP (Accessible Portable Item Protocol):** Integrated into QTI 3.0
- **PNP (Personal Needs & Preferences) 3.0:** Accessibility profiles
- **CASE (Competencies and Academic Standards Exchange):** Standards alignment
- **Content Package 1.2:** IMS packaging specification

### Community

- **1EdTech Forums:** http://www.imsglobal.org/forums
- **QTI Working Group:** Contact 1EdTech for participation
- **GitHub Discussions:** (If PIE-QTI has discussions enabled)

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **APIP** | Accessible Portable Item Protocol - accessibility features for assessments |
| **PCI** | Portable Custom Interaction - standardized custom interaction type |
| **PNP** | Personal Needs & Preferences - user accessibility profiles |
| **QTI** | Question & Test Interoperability - assessment content standard |
| **PIE** | Portable Interactions and Elements - Renaissance's assessment framework |
| **AMD** | Asynchronous Module Definition - JavaScript module loading standard |
| **CASE** | Competencies and Academic Standards Exchange - standards alignment format |
| **TTS** | Text-to-Speech - accessibility feature |
| **SSML** | Speech Synthesis Markup Language - pronunciation control |
| **IRT** | Item Response Theory - adaptive testing algorithm |
| **Catalog** | QTI 3.0 mechanism for alternate content versions |
| **WAI-ARIA** | Web Accessibility Initiative - Accessible Rich Internet Applications |

---

**Document End**
