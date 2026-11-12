---
'@pie-qti/qti-common': patch
'@pie-qti/to-pie': patch
---

Single source of truth for two XML helpers that each existed in three drifted copies across the conversion packages:

- **Catalog idrefs**: `qti-common/accessibility` now exports `CATALOG_IDREF_PATTERN` + `catalogIdrefFromMatch`, matching quoted (single/double) and bare attribute values. Previously the exporter parsed `data-catalog-idref` with a *different grammar* than the importer — a bare idref written by one side parsed differently on the other. The qti-common and to-pie readers now accept bare values too (backwards-compatible widening).
- **XML escaping**: new canonical `escapeXmlAttribute` (safe inside `"..."` and `'...'`; also escapes apostrophes, so generated attributes containing apostrophes now carry `&apos;` — XML-equivalent). `pie-to-qti2`'s three identical `escapeXml` copies and `to-pie`'s local `escapeAttribute` delegate to it.
