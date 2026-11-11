---
'@pie-qti/transform-core': patch
---

Format detection no longer misreads QTI 3.0 items as QTI 2.2. `DetectFormatActivity` checked for camelCase `<assessmentItem`/`<assessmentTest` markup before the QTI 3.0 namespace, and QTI 3.0 items also contain that vocabulary, so a live QTI 3.0 item flowing through the transform workflow was dispatched to QTI 2.2 plugins. The activity now delegates to the canonical `detectQtiVersion` (`@pie-qti/qti-common` `version-detection`, a new workspace dependency of `@pie-qti/transform-core`), which decides by namespace first: the QTI 3.0 namespace detects as `qti30`, camelCase roots with a QTI 2.x namespace or none detect as `qti22` (so unversioned QTI 2.0/2.1 markup now maps to `qti22` too instead of failing), and content that names no QTI version still throws.
