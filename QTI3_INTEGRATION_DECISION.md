# QTI 3.0 Integration Decision: amp-up.io vs. Build Our Own

**Date:** January 24, 2026
**Decision Required:** Should PIE-QTI integrate amp-up.io's QTI 3 player or build its own?
**Context:** PIE-QTI is primarily a PIE conversion framework but needs QTI preview capabilities

---

## Executive Summary

**Recommendation: HYBRID APPROACH** (Use amp-up.io short-term, build own long-term)

After analyzing the amp-up.io QTI 3 player codebase in detail, the **technical debt and architectural mismatch** from integration likely outweighs the 4-6 week time savings. However, given PIE-QTI's primary focus on PIE conversion (not QTI playing), a pragmatic hybrid approach makes the most sense.

**Key Finding:** amp-up.io is **100% Vue-coupled** with **no recent maintenance** (0 commits in 6 months for Vue 2 version, 1 commit for Vue 3), making it a risky long-term dependency.

---

## Quick Comparison

| Factor | Integrate amp-up.io | Build Our Own |
|--------|-------------------|---------------|
| **Time to QTI 3 Support** | 4-6 weeks | 5-7 months |
| **Bundle Size Impact** | +250-350KB | ~250KB (optimized) |
| **Framework Overhead** | Vue 3 + Svelte | Svelte only |
| **Maintainability** | HIGH RISK (unmaintained) | Full control |
| **Customization** | LOW (Vue-coupled) | FULL |
| **Test Coverage** | 0% (no tests!) | Can be 80%+ |
| **1EdTech Certified** | ✅ Yes | Need to certify |
| **Long-term Viability** | ⚠️ Uncertain | ✅ Sustainable |

---

## Detailed Analysis

### 1. amp-up.io Architecture (Deal-Breakers)

#### Critical Issues

**1.1 100% Vue Coupling**
- All 169 components are Vue Single File Components (.vue files)
- QTI processing logic is **inseparable** from Vue reactivity
- Cannot extract core processing without complete rewrite
- No framework-agnostic API layer

**1.2 No Active Maintenance**
```
qti3-item-player (Vue 2):       0 commits in last 6 months
qti3-item-player-vue3 (Vue 3):  1 commit in last 6 months
Last meaningful update:         June 2025 (8 months ago)
```

**1.3 Zero Test Coverage**
- No Jest, Vitest, Mocha, or any test framework
- No CI/CD pipeline
- Relies entirely on manual testing
- **This is a RED FLAG for production use**

**1.4 Version Fragmentation**
- Vue 2 version: v1.1.20 (Vue 2 reached EOL Dec 31, 2024)
- Vue 3 version: v0.2.21 (still in beta, below v1.0.0)
- Neither receiving active updates

**1.5 Single Author Dependency**
- All projects authored by Paul Grudnitski (paul.grudnitski@amp-up.io)
- No visible team or community
- High bus factor risk

#### Integration Complexity

**To integrate amp-up.io into PIE-QTI would require:**

```typescript
// Current PIE-QTI architecture (clean)
PIE-QTI (Svelte) → @pie-qti/item-player (TS/Svelte) → Web Components

// With amp-up.io integration (messy)
PIE-QTI (Svelte) → Vue 3 Web Component Wrapper → amp-up.io Qti3Player (Vue) → 169 Vue components
```

**Effort:** 4-6 weeks
- Create Web Component wrapper around Vue app
- Build event bridge (Vue events → PIE-QTI events)
- Handle Shadow DOM isolation issues
- Bundle optimization (2 frameworks, 169 components)
- Testing across both frameworks

**Ongoing Cost:**
- Two-framework maintenance (Svelte + Vue)
- Security updates for Vue dependencies
- Version conflicts as PIE-QTI evolves
- Cannot customize without forking amp-up.io

---

### 2. Building Our Own QTI 3 Player

#### Advantages

**2.1 Architectural Alignment**
```typescript
// Clean PIE-QTI architecture for QTI 3
@pie-qti/qti-processing         // Already 90-100% reusable
  ↓
@pie-qti/qti3-item-player       // New: QTI 3 parsing + extractors
  ↓
@pie-qti/qti3-default-components // New: Svelte components
  ↓
Web Components (framework-agnostic)
```

