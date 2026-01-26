# PIE-QTI Vendor Extensions - Example

This example demonstrates how to create vendor-specific extensions for the PIE-QTI transformation system with a complete, working implementation that showcases:

1. Custom vendor plugin with real transformation logic
2. Priority-based plugin selection
3. Vendor-specific feature extraction (partial credit, hints, metadata)
4. CLI tools for vendor detection and transformation
5. Web app integration

## What's Included

### 📦 Vendor Plugin (`packages/vendor-examplecorp-plugin`)

A complete vendor-specific QTI plugin for fictional "ExampleCorp" educational content.

**Key Features**:

- **Vendor Detection**: Uses `canHandle()` to identify ExampleCorp QTI files by XML namespace and metadata markers
- **Priority System**: Priority 550 overrides default QTI plugin (priority 100)
- **Real Transformation**: Extracts all ExampleCorp-specific features:
  - Partial credit scoring with per-choice rationales
  - Progressive hints and detailed explanations
  - Educational metadata (standards, grade, subject, difficulty)
  - Author and content tracking
- **Validation**: Comprehensive output validation

**Implementation Highlights**:

```typescript
export class ExampleCorpPlugin implements TransformPlugin {
  readonly id = 'vendor-examplecorp';
  readonly priority = 550; // Overrides default (100)
  readonly sourceFormat = 'qti22';
  readonly targetFormat = 'pie';

  // Detection via vendor markers
  async canHandle(input: TransformInput): Promise<boolean> {
    const hasNamespace = content.includes('xmlns:examplecorp=');
    const hasMetadata = content.includes('<examplecorp:metadata');
    return hasNamespace || hasMetadata;
  }

  // Transform with vendor feature extraction
  async transform(input: TransformInput, context: TransformContext) {
    const metadata = this.extractMetadata(content);
    const partialCredit = this.extractPartialCredit(content);
    const feedback = this.extractFeedback(content);
    // ... build PIE model with vendor enhancements
  }

  async validate(output: TransformOutput) { /* ... */ }
}
```

### 🌐 Transform Web App (`apps/transform-web`)

SvelteKit application demonstrating plugin integration:

- Plugin registration in server hooks
- Vendor selection and auto-detection UI
- File upload and transformation
- Display of vendor-specific features

### 🛠️ CLI Tools (`tools/cli`)

Command-line tools for vendor operations:

```bash
# Detect which plugin can handle a QTI file
bun tools/cli/bin/run.js vendor:detect <file>

# Transform with vendor plugin
bun tools/cli/bin/run.js vendor:transform <file> [--output <path>] [--show-priority]
```

## Project Structure

```
vendor-extensions-minimal/
├── packages/
│   └── vendor-examplecorp-plugin/     # Custom vendor plugin
│       ├── src/
│       │   └── index.ts               # Full implementation
│       ├── fixtures/                   # Test QTI files
│       │   ├── realistic-example.xml  # Biology question with all features
│       │   ├── sample-examplecorp.xml # Simple example
│       │   └── sample-standard.xml    # Standard QTI (no vendor)
│       └── package.json
│
├── apps/
│   └── transform-web/                  # Web app
│       ├── src/
│       │   ├── hooks.server.ts        # Plugin registration
│       │   ├── routes/
│       │   │   ├── +page.svelte       # UI
│       │   │   └── api/transform/     # API endpoint
│       │   └── app.html
│       └── package.json
│
├── tools/
│   └── cli/                            # CLI tools
│       ├── src/commands/vendor/
│       │   ├── detect.ts              # Vendor detection
│       │   └── transform.ts           # Transformation
│       ├── bin/run.js                 # Entry point
│       └── package.json
│
├── package.json                        # Workspace config
└── TESTING.md                          # Comprehensive testing guide
```

## Getting Started

### Prerequisites

- Bun 1.3.5 or higher
- Parent pie-qti repository already installed

### Installation

This example is integrated into the parent workspace:

```bash
# From repository root
bun install

# Build all packages including example
bun turbo build --filter='@pie-qti-examples/*'
```

### Quick Test

```bash
cd examples/vendor-extensions-minimal

# Test vendor detection
bun tools/cli/bin/run.js vendor:detect \
  packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml

# Test transformation
bun tools/cli/bin/run.js vendor:transform \
  packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml \
  --show-priority
```

## Example: Realistic Biology Question

The `realistic-example.xml` demonstrates a complete educational assessment with vendor-specific features:

**Input QTI** (ExampleCorp format):

```xml
<assessmentItem xmlns:examplecorp="http://www.examplecorp.com/qti/extensions"
                identifier="photosynthesis-001"
                title="Understanding Photosynthesis">

  <examplecorp:metadata>
    <examplecorp:contentId>BIO-301-PS-001</examplecorp:contentId>
    <examplecorp:subject>Biology</examplecorp:subject>
    <examplecorp:grade>9</examplecorp:grade>
    <examplecorp:difficulty>medium</examplecorp:difficulty>
    <examplecorp:standards>
      <examplecorp:standard>NGSS-LS1-5</examplecorp:standard>
    </examplecorp:standards>
  </examplecorp:metadata>

  <choiceInteraction>
    <simpleChoice identifier="choice_C">Glucose (C₆H₁₂O₆)</simpleChoice>
    <!-- ... -->
  </choiceInteraction>

  <examplecorp:customScoring>
    <examplecorp:partialCredit enabled="true">
      <examplecorp:choice identifier="choice_A" credit="0.25">
        <examplecorp:rationale>Oxygen is a byproduct, not the primary energy product</examplecorp:rationale>
      </examplecorp:choice>
      <!-- ... -->
    </examplecorp:partialCredit>
  </examplecorp:customScoring>

  <examplecorp:feedback>
    <examplecorp:hint level="1">Think about what plants produce...</examplecorp:hint>
    <examplecorp:explanation>During photosynthesis...</examplecorp:explanation>
  </examplecorp:feedback>
</assessmentItem>
```

