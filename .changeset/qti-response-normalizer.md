---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

Response processing reads responses in the item's content language: string comparisons and mapping keys ignore bidi controls, tatweel and Unicode encoding differences, case-insensitive comparisons fold case in that language, and numbers accept digits in any script, the Arabic separators and the language's decimal mark. `EvalEnv` takes an optional `language`, and `coerceBaseValue` an optional third argument. Stored responses are unchanged.
