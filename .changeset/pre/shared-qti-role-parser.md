---
'@pie-qti/item-player': patch
'@pie-qti/player-elements': patch
---

The `qti-role` role list and its parser are one shared export (`parseQtiRole`/`isQtiRole` from `@pie-qti/item-player`) consumed by both the item and assessment elements, replacing the duplicated copy with its own warning style. An unknown `qti-role` on the assessment element now warns once and renders the candidate view (storing `'candidate'`) instead of warning on every occurrence and leaving the config fallback in charge — the same contract as the item element.
