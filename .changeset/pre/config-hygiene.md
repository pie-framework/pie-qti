---
'@pie-qti/assessment-player': patch
'@pie-qti/assessment-toolkit': patch
'@pie-qti/default-components': patch
---

Package metadata hygiene: `@pie-qti/default-components` now declares svelte with a caret range (`^5.57.1`) like every other package instead of an exact pin that could ship two svelte runtimes into one bundle; `@pie-qti/assessment-toolkit` drops its never-imported `@pie-qti/ims-cp-core` dependency and `@pie-qti/assessment-player` drops its never-imported direct `@pie-qti/default-components` entry (it consumes default-components transitively through `section-player`, which remains declared). Both packages gain READMEs (assessment-toolkit, source-profiles) describing their role and consumers.
