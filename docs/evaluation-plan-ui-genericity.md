# QTI Interaction Plugins: UI Genericity Evaluation Plan

**Date:** 2026-01-09
**Purpose:** Assess whether UI code in QTI interaction handler plugins is generic enough to work across a wide range of content, or if it's been optimized for specific test examples.

---

## Executive Summary

This evaluation plan provides a comprehensive framework for assessing the genericity of 17 QTI interaction plugins across dimensions including: hard-coded assumptions, layout flexibility, content diversity support, edge case handling, accessibility, and reusability patterns.

**Key Recommendation:** Based on initial code review, the implementations show strong genericity patterns, but this plan identifies specific areas requiring systematic validation to ensure robustness across diverse educational content.

---

## 1. Scope of Evaluation

### Interactions to Evaluate (17 total)

| Interaction Type | Tag Name | Complexity | Priority |
|-----------------|----------|------------|----------|
| choiceInteraction | pie-qti-choice | Low | High |
| sliderInteraction | pie-qti-slider | Low | High |
| orderInteraction | pie-qti-order | Medium | High |
| matchInteraction | pie-qti-match | Medium | High |
| associateInteraction | pie-qti-associate | Medium | High |
| gapMatchInteraction | pie-qti-gap-match | Medium | High |
| graphicGapMatchInteraction | pie-qti-graphic-gap-match | High | High |
| hotspotInteraction | pie-qti-hotspot | Medium | Medium |
| hottextInteraction | pie-qti-hottext | Medium | Medium |
| selectPointInteraction | pie-qti-select-point | Medium | Medium |
| graphicOrderInteraction | pie-qti-graphic-order | High | Medium |
| graphicAssociateInteraction | pie-qti-graphic-associate | High | Medium |
| positionObjectInteraction | pie-qti-position-object | High | High |
| endAttemptInteraction | pie-qti-end-attempt | Low | Low |
| customInteraction | pie-qti-custom | Variable | Low |
| extendedTextInteraction | pie-qti-extended-text | Medium | High |
| mediaInteraction | pie-qti-media | Low | Medium |

---

## 2. Evaluation Dimensions

### 2.1 Hard-Coded Assumptions

**Goal:** Identify any values, sizes, or behaviors that are specific to test examples rather than driven by data.

#### Areas to Check:

