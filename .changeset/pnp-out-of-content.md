---
"@pie-qti/item-player": patch
"@pie-qti/to-pie": patch
---

Read the PNP as a per-candidate AfA PNP 3.0 profile. `parsePnpXml` now parses an `access-for-all-pnp` document, `parseAfaPnpXml` returns its whole record and `pnpProfileFromAfa` maps a record onto `PnpProfile`. to-pie no longer emits `personalNeedsProfile` for an assessmentTest and warns `QTI_PNP_IN_CONTENT` instead; the `PersonalNeedsProfile` type is removed.
