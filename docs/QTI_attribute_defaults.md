# QTI interaction attribute defaults

This is the audited table of interaction attribute defaults for QTI 2.1, 2.2 and 3.0, and the value
the player applies when an attribute is absent. It covers every interaction extractor under
[`packages/item-player/src/interactions/`](../packages/item-player/src/interactions/) and every
attribute that has a schema default or whose absence has a meaning defined by the specification.

Project policy: where the QTI specification is clear, the player follows it, version by version. An
authored value is honoured as written in every version (including an attribute a version does not
define, as leniency), and `0` on a `max…` limit means no restriction.

## Sources

| Version | Schema (in this repository) | Information model |
|---------|-----------------------------|-------------------|
| QTI 2.1 | [`imsqti_v2p1.xsd`](../packages/to-pie/schemas/qti/imsqti_v2p1.xsd) (Final Release, 31 July 2012) | [QTI v2.1 Information Model](https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html) |
| QTI 2.2 | [`imsqti_v2p2.xsd`](../packages/to-pie/schemas/qti/imsqti_v2p2.xsd) | [QTI 2.2.4 ASI Information Model](https://www.imsglobal.org/question/qtiv2p2p4/QTIv2p2p4-ASI-InformationModelv1p0/imsqtiv2p2p4_asi_v1p0_InfoModelv1p0.html) |
| QTI 3.0 | [`imsqti_asiv3p0_v1p0.xsd`](../packages/qti-common/schemas/qti3/imsqti_asiv3p0_v1p0.xsd) | [QTI 3.0 ASI Information Model](https://www.imsglobal.org/spec/qti/v3p0/info) |

Every default below was read from the three schemas and checked against the information model of the
same version. Where the two disagree for one version, the row says so and the spec is treated as unclear
for that version.

## How the player applies defaults

- **The item's QTI version** comes from `detectQtiVersion` (namespace, then root element, then `version`
  attribute). The Player detects it once and hands it to extraction as `ExtractionConfig.qtiVersion`. An
  unversioned or unknown item, and a hand-built extraction context without a version, follows the QTI 2.2
  assumption `detectQtiVersion` makes for unversioned items.
- **Per-version defaults** live in the extractors, with the shared helpers in
  [`specDefaults.ts`](../packages/item-player/src/interactions/shared/specDefaults.ts):
  `predatesQti22` (QTI 2.0/2.1 content) and `unrestrictedLimitDefault`.
- **Single-cardinality responses.** Where the spec default of a limit is `0` (no restriction), the spec
  also requires a multiple-cardinality binding for it ("If maxChoices is greater than 1 (or 0) then the
  interaction must be bound to a response with multiple cardinality"). A response declared `single` holds
  one value, so for such an item the absent limit resolves to `1`, the one consistent value.
- **Required attributes** have no default. When content omits one, the extractor uses a fallback (shown
  in the table) so it can still render; the item is invalid against the schema.
- **Hints** (`expectedLength`, `expectedLines`, `orientation`) have no default by design. The player picks
  a presentation value for an absent hint; this is not a spec default and is not a limit.

## Changes made by this audit

| Interaction | Attribute | Before | Now |
|-------------|-----------|--------|-----|
| `graphicGapMatchInteraction` | `maxAssociations` | 0 (no cap) in every version, a documented divergence | 1 for 2.2/3.0; no cap for 2.1, which has no such attribute |
| `gapMatchInteraction` | `maxAssociations` | not read: no cap in any version | 1 for 2.2/3.0; no cap for 2.1, which has no such attribute; enforced by the UI and by response validation |
| `choiceInteraction` | `maxChoices` | 1 in every version | 0 (no restriction) for 2.1; 1 for 2.2/3.0 |
| `selectPointInteraction` | `maxChoices` | 1 in every version | 0 (no restriction) for 2.2/3.0; 2.1 unchanged at 1 (its spec is unclear) |

Demo, evaluation and conformance content that relied on the old gap match defaults now authors
`maxAssociations` explicitly.

## Defaults by interaction

Legend: "—" = the attribute does not exist in that version; "optional" = optional with no default;
"required" = required, no default. "Player" is what the extractor delivers when the attribute is absent.

### choiceInteraction / simpleChoice

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `shuffle` | false | false | false | false | Aligned |
| `maxChoices` | 0 | 1 | 1 | 2.1: 0 (1 for a single response); 2.2/3.0: 1 | Fixed (was 1 in every version) |
| `minChoices` | 0 | 0 | 0 | 0 | Aligned |
| `orientation` | optional | vertical | vertical | not read; vertical layout (QTI 3.0 `qti-orientation-*` classes are honoured) | Aligned for the default; an authored `orientation` attribute is a rendering hint the renderer does not use |
| `simpleChoice` `fixed` | false | false | false | false | Aligned |
| `simpleChoice` `templateIdentifier` | optional | optional | optional | absent: always shown | Aligned |
| `simpleChoice` `showHide` | show | show | show | show | Aligned |

### orderInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `shuffle` | false | false | false | false | Aligned |
| `minChoices` | optional (absent: all choices must be ordered) | same | same | 0 = unspecified: all choices must be ordered | Aligned |
| `maxChoices` | optional (absent: all choices may be ordered) | same | same | 0 = unspecified: no cap below the choice count | Aligned |
| `orientation` | optional (hint) | optional | optional | vertical | Aligned (presentation choice, no spec default) |

### associateInteraction / simpleAssociableChoice

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `shuffle` | false | false | false | false | Aligned |
| `maxAssociations` | 1 | 1 | 1 | 1 | Aligned |
| `minAssociations` | 0 | 0 | 0 | 0 | Aligned |
| `matchMax` | required | required | required | fallback 1 | Required (fallback for invalid content) |
| `matchMin` | 0 | 0 | 0 | 0 | Aligned |
| `fixed` | optional | optional | optional | false (an authored `true` is delivered and pins the choice in the shuffle) | Fixed (was not read; the earlier "Aligned" verdict was wrong — an authored `fixed="true"` was ignored) |

### matchInteraction / simpleMatchSet

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `shuffle` | false | false | false | false | Aligned |
| `maxAssociations` | 1 | 1 | 1 | 1 | Aligned |
| `minAssociations` | 0 | 0 | 0 | 0 (delivered only when above 0) | Aligned |
| `simpleAssociableChoice` `matchMax` | required | required | required | fallback 1 | Required (fallback for invalid content) |
| `simpleAssociableChoice` `matchMin` | 0 | 0 | 0 | 0 | Aligned |
| `simpleAssociableChoice` `fixed` | optional | optional | optional | false (an authored `true` is delivered and pins the choice in the shuffle) | Fixed (was not read) |

### gapMatchInteraction / gapText / gapImg / gap

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `shuffle` | false | false | false | false | Aligned |
| `maxAssociations` | — | 1 | 1 | 2.1: 0 (no cap); 2.2/3.0: 1 | Fixed (was not read) |
| `minAssociations` | — | optional | optional | 0 (delivered only when above 0) | Aligned; an authored value is enforced by response validation |
| `gapText`/`gapImg` `matchMax` | required | required | required | fallback 1 | Required (fallback for invalid content) |
| `gapText`/`gapImg` `matchMin` | 0 | 0 | 0 | 0 | Aligned |
| `gapText`/`gapImg` `fixed` | false | — | — | false (an authored `true` is delivered and pins the choice in the shuffle; honoured in every version as leniency) | Fixed (was not read; the earlier "Aligned" verdict was wrong — an authored `fixed="true"` was ignored) |
| `gap` `required` | false | false | false | false (required gaps delivered as `requiredGaps`) | Aligned; an authored `true` is enforced by response validation |

### inlineChoiceInteraction / inlineChoice

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `shuffle` | false | false | false | false | Aligned |
| `required` | false | false | false | false (`true` delivered as `minChoices: 1`) | Aligned; an authored `true` is enforced by response validation |
| `minChoices` | — | — | 0 | 0 (delivered only when above 0) | Aligned; an authored value is enforced by response validation |
| `inlineChoice` `fixed` | false | false | false | false | Aligned |

### textEntryInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `base` | 10 | 10 | 10 | 10 | Aligned |
| `expectedLength` | optional (hint) | optional | optional | 20, used only to size the input | Aligned (sizing fallback, not a limit) |
| `patternMask` | optional | optional | optional | none | Aligned |
| `placeholderText` | optional | optional | optional | none | Aligned |
| `format` | — | optional | optional | none | Aligned |

### extendedTextInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `base` | 10 | 10 | 10 | 10 | Aligned |
| `minStrings` | 0 | 0 | 0 | 0 | Aligned |
| `maxStrings` | optional (required for a container response) | same | same | 1 for a single or record response; 0 (no cap) for a container | Aligned (follows the response cardinality) |
| `expectedLines` | optional (hint) | optional | optional | 3, used to size the box | Aligned (sizing fallback) |
| `expectedLength` | optional (hint) | optional | optional | none: absent stays absent | Aligned: with no authored length, `qti-counter-up`/`qti-counter-down` show no counter (both are defined against `expected-length`, and no counter is the vocabulary's default); nothing sizes from it |
| `format` | plain | plain | plain | plain | Aligned |
| `patternMask` | optional | optional | optional | none | Aligned |

### hottextInteraction / hottext

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `maxChoices` | unclear: XSD 0, information model `maxChoices [1] = 1` | 1 | 1 | 1 | Aligned for 2.2/3.0; 2.1 kept at 1 (spec unclear) |
| `minChoices` | 0 | 0 | 0 | 0 | Aligned |
| `hottext` `showHide` | show | show | show | show | Aligned |

### hotspotInteraction / hotspotChoice

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `maxChoices` | unclear: XSD 0, information model `maxChoices [1] = 1` | 1 | 1 | 1 | Aligned for 2.2/3.0; 2.1 kept at 1 (spec unclear) |
| `minChoices` | 0 | 0 | 0 | 0 | Aligned |
| `hotspotChoice` `shape` | required | required | required | fallback `rect` | Required (fallback for invalid content) |
| `hotspotChoice` `showHide` | show | show | show | show | Aligned |

### selectPointInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `maxChoices` | unclear: XSD 0, information model `maxChoices [1] = 1` | 0 | 0 | 2.2/3.0: 0 (1 for a single response); 2.1: 1 | Fixed for 2.2/3.0 (was 1); 2.1 kept at 1 (spec unclear) |
| `minChoices` | 0 | 0 | 0 | 0 | Aligned |

### graphicOrderInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `minChoices` | optional (absent: all choices must be ordered) | same | same | 0 = unspecified: all choices must be ordered | Aligned |
| `maxChoices` | optional (absent: all choices may be ordered) | same | same | 0 = unspecified: no cap | Aligned |

### graphicAssociateInteraction / associableHotspot

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `maxAssociations` | 1 | 1 | 1 | 1 | Aligned |
| `minAssociations` | optional | optional | optional | 0 | Aligned |
| `associableHotspot` `matchMax` | required | required | required | fallback 1 | Required (fallback for invalid content) |
| `associableHotspot` `matchMin` | 0 | 0 | 0 | 0 | Aligned |
| `associableHotspot` `shape` | required | required | required | fallback `rect` | Required (fallback for invalid content) |

### graphicGapMatchInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `maxAssociations` | — | 1 | 1 | 2.1: 0 (no cap); 2.2/3.0: 1 | Fixed (was 0 in every version) |
| `minAssociations` | — | optional | optional | 0 (delivered only when above 0) | Aligned; an authored value is enforced by response validation |
| `gapText`/`gapImg`/`associableHotspot` `matchMax` | required | required | required | fallback 1 | Required (fallback for invalid content) |
| `gapText` `matchMin` | 0 | 0 | 0 | 0 | Aligned |

### positionObjectInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `maxChoices` | unclear: XSD 0, information model `maxChoices [1] = 1` | 1 | 1 | 1 | Aligned for 2.2/3.0; 2.1 kept at 1 (spec unclear) |
| `minChoices` | optional (absent: no minimum) | optional | optional | 0 | Aligned |
| `centerPoint` (2.1 XSD: `centrePoint`) | optional (absent: the image centre) | optional | optional | the image centre; both spellings read | Aligned |

### sliderInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `lowerBound` | required | required | required | fallback 0 | Required (fallback for invalid content) |
| `upperBound` | required | required | required | fallback 100 | Required (fallback for invalid content) |
| `step` | 1.0 | 1.0 | 1.0 | 1 | Aligned with the schema default. The information model adds that a float response with no `step` operates on an approximately continuous scale, which contradicts its own `Default = "1.0"`; kept at 1 (spec unclear) |
| `stepLabel` | false | false | false | false | Aligned |
| `orientation` | optional (hint) | optional | optional | horizontal | Aligned (presentation choice) |
| `reverse` | optional | optional | optional | false | Aligned |

### mediaInteraction

| Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-----------|-----|-----|-----|--------|---------|
| `autostart` | required | required | required | fallback false | Required (fallback for invalid content) |
| `minPlays` | 0 | 0 | 0 | 0 | Aligned |
| `maxPlays` | 0 | 0 | 0 | 0 (no limit) | Aligned |
| `loop` | false | false | false | false | Aligned |

### uploadInteraction, drawingInteraction, endAttemptInteraction, customInteraction, portableCustomInteraction

| Interaction | Attribute | 2.1 | 2.2 | 3.0 | Player | Verdict |
|-------------|-----------|-----|-----|-----|--------|---------|
| `uploadInteraction` | `type` | optional (absent: any file type) | optional | optional | any file type, with an extraction warning | Aligned |
| `drawingInteraction` | (no attribute with a default) | | | | | — |
| `endAttemptInteraction` | `title` | required | required | required | fallback "End Attempt" | Required (fallback for invalid content) |
| `endAttemptInteraction` | `countAttempt` | optional (absent from the 2.1 information model) | optional | optional | true: the attempt counts | Aligned: absence keeps QTI 2.1 behaviour, where every ended attempt counts |
| `customInteraction` | (no attribute with a default) | | | | | — |
| `portableCustomInteraction` | `custom-interaction-type-identifier` | — | — | required | read as authored | Required |
| `portableCustomInteraction` | `module` | — | — | optional | read as authored | Aligned |

## Open items

- **QTI 2.1 `maxChoices` on hottext, hotspot, selectPoint and positionObject.** The 2.1 information model
  makes the attribute required with `= 1`; the 2.1 schema makes it optional with default `0`. With no clear
  2.1 rule, the player keeps `1` for 2.1 content. (QTI 2.2 and 3.0 resolve this: `1`, except selectPoint at
  `0`.)
- **Slider `step` for float responses.** The information model's description and its default disagree; the
  player keeps the schema default `1`.

See also: [QTI technical implementation guide](QTI_techguide.md), and the interaction PRDs under
[`prds/interactions/`](prds/interactions/), for example
[graphic gap match](prds/interactions/graphic-gap-match.md) and [gap match](prds/interactions/gap-match.md).