**2.2 Code Reusability: 60-70%**
- Response processing operators: **100% reusable** (45+ operators)
- Runtime types & evaluation: **100% reusable**
- Assessment player logic: **85-90% reusable**
- Transform framework: **95-100% reusable**
- UI components: **20-30% reusable** (architecture + patterns)

See [QTI3_REUSABILITY_ANALYSIS.md](QTI3_REUSABILITY_ANALYSIS.md) for details.

**2.3 Test-Driven Development**
Unlike amp-up.io (0% test coverage), PIE-QTI has:
- Comprehensive unit tests
- E2E tests with Playwright
- Accessibility tests
- Conformance tests

Can achieve **80%+ test coverage** for QTI 3 player.

**2.4 Framework-Agnostic**
- Svelte components compile to Web Components
- No Vue runtime overhead
- Can be used in React, Vue, Angular, or vanilla JS
- Smaller bundle size

**2.5 Long-Term Maintainability**
- 100% control over codebase
- Can optimize for PIE-QTI's specific use cases
- Can add custom interactions easily
- Not dependent on external maintenance

**2.6 Learning from amp-up.io**
Can still use amp-up.io as **reference implementation**:
- Study their QTI 3 spec interpretation
- Use their test cases (if available)
- Compare behavior for correctness
- Validate edge cases

#### Effort Estimate

| Phase | Effort | What's Involved |
|-------|--------|----------------|
| **Core Parser** | 3-4 weeks | QTI 3 XML parsing, kebab-case elements, element name mapper |
| **Response Processing** | 2-3 weeks | Adapt existing operators for QTI 3 (minimal changes) |
| **Standard Interactions** | 4-6 weeks | Choice, Order, Match, Text Entry, etc. (15-20 components) |
| **Advanced Interactions** | 3-4 weeks | Gap Match, Hotspot, Graphics, etc. (10-15 components) |
| **PCI Support** | 1-2 weeks | Portable Custom Interaction framework |
| **Accessibility** | 2-3 weeks | PNP, Catalogs, 14 color themes |
| **Testing & QA** | 3-4 weeks | Unit + integration + E2E tests |
| **Documentation** | 1-2 weeks | API docs, examples, migration guide |
| **TOTAL** | **21-30 weeks** | **5-7 months with 1 engineer** |

**With 2 engineers:** 3-4 months
**With 3 engineers:** 2-3 months (with diminishing returns)

---

### 3. Bundle Size & Performance

#### amp-up.io Bundle Impact

**If integrated:**
- Vue 3 runtime: ~33KB gzipped
- Quill 2.0 editor: ~80-90KB gzipped
- Sweetalert2 alerts: ~15KB gzipped
- Tippy.js tooltips: ~20KB gzipped
- Other deps (axios, bignumber, etc.): ~30KB
- 169 Vue components: ~100-150KB gzipped
- **Total: ~250-350KB gzipped**

**Plus:**
- Two frameworks loaded (Svelte + Vue)
- Duplicate functionality (both have editors, alerts, tooltips)
- Cannot tree-shake unused interactions

#### Build Our Own Bundle

**Optimized QTI 3 player:**
- Core processing: ~50KB gzipped (reuse existing)
- 23 interactions: ~150KB gzipped (Svelte compiles small)
- Accessibility: ~20KB gzipped
- Utilities: ~30KB gzipped
- **Total: ~250KB gzipped**

**Benefits:**
- Tree-shakeable (only include used interactions)
- No framework duplication
- Modern build tooling (Bun, Vite, esbuild)
- Can optimize for specific use cases

---

### 4. PIE-QTI's Primary Focus

**Critical Context:** PIE-QTI is **primarily about PIE conversion**, not QTI playing.

#### Use Cases (Priority Order)

