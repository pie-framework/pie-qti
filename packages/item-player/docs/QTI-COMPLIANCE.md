# QTI 2.2 Specification Compliance

## Compliance Level

This player implements **QTI 2.2** as the baseline specification with backward compatibility for QTI 2.0/2.1.

## Supported QTI Features

### Interactions (21 Standard Types)
All 21 standard QTI 2.2 interactions are supported:

- **Choice Interactions**: `choiceInteraction`, `inlineChoiceInteraction`, `orderInteraction`, `associateInteraction`
- **Text Interactions**: `textEntryInteraction`, `extendedTextInteraction`
- **Graphic Interactions**: `hotspotInteraction`, `hottext Interaction`, `graphicOrderInteraction`, `graphicAssociateInteraction`, `graphicGapMatchInteraction`, `selectPointInteraction`, `positionObjectInteraction`
- **Match Interactions**: `matchInteraction`, `gapMatchInteraction`
- **Media Interactions**: `mediaInteraction`, `uploadInteraction`
- **Drawing**: `drawingInteraction`
- **Slider**: `sliderInteraction`
- **Custom**: `customInteraction`
- **End Attempt**: `endAttemptInteraction`

See the [Interactions Guide](./interactions.md) for detailed documentation.

### Response Processing Templates

The player supports both QTI 2.2 standard templates and QTI 2.1 Common Cartridge (CC2) aliases:

| QTI 2.2 Template | QTI 2.1 CC2 Alias | Description |
|------------------|-------------------|-------------|
| `match_correct` | `cc2_match` | Scores 1 if all responses match correct values, 0 otherwise |
| `match_nothing` | `cc2_match_nothing` | Scores 1 if all responses are empty, 0 otherwise |
| `map_response` | `cc2_map_response` | Maps response values using mapping definitions |
| `map_response_point` | `cc2_map_response_point` | Maps point responses using area mapping |

**Template Resolution:** The player extracts only the template filename from the full URL, making resolution namespace-agnostic. Templates from v2p0, v2p1, and v2p2 namespaces all work identically.

### QTI Roles

All 6 standard QTI roles are supported:
- ✅ `candidate` - Student taking the assessment
- ✅ `scorer` - Person scoring responses
- ✅ `tutor` - Tutor/instructor viewing with feedback
- ✅ `author` - Content author with full visibility
- ✅ `testConstructor` - Assessment designer
- ✅ `proctor` - Test administrator

## Known Vendor Extensions

### positionObjectInteraction - Multiple Stages
**Status**: Non-standard extension (always enabled)

**QTI 2.2 Spec Limitation:**
The standard `positionObjectInteraction` only supports:
- Single `positionObjectStage` element
- Single draggable object (placed multiple times)
- Response format: `baseType="point"` with coordinates only

**Extension Behavior:**
This player allows multiple `positionObjectStage` elements with identifiers, enabling "place labeled objects on map" scenarios.

**Limitation:**
The response format cannot preserve object identity per QTI spec.

**Recommended Alternative:**
Use `graphicGapMatchInteraction` for spec-compliant labeled object placement.

**Rationale:**
The standard `positionObjectInteraction` is too limited for common educational use cases where different objects need to be placed on a map.

## Strict Compliance Mode

Enable strict mode to enforce QTI 2.2 compliance and log/reject vendor extensions:

```typescript
import { Player } from '@pie-qti/item-player';

const player = new Player({
  itemXml: qtiXml,
  strictQtiCompliance: {
    enabled: true,                    // Enable strict QTI 2.2 validation
    rejectUnknownExtensions: true,    // Throw errors on non-2.2 versions
    logDeviations: true               // Log warnings for spec deviations
  }
});
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `false` | Enable strict QTI 2.2 compliance checking |
| `rejectUnknownExtensions` | `false` | Throw errors if item version is not 2.2 |
| `logDeviations` | `true` | Log console warnings for spec deviations |

## Version Detection

The player automatically detects QTI version using multiple strategies:

### Detection Order
1. **Namespace URI** - Checks for `v2p0`, `v2p1`, or `v2p2` in namespace
   ```xml
   <assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
   ```

2. **Version Attribute** - Reads explicit version attribute
   ```xml
   <assessmentItem version="2.2">
   ```

3. **Fallback** - Assumes QTI 2.2 if version cannot be determined

### Version Logging

The player logs version information to console:

```
[QTI Player] QTI 2.1 detected. Using QTI 2.2 compatibility mode with CC2 template support.
[QTI Player] QTI 2.0 detected. Some features may not be fully supported. QTI 2.2 is recommended.
[QTI Player] Could not detect QTI version. Assuming QTI 2.2 compatibility.
```

## Known Limitations

### QTI 2.0 Items
- ❌ `adaptive` attribute not supported (QTI 2.2 only feature)
- ⚠️ Some response processing rules may behave differently
- ✅ Template URLs must use standard filenames (namespace-agnostic matching)
- ⚠️ Limited testing with real QTI 2.0 content

### QTI 2.1 Items
- ✅ Fully supported with CC2 template aliases
- ✅ Common Cartridge content packages work correctly
- ✅ Namespace differences handled transparently

### QTI 2.2 Items
- ✅ Full support (recommended baseline)
- ✅ All 21 standard interactions
- ✅ Adaptive items supported
- ✅ All response processing templates

## Namespace Handling

The player uses **namespace-agnostic** element matching:

```typescript
// Uses Element.localName, ignoring namespace prefixes
findDescendants(element, 'responseDeclaration')
```

This design choice ensures:
- QTI 2.0, 2.1, and 2.2 items work identically
- Namespace differences don't break element lookup
- Template filename-based matching (not full URL matching)

## Testing

Test fixtures for different QTI versions are located in:
- `__tests__/fixtures/qti2.0/` - QTI 2.0 test items
- `__tests__/fixtures/qti2.1/` - QTI 2.1 test items
- `__tests__/fixtures/qti2.2/` - QTI 2.2 test items

Run tests with:
```bash
cd packages/item-player
bun test
```

## Migration Guide

### From QTI 2.0/2.1 to QTI 2.2

**Template Names:**
- Replace `cc2_match` with `match_correct` (both still supported)
- Replace `cc2_map_response` with `map_response` (both still supported)
- No breaking changes - old names work via aliases

**Namespace Updates:**
```xml
<!-- QTI 2.1 -->
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1">

<!-- QTI 2.2 (recommended) -->
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
```

**Adaptive Items:**
Only available in QTI 2.2. Add `adaptive="true"` attribute:
```xml
<assessmentItem adaptive="true" xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
```

## Additional Resources

- [QTI 2.2 Specification](http://www.imsglobal.org/question/qtiv2p2/imsqti_v2p2.html)
- [QTI 2.1 Specification](http://www.imsglobal.org/question/qtiv2p1/imsqti_v2p1.html)
- [Common Cartridge Profile](http://www.imsglobal.org/cc/)
- [PIE QTI Player Documentation](../README.md)
