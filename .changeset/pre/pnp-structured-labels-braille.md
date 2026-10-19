---
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
---

Structured labels and braille routing (G-13): `pnp.display.structuredLabelSupport` presents choice and match answer sets as one ARIA group named by the interaction prompt, with match columns named by their visible headings. An AfA PNP `<braille/>` grant now routes to the platform `brailleText` preference (`sign-language` to `signingDefinition`), and `getCatalogEntry` under a QTI 3 usage falls back to the APIP support name (`braille-text` → `braille`, `signing-definition` → `sign-language`), so QTI 3 and APIP catalogs share one lookup path. The research note, markup contract, and NVDA checklist live in `packages/item-player/docs/PNP.md`.
