---
'@pie-qti/item-player': patch
---

Restored item sessions now keep the NULL defaults and NULL correct responses that template processing set (QTI 2.1 ASI §8 / QTI 3.0 ASI §10, Template Processing: `setDefaultValue` and `setCorrectResponse`; QTI ASI §10.3 fixes their effects for the session). Restore previously fell back to the values parsed from the item XML whenever the snapshot carried NULL — a NULL `defaultValue` (or NULL `correctResponse`) restored as the XML-declared value, so a resumed session could score differently from the one that was saved. The snapshot is now authoritative: `defaultValue` is always applied as serialized (null restores a NULL default), and `correctResponse` is written on every response variable that has or had a correct response — null meaning the correct response is NULL, the field absent meaning the variable has none — and applied as-is on restore.

Serialized-format change: response variables with an XML-declared correct response that template processing set to NULL now serialize `"correctResponse": null` where they previously omitted or kept the XML value. Snapshots written by earlier versions restore unchanged; pre-1.0, no migration.
