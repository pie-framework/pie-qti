# Shared Test Fixtures

This directory contains shared QTI and PIE fixtures that can be used across all packages for testing.

## Structure

```
fixtures/
├── qti/                    # Standard QTI 2.2 samples
│   ├── multiple-choice/    # Choice interaction items
│   ├── hotspot/            # Hotspot interaction items
│   ├── extended-text/      # Extended text response items
│   └── ...                 # Other interaction types
├── vendors/                # Vendor-specific QTI samples
│   ├── x/                  # specific items for vendor x
│   ├── y/
│   └── z/
└── pie/                    # PIE model samples
    ├── multiple-choice/    # PIE multiple choice models
    └── ...                 # Other PIE element types
```

## Usage

### Load Shared Fixtures

```typescript
import { loadSharedFixture } from '@pie-qti/test-utils';

// Load standard QTI
const qti = loadSharedFixture('qti/multiple-choice/basic.xml');

// Load vendor-specific QTI
const pearsonHotspot = loadSharedFixture('vendors/pearson/hotspot-001.xml');

// Load PIE model
const pieModel = loadSharedFixture('pie/multiple-choice/basic.json');
```

### Load Package-Specific Fixtures

```typescript
import { loadFixture } from '@pie-qti/test-utils';

// Load from a specific package's fixtures directory
const qti = loadFixture('qti2-to-pie', 'custom-test.xml');
```

## Adding New Fixtures

When adding fixtures:

1. **Place in appropriate directory** based on type (qti/vendors/pie)
2. **Use descriptive names** that indicate what the fixture tests
3. **Include comments** in the fixture explaining special features
4. **Keep them minimal** - only include what's needed to test the feature
5. **Follow QTI standards** - ensure validity for QTI fixtures

## Fixture Guidelines

### QTI Fixtures

- Must be valid QTI 2.2 XML
- Include namespace declarations
- Use meaningful identifiers
- Include both responseDeclaration and itemBody
- Add comments for non-obvious features

### Vendor Fixtures

- Document the vendor and version
- Include any vendor-specific extensions
- Note any deviations from standard QTI
- Add README in vendor directory explaining specifics

### PIE Fixtures

- Must be valid PIE JSON models
- Include all required fields (id, element, etc.)
- Use realistic data
- Document any special configurations

## Current Fixtures

### QTI Standard

- `qti/multiple-choice/basic.xml` - Simple 4-option multiple choice

### Vendors

_(To be added as vendor extensions are developed)_

### PIE Models

_(To be added)_

## Contributing

When adding fixtures that might be useful across packages:

1. Create a pull request
2. Document the fixture purpose in this README
3. Add tests that use the fixture
4. Ensure the fixture is valid (run through validators)
