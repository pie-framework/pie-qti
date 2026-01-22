# Testing Guide

This document provides step-by-step instructions for testing the vendor extensions example.

## Setup

```bash
# From the repository root
bun install

# Build all packages including example
bun turbo build --filter='@pie-qti-examples/*'
```

## Test 1: Vendor Detection (CLI)

The vendor detection command checks which plugin can handle a QTI file based on vendor-specific markers.

### Test ExampleCorp Detection

```bash
cd examples/vendor-extensions-minimal
bun tools/cli/bin/run.js vendor:detect packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml
```

**Expected Output**:
```
Detection Results for: packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml

────────────────────────────────────────────────────────────

QTI 2.2 to PIE (Priority: 100)
  ✓ Can handle this content

ExampleCorp QTI Plugin (Priority: 550)
  ✓ Can handle this content

────────────────────────────────────────────────────────────

✓ Best Match: ExampleCorp QTI Plugin
  Priority: 550
```

**What This Tests**:
- Plugin `canHandle()` method correctly identifies ExampleCorp markers
- Priority system (550 > 100) determines the winning plugin
- Both plugins can technically handle QTI, but vendor plugin has higher priority

### Test Standard QTI Detection

```bash
bun tools/cli/bin/run.js vendor:detect packages/vendor-examplecorp-plugin/fixtures/sample-standard.xml
```

**Expected Output**:
```
Detection Results for: packages/vendor-examplecorp-plugin/fixtures/sample-standard.xml

────────────────────────────────────────────────────────────

QTI 2.2 to PIE (Priority: 100)
  ✓ Can handle this content

ExampleCorp QTI Plugin (Priority: 550)
  ✗ Cannot handle this content

────────────────────────────────────────────────────────────

✓ Best Match: QTI 2.2 to PIE
  Priority: 100
```

**What This Tests**:
- Standard QTI files without vendor markers are handled by default plugin
- ExampleCorp plugin correctly returns `false` from `canHandle()`

## Test 2: Transformation (CLI)

### Transform Realistic ExampleCorp Content

This test uses a complete biology question with ExampleCorp-specific features:
- Partial credit scoring
- Educational standards alignment
- Progressive hints
- Detailed explanations
- Subject/grade/difficulty metadata

```bash
bun tools/cli/bin/run.js vendor:transform \
  packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml \
  --show-priority
```

**Expected Output** (abbreviated):
```
Reading: packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml
Auto-detecting vendor...
Detected: ExampleCorp QTI Plugin (priority: 550)
Transforming...

Plugin used: ExampleCorp QTI Plugin (priority: 550)

────────────────────────────────────────────────────────────
PIE Model Output:
────────────────────────────────────────────────────────────
{
  "items": [
    {
      "content": {
        "id": "photosynthesis-001",
        "element": "multiple-choice",
        "prompt": "Question: Plants use photosynthesis...",
        "choices": [
          {
            "label": "Glucose (C₆H₁₂O₆)",
            "value": "choice_C",
            "correct": true,
            "partialCredit": 1,
            "rationale": "Correct! Glucose is the primary energy-storing molecule"
          },
          ...
        ],
        "feedback": {
          "type": "default",
          "hints": [
            "Think about what plants produce...",
            "The chemical formula C₆H₁₂O₆..."
          ],
          "explanation": "During photosynthesis, plants convert..."
        },
        "vendorMetadata": {
          "vendor": "examplecorp",
          "contentId": "BIO-301-PS-001",
          "subject": "Biology",
          "grade": "9",
          "difficulty": "medium",
          "standards": ["NGSS-LS1-5", "CCSS-ELA-RST.9-10.4"],
          "author": "Jane Smith",
          "hasPartialCredit": true,
          "hasHints": true,
          "hasExplanation": true
        }
      }
    }
  ]
}

✓ Transformation complete
```

**What This Tests**:
- Auto-detection works correctly
- All vendor-specific metadata is extracted
- Partial credit information is preserved for each choice
- Feedback (hints + explanation) is captured
- Educational standards are maintained
- Priority system selects correct plugin

### Transform Standard QTI Content

```bash
bun tools/cli/bin/run.js vendor:transform \
  packages/vendor-examplecorp-plugin/fixtures/sample-standard.xml \
  --show-priority
```

**Expected Output**:
```
Plugin used: QTI 2.2 to PIE (priority: 100)
```

**What This Tests**:
- Standard QTI uses default plugin
- Priority system works correctly when vendor plugin can't handle content

### Save Output to File

```bash
bun tools/cli/bin/run.js vendor:transform \
  packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml \
  --output output.json
```

**What This Tests**:
- File output works correctly
- Output can be piped to other tools

