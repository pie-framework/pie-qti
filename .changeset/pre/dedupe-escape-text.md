---
'@pie-qti/qti-common': patch
---

One `escapeText` instead of three byte-identical copies: apip.ts and catalog-info.ts carried private duplicates of markup.ts's exported text escaper (`& < >`, quotes stay as authored) and now import it from markup, whose export remains the public `escapeText` of `qti-common/accessibility`. Emitted XML is unchanged byte for byte (the accessibility suites that assert the exact strings pass as before). The attribute escapers stay per-module on purpose: markup's `escapeXmlAttribute` also escapes `'` while apip/catalog-info's `escapeAttribute` escape `"` only, and unifying those would change emitted XML.
