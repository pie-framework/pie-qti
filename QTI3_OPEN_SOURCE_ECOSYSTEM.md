# QTI 3.0 Open Source Ecosystem

**Document Version:** 1.0
**Date:** January 24, 2026
**Purpose:** Survey of existing open source QTI 3.0 implementations and tools

---

## Executive Summary

The QTI 3.0 open source ecosystem is **nascent but functional**, with one major player (**amp-up-io**) providing certified, production-ready components. Several conversion tools exist for migrating QTI 2.x content to 3.0. However, the ecosystem is much smaller than QTI 2.x, and most established QTI projects have not yet migrated to version 3.0.

**Key Findings:**
- ✅ **amp-up-io** has a complete, certified QTI 3.0 player suite (MIT licensed)
- ✅ Multiple QTI 2.x → 3.0 conversion tools are available
- ⚠️ Most QTI projects (oat-sa, qtiworks, etc.) remain on QTI 2.x
- ⚠️ Limited community adoption (< 30 stars on most repos)
- ✅ All are MIT/open source licensed and learnable

---

## 1. QTI 3.0 Players

### 1.1 amp-up-io QTI 3 Suite (★★★★★ Recommended)

**Organization:** [amp-up-io](https://github.com/amp-up-io) (United States)
**Contact:** administrator@amp-up.io
**License:** MIT

#### Components

**1. qti3-item-player** ([GitHub](https://github.com/amp-up-io/qti3-item-player))
- **Description:** Core QTI 3.0 item rendering component
- **Technology:** Vue.js (100% JavaScript)
- **Stars:** 29 (highest in QTI 3.0 space)
- **Status:** ✅ **1EdTech Certified** (QTI 3 Basic & Advanced Delivery Conformance)
- **Last Updated:** June 21, 2025 (actively maintained)
- **Node.js:** Requires v16+ (tested with v16.14 and v20.9.0)

**Key Features:**
- Full QTI 3 XML support
- Complete response processing expression vocabulary
- Item templating and adaptive items
- Personal Needs and Preferences (PnP) configuration
- Session control management
- State restoration across sessions
- Feedback display (inline, block, modal)
- Accessibility support
- Customizable styling

**Architecture:**
- Vue component-based
- npm package distribution
- Webpack/Babel build system
- 596 commits, 4 open issues

**Known Limitations:**
- Node ≥17 requires `NODE_OPTIONS=--openssl-legacy-provider` workaround
- Simplified layout features on roadmap (not yet supported)

---

**2. qti3-item-player-vue3** ([GitHub](https://github.com/amp-up-io/qti3-item-player-vue3))
- **Description:** Vue 3 version of the item player
- **Stars:** 4
- **Last Updated:** September 22, 2025
- **Status:** Production-ready alternative for Vue 3 projects

---

**3. qti3-test-vue3** ([GitHub](https://github.com/amp-up-io/qti3-test-vue3))
- **Description:** QTI 3 Assessment Test orchestration component
- **Stars:** 3
- **Last Updated:** April 28, 2025
- **Status:** ✅ **1EdTech Certified** (QTI 3 Basic & Advanced)

**Key Features:**
- Parses QTI 3 Assessment Test XML
- Test structure management (Test → Test Parts → Sections → Items)
- Item state tracking
- Outcome processing execution
- Session controls (attempt limits, feedback timing)
- Time limits
- Selection/ordering rules
- Result export

**Architecture:**
- Vue 3 component
- Hierarchical information model
- Methods for navigation and property retrieval
- Supports individual and simultaneous submission modes

---

**4. qti3-stimulus-player** ([GitHub](https://github.com/amp-up-io/qti3-stimulus-player))
- **Description:** Handles shared stimulus/passage content
- **Stars:** 5
- **Last Updated:** May 5, 2023
- **Technology:** JavaScript

---

**5. qti3-item-player-controller** ([GitHub](https://github.com/amp-up-io/qti3-item-player-controller))
- **Description:** Sample test controller demonstrating player APIs
- **Stars:** 4
- **Last Updated:** July 17, 2025
- **Purpose:** Reference implementation and usage examples

---

#### Assessment of amp-up-io Suite

**Strengths:**
- ✅ **1EdTech certified** - official conformance
- ✅ **Production-ready** - actively maintained, 500+ commits
- ✅ **Complete solution** - item player + test player + stimulus
- ✅ **MIT licensed** - permissive, commercial-friendly
- ✅ **Modern stack** - Vue 3, JavaScript/TypeScript ready
- ✅ **Well-architected** - component-based, separation of concerns

**Weaknesses:**
- ⚠️ **Limited adoption** - < 30 stars, small community
- ⚠️ **Vue-specific** - Not framework-agnostic
- ⚠️ **Documentation gaps** - Specific interaction support not listed
- ⚠️ **Node version quirks** - Requires workarounds for Node 17+

**Recommendation for PIE-QTI:**
- ✅ **Study the architecture** - Learn from certified implementation
- ✅ **Reference implementation** - Use for QTI 3.0 compliance testing
- ⚠️ **Not directly usable** - Vue-based vs. PIE-QTI's Svelte/Web Components
- ✅ **Can learn from** - Understand QTI 3.0 interpretation and edge cases

---

### 1.2 Citolab qti-components (★★★☆☆ Interesting, WIP)

**Organization:** [Citolab](https://github.com/Citolab)
**Repository:** [qti-components](https://github.com/Citolab/qti-components)
**License:** GPL-3.0 (flexible on request)
**Stars:** 15

#### Overview
- **Description:** Web component library for rendering 1EdTech QTI items
- **Technology:** Web Components (framework-agnostic)
- **Architecture:** Monorepo with multiple packages
- **Status:** ⚠️ **WIP** - "Initial development is in progress, not yet stable"
- **Maturity:** 114 releases, 1,964 commits (active development)

#### Key Features
- Framework-agnostic web components
- Storybook documentation
- E2E testing infrastructure
- Monorepo structure (multiple packages)

#### QTI Version Support
- Claims "1EdTech QTI items" but **version not specified**
- No explicit mention of QTI 3.0
- Likely QTI 2.x based on maturity timeline

#### Assessment
**Strengths:**
- ✅ **Web Components** - Framework-agnostic (like PIE-QTI)
- ✅ **Active development** - 1,900+ commits
- ✅ **Testing infrastructure** - E2E and Storybook

**Weaknesses:**
- ⚠️ **WIP status** - Not production-ready
- ⚠️ **GPL-3.0** - More restrictive than MIT
- ❌ **Version unclear** - Doesn't specify QTI 3.0 support
- ⚠️ **Limited documentation** - Version support not documented

**Recommendation for PIE-QTI:**
- ⚠️ **Monitor** - May be QTI 2.x only, or future 3.0 support
- ✅ **Web Components approach** - Similar to PIE-QTI architecture
- ⚠️ **Not immediately useful** - WIP status and unclear version support

---

## 2. QTI 2.x → 3.0 Conversion Tools

### 2.1 NCER-QuTIe qti-converter-rest (★★★☆☆)

**Organization:** [NCER-QuTIe](https://github.com/NCER-QuTIe)
**Repository:** [qti-converter-rest](https://github.com/NCER-QuTIe/qti-converter-rest)
**License:** Not specified
**Stars:** 0 (new project)

#### Overview
- **Description:** REST API and web UI for converting QTI 2.x packages to QTI 3.0
- **Created:** November 9, 2024 (very recent)
- **Technology:** JavaScript (47.3%), HTML (48.6%), Dockerfile (4.1%)
- **Commits:** 15 (early stage)
- **Last Updated:** December 3, 2024

#### Features
- REST API for batch conversion
- Simple web interface
- Docker deployment support
- QTI 2.x package → QTI 3.0 transformation

#### Architecture
- Likely Node.js/Express-based (based on tech stack)
- Dockerized deployment
- REST API endpoint structure

#### Assessment
**Strengths:**
- ✅ **REST API** - Programmatic conversion
- ✅ **Docker support** - Easy deployment
- ✅ **Recent development** - Modern approach

**Weaknesses:**
- ❌ **Very new** - Only 15 commits, no releases
- ❌ **No documentation** - Conversion details not specified
- ❌ **Unknown license** - Legal uncertainty
- ❌ **No stars/forks** - Untested by community

**Recommendation for PIE-QTI:**
- ⚠️ **Monitor development** - Too early to use
- ✅ **Potential reference** - Once mature, study conversion logic
- ❌ **Not production-ready** - Too new and undocumented

---

### 2.2 Other Conversion Tools

**qti-convert** (by amp-up-io?)
- **Mentioned in search results** but repository not found (404)
- **Description:** TypeScript tool converting QTI 2 packages to QTI 3
- **Status:** Unknown - may be private or deleted

**qti30Upgrader**
- **Mentioned in search results**
- **Technology:** XSLT-based conversion utility
- **Status:** Limited information available

---

## 3. Established QTI 2.x Projects (No QTI 3.0 Support Yet)

### 3.1 oat-sa/qti-sdk (★★★★☆ Major Player, QTI 2.x Only)

**Organization:** [Open Assessment Technologies (OAT)](https://github.com/oat-sa)
**Repository:** [qti-sdk](https://github.com/oat-sa/qti-sdk)
**License:** Open source
**Stars:** 86 (most popular QTI project)

#### Overview
- **Description:** "A QTI Software Development Kit for PHP"
- **Technology:** PHP
- **QTI Versions:** 2.0, 2.1, and **partially 2.2**
- **Status:** Actively maintained (v19.7.1, December 2025)

#### Features
- Rendering engines
- Response processing
- Complete QTI 2.x implementation
- Assessment delivery capabilities

#### QTI 3.0 Status
- ❌ **No QTI 3.0 support**
- ❌ **No announced plans** for QTI 3.0
- ⚠️ API may change (master branch unstable)

#### Assessment
**Strengths:**
- ✅ **Most popular** - 86 stars, established community
- ✅ **Mature** - Years of development
- ✅ **Actively maintained** - Recent releases

**Weaknesses:**
- ❌ **QTI 2.x only** - No migration to 3.0
- ❌ **PHP** - Different ecosystem than PIE-QTI
- ⚠️ **Partial QTI 2.2** - Not even complete 2.2 support

**Recommendation for PIE-QTI:**
- ❌ **Not relevant for QTI 3.0** - Remains on 2.x
- ✅ **May inform QTI 2.x work** - Reference for 2.x edge cases

---

### 3.2 OpenOLAT/qtiworks (QTI 2.1 Only)

**Repository:** [qtiworks](https://github.com/OpenOLAT/qtiworks)
**Stars:** 3
**Description:** IMS QTI 2.1 assessment delivery engine and Java library
**Status:** QTI 2.1 only, no QTI 3.0 plans visible

---

### 3.3 Other QTI 2.x Projects

**sonyccd/qti-playground** (3 stars)
- Web application for viewing/editing QTI XML
- QTI version not specified

**jmvedrine/moodle-qformat_imsqti21** (1 star)
- Moodle plugin for QTI format
- Last updated 2015 (outdated)

---

## 4. Ecosystem Analysis

### 4.1 Adoption Status

| Aspect | Status | Notes |
|--------|--------|-------|
| **QTI 3.0 Players** | ✅ Available | amp-up-io suite is certified |
| **QTI 3.0 Converters** | ⚠️ Emerging | 1-2 tools, early stage |
| **Community Size** | ⚠️ Small | < 30 stars on most repos |
| **Production Use** | ⚠️ Limited | Few known deployments |
| **1EdTech Certification** | ✅ Yes | amp-up-io certified |
| **Migration from 2.x** | ⚠️ Slow | Major projects still on 2.x |

### 4.2 Technology Stacks

| Project | Language | Framework | Use Case |
|---------|----------|-----------|----------|
| amp-up-io players | JavaScript | Vue.js | QTI 3.0 rendering |
| Citolab qti-components | JavaScript | Web Components | QTI (version unclear) |
| oat-sa qti-sdk | PHP | Native | QTI 2.x only |
| NCER-QuTIe converter | JavaScript | Node.js | QTI 2→3 conversion |
| PIE-QTI | TypeScript | Svelte/Web Components | QTI 2.x + PIE |

### 4.3 Licensing

| Project | License | Commercial Use | PIE-QTI Compatible |
|---------|---------|----------------|-------------------|
| amp-up-io suite | MIT | ✅ Yes | ✅ Yes |
| Citolab qti-components | GPL-3.0* | ⚠️ Restrictive | ⚠️ No (without exception) |
| oat-sa qti-sdk | Open source | Likely yes | N/A (PHP) |
| NCER-QuTIe | Unknown | Unknown | Unknown |

*GPL-3.0 with note: "if you want to use it in another way, feel free to ask!"

---

## 5. Comparison to PIE-QTI

### 5.1 How PIE-QTI Compares

| Feature | PIE-QTI | amp-up-io | Citolab | oat-sa |
|---------|---------|-----------|---------|--------|
| **QTI 2.x Support** | ✅ Full (2.0-2.2) | ❌ No | Unclear | ✅ Partial |
| **QTI 3.0 Support** | ❌ No | ✅ Certified | Unclear | ❌ No |
| **Framework** | Svelte/Web Comp | Vue.js | Web Comp | PHP |
| **License** | MIT | MIT | GPL-3.0 | Open source |
| **Stars** | New project | 29 | 15 | 86 |
| **PIE Support** | ✅ Native | ❌ No | ❌ No | ❌ No |
| **Transformation** | ✅ Bidirectional | ❌ Player only | ❌ No | ❌ No |
| **1EdTech Cert** | ⚠️ No (yet) | ✅ Yes | ❌ No | ❌ No |
| **Accessibility** | ✅ WCAG 2.2 AA | ✅ Supported | Unknown | Unknown |
| **Test Player** | ✅ Full | ✅ Full | Unknown | ✅ Yes |

### 5.2 PIE-QTI's Unique Strengths

PIE-QTI has several differentiators even without QTI 3.0 support:

1. **Bidirectional Transformation** - Only project with QTI ↔ PIE transforms
2. **Dual Player Support** - Both QTI and PIE rendering
3. **Web Components** - Framework-agnostic (like Citolab, unlike amp-up-io)
4. **Production QTI 2.x** - 100% QTI 2.2 compliant, all 21 interactions
5. **Transform Framework** - Pluggable, extensible architecture
6. **Vendor Extensions** - Plugin system for custom QTI variants
7. **TypeScript** - Full type safety
8. **Modern Stack** - Svelte, Bun, modern tooling

### 5.3 Competitive Landscape

**Current State (QTI 2.x):**
- PIE-QTI: Production-ready, most complete open source QTI 2.x player
- oat-sa: Established PHP option, partial QTI 2.2
- Others: Limited adoption or older

**If PIE-QTI Adds QTI 3.0:**
- Would be **only project** with both QTI 2.x AND 3.0 support
- Would compete with amp-up-io for QTI 3.0 space
- Unique value: Transformation framework + dual version support
- Advantage: Web Components (more flexible than Vue)
- Path to 1EdTech certification

---

## 6. Learning from amp-up-io

### 6.1 What Can Be Learned

#### Architecture Insights

**1. Component Separation**
- Clear separation: Item Player, Test Player, Stimulus Player
- Similar to PIE-QTI's separation but more granular
- **Takeaway:** Consider separate `qti3-stimulus-player` package

**2. 1EdTech Certification**
- amp-up-io achieved both Basic and Advanced conformance
- Demonstrates feasibility of open source certification
- **Takeaway:** Certification path exists for PIE-QTI if desired

**3. Vue Component Pattern**
- Component-based architecture with props/events
- State management externalized
- **Takeaway:** Can adapt to PIE-QTI's Svelte/Web Component approach

**4. Session & State Management**
- State restoration across sessions
- Session control management
- **Takeaway:** Similar to PIE-QTI's existing session management

#### Implementation Details

From amp-up-io's feature list, QTI 3.0 players need:
- ✅ Full QTI 3 XML support (parsing)
- ✅ Complete response processing vocabulary (PIE-QTI already has operators)
- ✅ Item templating (PIE-QTI supports adaptive items)
- ✅ PnP configuration (new for QTI 3.0)
- ✅ Feedback display variants (PIE-QTI has inline/modal)
- ✅ Accessibility (PIE-QTI has WCAG 2.2 AA)

**Gap Analysis:**
- ❌ PnP (Personal Needs & Preferences) - New for QTI 3.0
- ❌ QTI 3.0-specific XML parsing (kebab-case elements)
- ❌ Catalog system for accessible content

### 6.2 Code Study Recommendations

**Priority 1: High Value**
1. **Element parsing logic** - How they handle kebab-case elements
2. **PCI implementation** - Portable Custom Interaction handling
3. **PnP system** - Personal Needs & Preferences architecture
4. **Catalog mechanism** - Accessible content switching

**Priority 2: Medium Value**
5. **Test orchestration** - How qti3-test-vue3 manages hierarchy
6. **Outcome processing** - Their expression evaluation approach
7. **Certification testing** - What tests did they run for certification?

**Priority 3: Lower Value**
8. Vue-specific patterns - Less relevant to PIE-QTI's Svelte
9. Build configuration - Likely similar to PIE-QTI's setup

### 6.3 Collaboration Opportunities

**Potential Synergies:**
1. **Test Fixtures** - Share QTI 3.0 test items for validation
2. **Conformance Testing** - Compare implementations for compliance
3. **Best Practices** - Document QTI 3.0 interpretation ambiguities
4. **Transformation** - PIE-QTI's transform framework + amp-up-io's player
5. **Community** - Cross-promote projects, grow QTI 3.0 ecosystem

**Contact:**
- Email: administrator@amp-up.io
- GitHub: Open issues or discussions on repos

---

## 7. QTI 2.x → 3.0 Conversion Tools Assessment

### 7.1 Why Conversion Tools Matter

For PIE-QTI, conversion tools are important because:

1. **Migration Testing** - Validate PIE-QTI's QTI 2.x content against QTI 3.0
2. **Learning** - Understand practical conversion challenges
3. **Reference** - Compare conversion approaches
4. **Integration** - Potentially integrate into PIE-QTI's transform framework

### 7.2 Available Converters

**NCER-QuTIe qti-converter-rest**
- **Status:** Too new (15 commits, Nov 2024)
- **Documentation:** None
- **Recommendation:** Monitor, not ready for use

**qti-convert (TypeScript)**
- **Status:** Repository not found (404)
- **Recommendation:** May be private or deprecated

**qti30Upgrader (XSLT)**
- **Status:** Minimal information
- **Technology:** XSLT (XML transformation)
- **Recommendation:** Research further if details emerge

### 7.3 Conversion Challenges

Based on our QTI 3.0 analysis, converters must handle:

1. **Element Name Changes**
   - QTI 2.x: `<assessmentItem>`, `<choiceInteraction>`
   - QTI 3.0: `<qti-assessment-item>`, `<qti-choice-interaction>`

2. **Attribute Name Changes**
   - QTI 2.x: `responseIdentifier`, `maxChoices` (camelCase)
   - QTI 3.0: Likely `response-identifier`, `max-choices` (kebab-case)

3. **Required Attributes**
   - QTI 2.x: `timeDependent` optional
   - QTI 3.0: `time-dependent` required

4. **Test Structure**
   - QTI 2.x: Test → optional parts → sections
   - QTI 3.0: Test → **required** test-part → **required** section

5. **Custom Interactions**
   - QTI 2.x: `<customInteraction>`
   - QTI 3.0: `<qti-portable-custom-interaction>` with module system

6. **Metadata**
   - QTI 2.x: Limited metadata elements
   - QTI 3.0: 11 qtiMetadata elements

7. **Content Packaging**
   - QTI 2.x: IMS CP 1.1/1.2
   - QTI 3.0: Content Package 1.2 profile

### 7.4 Building Our Own Converter

If PIE-QTI builds QTI 2.x → 3.0 conversion:

**Advantages:**
- Leverage existing PIE transformation framework
- Use PIE as intermediate format: QTI 2.x → PIE → QTI 3.0
- Reuse 60-70% of existing codebase
- Control over conversion logic

**Approach:**
```
QTI 2.x → [to-pie] → PIE → [pie-to-qti3] → QTI 3.0
```

This is already in PIE-QTI's architecture - just need the `pie-to-qti3` plugin.

---

## 8. Recommendations for PIE-QTI

### 8.1 Immediate Actions (Next 30 Days)

**1. Study amp-up-io Implementation**
- Clone and run `qti3-item-player` locally
- Analyze how they parse QTI 3.0 XML (element names, attributes)
- Study their PCI implementation approach
- Document their PnP system architecture
- Test with sample QTI 3.0 items

**2. Reach Out to amp-up-io**
- Email: administrator@amp-up.io
- Topics:
  - Test fixtures and conformance tests
  - QTI 3.0 interpretation questions
  - Potential collaboration on test suite
  - Best practices for 1EdTech certification

**3. Analyze Conversion Tools**
- Monitor NCER-QuTIe qti-converter-rest development
- Research qti30Upgrader (XSLT approach)
- Document conversion challenges they face

**4. Extract amp-up-io Test Cases**
- Review their test fixtures (if available)
- Use as validation suite for PIE-QTI's QTI 3.0 work
- Identify edge cases they've solved

### 8.2 Architecture Decisions

**1. Framework Choice Validation**
- amp-up-io: Vue.js (framework-specific)
- Citolab: Web Components (framework-agnostic)
- **PIE-QTI:** Svelte + Web Components (framework-agnostic)

**Verdict:** ✅ PIE-QTI's choice is sound. Web Components offer more flexibility than Vue-only.

**2. Component Separation**
- Consider amp-up-io's pattern:
  - Separate stimulus player
  - Controller/orchestrator component
  - Independent item/test players

**Recommendation:** Review if PIE-QTI needs explicit `qti3-stimulus-player` package or if it's handled in item player.

**3. Certification Path**
- amp-up-io achieved 1EdTech certification
- **Question:** Is certification valuable for PIE-QTI?
- **Consideration:** Certification provides credibility, but requires effort

### 8.3 Strategic Positioning

**Scenario A: PIE-QTI Adds QTI 3.0 Support**

**Market Position:**
- **Only open source project** with both QTI 2.x AND 3.0 support
- Unique transformation framework (QTI 2.x ↔ PIE ↔ QTI 3.0)
- Web Components (more flexible than amp-up-io's Vue)
- Potential 1EdTech certification

**Competitive Advantage:**
1. Dual-version support (no migration cliff)
2. Transformation capabilities (content migration built-in)
3. Framework-agnostic (unlike amp-up-io)
4. PIE integration (unique value for Renaissance partners)

**Scenario B: PIE-QTI Remains QTI 2.x Only**

**Market Position:**
- Best QTI 2.x player (production-ready, 21/21 interactions)
- amp-up-io dominates QTI 3.0 space unopposed
- May lose relevance as market shifts to 3.0

**Risk:**
- If QTI 3.0 adoption accelerates, PIE-QTI falls behind
- Partners may choose amp-up-io for future-proofing

### 8.4 Collaboration vs. Competition

**Option 1: Collaborate with amp-up-io**

**Potential:**
- Share test fixtures and conformance tests
- Cross-reference implementations for edge cases
- Combined community growth
- PIE-QTI provides transformation, amp-up-io provides QTI 3.0 player
- Complementary rather than competitive

**Challenges:**
- Different frameworks (Svelte vs. Vue)
- Organizational coordination overhead
- May limit PIE-QTI's differentiation

**Option 2: Independent Development**

**Potential:**
- Full control over architecture and roadmap
- Differentiation through Web Components + transformation
- Can target different market segments

**Challenges:**
- Duplicate effort
- Smaller community split across projects
- Less validation from collaboration

**Recommendation:** **Hybrid approach**
1. Study amp-up-io for learning and validation
2. Build PIE-QTI's QTI 3.0 support independently
3. Collaborate on conformance testing and standards interpretation
4. Maintain friendly, complementary relationship

---

## 9. Technical Deep-Dive: What to Study in amp-up-io

### 9.1 High-Priority Code Study

**1. Element Parsing (qti3-item-player)**

File locations to examine:
- XML parsing utilities
- Element name handling (kebab-case)
- Attribute extraction

**What to learn:**
- How they normalize element names
- Attribute naming conventions in QTI 3.0
- Namespace handling

**How to study:**
```bash
git clone https://github.com/amp-up-io/qti3-item-player.git
cd qti3-item-player
npm install
npm run dev

# Search for parsing logic
grep -r "qti-choice-interaction" src/
grep -r "qti-assessment-item" src/
grep -r "getAttribute" src/
```

**2. PCI Implementation**

**What to learn:**
- AMD module loading mechanism
- Communication Bridge API
- JSON variable binding
- PCI lifecycle management

**Files to examine:**
- PCI module loader
- PCI bridge implementation
- Variable serialization/deserialization

**3. PnP System**

**What to learn:**
- Personal Needs & Preferences parsing
- Accommodation application logic
- Catalog content switching

**Questions to answer:**
- How are PnP profiles structured?
- How does player select alternate content?
- What PnP features are implemented?

### 9.2 Test Strategy

**Conformance Tests:**
1. Check if amp-up-io has public test suite
2. Review 1EdTech conformance test requirements
3. Identify test items used for certification

**Interoperability Tests:**
1. Create same QTI 3.0 item
2. Render in amp-up-io player
3. Compare with PIE-QTI's future implementation
4. Validate output consistency

### 9.3 Documentation Study

**Questions to Answer:**
1. What QTI 3.0 interactions are supported? (Not listed in README)
2. What are the known limitations?
3. What PCI modules are compatible?
4. What PnP profiles are tested?
5. What are the certification requirements?

---

## 10. Ecosystem Gaps and Opportunities

### 10.1 Current Gaps

| Gap | Impact | Opportunity for PIE-QTI |
|-----|--------|-------------------------|
| **No framework-agnostic QTI 3.0 player** | Limits adoption | ✅ Web Components advantage |
| **No bidirectional QTI 2.x ↔ 3.0 transform** | Hard to migrate content | ✅ Perfect fit for PIE-QTI |
| **Limited PCI ecosystem** | Custom interactions hard | ⚠️ Requires PCI support |
| **Small community** | Less validation | ⚠️ First-mover advantage |
| **No TypeScript player** | Type safety lacking | ✅ PIE-QTI's TypeScript strength |
| **No QTI 2.x + 3.0 dual support** | Forces migration | ✅ Major differentiator |

### 10.2 Opportunities for PIE-QTI

**1. Transformation Hub**
- Position as **the** tool for QTI 2.x ↔ QTI 3.0 migration
- QTI 2.x → PIE → QTI 3.0 pipeline
- Content library migration service

**2. Dual-Version Player**
- Only player supporting both QTI 2.x and 3.0
- Seamless version detection and routing
- No migration cliff for users

**3. Framework-Agnostic**
- Web Components work with React, Vue, Angular, Svelte, etc.
- Unlike amp-up-io's Vue-only approach
- Broader market appeal

**4. Enterprise Features**
- Vendor extension system
- Custom operator support
- Backend integration
- Already in PIE-QTI, extend to QTI 3.0

**5. Renaissance Ecosystem Integration**
- Native PIE support
- Partner-specific transformations
- Existing relationships

---

## 11. Conclusion

### 11.1 Ecosystem State

The QTI 3.0 open source ecosystem is **functional but small**:

- ✅ **One production-ready player** (amp-up-io)
- ⚠️ **Limited adoption** (< 30 stars)
- ⚠️ **Early-stage conversion tools** (NCER-QuTIe)
- ❌ **Most QTI projects remain on 2.x** (oat-sa, qtiworks, etc.)
- ✅ **1EdTech certification achieved** (amp-up-io)

### 11.2 PIE-QTI's Position

**Current State:**
- PIE-QTI is a strong QTI 2.x player with unique PIE integration
- No direct QTI 3.0 competitors in web components space
- Transformation framework is architecturally ready for QTI 3.0

**If QTI 3.0 Support Added:**
- Would be **only project with dual-version support**
- Unique transformation capabilities (2.x ↔ PIE ↔ 3.0)
- Framework-agnostic advantage over amp-up-io
- Strong competitive position

### 11.3 Key Takeaways

1. **amp-up-io is reference implementation** - Study their approach
2. **Conversion tools are immature** - Opportunity for PIE-QTI
3. **Small ecosystem** - First-mover advantage still available
4. **Web Components advantage** - More flexible than Vue-only
5. **Transformation is unique** - No other project offers this

### 11.4 Recommended Actions

**Immediate (Next 30 Days):**
1. ✅ Clone and study amp-up-io implementation
2. ✅ Contact amp-up-io for collaboration discussion
3. ✅ Review 1EdTech conformance requirements
4. ✅ Test PIE-QTI architecture readiness

**Short-Term (3-6 Months):**
1. Prototype QTI 3.0 parsing with element name mapper
2. Implement `pie-to-qti3` transformation plugin
3. Create QTI 2.x → 3.0 migration tool
4. Build initial QTI 3.0 player (foundation)

**Long-Term (6-18 Months):**
1. Complete QTI 3.0 player with PCI support
2. 1EdTech conformance certification
3. Community building and documentation
4. Position as **the** QTI transformation hub

---

## Appendix A: Repository Links

### QTI 3.0 Players
- [amp-up-io/qti3-item-player](https://github.com/amp-up-io/qti3-item-player) ⭐ 29
- [amp-up-io/qti3-item-player-vue3](https://github.com/amp-up-io/qti3-item-player-vue3) ⭐ 4
- [amp-up-io/qti3-test-vue3](https://github.com/amp-up-io/qti3-test-vue3) ⭐ 3
- [amp-up-io/qti3-stimulus-player](https://github.com/amp-up-io/qti3-stimulus-player) ⭐ 5
- [amp-up-io/qti3-item-player-controller](https://github.com/amp-up-io/qti3-item-player-controller) ⭐ 4

### QTI Components (Version Unclear)
- [Citolab/qti-components](https://github.com/Citolab/qti-components) ⭐ 15 (WIP, GPL-3.0)

### QTI 2.x → 3.0 Converters
- [NCER-QuTIe/qti-converter-rest](https://github.com/NCER-QuTIe/qti-converter-rest) ⭐ 0 (very new)

### QTI 2.x Only (Established)
- [oat-sa/qti-sdk](https://github.com/oat-sa/qti-sdk) ⭐ 86 (PHP, QTI 2.0-2.2)
- [OpenOLAT/qtiworks](https://github.com/OpenOLAT/qtiworks) ⭐ 3 (Java, QTI 2.1)

---

## Appendix B: Contact Information

**amp-up-io:**
- Email: administrator@amp-up.io
- GitHub: https://github.com/amp-up-io
- Location: United States

**1EdTech (formerly IMS Global):**
- Website: https://www.1edtech.org
- Certifications: https://site.imsglobal.org/certifications
- Forums: http://www.imsglobal.org/forums

**PIE Framework:**
- Website: https://pie-framework.org
- GitHub: https://github.com/pie-framework
- Maintainer: Renaissance Learning (MCRO implementation partner)

---

**Document End**