**Output PIE** (with vendor enhancements):

```json
{
  "id": "photosynthesis-001",
  "element": "multiple-choice",
  "prompt": "Plants use photosynthesis...",
  "choices": [
    {
      "label": "Glucose (C₆H₁₂O₆)",
      "value": "choice_C",
      "correct": true,
      "partialCredit": 1.0,
      "rationale": "Correct! Glucose is the primary energy-storing molecule"
    }
  ],
  "feedback": {
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
    "standards": ["NGSS-LS1-5"],
    "hasPartialCredit": true,
    "hasHints": true,
    "hasExplanation": true
  }
}
```

## Key Concepts

### 1. Vendor Detection via `canHandle()`

The plugin implements `canHandle()` instead of a separate `detect()` method:

```typescript
async canHandle(input: TransformInput): Promise<boolean> {
  const content = typeof input.content === 'string'
    ? input.content
    : JSON.stringify(input.content);

  return content.includes('xmlns:examplecorp=') ||
         content.includes('<examplecorp:metadata');
}
```

### 2. Priority-Based Selection

When multiple plugins can handle content, the highest priority wins:

```typescript
const plugins = [
  new Qti22ToPiePlugin(),     // Priority 100 (default)
  new ExampleCorpPlugin()      // Priority 550 (vendor)
];

// Sort by priority, check canHandle(), use first match
const sorted = plugins.sort((a, b) =>
  ((b as any).priority ?? 100) - ((a as any).priority ?? 100)
);
```

### 3. Feature Extraction

The plugin extracts vendor-specific features using regex and string matching:

```typescript
// Extract metadata
private extractMetadata(content: string) {
  const contentId = content.match(/<examplecorp:contentId>([^<]+)/);
  const subject = content.match(/<examplecorp:subject>([^<]+)/);
  // ...
}

// Extract partial credit
private extractPartialCredit(content: string) {
  const regex = /<examplecorp:choice\s+identifier="([^"]+)"\s+credit="([^"]+)">/g;
  // ...
}
```

### 4. Complete Transform Pipeline

```
Input QTI XML
    ↓
canHandle() - Check vendor markers
    ↓
transform() - Extract features
    ├─ extractBasicElements() - QTI standard elements
    ├─ extractMetadata() - Vendor metadata
    ├─ extractPartialCredit() - Scoring rules
    └─ extractFeedback() - Hints & explanations
    ↓
Build PIE Model with vendor enhancements
    ↓
Output with vendorMetadata preserved
```

## Testing

See [TESTING.md](TESTING.md) for comprehensive testing instructions including:

- CLI vendor detection tests
- Transformation tests with feature verification
- Web app testing scenarios
- Build and type checking

**Quick verification**:

```bash
# All tests should pass
bun tools/cli/bin/run.js vendor:detect \
  packages/vendor-examplecorp-plugin/fixtures/realistic-example.xml
# Expected: ExampleCorp QTI Plugin (Priority: 550)

bun tools/cli/bin/run.js vendor:detect \
  packages/vendor-examplecorp-plugin/fixtures/sample-standard.xml
# Expected: QTI 2.2 to PIE (Priority: 100)
```

## Development

### Modify the Plugin

1. Edit `packages/vendor-examplecorp-plugin/src/index.ts`
2. Update detection logic in `canHandle()`
3. Enhance feature extraction methods
4. Rebuild: `bun turbo build --filter='@pie-qti-examples/vendor-examplecorp-plugin'`

### Add New Test Files

1. Create QTI file in `packages/vendor-examplecorp-plugin/fixtures/`
2. Add vendor-specific markers
3. Test with CLI commands

### Customize Web UI

1. Edit `apps/transform-web/src/routes/+page.svelte`
2. Modify API endpoint in `apps/transform-web/src/routes/api/transform/+server.ts`
3. Update theme in `apps/transform-web/tailwind.config.js`

## Next Steps

Use this example as a template for your vendor:

1. **Copy the Structure**: Use this as a starting point for your vendor extension
2. **Customize Detection**: Update `canHandle()` for your vendor's markers
3. **Implement Extraction**: Replace ExampleCorp-specific extraction with your vendor's format
4. **Add Real Parsing**: Replace regex with proper XML parser (e.g., `fast-xml-parser`)
5. **Handle More Types**: Extend beyond multiple choice to other interaction types
6. **Add Tests**: Write unit tests for your plugin
7. **Document**: Update README with your vendor-specific details

## Architecture Decisions

### Why Regex Parsing?

This example uses regex for simplicity and clarity. For production:

- Use a proper XML parser (`fast-xml-parser`, `xml2js`)
- Handle namespaces correctly
- Support nested structures
- Validate against schemas

### Why Priority System?

Allows vendor plugins to override default behavior without modifying core code:

- Vendor plugin: Priority 500-999 (high)
- Default plugins: Priority 100-499 (normal)
- Fallback: Priority 1-99 (low)

### Why Workspace Integration?

Example is integrated into parent workspace for:

- Shared dependencies and build tooling
- Easy testing with real packages
- Realistic deployment scenario
- Simpler maintenance

## Resources

- **API Documentation**: See parent `packages/types/src/transform/plugin.ts`
- **Core Transform Engine**: `packages/core/src/engine.ts`
- **Default QTI Plugin**: `packages/to-pie/src/index.ts`
- **Testing Guide**: [TESTING.md](TESTING.md)

## License

This example is part of the PIE-QTI project and follows the same license.