## Test 3: Web Application

### Start Development Server

```bash
# From example root
cd examples/vendor-extensions-minimal
bun run dev:app
```

Then open http://localhost:5173 in your browser.

### Test Scenario 1: Auto-detect ExampleCorp

1. Select **"Auto-detect"** vendor option (or leave default)
2. Click **"Upload QTI File"**
3. Select `packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml`
4. Click **"Transform to PIE Format"**

**Expected Results**:
- **Plugin Used**: ExampleCorp QTI Plugin
- **Plugin Priority**: 550
- **Vendor Detected**: examplecorp
- **Status**: ✓ Success
- **Output includes**: Partial credit, hints, explanation, standards

**What This Tests**:
- Web app API route correctly uses plugin system
- Auto-detection works in browser context
- Priority system determines correct plugin
- UI displays all vendor-specific features

### Test Scenario 2: Force ExampleCorp Vendor

1. Select **"ExampleCorp"** vendor option
2. Upload `sample-standard.xml` (standard QTI without vendor markers)
3. Click **"Transform to PIE Format"**

**Expected Results**:
- ExampleCorp plugin is used even though content lacks vendor markers
- Demonstrates explicit vendor override capability

### Test Scenario 3: Standard QTI

1. Select **"Standard QTI"** vendor option (or auto-detect)
2. Upload `sample-standard.xml`
3. Click **"Transform to PIE Format"**

**Expected Results**:
- **Plugin Used**: QTI 2.2 to PIE
- **Plugin Priority**: 100
- **Vendor Detected**: None
- Default plugin handles transformation

## Test 4: Build and Type Checking

### Build All Packages

```bash
# From repository root
bun turbo build --filter='@pie-qti-examples/*'
```

**Expected**:
- All packages build without errors
- TypeScript compilation succeeds
- Output in `dist/` directories

### Type Check

```bash
cd examples/vendor-extensions-minimal
bun turbo typecheck --filter='@pie-qti-examples/*'
```

**Expected**:
- No TypeScript errors
- All interfaces properly implemented

## Key Features Demonstrated

### 1. Vendor Detection via `canHandle()`
- Checks for vendor-specific markers (namespaces, metadata, generator info)
- Returns boolean indicating if plugin can process the content

### 2. Priority-Based Plugin Selection
- ExampleCorp plugin (priority 550) overrides default (priority 100)
- When multiple plugins can handle content, highest priority wins

### 3. Vendor-Specific Feature Extraction

**Metadata**:
- Content ID, subject, grade level, difficulty
- Educational standards alignment (NGSS, CCSS)
- Author and creation timestamp

**Partial Credit Scoring**:
- Per-choice credit values (0.0 to 1.0)
- Rationale for each choice's credit

**Enhanced Feedback**:
- Progressive hints (level 1, level 2, etc.)
- Detailed explanations
- Choice-specific rationales

### 4. Complete Transform Pipeline
- Input: ExampleCorp QTI XML
- Detection: Plugin identifies vendor markers
- Transformation: Extracts all features to PIE format
- Output: PIE model with vendor metadata preserved

## Common Issues and Solutions

### Issue: "Module not found" errors

**Solution**: Rebuild packages from root:
```bash
cd /path/to/pie-qti
bun install
bun turbo build --filter='@pie-qti-examples/*'
```

### Issue: CLI commands not found

**Solution**: Use full path to binary:
```bash
bun tools/cli/bin/run.js vendor:detect <file>
```

### Issue: Detection not working

**Solution**: Verify QTI file has vendor markers:
- `xmlns:examplecorp` namespace declaration
- `<examplecorp:metadata>` elements
- ExampleCorp generator metadata

## Success Criteria

All tests pass if:

✅ ExampleCorp detection returns `canHandle = true` for realistic-example.xml
✅ Standard QTI detection returns `canHandle = false` from ExampleCorp plugin
✅ ExampleCorp plugin (priority 550) is used for vendor content
✅ Default plugin (priority 100) is used for standard content
✅ Transformations extract all vendor-specific features:
   - Partial credit with rationales
   - Hints and explanations
   - Educational metadata (standards, grade, subject)
   - Author and content ID
✅ CLI commands execute without errors
✅ Web app loads and processes files correctly
✅ All builds and type checks pass

## Next Steps

After verifying the example works:

1. **Customize the Plugin**: Modify detection and transformation logic for your vendor
2. **Add Real Parsing**: Replace regex parsing with proper XML parser (e.g., `fast-xml-parser`)
3. **Add Tests**: Write unit tests for your plugin
4. **Handle More Interaction Types**: Extend beyond multiple choice
5. **Deploy**: Use this as a template for production vendor extensions
