# QTI Compliance Validation System - Implementation Plan

**Goal**: Create a comprehensive system for validating QTI specification compliance in code changes, plugins, and player implementations.

**Priority**: Medium (after current transform-app stabilization work)

---

## Phase 1: Documentation Foundation (Est: 2-3 days)

### 1.1 Create QTI Compliance Documentation Structure

```
docs/
  qti/
    compliance/
      README.md                        # Overview of compliance system
      schema-validation.md             # How to validate against XSD schemas
      interaction-checklist.md         # Requirements per interaction type
      response-processing.md           # Response processing compliance
      accessibility.md                 # WCAG + QTI accessibility requirements
      vendor-quirks.md                 # Known non-compliant vendor patterns

    specification/
      qti-2.2-reference.md            # Quick reference guide
      qti-3.0-changes.md              # Future: QTI 3.0 differences

      interaction-types/               # One file per interaction
        choice-interaction.md
        extended-text-interaction.md
        text-entry-interaction.md
        order-interaction.md
        match-interaction.md
        associate-interaction.md
        gap-match-interaction.md
        inline-choice-interaction.md
        hotspot-interaction.md
        graphic-gap-match-interaction.md
        select-point-interaction.md
        graphic-order-interaction.md
        graphic-associate-interaction.md
        slider-interaction.md
        media-interaction.md
        drawing-interaction.md
        upload-interaction.md
        custom-interaction.md

      elements/
        assessment-item.md              # assessmentItem element
        assessment-test.md              # assessmentTest element
        response-declaration.md         # responseDeclaration
        outcome-declaration.md          # outcomeDeclaration
        template-declaration.md         # templateDeclaration
        response-processing.md          # responseProcessing rules

    examples/
      vendor-samples/                   # Real-world examples
        pearson/
        cambium/
        example-corp/
```

**Deliverables:**
- [ ] Create directory structure
- [ ] Write compliance README overview
- [ ] Document schema validation process
- [ ] Create interaction checklist template
- [ ] Document known vendor quirks from qti-heuristics
- [ ] Add QTI 2.2 quick reference guide
- [ ] Document at least 5 common interaction types in detail

