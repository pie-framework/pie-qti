---
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
'@pie-qti/to-pie': patch
---

QTI spec-conformance fixes for interaction extraction and delivery data.

**Image element forms (QTI 3.0).** Every graphic interaction (hotspot, graphic order/associate/gap match, select point, drawing, position object) and the `gapImg`/`qti-gap-img` label now accepts the full QTI 3.0 `object|img|picture` choice. A `<picture>` background previously extracted `imageData: null`, leaving the interaction unanswerable; a QTI 3.0 `<img>` position-object stage or draggable made extraction throw and the whole item fail to load. The delivered image data is derived from the `<picture>`'s `<img>` fallback, so its shape is unchanged for renderers.

**Response completeness.** `graphicGapMatchInteraction` now extracts `matchMin` on `gapImg` and `associableHotspot` (it had gapText only) and response validation enforces the hotspots' minimum, so a response using such a choice or hotspot fewer than `matchMin` times is no longer accepted as complete. The delivered `gapTexts`/`gapImages`/`hotspots` types carry `matchMin`; `hotspots` also carries the authored `hotspotLabel`, which the default graphic gap match component uses to name zones for assistive technology (placement announcements included) instead of the generic "Hotspot 1/2".

**Authored names.** Gap images deliver the gapImg `objectLabel` attribute (QTI 2.1 `objectLabel.GapImg.Attr`, QTI 3.0 `object-label`); both gap-match components use it after the image's alt text, before the generic fallback.

**Booleans and shuffle.** Interaction boolean attributes now read the full xs:boolean lexical space, so `shuffle="1"`, `fixed="1"`, `required="1"`, `count-attempt="1"`, `step-label="1"` and `reverse="1"` extract as on. `fixed` is now read on match and associate `simpleAssociableChoice` (and on QTI 2.1 `gapText`/`gapImg`, read for QTI 2.1 content only — 2.2/3.0 define none), so authored fixed choices keep their position under `shuffle="true"` instead of being shuffled.

**Removed surfaces (previously tolerated inputs stop working):**
- The PCI extractor reads only the schema-defined `customInteractionTypeIdentifier` / `custom-interaction-type-identifier`. The never-standardized `customInteractionIdentifierType` / `custom-interaction-identifier-type` spellings it also accepted are no longer read; hosts passing those must use the schema name. `@pie-qti/to-pie` follows: its PCI type-identifier read is the same two schema names, and its unsupported-interaction diagnostic names the field `customInteractionTypeIdentifier`.
- Three dead delivered-type members are deleted: `AssociateData.minSelectionsMessage`, `GraphicOrderData.minSelectionsMessage` (attributes no QTI version defines; never populated) and `GapMatchInteractionData.gapTexts[].inputWidth` (never populated; the `qti-input-width-*` class reaches the renderer via `classes`). Plugin authors reading them must switch to the delivered `classes` (input width) or drop the read (the messages).
