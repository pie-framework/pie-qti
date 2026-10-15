---
'@pie-qti/qti-common': patch
'@pie-qti/to-pie': patch
'@pie-qti/item-player': patch
'@pie-qti/section-player': patch
---

Read-aloud markup reaches delivery. `prepareContentMarkup` moves from to-pie into `@pie-qti/qti-common/accessibility` and reads QTI 3 names; the item player renders SSML docked as catalog idrefs and `data-qti-suppress-tts` as `data-tts-suppress`, and the section player registers the SSML as `spoken` catalogs and projects QTI 3 interactions without suppressed content.