**Resources Needed:**
- IMS QTI 2.2 specification (reference: https://www.imsglobal.org/question/qtiv2p2/imsqti_v2p2.html)
- Existing vendor heuristics code
- Sample QTI files from various vendors

---

## Phase 2: Enhanced Assessment Content Validator Skill (Est: 1 day)

### 2.1 Extend Existing Skill

Update `.claude/skills/assessment-content-validator/` to include compliance checks:

**Current checks:**
- Technical correctness (QTI/PIE compliance, functionality)
- Pedagogical quality (difficulty, instructions, scenarios)

**Add compliance-specific checks:**
- [ ] QTI 2.2 schema validation
- [ ] Required elements present (responseDeclaration, etc.)
- [ ] Response processing validity
- [ ] Interaction types supported in PIE
- [ ] Vendor-specific extensions documented
- [ ] Accessibility attributes present
- [ ] Proper namespace declarations

**Implementation:**
```typescript
// Pseudo-code for skill enhancement
{
  "validationSteps": [
    "qti_schema_compliance",
    "required_elements_check",
    "response_processing_validation",
    "pie_compatibility_check",
    "accessibility_validation",
    "vendor_extension_documentation"
  ]
}
```

**Deliverables:**
- [ ] Update skill prompt with compliance checks
- [ ] Add QTI-specific validation logic
- [ ] Create compliance report template
- [ ] Test with sample QTI files

---

## Phase 3: Automated Compliance Hooks (Est: 1 day)

### 3.1 Add PostToolUse Hooks for QTI Code

Extend existing hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "agent",
            "timeout": 300,
            "statusMessage": "Running lint, biome, TypeScript, and SvelteKit checks..."
          }
        ]
      },
      {
        "matcher": "Edit|Write(packages/qti-*/**/*.ts|packages/qti-*/**/*.tsx|packages/qti-*/**/*.svelte)",
        "hooks": [
          {
            "type": "agent",
            "prompt": "Review this QTI-related code change for specification compliance. Check: 1) Interaction type support, 2) Response processing correctness, 3) Accessibility requirements, 4) Known vendor compatibility issues. Reference docs/qti/compliance/",
            "timeout": 300,
            "statusMessage": "Checking QTI compliance..."
          }
        ]
      }
    ]
  }
}
```

**Deliverables:**
- [ ] Add QTI-specific hook configuration
- [ ] Test hook triggers on QTI package edits
- [ ] Tune timeout and prompt for effectiveness
- [ ] Document hook behavior in README

---

## Phase 4: QTI Compliance MCP Server (Optional - Est: 3-5 days)

### 4.1 Build Lightweight MCP Server

**Only implement if Phase 2-3 aren't sufficient for deep validation needs.**

**Server Structure:**
```typescript
// qti-compliance-mcp/
{
  name: "@pie-qti/mcp-compliance",
  version: "0.1.0",

  tools: {
    validate_qti_xml: {
      description: "Validate QTI XML against IMS schema",
      input: { xml: string, version: "2.2" | "3.0" },
      output: { valid: boolean, errors: ValidationError[] }
    },

    check_interaction_support: {
      description: "Check if interaction type is supported",
      input: { interactionType: string },
      output: {
        supported: boolean,
        qtiVersion: string,
        pieEquivalent: string | null,
        limitations: string[]
      }
    },

    validate_response_processing: {
      description: "Validate response processing rules",
      input: { responseProcessing: string },
      output: { valid: boolean, warnings: string[] }
    },

    check_accessibility: {
      description: "Check accessibility compliance",
      input: { itemXml: string },
      output: {
        compliant: boolean,
        issues: AccessibilityIssue[],
        recommendations: string[]
      }
    },

    find_vendor_patterns: {
      description: "Identify vendor-specific patterns",
      input: { xml: string },
      output: {
        vendor: string | null,
        patterns: VendorPattern[],
        heuristicsApplied: string[]
      }
    }
  },

  resources: {
    "qti://schema/2.2": "Embedded QTI 2.2 XSD schemas",
    "qti://compliance/checklist": "Compliance validation rules",
    "qti://patterns/vendors": "Known vendor deviation patterns"
  }
}
```

**Implementation Steps:**
- [ ] Set up MCP server project structure
- [ ] Embed QTI 2.2 XSD schemas
- [ ] Implement XML schema validation
- [ ] Add interaction type checking
- [ ] Add response processing validation
- [ ] Add accessibility checker
- [ ] Add vendor pattern detection
- [ ] Write tests for each tool
- [ ] Document MCP server usage
- [ ] Publish to npm

**Technical Considerations:**
- Use `libxmljs2` or `fast-xml-parser` for XML validation
- Embed minified XSD schemas to reduce package size
- Cache validation results for performance
- Provide detailed error messages with spec references

---

## Phase 5: Integration & Testing (Est: 2 days)

### 5.1 End-to-End Testing

**Test Scenarios:**
- [ ] Developer adds new interaction type support
- [ ] Developer modifies response processing logic
- [ ] Developer creates custom PIE component
- [ ] Developer adds vendor-specific heuristic
- [ ] Plugin author creates extension plugin

**For Each Scenario:**
1. Make code change
2. Verify automatic hooks trigger
3. Review compliance feedback
4. Fix any issues identified
5. Confirm validation passes

### 5.2 Documentation

- [ ] Write CONTRIBUTING.md section on QTI compliance
- [ ] Create video walkthrough (optional)
- [ ] Add compliance badges to README
- [ ] Document common compliance issues and fixes

---

## Success Metrics

**Phase 1-2 (Minimum Viable):**
- ✅ Comprehensive QTI documentation exists
- ✅ Can manually invoke compliance validation
- ✅ Catches common compliance issues

**Phase 3 (Automated):**
- ✅ Automatic checks on QTI code changes
- ✅ Reduced non-compliant code in PRs
- ✅ Faster code review process

**Phase 4 (Advanced):**
- ✅ Deep XML schema validation
- ✅ Vendor pattern detection
- ✅ Accessibility compliance checking

---

## Resources

### QTI Specification
- **IMS QTI 2.2**: https://www.imsglobal.org/question/qtiv2p2/imsqti_v2p2.html
- **QTI 2.2 XSD Schemas**: https://www.imsglobal.org/question/qtiv2p2/imsqti_v2p2p2.xsd
- **QTI Best Practices**: https://www.imsglobal.org/question/

### Tools
- **XML Validation**: libxmljs2, fast-xml-parser
- **Schema Tools**: xsd2ts (for TypeScript types from XSD)
- **Accessibility**: axe-core (for web content)

### Existing Code to Reference
- `packages/item-player/src/qti-heuristics.ts` - Vendor patterns
- `packages/to-pie/` - QTI→PIE conversion logic
- `.claude/skills/assessment-content-validator/` - Current validator

---

## Dependencies

**Required First:**
- Current transform-app work completed
- Assessment player bugs fixed
- File path issues resolved

**Blocked By:**
- None (can start in parallel with other work)

**Blocks:**
- QTI 3.0 support (future)
- Additional vendor heuristics
- PIE element extensions

---

## Open Questions

1. **Schema Location**: Should we embed full QTI schemas or reference online?
   - **Recommendation**: Embed for offline validation, reference for latest

2. **Validation Strictness**: Warn or error on non-compliance?
   - **Recommendation**: Warn for vendor extensions, error for spec violations

3. **Performance**: How to handle large QTI packages?
   - **Recommendation**: Validate incrementally, cache results

4. **Vendor Extensions**: How to handle non-standard QTI?
   - **Recommendation**: Document in vendor-quirks.md, add to heuristics

5. **QTI 3.0**: When to add support?
   - **Recommendation**: After QTI 2.2 compliance is solid

---

## Notes

- Keep Phase 1-2 lightweight and immediately useful
- Phase 4 (MCP server) is optional - evaluate after Phase 3
- Focus on practical compliance issues developers actually face
- Use existing vendor heuristics as foundation
- Make compliance checks fast (< 5 seconds)

---

**Created**: 2026-01-23
**Last Updated**: 2026-01-23
**Status**: Planning
**Owner**: Eelco
