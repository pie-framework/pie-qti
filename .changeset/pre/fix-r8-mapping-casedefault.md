---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

Spec-compliance fixes for mapping string matching and the integer division operators (QTI 2.2 XSD, ASI §15.3 and §17).

**Scoring change, stated plainly (items that map string responses can score differently):** a mapping that authors no `caseSensitive` now matches case-insensitively, as the spec default (`mapEntry@caseSensitive` is optional with `default="false"` in the QTI 2.2 XSD; the QTI 3.0 implementation guide has mapping "by default, NOT case sensitive"). Before, the default matching was case-sensitive, so a typed "Photosynthesis" missed a `photosynthesis` entry and took the mapping default; now it matches and scores the entry's mapped value. Items relying on the old case-sensitive default matching must author `caseSensitive="true"` on the entry (or the mapping element, which the player reads as leniency) to keep matching exactly. Mapping a container also counts once the values a case-insensitive entry matches together: `{Paris, paris}` maps Paris once, not twice. Identifier and the other non-string base types always match exactly, whatever `caseSensitive` says (ASI §17).

**Operator fixes:**

- `integerDivide` and `integerModulus` now divide their operands as they are, without truncating them to integers first. `integerDivide(6.9, 1.9)` is 3 (the spec's floor of 6.9/1.9; before, 6), `integerDivide(-6.9, 1.9)` is -4 (before, -6), and `integerDivide(5.5, 0.9)` is 6 (before, NULL — only an actual zero divisor is NULL). The identity x = `integerDivide(x,y)`·y + `integerModulus(x,y)` now holds for float operands too. Integer operands are unchanged: -7 `integerDivide` 2 is still -4 and its `integerModulus` is still 1.
