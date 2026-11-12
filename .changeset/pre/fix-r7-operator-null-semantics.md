---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

Spec-compliance fixes for operator NULL semantics and the container-taking numeric operators (QTI ASI §5, §10.2 and §15.3, carried to QTI 2.2 and 3.0).

**Scoring changes, stated plainly (items whose response processing uses these operators can score differently):**

- `anyN` is now three-valued: it is false when more than `max` operands are true or more than n − `min` are false, true when at least `min` are true, and otherwise NULL when the NULL operands leave the result undetermined. With `min` 3 and `max` 4, `{true,true,false,NULL}` is NULL, `{true,false,false,NULL}` is false and `{true,true,true,NULL}` is true. Before, NULL operands counted as false. A NULL `anyN` is not true, so the enclosing condition falls through like any other NULL condition. `anyN`'s `min` and `max` are `integerOrVariableRef`, so they may now name a template variable (`min="THEMIN"` or `min="{THEMIN}"`); before, a variable reference silently fell back to the defaults.
- `max`, `min`, `gcd` and `lcm` now accept single, multiple and ordered operands and range over every value of a container: `max({1,5,3})` is 5 and `gcd({12,18})` is 6. Before, a container operand made the result NULL. An operand that is not a numerical value — including an empty container, which QTI reads as NULL — now gives NULL, as the spec defines, instead of an error.
- `divide` by 0, `integerDivide` and `integerModulus` by 0, and a `divide` or `power` result outside the float range now result in NULL, as the spec requires, instead of an error. `integerDivide` now rounds x/y down to the greatest integer not above it (-7/2 is -4), matching `integerModulus`'s x − z·y, instead of truncating towards zero (-3).
- An empty string is NULL in every numeric operator (`sum`, `product`, `subtract`, `divide`, `power`, `mod`, `integerDivide`, `integerModulus`, `max`, `min`, `gcd`, `lcm`, `mathOperator`, `roundTo`), as QTI reads empty strings as NULL (ASI §5). Before, it coerced to 0, so `subtract("", 3)` was -3 and `sum("")` was 0.
- `substring` now results in NULL for a NULL string, start or length — the empty string included — instead of an error. A start past the end still gives the empty string.
- Each `mapEntry` is now matched as case sensitively as its own `caseSensitive` attribute says: a case-sensitive entry matches only its own spelling, so a response in another case takes the mapping default. Before, the lookup also tried the response lower-cased, so a response "A" could match a case-sensitive entry "a".

**Template scoring change:**

- The built-in `map_response` (and `map_response_point`, `CC2_map_response`) templates now score a cleared response 0: their NULL test reads an empty container as NULL too, matching the official template programs, so a cleared multi-select no longer maps to a value that `lowerBound` can clamp above 0. Before, a cleared multi-select with `lowerBound="1"` scored 1; now it scores 0, as the official template's `isNull` branch gives. A non-empty response is still mapped within the bounds.

**API:**

- `@pie-qti/qti-processing` exports `isNullValue(value)`, the QTI NULL test the operators use: true for NULL, an empty container and an empty string.
