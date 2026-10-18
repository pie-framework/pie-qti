# @pie-qti/qti-common

Shared utilities and abstractions for QTI 2.x and QTI 3.0 support.

## Overview

This package provides the foundational layer for version-agnostic QTI processing in PIE-QTI. It handles the naming differences between QTI 2.x (camelCase) and QTI 3.0 (kebab-case with `qti-` prefix) through a unified abstraction layer.

## Key Features

- **Element Name Mapping** — Convert between QTI version-specific element names and canonical form
- **Version Detection** — Auto-detect QTI 2.0, 2.1, 2.2, or 3.0 from XML
- **Smart Attribute Accessors** — Case-insensitive attribute lookup (handles both camelCase and kebab-case)
- **Parser Factory** — Automatic parser configuration based on QTI version

## Quick Start

### Auto-detect QTI Version

```typescript
import { createQtiParser, isQti3 } from '@pie-qti/qti-common';

const xml = `
  <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
    ...
  </qti-assessment-item>
`;

// Detect version and get appropriate mapper
const { mapper, version } = createQtiParser(xml);
console.log(version); // "3.0"
console.log(isQti3(xml)); // true

// Use mapper to convert element names
const canonicalName = mapper.toCanonical('qti-choice-interaction');
// → "choiceinteraction"

const nativeName = mapper.toNative('choiceinteraction');
// → "qti-choice-interaction" (QTI 3.0) or "choiceinteraction" (QTI 2.x)
```

### Element Name Mapping

Mappers convert between QTI version-specific element names and the canonical internal form, so the
same processing code handles both versions. One round-trip caveat applies to QTI 2.x:

`Qti2xElementNameMapper.toNative()` returns the lowercase canonical spelling because the parser's
QTI 2.x matching is case-insensitive; it cannot reconstruct the original camelCase from a lowercase
name. Preserve the source spelling separately when exact XML serialization matters.

The full element and attribute naming tables, plus step-by-step migration guidance, are in
[`docs/QTI-3-MIGRATION-GUIDE.md`](../../docs/QTI-3-MIGRATION-GUIDE.md).

### Smart Attribute Accessors

The package provides attribute accessors that work with both naming conventions:

```typescript
import { getAttribute, getNumberAttribute, getBooleanAttribute } from '@pie-qti/qti-common';

// Works with both QTI 2.x and 3.0 attributes
const element = doc.querySelector('qti-response-declaration');

// QTI 3.0 uses kebab-case: base-type
getAttribute(element, 'base-type');  // ✓ Returns "identifier"

// But camelCase also works (smart fallback)
getAttribute(element, 'baseType');   // ✓ Also returns "identifier"

// Typed accessors
getNumberAttribute(element, 'max-choices', 1);  // Returns number
getBooleanAttribute(element, 'shuffle');         // Returns boolean
```

## QTI 2.x vs 3.0 Naming Differences

QTI 2.x uses camelCase element and attribute names (`choiceInteraction`, `baseType`), while QTI 3.0
uses kebab-case names with a `qti-` prefix (`qti-choice-interaction`, `base-type`). The canonical
layer hides these differences: extractors and response processing always operate on canonical names,
and the mappers translate to and from the version-specific spelling. A few simple attributes
(`identifier`, `shuffle`, `cardinality`) are spelled the same in both versions.

For the complete element and attribute naming tables, see
[`docs/QTI-3-MIGRATION-GUIDE.md`](../../docs/QTI-3-MIGRATION-GUIDE.md).

## Architecture

### How Version-Agnostic Processing Works

```
┌────────────────┐
│  QTI 2.x XML   │
│  <choiceInter- │
│   action>      │
└────────┬───────┘
         │
         ├──► Qti2xElementNameMapper
         │    toCanonical('choiceInteraction')
         │         ↓
         │    "choiceinteraction"
         │         ↓
         └──► Common Processing (AST, Extractors)
                    ↓
              InteractionData
                    ↓
              UI Components

┌────────────────┐
│  QTI 3.0 XML   │
│  <qti-choice-  │
│   interaction> │
└────────┬───────┘
         │
         ├──► Qti3ElementNameMapper
         │    toCanonical('qti-choice-interaction')
         │         ↓
         │    "choiceinteraction"
         │         ↓
         └──► Common Processing (AST, Extractors)
                    ↓
              InteractionData
                    ↓
              UI Components
```

### Benefits of This Architecture

1. **Single Codebase** — Processing logic works for both QTI 2.x and 3.0
2. **Zero Breaking Changes** — Existing QTI 2.x code continues to work
3. **Feature Detection** — Version-specific features (PCI, PNP) detected automatically
4. **Extensibility** — New QTI versions can be added by implementing `ElementNameMapper`

## Version Detection

The package auto-detects QTI version from:

1. **XML Namespace**:
   - QTI 3.0: `http://www.imsglobal.org/xsd/imsqtiasi_v3p0`
   - QTI 2.2: `http://www.imsglobal.org/xsd/imsqti_v2p2`
   - QTI 2.1: `http://www.imsglobal.org/xsd/imsqti_v2p1`
   - QTI 2.0: `http://www.imsglobal.org/xsd/imsqti_v2p0`

2. **Root Element Name**:
   - QTI 3.0: `<qti-assessment-item>`
   - QTI 2.x: `<assessmentItem>`

