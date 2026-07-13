# QTI 3.0 Migration Guide

This guide explains the unified architecture approach for supporting both QTI 2.x and 3.0 in PIE-QTI.

## Overview

Rather than building separate players for QTI 2.x and 3.0, PIE-QTI uses a **version-agnostic architecture** that:

1. **Auto-detects** QTI version from XML
2. **Maps** version-specific element/attribute names to canonical form
3. **Processes** content using the same internal logic
4. **Renders** using the same UI components

This approach keeps most extraction, rendering, and processing logic shared. It is an architectural
normalization strategy, not a claim that every schema-valid QTI 2.x or 3.0 assessment is currently
deliverable. See [`SPEC-GAPS-PLAN.md`](SPEC-GAPS-PLAN.md) for the remaining assessment-level and
package-integration gaps.

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
4. **Shared Vocabulary and HTML5-oriented content** — standardized presentation classes and a wider
   web content model

In QTI terminology, a **composite item** is an assessment item containing multiple interactions.
There is no `qti-composite-interaction` element.

## Architecture: How Version Detection Works

```typescript
// Auto-detect version from XML
import { createQtiParser, isQti3 } from '@pie-qti/qti-common';
import { Player } from '@pie-qti/item-player';

const xml = `<qti-assessment-item ...>...</qti-assessment-item>`;

// Get appropriate mapper and version
const { mapper, version } = createQtiParser(xml);
console.log(version); // "3.0"

// Player automatically uses the correct mapper
const player = new Player({ itemXml: xml }); // Works for both 2.x and 3.0
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
import { Qti2xElementNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';

// QTI 2.x mapper
const qti2Mapper = new Qti2xElementNameMapper();
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

Only QTI-defined elements participate in this mapping. Native HTML (`object`, `param`, `audio`,
`video`, `source`, and so on), MathML, SVG, and extension-vocabulary elements retain their own names
and namespaces. The mapper uses an explicit QTI vocabulary table rather than inventing `qti-`
prefixed names for unknown elements.

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

The player auto-detects the QTI version; callers do not select a mapper manually. This applies to
the implemented delivery profile and does not erase the open assessment/package gaps:

```typescript
import { Player } from '@pie-qti/item-player';

// QTI 2.x XML
const qti2Xml = `<assessmentItem ...>...</assessmentItem>`;
const player1 = new Player({ itemXml: qti2Xml }); // ✓ Works

// QTI 3.0 XML
const qti3Xml = `<qti-assessment-item ...>...</qti-assessment-item>`;
const player2 = new Player({ itemXml: qti3Xml }); // ✓ Works
```

### Scenario 2: You're Using the Transform API

Transformers auto-detect supported input versions. Transformation coverage is plugin-specific and
must be checked separately from player delivery coverage:

```typescript
import { TransformEngine } from '@pie-qti/transform-core';
import { QtiToPiePlugin } from '@pie-qti/to-pie';

const engine = new TransformEngine().use(new QtiToPiePlugin());
const handle = await engine.transform(xml, { targetFormat: 'pie' });
const pieItem = await handle.result();
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
const player = new Player({ itemXml: xml });
console.log(player.getInteractionData()); // Works for both versions
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

- **Compatible entry points** — Existing QTI 2.x player entry points continue to use the same API
- **Automatic version detection** — No need to specify version
- **Future-proof** — New QTI versions can be added via new mappers

### For Developers

- **Shared core** — Operators, evaluation, extraction, and rendering are reused where semantics align
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

PCI extraction and lifecycle support are implemented at the player layer. Authored module paths are
never imported automatically: the embedding host must provide a resolver that makes the trust and
package/origin decision. Resolved PCI code runs with page authority unless the host adds isolation.

```xml
<qti-portable-custom-interaction
  response-identifier="RESPONSE"
  custom-interaction-type-identifier="org.example.likert">
  <qti-interaction-modules>
    <qti-interaction-module primary-path="modules/likert-scale.js"/>
  </qti-interaction-modules>
  <qti-interaction-markup><div class="likert-root"></div></qti-interaction-markup>
</qti-portable-custom-interaction>
```

### Personal Needs & Preferences (PNP)

PNP support is implemented for the core delivery accommodations:

```typescript
const player = new Player({
  itemXml: xml,
  pnp: {
    display: { colorScheme: 'blackwhite' },
    content: {
      glossaryOnScreen: true,
      keywordTranslation: { active: true, languageCode: 'es' }
    }
  }
});
```

### Catalog System

Catalog parsing and glossary/keyword-translation popup support are implemented:

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
| **Element name mapping** | Implemented | Implemented | Explicit QTI map; HTML/MathML/SVG/extensions pass through |
| **Attribute handling** | Implemented | Implemented | Camel/kebab accessors |
| **Version detection** | Implemented | Implemented | Namespace first, root-name fallback |
| **Standard interactions (21 names)** | Broad coverage | Broad coverage | Includes schema-valid position-object hierarchy and extended-text cardinalities; browser evidence varies by interaction |
| **Record cardinality** | Implemented | Implemented | Named typed fields; no declaration-level BaseType |
| **Response processing** | Broad coverage | Broad coverage | Canonical fixed templates covered; external fragments require a host resolver |
| **Assessment player** | Partial | Partial | Per-part modes and ordered hierarchy retained; dynamic controls below remain |
| **PCI support** | Implemented for PCI payloads | Implemented | Explicit host resolver required; not a sandbox |
| **PNP support** | N/A / host profile | Current delivery scope | Color schemes, elimination, extended time, glossary/translation triggers |
| **Catalog system** | Limited extensions | Current item scope | Inline/provided catalog XML; manifest-level shared discovery remains open |

### Remaining delivery boundaries

- Dynamic `preCondition` evaluation is not yet applied while walking an AssessmentTest.
- `branchRule` execution is implemented for item refs, not for sections or test parts.
- `selection withReplacement="true"` does not yet materialize distinct, sequence-indexed ItemSessions.
- Processing-fragment resolution is available on ItemPlayer, but assessment/package delivery does not
  yet construct and pass the item-relative resolver automatically.
- Formal official-suite evidence for current source changes is unavailable until a new NPM candidate
  is published: the private runner deliberately consumes published packages only.

These boundaries are why the project remains pre-1.0 and must not be described as fully conformant
or certified.

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