1. **Transform QTI → PIE** (Primary mission)
   - Need QTI 2.x parser ✅ (already have)
   - Need QTI 3.0 parser ❌ (don't have)
   - Don't strictly need QTI 3 **player** for this

2. **Preview Transformed Content** (Supporting feature)
   - Need QTI 2.x player ✅ (already have)
   - Need QTI 3.0 player ❌ (don't have)
   - Want good UX, but not core mission

3. **Validate Transformations** (Supporting feature)
   - Need to render before/after
   - Can use amp-up.io for validation
   - Or build lightweight QTI 3 previewer

#### Implication

**For transformation only:**
- Need QTI 3 **parsing** (3-4 weeks)
- Need QTI 3 → PIE **transformers** (6-8 weeks)
- Don't need full QTI 3 **player** (5-7 months)

**For preview:**
- Can use amp-up.io as external tool
- Or build minimal QTI 3 renderer (2-3 months)
- Or build full QTI 3 player (5-7 months)

**This changes the decision significantly!**

---

## Three Strategic Options

### Option A: Parser Only (Focus on Core Mission)

**Scope:**
- Build QTI 3.0 **parsing** infrastructure
- Build QTI 3.0 → PIE **transformers**
- Use amp-up.io for **preview** (external tool)

**Effort:** 3-4 months
- QTI 3 parser: 3-4 weeks
- QTI 3 → PIE transformers: 6-8 weeks
- PIE → QTI 3 transformers: 6-8 weeks
- Testing: 2-3 weeks

**Preview Strategy:**
- Link to amp-up.io demo site for QTI 3 preview
- Or embed amp-up.io player in iframe (isolated, no integration)
- Focus PIE-QTI's energy on transformation

**Pros:**
- ✅ Focused on core mission (transformation)
- ✅ Faster time to market (3-4 months)
- ✅ Avoid Vue integration complexity
- ✅ Can still preview via amp-up.io
- ✅ Leave player option open for later

**Cons:**
- ⚠️ Preview experience less integrated
- ⚠️ Users need to use external tool for QTI 3 preview
- ⚠️ Can't customize preview experience

**Recommendation:** ✅ **BEST for core mission focus**

---

### Option B: Integrate amp-up.io (Quick Preview Solution)

**Scope:**
- Build QTI 3.0 parsing + transformers (same as Option A)
- Integrate amp-up.io player for preview

**Effort:** 4-5 months
- QTI 3 parsing + transformers: 3-4 months
- amp-up.io integration: 4-6 weeks

**Pros:**
- ✅ Faster than building own player
- ✅ Integrated preview experience
- ✅ 1EdTech certified player

**Cons:**
- ❌ Vue 3 dependency and overhead
- ❌ 0% test coverage
- ❌ Unmaintained (1 commit in 6 months)
- ❌ Cannot customize without forking
- ❌ Bundle size +250-350KB
- ❌ Two-framework complexity

**Recommendation:** ⚠️ **Only if preview UX is critical**

---

### Option C: Build Full QTI 3 Player (Long-Term Investment)

**Scope:**
- Build QTI 3.0 parsing + transformers
- Build complete QTI 3.0 player (23 interactions, PCI, accessibility)

**Effort:** 7-10 months
- QTI 3 parsing + transformers: 3-4 months
- QTI 3 player: 5-7 months
- Can be done in parallel by different engineers

**Pros:**
- ✅ 100% control and customization
- ✅ Framework-agnostic (Web Components)
- ✅ Test-driven (80%+ coverage)
- ✅ Long-term sustainable
- ✅ Can optimize for PIE-QTI use cases
- ✅ Reuses 60-70% of existing codebase

**Cons:**
- ❌ Longest time to market (7-10 months)
- ❌ Need 1EdTech certification (1-2 months extra)
- ❌ Ongoing maintenance responsibility

**Recommendation:** ✅ **BEST if resources available and long-term vision**

---

### Option D: Hybrid Approach (Recommended)

**Phase 1 (Months 1-4): Parser + Transformers**
- Build QTI 3.0 parser
- Build QTI 3.0 ↔ PIE transformers
- Use amp-up.io externally for preview (iframe or link)
- Ship transformation capabilities

**Phase 2 (Months 4-10): Build Player (Optional)**
- Evaluate if integrated preview is needed
- If yes: Build own player (5-7 months)
- If no: Keep using amp-up.io externally

**Pros:**
- ✅ Fastest to core transformation capability (4 months)
- ✅ Defer player decision until validated
- ✅ Can pivot based on user feedback
- ✅ Minimal technical debt
- ✅ Focus on core mission first

**Cons:**
- ⚠️ Preview experience less integrated initially
- ⚠️ May need to build player later

**Recommendation:** ✅✅ **BEST - Pragmatic and flexible**

---

## Decision Matrix

| Criteria (Weight) | Option A: Parser Only | Option B: Integrate amp-up | Option C: Build Player | Option D: Hybrid |
|-------------------|---------------------|--------------------------|----------------------|-----------------|
| **Time to Market (30%)** | ✅ 3-4 months | ⚠️ 4-5 months | ❌ 7-10 months | ✅ 4 months |
| **Core Mission Focus (25%)** | ✅ High | ⚠️ Medium | ⚠️ Medium | ✅ High |
| **Technical Debt (20%)** | ✅ Low | ❌ High | ✅ Low | ✅ Low |
| **Long-term Maintainability (15%)** | ✅ Good | ❌ Poor | ✅ Excellent | ✅ Good |
| **Preview UX (10%)** | ⚠️ External | ✅ Integrated | ✅ Integrated | ⚠️ External → Integrated |
| **TOTAL SCORE** | **85/100** | **55/100** | **75/100** | **90/100** ⭐ |

**Winner: Option D (Hybrid Approach)**

---

## Recommended Strategy

### Phase 1: Transformation Focus (4 months)

**Deliverables:**
1. QTI 3.0 XML parser with element name mapper abstraction
2. QTI 3.0 → PIE transformation plugin (23 interactions)
3. PIE → QTI 3.0 transformation plugin (generators)
4. CLI tool for batch QTI 3.0 ↔ PIE conversion
5. Documentation and examples

**Preview Strategy (interim):**
- Link to amp-up.io demo site: `https://qti3-player-demo.amp-up.io/`
- Or: Embed amp-up.io player in iframe (isolated, no dependencies)
- Focus: Get transformation working perfectly

**Resources:** 2 engineers × 4 months = 8 engineer-months

**Why this first:**
- ✅ Core mission of PIE-QTI
- ✅ Enables QTI 3.0 content ingestion
- ✅ Partners can start using QTI 3.0 with PIE
- ✅ Validates QTI 3.0 demand before player investment

---

### Phase 2: Evaluate Player Need (Months 5-6)

**Questions to answer:**
1. How many users need integrated QTI 3 preview?
2. Is external amp-up.io preview sufficient?
3. Are there customization needs amp-up.io can't meet?
4. What's the business value of integrated preview?

**Decision Point:**
- **If preview demand is LOW:** Keep using amp-up.io externally (done!)
- **If preview demand is HIGH:** Proceed to Phase 3

---

### Phase 3: Build QTI 3 Player (Months 6-12, Optional)

**If proceeding, build own player:**
- Reuse 60-70% of existing PIE-QTI architecture
- 23 interactions + PCI + accessibility
- Test-driven (80%+ coverage)
- 1EdTech certification path

**Resources:** 2 engineers × 5-7 months = 10-14 engineer-months

**Why build our own (not integrate amp-up.io):**
- ❌ amp-up.io unmaintained (0-1 commits in 6 months)
- ❌ 0% test coverage
- ❌ Vue coupling prevents customization
- ❌ Vue 2 version is EOL
- ✅ We control our destiny
- ✅ Clean architecture alignment
- ✅ Can optimize for PIE-QTI use cases

---

## Risk Analysis

### Risks of Integrating amp-up.io

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Abandonment** | HIGH (0 commits in 6mo) | HIGH | Must fork or rebuild |
| **Security vulnerabilities** | MEDIUM (no updates) | HIGH | Cannot patch easily |
| **Vue 2 EOL** | CRITICAL (v1.1.20) | HIGH | Must use v0.2.21 |
| **Customization blocked** | CERTAIN | MEDIUM | Fork or rebuild |
| **Bundle bloat** | CERTAIN | MEDIUM | Accept cost |
| **Two-framework complexity** | CERTAIN | MEDIUM | Accept cost |
| **No tests** | CERTAIN | HIGH | Write integration tests |

### Risks of Building Our Own

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Longer development** | CERTAIN | MEDIUM | Phased approach |
| **Certification effort** | CERTAIN | MEDIUM | Budget 1-2 months |
| **Edge case bugs** | MEDIUM | MEDIUM | Use amp-up.io as reference |
| **Scope creep** | MEDIUM | MEDIUM | Strict MVP scope |

**Conclusion:** Building own player has **lower overall risk** than depending on unmaintained external project.

---

## Licensing & Legal

**amp-up.io:** MIT License
**PIE-QTI:** MIT License

**If integrating amp-up.io:**
- ✅ Fully compatible licenses
- ✅ Can use commercially
- ✅ Can modify
- ✅ Must include copyright notice

**Required attribution:**
```markdown
## Acknowledgments

This project uses the QTI 3 Player by Amp-up.io
(https://github.com/amp-up-io/qti3-item-player-vue3)
Licensed under MIT, Copyright 2022-2024 Amp-up.io, LLC
```

**No legal blockers to either approach.**

---

## Implementation Roadmap

### Recommended: Hybrid Approach (Option D)

#### Months 1-2: QTI 3 Parser

**Team:** 1 engineer

**Deliverables:**
- Element name mapper abstraction (handles kebab-case)
- QTI 3.0 XML parser (reuse @pie-qti/qti-processing patterns)
- AST builder updates for QTI 3 elements
- Unit tests

**Acceptance Criteria:**
- Can parse all QTI 3.0 standard interactions
- Test suite covers 80%+ of parser code
- Performance: < 100ms for typical item

---

#### Months 2-4: QTI 3 Transformers

**Team:** 2 engineers

**Deliverables:**
- `@pie-qti/qti3-to-pie` package (23 interaction transformers)
- `@pie-qti/pie-to-qti3` package (generators for all PIE models)
- CLI integration (`bun run pie-qti -- transform item.xml --format qti30:pie`)
- Test fixtures (QTI 3.0 samples)
- Documentation

**Acceptance Criteria:**
- All 23 QTI 3 interactions transform to PIE
- Lossless round-trip where possible
- Test coverage 80%+
- CLI commands working

---

#### Month 4: Preview Integration (Interim)

**Team:** 1 engineer

**Deliverables:**
- Transform web app shows QTI 3 items
- Preview via iframe embedding amp-up.io player
- Or: Link to amp-up.io demo site

**Acceptance Criteria:**
- QTI 3 items render in preview
- Side-by-side comparison (QTI 3 original → PIE transformed)

---

#### Months 5-6: Evaluation & Decision

**Team:** Product + Engineering

**Activities:**
- Collect user feedback on transformation
- Measure QTI 3 adoption
- Assess preview UX satisfaction
- Decide: Build own player or continue with external amp-up.io?

**Decision Criteria:**
- **Go to Phase 3 if:**
  - 5+ partners actively using QTI 3 transformation
  - Integrated preview is a top-3 requested feature
  - Customization needs identified (amp-up.io can't meet)
  - Budget available for 10-14 engineer-months

- **Stay with external amp-up.io if:**
  - Low QTI 3 adoption
  - External preview acceptable to users
  - Budget constraints

---

#### Months 6-12: Build QTI 3 Player (Optional)

**Team:** 2 engineers

**Deliverables:**
- `@pie-qti/qti3-item-player` package
- `@pie-qti/qti3-default-components` (23 interactions)
- `@pie-qti/qti3-assessment-player` (test orchestration)
- PCI support
- Accessibility (PNP, Catalogs, 14 themes)
- Test suite (80%+ coverage)
- Documentation

**Acceptance Criteria:**
- All 23 QTI 3 interactions render correctly
- Response processing works
- Adaptive items supported
- WCAG 2.2 Level AA compliance
- Test coverage 80%+
- Bundle size < 300KB gzipped

---

## Alternatives Considered

### Alternative 1: Fork amp-up.io

**Idea:** Fork amp-up.io and maintain our own version

**Pros:**
- Start with certified codebase
- Can customize over time
- Full control

**Cons:**
- ❌ Inherits Vue coupling
- ❌ Inherits 0% test coverage
- ❌ 169 Vue components to maintain
- ❌ Different architecture from PIE-QTI
- ❌ Must rewrite for Svelte anyway

**Verdict:** ❌ Not recommended - too much baggage

---

### Alternative 2: Contribute to amp-up.io

**Idea:** Contribute improvements to amp-up.io project

**Pros:**
- Benefits entire community
- Shared maintenance burden

**Cons:**
- ❌ Project appears unmaintained (no response likely)
- ❌ Still Vue-coupled
- ❌ Can't change fundamental architecture
- ❌ PIE-QTI needs control over roadmap

**Verdict:** ⚠️ Could explore, but low probability of success

---

### Alternative 3: Minimal QTI 3 Renderer

**Idea:** Build lightweight QTI 3 renderer (not full player)

**Scope:**
- Render QTI 3 items (display only)
- No response processing
- No interactivity
- Just for preview

**Effort:** 2-3 months

**Pros:**
- ✅ Faster than full player
- ✅ Good enough for preview
- ✅ Clean architecture
- ✅ Can upgrade to full player later

**Cons:**
- ⚠️ Users can't interact with items
- ⚠️ Can't test response processing

**Verdict:** ✅ **Strong alternative to full player** - consider for Phase 2

---

## Final Recommendation

### PRIMARY RECOMMENDATION: Hybrid Approach (Option D)

**Phase 1 (Months 1-4):** Build QTI 3 parser + transformers
**Phase 2 (Months 5-6):** Evaluate player need
**Phase 3 (Months 6-12):** Build own player if justified

**Why:**
1. ✅ **Fastest to core mission** (QTI 3 transformation in 4 months)
2. ✅ **Minimal technical debt** (no Vue integration)
3. ✅ **Flexible** (can pivot based on feedback)
4. ✅ **Focused** (parser + transformers first, player later)
5. ✅ **Pragmatic** (use amp-up.io externally for preview)

**Next Steps:**
1. Approve 4-month budget for Phase 1 (parser + transformers)
2. Assign 2 engineers
3. Set up QTI 3 test fixtures
4. Contact amp-up.io for collaboration on conformance
5. Begin implementation

---

## Questions to Answer Before Starting

### Business Questions

1. **How many partners need QTI 3.0 support?**
   - If < 3: Defer entire project
   - If 3-5: Proceed with Phase 1
   - If > 5: Proceed with full player

2. **What's the urgency?**
   - If < 6 months: Must use amp-up.io (no time to build)
   - If 6-12 months: Hybrid approach works
   - If > 12 months: Build our own from start

3. **What's the budget?**
   - Phase 1 only: 8 engineer-months
   - Phase 1 + 3: 18-22 engineer-months

### Technical Questions

1. **Can we iframe amp-up.io player without integration?**
   - Test: Embed amp-up.io demo in iframe
   - If yes: Avoids all Vue integration complexity

2. **Do we need interactive preview or display-only?**
   - If display-only: Minimal renderer (2-3 months)
   - If interactive: Full player (5-7 months)

3. **What interactions do partners actually use?**
   - If only 5-10 interactions: Can build subset faster
   - If all 23: Need full implementation

4. **Is 1EdTech certification required?**
   - If yes: Add 1-2 months to timeline
   - If no: Can ship without certification

---

## Contact & Resources

**amp-up.io:**
- Email: administrator@amp-up.io
- Paul Grudnitski: paul.grudnitski@amp-up.io
- GitHub: https://github.com/amp-up-io

**1EdTech Certification:**
- Website: https://www.1edtech.org/certifications
- QTI 3 Conformance: Basic + Advanced levels

**PIE-QTI Team:**
- Decision maker: [Your name]
- Engineering lead: [Name]
- Product: [Name]

---

## Appendix: Technical Deep-Dive

See separate documents:
- [QTI3_SUPPORT_ANALYSIS.md](QTI3_SUPPORT_ANALYSIS.md) - Overall QTI 3 analysis
- [QTI3_REUSABILITY_ANALYSIS.md](QTI3_REUSABILITY_ANALYSIS.md) - Code reusability study
- [QTI3_OPEN_SOURCE_ECOSYSTEM.md](QTI3_OPEN_SOURCE_ECOSYSTEM.md) - Ecosystem survey

---

**Document End**

**Decision Required By:** [Date]
**Decision Owner:** [Name]
**Approval:** [ ] Approved  [ ] Rejected  [ ] More Info Needed
