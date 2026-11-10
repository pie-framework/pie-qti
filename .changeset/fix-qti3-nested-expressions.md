---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
---

QTI 3.0 items using these processing operators with nested expressions now compile: `integerModulus` (both operands), `integerToFloat`, `roundTo` (value), `substring` (optional length) and `record` (fieldValue member value) handed their build options — which carry the QTI 3 kebab-case name mapping — to nested expression builds, so a `qti-variable` or `qti-base-value` nested inside them no longer fails with "Unknown processing expression tag". `record` now also recognizes its `qti-field-value` members spelled for QTI 3, so constructed records keep their fields instead of silently compiling empty. The item-player validation golden was regenerated for the three conformance fixtures this unblocks.
