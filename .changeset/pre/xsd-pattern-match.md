---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

`patternMatch` and the text-entry `patternMask` follow XML Schema pattern rules: a pattern must match the whole response, and `\d` matches decimal digits in any script. `patternMatch` reads its pattern from the `pattern` attribute, including a `{TEMPLATE}` reference, where it previously required a second child expression and failed to build otherwise. `xsdPatternToRegExp` and `xsdPatternSource` are exported from `@pie-qti/qti-processing`.