3. **Version Attribute** (if namespace/element name unclear):
   - `version="2.2"`, `version="2.1"`, etc.

## API Reference

### Parser Factory

#### `createQtiParser(xml: string, options?: CreateParserOptions)`

Creates appropriate parser configuration for the given QTI XML.

**Returns**: `{ mapper: ElementNameMapper, attributeMapper: AttributeNameMapper, version: QtiVersion }`

```typescript
const { mapper, attributeMapper, version } = createQtiParser(xml);
```

#### `isQti3(xml: string): boolean`

Quick check if XML is QTI 3.0.

```typescript
if (isQti3(xml)) {
  console.log('This is QTI 3.0 content');
}
```

### Element Name Mappers

#### `ElementNameMapper` (interface)

```typescript
interface ElementNameMapper {
  /** QTI version represented by this mapper */
  readonly version: string;

  /** Convert version-specific name to canonical form */
  toCanonical(elementName: string): string;

  /** Convert canonical name to version-specific form */
  toNative(canonicalName: string): string;

  /** Check if element name matches expected pattern */
  isValidElementName(elementName: string): boolean;
}
```

#### `Qti2xElementNameMapper`

Handles QTI 2.x camelCase element names.

```typescript
const mapper = new Qti2xElementNameMapper();
mapper.toCanonical('choiceInteraction'); // → "choiceinteraction"
mapper.toNative('choiceinteraction');    // → "choiceinteraction"
```

#### `Qti3ElementNameMapper`

Handles QTI 3.0 kebab-case with `qti-` prefix.

```typescript
const mapper = new Qti3ElementNameMapper();
mapper.toCanonical('qti-choice-interaction'); // → "choiceinteraction"
mapper.toNative('choiceinteraction');          // → "qti-choice-interaction"
```

### Attribute Accessors

#### `getAttribute(element: Element, name: string): string | null`

Smart attribute accessor that tries multiple naming conventions.

```typescript
// Works with both 'base-type' and 'baseType'
const baseType = getAttribute(element, 'base-type');
```

#### `getNumberAttribute(element: Element, name: string, defaultValue?: number): number | null`

Get attribute as number.

```typescript
const maxChoices = getNumberAttribute(element, 'max-choices', 1);
```

#### `getBooleanAttribute(element: Element, name: string, defaultValue?: boolean): boolean`

Get attribute as boolean.

```typescript
const shuffle = getBooleanAttribute(element, 'shuffle', false);
```

## Integration with Players

### Item Player Integration

```typescript
import { createAssessmentItemDefinition } from '@pie-qti/item-player';
import { createQtiParser } from '@pie-qti/qti-common';

const xml = `...(QTI 2.x or 3.0)...`;
const { mapper, attributeMapper, version } = createQtiParser(xml);

const definition = createAssessmentItemDefinition({
  itemXml: xml,
  elementNameMapper: mapper,
  attributeNameMapper: attributeMapper
});
const session = definition.openSession();

console.log(`Playing ${version} content`);
session.dispose();
```

### Transform Integration

`@pie-qti/qti-common` also powers the QTI → PIE transformation in `@pie-qti/to-pie`. To transform
QTI XML directly, use the plugin:

```typescript
import { QtiToPiePlugin } from '@pie-qti/to-pie';

const xml = `...(QTI 2.x or 3.0)...`;

const plugin = new QtiToPiePlugin();
const result = await plugin.transform(
  { content: xml, format: 'qti22' }, // format is optional; qti30 is detected the same way
  { logger: console }
);

console.log(result.items); // PIE items
```

For engine-level usage (multi-plugin pipelines and PIE ⇄ QTI round-trips), see
[`docs/PIE-QTI-TRANSFORMATION-GUIDE.md`](../../docs/PIE-QTI-TRANSFORMATION-GUIDE.md).

## Migration Guide

Migrating existing QTI 2.x-only code usually means replacing hard-coded `getElementsByTagName`
lookups and direct `getAttribute` reads with `createQtiParser(...)` plus the mapper and smart
attribute accessors, so the same code handles QTI 2.x and 3.0. Code that already goes through the
extraction layer (`createAssessmentItemDefinition`) uses the mappers internally and needs no
changes.

See [`docs/QTI-3-MIGRATION-GUIDE.md`](../../docs/QTI-3-MIGRATION-GUIDE.md) for the full naming
tables and before/after migration examples.

## Testing

```bash
# Run tests
bun test

# Run with coverage
bun test --coverage
```

Test fixtures are available in `src/__tests__/fixtures/`:

- `qti3-choice-single.xml` — Single-selection choice
- `qti3-choice-multiple.xml` — Multiple-selection choice
- `qti3-match-interaction.xml` — Match interaction
- `qti3-text-entry.xml` — Inline text entry
- `qti3-extended-text.xml` — Extended text response
- `qti3-order-interaction.xml` — Ordering interaction
- `qti3-hotspot-interaction.xml` — Image hotspot

## Related Packages

- [`@pie-qti/item-player`](../item-player/) — QTI 2.x and 3.0 item player
- [`@pie-qti/assessment-player`](../assessment-player/) — Multi-item assessment orchestration
- [`@pie-qti/qti-processing`](../qti-processing/) — Response processing engine
- [`@pie-qti/to-pie`](../to-pie/) — QTI → PIE transformation

## License

MIT
