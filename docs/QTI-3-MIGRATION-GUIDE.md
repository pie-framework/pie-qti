# QTI 3.0 Migration Guide

This guide explains the unified architecture approach for supporting both QTI 2.x and 3.0 in PIE-QTI.

## Overview

Rather than building separate players for QTI 2.x and 3.0, PIE-QTI uses a **version-agnostic architecture** that:

1. **Auto-detects** QTI version from XML
2. **Maps** version-specific element/attribute names to canonical form
3. **Processes** content using the same internal logic
4. **Renders** using the same UI components

This approach achieves **65-70% code reuse** between versions and ensures zero breaking changes for existing QTI 2.x code.

## Key Differences Between QTI 2.x and 3.0

### Element Names

| Feature | QTI 2.x | QTI 3.0 |
|---------|---------|---------|
| **Element naming** | camelCase | kebab-case with `qti-` prefix |
| **Example** | `<choiceInteraction>` | `<qti-choice-interaction>` |
| **Root element** | `<assessmentItem>` | `<qti-assessment-item>` |
| **Namespace** | `...imsqti_v2p2` | `...imsqtiasi_v3p0` |

### Attribute Names

| Feature | QTI 2.x | QTI 3.0 |
|---------|---------|---------|
| **Common attributes** | `identifier`, `shuffle`, `cardinality` | Same (unchanged) |
| **Multi-word attributes** | camelCase: `baseType`, `maxChoices` | kebab-case: `base-type`, `max-choices` |

### New QTI 3.0 Features

1. **Portable Custom Interactions (PCI)** — `<qti-portable-custom-interaction>`
2. **Personal Needs & Preferences (PNP)** — Accessibility profiles, color schemes
3. **Catalog System** — Glossary entries linked via `data-catalog-idref`
4. **Composite Interactions** — New interaction types

## Architecture: How Version Detection Works

```typescript
// Auto-detect version from XML
import { createQtiParser, isQti3 } from '@pie-qti/qti-common';

const xml = `<qti-assessment-item ...>...</qti-assessment-item>`;

// Get appropriate mapper and version
const { mapper, version } = createQtiParser(xml);
console.log(version); // "3.0"

// Player automatically uses correct mapper
const player = new Player(xml);  // Works for both 2.x and 3.0!
```

### Version Detection Logic

The system checks (in order):

1. **XML Namespace**:
   - `http://www.imsglobal.org/xsd/imsqtiasi_v3p0` → QTI 3.0
   - `http://www.imsglobal.org/xsd/imsqti_v2p2` → QTI 2.2
   - `http://www.imsglobal.org/xsd/imsqti_v2p1` → QTI 2.1
   - `http://www.imsglobal.org/xsd/imsqti_v2p0` → QTI 2.0

2. **Root Element Name**:
   - `<qti-assessment-item>` → QTI 3.0
   - `<assessmentItem>` → QTI 2.x (check version attribute)

3. **Version Attribute** (fallback):
   - `version="2.2"` → QTI 2.2

## Element Name Mapping

The `ElementNameMapper` interface provides version-agnostic element handling:

```typescript
import { Qti2ElementNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';

// QTI 2.x mapper
const qti2Mapper = new Qti2ElementNameMapper();
qti2Mapper.toCanonical('choiceInteraction');  // → "choiceinteraction"
qti2Mapper.toNative('choiceinteraction');     // → "choiceInteraction"

// QTI 3.0 mapper
const qti3Mapper = new Qti3ElementNameMapper();
qti3Mapper.toCanonical('qti-choice-interaction');  // → "choiceinteraction"
qti3Mapper.toNative('choiceinteraction');          // → "qti-choice-interaction"
```

### Canonical Form (Internal Representation)

All element names are converted to a **canonical form** (lowercase, no hyphens):

- QTI 2.x `choiceInteraction` → `choiceinteraction`
- QTI 3.0 `qti-choice-interaction` → `choiceinteraction`

This allows processing logic to work identically for both versions.

## Attribute Handling

The smart attribute accessors handle both naming conventions automatically:

```typescript
import { getAttribute, getNumberAttribute, getBooleanAttribute } from '@pie-qti/qti-common';

const element = doc.querySelector('qti-response-declaration');

// Both work! (tries multiple conventions)
getAttribute(element, 'base-type');  // ✓ Returns "identifier"
getAttribute(element, 'baseType');   // ✓ Also returns "identifier"

// Typed accessors
getNumberAttribute(element, 'max-choices', 1);  // Returns number
getBooleanAttribute(element, 'shuffle');         // Returns boolean
```

### How Smart Accessors Work

When you call `getAttribute(element, 'maxChoices')`:

1. Try exact name: `element.getAttribute('maxChoices')`
2. If contains uppercase, try kebab-case: `element.getAttribute('max-choices')`
3. If contains hyphens, try camelCase: `element.getAttribute('maxChoices')`

This means your code works with **both QTI 2.x and 3.0 attributes** without changes.

## Migration Path for Existing Code

### Scenario 1: You're Using the Player API

**No changes needed!** The player auto-detects QTI version:

```typescript
import { Player } from '@pie-qti/item-player';

// QTI 2.x XML
const qti2Xml = `<assessmentItem ...>...</assessmentItem>`;
const player1 = new Player(qti2Xml);  // ✓ Works

// QTI 3.0 XML
const qti3Xml = `<qti-assessment-item ...>...</qti-assessment-item>`;
const player2 = new Player(qti3Xml);  // ✓ Works
```

### Scenario 2: You're Using the Transform API

**No changes needed!** Transformers auto-detect version:

```typescript
import { transformQtiToPie } from '@pie-qti/to-pie';

// Works with both QTI 2.x and 3.0
const pieItem = await transformQtiToPie(xml);
```

### Scenario 3: You're Directly Parsing QTI XML

**Before** (QTI 2.x only):
```typescript
const doc = parseXml(xml);
const interactions = doc.getElementsByTagName('choiceInteraction');
```

**After** (QTI 2.x + 3.0):
```typescript
import { createQtiParser } from '@pie-qti/qti-common';

const { mapper } = createQtiParser(xml);
const tagName = mapper.toNative('choiceinteraction');
const interactions = doc.getElementsByTagName(tagName);
```

**Even Better** (use extraction layer):
```typescript
// Extraction layer already handles this automatically
const player = new Player(xml);
console.log(player.interactions);  // Works for both versions
```

### Scenario 4: You're Reading Attributes

**Before** (QTI 2.x only):
```typescript
const baseType = element.getAttribute('baseType');
const maxChoices = parseInt(element.getAttribute('maxChoices') || '1');
```

**After** (QTI 2.x + 3.0):
```typescript
import { getAttribute, getNumberAttribute } from '@pie-qti/qti-common';

const baseType = getAttribute(element, 'baseType');  // Works for both!
const maxChoices = getNumberAttribute(element, 'maxChoices', 1);
```

## Benefits of Unified Architecture

### For Users

- **No breaking changes** — Existing QTI 2.x code continues to work
- **Automatic version detection** — No need to specify version
- **Future-proof** — New QTI versions can be added via new mappers

### For Developers

- **65-70% code reuse** — Operators, evaluation, navigation, rendering all shared
- **Single test suite** — Most tests work for both versions
- **Cleaner codebase** — No duplication of business logic

### For the Ecosystem

- **Lower maintenance burden** — Bug fixes benefit both versions
- **Easier adoption** — Gradual migration from QTI 2.x to 3.0
- **Vendor flexibility** — Custom extensions work with both versions

## Common Internal Model

Both QTI 2.x and 3.0 convert to the same internal data structures:

```typescript
// QTI 2.x XML
<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
  <simpleChoice identifier="A">Choice A</simpleChoice>
</choiceInteraction>

// QTI 3.0 XML
<qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
  <qti-simple-choice identifier="A">Choice A</qti-simple-choice>
</qti-choice-interaction>

// Both convert to the same model:
{
  type: 'choiceInteraction',
  responseId: 'RESPONSE',
  maxChoices: 1,
  choices: [
    { identifier: 'A', text: 'Choice A' }
  ]
}
```

This **common internal model** is what makes the unified architecture possible.

## QTI 3.0-Specific Features

### Portable Custom Interactions (PCI)

**Phase 2+ of QTI 3 support** will add:

```typescript
// Future API (not yet implemented)
<qti-portable-custom-interaction
  response-identifier="RESPONSE"
  custom-interaction-type-identifier="org.example.likert"
  module="/pci-modules/likert-scale.js">
  ...
</qti-portable-custom-interaction>
```

### Personal Needs & Preferences (PNP)

**Phase 2+ will add accessibility profiles:**

```typescript
// Future API
const player = new Player(xml, {
  pnpProfile: {
    colorScheme: 'blackwhite',
    glossaryOnScreen: true,
    keywordTranslation: 'es'
  }
});
```

### Catalog System

**Phase 2+ will add glossary support:**

```xml
<p>The capital of <span data-catalog-idref="glossary-france">France</span>.</p>

<qti-catalog>
  <qti-card identifier="glossary-france">
    <qti-card-entry>France is a country in Europe.</qti-card-entry>
  </qti-card>
</qti-catalog>
```

## Implementation Status

| Component | QTI 2.x | QTI 3.0 | Notes |
|-----------|---------|---------|-------|
| **Element name mapping** | ✅ | ✅ | Complete |
| **Attribute handling** | ✅ | ✅ | Complete |
| **Version detection** | ✅ | ✅ | Complete |
| **Parser infrastructure** | ✅ | ✅ | Complete |
| **Standard interactions (21)** | ✅ | 🚧 | QTI 3 parsing ready, player enhancements in progress |
| **Response processing** | ✅ | ✅ | Shared logic |
| **Assessment player** | ✅ | 🚧 | Test structure parsing needed |
| **PCI support** | ❌ | 🚧 | Phase 2+ |
| **PNP support** | ❌ | 🚧 | Phase 2+ |
| **Catalog system** | ❌ | 🚧 | Phase 2+ |

Legend: ✅ Complete | 🚧 In Progress | ❌ Not Started

## Testing

### Unit Tests

```bash
# Test element name mapping
bun test packages/qti-common

# Test version detection
bun test packages/qti-common/src/__tests__/qti3-integration.test.ts
```

### Integration Tests

```bash
# Test with QTI 3.0 fixtures
bun test packages/item-player -- --grep "QTI 3.0"
```

### Sample Fixtures

QTI 3.0 test fixtures are available in:
- `packages/qti-common/src/__tests__/fixtures/qti3-*.xml`

## Roadmap

### Phase 1: Parser Infrastructure ✅ (Complete)

- [x] Element name mapper abstraction
- [x] Version detection
- [x] Smart attribute accessors
- [x] QTI 3.0 sample fixtures
- [x] Integration tests
- [x] Package renames

### Phase 2: Player Enhancements (In Progress)

- [ ] Update extractors for QTI 3.0 element discovery
- [ ] Test all 21 interactions with QTI 3.0 content
- [ ] Add PCI extractor and loader
- [ ] Implement PNP manager
- [ ] Add catalog system support

### Phase 3: Assessment Player (Planned)

- [ ] QTI 3.0 test structure parsing
- [ ] Navigation with QTI 3.0 tests
- [ ] Outcome processing

### Phase 4: Components & Styling (Planned)

- [ ] PNP color schemes (15+ accessibility themes)
- [ ] PCI component wrapper
- [ ] Catalog dialog component

### Phase 5: Testing & Validation (Planned)

- [ ] Comprehensive E2E tests
- [ ] Performance benchmarking
- [ ] 1EdTech certification prep

## References

- **QTI 2.2 Specification**: [IMS QTI 2.2](https://www.imsglobal.org/question/qtiv2p2/imsqti_v2p2.html)
- **QTI 3.0 Specification**: [IMS QTI 3.0](https://www.imsglobal.org/spec/qti/v3p0/)
- **amp-up.io reference player**: [GitHub](https://github.com/amp-up-io/qti3-item-player-vue3)
- **PIE Framework**: [pie-framework.org](https://pie-framework.org/)

## Support

For questions or issues related to QTI 3.0 support:

1. Check the [QTI Common README](../packages/qti-common/README.md)
2. Review test fixtures in `packages/qti-common/src/__tests__/fixtures/`
3. Open an issue: [GitHub Issues](https://github.com/pie-framework/pie-qti/issues)
