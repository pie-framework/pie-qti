---
'@pie-qti/item-player': patch
'@pie-qti/player-elements': patch
---

Response value types, serialized session state and parsing-limit cleanups (cleanup phase 2). Runtime behavior is unchanged except for snapshot variables without `defaultValue`; see below.

**Breaking: `InteractionValueMap` describes what each component emits (types only).** Each entry is now the raw value the standard component's `qti-change` event and `onChange` callback carry, before the player normalizes it into the response declaration, instead of a guess from the QTI base type and cardinality. The runtime payload is unchanged, but event handlers and code typed against the old shapes through `InteractionValueMap`, `InteractionResponseValue`, `QTIChangeEventDetail` or `QTIInteractionElement.response` no longer compile:

| Entry | Was | Now |
| --- | --- | --- |
| `matchInteraction`, `gapMatchInteraction`, `graphicGapMatchInteraction` | `Record<string, string>` | `string[]` of `"source target"` pairs |
| `associateInteraction`, `graphicAssociateInteraction` | `Array<[string, string]>` | `string[]` of `"A B"` pairs |
| `positionObjectInteraction` | `Record<string, { x: number; y: number }>` | `string[]` of `"x y"` points |
| `selectPointInteraction` | `Array<{ x: number; y: number }>` | `string \| string[] \| null`: `"x y"` points, null once cleared |
| `hotspotInteraction` | `string[]` | `string`: the selected hotspot |
| `hottextInteraction` | `string[]` | `string \| string[] \| null` |
| `choiceInteraction` | `string \| string[]` | `string \| string[] \| null` |
| `orderInteraction`, `graphicOrderInteraction` | `string[]` | `string[] \| null`: null for an empty subset order |
| `extendedTextInteraction` | `string` | `string \| number \| Array<string \| number> \| ExtendedTextNumericRecord \| null` |
| `drawingInteraction` | `string` | `QTIFileResponse \| null` |
| `customInteraction` | `any` | `string \| null` |
| `mediaInteraction` | `any` | `number`: the play count |

The other entries are unchanged.

**Breaking: serialized session variables require `defaultValue`.** `SerializedItemSessionVariable.defaultValue`, and `ServerSerializedVariable.defaultValue` in `@pie-qti/item-player/server`, are no longer optional: `serialize()` always writes the field, `null` when the variable has no default value. Restore reads `null` as "no default value"; a snapshot variable without the field now restores a NULL default instead of the default declared in the item XML. Snapshots written by `serialize()` are unaffected; hand-built snapshots must include the field.

Also:

- `<pie-qti-assessment-player>` no longer rewrites the host's `security` config to force `parsingLimits.enabled: true`. It passes the config through and decides the section depth limit with `normalizeParsingLimits`, which already treats limits as on unless the host passes `enabled: false`. Behavior is unchanged for every config, including `maxHtmlDepth` without `enabled`; an explicit `enabled: undefined` now bounds section depth too, as it already did every other limit.
- Documentation corrections: the `qti-change` payload examples in the order, position-object, graphic-order, hottext, extended-text and web-components PRDs, and structured labels described as implemented and match-only (QTI tech guide, SPEC-GAPS G-13, accessibility and PNP PRDs, QTI 3 migration guide).
