# Position Object Interaction

## ⚠️ Important Limitations

This QTI 2.2 interaction type has **severe limitations** that make it impractical for most educational scenarios. This implementation exists for QTI 2.2 specification compliance, but the interaction itself has limited practical utility.

## The Core Problem

The `positionObjectInteraction` response format uses `baseType="point"`, which only stores coordinates:

```xml
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="point">
  <correctResponse>
    <value>158 168</value>
    <value>210 195</value>
  </correctResponse>
</responseDeclaration>
```

**There is NO way to track which specific object was placed where.**

## What It Was Designed For

Based on the official QTI 2.2 specification example (airport placement):

- Place **multiple copies of the SAME object** (e.g., airport icons)
- One `positionObjectStage` container with background image
- One `positionObjectInteraction` with ONE draggable object
- `maxChoices` determines how many times the object can be placed
- Scoring uses `areaMapping` to check if ANY placement hits target zones

### Example Use Case (Spec-Compliant)

"Place 3 airport markers on the UK map where you think the major airports are located."

- All 3 placements use identical airport icons
- Response: `["118 184", "150 235", "96 114"]` (just coordinates)
- Scoring: Check if any coordinate falls within acceptable zones around correct airports

## What It CANNOT Do

### ❌ Labeled Object Placement

"Place these labeled city names on their correct locations on the map."

- Cannot track which city label goes where
- Response format doesn't support object identifiers
- On reload, labels would be mapped to positions incorrectly

### ❌ Multiple Different Objects

"Place the heart, lungs, and liver on the correct locations in the body diagram."

- Cannot distinguish between different organs in the response
- Impossible to score "heart must be here, liver must be there"

## Research Findings

After extensive research, we found:

1. **No real-world implementations** beyond the official QTI 2.2 spec example
2. **Not included** in QTI 3.0 shared vocabulary/styling guide (likely being phased out)
3. **Major QTI platforms** (TAO, Citolab) show no prominent support for this interaction
4. **Zero community discussions** or Stack Overflow questions about implementation

This strongly suggests the interaction type has been **effectively abandoned** by the QTI community.

## Alternative Solutions

### For Labeled Object Placement: Use `graphicGapMatchInteraction`

This interaction uses `baseType="directedPair"` which properly tracks object-location pairs:

```xml
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
  <correctResponse>
    <value>HEART A</value>
    <value>LUNGS B</value>
    <value>LIVER C</value>
  </correctResponse>
</responseDeclaration>
```

This format **explicitly stores which object (HEART) was placed at which location (A)**.

### For Abstract Point Placement: Use `selectPointInteraction`

For scenarios where you just need to capture coordinate clicks without draggable objects:

- "Click on 3 locations where you think the treasure is buried"
- "Mark points on the graph where the function crosses zero"

## Current Implementation

This component includes a **non-standard extension** that:

- Supports multiple `positionObjectStage` elements with identifiers
- Tracks which stage (object) is at which position internally
- Uses best-effort array-order mapping to reconstruct positions on reload

**However**, this cannot be stored in the QTI response format, making it unreliable for:
- Saving and restoring state
- Scoring based on specific object placements
- Multi-session assessments

## Recommendation

**Do not use `positionObjectInteraction` for new assessment items.**

Use:
- `graphicGapMatchInteraction` for labeled object placement
- `selectPointInteraction` for coordinate-based responses
- `hotspotInteraction` for clicking predefined regions

This interaction exists in our library solely for QTI 2.2 specification compliance.

## Official QTI 2.2 Example

The only real example from IMS Global:

```xml
<positionObjectStage>
  <object type="image/png" data="images/uk.png" width="206" height="280"/>
  <positionObjectInteraction responseIdentifier="RESPONSE" maxChoices="3">
    <object type="image/png" data="images/airport.png" width="16" height="16"/>
  </positionObjectInteraction>
</positionObjectStage>
```

Note: ONE stage, ONE draggable object, multiple placements allowed.
