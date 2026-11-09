---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

QTI parsing now follows the spec's own grammar: content that no QTI version (2.1, 2.2 or 3.0) defines is no longer silently tolerated. Per the project's pre-1.0 policy there is no compatibility surface for invalid content.

Breaking: the following were accepted before but are invalid per the QTI XSDs, and now error (or stop matching) instead:

- **ISO 8601 durations in item XML** (`<baseValue baseType="duration">PT1H</baseValue>`): QTI binds item-XML durations to `xsd:double` seconds, so write `3600`. ISO 8601 (`PT90S`) remains the required encoding at the PCI v1.0 Appendix A variable-JSON boundary, which is unchanged.
- **`equalRounded` roundingMode misspellings** (`significantFigure`, `decimalplace`): the XSDs enumerate exactly `decimalPlaces` and `significantFigures` (default `significantFigures`); any other spelling now fails item compilation.
- **Child-element `randomInteger`/`randomFloat`**: they are empty elements in every QTI version — `min`/`max`/`step` are attributes; elements carrying child expressions now fail compilation.
- **`<console>` in responseProcessing**: defined by no QTI version; it now fails compilation instead of being ignored as a no-op.
- **`caseSensitive` on `<mapping>`**: `caseSensitive` exists on `mapEntry` only. A mapping-level attribute is no longer read; entries without their own `caseSensitive` match case-insensitively, which is the XSD default. Identifier values keep matching exactly.