**Layout & Sizing:**
- ✅ **GOOD**: Most components use data-driven dimensions (e.g., `parsedInteraction.imageData.width`)
- ⚠️ **CHECK**: Fallback dimensions (e.g., `width: '50px'` defaults in [PositionObjectInteraction.svelte:68-69](packages/qti2-default-components/src/plugins/position-object/PositionObjectInteraction.svelte#L68-L69))
- ⚠️ **CHECK**: Fixed min/max widths in layouts (e.g., `min-width: 280px` in [PositionObjectInteraction.svelte:390](packages/qti2-default-components/src/plugins/position-object/PositionObjectInteraction.svelte#L390))

**Example Hard-Coded Values Found:**
```svelte
// PositionObjectInteraction.svelte:68-70
const width = parseInt(stage.objectData.width || '50');
const height = parseInt(stage.objectData.height || '50');

// GraphicGapMatchInteraction.svelte:228
return { x: coords[0], y: coords[1], width: 40, height: 40 }; // Poly fallback
```

**Cardinality & Constraints:**
- ✅ **GOOD**: Components respect `maxChoices`, `minChoices`, `matchMax`, `matchMin` from interaction data
- ✅ **GOOD**: Dynamic enabling/disabling based on constraints

**Visual Styling:**
- ✅ **GOOD**: Uses CSS variables and DaisyUI theme tokens (e.g., `var(--color-base-300)`)
- ✅ **GOOD**: Fallback styles when Tailwind/DaisyUI not available
- ⚠️ **CHECK**: Some specific color values for states (e.g., `#10b981` for success in [GraphicGapMatchInteraction.svelte:349](packages/qti2-default-components/src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte#L349))

**Text & Labels:**
- ✅ **GOOD**: Uses `{@html}` for rendering content, supporting rich text
- ✅ **GOOD**: Labels come from interaction data, not hard-coded
- ⚠️ **CHECK**: UI instruction text is English-only (e.g., "Drag objects onto the canvas" in [PositionObjectInteraction.svelte:285](packages/qti2-default-components/src/plugins/position-object/PositionObjectInteraction.svelte#L285))

#### Test Cases Needed:

1. **Extreme Dimensions:**
   - Very small images (50×50px)
   - Very large images (2000×1500px)
   - Extreme aspect ratios (1:10, 10:1)
   - Mobile viewport constraints

2. **Content Volume:**
   - 2 choices vs 20 choices
   - Very long text in choices (100+ characters)
   - Very short text ("A", "B")
   - Unicode, emoji, mathematical notation

3. **Constraint Variations:**
   - `maxChoices=0` (unlimited)
   - `minChoices > maxChoices` (invalid, but should handle gracefully)
   - `matchMax=1` vs `matchMax=100`
   - All constraints at boundaries

---

### 2.2 Layout Flexibility

**Goal:** Ensure layouts adapt to different content amounts and viewport sizes.

#### Current Patterns:

**Responsive Design:**
- ✅ **GOOD**: Uses flexbox/grid with breakpoints
- ✅ **GOOD**: Mobile-first approach (e.g., [MatchDragDrop.svelte:252-256](packages/qti2-default-components/src/shared/components/MatchDragDrop.svelte#L252-L256))
- ⚠️ **CHECK**: Fixed widths for palettes (e.g., `18rem` in [PositionObjectInteraction.svelte:405](packages/qti2-default-components/src/plugins/position-object/PositionObjectInteraction.svelte#L405))

**Overflow Handling:**
- ✅ **GOOD**: `truncate`, `overflow-hidden` classes used appropriately
- ⚠️ **CHECK**: Long lists without scroll containers
- ⚠️ **CHECK**: Canvas/stage areas with very large images

**Accessibility of Layout:**
- ✅ **GOOD**: Semantic HTML with `role` attributes
- ✅ **GOOD**: `aria-label`, `aria-describedby` for screen readers
- ✅ **GOOD**: Focus management for keyboard navigation

#### Test Cases Needed:

1. **Viewport Sizes:**
   - Mobile (320px width)
   - Tablet (768px width)
   - Desktop (1920px width)
   - Portrait vs landscape orientation

2. **Content Overflow:**
   - 50+ choice options
   - Very long prompts (500+ words)
   - Deeply nested HTML in choice text
   - Mixed content (text + images + math)

3. **Layout Edge Cases:**
   - Single item (does UI still make sense?)
   - Empty optional fields (no prompt, no labels)
   - RTL languages (Arabic, Hebrew)

---

### 2.3 Content Diversity Support

**Goal:** Verify support for diverse educational content across subjects and grade levels.

#### Current Capabilities:

**Rich Content Support:**
- ✅ **GOOD**: `{@html}` rendering supports HTML content
- ✅ **GOOD**: SVG support (inline and external)
- ✅ **GOOD**: Math typesetting via `typesetAction` in [ChoiceInteraction.svelte:59](packages/qti2-default-components/src/plugins/choice/ChoiceInteraction.svelte#L59)
- ⚠️ **CHECK**: Image formats (PNG, JPG, SVG, WebP)
- ⚠️ **CHECK**: Media formats (audio/video codecs)

**Subject Areas Represented in Samples:**
- Math (fractions, algebra, geometry)
- Science (solar system, anatomy, earth science)
- ELA (reading comprehension, grammar)
- General knowledge (geography, capitals)

**Grade Bands in Evals:**
- K-2, 3-6, 6-8, 9-12 classifications present
- ⚠️ **CHECK**: Age-appropriate UI complexity for each band

#### Test Cases Needed:

1. **Subject-Specific Content:**
   - Chemistry: molecular diagrams, equations
   - Music: notation, audio clips
   - Art: high-resolution images, color matching
   - CS/Programming: code blocks, syntax highlighting
   - Social Studies: maps, timelines, historical documents

2. **Multimedia:**
   - Audio-only interactions
   - Video-based questions
   - Interactive diagrams (zoomable, pannable)
   - Animated GIFs/videos as objects

3. **Language & Localization:**
   - Non-English languages (Spanish, Chinese, etc.)
   - RTL scripts
   - Special characters (diacritics, non-Latin scripts)
   - Math notation (LaTeX, MathML)

---

### 2.4 Edge Cases & Boundary Conditions

**Goal:** Identify how interactions handle unusual or invalid inputs.

#### Known Vulnerabilities:

**Data Validation:**
- ⚠️ **CHECK**: No interaction data provided (handled with error message)
- ⚠️ **CHECK**: Malformed coordinate strings (e.g., `"abc,def"` instead of `"10,20"`)
- ⚠️ **CHECK**: Missing required fields in interaction data
- ⚠️ **CHECK**: Circular references or infinite loops

**Response State:**
- ✅ **GOOD**: Handles `null` and `undefined` responses
- ⚠️ **CHECK**: Very large response arrays (1000+ items)
- ⚠️ **CHECK**: Duplicate identifiers in responses
- ⚠️ **CHECK**: Invalid identifier references

**User Interactions:**
- ⚠️ **CHECK**: Rapid clicking/dragging
- ⚠️ **CHECK**: Simultaneous touch points (multi-touch)
- ⚠️ **CHECK**: Browser zoom levels (50%, 200%)
- ⚠️ **CHECK**: Browser back/forward navigation

#### Test Cases Needed:

1. **Invalid Data:**
   - Empty arrays for required fields
   - Negative numbers for dimensions
   - NaN/Infinity values
   - SQL injection attempts in text fields (if stored)
   - XSS attempts in HTML content

2. **Constraint Violations:**
   - Trying to add more items than `maxChoices`
   - Submitting fewer items than `minChoices`
   - Dragging when `disabled=true`

3. **Performance Stress:**
   - 100+ choices in a single interaction
   - 50+ simultaneous position objects
   - Very large images (10MB+)
   - Rapid state changes (100 changes/second)

---

### 2.5 Shared Component Reusability

**Goal:** Assess whether shared components are truly generic or coupled to specific use cases.

#### Current Shared Components:

| Component | Used By | Genericity Score | Notes |
|-----------|---------|------------------|-------|
| [ShadowBaseStyles.svelte](packages/qti2-default-components/src/shared/components/ShadowBaseStyles.svelte) | All | ⭐⭐⭐⭐⭐ | Pure CSS injection, zero coupling |
| [ItemBody.svelte](packages/qti2-default-components/src/shared/components/ItemBody.svelte) | Item renderer | ⭐⭐⭐⭐ | Generic HTML renderer |
| [SortableList.svelte](packages/qti2-default-components/src/shared/components/SortableList.svelte) | Order, GraphicOrder | ⭐⭐⭐⭐⭐ | Highly generic, accepts any `Item[]` |
| [MatchDragDrop.svelte](packages/qti2-default-components/src/shared/components/MatchDragDrop.svelte) | Match, Associate | ⭐⭐⭐⭐⭐ | Generic pair management |
| [RichTextEditor.svelte](packages/qti2-default-components/src/shared/components/RichTextEditor.svelte) | ExtendedText | ⭐⭐⭐⭐ | Generic WYSIWYG editor |
| [DragHandle.svelte](packages/qti2-default-components/src/shared/components/DragHandle.svelte) | Multiple | ⭐⭐⭐⭐⭐ | Pure visual indicator |
| [DrawingCanvas.svelte](packages/qti2-default-components/src/shared/components/DrawingCanvas.svelte) | Drawing | ⭐⭐⭐⭐ | Generic canvas wrapper |
| [FileUpload.svelte](packages/qti2-default-components/src/shared/components/FileUpload.svelte) | Upload | ⭐⭐⭐⭐ | Generic file input |

**Reusability Patterns Found:**
- ✅ **GOOD**: Props-driven interfaces
- ✅ **GOOD**: Callback patterns (`onPairsChange`, `onReorder`)
- ✅ **GOOD**: Minimal styling, allows part-based customization
- ✅ **GOOD**: No global state dependencies

#### Test Cases Needed:

1. **Cross-Context Usage:**
   - Use MatchDragDrop with non-QTI data
   - Use SortableList outside of order interactions
   - Embed components in non-Svelte contexts

2. **Customization:**
   - Apply custom themes via CSS parts
   - Override default behaviors via props
   - Extend components with slots (if supported)

---

### 2.6 Accessibility (A11y)

**Goal:** Ensure interactions work for users with disabilities.

#### Current A11y Features:

**Keyboard Navigation:**
- ✅ **GOOD**: Full keyboard support (Tab, Space, Enter, Arrow keys, Escape)
- ✅ **GOOD**: Focus management with visible indicators
- ✅ **GOOD**: `tabindex` used appropriately
- ⚠️ **CHECK**: Tab order logical and consistent

**Screen Reader Support:**
- ✅ **GOOD**: `aria-label`, `aria-describedby`, `aria-live` used extensively
- ✅ **GOOD**: Announcements for state changes (e.g., [GraphicGapMatchInteraction.svelte:128](packages/qti2-default-components/src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte#L128))
- ✅ **GOOD**: Instructions provided via `sr-only` elements
- ⚠️ **CHECK**: All interactive elements have accessible names

**Visual Accessibility:**
- ✅ **GOOD**: Color not the only indicator (uses borders, text)
- ⚠️ **CHECK**: Contrast ratios meet WCAG AA (4.5:1 for text)
- ⚠️ **CHECK**: Focus indicators visible and distinct
- ⚠️ **CHECK**: Text scales appropriately (up to 200% zoom)

#### Test Cases Needed:

1. **Screen Reader Testing:**
   - NVDA (Windows)
   - JAWS (Windows)
   - VoiceOver (macOS/iOS)
   - TalkBack (Android)

2. **Keyboard-Only Navigation:**
   - Complete entire interaction without mouse
   - Verify focus order
   - Test all shortcuts (Space, Enter, Escape, Arrows)

3. **Visual Impairments:**
   - High contrast mode
   - Grayscale mode (color blindness simulation)
   - 200% browser zoom
   - Low vision (magnification software)

4. **Motor Impairments:**
   - Large click targets (44×44px minimum)
   - Forgiving drag-and-drop (generous drop zones)
   - Alternative input methods (speech recognition)

---

## 3. Current Sample Coverage Analysis

### Existing Samples by Interaction Type:

| Interaction | Sample Count | Diversity Score | Gap Areas |
|------------|--------------|-----------------|-----------|
| Choice | 4 | ⭐⭐⭐ | Need: 10+ choices, images in choices, math heavy |
| Order | 1 | ⭐⭐ | Need: long lists (10+), mixed content |
| Match | 1 | ⭐⭐ | Need: asymmetric sets, many-to-many |
| Associate | 1 | ⭐⭐ | Need: large groups, complex cardinality |
| GapMatch | 1 | ⭐⭐ | Need: inline math, nested gaps |
| GraphicGapMatch | 6 | ⭐⭐⭐⭐ | Good diversity across subjects |
| Hotspot | 2 | ⭐⭐⭐ | Good (basic + partial credit) |
| Hottext | 2 | ⭐⭐⭐ | Good (single + multiple) |
| Slider | 1 | ⭐⭐ | Need: negative ranges, decimals, large ranges |
| PositionObject | 1 | ⭐⭐ | Need: many objects, small canvas, text-only objects |
| GraphicOrder | 1 | ⭐⭐ | Need: many items, complex graphics |
| SelectPoint | 1 | ⭐⭐ | Need: precise placement, multiple points |
| ExtendedText | 2 | ⭐⭐⭐ | Good (single + multiple with constraints) |
| Media | 2 | ⭐⭐⭐ | Good (audio + video) |

**Overall Coverage:** ~40% of what's needed for comprehensive validation

---

## 4. Recommended Test Matrix

### Priority 1: High-Value, High-Risk Interactions

**PositionObjectInteraction:**
- ❌ 1+ objects (current samples only test 2-4)
- ❌ Text-only objects (no image/SVG)
- ❌ Tiny canvas (200×150px)
- ❌ Huge canvas (2000×1500px)
- ❌ `centerPoint=false` (test different coordinate modes)
- ❌ Objects larger than canvas

**GraphicGapMatchInteraction:**
- ✅ Multiple subjects (good coverage)
- ❌ Non-rectangular hotspots (complex polygons)
- ❌ Overlapping hotspots
- ❌ Very small hotspots (precise placement)
- ❌ No visual diagram (stress audio/text-only fallback)

**ChoiceInteraction:**
- ❌ 20+ choices (pagination needed?)
- ❌ Images as choices (not just text)
- ❌ Math-heavy choices (every option has equations)
- ❌ Nested HTML (tables, lists in choices)
- ❌ Mixed LTR/RTL text

### Priority 2: Medium Complexity Interactions

**MatchInteraction/AssociateInteraction:**
- ❌ Asymmetric sets (5 sources, 10 targets)
- ❌ Many-to-many matching (`matchMax > 1` for multiple items)
- ❌ Very long text in items (50+ char)
- ❌ Images in source/target items

**OrderInteraction:**
- ❌ 15+ items to reorder
- ❌ Items with images/rich content
- ❌ Horizontal orientation stress test

**SliderInteraction:**
- ❌ Negative ranges (-100 to 100)
- ❌ Decimal steps (0.01 precision)
- ❌ Very large ranges (0 to 1,000,000)
- ❌ Reverse direction (max on left)

### Priority 3: Simpler Interactions (Lower Risk)

**HottextInteraction:**
- ❌ Very long passage (1000+ words)
- ❌ Inline images within text
- ❌ Math notation in passage

**MediaInteraction:**
- ❌ Live streaming sources
- ❌ Subtitle/caption tracks
- ❌ Multiple audio/video formats

---

## 5. Evaluation Methodology

### Phase 1: Static Code Analysis (Done)
- ✅ Review interaction plugin source code
- ✅ Identify hard-coded values and assumptions
- ✅ Assess shared component reusability
- ✅ Document layout and styling patterns

### Phase 2: Automated Testing
1. **Create New Test Fixtures:**
   - Generate edge case QTI XML items for each interaction
   - Include boundary conditions, extreme values, diverse content
   - Target: 5-10 new test items per interaction type

2. **Extend Playwright Eval Suite:**
   - Add new eval specs to `/docs/evals/qti2-default-components/*/evals.yaml`
   - Cover missing test scenarios from matrix above
   - Run against updated sample set

3. **Visual Regression Testing:**
   - Capture screenshots across viewport sizes
   - Test with different themes (light, dark, high contrast)
   - Verify rendering consistency

### Phase 3: Manual Testing
1. **Cross-Browser Testing:**
   - Chrome, Firefox, Safari, Edge
   - Mobile browsers (iOS Safari, Chrome Android)

2. **Assistive Technology Testing:**
   - Screen readers (see A11y section)
   - Keyboard-only navigation
   - Voice control (Dragon, Voice Access)

3. **Real-World Content Testing:**
   - Partner with content creators to test with production items
   - Gather feedback on usability and edge cases encountered

### Phase 4: Continuous Monitoring
1. **Add Metrics:**
   - Error rates by interaction type
   - Performance metrics (render time, interaction latency)
   - User feedback scores (if available)

2. **Regression Testing:**
   - Run full eval suite on every commit
   - Visual diff checks for UI changes
   - A11y audits in CI/CD pipeline

---

## 6. Risk Assessment

### High Risk Areas (Require Immediate Attention)

1. **Hard-Coded Dimensions:**
   - **Risk:** UI breaks with unusual image sizes or object counts
   - **Mitigation:** Add dynamic sizing with min/max constraints
   - **Test:** Create items with extreme dimensions

2. **Internationalization:**
   - **Risk:** UI text is English-only, not translatable
   - **Mitigation:** Externalize all UI strings to i18n system
   - **Test:** Render with non-English languages

3. **Performance with Large Data Sets:**
   - **Risk:** Lag or crashes with 50+ items
   - **Mitigation:** Virtual scrolling, pagination, lazy rendering
   - **Test:** Load tests with 100+ items

### Medium Risk Areas

4. **Color Contrast:**
   - **Risk:** Some state indicators may not meet WCAG AA
   - **Mitigation:** Audit all color combinations, add patterns/icons
   - **Test:** Automated contrast checker, manual review

5. **Mobile Touch Interactions:**
   - **Risk:** Drag-and-drop may be finicky on small screens
   - **Mitigation:** Increase touch target sizes, add haptic feedback
   - **Test:** Manual testing on various devices

### Low Risk Areas

6. **Browser Compatibility:**
   - **Risk:** Minor rendering differences across browsers
   - **Mitigation:** Polyfills, feature detection
   - **Test:** Cross-browser matrix

---

## 7. Success Criteria

An interaction plugin is considered **"generic enough"** if it meets ALL of the following:

### Functional Criteria:
✅ **Data-Driven:** All visual and behavioral elements derive from interaction data, not constants
✅ **Constraint-Compliant:** Respects all QTI cardinality and matching constraints
✅ **Error-Tolerant:** Handles missing/malformed data gracefully without crashing
✅ **Responsive:** Adapts to viewport sizes from 320px to 1920px width

### Content Criteria:
✅ **Subject-Agnostic:** Works equally well for math, science, ELA, social studies
✅ **Grade-Flexible:** UI complexity appropriate across K-12 spectrum
✅ **Media-Diverse:** Supports text, images, SVG, audio, video, math notation
✅ **Locale-Ready:** No hard-coded English text, supports RTL languages

### Accessibility Criteria:
✅ **WCAG AA Compliant:** Meets contrast, keyboard, screen reader requirements
✅ **Keyboard-Navigable:** All interactions completable without mouse
✅ **Screen-Reader Friendly:** All states and changes announced properly
✅ **Motor-Accessible:** Touch targets ≥44px, forgiving drag-and-drop

### Performance Criteria:
✅ **Scalable:** Handles 2× average content volume without degradation
✅ **Fast:** Initial render <500ms, interactions <100ms latency
✅ **Memory-Efficient:** No memory leaks, stable with repeated use

---

## 8. Action Items

### Immediate (Next 2 Weeks):
1. ✅ **Complete this evaluation plan**
2. ⬜ **Create 50 new edge-case test items** (10 per high-priority interaction)
3. ⬜ **Add corresponding eval specs** to `/docs/evals/`
4. ⬜ **Run Playwright suite** and document failures
5. ⬜ **Perform accessibility audit** with axe-core or similar

### Short-Term (Next Month):
6. ⬜ **Fix critical issues** identified in testing (hard-coded values, layout breaks)
7. ⬜ **Add i18n support** for UI strings
8. ⬜ **Implement virtual scrolling** for large lists (if needed)
9. ⬜ **Cross-browser testing** (Chrome, Firefox, Safari, Edge)
10. ⬜ **Mobile device testing** (iOS, Android)

### Long-Term (Next Quarter):
11. ⬜ **Partner with content creators** for real-world testing
12. ⬜ **Set up visual regression testing** in CI/CD
13. ⬜ **Create component documentation** with usage guidelines
14. ⬜ **Establish performance benchmarks** and monitoring

---

## 9. Key Findings from Initial Review

### Strengths:
✅ **Excellent reusability patterns** in shared components
✅ **Strong accessibility foundation** (keyboard, ARIA, screen reader support)
✅ **Flexible styling** with CSS variables and part-based customization
✅ **Data-driven architecture** minimizes hard-coded assumptions
✅ **Touch support** via `touchDrag` helper across drag interactions

### Areas for Improvement:
⚠️ **Internationalization:** UI text is hard-coded in English
⚠️ **Fallback dimensions:** Some default sizes may not suit all contexts
⚠️ **Color-only indicators:** A few state changes rely solely on color
⚠️ **Limited sample diversity:** Current test suite covers ~40% of edge cases
⚠️ **No pagination/virtualization:** Large lists (50+ items) untested

### Critical Gaps:
❌ **No RTL language testing**
❌ **No extreme dimension testing** (very large/small canvases)
❌ **No performance benchmarks** for large data sets
❌ **Limited multimedia format testing** (codecs, live streams)
❌ **No multi-touch gesture testing** (pinch-zoom, etc.)

---

## 10. Conclusion

The QTI interaction plugins demonstrate **strong foundational genericity** with well-designed data-driven architectures and excellent reusable components. However, **systematic testing across edge cases is needed** to validate this genericity claim comprehensively.

**Recommendation:** Proceed with Phase 2 (Automated Testing) to create and validate the test matrix outlined in Section 4. This will provide empirical evidence of genericity and identify any remaining optimizations specific to current test examples.

**Estimated Effort:**
- Phase 2 (Test Creation): 2-3 weeks
- Phase 3 (Manual Testing): 1-2 weeks
- Phase 4 (Remediation): 2-4 weeks (depending on findings)

**Total Timeline:** 6-10 weeks for complete evaluation and remediation.

---

## Appendix A: Sample Test Item Templates

### A.1 Extreme Dimension PositionObject

```xml
<positionObjectInteraction responseIdentifier="RESPONSE" maxChoices="0">
  <prompt>Place the markers on the tiny map.</prompt>
  <object type="image/png" data="tiny-map.png" width="100" height="75"/>
  <positionObjectStage identifier="marker1" matchMax="5">
    <object type="image/svg+xml" data="marker.svg" width="10" height="10"/>
  </positionObjectStage>
</positionObjectInteraction>
```

### A.2 Large Choice Set

```xml
<choiceInteraction responseIdentifier="RESPONSE" maxChoices="0">
  <prompt>Select all prime numbers.</prompt>
  <simpleChoice identifier="c1">2</simpleChoice>
  <simpleChoice identifier="c2">3</simpleChoice>
  <!-- ... 18 more choices ... -->
  <simpleChoice identifier="c20">59</simpleChoice>
</choiceInteraction>
```

### A.3 RTL Language Choice

```xml
<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" xml:lang="ar">
  <prompt>ما هي عاصمة مصر؟</prompt>
  <simpleChoice identifier="c1">القاهرة</simpleChoice>
  <simpleChoice identifier="c2">الإسكندرية</simpleChoice>
  <simpleChoice identifier="c3">الجيزة</simpleChoice>
</choiceInteraction>
```

---

## Appendix B: Evaluation Checklist

Use this checklist to track progress:

**Phase 1: Static Analysis**
- [x] Review all interaction plugin source code
- [x] Document hard-coded values
- [x] Assess shared component reusability
- [x] Identify accessibility patterns

**Phase 2: Test Creation**
- [ ] Create edge case QTI items (50+)
- [ ] Write eval specs for new items
- [ ] Set up visual regression baseline

**Phase 3: Automated Testing**
- [ ] Run Playwright eval suite
- [ ] Analyze failures and edge cases
- [ ] Run accessibility audits (axe-core)
- [ ] Performance profiling

**Phase 4: Manual Testing**
- [ ] Cross-browser testing (4+ browsers)
- [ ] Mobile device testing (iOS + Android)
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Keyboard-only navigation testing

**Phase 5: Remediation**
- [ ] Fix critical issues
- [ ] Add i18n support
- [ ] Implement missing features
- [ ] Update documentation

**Phase 6: Validation**
- [ ] Re-run full test suite
- [ ] Get stakeholder sign-off
- [ ] Deploy to staging for user testing
- [ ] Collect feedback and iterate

---

**Document Version:** 1.0
**Last Updated:** 2026-01-09
**Next Review:** After Phase 2 completion
