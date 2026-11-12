---
'@pie-qti/qti-processing': patch
---

`substring` now implements the QTI operator. Every supported version (QTI 2.1 §4.10, 2.2
§2.12.3.46, 3.0 §2.11.3.46) defines it as a **boolean containment test** on exactly two string
sub-expressions — true when the first expression is a substring of the second — with
`caseSensitive` [1]: boolean = true (required `case-sensitive` in the 3.0 XSD), and NULL when
either operand is NULL. The engine previously implemented an invented `(string, start, length) →
string` extraction with 1-based indexing and an optional third operand, a shape no QTI version
defines, so a spec-authored `<substring>`/`<qti-substring>` mis-scored on every path: with the
spec's two string children it evaluated to invalid (read as false), and case-insensitive
containment was unsupported entirely. Both failures were silent. Case folding follows
`caseSensitive` the way `stringMatch` applies it (the host's string-comparison folds). Building
the extraction shape now throws (`<substring> requires exactly two child expressions`).

**Breaking:** content authored against the old start/length form (e.g.
`<substring>ABCDE, 2, 2</substring>`, which is invalid QTI) no longer compiles — rewrite it per
spec, e.g. with `substring`/`stringMatch`/`index` as the item intends. Content authored per spec
scores correctly for the first time.
