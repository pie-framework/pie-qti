---
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
---

**Behavior change: interaction attributes that an item leaves out now take the QTI default for the item's QTI version.** The player detects the version of each item (2.1, 2.2 or 3.0) and applies the default that version's schema and information model define. An attribute you author is always honoured as written, and `0` on a `max…` limit still means no limit.

- **Graphic gap match:** QTI 2.2 and 3.0 items that omit `maxAssociations` (`max-associations`) now allow one association, the spec default. Before, they allowed any number. To let candidates fill several hotspots, state `maxAssociations` explicitly, for example `maxAssociations="3"`, or `"0"` for no limit. QTI 2.1 items have no such attribute, so they still have no overall limit.
- **Gap match:** `maxAssociations` is now supported. The player used to ignore it. QTI 2.2 and 3.0 items that omit it now allow one association, the spec default, so a cloze meant to fill several gaps must state `maxAssociations`, for example the number of gaps. QTI 2.1 items have no such attribute and keep no overall limit. A placement past the limit, by keyboard or pointer, is refused and announced: the author's `data-max-selections-message` if there is one, otherwise the new localized message `interactions.gapMatch.associationLimitReached`. A held word stays held, so the candidate can place it elsewhere or cancel. Response validation rejects a restored or programmatic response with more associations than the limit.
- **Choice:** QTI 2.1 items that omit `maxChoices` now allow any number of selections, as QTI 2.1 defines (`maxChoices = 0`). Before, they allowed one. A 2.1 item bound to a single-cardinality response still allows one. QTI 2.2 and 3.0 are unchanged, with a default of 1.
- **Select point:** QTI 2.2 and 3.0 items that omit `maxChoices` now allow any number of points, the spec default (`0`), when the response has multiple cardinality. Before, they allowed one point. Items bound to a single-cardinality response still take one point. QTI 2.1 items are unchanged.

For hosts and plugin authors: extraction now receives the item's QTI version as `ExtractionConfig.qtiVersion`, and `GapMatchInteractionData` gains an optional `maxAssociations`. The full table of audited defaults is in `docs/QTI_attribute_defaults.md`.
